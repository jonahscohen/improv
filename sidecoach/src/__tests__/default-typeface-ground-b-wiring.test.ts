// sidecoach/src/__tests__/default-typeface-ground-b-wiring.test.ts
//
// Stage 4b: LIVE activation of default-typeface Ground B (brand mismatch). Ground B ships correct + calibrated
// + tested behind a seam (TypefaceFindingOptions.brandFamilies) but was INERT on the live path because nothing
// supplied a committed family. This suite proves the wiring that feeds it, end to end:
//
//   DESIGN.md typography tokens -> loadCommittedFontFamilies -> run-validator / audit-rendered -> the scanner
//   Ground B seam -> a brand-mismatch finding.
//
// THE LOAD-BEARING PROPERTY (asserted explicitly, more than once): a project with NO committed family NEVER
// fires Ground B. A page with no committed typeface is not a brand mismatch, and a false brand-mismatch on
// every project without a DESIGN.md would be worse than leaving Ground B inert. Every "no brand" path here must
// hand the scanner nothing (opts undefined) and the scanner must stay silent.
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { committedFontFamilies, loadCommittedFontFamilies } from '../project-context';
import { analyzeHtmlOnBrowserSubjective } from '../validators/subjective-rendered-scanner';
import { runValidatorForTest } from '../validators/run-validator';
import { runRenderedAudit } from '../audit-rendered';
import type { RenderedScanCollection, LiveScanOptions } from '../validators/rendered-live-scan';

