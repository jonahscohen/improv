#!/usr/bin/env node
/**
 * Taste-precision retune (2026-07-28): offline threshold sweeps over the cached SHIPPING scores.
 *
 * THE METHOD RULE THIS FILE EXISTS TO ENFORCE: do not tune on the set you measure on. Every sweep below runs on
 * the TUNE population only (dev 48 + candidates 90). The HELDOUT population (buzzword-heldout, 37 labeled) is
 * scored ONLY at a fixed operating point, and only after that point was chosen. `--heldout` is what prints it.
 *
 * Both populations' labels are independent codex screenshot labels - an independent PROXY for taste, not ground
 * truth. Every number here should be read as "agreement with the labeler".
 *
 * Usage:
 *   node eval/taste-precision-sweep.mjs              # sweeps on TUNE, prints the chosen point's TUNE score
 *   node eval/taste-precision-sweep.mjs --heldout    # also scores the chosen point on the untouched HELDOUT
 *   node eval/taste-precision-sweep.mjs --fp <rule>  # list the false positives for a rule at the chosen point
 * Exit 0 ok, 2 cache missing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const CACHE = path.join(HERE, '.taste-cache');

const load = (n) => {
  const f = path.join(CACHE, `${n}.json`);
  if (!existsSync(f)) { console.error(`taste-precision-sweep: missing ${f}. Run eval/taste-precision-features.mjs first.`); process.exit(2); }
  return JSON.parse(readFileSync(f, 'utf8'));
};
const args = process.argv.slice(2);
const wantHeldout = args.includes('--heldout');
const fpIdx = args.indexOf('--fp');
const fpRule = fpIdx >= 0 ? args[fpIdx + 1] : null;

// HELD-OUT ISOLATION IS MECHANICAL, NOT DOCUMENTED. Without --heldout the held-out cache is never LOADED, so no
// sweep, no probe and no console line can read it even by mistake. Documented isolation is the kind that erodes
// one convenience line at a time; this cannot.
const dev = load('dev'), cand = load('candidates');
const held = wantHeldout ? load('heldout') : null;
const TUNE = [...dev.pages.map((p) => ({ ...p, corpus: 'dev' })), ...cand.pages.map((p) => ({ ...p, corpus: 'candidates' }))];
const HELD = held ? held.pages.map((p) => ({ ...p, corpus: 'heldout' })) : [];

// BUILD-STAMP GATE. Every cache must come from the SAME build, and that build must be the CURRENT one - the
// sweep applies today's exported constants to whatever scores are on disk, so a stale cache would produce
// numbers that look entirely normal and mean nothing. Fail closed (exit 6) rather than report them.
const scannerSrc = readFileSync(path.join(ROOT, 'src/validators/subjective-rendered-scanner.ts'), 'utf8');
const distPath = path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js');
if (!existsSync(distPath)) { console.error('taste-precision-sweep: dist not built. Run npm run build.'); process.exit(2); }
const currentStamp = createHash('sha256').update(scannerSrc).update(readFileSync(distPath, 'utf8')).digest('hex').slice(0, 16);
const loaded = [dev, cand, ...(held ? [held] : [])];
for (const c of loaded) {
  if (c.buildStamp !== currentStamp) {
    console.error(`taste-precision-sweep: cache "${c.corpus}" was built from a DIFFERENT scanner build.`);
    console.error(`  cache stamp=${c.buildStamp || '(none - pre-stamp cache)'}  current=${currentStamp}`);
    console.error('  Scoring old scores against new constants produces numbers that look normal and mean nothing.');
    console.error('  Re-run: npm run build && node eval/taste-precision-features.mjs');
    process.exit(6);
  }
}

function score(pages, rule, fires) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const fpIds = [], fnIds = [];
  for (const p of pages) {
    const gt = p.labels[rule];
    if (gt === undefined) continue;
    const f = fires(p);
    if (gt && f) tp++;
    else if (gt && !f) { fn++; fnIds.push(p.id); }
    else if (!gt && f) { fp++; fpIds.push(p.id); }
    else tn++;
  }
  const prec = tp + fp ? tp / (tp + fp) : null;
  const rec = tp + fn ? tp / (tp + fn) : null;
  // `prec && rec` treated a REAL ZERO as absent and printed n/a - exactly on the low-recall and inert-detector
  // rows where a 0.000 is the finding. null means UNDEFINED (no fires / no positives); 0 means zero.
  const f1 = prec === null || rec === null ? null : (prec + rec === 0 ? 0 : (2 * prec * rec) / (prec + rec));
  return { tp, fp, fn, tn, prec, rec, f1, n: tp + fp + fn + tn, pos: tp + fn, fpIds, fnIds };
}
const f3 = (x) => (x === null ? ' n/a ' : x.toFixed(3));
const line = (label, s) =>
  `${label.padEnd(30)} P=${f3(s.prec)} (${s.tp}/${s.tp + s.fp})  R=${f3(s.rec)} (${s.tp}/${s.pos})  F1=${f3(s.f1)}  [n=${s.n}, pos=${s.pos}]`;

/* ---------------- decision functions: OLD (shipped before this unit) vs candidate NEW ---------------- */

