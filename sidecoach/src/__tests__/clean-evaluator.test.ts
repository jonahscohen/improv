// sidecoach/src/__tests__/clean-evaluator.test.ts
import { evaluateCleanPolicy, isCoverageSatisfied } from '../clean-evaluator';
import type { CoverageObservation, RunCoverage } from '../clean-evaluator';
import type { ProductRuleResult, CleanPolicy } from '../product-rule-types';

const REQ = 'a11y.focus-visible';   // a REAL seed rule (lets us assert real-metadata synthesis)

const policy: CleanPolicy = {
  requiredRuleIds: [REQ],
  blockingSeverities: ['blocker', 'major'],
  toleratedFindingCounts: {},
  requiredCoverageByScope: [{ ruleId: REQ, scope: 'file', evidenceAlternativesByRequirement: [['css', 'scss']], requireAllDiscoveredApplicableFiles: true }],
  inconclusiveBehavior: 'block',
  notApplicableBehavior: 'exclude_and_report',
};

const run: RunCoverage = {
  inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
  measuredScope: ['file:a.css'], unverifiedScope: [],
};
const satObs = (id: string): CoverageObservation => ({
  ruleId: id,
  inspectedFiles: ['a.css'],
  discoveredApplicableFiles: [{ file: 'a.css', evidenceKindsPresent: ['css'] }],
});
const gapObs = (id: string): CoverageObservation => ({
  ruleId: id,
  inspectedFiles: [],
  discoveredApplicableFiles: [{ file: 'a.css', evidenceKindsPresent: ['css'] }],
});
const rule = (id: string, status: any, severity: any = 'blocker', findingClass = 'a11y'): ProductRuleResult =>
  ({ ruleId: id, canonicalRuleKey: id, status, severity, findingClass, evidenceLocations: [], message: '' });
const input = (rules: ProductRuleResult[], obs: CoverageObservation[]) => ({ validatorId: 'static-a11y', rules, coverageObservations: obs, runCoverage: run });

