"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// P2a: an UNCLEAN retry must PRESERVE the pending iteration index (only a genuine
// continue advances it). After a stall, retry (still failing) then resume must run the
// SAME pending iteration, not skip one. Regression for decideProgress incrementing the
// persisted pending index on a non-converging retry.
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const lane_runner_1 = require("../lane-runner");
function fail(ruleKey) {
    return { status: 'findings',
        rules: [{ ruleId: ruleKey, canonicalRuleKey: ruleKey, status: 'fail', severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
        findings: [{ validatorId: 'polish-standard', ruleId: ruleKey, canonicalRuleKey: ruleKey, severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
        coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
            ruleCounts: { pass: 0, fail: 1, notApplicable: 0, inconclusive: 0 },
            findingCounts: { blockingExcess: 1, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: ['scope-x'] } };
}
function clean() {
    return { status: 'clean', rules: [], findings: [],
        coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
            ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 },
            findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: ['ok'], unverifiedScope: [] } };
}
function deps(proj, polishResult) {
    let n = 0, t = 0, op = 0;
    return { store: new lane_checkpoint_store_1.LaneCheckpointStore(proj),
        runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
        now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
        newOperationId: () => `op-${++op}`,
        runValidator: async (validatorId) => (validatorId === 'polish-standard' ? polishResult() : clean()) };
}
const rep = (verb, iteration) => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });
async function onePass(proj, d, cpId, rev, iter) {
    const a = await (0, lane_runner_1.advanceLane)(proj, cpId, { action: 'complete', report: rep('polish', iter), expectedRevision: rev }, d);
    const b = await (0, lane_runner_1.advanceLane)(proj, cpId, { action: 'complete', report: rep('audit', iter), expectedRevision: a.revision }, d);
    return (0, lane_runner_1.advanceLane)(proj, cpId, { action: 'complete', report: rep('critique', iter), expectedRevision: b.revision }, d);
}
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-retryiter-'));
    const d = deps(proj, () => fail('polish.no-transition-all')); // same failing rule each pass -> stall
    const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-retryiter', d);
    let rev = s.revision, last;
    for (let i = 0; i < 3; i++) {
        last = await onePass(proj, d, s.checkpointId, rev, i);
        rev = last.revision;
    }
    if (last.convergence.outcome !== 'stalled')
        throw new Error('precondition: stalled, got ' + last.convergence.outcome);
    const pending = d.store.read(s.checkpointId).convergence.iteration; // the pending next index after the stall
    if (pending !== 3)
        throw new Error('precondition: pending index is 3 after a 3-pass stall, got ' + pending);
    // UNCLEAN retry (same failing validator): stays stalled and must NOT advance the
    // pending index (the retry re-ran the SAME boundary, it did not continue).
    const retried = await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'retry', expectedRevision: last.revision }, d);
    if (retried.convergence.outcome === 'converged')
        throw new Error('precondition: an unclean retry does not converge');
    const pendingAfter = d.store.read(s.checkpointId).convergence.iteration;
    if (pendingAfter !== pending)
        throw new Error(`an unclean retry must preserve the pending iteration ${pending}, got ${pendingAfter}`);
    // Resume must begin that SAME preserved pending iteration, not the next.
    const resumed = await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'resume', expectedRevision: retried.revision }, d);
    if (resumed.currentVerb !== 'polish')
        throw new Error('resume serves polish, got ' + resumed.currentVerb);
    if (resumed.iteration !== pending)
        throw new Error(`resume must run the preserved pending iteration ${pending}, got ${resumed.iteration}`);
    console.log('lane-loop-retry-iteration: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-loop-retry-iteration.test.js.map