// marketing-buzzword. OLD: qualify on >=1 STRONG/PEAK term, fire at density >= 0.75 over the ALL-TIER weighted
// sum (PEAK 4 / STRONG 2 / MILD 0.5).
const buzzOld = (p) => p.buzz.hasStrongOrPeak && p.buzz.density >= 0.75;
// Density recomputed over a TIER SUBSET from the cached per-term counts. 'all' reproduces the shipping density
// exactly; 'ps' drops the MILD tier from the numerator; 'peak' keeps PEAK only. The MILD tier is where the
// ordinary technical vocabulary lives (robust, scalable, efficient, optimize, modern, advanced, intelligent),
// so this dimension asks directly whether the false positives are being carried by it.
const densityOver = (p, basis) => {
  if (basis === 'all') return p.buzz.density;
  const min = basis === 'peak' ? 4 : 2;
  if (!(p.buzz.words >= 40)) return 0;
  let w = 0;
  for (const t of p.buzz.termCounts || []) if (t.tier >= min) w += t.tier * t.count;
  return (w / p.buzz.words) * 100;
};
const buzzNew = (gate, th, basis = 'all') => (p) => p.buzz.distinctPeak >= gate && densityOver(p, basis) >= th;

// nested-cards. OLD: >= 1 nested pair of any geometry (inPageNestedCards already applies the 0.85 inner-area cut).
const nestOld = (p) => (p.nested.pairs || []).length >= 1;
const nestNew = (minPairs, maxOuterFrac, maxAreaFrac) => (p) =>
  (p.nested.pairs || []).filter((q) => q.outerViewportWidthFrac <= maxOuterFrac && q.areaFrac <= maxAreaFrac).length >= minPairs;
// CANDIDATE nested-cards guard (the REJECTED retune), kept so its rejection stays reproducible.
const nestCandidate = (maxOuterFrac) => (p) => (p.nested.pairs || []).filter((q) => q.outerViewportWidthFrac <= maxOuterFrac).length >= 1;

// numbered-section-markers. The rule was REMOVED 2026-07-28, so `numberedMarkerCount` no longer exists on a
// FRESH feature cache. Reporting "0 fires" off a missing field would be indistinguishable from the real
// pre-removal zero, which is the exact confusion this class already caused - so the absence is reported as
// UNAVAILABLE instead of silently scored. eval/numbered-markers-removal-evidence.mjs is the re-runnable proof.
const numberedFieldPresent = TUNE.some((p) => typeof p.marker.numberedMarkerCount === 'number');
const numOld = (p) => p.marker.numberedMarkerCount >= 3;
const longestRun = (vals) => {
  const u = Array.from(new Set(vals)).sort((a, b) => a - b);
  let run = u.length ? 1 : 0, best = run;
  for (let i = 1; i < u.length; i++) { if (u[i] === u[i - 1] + 1) { run++; if (run > best) best = run; } else run = 1; }
  return best;
};
const numNew = (minPx, requirePadded, minRun) => (p) => {
  const c = (p.marker.numberedCandidates || []).filter((m) => m.px >= minPx && (requirePadded ? m.padded : true));
  return longestRun(c.map((m) => m.value)) >= minRun;
};

// SHIPPING DECISIONS. These call the EXPORTED Node-side threshold functions on the cached in-page scores, which
// is byte-for-byte the production decision path - no local copy to drift. Only the CANDIDATE sweep rows above
// carry parameterised logic, because sweeping a parameter is the one thing that cannot be delegated.
const M = await import(distPath);
const shipBuzzword = (p) => M.buzzwordFindingFromScore(p.buzz) !== null;
const shipNested = (p) => M.nestedCardsFindingFromScore(p.nested) !== null;
// default-typeface ground A ships GATED, so the product decision is "never". This row measures the DETECTOR, so
// it opts in explicitly - the same reason eval/typeface-calibrate.mjs does.
const faceGroundA = (p) => M.typefaceFindingFromScore(p.typeface, { enableDefaultStackGround: true }) !== null;
const faceShipped = (p) => M.typefaceFindingFromScore(p.typeface, {}) !== null;

// tiny-text (unchanged detector; read straight off the shipping findings).
const tinyFires = (p) => p.subjectiveFindings.some((f) => f.rule === 'tiny-text');

