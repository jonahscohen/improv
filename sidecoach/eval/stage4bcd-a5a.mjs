#!/usr/bin/env node
/**
 * Contract-6 A5a TASTE-DETECTION head-to-head for the 13 Stage 4b/4c/4d rendered taste classes.
 * (tight-leading + blinking-cursor were PULLED from the product 2026-07-25 - unfixable in the wild; see the pull beat.)
 *
 * WHAT THIS IS (and what typography-extremes-calibrate / structural-motion-calibrate are NOT): those grade ONLY
 * our detector against DEFINITIONAL fixture labels (filename p-prefixed / n-prefixed) and never run the oracle. This IS the A5a gate:
 * it grades BOTH detectors - OURS and the studied ORACLE - against the SAME INDEPENDENT Codex present/absent labels
 * (labeledBy=codex, corpus/stage4bcd-a5a-labels.json), per the README A5a spec, class by class.
 *
 * INTEGRITY:
 *   - OURS is the SHIPPING detector: it imports the three in-page scorers + Node-side decision fns from the built
 *     dist and runs them via page.evaluate at the detector's render basis (1280x800 hermetic). No eval-side
 *     reimplementation - the union of fired rules IS the product's decision.
 *   - ORACLE is run headless through oracle-comparator.runOracle (pinned dev/eval dep). UNLIKE default-typeface
 *     (Stage 4a, where the oracle shipped no corresponding rule), the oracle DOES ship a near-name rule for every
 *     class here, so this is an ACCURACY head-to-head, not a coverage gap. Each class maps to the oracle rule(s)
 *     that target the SAME idiom; we grade the oracle two ways and print both so the mapping is explicit:
 *       GENEROUS - credit the oracle "present" if it emits ANY mapped rule (strongest-case reading).
 *       STRICT   - credit only the exact-idiom rule.
 *     The oracle's ACTUAL fired rules print per page, so any mapping mismatch is visible, never silently reconciled.
 *   - GROUND TRUTH is the Codex label, NOT the fixture filename. The filename's definitional expectation prints
 *     alongside so any Codex/definitional divergence is visible.
 *
 * HONEST STRUCTURE (lesson from 4a, applied per class): RECALL is graded on CONSTRUCTED positives (the p* fixtures
 * Codex confirmed present). For the classes that DO carry real positives in the dev corpus (Codex-present real
 * pages), a REAL-world recall is ALSO printed. For the rest, real-world recall is STRUCTURALLY UNGRADEABLE (the
 * real corpus contains ~zero instances) and that is stated, not hidden. PRECISION is graded on REAL negatives
 * (dev-corpus real pages Codex called absent), with constructed-negative (n*) precision printed too.
 *
 * EXIT CONTRACT (distinct code per failure class; never a success line unless every check passed):
 *   3 = infra (dist not built / chromium / import / bad sink)
 *   2 = INCONCLUSIVE / fail-closed: a labeled page could not be graded (html not found, our scorer returned
 *       nothing, or the oracle was unavailable). A partial head-to-head must never read OK.
 *   0 = MEASURED completely for all 13 classes. This grader MEASURES and REPORTS per-class numbers; it does NOT
 *       pass/fail a class (several of these are expected recall-weak). The LEAD makes the ship call per class.
 *
 * Build dist first (npm run build); pin the oracle: SIDECOACH_ORACLE_DETECT=<oracle detect.mjs>. Then:
 *   SIDECOACH_ORACLE_DETECT=... node eval/stage4bcd-a5a.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { runOracle } from './oracle-comparator.mjs';

const infraFail = (label) => (e) => { console.error(`\nFAIL (exit 3): ${label}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); process.exit(3); };
process.on('uncaughtException', infraFail('unexpected error'));
process.on('unhandledRejection', infraFail('unexpected rejection'));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const DIST = path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js');
if (!existsSync(DIST)) { console.error(`stage4bcd-a5a: dist not built (${DIST}). Run npm run build first.`); process.exit(3); }
const {
  inPageTypographyExtremes, typographyExtremesFindingsFromScore,
  inPageStructural, structuralFindingsFromScore,
  inPageMotionMarker, motionMarkerFindingsFromScore,
} = await import(DIST);

const SINK = process.env.SIDECOACH_A5A_SINK ? path.resolve(process.env.SIDECOACH_A5A_SINK) : path.join(ROOT, 'eval/corpus/stage4bcd-a5a-labels.json');
if (!existsSync(SINK)) { console.error(`stage4bcd-a5a: labels sink not found (${SINK}). Run the Codex labeling pass first.`); process.exit(3); }
// HTML for a labeled page id lives in one of these roots.
const SEARCH_DIRS = [
  path.join(ROOT, 'eval/fixtures/typography-extremes'),
  path.join(ROOT, 'eval/fixtures/structural-motion'),
  path.join(ROOT, 'eval/corpus/dev'),
];

// The 13 classes with their ORACLE mapping. `strict` = the exact-idiom oracle rule; `generous` = strict + plausible
// broader neighbors (strongest-case reading for the oracle). The oracle's actual fired rules print per page so any
// mapping is auditable. Verified present in the oracle vocabulary 2026-07-25.
const CLASSES = [
  { name: 'extreme-negative-tracking', strict: ['extreme-negative-tracking'], generous: ['extreme-negative-tracking'] },
  { name: 'all-caps-body', strict: ['all-caps-body'], generous: ['all-caps-body'] },
  { name: 'oversized-h1', strict: ['oversized-h1'], generous: ['oversized-h1'] },
  { name: 'sub-11px-ui', strict: ['undersized-ui-text'], generous: ['undersized-ui-text', 'tiny-text'] },
  { name: 'thin-border-wide-shadow', strict: ['gpt-thin-border-wide-shadow'], generous: ['gpt-thin-border-wide-shadow'] },
  { name: 'repeating-stripe-gradients', strict: ['repeating-stripes-gradient'], generous: ['repeating-stripes-gradient'] },
  { name: 'text-under-overlay', strict: ['text-occlusion'], generous: ['text-occlusion'] },
  { name: 'first-viewport-overflow', strict: ['first-viewport-column-overflow'], generous: ['first-viewport-column-overflow', 'clipped-overflow-container', 'body-text-viewport-edge'] },
  { name: 'decorative-dot-grid', strict: ['codex-grid-background'], generous: ['codex-grid-background'] },
  { name: 'soft-radial-glow', strict: ['radial-halo'], generous: ['radial-halo'] },
  { name: 'marquee', strict: ['marquee'], generous: ['marquee'] },
  { name: 'image-hover-transform', strict: ['image-hover-transform'], generous: ['image-hover-transform'] },
];
const CLASS_NAMES = new Set(CLASSES.map((c) => c.name));

const stripScripts = (h) => String(h).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');
const pct = (x) => x === null ? ' n/a ' : `${(x * 100).toFixed(1)}%`;
const r3 = (x) => x === null ? ' n/a ' : x.toFixed(3);

function findHtml(id) { for (const d of SEARCH_DIRS) { const p = path.join(d, `${id}.html`); if (existsSync(p)) return p; } return null; }
function sourceOf(file, id) {
  if (file.includes(`${path.sep}fixtures${path.sep}`)) return id.startsWith('p') ? 'fixture-pos' : 'fixture-neg';
  return 'real';
}

// OURS: run all three shipping scorers, union the fired rule set. Null on render failure (fail-closed upstream).
async function ourFired(browser, html) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
  try {
    await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const typo = await page.evaluate(inPageTypographyExtremes);
    const struct = await page.evaluate(inPageStructural);
    const motion = await page.evaluate(inPageMotionMarker);
    if (!typo || !struct || !motion) return null;
    return new Set([
      ...typographyExtremesFindingsFromScore(typo).map((f) => f.rule),
      ...structuralFindingsFromScore(struct).map((f) => f.rule),
      ...motionMarkerFindingsFromScore(motion).map((f) => f.rule),
    ]);
  } catch { return null; } finally { await ctx.close(); }
}

// ---- load Codex labels -----------------------------------------------------------------------------------
let sink;
try { sink = JSON.parse(readFileSync(SINK, 'utf8')); } catch (e) { console.error(`stage4bcd-a5a: bad sink JSON: ${e.message}`); process.exit(3); }
const excluded = [];
const pages = [];
for (const [id, rec] of Object.entries(sink.labels || {})) {
  if (!rec || rec.status !== 'labeled-codex' || !Array.isArray(rec.labels)) { excluded.push(`${id}: not labeled-codex`); continue; }
  const codex = {}; // class -> present (only for our 13)
  let missing = 0;
  for (const cls of CLASSES) {
    const lab = rec.labels.find((l) => l.class === cls.name);
    if (!lab) { missing++; continue; }
    if (lab.labeledBy !== 'codex') { excluded.push(`${id}/${cls.name}: labeledBy=${lab.labeledBy} (must be codex)`); }
    codex[cls.name] = !!lab.present;
  }
  if (missing === CLASSES.length) { excluded.push(`${id}: none of the 13 classes labeled`); continue; }
  const file = findHtml(id);
  if (!file) { excluded.push(`${id}: html not found under ${SEARCH_DIRS.join(' | ')}`); continue; }
  pages.push({ id, file, source: sourceOf(file, id), codex });
}
if (pages.length === 0) { console.error('stage4bcd-a5a: no gradeable Codex-labeled pages found.'); process.exit(2); }

// ---- run OURS + ORACLE per page --------------------------------------------------------------------------
const browser = await chromium.launch({ headless: true });
for (const pg of pages) {
  const html = readFileSync(pg.file, 'utf8');
  const fired = await ourFired(browser, html);
  if (!fired) { excluded.push(`${pg.id}: our scorer returned nothing (render fail)`); pg.skip = true; continue; }
  pg.ours = fired;
  const orc = await runOracle(pg.file);
  if (!orc.available) { excluded.push(`${pg.id}: oracle unavailable: ${orc.reason}`); pg.skip = true; continue; }
  pg.oracle = new Set(orc.findings.map((f) => f.rule).filter(Boolean));
}
await browser.close();
const graded = pages.filter((p) => !p.skip);

// ---- report ----------------------------------------------------------------------------------------------
console.log('Stage 4b/4c/4d  A5a TASTE-DETECTION head-to-head   (ground truth: independent Codex labels)');
console.log(`sink: ${path.relative(ROOT, SINK)}   graded ${graded.length} Codex-labeled page(s)`);
const nReal = graded.filter((p) => p.source === 'real').length;
const nFixPos = graded.filter((p) => p.source === 'fixture-pos').length;
const nFixNeg = graded.filter((p) => p.source === 'fixture-neg').length;
console.log(`  ${nReal} real dev pages + ${nFixPos} constructed-positive fixtures + ${nFixNeg} constructed-negative fixtures`);
console.log('  RECALL grades on constructed positives (Codex-confirmed present fixtures); PRECISION on real negatives.\n');

const summary = [];
for (const cls of CLASSES) {
  const rows = graded.filter((r) => r.codex[cls.name] !== undefined);
  const oursF = (r) => r.ours.has(cls.name);
  const genF = (r) => cls.generous.some((x) => r.oracle.has(x));
  const strF = (r) => cls.strict.some((x) => r.oracle.has(x));

  // GROUND TRUTH IS THE CODEX LABEL, NOT THE FILENAME (the 4a discipline). A fixture the author built as a
  // near-miss negative (n01-*-tasteful) that Codex independently reads as PRESENT is a real constructed positive,
  // and OURS missing it is a genuine recall gap (usually a too-strict threshold) - it must not vanish from the
  // grade because of its filename.
  const fixtures = rows.filter((r) => r.source.startsWith('fixture'));
  const cPos = fixtures.filter((r) => r.codex[cls.name]);                    // constructed positives = ANY fixture Codex-present
  const cNeg = fixtures.filter((r) => !r.codex[cls.name]);                   // constructed negatives = ANY fixture Codex-absent
  const rPos = rows.filter((r) => r.source === 'real' && r.codex[cls.name]);  // real positives (Codex present) -> real-world recall
  const rNeg = rows.filter((r) => r.source === 'real' && !r.codex[cls.name]); // real negatives (Codex absent) -> precision
  // definitional divergences (filename INTENT vs independent Codex label) - reported, never hidden. Only a fixture
  // built FOR this class (its id names the class) carries a p/n intent about it; another class's fixture is just a
  // page here, so it is not a "flipped" divergence.
  const forThis = (r) => r.id.includes(cls.name);
  const defPFlip = rows.filter((r) => r.source === 'fixture-pos' && forThis(r) && !r.codex[cls.name]); // built positive, Codex ABSENT
  const defNFlip = rows.filter((r) => r.source === 'fixture-neg' && forThis(r) && r.codex[cls.name]);  // built negative, Codex PRESENT

  // recall on constructed positives
  const recC = cPos.length ? { ours: cPos.filter(oursF).length / cPos.length, gen: cPos.filter(genF).length / cPos.length, str: cPos.filter(strF).length / cPos.length } : null;
  // real-world recall (only where real positives exist)
  const recR = rPos.length ? { ours: rPos.filter(oursF).length / rPos.length, gen: rPos.filter(genF).length / rPos.length, str: rPos.filter(strF).length / rPos.length } : null;
  // precision on real negatives (FP rate)
  const oursRNegFP = rNeg.filter(oursF), genRNegFP = rNeg.filter(genF), strRNegFP = rNeg.filter(strF);
  // constructed-negative precision
  const oursCNegFP = cNeg.filter(oursF), genCNegFP = cNeg.filter(genF);

  const divergNote = [
    defPFlip.length ? `${defPFlip.length} built-POSITIVE Codex called ABSENT: ${defPFlip.map((r) => r.id).join(', ')}` : '',
    defNFlip.length ? `${defNFlip.length} built-NEGATIVE Codex called PRESENT: ${defNFlip.map((r) => r.id).join(', ')}` : '',
  ].filter(Boolean).join('; ');
  console.log(`==== ${cls.name}   (oracle strict:{${cls.strict.join(',')}}  generous:{${cls.generous.join(',')}}) ====`);
  if (divergNote) console.log(`  filename-vs-Codex divergences: ${divergNote}`);
  console.log(`  constructed positives (n=${cPos.length}, Codex-present fixtures regardless of p/n filename):`);
  if (recC) console.log(`     recall  OURS=${r3(recC.ours)}  ORACLE-gen=${r3(recC.gen)}  ORACLE-strict=${r3(recC.str)}`);
  else console.log('     recall  UNGRADEABLE (no Codex-confirmed constructed positive)');
  for (const r of cPos) console.log(`       ${r.id.padEnd(44)} OURS=${oursF(r) ? 'FIRES' : 'clean'}  ORACLE=${[...r.oracle].filter((x) => cls.generous.includes(x)).join(',') || 'clean'}${r.oracle.size ? ` (all:${[...r.oracle].join(',')})` : ''}`);
  if (rPos.length) {
    console.log(`  REAL positives (n=${rPos.length}, Codex-present real pages -> real-world recall):`);
    console.log(`     recall  OURS=${r3(recR.ours)}  ORACLE-gen=${r3(recR.gen)}  ORACLE-strict=${r3(recR.str)}`);
    for (const r of rPos) console.log(`       ${r.id.padEnd(44)} OURS=${oursF(r) ? 'FIRES' : 'MISS '}  ORACLE-gen=${genF(r) ? 'FIRES' : 'MISS'}`);
  } else {
    console.log('  REAL positives: none (real-world recall STRUCTURALLY UNGRADEABLE - real pages ~never exhibit this).');
  }
  console.log(`  precision on REAL negatives (n=${rNeg.length}): OURS FP=${oursRNegFP.length}/${rNeg.length} (${pct(rNeg.length ? oursRNegFP.length / rNeg.length : null)})  ORACLE-gen FP=${genRNegFP.length}/${rNeg.length} (${pct(rNeg.length ? genRNegFP.length / rNeg.length : null)})  ORACLE-strict FP=${strRNegFP.length}/${rNeg.length}`);
  if (oursRNegFP.length) console.log(`     OURS false-fires on real: ${oursRNegFP.map((r) => r.id).join(', ')}`);
  if (genRNegFP.length) console.log(`     ORACLE-gen false-fires on real: ${genRNegFP.slice(0, 12).map((r) => r.id).join(', ')}${genRNegFP.length > 12 ? ' ...' : ''}`);
  console.log(`  precision on CONSTRUCTED negatives (n=${cNeg.length}): OURS FP=${oursCNegFP.length}/${cNeg.length}  ORACLE-gen FP=${genCNegFP.length}/${cNeg.length}`);
  if (oursCNegFP.length) console.log(`     OURS false-fires on near-miss fixtures: ${oursCNegFP.map((r) => r.id).join(', ')}`);
  console.log('');

  summary.push({
    name: cls.name,
    rcOurs: recC ? recC.ours : null, rcGen: recC ? recC.gen : null,
    rrOurs: recR ? recR.ours : null, rrGen: recR ? recR.gen : null, rrN: rPos.length,
    pOursReal: rNeg.length ? 1 - oursRNegFP.length / rNeg.length : null, pGenReal: rNeg.length ? 1 - genRNegFP.length / rNeg.length : null,
    oursRealFP: oursRNegFP.length, genRealFP: genRNegFP.length, realN: rNeg.length,
    cPosN: cPos.length, cNegN: cNeg.length, oursCNegFP: oursCNegFP.length,
  });
}

// ---- cross-class summary table ---------------------------------------------------------------------------
console.log('CROSS-CLASS SUMMARY (Rc=recall on constructed positives; Preal=precision on real negatives; Rreal=real-world recall where gradeable):');
console.log('  class                          Rc-OURS Rc-ORC | Preal-OURS(FP)  Preal-ORC(FP) | Rreal-OURS  (n)');
for (const s of summary) {
  const rr = s.rrN ? `${r3(s.rrOurs)}/${r3(s.rrGen)}` : '  ungrade ';
  console.log(`  ${s.name.padEnd(30)} ${r3(s.rcOurs)}  ${r3(s.rcGen)} | ${r3(s.pOursReal)}(${s.oursRealFP}/${s.realN})   ${r3(s.pGenReal)}(${s.genRealFP}/${s.realN}) | ${rr}  (${s.rrN})`);
}

// ---- exit contract ---------------------------------------------------------------------------------------
if (excluded.length) {
  console.error(`\nFAIL (exit 2): ${excluded.length} grading exclusion(s) - the head-to-head is INCONCLUSIVE, not OK.`);
  for (const e of excluded.slice(0, 40)) console.error(`  excluded: ${e}`);
  process.exit(2);
}
console.log(`\nstage4bcd-a5a: MEASURED completely for ${CLASSES.length} classes on ${graded.length} pages (not a pass/fail verdict - the lead makes the ship call per class).`);
