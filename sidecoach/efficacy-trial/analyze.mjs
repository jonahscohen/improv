#!/usr/bin/env node
/**
 * ANALYSIS. FAIL-CLOSED, and it executes the PRE-REGISTERED plan without choices left in it.
 *
 * PREREGISTRATION.md section 4 fixes everything this file does: the confirmatory family
 * {M1 (S vs P), M2 (S vs P)}, Holm correction over that FIXED family, two-sided tests throughout,
 * whole-triple dropping, and the null-declaration rule. Nothing here inspects the data before
 * deciding what to test.
 *
 * Reports M1b and M3 too, and M3 carries its pre-registered asymmetric reading printed next to
 * the number so it cannot be quoted out of context: a positive M3 may not support the headline.
 *
 * EXIT CODES
 *   0  analysis complete; results/results.json written
 *   1  usage
 *   2  a required input is missing (collection / axe / sidecoach / verdicts)
 *   3  an input is internally inconsistent (verdict count, arm coverage, missing pairs)
 *   4  filesystem failure
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { TRIAL_ROOT } from './lib/briefs.mjs';
import { signTest, clopperPearson, wilcoxonSignedRank, bootstrapMeanCI, cohenDz, holm } from './lib/stats.mjs';

const EXIT = { OK: 0, USAGE: 1, MISSING: 2, INCONSISTENT: 3, IO: 4 };
const die = (code, msg) => { console.error(`analyze: ${msg}`); process.exit(code); };
const ALPHA = 0.05;
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : 'n/a');

function need(p, label) {
  if (!existsSync(p)) die(EXIT.MISSING, `${label} not found at ${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Paired count differences (armA - armB) over the ids, in a fixed id order. */
function pairedDiffs(rows, ids, armA, armB, field) {
  const get = (id, arm) => {
    const r = rows.find((x) => x.id === id && x.arm === arm);
    if (!r) die(EXIT.INCONSISTENT, `no ${field} measurement for ${arm}/${id}`);
    return r[field];
  };
  const kept = [], dropped = [];
  for (const id of ids) {
    const a = get(id, armA), b = get(id, armB);
    if (a === null || b === null) { dropped.push(id); continue; }
    kept.push({ id, a, b, d: a - b });
  }
  return { kept, dropped };
}

function countTest(rows, ids, armA, armB, field, label) {
  const { kept, dropped } = pairedDiffs(rows, ids, armA, armB, field);
  const diffs = kept.map((k) => k.d);
  const w = wilcoxonSignedRank(diffs);
  const boot = bootstrapMeanCI(diffs);
  return {
    label,
    contrast: `${armA}-vs-${armB}`,
    n: diffs.length,
    droppedIds: dropped,
    meanA: kept.reduce((s, k) => s + k.a, 0) / (kept.length || 1),
    meanB: kept.reduce((s, k) => s + k.b, 0) / (kept.length || 1),
    meanDiff: boot.mean,
    bootstrapCI: [boot.lo, boot.hi],
    dz: cohenDz(diffs),
    ties: w.zeros,
    tieRate: diffs.length ? w.zeros / diffs.length : NaN,
    wilcoxonW: w.W,
    p: w.p,
    perPair: kept,
  };
}

function preferenceTest(verdicts, contrast, favouredArm, label) {
  const rows = verdicts.filter((v) => v.contrast === contrast);
  const wins = rows.filter((v) => v.winnerArm === favouredArm).length;
  const ties = rows.filter((v) => v.verdict === 'TIE').length;
  const losses = rows.length - wins - ties;
  const st = signTest(wins, losses);
  const ci = clopperPearson(wins, wins + losses);
  return {
    label, contrast, favouredArm,
    comparisons: rows.length, wins, losses, ties,
    decided: wins + losses,
    winRate: st.winRate,
    ci95: ci,
    p: st.p,
    perPair: rows.map((v) => ({ id: v.id, A: v.A, B: v.B, verdict: v.verdict, winnerArm: v.winnerArm, reason: v.reason })),
  };
}