/* ---------------- sweeps (TUNE ONLY) ---------------- */

console.log(`TUNE population: ${TUNE.length} pages (dev ${dev.pages.length} + candidates ${cand.pages.length})`);
console.log(`HELDOUT population: ${HELD.length} pages (buzzword-heldout) - not consulted by any sweep below\n`);

console.log('=== marketing-buzzword: sweep distinct-PEAK gate x density threshold x tier basis (TUNE) ===');
console.log('  basis gate  thr    P      R      F1     TP  FP  FN');
for (const basis of ['all', 'ps', 'peak']) {
  for (const gate of [0, 1, 2, 3]) {
    for (const th of [0.5, 0.75, 1.0, 1.5, 2.0, 3.0]) {
      const s = score(TUNE, 'marketing-buzzword', buzzNew(gate, th, basis));
      console.log(`  ${basis.padEnd(5)} ${String(gate).padStart(4)}  ${th.toFixed(2)}  ${f3(s.prec)}  ${f3(s.rec)}  ${f3(s.f1)}  ${String(s.tp).padStart(3)} ${String(s.fp).padStart(3)} ${String(s.fn).padStart(3)}`);
    }
  }
}
console.log(line('  OLD (>=1 strong/peak, 0.75, all)', score(TUNE, 'marketing-buzzword', buzzOld)));

console.log('\n=== nested-cards: sweep minPairs x maxOuterViewportFrac x maxAreaFrac (TUNE) ===');
console.log('  pairs outerF areaF   P      R      F1     TP  FP  FN');
for (const minPairs of [1, 2, 3]) {
  for (const outerF of [1.0, 0.9, 0.7]) {
    for (const areaF of [0.85, 0.6, 0.4]) {
      const s = score(TUNE, 'nested-cards', nestNew(minPairs, outerF, areaF));
      console.log(`  ${String(minPairs).padStart(5)} ${outerF.toFixed(2)}  ${areaF.toFixed(2)}   ${f3(s.prec)}  ${f3(s.rec)}  ${f3(s.f1)}  ${String(s.tp).padStart(3)} ${String(s.fp).padStart(3)} ${String(s.fn).padStart(3)}`);
    }
  }
}
console.log(line('  OLD (>=1 pair, any geometry)', score(TUNE, 'nested-cards', nestOld)));

console.log('\n=== numbered-section-markers: sweep prominence x padding x run length (TUNE) ===');
if (!numberedFieldPresent) {
  console.log('  UNAVAILABLE - the rule was REMOVED 2026-07-28 and this cache carries no numbered fields.');
  console.log('  Run eval/numbered-markers-removal-evidence.mjs for the reproducible removal measurement.');
} else {
console.log('  minPx padded run    P      R      F1     TP  FP  FN');
for (const minPx of [32, 24, 18, 0]) {
  for (const padded of [true, false]) {
    for (const run of [3, 2]) {
      const s = score(TUNE, 'numbered-section-markers', numNew(minPx, padded, run));
      console.log(`  ${String(minPx).padStart(5)} ${String(padded).padStart(6)} ${String(run).padStart(3)}    ${f3(s.prec)}  ${f3(s.rec)}  ${f3(s.f1)}  ${String(s.tp).padStart(3)} ${String(s.fp).padStart(3)} ${String(s.fn).padStart(3)}`);
    }
  }
}
console.log(line('  OLD (32px, padded, run 3)', score(TUNE, 'numbered-section-markers', numOld)));
}

console.log('\n=== default-typeface: fire rate (NO LABELS in either population - precision is UNMEASURABLE here) ===');
for (const [nm, pages] of [['dev', dev.pages], ['candidates', cand.pages]]) {
  const fires = pages.filter(faceGroundA).length;
  const labeled = pages.filter((p) => p.labels['default-typeface'] !== undefined).length;
  console.log(`  ${nm.padEnd(12)} fires ${String(fires).padStart(3)}/${String(pages.length).padEnd(3)}  labeled-for-this-class: ${labeled}`);
}
console.log('  (held-out fire rate is printed only under --heldout - it is not loaded otherwise)');

console.log('\n=== tiny-text (unchanged detector, dedupe only) ===');
console.log(line('  TUNE', score(TUNE, 'tiny-text', tinyFires)));

if (fpRule) {
  const fn = { 'marketing-buzzword': buzzOld, 'nested-cards': nestOld, 'numbered-section-markers': numOld }[fpRule];
  if (fn) {
    const s = score(TUNE, fpRule, fn);
    console.log(`\nOLD false positives for ${fpRule} on TUNE (${s.fp}): ${s.fpIds.join(', ') || 'none'}`);
    console.log(`OLD false negatives for ${fpRule} on TUNE (${s.fn}): ${s.fnIds.join(', ') || 'none'}`);
  }
}

