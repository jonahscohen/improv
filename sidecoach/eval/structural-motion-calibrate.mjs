#!/usr/bin/env node
/**
 * Stage 4c/4d calibration harness for the rendered structural + motion/marker classes:
 *   4c: thin-border-wide-shadow, repeating-stripe-gradients, text-under-overlay, first-viewport-overflow,
 *       decorative-dot-grid, soft-radial-glow, image-hover-transform
 *   4d: marquee (blinking-cursor PULLED 2026-07-25; numbered-section-markers REMOVED 2026-07-28 - inert,
 *       best reachable precision 0.500; see eval/numbered-markers-removal-evidence.mjs)
 *
 * INTEGRITY (the buzzword/typeface/typography-extremes-calibrate contract): it imports the SHIPPING in-page
 * scorers (inPageStructural + inPageMotionMarker) and the SHIPPING Node-side decision fns
 * (structuralFindingsFromScore + motionMarkerFindingsFromScore) and runs them via page.evaluate. It does NOT
 * reimplement any detector, so the sweep measures EXACTLY what ships. Every operating point is frozen on
 * PRINCIPLE + this dev signal, NEVER on the held-out split.
 *
 * Build the dist first (npm run build), then: node eval/structural-motion-calibrate.mjs
 * (SCANNER_DIST=/abs/path/to/subjective-rendered-scanner.js overrides the dist location so the class author can
 *  point it at a single-file build without rebuilding the whole dist; the default is the committed dist.)
 *
 * WHAT THIS HARNESS CAN AND CANNOT CLAIM - read before quoting a number from it:
 *
 *   - It is NOT the Contract-6 A5a gate. A5a grades a detector against the lead-run Codex SUBJECTIVE labels on
 *     the HELD-OUT split. A5a for every class here is PENDING, not passed. Do not read anything here as A5a.
 *
 *   - POPULATION 1 (dev corpus, 48 externally-sourced real shipped pages) is INDEPENDENT of this rule's author
 *     and carries the PRECISION / false-positive claim - the number that matters for a precision-first class.
 *     ONE class carries a real Codex DEV label (author != labeler, eval/corpus/dev-subjective-labels.json):
 *       numbered-section-markers was the one labeled class here; it is REMOVED, so this harness now measures
 *       precision only (presumed-negatives on dev) for the classes that remain.
 *     The other NINE classes postdate the 22-class rubric and have NO Codex dev label (like Stage 4a/4b's
 *     oversized-h1/sub-11px-ui). Their dev pages enter as PRESUMED-NEGATIVES (precision only); recall for them
 *     comes from the author fixtures, and that limit is stated rather than papered over.
 *
 *   - POPULATION 2 (fixtures under eval/fixtures/structural-motion) is AUTHOR-CONSTRUCTED and carries the RECALL
 *     claim only. Its labels are definitional (a fixture built to exhibit the defect IS the positive), not taste
 *     judgments, and it is NOT independent evidence about human taste.
 *
 * EXIT SEMANTICS (a deliberate, principled refinement of the 4b harness). 4b hard-failed (exit 4) on ANY dev fire,
 * conflating a PRESUMED-negative (an unlabeled page) with a TRUE negative. That was safe only because 4b's classes
 * never fired on dev. Several 4c/4d classes detect idioms that GENUINELY appear on real pages (a blur glow IS a
 * soft-radial-glow; react-fast-marquee IS a marquee), so a fire there is CORRECT DETECTION, not a bug, and calling
 * it a "precision failure" would be false. Therefore:
 *   - a fire on a LABELED-negative (ground truth says the idiom is ABSENT) is a real precision regression -> exit 4.
 *   - a fire on a PRESUMED-negative (unlabeled class) is REPORTED as a dev DETECTION rate, pending A5a's judgment
 *     of whether that idiom is a DEFECT - never a hard failure. The per-class VERDICT line and the closing summary
 *     state each class's dev detection rate explicitly, so nothing is hidden behind a green exit.
 *   - a fixture failure is always a hard failure (exit 5) - fixtures are definitional.
 * So exit 0 means "every fixture behaved + no LABELED-negative regressed"; it does NOT assert 0 dev detections for
 * the common-idiom classes. Read the VERDICT lines.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// EXIT-CODE COMPLETENESS: any UNEXPECTED failure (bad import, chromium.launch, corpus I/O) is an environment/infra
// failure, the SAME class as the dist-not-built check, and must exit 3, never Node's default 1, so a harness that
// could not run is never confused with a clean pass.
const infraFail = (label) => (e) => { console.error(`\nFAIL (exit 3): ${label}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); process.exit(3); };
process.on('uncaughtException', infraFail('unexpected error'));
process.on('unhandledRejection', infraFail('unexpected rejection'));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const DIST = process.env.SCANNER_DIST || path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js');
if (!existsSync(DIST)) { console.error(`structural-motion-calibrate: scanner build not found (${DIST}). Run npm run build first, or set SCANNER_DIST.`); process.exit(3); }
const {
  inPageStructural, structuralFindingsFromScore, inPageMotionMarker, motionMarkerFindingsFromScore,
} = await import(pathToFileURL(DIST).href);

const DEV = path.join(ROOT, 'eval/corpus/dev');
const FIX = path.join(ROOT, 'eval/fixtures/structural-motion');
const LABELS = path.join(ROOT, 'eval/corpus/dev-subjective-labels.json');
const stripScripts = (h) => String(h).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');

// ---- the 10 classes: rule name, which raw count field (for the detail table), and whether a Codex dev label
//      exists. The one labeled class (numbered-section-markers) was REMOVED 2026-07-28, so every remaining
//      class here is a presumed-negative on dev - this harness reports PRECISION only. ----
const CLASSES = [
  { rule: 'thin-border-wide-shadow', family: 'structural', field: 'thinBorderWideShadowCount', labeled: false },
  { rule: 'repeating-stripe-gradients', family: 'structural', field: 'stripeGradientCount', labeled: false },
  { rule: 'text-under-overlay', family: 'structural', field: 'textUnderOverlayCount', labeled: false },
  { rule: 'first-viewport-overflow', family: 'structural', field: 'firstViewportOverflowPx', labeled: false },
  { rule: 'decorative-dot-grid', family: 'structural', field: 'dotGridCount', labeled: false },
  { rule: 'soft-radial-glow', family: 'structural', field: 'radialGlowCount', labeled: false },
  { rule: 'image-hover-transform', family: 'structural', field: 'imageHoverTransformCount', labeled: false },
  { rule: 'marquee', family: 'motion', field: 'marqueeElementCount', labeled: false },
];

// SHIPPING firing decision for a page: run BOTH scorers through the SHIPPING decision fns and union the rule set.
const firedRules = (structScore, motionScore) => new Set([
  ...structuralFindingsFromScore(structScore).map((f) => f.rule),
  ...motionMarkerFindingsFromScore(motionScore).map((f) => f.rule),
]);

// Codex dev labels: labels[page] = list of {class, present}. Build devLabel[page][rule] = boolean | undefined.
const rawLabels = JSON.parse(readFileSync(LABELS, 'utf8')).labels;
const devLabel = {};
for (const [page, v] of Object.entries(rawLabels)) {
  devLabel[page] = {};
  for (const lab of v.labels || []) devLabel[page][lab.class] = !!lab.present;
}

// FAIL-CLOSED: a page that does not render is NOT silently dropped - it is recorded, counted, and fails the run.
const excluded = [];
async function scorePage(browser, id, html) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
  try {
    await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const structScore = await page.evaluate(inPageStructural);
    const motionScore = await page.evaluate(inPageMotionMarker);
    if (!structScore || !motionScore) { excluded.push(`${id}: scorer returned no usable score`); return null; }
    return { structScore, motionScore, fired: firedRules(structScore, motionScore) };
  } catch (e) {
    excluded.push(`${id}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    return null;
  } finally { await ctx.close(); }
}

const classOfFixture = (id) => CLASSES.find((c) => id.includes(c.rule))?.rule;

const browser = await chromium.launch({ headless: true });

// ---- POPULATION 1: dev corpus (independent; precision only since the one labeled class was removed) ----
const devRows = [];
const devFiles = readdirSync(DEV).filter((x) => x.endsWith('.html')).sort();
for (const f of devFiles) {
  const id = f.replace('.html', '');
  const r = await scorePage(browser, id, readFileSync(path.join(DEV, f), 'utf8'));
  if (r) devRows.push({ id, ...r });
}

// ---- POPULATION 2: author fixtures (recall). class from filename; gt = filename starts with 'p'. ----
const fixRows = [];
const fixFiles = readdirSync(FIX).filter((x) => x.endsWith('.html')).sort();
for (const f of fixFiles) {
  const id = f.replace('.html', '');
  const cls = classOfFixture(id);
  if (!cls) { excluded.push(`${id}: fixture filename names no known class`); continue; }
  const r = await scorePage(browser, id, readFileSync(path.join(FIX, f), 'utf8'));
  if (r) fixRows.push({ id, cls, gt: f.startsWith('p'), ...r });
}
await browser.close();
const expectedPages = devFiles.length + fixFiles.length;
const scoredPages = devRows.length + fixRows.length;

console.log('structural + motion/marker CALIBRATION  (source: SHIPPING inPageStructural + inPageMotionMarker + decision fns)');
console.log(`scanner build: ${DIST}`);
console.log('NOT an A5a result: A5a (held-out Codex detection gate) is PENDING for every class here.\n');

let devPrecisionFailures = [];   // a class fired on a LABELED-negative (ground-truth precision regression -> exit 4)
const devPresumedFires = {};     // rule -> [pages]: a class fired on a PRESUMED-negative (reported, not a failure)
let fixFailures = [];            // a positive fixture did not fire, or a negative fixture fired

for (const cls of CLASSES) {
  console.log(`==== ${cls.rule}  (${cls.family})  ====`);
  console.log(cls.labeled
    ? '  dev basis: real Codex label (author != labeler). present=true -> positive, present=false -> negative.'
    : '  dev basis: NO Codex label (postdates the 22-rubric). dev pages enter as PRESUMED-NEGATIVES (precision only).');

  // Population 1 per-class split.
  let devTP = 0, devFP = 0, devFN = 0, devTN = 0;
  const devFired = [], devMissed = [];
  for (const r of devRows) {
    const fired = r.fired.has(cls.rule);
    const labelPresent = cls.labeled ? devLabel[r.id]?.[cls.rule] : false;
    if (labelPresent) { if (fired) { devTP++; devFired.push(r.id); } else { devFN++; devMissed.push(r.id); } }
    else if (fired) {
      devFP++; devFired.push(r.id);
      // LABELED-negative fire = ground-truth precision regression (exit 4); PRESUMED-negative fire = a dev
      // DETECTION pending A5a defect-judgment (reported, never a hard failure). See the EXIT SEMANTICS header.
      if (cls.labeled) devPrecisionFailures.push(`${cls.rule}:${r.id}`);
      else (devPresumedFires[cls.rule] ||= []).push(r.id);
    } else devTN++;
  }
  const devP = devTP + devFP ? devTP / (devTP + devFP) : 1;
  const devR = devTP + devFN ? devTP / (devTP + devFN) : (cls.labeled ? 1 : 0);
  if (cls.labeled) {
    console.log(`  dev P=${devP.toFixed(3)} R=${devR.toFixed(3)}  (TP=${devTP} FP=${devFP} FN=${devFN} TN=${devTN}; positives labeled=${devTP + devFN})`);
    if (devFired.length) console.log(`    fired on: ${devFired.join(', ')}`);
    if (devMissed.length) console.log(`    MISSED labeled-positive (precision-first recall cost): ${devMissed.join(', ')}`);
    console.log(`  VERDICT: ${devFP === 0 ? 'PRECISION-FIRST CLEAN (0 labeled-negative fires)' : `PRECISION REGRESSION (${devFP} labeled-negative fire(s) -> exit 4)`}`);
  } else {
    console.log(`  dev detection: fired on ${devFP}/${devRows.length} presumed-negative real pages${devFired.length ? ' -> ' + devFired.join(', ') : ' (0)'}`);
    console.log(`  VERDICT: ${devFP === 0 ? 'PRECISION-FIRST CLEAN (0/' + devRows.length + ' dev fires)' : 'DETECTS-ON-DEV ' + devFP + '/' + devRows.length + ' (unlabeled real instances; A5a will judge defect-ness)'}`);
  }

  // Population 2 per-class recall.
  const mine = fixRows.filter((r) => r.cls === cls.rule);
  let fTP = 0, fFP = 0, fFN = 0, fTN = 0;
  for (const r of mine) {
    const fired = r.fired.has(cls.rule);
    const mark = r.gt ? (fired ? 'TP' : 'FN') : (fired ? 'FP' : 'TN');
    if (mark === 'TP') fTP++; else if (mark === 'FN') { fFN++; fixFailures.push(`${cls.rule}:${r.id} (positive did not fire)`); }
    else if (mark === 'FP') { fFP++; fixFailures.push(`${cls.rule}:${r.id} (negative fired)`); } else fTN++;
    console.log(`    fixture ${r.id.padEnd(46)} ${r.gt ? 'P' : '-'} ${mark}  ${cls.field}=${r.structScore[cls.field] ?? r.motionScore[cls.field]}`);
  }
  const fR = fTP + fFN ? fTP / (fTP + fFN) : 0;
  console.log(`  fixtures: R=${fR.toFixed(3)} (TP=${fTP} FN=${fFN}), constructed-negative precision: ${fFP === 0 ? 'clean' : fFP + ' fired'} (TN=${fTN})`);
  console.log('');
}

// DEV-DETECTION SUMMARY (the transparency the exit code does NOT encode): the per-class dev detection rate on the
// unlabeled classes. A high rate is not a bug - it is the honest signal that the idiom is common on real pages, so
// A5a must decide whether/when it is a DEFECT (a class that fires on a large share of competently-built pages is a
// low-precision taste guess until A5a says otherwise - the plan's out-of-scope caution).
console.log('DEV-DETECTION SUMMARY (unlabeled classes; A5a-pending defect-judgment):');
for (const cls of CLASSES) {
  if (cls.labeled) continue;
  const n = (devPresumedFires[cls.rule] || []).length;
  console.log(`  ${cls.rule.padEnd(28)} ${n === 0 ? 'clean 0/' + devRows.length : n + '/' + devRows.length + ' -> ' + devPresumedFires[cls.rule].join(', ')}`);
}
console.log('');

// ---------------------------------------------------------------------------------------------------------
// EXIT CONTRACT - distinct code per failure class, never a silent success, never a success line unless every
// check passed. An excluded page fails the run (fail-closed). See the EXIT SEMANTICS header: a PRESUMED-negative
// dev fire is reported (above), NOT a failure; only a LABELED-negative fire regresses precision.
//   2 = a page could not be scored (exclusion / bad fixture name)
//   4 = a class fired on a LABELED-negative (ground-truth precision regression)
//   5 = a fixture failed (a positive did not fire, or a constructed negative fired) - recall/precision on fixtures
// ---------------------------------------------------------------------------------------------------------
if (excluded.length || scoredPages !== expectedPages) {
  console.error(`\nFAIL (exit 2): ${expectedPages - scoredPages} of ${expectedPages} page(s) could not be scored - INCONCLUSIVE, not OK.`);
  for (const e of excluded) console.error(`  excluded: ${e}`);
  process.exit(2);
}
if (devPrecisionFailures.length) {
  console.error(`\nFAIL (exit 4): ${devPrecisionFailures.length} precision regression(s) - a class fired on a LABELED-negative (ground truth says the idiom is absent):`);
  for (const f of devPrecisionFailures) console.error(`  ${f}`);
  process.exit(4);
}
if (fixFailures.length) {
  console.error(`\nFAIL (exit 5): ${fixFailures.length} fixture failure(s) at the frozen op point:`);
  for (const f of fixFailures) console.error(`  ${f}`);
  process.exit(5);
}
const totalPresumedFires = Object.values(devPresumedFires).reduce((n, a) => n + a.length, 0);
console.log(`structural-motion-calibrate: OK (${scoredPages}/${expectedPages} pages scored, 0 exclusions; 0 LABELED-negative precision failures; ${totalPresumedFires} presumed-negative dev detection(s) across the unlabeled classes reported above (A5a-pending, NOT failures); all fixtures at the frozen op point).`);