function main() {
  if (process.argv.length > 2) die(EXIT.USAGE, `takes no arguments, got: ${process.argv.slice(2).join(' ')}`);
  const R = (f) => path.join(TRIAL_ROOT, f);
  const collection = need(R('results/collection.json'), 'collection');
  const axe = need(R('measurements/axe.json'), 'axe measurements');
  const sc = need(R('measurements/sidecoach.json'), 'sidecoach measurements');
  const vPath = R('judge/verdicts.jsonl');
  if (!existsSync(vPath)) die(EXIT.MISSING, `verdicts not found at ${vPath}`);
  const verdicts = readFileSync(vPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const assignment = need(R('judge/assignment.json'), 'assignment');

  const ids = collection.completeTriples;
  if (ids.length === 0) die(EXIT.INCONSISTENT, 'no complete triples');
  if (verdicts.length !== assignment.rows.length) die(EXIT.INCONSISTENT, `${verdicts.length} verdicts vs ${assignment.rows.length} assigned comparisons`);

  // ---- the confirmatory family, fixed by the pre-registration --------------------------------
  const M1 = preferenceTest(verdicts, 'S-vs-P', 'S', 'M1 blind preference, sidecoach vs length-matched placebo (CONFIRMATORY)');
  const M2 = countTest(axe.pages, ids, 'S', 'P', 'violations', 'M2 axe-core violations, sidecoach minus placebo (CONFIRMATORY; lower is better)');
  const family = holm([{ key: 'M1', p: M1.p }, { key: 'M2', p: M2.p }], ALPHA);

  // ---- secondary / descriptive ------------------------------------------------------------------
  const M1_PC = preferenceTest(verdicts, 'P-vs-C', 'P', 'SECONDARY blind preference, placebo vs bare control (the pure prompt-length effect)');
  const M3 = countTest(sc.pages, ids, 'S', 'P', 'findings', 'M3 sidecoach-detect findings, sidecoach minus placebo (SECONDARY, OWN EXAM, asymmetric)');
  const M2_PC = countTest(axe.pages, ids, 'P', 'C', 'violations', 'axe violations, placebo minus control (descriptive)');
  const M2_SC = countTest(axe.pages, ids, 'S', 'C', 'violations', 'axe violations, sidecoach minus bare control (DESCRIPTIVE ONLY - the confounded contrast)');

  const anyReject = family.some((e) => e.reject);
  const results = {
    analysedAt: new Date().toISOString(),
    realisedN: ids.length,
    alphaFamilywise: ALPHA,
    confirmatoryFamily: family,
    verdict: anyReject
      ? 'At least one confirmatory measure survived Holm - see confirmatoryFamily for which.'
      : 'NO DETECTABLE IMPROVEMENT on this task at this n. Neither confirmatory measure survived Holm correction.',
    M1, M2, M1_PC, M3, M2_PC, M2_SC,
    leaks: collection.leaks,
    sidecoachInconclusive: sc.inconclusiveCount,
    readingRules: {
      M3: 'ASYMMETRIC by pre-registration. Null or negative = STRONG evidence against improvement. Positive = WEAK, and BARRED from the headline and the verdict.',
      M2_SC: 'The confounded S-vs-C contrast. Reported for completeness; cannot carry any claim.',
      power: 'n=17 detects only a LARGE effect (sign test needs 13 of 17; 80% power only at a true win rate of 0.813). A non-significant result means no LARGE effect was detected, NOT that there is no effect.',
    },
  };

  try {
    mkdirSync(R('results'), { recursive: true });
    writeFileSync(R('results/results.json'), `${JSON.stringify(results, null, 2)}\n`);
  } catch (e) { die(EXIT.IO, `writing results.json: ${e.message}`); }

  // ---- report ------------------------------------------------------------------------------------
  const line = (s = '') => console.log(s);
  line('='.repeat(78));
  line(`SIDECOACH EFFICACY TRIAL - RESULTS   (realised n = ${ids.length} briefs x 3 arms)`);
  line('='.repeat(78));
  line();
  line('CONFIRMATORY (Holm over the fixed family {M1, M2}, family-wise alpha 0.05)');
  for (const e of family) {
    const m = e.key === 'M1' ? M1 : M2;
    line(`  ${e.key}  p = ${f3(e.p)}   Holm threshold ${f3(e.threshold)}   adjusted p ${f3(e.adjustedP)}   ${e.reject ? 'REJECT null' : 'no rejection'}`);
    line(`      ${m.label}`);
  }
  line();
  line(`M1  sidecoach vs placebo, blind independent judge (Codex/GPT-5.4), source-level`);
  line(`    ${M1.wins} win / ${M1.losses} loss / ${M1.ties} tie  ->  win rate ${f3(M1.winRate)} on ${M1.decided} decided`);
  line(`    exact 95% CI [${f3(M1.ci95[0])}, ${f3(M1.ci95[1])}]   two-sided exact binomial p = ${f3(M1.p)}`);
  line();
  line(`M2  axe-core violations (independent of sidecoach; lower is better)`);
  line(`    mean S ${f3(M2.meanA)}  vs  mean P ${f3(M2.meanB)}   mean paired diff ${f3(M2.meanDiff)}`);
  line(`    bootstrap 95% CI [${f3(M2.bootstrapCI[0])}, ${f3(M2.bootstrapCI[1])}]   d_z ${f3(M2.dz)}`);
  line(`    exact Wilcoxon p = ${f3(M2.p)}   zero-difference pairs ${M2.ties}/${M2.n} (${f3(M2.tieRate)})`);
  if (M2.tieRate >= 0.6) line('    NOTE: >=60% of pairs tie - M2 is degenerate here and carried little information.');
  line();
  line('SECONDARY');
  line(`  P vs C (pure prompt-length effect): ${M1_PC.wins}/${M1_PC.losses}/${M1_PC.ties} -> win rate ${f3(M1_PC.winRate)}, p = ${f3(M1_PC.p)}`);
  line(`  M3 sidecoach-detect, S minus P: mean diff ${f3(M3.meanDiff)} CI [${f3(M3.bootstrapCI[0])}, ${f3(M3.bootstrapCI[1])}] Wilcoxon p = ${f3(M3.p)}  (n=${M3.n}${M3.droppedIds.length ? `, ${M3.droppedIds.length} inconclusive dropped` : ''})`);
  line(`     ${results.readingRules.M3}`);
  line();
  line('DESCRIPTIVE');
  line(`  axe P minus C: mean diff ${f3(M2_PC.meanDiff)} CI [${f3(M2_PC.bootstrapCI[0])}, ${f3(M2_PC.bootstrapCI[1])}] p = ${f3(M2_PC.p)}`);
  line(`  axe S minus C: mean diff ${f3(M2_SC.meanDiff)} CI [${f3(M2_SC.bootstrapCI[0])}, ${f3(M2_SC.bootstrapCI[1])}] p = ${f3(M2_SC.p)}  (CONFOUNDED - no claim)`);
  line();
  line(`BLINDING: ${results.leaks.length === 0 ? 'no page named sidecoach, the placebo, or the trial' : `${results.leaks.length} page(s) leaked - see results.json`}`);
  line();
  line(`VERDICT: ${results.verdict}`);
  line(`POWER:   ${results.readingRules.power}`);
  process.exit(EXIT.OK);
}

main();