if (wantHeldout) {
  // The chosen operating point, imported from the SHIPPING module so this can never report a point that is not
  // the one that ships.
  console.log('\n================ HELDOUT (untouched by every sweep above) ================');
  console.log(`shipping point: BUZZ_MIN_DISTINCT_PEAK=${M.BUZZ_MIN_DISTINCT_PEAK} BUZZ_DENSITY_THRESHOLD=${M.BUZZ_DENSITY_THRESHOLD}`);
  // nested-cards ships UNCHANGED: its retune was REJECTED by this very held-out (the tuning gain reversed), so
  // the shipping decision is the old one and the two columns below are identical BY DESIGN, not by accident.
  console.log('shipping point: nested-cards UNCHANGED (retune rejected on held-out - see the scanner note)');
  const shipBuzz = shipBuzzword;
  const shipNest = shipNested;
  const rejectedNest = nestCandidate(0.8);
  for (const [label, pages] of [['TUNE', TUNE], ['HELDOUT', HELD]]) {
    console.log(`\n-- ${label} --`);
    console.log(line('marketing-buzzword OLD', score(pages, 'marketing-buzzword', buzzOld)));
    console.log(line('marketing-buzzword NEW', score(pages, 'marketing-buzzword', shipBuzz)));
    console.log(line('nested-cards SHIPPED', score(pages, 'nested-cards', shipNest)));
    console.log(line('nested-cards (REJECTED retune)', score(pages, 'nested-cards', rejectedNest)));
    console.log(line('tiny-text (unchanged)', score(pages, 'tiny-text', tinyFires)));
    // numbered-section-markers was REMOVED. Only scored here when the cache predates the removal; otherwise
    // reported as unavailable rather than as a zero nobody can distinguish from the real one.
    if (numberedFieldPresent) console.log(line('numbered-sec-markers (REMOVED)', score(pages, 'numbered-section-markers', numOld)));
    else console.log(`${'numbered-sec-markers (REMOVED)'.padEnd(30)} UNAVAILABLE in this cache - see eval/numbered-markers-removal-evidence.mjs`);
    const fires = pages.filter(faceGroundA).length;
    const shipped = pages.filter(faceShipped).length;
    console.log(`${'default-typeface ground A'.padEnd(30)} would fire ${fires}/${pages.length} if opted in; ships ${shipped}/${pages.length} (GATED). 0 pages here carry a default-typeface label, so P is UNDEFINED.`);
  }
  // PER-CORPUS breakdown, so the numbers reconcile against the figures published on 2026-07-28 (which reported
  // dev and candidates separately) instead of only in aggregate.
  console.log('\n-- per corpus --');
  for (const [nm, pgs] of [['dev', dev.pages], ['candidates', cand.pages], ['heldout(untouched)', held.pages]]) {
    for (const [rule, oldFn, newFn] of [['marketing-buzzword', buzzOld, shipBuzz], ['nested-cards', nestOld, shipNest], ['tiny-text', tinyFires, tinyFires]]) {
      const a = score(pgs, rule, oldFn), b = score(pgs, rule, newFn);
      console.log(`  ${nm.padEnd(19)} ${rule.padEnd(19)} OLD P=${f3(a.prec)} (${a.tp}/${a.tp + a.fp}) R=${f3(a.rec)} (${a.tp}/${a.pos})  |  NEW P=${f3(b.prec)} (${b.tp}/${b.tp + b.fp}) R=${f3(b.rec)} (${b.tp}/${b.pos})`);
    }
  }

  const hb = score(HELD, 'marketing-buzzword', shipBuzz);
  console.log(`\nHELDOUT buzzword NEW false positives (${hb.fp}): ${hb.fpIds.join(', ') || 'none'}`);
  console.log(`HELDOUT buzzword NEW false negatives (${hb.fn}): ${hb.fnIds.join(', ') || 'none'}`);
  console.log('\nnested-cards REJECTED-retune detail (why it was not shipped):');
  for (const [nm, pgs] of [['TUNE', TUNE], ['HELDOUT', HELD]]) {
    const a = score(pgs, 'nested-cards', nestOld), b = score(pgs, 'nested-cards', rejectedNest);
    console.log(`  ${nm.padEnd(8)} shipped P=${f3(a.prec)} (${a.tp}/${a.tp + a.fp})  rejected P=${f3(b.prec)} (${b.tp}/${b.tp + b.fp})  -> it dropped ${a.tp - b.tp} true positive(s) and ${a.fp - b.fp} false positive(s)`);
  }
}
