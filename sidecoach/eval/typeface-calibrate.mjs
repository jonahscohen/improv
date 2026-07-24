#!/usr/bin/env node
/**
 * Stage 4a calibration harness for the rendered `default-typeface` detector.
 *
 * INTEGRITY (the buzzword-calibrate contract): it imports the SHIPPING in-page scorer (inPageTypeface) and the
 * SHIPPING Node-side threshold constants from the built dist and runs them via page.evaluate. It does NOT
 * reimplement the detector, so the sweep measures EXACTLY what ships.
 *
 * Build the dist first (npm run build), then: node eval/typeface-calibrate.mjs
 * The operating point is frozen on PRINCIPLE + this dev signal, NEVER on the held-out split.
 *
 * WHAT THIS HARNESS CAN AND CANNOT CLAIM - read before quoting a number from it:
 *
 *   - It is NOT the Contract-6 A5a gate. A5a grades a detector against the lead-run Codex SUBJECTIVE labels.
 *     No Codex label exists for default-typeface: the 22-class subjective rubric predates the class, and the
 *     rule's author may not label it (author != labeler, corpus/rule-authors.json). A5a for this class is
 *     therefore NOT RUN, not passed. Do not read anything here as an A5a result.
 *
 *   - POPULATION 1 (dev corpus, 48 externally-sourced real shipped pages) is INDEPENDENT of this rule's author
 *     and carries the PRECISION / false-positive claim. That is the number that matters for a precision-first
 *     class: how often does it fire on real, competently typeset pages?
 *
 *   - POPULATION 2 (fixtures under eval/fixtures/default-typeface) is AUTHOR-CONSTRUCTED and carries the RECALL
 *     claim only. Its labels are definitional (a fixture whose stylesheet names only system-vocabulary families
 *     IS the positive), not taste judgments, and it is NOT independent evidence about human taste.
 *
 *   - The STATIC SOURCE-DECLARATION CROSS-CHECK is a second, deliberately different basis (regex over the raw
 *     source: does this page ship a chosen typeface at all?) run against the same pages. It is a disagreement
 *     probe, not ground truth. Where the rendered engine and the static oracle disagree, the disagreement is
 *     printed case by case so a human can see which one is right.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// EXIT-CODE COMPLETENESS (Codex re-review P2): the documented 2/4/5/6 verdict exits only fire on the checks
// that reach them. Any UNEXPECTED failure - a bad import, chromium.launch failing, corpus I/O - is an
// environment/infra failure, the SAME class as the dist-not-built check below, and must exit with THAT code
// (3), never Node's default 1, so a harness that could not run is never confused with a clean pass. Top-level
// await rejections surface here as unhandledRejection.
const infraFail = (label) => (e) => { console.error(`\nFAIL (exit 3): ${label}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); process.exit(3); };
process.on('uncaughtException', infraFail('unexpected error'));
process.on('unhandledRejection', infraFail('unexpected rejection'));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const DIST = path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js');
if (!existsSync(DIST)) { console.error(`typeface-calibrate: dist not built (${DIST}). Run npm run build first.`); process.exit(3); }
const { inPageTypeface, typefaceFindingFromScore, DEFAULT_STACK_SHARE, BRAND_PRESENCE_MIN, TYPEFACE_MIN_CONTENT_CHARS } = await import(DIST);
const { SYSTEM_FONT_STACK_FAMILIES } = await import(path.join(ROOT, 'dist/reference-data.js'));

const DEV = path.join(ROOT, 'eval/corpus/dev');
const FIX = path.join(ROOT, 'eval/fixtures/default-typeface');
const stripScripts = (h) => String(h).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');

// ---------------------------------------------------------------------------
// The INDEPENDENT static source-declaration oracle. Deliberately a different basis from the detector: it never
// renders, never walks the tree, and never weights by character amount. It answers one question from the raw
// bytes - "does this page ship a chosen typeface at all?" - and is used only as a disagreement probe.
// ---------------------------------------------------------------------------
const SYSTEM_SET = new Set(SYSTEM_FONT_STACK_FAMILIES);
const FONT_SERVICE_RE = /(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|p\.typekit\.net|api\.fontshare\.com|fonts\.bunny\.net|use\.fontawesome\.com)/i;
// Quote-aware first-family read, matching the scanner's splitFamilies (a naive split(',') mis-reads a legal
// quoted family name containing a comma - Codex review P2).
function firstFamily(decl) {
  let cur = '', quote = '';
  for (const ch of String(decl)) {
    if (quote) { if (ch === quote) quote = ''; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ',') break;
    cur += ch;
  }
  return cur.trim().replace(/\s+/g, ' ').toLowerCase();
}
function staticDeclaresChosenTypeface(html) {
  if (/@font-face/i.test(html)) return true;
  if (FONT_SERVICE_RE.test(html)) return true;
  for (const m of html.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const first = firstFamily(m[1]);
    if (first && first !== 'inherit' && first !== 'initial' && first !== 'unset' && !SYSTEM_SET.has(first)) return true;
  }
  return false;
}

// FAIL-CLOSED (Codex review P1): a page that does not render is NOT silently dropped. It is returned as an
// explicit exclusion, counted, reported, and made to fail the run - a smaller denominator must never be able
// to print OK. This mirrors the scanner's own posture: a scan that did not run is never "clean".
const excluded = [];
async function scorePage(browser, id, html) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
  try {
    await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const s = await page.evaluate(inPageTypeface);
    if (!s || typeof s.defaultStackShare !== 'number' || Number.isNaN(s.defaultStackShare)) {
      excluded.push(`${id}: scorer returned no usable score`);
      return null;
    }
    return s;
  } catch (e) {
    excluded.push(`${id}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
    return null;
  } finally { await ctx.close(); }
}

const browser = await chromium.launch({ headless: true });

// ---- POPULATION 1: the 48 externally-sourced dev pages (independent; PRECISION) -------------------------
const devRows = [];
const devFiles = readdirSync(DEV).filter((x) => x.endsWith('.html')).sort();
for (const f of devFiles) {
  const html = readFileSync(path.join(DEV, f), 'utf8');
  const id = f.replace('.html', '');
  const s = await scorePage(browser, id, html);
  if (!s) continue; // recorded in `excluded`; the run FAILS at the end rather than shrinking the denominator
  devRows.push({ id, score: s, staticChosen: staticDeclaresChosenTypeface(html) });
}

// ---- POPULATION 2: author-constructed fixtures (RECALL). Label = filename prefix p*/n*. ------------------
const fixRows = [];
const fixFiles = readdirSync(FIX).filter((x) => x.endsWith('.html')).sort();
for (const f of fixFiles) {
  const html = readFileSync(path.join(FIX, f), 'utf8');
  const id = f.replace('.html', '');
  const s = await scorePage(browser, id, html);
  if (!s) continue;
  fixRows.push({ id, gt: f.startsWith('p'), score: s, staticChosen: staticDeclaresChosenTypeface(html) });
}
await browser.close();
const expectedPages = devFiles.length + fixFiles.length;

