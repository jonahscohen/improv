"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Task 3: pure convergence module - signature, boundary evaluation, progress decision.
const lane_convergence_1 = require("../lane-convergence");
// Hand-built ProductValidationResult helpers (no real validators needed).
function clean(scope = ['s1']) {
    return { status: 'clean', rules: [], findings: [],
        coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
            ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 },
            findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: scope, unverifiedScope: [] } };
}
function withFail(ruleKey) {
    return { status: 'findings',
        rules: [{ ruleId: ruleKey, canonicalRuleKey: ruleKey, status: 'fail', severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
        findings: [{ validatorId: 'polish-standard', ruleId: ruleKey, canonicalRuleKey: ruleKey, severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
        coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
            ruleCounts: { pass: 0, fail: 1, notApplicable: 0, inconclusive: 0 },
            findingCounts: { blockingExcess: 1, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: ['scope-x'] } };
}
function errored() {
    return { status: 'error', normalizedErrorCategory: 'aborted', error: 'lease lost', rules: [], findings: [],
        coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
            ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
            findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } };
}
function coverageGap(skipped, unreadable, unsupported) {
    return { status: 'inconclusive', rules: [], findings: [],
        coverage: { discoveredFiles: [...skipped, ...unreadable, ...unsupported], inspectedFiles: [], skippedFiles: [...skipped, ...unreadable],
            unreadableFiles: unreadable, unsupportedFiles: unsupported, supportedSourceKinds: [], unsupportedSourceKinds: ['vue'],
            ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 1 },
            findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: ['scope-x'] } };
}
function run() {
    // --- signature: stable across validator ORDER ---
    const a = [
        { validatorId: 'theming', result: clean() },
        { validatorId: 'polish-standard', result: withFail('polish.no-transition-all') },
    ];
    const b = [a[1], a[0]];
    const sigA = (0, lane_convergence_1.computeRequiredStateSignature)(a.map((x) => (0, lane_convergence_1.toRequiredValidatorState)(x.validatorId, x.result)));
    const sigB = (0, lane_convergence_1.computeRequiredStateSignature)(b.map((x) => (0, lane_convergence_1.toRequiredValidatorState)(x.validatorId, x.result)));
    if (sigA !== sigB)
        throw new Error('signature must be stable across validator order');
    if (sigA.length !== 16)
        throw new Error('signature is 16 hex chars');
    // --- signature: changes when a failed rule changes ---
    const sigC = (0, lane_convergence_1.computeRequiredStateSignature)([(0, lane_convergence_1.toRequiredValidatorState)('polish-standard', withFail('polish.tabular-nums'))]);
    if (sigC === sigA)
        throw new Error('different failed rule keys -> different signature');
    // --- signature: a validator error category enters the signature ---
    const sigErr = (0, lane_convergence_1.computeRequiredStateSignature)([(0, lane_convergence_1.toRequiredValidatorState)('static-a11y', errored())]);
    const sigCleanOnly = (0, lane_convergence_1.computeRequiredStateSignature)([(0, lane_convergence_1.toRequiredValidatorState)('static-a11y', clean())]);
    if (sigErr === sigCleanOnly)
        throw new Error('error category must enter the signature');
    // Stable FILE identities enter the signature. Different skipped, unreadable, or
    // unsupported source files must not collapse to the same empty-gap signature.
    const sigGapA = (0, lane_convergence_1.computeRequiredStateSignature)([(0, lane_convergence_1.toRequiredValidatorState)('polish-standard', coverageGap(['dist/a.css'], ['src/b.css'], ['src/C.vue']))]);
    const sigGapB = (0, lane_convergence_1.computeRequiredStateSignature)([(0, lane_convergence_1.toRequiredValidatorState)('polish-standard', coverageGap(['dist/z.css'], ['src/q.css'], ['src/D.vue']))]);
    if (sigGapA === sigGapB)
        throw new Error('different file-level coverage gaps need different signatures');
    // --- evaluateBoundary: all clean -> converged ---
    const evClean = (0, lane_convergence_1.evaluateBoundary)([
        { validatorId: 'polish-standard', result: clean(['polished-press-feedback']) },
        { validatorId: 'theming', result: clean(['theming-consistency']) },
    ]);
    if (!evClean.converged || evClean.iterationStatus !== 'clean')
        throw new Error('all clean -> converged');
    if (JSON.stringify(evClean.measuredScope) !== JSON.stringify(['polished-press-feedback', 'theming-consistency'].sort())) {
        throw new Error('measuredScope merged+sorted from coverage');
    }
    // --- evaluateBoundary: a fail -> not converged, worst-status findings, findings collected ---
    const evFail = (0, lane_convergence_1.evaluateBoundary)([
        { validatorId: 'polish-standard', result: withFail('polish.no-transition-all') },
        { validatorId: 'theming', result: clean() },
    ]);
    if (evFail.converged)
        throw new Error('a fail cannot converge');
    if (evFail.iterationStatus !== 'findings')
        throw new Error('worst-status is findings');
    if (evFail.findings.length !== 1)
        throw new Error('findings collected from results');
    // --- evaluateBoundary: an error -> not converged, worst-status error, validatorErrors recorded ---
    const evErr = (0, lane_convergence_1.evaluateBoundary)([
        { validatorId: 'static-a11y', result: errored() },
        { validatorId: 'theming', result: clean() },
    ]);
    if (evErr.converged)
        throw new Error('an error cannot converge');
    if (evErr.iterationStatus !== 'error')
        throw new Error('worst-status is error');
    if (evErr.validatorErrors.length !== 1 || evErr.validatorErrors[0].category !== 'aborted')
        throw new Error('validatorErrors recorded');
    // --- evaluateBoundary: empty required set is rejected (vacuous gate guard) ---
    let threw = false;
    try {
        (0, lane_convergence_1.evaluateBoundary)([]);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('a convergence boundary requires >=1 required validator');
    // --- decideProgress: converged ---
    const seed = (0, lane_convergence_1.seedConvergenceState)();
    if (seed.limits.maxIterations !== lane_convergence_1.DEFAULT_LOOP_MAX_ITERATIONS || seed.limits.maxNoProgress !== lane_convergence_1.DEFAULT_LOOP_MAX_NO_PROGRESS) {
        throw new Error('seed uses default limits');
    }
    const dConv = (0, lane_convergence_1.decideProgress)(seed, evClean);
    if (dConv.outcome !== 'converged')
        throw new Error('converged decision');
    // --- decideProgress: first non-converged -> running, consecutiveNoProgress=1, nextIteration=1 ---
    const d1 = (0, lane_convergence_1.decideProgress)(seed, evFail);
    if (d1.outcome !== 'running' || d1.consecutiveNoProgress !== 1 || d1.nextIteration !== 1) {
        throw new Error('first miss -> running/1/1, got ' + JSON.stringify(d1));
    }
    // --- decideProgress: same signature maxNoProgress times -> stalled ---
    let state = (0, lane_convergence_1.seedConvergenceState)({ maxNoProgress: 3, maxIterations: 100 });
    let dec = (0, lane_convergence_1.decideProgress)(state, evFail); // consecutive 1
    state = { ...state, signatures: [...state.signatures, evFail.signature], consecutiveNoProgress: dec.consecutiveNoProgress, iteration: dec.nextIteration };
    dec = (0, lane_convergence_1.decideProgress)(state, evFail); // consecutive 2
    state = { ...state, signatures: [...state.signatures, evFail.signature], consecutiveNoProgress: dec.consecutiveNoProgress, iteration: dec.nextIteration };
    dec = (0, lane_convergence_1.decideProgress)(state, evFail); // consecutive 3 -> stalled
    if (dec.outcome !== 'stalled' || dec.consecutiveNoProgress !== 3)
        throw new Error('stall at maxNoProgress, got ' + JSON.stringify(dec));
    // --- decideProgress: distinct signatures avoid stall; nextIteration reaching maxIterations -> capped ---
    let cs = (0, lane_convergence_1.seedConvergenceState)({ maxNoProgress: 99, maxIterations: 2 });
    let cd = (0, lane_convergence_1.decideProgress)(cs, withSig(evFail, 'sig-0')); // running, next=1
    if (cd.outcome !== 'running')
        throw new Error('iter0 running');
    cs = { ...cs, signatures: ['sig-0'], consecutiveNoProgress: 1, iteration: 1 };
    cd = (0, lane_convergence_1.decideProgress)(cs, withSig(evFail, 'sig-1')); // next=2 >= maxIterations 2 -> capped
    if (cd.outcome !== 'capped')
        throw new Error('cap at maxIterations, got ' + JSON.stringify(cd));
    console.log('lane-convergence: OK');
}
// test helper: override a BoundaryEvaluation signature to drive distinct-signature paths.
function withSig(ev, sig) { return { ...ev, signature: sig }; }
run();
//# sourceMappingURL=lane-convergence.test.js.map