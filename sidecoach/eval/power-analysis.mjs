#!/usr/bin/env node
/**
 * Contract-6 PRE-REGISTERED POWER ANALYSIS (Stage 0) - sizes the corpus Ns from fixed parameters.
 *
 * The good/defect/brief target Ns are POWER-GOVERNED, not arbitrary (lead ruling): set each N to what the
 * metric's CI/power requires, decided at the joint manifest review. This module fixes the parameters BEFORE
 * seeing results and computes the required N per axis, so the good-N decision is data-grounded.
 *
 * PRE-REGISTERED PARAMETERS (frozen 2026-06-23, before final corpus numbers):
 *  - alpha = 0.05 (two-sided 95% CI); z = 1.959964.
 *  - A2 (KNOWN-GOOD, precision): primary metric = per-page FALSE-POSITIVE rate p_fp = fraction of known-good
 *    pages on which the detector raises >=1 false flag (vs the full-page objective ground truth). Target:
 *    95% CI half-width <= 0.10. Expected rate = the A2 floor (FP <= 0.10/page) -> p_fp = 0.10. Also report
 *    the worst-case p = 0.5 (max-variance) bound. (The paired ours-vs-oracle McNemar refinement needs pilot
 *    DISCORDANCE, which requires the owned scanner = Stage 2; the proportion-CI sizing is the pre-reg floor.)
 *  - A1 (DEFECT-BEARING, recall): metric = recall proportion; target 95% CI half-width <= 0.10; expected
 *    recall = the A1 floor 0.90.
 *  - A5 (BRIEFS): paired generative win-margin; converged plan locked N >= 20 floor (target 20-30); final N
 *    from pilot judge-variance (paired bootstrap) at the review. Reported as the floor here.
 *
 * Sizing: Wald proportion CI half-width hw = z*sqrt(p(1-p)/N) -> N = ceil(z^2 * p(1-p) / hw^2).
 */

const Z = 1.959964;
const nFor = (p, hw) => Math.ceil((Z * Z * p * (1 - p)) / (hw * hw));

const params = {
  alpha: 0.05,
  A2: { metric: 'per-page false-positive rate (known-good)', halfWidth: 0.10, pExpected: 0.10 },
  A1: { metric: 'recall (defect-bearing)', halfWidth: 0.10, pExpected: 0.90 },
  A5: { metric: 'paired generative win-margin (briefs)', floorN: 20, targetRange: '20-30' },
};

// ACTUALS (filled from the corpus at run time if available; else passed in).
function report(actual = {}) {
  const out = { params, required: {}, actual, note: [] };

  // A2 known-good
  const n_a2_expected = nFor(params.A2.pExpected, params.A2.halfWidth);
  const n_a2_worst = nFor(0.5, params.A2.halfWidth);
  out.required.knownGood = { atExpectedRate: n_a2_expected, worstCaseP0_5: n_a2_worst, halfWidth: params.A2.halfWidth, basis: 'A2 precision FP-rate CI' };

  // A1 defect-bearing
  const n_a1 = nFor(params.A1.pExpected, params.A1.halfWidth);
  out.required.defectBearing = { required: n_a1, halfWidth: params.A1.halfWidth, basis: 'A1 recall CI at expected recall 0.90' };

  // A5 briefs
  out.required.briefs = { floorN: params.A5.floorN, targetRange: params.A5.targetRange, basis: 'paired generative; final N from pilot judge-variance at review' };

  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  let actual = {};
  try {
    const man = JSON.parse(fs.readFileSync(new URL('./corpus/candidates.json', import.meta.url), 'utf8'));
    const kg = man.filter((c) => c.bucket === 'known-good').length;
    const db = man.filter((c) => c.bucket === 'defect-bearing').length;
    actual.knownGood = kg; actual.defectBearing = db; actual.totalPages = man.length;
  } catch { /* no corpus */ }
  try {
    const briefs = JSON.parse(fs.readFileSync(new URL('./corpus/briefs.json', import.meta.url), 'utf8'));
    actual.briefsReal = briefs.filter((b) => b.kind === 'real').length;
    actual.briefsCalibration = briefs.filter((b) => b.kind === 'calibration').length;
  } catch { /* no briefs */ }

  const r = report(actual);
  console.log('=== Contract-6 PRE-REGISTERED POWER ANALYSIS ===');
  console.log('params:', JSON.stringify(r.params));
  console.log('\nREQUIRED N (power-governed):');
  console.log(`  known-good (A2 precision): ${r.required.knownGood.atExpectedRate} at expected FP rate ${params.A2.pExpected} (95% CI half-width <= ${params.A2.halfWidth}); worst-case p=0.5 -> ${r.required.knownGood.worstCaseP0_5}`);
  console.log(`  defect-bearing (A1 recall): ${r.required.defectBearing.required} (95% CI half-width <= ${params.A1.halfWidth} at recall ${params.A1.pExpected})`);
  console.log(`  briefs (A5): floor ${r.required.briefs.floorN}, target ${r.required.briefs.targetRange} (final N from pilot judge-variance)`);
  console.log('\nACTUAL (current corpus):', JSON.stringify(r.actual));
  const kgGap = (r.required.knownGood.atExpectedRate) - (r.actual.knownGood || 0);
  const dbGap = (r.required.defectBearing.required) - (r.actual.defectBearing || 0);
  console.log('\nGAP to power-required N:');
  console.log(`  known-good: need ${r.required.knownGood.atExpectedRate}, have ${r.actual.knownGood || 0} -> ${kgGap > 0 ? kgGap + ' more' : 'MET'}`);
  console.log(`  defect-bearing: need ${r.required.defectBearing.required}, have ${r.actual.defectBearing || 0} -> ${dbGap > 0 ? dbGap + ' more' : 'MET'}`);
  console.log(`  briefs (real): target >= ${r.required.briefs.floorN}, have ${r.actual.briefsReal || 0} -> ${(r.actual.briefsReal || 0) >= r.required.briefs.floorN ? 'MET' : (r.required.briefs.floorN - (r.actual.briefsReal || 0)) + ' more'}`);
}

export { report, nFor, params };
