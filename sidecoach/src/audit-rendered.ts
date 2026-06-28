// audit-rendered.ts
//
// The `/sidecoach audit <url>` READ PATH. When the audit verb targets a live URL,
// render it and run the SAME proven detection engine the eval measures against the
// oracle (scanRenderedLive: objective a11y + subjective taste lenses), then report
// HONEST findings and an HONEST verdict.
//
// WHY THIS EXISTS: the audit command previously routed to flowK_multi_lens_audit,
// a guidance + static-source-file flow that NEVER rendered the URL and was gated
// behind the entire build pipeline (flowJ -> flowI -> ... -> flowA). So a standalone
// `/sidecoach audit <url>` bailed on prerequisites, never rendered, and reported a
// FALSE "clean / 0 findings". This module is the command-surface counterpart to the
// lane-runner's live validator path - it connects the proven rendered engine to the
// audit command. A diagnosis of an existing URL is the read path; it has no build
// prerequisite (see the "diagnosis IS an audit" rule in CLAUDE.md).
//
// FAIL-CLOSED: scanRenderedLive returns {available:false} on a launch/navigation
// failure. When NEITHER lens rendered, the audit DID NOT RUN -> verdict
// 'inconclusive', NEVER 'clean'. A 'clean' verdict REQUIRES that at least one lens
// actually scanned the page.
import { scanRenderedLive } from './validators/rendered-live-scan';
import type { RenderedScanCollection } from './validators/rendered-live-scan';

export type RenderedAuditVerdict = 'clean' | 'warnings-only' | 'blocked' | 'inconclusive';

export interface RenderedAuditFinding {
  rule: string;
  severity: 'blocking' | 'warning';
  lens: 'objective' | 'subjective';
  selector?: string;
  detail?: string;
}

export interface RenderedAuditLens {
  available: boolean;
  findings: number;
  reason?: string; // present only when unavailable
}

export interface RenderedAuditResult {
  renderUrl: string;
  rendered: boolean; // true iff at least one lens actually scanned the page
  verdict: RenderedAuditVerdict;
  findings: RenderedAuditFinding[];
  severityCounts: { blocking: number; warning: number; info: number };
  unavailableReasons: string[]; // per-lens reasons when a lens could not render
  // Per-lens outcome, for the staged-progress panel (render -> a11y -> taste -> verdict).
  lenses: { objective: RenderedAuditLens; subjective: RenderedAuditLens };
}

// An http(s) URL, localhost[:port][/path], or an ipv4[:port][/path]. Deliberately
// conservative - a non-URL target (a file path, a component name) is left to the flow chain.
const URL_RE = /^(https?:\/\/\S+|localhost(:\d+)?(\/\S*)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/\S*)?)$/i;
// A bare host.tld[:port][/path]. Only treated as a URL with a STRONG signal (explicit port,
// a path, or a recognized public TLD), and NEVER when the host itself is a source/asset file -
// so 'example.com' and 'example.com/path' work without mistaking 'Card.tsx' or 'styles.css'
// for a URL (Codex P2).
const BARE_DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i;
const SOURCE_OR_ASSET_EXT_RE = /\.(tsx?|jsx?|mjs|cjs|css|s[ca]ss|less|json|ya?ml|toml|md|markdown|html?|xml|vue|svelte|astro|py|go|rs|rb|java|kt|c|cc|cpp|h|hpp|sh|sql|txt|png|jpe?g|gif|svg|webp|avif|ico|pdf)$/i;
const COMMON_TLD_RE = /\.(com|org|net|io|dev|app|co|ai|xyz|sh|me|gg|info|biz|us|uk|ca|de|fr|jp|au|nl|so|tv|page|site|tech)$/i;

export function looksLikeUrl(target: string | undefined | null): boolean {
  if (!target) return false;
  const t = target.trim();
  if (URL_RE.test(t)) return true;
  if (!BARE_DOMAIN_RE.test(t)) return false;
  const host = t.split(/[/:]/)[0]; // strip any :port and /path
  if (SOURCE_OR_ASSET_EXT_RE.test(host)) return false; // 'Card.tsx' / 'styles.css' are files, not URLs
  return /:\d+/.test(t) || t.includes('/') || COMMON_TLD_RE.test(host);
}

export function normalizeRenderUrl(target: string): string {
  const t = target.trim();
  return /^https?:\/\//i.test(t) ? t : `http://${t}`;
}

/**
 * Render `target` and run both detection lenses. Pure except for the injected scan
 * (defaults to the real live scanner); deterministic to test via the `scan` seam.
 */
export async function runRenderedAudit(
  target: string,
  deps: { scan?: (renderUrl: string | undefined) => Promise<RenderedScanCollection> } = {}
): Promise<RenderedAuditResult> {
  const renderUrl = normalizeRenderUrl(target);
  const scan = deps.scan ?? scanRenderedLive;
  const collection = await scan(renderUrl);

  const findings: RenderedAuditFinding[] = [];
  const unavailableReasons: string[] = [];

  const obj = collection.objective;
  if (obj.available) {
    for (const f of obj.findings) {
      findings.push({
        rule: f.rule,
        lens: 'objective',
        // objective 'error' (contrast, broken-image, skipped-heading) is blocking;
        // 'warning' (justified-text) is a warning.
        severity: f.severity === 'error' ? 'blocking' : 'warning',
        selector: f.selector,
        detail: f.detail,
      });
    }
  } else {
    unavailableReasons.push(`objective lens unavailable: ${obj.reason}`);
  }

  const subj = collection.subjective;
  if (subj.available) {
    for (const f of subj.findings) {
      // taste findings (tiny-text, nested-cards, marketing-buzzword) are warnings.
      findings.push({ rule: f.rule, lens: 'subjective', severity: 'warning', selector: f.selector, detail: f.detail });
    }
  } else {
    unavailableReasons.push(`subjective lens unavailable: ${subj.reason}`);
  }

  const blocking = findings.filter((f) => f.severity === 'blocking').length;
  const warning = findings.filter((f) => f.severity === 'warning').length;
  const severityCounts = { blocking, warning, info: 0 };

  // Honest verdict. 'clean' is the STRONGEST claim and requires the MOST evidence:
  // BOTH lenses actually scanned AND found nothing. A partial scan (one lens failed)
  // with zero findings is NOT clean - the lens that did not run may have had blockers
  // (Codex P1). And no lens at all is 'inconclusive', never 'clean'.
  const rendered = obj.available || subj.available;
  const bothLensesRan = obj.available && subj.available;
  let verdict: RenderedAuditVerdict;
  if (!rendered) verdict = 'inconclusive'; // no lens ran
  else if (blocking > 0) verdict = 'blocked';
  else if (warning > 0) verdict = 'warnings-only';
  else if (!bothLensesRan) verdict = 'inconclusive'; // partial scan, 0 findings -> cannot certify clean
  else verdict = 'clean'; // both lenses ran, zero findings -> truly clean

  const lenses = {
    objective: {
      available: obj.available,
      findings: findings.filter((f) => f.lens === 'objective').length,
      reason: obj.available ? undefined : obj.reason,
    },
    subjective: {
      available: subj.available,
      findings: findings.filter((f) => f.lens === 'subjective').length,
      reason: subj.available ? undefined : subj.reason,
    },
  };

  return { renderUrl, rendered, verdict, findings, severityCounts, unavailableReasons, lenses };
}
