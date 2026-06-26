#!/usr/bin/env node
/**
 * Contract-6 BASELINE SCORECARD - step 3: COMPUTE THE METRICS (A1-A4 + A5a + timing + unavailable).
 *
 * Inputs (all frozen / lead-approved):
 *   corpus/candidates.json          - ground truth per page (objective referee labels + Codex subjective labels)
 *   .scorecard-cache/<id>.json      - each tool's findings + availability + per-tool wall-time (clean re-collect)
 *   corpus/scorecard-mapping.json   - the lead-APPROVED effectiveMapping (exact + Codex semantic), rule -> class
 *
 * GROUND TRUTH per page = full-page present classes: objectiveLabels[].class (rendered referee) UNION
 * subjectiveLabels[present==true].class (Codex). Both detectors scan the full HTML, so full-page GT is the
 * apples-to-apples comparison.
 *
 * FAIRNESS of the confusion counting (symmetric for both tools):
 *  - RECALL denominator = every page where the class is PRESENT, regardless of availability. A page where the
 *    tool is UNAVAILABLE (e.g. Sidecoach ReDoS timeout) contributes 0 detections => those present classes are
 *    FALSE NEGATIVES. A crash that misses real defects fairly counts against recall (it is not excused).
 *  - PRECISION denominator = the tool's class-detections (only possible on available pages). Unavailable pages
 *    add no detections, so a crash does not artificially inflate or deflate precision.
 *  - Only findings whose rule is in effectiveMapping count toward class TP/FP. UNMAPPED findings (e.g.
 *    Sidecoach's hex-in-interactive-state volume) have no GT class to score against; they are reported
 *    separately as raw volume / unmapped share (the precision-noise context), NOT silently as TP.
 *
 * Unavailable counts + per-tool wall-time are reported as first-class deficits (not folded into the rates).
 * Paired bootstrap 95% CIs on the headline head-to-head differences (same resampled page multiset both tools).
 *
 * Computes metrics only; writes corpus/scorecard.json + prints a readable summary. No labeling, no Codex.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, isCompleteRecord } from './scorecard-shared.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const CACHE = path.join(HERE, '.scorecard-cache');
const OUT = path.join(CORPUS, 'scorecard.json');
const TOOLS = ['sidecoach', 'oracle'];

const allCandidates = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
// CONTAMINATED EXCLUSION (lead ruling 2026-06-24): pages developed-against (peeked) leave the held-out bar -
// including them would be training-on-test. Read the separate post-freeze annotation (frozen corpus untouched).
const CONTAM = existsSync(path.join(CORPUS, 'contaminated.json'))
  ? Object.keys(JSON.parse(readFileSync(path.join(CORPUS, 'contaminated.json'), 'utf8')).contaminated || {}) : [];
const contamSet = new Set(CONTAM);
const candidates = allCandidates.filter((c) => !contamSet.has(c.id));
const mapping = JSON.parse(readFileSync(path.join(CORPUS, 'scorecard-mapping.json'), 'utf8'));
if (!mapping.effectiveMapping) { console.error('FATAL: scorecard-mapping.json has no effectiveMapping (run scorecard-mapping.mjs after the semantic pass).'); process.exit(1); }

const OBJECTIVE = mapping.groundTruthClasses.objective;
const SUBJECTIVE = mapping.groundTruthClasses.subjective;
const OBJ = new Set(OBJECTIVE);
const SUBJ = new Set(SUBJECTIVE);
// Subjective (taste) classes produced by the RENDERED subprocess (computed-style detectors), not the static
// scanners - so they gate on objectiveAvailable (rendered availability), not overall. Grows as ST1 lands each
// rendered taste detector.
// DEFERRED (2026-06-24): tiny-text stays wired but is PROVISIONAL, not frozen/final. Its SMALL_PX=13 operating
// point is a KNOWN-BROKEN point (the tiny-text labels span 13-18px and do not track font-size - verified), so its
// ~3/21 number must NOT be banked as Sidecoach's tiny-text capability. Pending: re-label tighter rubric vs
// accept-low-recall (lead may loop Jonah). Do not report tiny-text as a result until that is resolved.
// Stage 5a: marketing-buzzword joins the rendered subprocess (subjective-rendered-scanner), so it gates on
// objectiveAvailable like its tiny-text/nested-cards siblings (NOT overall available - a subjective static hang
// must not drop a render that succeeded). The rule->class mapping is identity (exact-name), so no mapping edit.
const RENDERED_SUBJECTIVE = new Set(['tiny-text', 'nested-cards', 'marketing-buzzword']);
const CONTRAST = new Set(['low-contrast', 'gray-on-color']);

// rule -> class per tool, from the lead-approved effective mapping (exact + semantic merged).
const ruleToClass = {};
for (const tool of TOOLS) {
  ruleToClass[tool] = {};
  for (const e of [...mapping.effectiveMapping[tool].exact, ...mapping.effectiveMapping[tool].semantic]) ruleToClass[tool][e.rule] = e.class;
}

// Build per-page records: ground truth + per-tool detected classes + availability + raw/unmapped volume + ms.
const pages = [];
const liveVocab = { sidecoach: new Set(), oracle: new Set() };
for (const c of candidates) {
  const cacheFile = path.join(CACHE, `${c.id}.json`);
  if (!existsSync(cacheFile)) { console.error(`FATAL: missing cache for ${c.id} - run scorecard-collect.mjs`); process.exit(1); }
  const rec = JSON.parse(readFileSync(cacheFile, 'utf8'));
  // Codex score-review #1: validate with the SAME completeness/hash invariant collect + mapping use, so a
  // stale same-id cache (old schema or different page content) can't silently change findings/timings/avail.
  if (!isCompleteRecord(rec, sha256(readFileSync(path.join(CORPUS, c.file))))) { console.error(`FATAL: stale/incomplete cache record for ${c.id} - re-run scorecard-collect.mjs --force`); process.exit(1); }
  const gtObj = new Set((c.objectiveLabels || []).map((o) => o.class));
  const gtSubj = new Set((c.subjectiveLabels || []).filter((s) => s.present).map((s) => s.class));
  const gtPresent = new Set([...gtObj, ...gtSubj]);
  const tool = {};
  for (const t of TOOLS) {
    const findings = rec[t] || [];
    const detected = new Set();
    let unmapped = 0;
    for (const f of findings) { liveVocab[t].add(f.rule); const cls = ruleToClass[t][f.rule]; if (cls) detected.add(cls); else unmapped++; }
    tool[t] = {
      available: rec[`${t}Available`] === true,
      // v3 decouple: OBJECTIVE-class availability is tracked separately so a subjective ReDoS hang can't drop a
      // real objective detection. Falls back to overall `available` for tools without the per-source field
      // (oracle, or pre-v3 records).
      objectiveAvailable: typeof rec[`${t}ObjectiveAvailable`] === 'boolean' ? rec[`${t}ObjectiveAvailable`] : rec[`${t}Available`] === true,
      detected,
      rawFindings: findings.length,
      unmappedFindings: unmapped,
      ms: typeof rec[`${t}Ms`] === 'number' ? rec[`${t}Ms`] : null,
      reason: rec[`${t}Reason`] || null,
    };
  }
  pages.push({ id: c.id, register: c.register, bucket: c.bucket, gtObj, gtSubj, gtPresent, contrastIndeterminate: !!c.contrastIndeterminate, tool });
}

// Codex score-review #2: prove the effectiveMapping was built from THIS cache's vocabulary. If a tool emits a
// rule absent from the mapping (e.g. a noisy rule added after mapping ran), it would be silently treated as
// 'unmapped' and excluded from class FP/precision - which could FLATTER that tool. Assert exact vocab match.
for (const t of TOOLS) {
  const live = [...liveVocab[t]].sort();
  const mapVocab = new Set(mapping[t].vocab || []);
  // Every rule emitted on the scored pages MUST be in the mapping (else a noisy post-mapping rule would be
  // silently dropped from class FP/precision - Codex score-review #2). Subset (not exact) because the mapping
  // vocab is built over the full corpus while scoring excludes contaminated pages - the mapping may legitimately
  // carry a rule that only appeared on an excluded page; that direction is fine, the unmapped-live direction is not.
  const liveOnly = live.filter((r) => !mapVocab.has(r));
  if (liveOnly.length) {
    console.error(`FATAL: ${t} emits rule(s) not in the mapping: [${liveOnly.join(', ')}] - re-run scorecard-mapping.mjs (+ semantic pass).`);
    process.exit(1);
  }
}

// Confusion for ONE class on ONE tool over a given page subset. TP = present & available & detected;
// FN = present & !(available & detected); FP = available & detected & !present.
function confusion(pageSet, tool, cls) {
  let tp = 0, fn = 0, fp = 0, present = 0, detected = 0;
  for (const p of pageSet) {
    const isPresent = p.gtPresent.has(cls);
    // v3 decouple: gate RENDERED classes (objective WCAG classes AND rendered-subjective taste classes like
    // tiny-text, both produced by the rendered subprocess) on objectiveAvailable (immune to a subjective ReDoS
    // hang); STATIC subjective classes stay on overall `available` (a subjective timeout = a real deficit).
    const avail = (OBJ.has(cls) || RENDERED_SUBJECTIVE.has(cls)) ? p.tool[tool].objectiveAvailable : p.tool[tool].available;
    const isDet = avail && p.tool[tool].detected.has(cls);
    if (isPresent) { present++; if (isDet) tp++; else fn++; }
    if (isDet) { detected++; if (!isPresent) fp++; }
  }
  return { tp, fn, fp, present, detected };
}

// v3 decouple (Codex review Medium): a Sidecoach page "produced a scan" if EITHER family ran - so a page whose
// subjective family timed out but whose objective scan succeeded still contributes its (objective) findings to
// the secondary loads (A2 raw/known-good denominator, A4 flags-something, finding volume), instead of being
// dropped as wholly unavailable. For oracle, objectiveAvailable falls back to available -> unchanged.
const produced = (p, t) => p.tool[t].available || p.tool[t].objectiveAvailable;

// Micro recall/precision over a set of classes (sum TP / sum present ; sum TP / sum detected).
function micro(pageSet, tool, classes) {
  let tp = 0, present = 0, detected = 0;
  for (const cls of classes) { const c = confusion(pageSet, tool, cls); tp += c.tp; present += c.present; detected += c.detected; }
  return { tp, present, detected, recall: present ? tp / present : null, precision: detected ? tp / detected : null };
}

const REGISTERS = [...new Set(pages.map((p) => p.register))].sort();

// Per-class table (both tools) over the whole corpus - objective then subjective.
const perClass = {};
for (const cls of [...OBJECTIVE, ...SUBJECTIVE]) {
  perClass[cls] = { kind: OBJ.has(cls) ? 'objective' : 'subjective' };
  for (const t of TOOLS) {
    const c = confusion(pages, t, cls);
    perClass[cls][t] = { ...c, recall: c.present ? +(c.tp / c.present).toFixed(3) : null, precision: c.detected ? +(c.tp / c.detected).toFixed(3) : null };
  }
}

const summary = (pageSet) => {
  const s = {};
  for (const t of TOOLS) {
    s[t] = {
      objective: micro(pageSet, t, OBJECTIVE),
      subjective: micro(pageSet, t, SUBJECTIVE),
      overall: micro(pageSet, t, [...OBJECTIVE, ...SUBJECTIVE]),
      contrast: micro(pageSet, t, [...CONTRAST]),
    };
  }
  return s;
};

const overall = summary(pages);
const perRegister = {};
for (const r of REGISTERS) perRegister[r] = summary(pages.filter((p) => p.register === r));

// OBJECTIVE PARITY vs oracle BROWSER mode (lead ruling 2026-06-24): the static-oracle objective number
// (0.064) is apples-to-oranges (static vs our rendered) and FAVORS us; the honest comparison is sidecoach-
// rendered vs oracle's BROWSER engine. Read oracle's browser objective from the ceiling cache, score
// BOTH under the same construction (skipped-heading + contrast-FAMILY[low-contrast OR gray-on-color] + broken-
// image[oracle=static, since its browser engine emits none]) on the same un-peeked pages. Report PARITY, not "beats".
const CEIL = path.join(HERE, '.ceiling-cache');
let objectiveParity = { note: 'ceiling cache not found - run scorecard-browser-ceiling.mjs' };
if (existsSync(CEIL)) {
  const famDet = (set) => set.has('low-contrast') || set.has('gray-on-color');
  let scH = 0, imH = 0, Hp = 0, scCF = 0, imCF = 0, CFp = 0, scBI = 0, imBI = 0, BIp = 0;
  for (const p of pages) {
    const ref = p.gtPresent;
    const scDet = p.tool.sidecoach.objectiveAvailable ? p.tool.sidecoach.detected : new Set(); // v3: objective parity uses objective availability
    const cf = path.join(CEIL, `${p.id}.json`);
    const ce = existsSync(cf) ? JSON.parse(readFileSync(cf, 'utf8')) : { available: false, objectiveDetected: [] };
    const ceDet = new Set(ce.available ? ce.objectiveDetected : []);
    const imStaticBI = (() => { const rec = JSON.parse(readFileSync(path.join(CACHE, `${p.id}.json`), 'utf8')); return (rec.oracle || []).some((f) => f.rule === 'broken-image'); })();
    if (ref.has('skipped-heading')) { Hp++; if (scDet.has('skipped-heading')) scH++; if (ceDet.has('skipped-heading')) imH++; }
    if (ref.has('low-contrast') || ref.has('gray-on-color')) { CFp++; if (famDet(scDet)) scCF++; if (famDet(ceDet)) imCF++; }
    if (ref.has('broken-image')) { BIp++; if (scDet.has('broken-image')) scBI++; if (imStaticBI) imBI++; }
  }
  const P = Hp + CFp + BIp;
  objectiveParity = {
    note: 'apples-to-apples: sidecoach-rendered vs oracle-BROWSER (ceiling); construction = skipped-heading + contrast-family + broken-image(oracle=static). PARITY framing, not beats.',
    construction: { skippedHeading: { present: Hp, sidecoach: scH, oracleBrowser: imH }, contrastFamily: { present: CFp, sidecoach: scCF, oracleBrowser: imCF }, brokenImage: { present: BIp, sidecoach: scBI, oracleStatic: imBI } },
    sidecoach: P ? +((scH + scCF + scBI) / P).toFixed(3) : null,
    oracleBrowser: P ? +((imH + imCF + imBI) / P).toFixed(3) : null,
    present: P,
  };
}

// A2: false-positive load on KNOWN-GOOD pages (clean bucket) - class-detections where the class is absent.
const knownGood = pages.filter((p) => p.bucket === 'known-good');
// Codex score-review #3: detections only occur on AVAILABLE pages, so the FP / raw / unmapped loads below are
// over AVAILABLE known-good pages; unavailable known-good pages are reported separately (they contribute no
// detections, but they ARE penalized as FN in recall). Labeled available-only so the denominator is explicit.
const a2 = { note: 'class false positives + raw/unmapped finding load on known-good (clean) pages, over AVAILABLE known-good pages (detections require availability). unavailableKnownGoodPages contribute no detections but are penalized as FN in recall and counted in unavailable[].' };
for (const t of TOOLS) {
  let fp = 0; const byClass = {};
  for (const cls of [...OBJECTIVE, ...SUBJECTIVE]) { const c = confusion(knownGood, t, cls); if (c.fp) { fp += c.fp; byClass[cls] = c.fp; } }
  const availKG = knownGood.filter((p) => produced(p, t));
  const rawOnKnownGood = availKG.reduce((a, p) => a + p.tool[t].rawFindings, 0);
  const unmappedOnKnownGood = availKG.reduce((a, p) => a + p.tool[t].unmappedFindings, 0);
  a2[t] = {
    knownGoodPages: knownGood.length, availableKnownGoodPages: availKG.length, unavailableKnownGoodPages: knownGood.length - availKG.length,
    classFalsePositives: fp, classFalsePositivesPerAvailablePage: availKG.length ? +(fp / availKG.length).toFixed(3) : null,
    byClass, rawFindingsOnKnownGood: rawOnKnownGood, unmappedFindingsOnKnownGood: unmappedOnKnownGood,
  };
}

// A4: blocking parity floor. Of pages where oracle TRULY flags an objective defect (present & detected),
// what fraction does Sidecoach also flag SOMETHING (any available finding)?
const impObjPages = pages.filter((p) => [...OBJECTIVE].some((cls) => p.tool.oracle.available && p.tool.oracle.detected.has(cls) && p.gtObj.has(cls)));
const a4 = {
  pagesOracleBlocksObjective: impObjPages.length,
  sidecoachFlagsSomething: impObjPages.filter((p) => produced(p, 'sidecoach') && p.tool.sidecoach.rawFindings > 0).length,
  sidecoachObjectiveRecall: overall.sidecoach.objective.recall,
  note: 'Sidecoach has ~zero objective a11y rules; objective blocking is oracle-only at this baseline (expected pre-reimplementation gap).',
};

// Raw finding volume + unmapped share (precision-noise context, esp. Sidecoach).
const volume = {};
for (const t of TOOLS) {
  const raw = pages.reduce((a, p) => a + (produced(p, t) ? p.tool[t].rawFindings : 0), 0);
  const unmapped = pages.reduce((a, p) => a + (produced(p, t) ? p.tool[t].unmappedFindings : 0), 0);
  volume[t] = { rawFindings: raw, unmappedFindings: unmapped, unmappedShare: raw ? +(unmapped / raw).toFixed(3) : null };
}

// Timing + unavailable (first-class deficits).
const pct = (arr, q) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const timing = {}, unavailable = {};
for (const t of TOOLS) {
  const ms = pages.map((p) => p.tool[t].ms).filter((x) => typeof x === 'number');
  timing[t] = { medianMs: pct(ms, 0.5), p90Ms: pct(ms, 0.9), maxMs: Math.max(...ms), slowPagesOver5s: pages.filter((p) => (p.tool[t].ms || 0) > 5000).map((p) => ({ id: p.id, ms: p.tool[t].ms })).sort((a, b) => b.ms - a.ms) };
  const un = pages.filter((p) => !p.tool[t].available);
  unavailable[t] = { count: un.length, pages: un.map((p) => ({ id: p.id, reason: p.tool[t].reason })) };
}

// Seeded PRNG (mulberry32) so the bootstrap CI is REPRODUCIBLE run-to-run (Codex score-review #6).
function mulberry32(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Standard percentile via linear interpolation on the sorted sample (Codex score-review #6).
function quantile(sorted, q) { if (!sorted.length) return null; const idx = q * (sorted.length - 1); const lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo); }
// Paired page-bootstrap on the head-to-head DIFFERENCE (sidecoach metric - oracle metric). Same resampled
// page multiset for both tools each iteration (paired). Reports the OBSERVED full-corpus difference as the
// point estimate (Codex #4: the bootstrap MEAN is random/biased and must not be the headline), the bootstrap
// mean for reference, and the 95% percentile CI. A replicate where either tool's metric is undefined is
// SKIPPED, not coerced to 0 (Codex #5: 0-coercion biases sparse-detector replicates).
function bootstrapDiff(metricFn, B = 2000, seed = 20260624) {
  const rnd = mulberry32(seed);
  const n = pages.length;
  const diffs = []; let skipped = 0;
  for (let b = 0; b < B; b++) {
    const sample = [];
    for (let i = 0; i < n; i++) sample.push(pages[(rnd() * n) | 0]);
    const d = metricFn(sample);
    if (d === null || Number.isNaN(d)) { skipped++; continue; }
    diffs.push(d);
  }
  diffs.sort((a, b) => a - b);
  const observed = metricFn(pages);
  return {
    observed: observed == null ? null : +observed.toFixed(3),
    bootstrapMean: diffs.length ? +(diffs.reduce((a, x) => a + x, 0) / diffs.length).toFixed(3) : null,
    ci95: diffs.length ? [+quantile(diffs, 0.025).toFixed(3), +quantile(diffs, 0.975).toFixed(3)] : null,
    replicates: diffs.length, skipped,
  };
}
const diffRecall = (classes) => (sample) => { const s = micro(sample, 'sidecoach', classes).recall; const i = micro(sample, 'oracle', classes).recall; return (s == null || i == null) ? null : s - i; };
const diffPrecision = (classes) => (sample) => { const s = micro(sample, 'sidecoach', classes).precision; const i = micro(sample, 'oracle', classes).precision; return (s == null || i == null) ? null : s - i; };
const bootstrap = {
  note: 'paired page-bootstrap, B=2000, seeded (reproducible); value = sidecoach metric - oracle metric (positive favors Sidecoach). observed = full-corpus point estimate; ci95 = percentile CI (excludes 0 => significant gap). null-metric replicates skipped, not zero-coerced.',
  subjectiveRecallDiff: bootstrapDiff(diffRecall(SUBJECTIVE)),
  subjectivePrecisionDiff: bootstrapDiff(diffPrecision(SUBJECTIVE)),
  overallRecallDiff: bootstrapDiff(diffRecall([...OBJECTIVE, ...SUBJECTIVE])),
  overallPrecisionDiff: bootstrapDiff(diffPrecision([...OBJECTIVE, ...SUBJECTIVE])),
};

const round = (m) => m == null ? null : { ...m, recall: m.recall == null ? null : +m.recall.toFixed(3), precision: m.precision == null ? null : +m.precision.toFixed(3) };
const roundSummary = (s) => { const o = {}; for (const t of TOOLS) { o[t] = {}; for (const k of Object.keys(s[t])) o[t][k] = round(s[t][k]); } return o; };

const scorecard = {
  generatedUtc: new Date().toISOString(),
  corpus: { pages: pages.length, knownGood: knownGood.length, defectBearing: pages.filter((p) => p.bucket === 'defect-bearing').length, registers: REGISTERS, excludedContaminated: CONTAM, contaminatedNote: CONTAM.length ? `${CONTAM.length} page(s) excluded as developed-against (peeked) - they left the held-out bar; see corpus/contaminated.json. All metrics are on the remaining ${pages.length} un-peeked pages.` : null },
  groundTruth: 'objective: rendered referee (objectiveLabelerVersion) ; subjective: Codex (labeledBy=codex). full-page present-class union.',
  mapping: { algorithm: 'exact + lead-approved Codex semantic; effectiveMapping in scorecard-mapping.json', sidecoachClasses: mapping.effectiveMapping.sidecoach.allClasses, oracleClasses: mapping.effectiveMapping.oracle.allClasses },
  A1_A2_overall: roundSummary(overall),
  A1_A2_perRegister: Object.fromEntries(Object.entries(perRegister).map(([r, s]) => [r, roundSummary(s)])),
  A2_falsePositivesOnKnownGood: a2,
  A3_contrast: { note: 'contrast classes (low-contrast, gray-on-color); Sidecoach has 0 contrast rules.', perTool: Object.fromEntries(TOOLS.map((t) => [t, round(overall[t].contrast)])), contrastIndeterminatePages: pages.filter((p) => p.contrastIndeterminate).length },
  A1_objectiveParity_vs_oracleBrowser: objectiveParity,
  A4_blockingParity: a4,
  A5a_tasteDetection: { note: 'subjective (taste) classes head-to-head vs Codex labels.', perTool: Object.fromEntries(TOOLS.map((t) => [t, round(overall[t].subjective)])) },
  findingVolume: volume,
  timing,
  unavailable,
  bootstrap,
  perClass,
};
writeFileSync(OUT, JSON.stringify(scorecard, null, 2) + '\n');

// ---- readable summary ----
const f3 = (x) => x == null ? ' n/a ' : x.toFixed(3);
console.log(`\n=== CONTRACT-6 SCORECARD (${pages.length} pages${CONTAM.length ? ` ; ${CONTAM.length} contaminated excluded: ${CONTAM.join(',')}` : ''}; ${knownGood.length} known-good / ${pages.length - knownGood.length} defect-bearing) ===`);
console.log(`\nA1/A2 OVERALL (recall / precision):`);
for (const t of TOOLS) console.log(`  ${t.padEnd(10)} objective R=${f3(overall[t].objective.recall)} P=${f3(overall[t].objective.precision)} | subjective R=${f3(overall[t].subjective.recall)} P=${f3(overall[t].subjective.precision)} | overall R=${f3(overall[t].overall.recall)} P=${f3(overall[t].overall.precision)}`);
console.log(`\nA5a TASTE-DETECTION (subjective head-to-head): sidecoach R=${f3(overall.sidecoach.subjective.recall)} P=${f3(overall.sidecoach.subjective.precision)}  vs  oracle R=${f3(overall.oracle.subjective.recall)} P=${f3(overall.oracle.subjective.precision)}`);
if (objectiveParity.sidecoach != null) console.log(`\nOBJECTIVE PARITY (apples-to-apples vs oracle-BROWSER): sidecoach ${objectiveParity.sidecoach} vs oracle-browser ${objectiveParity.oracleBrowser} (n=${objectiveParity.present}) - heading sc ${objectiveParity.construction.skippedHeading.sidecoach}/${objectiveParity.construction.skippedHeading.present} imp ${objectiveParity.construction.skippedHeading.oracleBrowser} | contrast-fam sc ${objectiveParity.construction.contrastFamily.sidecoach}/${objectiveParity.construction.contrastFamily.present} imp ${objectiveParity.construction.contrastFamily.oracleBrowser}`);
console.log(`\nA2 FALSE POSITIVES on known-good: sidecoach ${a2.sidecoach.classFalsePositives} class-FP (raw ${a2.sidecoach.rawFindingsOnKnownGood}, unmapped ${a2.sidecoach.unmappedFindingsOnKnownGood}) | oracle ${a2.oracle.classFalsePositives} class-FP (raw ${a2.oracle.rawFindingsOnKnownGood}, unmapped ${a2.oracle.unmappedFindingsOnKnownGood})`);
console.log(`\nFINDING VOLUME: sidecoach ${volume.sidecoach.rawFindings} raw (${(volume.sidecoach.unmappedShare * 100).toFixed(0)}% unmapped) | oracle ${volume.oracle.rawFindings} raw (${(volume.oracle.unmappedShare * 100).toFixed(0)}% unmapped)`);
console.log(`\nA4 BLOCKING PARITY: oracle blocks objective on ${a4.pagesOracleBlocksObjective} pages; Sidecoach flags something on ${a4.sidecoachFlagsSomething}. Sidecoach objective recall=${f3(a4.sidecoachObjectiveRecall)}`);
console.log(`\nTIMING (ms): sidecoach median=${timing.sidecoach.medianMs} p90=${timing.sidecoach.p90Ms} max=${timing.sidecoach.maxMs} (${timing.sidecoach.slowPagesOver5s.length} pages >5s) | oracle median=${timing.oracle.medianMs} p90=${timing.oracle.p90Ms} max=${timing.oracle.maxMs}`);
console.log(`UNAVAILABLE: sidecoach ${unavailable.sidecoach.count} | oracle ${unavailable.oracle.count}`);
console.log(`\nPAIRED BOOTSTRAP (sidecoach - oracle; observed point estimate, 95% CI):`);
console.log(`  subjective recall    ${f3(bootstrap.subjectiveRecallDiff.observed)}  CI [${bootstrap.subjectiveRecallDiff.ci95.join(', ')}]`);
console.log(`  subjective precision ${f3(bootstrap.subjectivePrecisionDiff.observed)}  CI [${bootstrap.subjectivePrecisionDiff.ci95.join(', ')}]`);
console.log(`  overall recall       ${f3(bootstrap.overallRecallDiff.observed)}  CI [${bootstrap.overallRecallDiff.ci95.join(', ')}]`);
console.log(`  overall precision    ${f3(bootstrap.overallPrecisionDiff.observed)}  CI [${bootstrap.overallPrecisionDiff.ci95.join(', ')}]`);
console.log(`\nwrote ${OUT}`);