const fires = (s) => typefaceFindingFromScore(s, {}) !== null;
const pct = (x) => `${(x * 100).toFixed(1)}%`;

console.log('default-typeface CALIBRATION  (source: SHIPPING inPageTypeface + typefaceFindingFromScore)');
console.log(`frozen operating point: DEFAULT_STACK_SHARE = ${DEFAULT_STACK_SHARE}   (min content chars = ${TYPEFACE_MIN_CONTENT_CHARS})`);
console.log('NOT an A5a result: no Codex subjective label exists for this class (see the header of this file).\n');

// --- Population 1 report ---------------------------------------------------------------------------------
const devFire = devRows.filter((r) => fires(r.score));
devRows.sort((a, b) => b.score.defaultStackShare - a.score.defaultStackShare);
console.log(`POPULATION 1 - dev corpus: ${devRows.length} externally-sourced real pages (INDEPENDENT; precision claim)`);
console.log('  top default-stack shares (the pages closest to firing):');
for (const r of devRows.slice(0, 8)) {
  console.log(`    ${r.id.padEnd(16)} share=${pct(r.score.defaultStackShare).padStart(6)}  chars=${String(r.score.contentChars).padStart(6)}  dominant=${r.score.dominantFamily || '(none)'}`);
}
console.log(`  FIRES at ${DEFAULT_STACK_SHARE}: ${devFire.length} / ${devRows.length}${devFire.length ? ' -> ' + devFire.map((r) => r.id).join(', ') : ''}`);
const maxDev = devRows.length ? devRows[0].score.defaultStackShare : 0;
console.log(`  max default-stack share on any real page = ${pct(maxDev)} (${devRows[0]?.id})  -> headroom to threshold: ${(DEFAULT_STACK_SHARE / (maxDev || 1e-9)).toFixed(1)}x`);
const devPrecisionNote = devFire.length === 0
  ? `  precision on real pages: NO false positives across ${devRows.length} pages (FP rate 0/${devRows.length}).`
  : `  precision on real pages: ${devFire.length} page(s) fired - inspect each before treating them as FPs.`;