const failures: string[] = [];
let asserted = 0;
const check = (cond: boolean, msg: string) => { asserted++; if (!cond) failures.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => check(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

// A DESIGN.md with a YAML typography frontmatter committing `family` for the body role.
const designMd = (family: string) =>
  `---\ntypography:\n  body:\n    family: "${family}"\n    weights: [400, 700]\n  scale:\n    base: "16px"\n---\n\n# Design\n`;

// A well-typeset content page set in a CHOSEN face (never a system stack, so Ground A stays silent and only
// Ground B is in play). The @font-face is irrelevant - the scanner measures the DECLARED stack, not the paint.
const S = 'This is a running body sentence with clearly more than six words of content text. ';
const pageInFamily = (family: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:"${family}";src:url(data:font/woff2;base64,) format("woff2");}</style></head>` +
  `<body style="font-family:'${family}', sans-serif; color:#111"><main><h1>${S}</h1><p>${S.repeat(6)}</p><p>${S.repeat(6)}</p></main></body></html>`;

// Make a throwaway project dir; write DESIGN.md when a family is committed. Returns the dir path.
function makeProject(committedFamily: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-groundb-'));
  if (committedFamily !== null) fs.writeFileSync(path.join(dir, 'DESIGN.md'), designMd(committedFamily), 'utf8');
  return dir;
}

// A scanRenderedLive / audit-scan double that CAPTURES the opts it is handed (the wiring under test) and
// returns a harmless both-unavailable collection so the caller proceeds without a real browser.
function capturingScan() {
  const calls: Array<LiveScanOptions | undefined> = [];
  const scan = async (_url: string | undefined, _signal?: AbortSignal, opts?: LiveScanOptions): Promise<RenderedScanCollection> => {
    calls.push(opts);
    return { objective: { available: false, reason: 'test' }, subjective: { available: false, reason: 'test' } };
  };
  return { scan, calls };
}

async function run(): Promise<void> {
  const dirs: string[] = [];
  const proj = (fam: string | null) => { const d = makeProject(fam); dirs.push(d); return d; };
  const browser = await chromium.launch({ headless: true });
  try {
    // ---------------------------------------------------------------------
    // PART 1: extraction (pure). committedFontFamilies + loadCommittedFontFamilies.
    // ---------------------------------------------------------------------
    eq(committedFontFamilies(undefined), [], 'extract: undefined typography -> []');
    eq(committedFontFamilies({ scale: { base: '16px' } }), [], 'extract: typography without any family -> []');
    eq(
      committedFontFamilies({
        display: { family: "'GT Sectra', Georgia, serif" },
        body: { family: "'Inter', system-ui, sans-serif" },
        mono: { family: "'JetBrains Mono', ui-monospace, monospace" },
      }),
      ['GT Sectra', 'Inter', 'JetBrains Mono'],
      'extract: lead of each role family, quote-stripped, deduped',
    );
    // Fail-closed at the source: a "commitment" to a pure system stack is NOT a chosen brand face.
    eq(committedFontFamilies({ body: { family: 'system-ui, sans-serif' } }), [], 'extract: system-only lead dropped -> []');
    eq(committedFontFamilies({ body: { family: 'Arial, sans-serif' } }), [], 'extract: websafe (Arial) lead dropped -> []');
    // A legal quoted family containing a comma survives whole (not truncated at the comma).
    eq(committedFontFamilies({ body: { family: "'Arial, Grotesk', sans-serif" } }), ['Arial, Grotesk'], 'extract: quoted-comma family kept whole');

    eq(loadCommittedFontFamilies(proj('\'Verge Serif\', Georgia, serif')), ['Verge Serif'], 'load: DESIGN.md committing Verge Serif');
    eq(loadCommittedFontFamilies(proj(null)), [], 'load: project with NO DESIGN.md -> [] (fail-closed)');
    eq(loadCommittedFontFamilies(''), [], 'load: empty path -> []');
    eq(loadCommittedFontFamilies('/no/such/dir/xyz'), [], 'load: missing dir -> []');

    // ---------------------------------------------------------------------
    // PART 2: run-validator forwarding. The committed family must reach scanRenderedLive as opts.typeface;
    // no committed family must hand it NOTHING (opts undefined) - the fail-closed wiring property.
    // ---------------------------------------------------------------------
    const collectStub = async () => ({ available: false as const, reason: 'test' });

    const rvMismatch = capturingScan();
    await runValidatorForTest(
      'polish-standard',
      { projectPath: proj('\'Verge Serif\', serif'), target: 'http://localhost:9/', renderUrl: 'http://localhost:9/' },
      { collectBrowserEvidence: collectStub, scanRenderedLive: rvMismatch.scan },
    );
    eq(rvMismatch.calls.length >= 1 ? rvMismatch.calls[0]?.typeface?.brandFamilies : 'NOT-CALLED', ['Verge Serif'],
      'run-validator: DESIGN.md family forwarded to scanRenderedLive opts.typeface.brandFamilies');

    const rvNoBrand = capturingScan();
    await runValidatorForTest(
      'polish-standard',
      { projectPath: proj(null), target: 'http://localhost:9/', renderUrl: 'http://localhost:9/' },
      { collectBrowserEvidence: collectStub, scanRenderedLive: rvNoBrand.scan },
    );
    check(rvNoBrand.calls.length >= 1 && rvNoBrand.calls[0] === undefined,
      `run-validator: NO DESIGN.md -> scanRenderedLive opts undefined (fail-closed), got ${JSON.stringify(rvNoBrand.calls[0])}`);

    const rvInMemory = capturingScan();
    await runValidatorForTest(
      'polish-standard',
      { files: [], target: 'http://localhost:9/', renderUrl: 'http://localhost:9/' },
      { collectBrowserEvidence: collectStub, scanRenderedLive: rvInMemory.scan },
    );
    check(rvInMemory.calls.length >= 1 && rvInMemory.calls[0] === undefined,
      `run-validator: in-memory context (no projectPath) -> opts undefined (fail-closed), got ${JSON.stringify(rvInMemory.calls[0])}`);

    // ---------------------------------------------------------------------
    // PART 3: audit-rendered forwarding.
    // ---------------------------------------------------------------------
    const auMismatch = capturingScan();
    await runRenderedAudit('localhost:9', { scan: auMismatch.scan, projectPath: proj('\'Verge Serif\', serif') });
    eq(auMismatch.calls[0]?.typeface?.brandFamilies, ['Verge Serif'], 'audit: DESIGN.md family forwarded to scan opts.typeface.brandFamilies');

    const auNoBrand = capturingScan();
    await runRenderedAudit('localhost:9', { scan: auNoBrand.scan, projectPath: proj(null) });
    check(auNoBrand.calls[0] === undefined, `audit: NO DESIGN.md -> opts undefined (fail-closed), got ${JSON.stringify(auNoBrand.calls[0])}`);

    const auInject = capturingScan();
    await runRenderedAudit('localhost:9', { scan: auInject.scan, committedFamilies: ['Injected Face'] });
    eq(auInject.calls[0]?.typeface?.brandFamilies, ['Injected Face'], 'audit: injected committedFamilies override forwarded');

    // ---------------------------------------------------------------------
    // PART 4: END TO END through the REAL scanner. DESIGN.md -> loadCommittedFontFamilies -> scanner Ground B.
    // The page is set in a CHOSEN face "Alluvium Sans", so Ground A never fires and Ground B is the only actor.
    // ---------------------------------------------------------------------
    const page = pageInFamily('Alluvium Sans');
    // analyzeHtmlOnBrowserSubjective is the shipping scan function (the calibration harness's path); unlike
    // scanSubjectiveRendered it does NOT own/close the browser, so one launch serves all three cases. It applies
    // typefaceFindingFromScore with the SAME opts.typeface the live path forwards - the exact Ground B logic.
    const dtHits = async (brandFamilies?: string[]) => {
      const opts = brandFamilies && brandFamilies.length ? { brandFamilies } : {};
      const found = await analyzeHtmlOnBrowserSubjective(browser, page, 30000, {}, opts);
      return found.filter((f) => f.rule === 'default-typeface');
    };

    // (1) committed family that is NOT what the page uses -> Ground B FIRES (brand mismatch).
    const committedMismatch = loadCommittedFontFamilies(proj('\'Verge Serif\', Georgia, serif'));
    eq(committedMismatch, ['Verge Serif'], 'e2e precondition: mismatch project commits Verge Serif');
    const fireHits = await dtHits(committedMismatch);
    check(fireHits.length === 1, `e2e(1) REQUIRED: committed family absent from content -> Ground B FIRES, got ${fireHits.length} default-typeface finding(s)`);
    check(!!fireHits[0]?.detail?.startsWith('brand-mismatch:'), `e2e(1): the finding is the brand-mismatch ground, got detail=${JSON.stringify(fireHits[0]?.detail)}`);

    // (2) committed family that IS what the page uses -> does NOT fire.
    const committedMatch = loadCommittedFontFamilies(proj('\'Alluvium Sans\', sans-serif'));
    eq(committedMatch, ['Alluvium Sans'], 'e2e precondition: match project commits Alluvium Sans');
    const usedHits = await dtHits(committedMatch);
    check(usedHits.length === 0, `e2e(2) REQUIRED: committed family IS used -> no finding, got ${usedHits.length} (${JSON.stringify(usedHits)})`);

    // (3) THE ONE THAT MATTERS MOST: NO committed family -> Ground B does NOT fire.
    const committedNone = loadCommittedFontFamilies(proj(null));
    eq(committedNone, [], 'e2e precondition: no-brand project commits nothing');
    const inertHits = await dtHits(committedNone);
    check(inertHits.length === 0, `e2e(3) REQUIRED (fail-closed): NO committed family -> Ground B silent, got ${inertHits.length} (${JSON.stringify(inertHits)})`);
  } finally {
    await browser.close();
    for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  }

  if (failures.length) throw new Error(`default-typeface-ground-b-wiring FAILED (${failures.length}/${asserted}):\n  ${failures.join('\n  ')}`);
  console.log(`default-typeface-ground-b-wiring: OK (${asserted} asserted)`);
}

run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
