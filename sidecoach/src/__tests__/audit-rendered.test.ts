// Unit test for the /sidecoach audit <url> rendered read path (audit-rendered.ts).
// Verifies URL detection, finding/severity mapping, and the HONEST verdict - above all
// the fail-closed guarantee: when no lens renders, the verdict is 'inconclusive', NEVER
// 'clean'. Uses the injected `scan` seam (no real browser).
import { runRenderedAudit, looksLikeUrl, normalizeRenderUrl } from '../audit-rendered';
import type { RenderedScanCollection } from '../validators/rendered-live-scan';

const scanOf = (o: RenderedScanCollection['objective'], s: RenderedScanCollection['subjective']): RenderedScanCollection => ({ objective: o, subjective: s });
const inject = (c: RenderedScanCollection) => ({ scan: async () => c });

async function run() {
  // 1. looksLikeUrl: URL-ish targets fire; non-URL targets (component names, file paths) do not.
  for (const t of [
    'localhost:4830', 'http://localhost:4830', 'https://x.com/p', '127.0.0.1:8080', 'localhost',
    'example.com', 'example.com/pricing', 'sub.example.io:3000', // bare domains (Codex P2)
  ]) {
    if (!looksLikeUrl(t)) throw new Error(`looksLikeUrl should be true for ${t}`);
  }
  for (const t of [
    'homepage', 'the hero section', 'src/components/Card.tsx', '', undefined as any, null as any,
    'Card.tsx', 'styles.css', 'config.json', 'foo.bar', // source/asset files + unknown-TLD bare token
  ]) {
    if (looksLikeUrl(t)) throw new Error(`looksLikeUrl should be false for ${JSON.stringify(t)}`);
  }

  // 2. normalizeRenderUrl: bare host gets http://; explicit scheme is preserved.
  if (normalizeRenderUrl('localhost:4830') !== 'http://localhost:4830') throw new Error('bare host must get http://');
  if (normalizeRenderUrl('https://x.com') !== 'https://x.com') throw new Error('explicit scheme must be preserved');

  // 3. CLEAN: both lenses rendered, zero findings -> clean (and ONLY because we actually scanned).
  const clean = await runRenderedAudit('localhost:4830', inject(scanOf({ available: true, findings: [] }, { available: true, findings: [] })));
  if (!clean.rendered) throw new Error('both lenses available -> rendered must be true');
  if (clean.verdict !== 'clean') throw new Error(`zero findings on a real scan -> clean, got ${clean.verdict}`);

  // 4. BLOCKED: an objective 'error' finding (e.g. low-contrast) maps to blocking -> verdict blocked.
  const blocked = await runRenderedAudit('localhost:4830', inject(scanOf(
    { available: true, findings: [{ rule: 'low-contrast', severity: 'error', selector: 'button' }] },
    { available: true, findings: [] },
  )));
  if (blocked.verdict !== 'blocked') throw new Error(`objective error -> blocked, got ${blocked.verdict}`);
  if (blocked.severityCounts.blocking !== 1) throw new Error('objective error must count as 1 blocking');
  if (blocked.findings[0].lens !== 'objective' || blocked.findings[0].severity !== 'blocking') throw new Error('mapping: objective error -> blocking');

  // 5. WARNINGS-ONLY: objective 'warning' (justified-text) + subjective 'warning' (taste), no blockers.
  const warns = await runRenderedAudit('localhost:4830', inject(scanOf(
    { available: true, findings: [{ rule: 'justified-text', severity: 'warning', selector: 'p' }] },
    { available: true, findings: [{ rule: 'marketing-buzzword', severity: 'warning', selector: 'h1' }] },
  )));
  if (warns.verdict !== 'warnings-only') throw new Error(`only warnings -> warnings-only, got ${warns.verdict}`);
  if (warns.severityCounts.warning !== 2 || warns.severityCounts.blocking !== 0) throw new Error('two warnings, zero blocking');

  // 6. FAIL-CLOSED (the critical guarantee): BOTH lenses unavailable -> the audit did NOT run.
  //    verdict MUST be 'inconclusive', NEVER 'clean'; rendered false; both reasons captured.
  const dead = await runRenderedAudit('localhost:59997', inject(scanOf(
    { available: false, reason: 'ERR_CONNECTION_REFUSED' },
    { available: false, reason: 'ERR_CONNECTION_REFUSED' },
  )));
  if (dead.rendered) throw new Error('no lens available -> rendered must be false');
  // The inconclusive assertion is the fail-closed guarantee: a non-render can ONLY be
  // 'inconclusive' here, so it is provably never 'clean'.
  if (dead.verdict !== 'inconclusive') throw new Error(`render failure MUST be inconclusive (never clean), got ${dead.verdict}`);
  if (dead.unavailableReasons.length !== 2) throw new Error('both lens reasons must be captured');

  // 7. PARTIAL, zero findings (Codex P1): one lens fails, the other renders clean -> NOT clean.
  //    A partial scan with zero findings is 'inconclusive' - the lens that did NOT run may have
  //    had blockers, so the page cannot be certified clean.
  const partial = await runRenderedAudit('localhost:4830', inject(scanOf(
    { available: false, reason: 'objective detector threw' },
    { available: true, findings: [] },
  )));
  if (!partial.rendered) throw new Error('one lens available -> rendered must be true');
  if (partial.verdict !== 'inconclusive') throw new Error(`partial scan, zero findings -> inconclusive (NOT clean), got ${partial.verdict}`);
  if (partial.unavailableReasons.length !== 1) throw new Error('the failed lens reason must still be reported');

  // 7b. PARTIAL with findings: one lens fails, the other finds a warning -> warnings-only,
  //     but the failed lens's reason is still surfaced (coverage incomplete, never certified clean).
  const partialFindings = await runRenderedAudit('localhost:4830', inject(scanOf(
    { available: false, reason: 'objective detector threw' },
    { available: true, findings: [{ rule: 'marketing-buzzword', severity: 'warning', selector: 'h1' }] },
  )));
  if (partialFindings.verdict !== 'warnings-only') throw new Error(`partial + a warning -> warnings-only, got ${partialFindings.verdict}`);
  if (partialFindings.unavailableReasons.length !== 1) throw new Error('partial-with-findings must still report the failed lens');

  console.log('audit-rendered: OK (url detect, normalize, clean/blocked/warnings, FAIL-CLOSED inconclusive, partial-lens)');
}
run().catch((e) => { console.error(e); process.exit(1); });
