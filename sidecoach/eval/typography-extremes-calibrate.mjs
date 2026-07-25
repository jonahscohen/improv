#!/usr/bin/env node
/**
 * Stage 4b calibration harness for the rendered typographic-extreme classes:
 *   extreme-negative-tracking, all-caps-body, oversized-h1, sub-11px-ui. (tight-leading PULLED 2026-07-25.)
 *
 * INTEGRITY (the buzzword/typeface-calibrate contract): it imports the SHIPPING in-page scorer
 * (inPageTypographyExtremes) and the SHIPPING Node-side threshold constants + decision fn
 * (typographyExtremesFindingsFromScore) from the built dist and runs them via page.evaluate. It does NOT
 * reimplement any detector, so the sweep measures EXACTLY what ships. Every operating point is frozen on
 * PRINCIPLE + this dev signal, NEVER on the held-out split.
 *
 * Build the dist first (npm run build), then: node eval/typography-extremes-calibrate.mjs
 *
 * WHAT THIS HARNESS CAN AND CANNOT CLAIM - read before quoting a number from it:
 *
 *   - It is NOT the Contract-6 A5a gate. A5a grades a detector against the lead-run Codex SUBJECTIVE labels on
 *     the HELD-OUT split. A5a for every class here is PENDING, not passed (see the per-class notes below). Do
 *     not read anything here as an A5a result.
 *
 *   - POPULATION 1 (dev corpus, 48 externally-sourced real shipped pages) is INDEPENDENT of this rule's author
 *     and carries the PRECISION / false-positive claim - the number that matters for a precision-first class.
 *     TWO classes carry a real Codex DEV label (author != labeler, eval/corpus/dev-subjective-labels.json):
 *       extreme-negative-tracking (0/48), all-caps-body (0/48). (tight-leading carried a dev label too, but was
 *       PULLED 2026-07-25 - the A5a grade proved it unfixable in the wild; see the pull beat.)
 *     For those the dev corpus yields real P against an independent labeler.
 *     TWO classes postdate the 22-class rubric and have NO Codex dev label (like Stage 4a default-typeface):
 *       oversized-h1, sub-11px-ui. Their dev pages enter as PRESUMED-NEGATIVES (precision only); recall for
 *       them comes from the author fixtures, and that limit is stated rather than papered over.
 *
 *   - POPULATION 2 (fixtures under eval/fixtures/typography-extremes) is AUTHOR-CONSTRUCTED and carries the
 *     RECALL claim only. Its labels are definitional (a fixture built to exhibit the defect IS the positive),
 *     not taste judgments, and it is NOT independent evidence about human taste.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// EXIT-CODE COMPLETENESS (the typeface-calibrate contract): any UNEXPECTED failure - a bad import,
// chromium.launch failing, corpus I/O - is an environment/infra failure, the SAME class as the dist-not-built
// check below, and must exit 3, never Node's default 1, so a harness that could not run is never confused with
// a clean pass.
const infraFail = (label) => (e) => { console.error(`\nFAIL (exit 3): ${label}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); process.exit(3); };
process.on('uncaughtException', infraFail('unexpected error'));
process.on('unhandledRejection', infraFail('unexpected rejection'));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const DIST = path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js');
if (!existsSync(DIST)) { console.error(`typography-extremes-calibrate: dist not built (${DIST}). Run npm run build first.`); process.exit(3); }
const {
  inPageTypographyExtremes, typographyExtremesFindingsFromScore,
  TYPO_MIN_CONTENT_CHARS, TRACKING_EXTREME_EM, TRACKING_SHARE_MIN,
  ALLCAPS_SHARE_MIN, H1_VW_RATIO, SUB11_MAX_PX, SUB11_MIN_CHARS,
} = await import(DIST);

const DEV = path.join(ROOT, 'eval/corpus/dev');
const FIX = path.join(ROOT, 'eval/fixtures/typography-extremes');
const LABELS = path.join(ROOT, 'eval/corpus/dev-subjective-labels.json');
const stripScripts = (h) => String(h).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');

// ---- the 4 classes: rule name, the raw score field the sweep reads, the frozen op point, a candidate sweep,
//      whether a min-content guard applies (proportion classes), and whether a real Codex dev label exists.
//      (tight-leading was PULLED 2026-07-25 - unfixable in the wild per the A5a grade; see the pull beat.) ----
const CLASSES = [
  { rule: 'extreme-negative-tracking', field: 'tightTrackingShare', frozen: TRACKING_SHARE_MIN, sweep: [0.05, 0.10, 0.15, 0.20, 0.30, 0.50], guarded: true, labeled: true },
  { rule: 'all-caps-body', field: 'allCapsShare', frozen: ALLCAPS_SHARE_MIN, sweep: [0.05, 0.10, 0.15, 0.20, 0.30, 0.50], guarded: true, labeled: true },
  { rule: 'oversized-h1', field: 'h1Ratio', frozen: H1_VW_RATIO, sweep: [0.08, 0.10, 0.11, 0.12, 0.15, 0.20], guarded: false, labeled: false },
  { rule: 'sub-11px-ui', field: 'sub11Chars', frozen: SUB11_MIN_CHARS, sweep: [40, 60, 100, 150, 200, 300], guarded: false, labeled: false },
];

// SHIPPING firing decision for a class: filter the ONE shipping fn (frozen thresholds) by rule name.
const firesShipped = (score, rule) => typographyExtremesFindingsFromScore(score).some((f) => f.rule === rule);
// inline sweep firing at a candidate threshold (honest distribution view; mirrors the frozen guard).
const firesAt = (score, cls, th) => (!cls.guarded || score.contentChars >= TYPO_MIN_CONTENT_CHARS) && score[cls.field] >= th;

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
    const s = await page.evaluate(inPageTypographyExtremes);
    if (!s || typeof s.contentChars !== 'number') { excluded.push(`${id}: scorer returned no usable score`); return null; }
    return s;
  } catch (e) {
    excluded.push(`${id}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    return null;
  } finally { await ctx.close(); }
}

// parse the target class from a fixture filename (each class name is distinct; none is a substring of another).
const classOfFixture = (id) => CLASSES.find((c) => id.includes(c.rule))?.rule;

const browser = await chromium.launch({ headless: true });

// ---- POPULATION 1: dev corpus (independent; precision only - the labeled classes carry 0 present in dev) ----
const devRows = [];
const devFiles = readdirSync(DEV).filter((x) => x.endsWith('.html')).sort();
for (const f of devFiles) {
  const id = f.replace('.html', '');
  const s = await scorePage(browser, id, readFileSync(path.join(DEV, f), 'utf8'));
  if (!s) continue;
  devRows.push({ id, score: s });
}

// ---- POPULATION 2: author fixtures (recall). class from filename; gt = filename starts with 'p'. ----
const fixRows = [];
const fixFiles = readdirSync(FIX).filter((x) => x.endsWith('.html')).sort();
for (const f of fixFiles) {
  const id = f.replace('.html', '');
  const cls = classOfFixture(id);
  if (!cls) { excluded.push(`${id}: fixture filename names no known class`); continue; }
  const s = await scorePage(browser, id, readFileSync(path.join(FIX, f), 'utf8'));
  if (!s) continue;
  fixRows.push({ id, cls, gt: f.startsWith('p'), score: s });
}
await browser.close();
const expectedPages = devFiles.length + fixFiles.length;
const scoredPages = devRows.length + fixRows.length;

const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log('typographic-extremes CALIBRATION  (source: SHIPPING inPageTypographyExtremes + typographyExtremesFindingsFromScore)');
console.log(`per-element defs: TRACKING_EXTREME_EM=${TRACKING_EXTREME_EM}  SUB11_MAX_PX=${SUB11_MAX_PX}   min content chars=${TYPO_MIN_CONTENT_CHARS}`);
console.log('NOT an A5a result: A5a (held-out Codex detection gate) is PENDING for every class here.\n');

// track precision/recall failures for the exit contract.
let devPrecisionFailures = [];   // (rule,page) a class fired on a dev page that is a labeled/presumed NEGATIVE
let fixFailures = [];            // (rule,page) a positive fixture did not fire, or a negative fixture fired

for (const cls of CLASSES) {
  console.log(`==== ${cls.rule}  (frozen ${cls.field} >= ${cls.frozen}${cls.guarded ? `, min ${TYPO_MIN_CONTENT_CHARS} content chars` : ''}) ====`);
  console.log(cls.labeled
    ? '  dev basis: real Codex label (author != labeler). present=true -> positive, present=false -> negative.'
    : '  dev basis: NO Codex label (postdates the 22-rubric). dev pages enter as PRESUMED-NEGATIVES (precision only).');

  // Population 1 per-class split.
  let devTP = 0, devFP = 0, devFN = 0, devTN = 0;
  const devFired = [], devMissed = [];
  const ranked = devRows.map((r) => ({ id: r.id, v: r.score[cls.field], score: r.score })).sort((a, b) => b.v - a.v);
  for (const r of devRows) {
    const fired = firesShipped(r.score, cls.rule);
    const labelPresent = cls.labeled ? devLabel[r.id]?.[cls.rule] : false; // presumed-negative when unlabeled
    if (labelPresent) { if (fired) { devTP++; devFired.push(r.id); } else { devFN++; devMissed.push(r.id); } }
    else { if (fired) { devFP++; devFired.push(r.id); devPrecisionFailures.push(`${cls.rule}:${r.id}`); } else devTN++; }
  }
  const devP = devTP + devFP ? devTP / (devTP + devFP) : 1;
  const devR = devTP + devFN ? devTP / (devTP + devFN) : (cls.labeled && devTP + devFN === 0 ? 1 : 0);
  console.log(`  top ${cls.field} on dev (closest to firing):`);
  for (const r of ranked.slice(0, 5)) {
    const lab = cls.labeled ? (devLabel[r.id]?.[cls.rule] ? 'P' : '-') : '?';
    console.log(`    ${r.id.padEnd(16)} ${cls.field}=${(typeof r.v === 'number' ? r.v.toFixed(3) : r.v).padStart(7)} label=${lab}  content=${r.score.contentChars}`);
  }
  if (cls.labeled) {
    console.log(`  dev P=${devP.toFixed(3)} R=${devR.toFixed(3)}  (TP=${devTP} FP=${devFP} FN=${devFN} TN=${devTN}; positives labeled=${devTP + devFN})`);
    if (devFired.length) console.log(`    fired on: ${devFired.join(', ')}`);
    if (devMissed.length) console.log(`    MISSED labeled-positive (precision-first recall cost): ${devMissed.join(', ')}`);
  } else {
    console.log(`  dev precision: fired on ${devFP}/${devRows.length} presumed-negative real pages${devFired.length ? ' -> ' + devFired.join(', ') : ' (0 FP)'}`);
  }

  // Population 2 per-class recall.
  const mine = fixRows.filter((r) => r.cls === cls.rule);
  let fTP = 0, fFP = 0, fFN = 0, fTN = 0;
  for (const r of mine) {
    const fired = firesShipped(r.score, cls.rule);
    const mark = r.gt ? (fired ? 'TP' : 'FN') : (fired ? 'FP' : 'TN');
    if (mark === 'TP') fTP++; else if (mark === 'FN') { fFN++; fixFailures.push(`${cls.rule}:${r.id} (positive did not fire)`); }
    else if (mark === 'FP') { fFP++; fixFailures.push(`${cls.rule}:${r.id} (negative fired)`); } else fTN++;
    console.log(`    fixture ${r.id.padEnd(40)} ${r.gt ? 'P' : '-'} ${mark}  ${cls.field}=${(typeof r.score[cls.field] === 'number' ? r.score[cls.field].toFixed(3) : r.score[cls.field])}  content=${r.score.contentChars}`);
  }
  const fR = fTP + fFN ? fTP / (fTP + fFN) : 0;
  console.log(`  fixtures: R=${fR.toFixed(3)} (TP=${fTP} FN=${fFN}), constructed-negative precision: ${fFP === 0 ? 'clean' : fFP + ' fired'} (TN=${fTN})`);

  // honest sweep (inline field compare, mirrors what ships).
  console.log(`  SWEEP ${cls.field} (dev presumed/labeled-negatives + fixtures):`);
  console.log('    thr     TP FP FN TN    R      P');
  for (const th of cls.sweep) {
    let a = 0, b = 0, c = 0, d = 0;
    for (const r of devRows) {
      const fire = firesAt(r.score, cls, th);
      const pos = cls.labeled ? !!devLabel[r.id]?.[cls.rule] : false;
      if (pos && fire) a++; else if (pos && !fire) c++; else if (!pos && fire) b++; else d++;
    }
    for (const r of mine) {
      const fire = firesAt(r.score, cls, th);
      if (r.gt && fire) a++; else if (r.gt && !fire) c++; else if (!r.gt && fire) b++; else d++;
    }
    const p = a + b ? a / (a + b) : 1, q = a + c ? a / (a + c) : 0;
    console.log(`    ${String(th).padStart(5)}   ${String(a).padStart(2)} ${String(b).padStart(2)} ${String(c).padStart(2)} ${String(d).padStart(3)}   ${q.toFixed(3)}  ${p.toFixed(3)}${th === cls.frozen ? '  <- frozen' : ''}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------------------------------------
// EXIT CONTRACT - distinct code per failure class, never a silent success, never a success line unless every
// check passed. An excluded page fails the run (fail-closed): a shrinking denominator must not print OK.
//   2 = a page could not be scored (exclusion / bad fixture name)
//   4 = a class fired on a dev NEGATIVE (labeled-negative or presumed-negative) - precision-first regression
//   5 = a fixture failed (a positive did not fire, or a constructed negative fired) - recall/precision on fixtures
// ---------------------------------------------------------------------------------------------------------
if (excluded.length || scoredPages !== expectedPages) {
  console.error(`\nFAIL (exit 2): ${expectedPages - scoredPages} of ${expectedPages} page(s) could not be scored - INCONCLUSIVE, not OK.`);
  for (const e of excluded) console.error(`  excluded: ${e}`);
  process.exit(2);
}
if (devPrecisionFailures.length) {
  console.error(`\nFAIL (exit 4): ${devPrecisionFailures.length} precision failure(s) - a class fired on a dev negative at the frozen op point:`);
  for (const f of devPrecisionFailures) console.error(`  ${f}`);
  process.exit(4);
}
if (fixFailures.length) {
  console.error(`\nFAIL (exit 5): ${fixFailures.length} fixture failure(s) at the frozen op point:`);
  for (const f of fixFailures) console.error(`  ${f}`);
  process.exit(5);
}
console.log(`typography-extremes-calibrate: OK (${scoredPages}/${expectedPages} pages scored, 0 exclusions; 0 precision failures on ${devRows.length} dev pages; all fixtures at the frozen op point).`);