console.log(devPrecisionNote + '\n');

// --- Population 2 report ---------------------------------------------------------------------------------
let tp = 0, fp = 0, fn = 0, tn = 0;
console.log(`POPULATION 2 - fixtures: ${fixRows.length} author-constructed pages (recall claim only; NOT independent)`);
for (const r of fixRows) {
  const fire = fires(r.score);
  const mark = r.gt ? (fire ? 'TP' : 'FN') : (fire ? 'FP' : 'TN');
  if (mark === 'TP') tp++; else if (mark === 'FP') fp++; else if (mark === 'FN') fn++; else tn++;
  console.log(`    ${r.id.padEnd(38)} ${r.gt ? 'P' : '-'} ${mark}  share=${pct(r.score.defaultStackShare).padStart(6)}  chars=${String(r.score.contentChars).padStart(5)}  dominant=${r.score.dominantFamily || '(none)'}`);
}
const prec = tp + fp ? tp / (tp + fp) : 1, rec = tp + fn ? tp / (tp + fn) : 0;
const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
console.log(`  fixtures: R=${rec.toFixed(3)} P=${prec.toFixed(3)} F1=${f1.toFixed(3)}  (TP=${tp} FP=${fp} FN=${fn} TN=${tn})\n`);

// --- Combined sweep (both populations, one table) ---------------------------------------------------------
// The dev pages are all TRUE NEGATIVES for this class (48 real shipped sites, every one of which ships a
// chosen typeface - verified by the static oracle below), so they enter the sweep as negatives.
const all = [...fixRows, ...devRows.map((r) => ({ id: r.id, gt: false, score: r.score }))];
console.log('SWEEP defaultStackShare over BOTH populations (dev pages enter as negatives):');
console.log('  thr    TP FP FN TN    R      P      F1');
const sweepRows = [];
for (const th of [0.30, 0.40, 0.50, 0.60, 0.70, 0.75, 0.80, 0.90, 0.95]) {
  let a = 0, b = 0, c = 0, d = 0;
  for (const r of all) {
    const fire = r.score.contentChars >= TYPEFACE_MIN_CONTENT_CHARS && r.score.defaultStackShare >= th;
    if (r.gt && fire) a++; else if (r.gt && !fire) c++; else if (!r.gt && fire) b++; else d++;
  }
  const p = a + b ? a / (a + b) : 1, q = a + c ? a / (a + c) : 0, ff = p + q ? (2 * p * q) / (p + q) : 0;
  const mark = th === DEFAULT_STACK_SHARE ? '  <- frozen' : '';
  sweepRows.push(`${q.toFixed(3)}/${p.toFixed(3)}`);
  console.log(`  ${th.toFixed(2)}  ${String(a).padStart(3)} ${String(b).padStart(2)} ${String(c).padStart(2)} ${String(d).padStart(3)}   ${q.toFixed(3)}  ${p.toFixed(3)}  ${ff.toFixed(3)}${mark}`);
}
if (new Set(sweepRows).size === 1) {
  console.log('  READ THIS ROW SET HONESTLY: every threshold scores identically, because the score distribution is');
  console.log('  BIMODAL (real pages 0.00-0.06, unchosen-typeface pages 1.00). The sweep confirms the frozen point sits');
  console.log('  inside a wide safe band; it does NOT empirically discriminate it from its neighbours. The operating');
  console.log('  point is set by the readability/brand principle in the scanner comment, not by this table.');
}

