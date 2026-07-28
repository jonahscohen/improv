#!/usr/bin/env node
/**
 * Contract-6 A5a TASTE-DETECTION head-to-head for the `default-typeface` class.
 *
 * WHAT THIS IS (and what typeface-calibrate.mjs is NOT): typeface-calibrate grades ONLY our detector against
 * DEFINITIONAL fixture labels (filename p-prefixed vs n-prefixed) and never runs the oracle. This IS the A5a gate: it grades BOTH
 * detectors - OURS and the studied ORACLE - against the SAME INDEPENDENT Codex present/absent labels
 * (labeledBy=codex, corpus/typeface-a5a-labels.json), per the README A5a spec.
 *
 * INTEGRITY:
 *   - OURS is the SHIPPING detector: it imports inPageTypeface + typefaceFindingFromScore from the built dist
 *     and runs them via page.evaluate at the detector's render basis (1280x800 hermetic) - the identical decision
 *     the product makes. No eval-side reimplementation.
 *   - ORACLE is run headless through oracle-comparator.runOracle (pinned dev/eval dep). The oracle ships NO
 *     default-typeface rule; its nearest font-family antipatterns (single-font = one-family monotony,
 *     overused-font = an over-exposed font NAME) are a DIFFERENT concept. We grade the oracle two ways and print
 *     both, so the mapping is explicit rather than hidden:
 *       GENEROUS  - credit the oracle a default-typeface "present" prediction whenever it emits EITHER font-family
 *                   antipattern (its closest coverage). This is the fair, strongest-case reading of the oracle.
 *       STRICT    - no oracle rule means "default/system stack", so the oracle predicts absent everywhere (0 coverage).
 *   - GROUND TRUTH is the Codex label, NOT the fixture filename. The filename's definitional expectation is printed
 *     alongside so any Codex/definitional divergence is visible, never silently reconciled.
 *
 * HONEST STRUCTURE (README A5a for this class): RECALL is gradeable only on CONSTRUCTED positives (real shipped
 * designs choose fonts -> the heldout corpus has ~zero positives, so heldout-recall is STRUCTURALLY UNGRADEABLE).
 * PRECISION is graded on REAL negatives (dev-corpus real pages) + the branded fixtures. Both facts are printed.
 *
 * EXIT CONTRACT (distinct code per failure class; never a success line unless every check passed):
 *   3 = infra (dist not built / chromium / import / bad sink)
 *   2 = INCONCLUSIVE / fail-closed: a labeled page could not be graded (no default-typeface label, html not found,
 *       our scorer returned nothing, or the oracle was unavailable). A partial head-to-head must never read OK.
 *   4 = OURS REGRESSION vs the independent Codex ground truth: a miss on a Codex-positive or a fire on a Codex-negative.
 *       (The ORACLE performing worse is the EXPECTED differentiator result and is only reported, never failed on.)
 *   0 = measured completely AND ours matched Codex ground truth (recall 1.0 on positives, 0 FP on negatives).
 *
 * Build dist first (npm run build); pin the oracle: SIDECOACH_ORACLE_DETECT=<oracle detect.mjs>. Then:
 *   SIDECOACH_ORACLE_DETECT=... node eval/typeface-a5a.mjs
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
if (!existsSync(DIST)) { console.error(`typeface-a5a: dist not built (${DIST}). Run npm run build first.`); process.exit(3); }
const { inPageTypeface, typefaceFindingFromScore, DEFAULT_STACK_SHARE, TYPEFACE_MIN_CONTENT_CHARS } = await import(DIST);

const SINK = path.join(ROOT, 'eval/corpus/typeface-a5a-labels.json');
if (!existsSync(SINK)) { console.error(`typeface-a5a: labels sink not found (${SINK}). Run the Codex labeling pass first.`); process.exit(3); }
// HTML for a labeled page id lives in one of these roots.
const SEARCH_DIRS = [path.join(ROOT, 'eval/fixtures/default-typeface'), path.join(ROOT, 'eval/corpus/dev')];
// The oracle's NEAREST font-family antipatterns = its best-effort coverage of "font problems" (generous mapping).
const ORACLE_FONT_RULES = new Set(['single-font', 'overused-font']);

const stripScripts = (h) => String(h).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');
const pct = (x) => x === null ? '  n/a' : `${(x * 100).toFixed(1)}%`;

function findHtml(id) { for (const d of SEARCH_DIRS) { const p = path.join(d, `${id}.html`); if (existsSync(p)) return p; } return null; }
// Source bucket for honest reporting: constructed positive (fixture p*), branded negative (fixture n*), real page.
function sourceOf(file, id) {
  if (file.includes(`${path.sep}fixtures${path.sep}`)) return id.startsWith('p') ? 'fixture-pos' : 'fixture-neg';
  return 'real';
}

async function ourScore(browser, html) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
  try {
    await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const s = await page.evaluate(inPageTypeface);
    if (!s || typeof s.defaultStackShare !== 'number' || Number.isNaN(s.defaultStackShare)) return null;
    return s;
  } catch { return null; } finally { await ctx.close(); }
}

// ---- load Codex labels -----------------------------------------------------------------------------------
let sink;
try { sink = JSON.parse(readFileSync(SINK, 'utf8')); } catch (e) { console.error(`typeface-a5a: bad sink JSON: ${e.message}`); process.exit(3); }
const excluded = [];
const pages = [];
for (const [id, rec] of Object.entries(sink.labels || {})) {
  if (!rec || rec.status !== 'labeled-codex' || !Array.isArray(rec.labels)) { excluded.push(`${id}: not labeled-codex`); continue; }
  const dt = rec.labels.find((l) => l.class === 'default-typeface');
  if (!dt) { excluded.push(`${id}: no default-typeface label`); continue; }
  if (dt.labeledBy !== 'codex') { excluded.push(`${id}: default-typeface labeledBy=${dt.labeledBy} (must be codex)`); continue; }
  const file = findHtml(id);
  if (!file) { excluded.push(`${id}: html not found under ${SEARCH_DIRS.join(' | ')}`); continue; }
  pages.push({ id, present: !!dt.present, conf: dt.confidence, note: dt.note, file, source: sourceOf(file, id) });
}
if (pages.length === 0) { console.error('typeface-a5a: no gradeable Codex-labeled pages found.'); process.exit(2); }

// ---- run OURS + ORACLE per page --------------------------------------------------------------------------
const browser = await chromium.launch({ headless: true });
for (const pg of pages) {
  const html = readFileSync(pg.file, 'utf8');
  const s = await ourScore(browser, html);
  if (!s) { excluded.push(`${pg.id}: our scorer returned nothing (render fail)`); pg.skip = true; continue; }
  pg.score = s;
  // Ground A is GATED OFF in product as of 2026-07-28 (its real-page precision is undefined). This harness
  // MEASURES ground A, so it opts in explicitly - otherwise it would report every ground-A positive as silent
  // and look like a detector regression rather than a product gate.
  pg.ours = typefaceFindingFromScore(s, { enableDefaultStackGround: true }) !== null; // no brand context
  const orc = await runOracle(pg.file);
  if (!orc.available) { excluded.push(`${pg.id}: oracle unavailable: ${orc.reason}`); pg.skip = true; continue; }
  pg.oracleRules = [...new Set(orc.findings.map((f) => f.rule).filter(Boolean))];
  pg.oracleGenerous = pg.oracleRules.some((r) => ORACLE_FONT_RULES.has(r));
  pg.oracleStrict = false; // no oracle rule denotes default/system stack
}
await browser.close();

const graded = pages.filter((p) => !p.skip);

// ---- grading ---------------------------------------------------------------------------------------------
function grade(rows, predKey) {
  const pos = rows.filter((r) => r.present), neg = rows.filter((r) => !r.present);
  let tp = 0, fn = 0, fp = 0, tn = 0;
  for (const r of pos) r[predKey] ? tp++ : fn++;
  for (const r of neg) r[predKey] ? fp++ : tn++;
  return { posN: pos.length, negN: neg.length, tp, fn, fp, tn,
    recall: pos.length ? tp / pos.length : null,
    precision: (tp + fp) ? tp / (tp + fp) : null,
    fpRate: neg.length ? fp / neg.length : null };
}
const ours = grade(graded, 'ours');
const orcG = grade(graded, 'oracleGenerous');
const orcS = grade(graded, 'oracleStrict');

const constructedPos = graded.filter((r) => r.present); // Codex-positive = the recall population
const realNeg = graded.filter((r) => !r.present && r.source === 'real');
const brandedNeg = graded.filter((r) => !r.present && r.source === 'fixture-neg');

// ---- report ----------------------------------------------------------------------------------------------
console.log('default-typeface  A5a TASTE-DETECTION head-to-head   (ground truth: independent Codex labels)');
console.log(`frozen operating point: DEFAULT_STACK_SHARE=${DEFAULT_STACK_SHARE}  min-content-chars=${TYPEFACE_MIN_CONTENT_CHARS}`);
console.log(`graded ${graded.length} Codex-labeled page(s): ${constructedPos.length} positive / ${graded.length - constructedPos.length} negative`);
console.log(`  positives are CONSTRUCTED (fixtures); heldout-recall is STRUCTURALLY UNGRADEABLE (real shipped designs choose fonts -> ~zero positives).`);
console.log(`  negatives: ${realNeg.length} REAL shipped pages + ${brandedNeg.length} branded fixtures. Precision rides here.\n`);

console.log('PER-PAGE (codex = ground truth; def = filename expectation; * = ours disagrees with codex):');
console.log('  page                                    src         codex  def   ours   oracle[rules]');
for (const r of graded.sort((a, b) => a.source.localeCompare(b.source) || a.id.localeCompare(b.id))) {
  const def = r.source === 'fixture-pos' ? 'P' : r.source === 'fixture-neg' ? 'N' : '-';
  const codex = r.present ? 'P' : 'N';
  const disagree = (r.present && !r.ours) || (!r.present && r.ours) ? '*' : ' ';
  const orcMark = r.oracleGenerous ? `FIRES[${r.oracleRules.filter((x) => ORACLE_FONT_RULES.has(x)).join(',')}]` : (r.oracleRules.length ? `clean(${r.oracleRules.join(',')})` : 'clean');
  console.log(`  ${disagree}${r.id.padEnd(38)} ${r.source.padEnd(11)} ${codex.padStart(3)}  ${def.padStart(3)}  ${(r.ours ? 'FIRES' : 'clean').padEnd(6)} ${orcMark}   share=${pct(r.score.defaultStackShare)}`);
}

const line = (name, g) => console.log(`  ${name.padEnd(22)} R=${g.recall === null ? ' n/a ' : g.recall.toFixed(3)} (${g.tp}/${g.posN})   P=${g.precision === null ? ' n/a ' : g.precision.toFixed(3)}   FP=${g.fp}/${g.negN} (${pct(g.fpRate)})   [TP${g.tp} FP${g.fp} FN${g.fn} TN${g.tn}]`);
console.log('\nHEAD-TO-HEAD (graded vs the SAME Codex labels):');
line('OURS (shipping)', ours);
line('ORACLE generous-map', orcG);
line('ORACLE strict-map', orcS);
console.log(`\n  recall population  = ${constructedPos.length} constructed positive(s)`);
console.log(`  precision population = ${ours.negN} negative(s) (${realNeg.length} real + ${brandedNeg.length} branded)`);
console.log(`  oracle generous-map credits its font-family antipatterns {${[...ORACLE_FONT_RULES].join(', ')}} as default-typeface predictions.`);

// ---- exit contract ---------------------------------------------------------------------------------------
if (excluded.length) {
  console.error(`\nFAIL (exit 2): ${excluded.length} page(s) could not be graded - the head-to-head is INCONCLUSIVE, not OK.`);
  for (const e of excluded) console.error(`  excluded: ${e}`);
  process.exit(2);
}
const oursMisses = constructedPos.filter((r) => !r.ours).map((r) => r.id);
const oursFPs = graded.filter((r) => !r.present && r.ours).map((r) => r.id);
if (oursMisses.length) { console.error(`\nFAIL (exit 4): OURS missed ${oursMisses.length} Codex-positive(s): ${oursMisses.join(', ')}`); process.exit(4); }
if (oursFPs.length) { console.error(`\nFAIL (exit 4): OURS fired on ${oursFPs.length} Codex-negative(s) (false positive vs independent ground truth): ${oursFPs.join(', ')}`); process.exit(4); }
console.log(`\ntypeface-a5a: MEASURED (not a pass/fail verdict - the lead makes the ship call). OURS recall ${ours.recall.toFixed(3)} on ${ours.posN} positives, 0 FP on ${ours.negN} negatives; ORACLE generous-map recall ${orcG.recall.toFixed(3)}, ${orcG.fp} FP; ORACLE strict-map recall ${orcS.recall.toFixed(3)}, ${orcS.fp} FP.`);