function run_() {
  // satisfaction function unit check
  if (!isCoverageSatisfied(policy.requiredCoverageByScope[0], satObs(REQ))) throw new Error('satObs must satisfy');
  if (isCoverageSatisfied(policy.requiredCoverageByScope[0], gapObs(REQ))) throw new Error('gapObs must NOT satisfy');

  // AND-across-requirements: a css-rule + markup rule needs BOTH compatible
  // evidence families on each applicable file. A CSS-only file does NOT satisfy it.
  const twoReq = { ruleId: 't', scope: 'file' as const, evidenceAlternativesByRequirement: [['css'], ['html', 'tsx']], requireAllDiscoveredApplicableFiles: false };
  const cssOnly: CoverageObservation = { ruleId: 't', inspectedFiles: ['a.css'], discoveredApplicableFiles: [{ file: 'a.css', evidenceKindsPresent: ['css'] }] };
  const cssAndMarkup: CoverageObservation = { ruleId: 't', inspectedFiles: ['a.tsx'], discoveredApplicableFiles: [{ file: 'a.tsx', evidenceKindsPresent: ['css', 'tsx'] }] };
  if (isCoverageSatisfied(twoReq, cssOnly)) throw new Error('css-only run must NOT satisfy a css-rule+markup rule');
  if (!isCoverageSatisfied(twoReq, cssAndMarkup)) throw new Error('a file with css+markup evidence must satisfy the two-requirement rule');

  // PER-FILE completeness: global evidence aggregation must not hide that one
  // discovered applicable file lacks compatible evidence. Both are inspected,
  // but b.txt cannot satisfy the css alternative, so requireAll must fail.
  const uncoveredFile: CoverageObservation = {
    ruleId: REQ,
    inspectedFiles: ['a.css', 'b.txt'],
    discoveredApplicableFiles: [
      { file: 'a.css', evidenceKindsPresent: ['css'] },
      { file: 'b.txt', evidenceKindsPresent: ['text'] },
    ],
  };
  if (isCoverageSatisfied(policy.requiredCoverageByScope[0], uncoveredFile)) {
    throw new Error('every discovered applicable file must independently map to compatible evidence');
  }

  // required pass + satisfied coverage -> clean, with REPRODUCIBLE coverage
  let r = evaluateCleanPolicy(input([rule(REQ, 'pass')], [satObs(REQ)]), policy);
  if (r.status !== 'clean') throw new Error('all required pass -> clean');
  if (JSON.stringify(r.coverage.inspectedFiles) !== JSON.stringify(['a.css'])) throw new Error('coverage must be reproducible (inspectedFiles)');
  if (r.coverage.measuredScope[0] !== 'file:a.css') throw new Error('coverage must carry measuredScope');

  // STEP 2 (non-vacuity) PRECEDES STEP 3 (coverage): a validator whose only
  // required rule is not_applicable is vacuous -> inconclusive, EVEN WHEN a
  // satisfying coverage observation is supplied (vacuity is decided before any
  // coverage logic runs). The not_applicable rule is excluded by applicability.
  r = evaluateCleanPolicy(input([rule(REQ, 'not_applicable')], [satObs(REQ)]), policy);
  if (r.status !== 'inconclusive') throw new Error('vacuous validator -> inconclusive BEFORE coverage');

  // required inconclusive -> inconclusive (step 4)
  r = evaluateCleanPolicy(input([rule(REQ, 'inconclusive')], [satObs(REQ)]), policy);
  if (r.status !== 'inconclusive') throw new Error('required inconclusive -> inconclusive');

  // coverage gap -> inconclusive (step 3)
  r = evaluateCleanPolicy(input([rule(REQ, 'pass')], [gapObs(REQ)]), policy);
  if (r.status !== 'inconclusive') throw new Error('coverage gap -> inconclusive');

  // MISSING required rule -> inconclusive AND synthesized from the REAL definition
  r = evaluateCleanPolicy(input([], []), policy);
  if (r.status !== 'inconclusive') throw new Error('missing required -> inconclusive');
  const synth = r.rules.find((x) => x.ruleId === REQ);
  if (!synth || synth.canonicalRuleKey !== 'a11y/focus-visible' || synth.severity !== 'blocker') throw new Error('synthesis must use real registry metadata, not fabricated values');

  // blocking fail -> findings, materialized with the right validatorId (step 6)
  r = evaluateCleanPolicy(input([rule(REQ, 'fail', 'blocker')], [satObs(REQ)]), policy);
  if (r.status !== 'findings' || r.findings.length !== 1 || r.findings[0].validatorId !== 'static-a11y') throw new Error('blocking fail -> findings with validatorId');

  // non-blocking (minor) fail -> clean, nonBlocking counted, finding PRESERVED (step 7 + P1-1)
  r = evaluateCleanPolicy(input([rule(REQ, 'pass'), rule('x.minor', 'fail', 'minor', 'polish')], [satObs(REQ)]), policy);
  if (r.status !== 'clean' || r.coverage.findingCounts.nonBlocking !== 1 || r.findings.length !== 1) throw new Error('minor fail -> clean + nonBlocking + preserved finding');

  // tolerated blocking fail -> clean (withinTolerance)
  const tol: CleanPolicy = { ...policy, toleratedFindingCounts: { 'major|anti-pattern': 1 } };
  r = evaluateCleanPolicy(input([rule(REQ, 'pass'), rule('y.maj', 'fail', 'major', 'anti-pattern')], [satObs(REQ)]), tol);
  if (r.status !== 'clean' || r.coverage.findingCounts.withinTolerance !== 1) throw new Error('tolerated blocking -> clean');

  // duplicate required-rule results -> inconclusive (NEW P2: not silently collapsed)
  r = evaluateCleanPolicy(input([rule(REQ, 'pass'), rule(REQ, 'pass')], [satObs(REQ)]), policy);
  if (r.status !== 'inconclusive') throw new Error('duplicate required result -> inconclusive');

  // P1: a required ruleId with NO registry definition is a TRUE registry fault ->
  // validator-level ERROR (registry_fault), returned BEFORE non-vacuity; never a
  // fabricated advisory inconclusive.
  {
    const ghost = 'ghost.not-in-registry';
    const ghostPolicy: CleanPolicy = {
      ...policy,
      requiredRuleIds: [ghost],
      requiredCoverageByScope: [{ ruleId: ghost, scope: 'file', evidenceAlternativesByRequirement: [['css']], requireAllDiscoveredApplicableFiles: true }],
    };
    const e = evaluateCleanPolicy(input([], []), ghostPolicy);
    if (e.status !== 'error') throw new Error('unknown required rule -> validator-level error');
    if (e.normalizedErrorCategory !== 'registry_fault') throw new Error('unknown required rule -> registry_fault category');
  }

  console.log('clean-evaluator: OK');
}
run_();