// --- GROUND B calibration: BRAND_PRESENCE_MIN over the same independent dev corpus ------------------------
// Ground B (a KNOWN committed family that does not reach the content) also ships behind a threshold, so it
// gets its own sweep rather than riding on ground A's (Codex review P1: "sweeps exactly what ships" was only
// true for ground A). The population is built from the dev corpus WITHOUT any new labelling:
//   NEGATIVE - each page scanned against ITS OWN dominant family. The commitment demonstrably landed, so the
//              detector must stay silent. This is the false-positive measurement for ground B.
//   POSITIVE - each page scanned against a family it provably does not use (a sentinel). The commitment
//              cannot have landed, so the detector must fire. This is the recall measurement.
// Both labels follow from the page's own rendered content, not from anyone's taste judgment.
const SENTINEL = '__no-such-typeface-anywhere__';
const brandEligible = devRows.filter((r) => r.score.contentChars >= TYPEFACE_MIN_CONTENT_CHARS && r.score.dominantFamily);
let bTP = 0, bFN = 0, bFP = 0, bTN = 0, bMeasured = 0;
const bFPs = [], bFNs = [];
for (const r of brandEligible) {
  // Ground A must be inert for this to be a clean ground-B measurement; every dev page is well under its
  // threshold, but skip (do not assume) any page that is not. bMeasured counts the rows ACTUALLY measured -
  // the guard below fails on bMeasured, not brandEligible.length, so ground B cannot pass vacuously if every
  // eligible row were skipped (Codex re-review P1).
  if (r.score.defaultStackShare >= DEFAULT_STACK_SHARE) continue;
  bMeasured++;
  if (typefaceFindingFromScore(r.score, { brandFamilies: [r.score.dominantFamily] })) { bFP++; bFPs.push(r.id); } else bTN++;
  if (typefaceFindingFromScore(r.score, { brandFamilies: [SENTINEL] })) bTP++; else { bFN++; bFNs.push(r.id); }
}
const bPrec = bTP + bFP ? bTP / (bTP + bFP) : 1, bRec = bTP + bFN ? bTP / (bTP + bFN) : 0;
console.log(`\nGROUND B - BRAND_PRESENCE_MIN = ${BRAND_PRESENCE_MIN}, over ${bMeasured} measured dev pages (of ${brandEligible.length} eligible; INDEPENDENT population, labels derived from each page's own rendered content):`);
console.log(`  committed family == the page's own dominant family (must stay silent): ${bTN} silent / ${bFP} fired`);
console.log(`  committed family == a family the page provably does not use  (must fire): ${bTP} fired / ${bFN} silent`);
console.log(`  ground B: R=${bRec.toFixed(3)} P=${bPrec.toFixed(3)}  (TP=${bTP} FP=${bFP} FN=${bFN} TN=${bTN})`);
if (bFPs.length) console.log(`  ground-B FALSE POSITIVES: ${bFPs.join(', ')}`);
if (bFNs.length) console.log(`  ground-B FALSE NEGATIVES: ${bFNs.join(', ')}`);
console.log('  SWEEP BRAND_PRESENCE_MIN (own-family negatives / sentinel positives):');
console.log('    thr    TP FP FN TN    R      P');
for (const th of [0.05, 0.10, 0.25, 0.40, 0.50, 0.75]) {
  let a = 0, b = 0, c = 0, d = 0;
  for (const r of brandEligible) {
    if (r.score.defaultStackShare >= DEFAULT_STACK_SHARE) continue;
    const ownShare = r.score.dominantShare;             // committed == dominant family
    if (ownShare < th) { b++; } else { d++; }           // fired on a landed commitment => FP
    if (0 < th) { a++; } else { c++; }                  // sentinel share is 0, fires for any positive th
  }
  const p = a + b ? a / (a + b) : 1, q = a + c ? a / (a + c) : 0;
  console.log(`    ${th.toFixed(2)}  ${String(a).padStart(3)} ${String(b).padStart(2)} ${String(c).padStart(2)} ${String(d).padStart(3)}   ${q.toFixed(3)}  ${p.toFixed(3)}${th === BRAND_PRESENCE_MIN ? '  <- frozen' : ''}`);
}

// --- Independent static cross-check -----------------------------------------------------------------------
console.log('\nCROSS-CHECK vs the INDEPENDENT static source-declaration oracle (different basis: raw source, no render).');
console.log('  static says "no chosen typeface shipped" -> it would call the page a default-typeface page.');
const disagreements = [];
for (const r of [...fixRows, ...devRows]) {
  const rendered = fires(r.score);
  const staticSays = !r.staticChosen; // static positive == ships no chosen typeface
  if (rendered !== staticSays) disagreements.push({ id: r.id, rendered, staticSays, share: r.score.defaultStackShare });
}
console.log(`  agree on ${fixRows.length + devRows.length - disagreements.length} / ${fixRows.length + devRows.length} pages.`);
if (disagreements.length) {
  console.log('  DISAGREEMENTS (each one is a real difference between a rendered read and a static read):');
  for (const d of disagreements) {
    console.log(`    ${d.id.padEnd(38)} rendered=${d.rendered ? 'FIRES' : 'clean'}  static=${d.staticSays ? 'FIRES' : 'clean'}  share=${pct(d.share)}`);
  }
  console.log('  NOTE: the static oracle only sees DECLARATIONS. A page that declares a face in CSS it never applies to');
  console.log('  content reads "clean" statically and FIRES on the rendered engine - the rendered read is the correct one');
  console.log('  there, and that gap is the reason this class lives on the rendered scanner rather than a source regex.');
}

// ---------------------------------------------------------------------------------------------------------
// EXIT CONTRACT - distinct code per failure class, never a silent success, never a success line unless every
// check passed. An excluded page fails the run (fail-closed): a shrinking denominator must not be able to
// print OK (Codex review P1).
//   2 = a page could not be scored (exclusion)      4 = ground-A false positive on the independent corpus
//   5 = ground-A recall/precision loss on fixtures  6 = ground-B regression on the independent corpus
// ---------------------------------------------------------------------------------------------------------
const scoredPages = devRows.length + fixRows.length;
if (excluded.length || scoredPages !== expectedPages) {
  console.error(`\nFAIL (exit 2): ${expectedPages - scoredPages} of ${expectedPages} page(s) could not be scored - the run is INCONCLUSIVE, not OK.`);
  for (const e of excluded) console.error(`  excluded: ${e}`);
  process.exit(2);
}
if (devFire.length > 0) { console.error(`\nFAIL (exit 4): ${devFire.length} ground-A false positive(s) on the independent dev corpus at the frozen threshold: ${devFire.map((r) => r.id).join(', ')}`); process.exit(4); }
if (fn > 0) { console.error(`\nFAIL (exit 5): ${fn} constructed positive(s) not detected at the frozen threshold.`); process.exit(5); }
if (fp > 0) { console.error(`\nFAIL (exit 5): ${fp} constructed negative(s) fired at the frozen threshold.`); process.exit(5); }
if (bMeasured === 0) { console.error('\nFAIL (exit 6): ground B measured ZERO pages - it was never actually exercised.'); process.exit(6); }
if (bFP > 0) { console.error(`\nFAIL (exit 6): ${bFP} ground-B false positive(s) - a landed commitment was flagged: ${bFPs.join(', ')}`); process.exit(6); }
if (bFN > 0) { console.error(`\nFAIL (exit 6): ${bFN} ground-B false negative(s) - an absent committed family was not flagged: ${bFNs.join(', ')}`); process.exit(6); }
console.log(`\ntypeface-calibrate: OK (${scoredPages}/${expectedPages} pages scored, 0 exclusions; ground A: 0 FP on ${devRows.length} real pages, ${tp}/${tp + fn} constructed positives detected; ground B: 0 FP / 0 FN on ${bMeasured} real pages).`);
