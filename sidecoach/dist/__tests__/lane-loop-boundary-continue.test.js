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
// Task 7: only a RUNNING boundary advances to the next iteration. Stalled/capped
// are terminal-pending, reject ordinary complete/skip, and require explicit
// retry/resume. A final-step skip still runs the boundary gate.
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
function inconclusiveResult() {
    return { status: 'inconclusive', rules: [], findings: [],
        coverage: { inspectedFiles: [], skippedFiles: ['x.css'], supportedSourceKinds: [], unsupportedSourceKinds: [],
            ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 1 },
            findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: ['scope-incon'] } };
}
function erroredResult() {
    return { status: 'error', normalizedErrorCategory: 'aborted', error: 'boundary error', rules: [], findings: [],
        coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
            ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
            findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } };
}
// polish-standard returns polishResult(); other required validators are clean.
function deps(proj, polishResult) {
    let n = 0, t = 0, op = 0;
    return { store: new lane_checkpoint_store_1.LaneCheckpointStore(proj),
        runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
        now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
        newOperationId: () => `op-${++op}`,
        runValidator: async (validatorId) => (validatorId === 'polish-standard' ? polishResult() : clean()) };
}
const rep = (verb, iteration) => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });
// Drive one full iteration via complete; returns the boundary result.
async function onePass(proj, d, cpId, rev, iter) {
    const a = await (0, lane_runner_1.advanceLane)(proj, cpId, { action: 'complete', report: rep('polish', iter), expectedRevision: rev }, d);
    const b = await (0, lane_runner_1.advanceLane)(proj, cpId, { action: 'complete', report: rep('audit', iter), expectedRevision: a.revision }, d);
    const c = await (0, lane_runner_1.advanceLane)(proj, cpId, { action: 'complete', report: rep('critique', iter), expectedRevision: b.revision }, d);
    return { res: c };
}
async function mustReject(fn, re) {
    let threw = false;
    try {
        await fn();
    }
    catch (e) {
        const msg = String(e?.message ?? e);
        if (!re.test(msg))
            throw new Error('rejected with the wrong message: ' + msg);
        threw = true;
    }
    if (!threw)
        throw new Error('expected a rejection matching ' + re);
}
async function run() {
    // --- continue + reset cursor on a non-converged boundary ---
    {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-cont-'));
        const d = deps(proj, () => fail('polish.no-transition-all'));
        const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-cont', d);
        const { res } = await onePass(proj, d, s.checkpointId, s.revision, 0);
        if (res.lifecycle !== 'in_progress')
            throw new Error('non-converged stays in_progress');
        if (res.currentVerb !== 'polish')
            throw new Error('cursor reset to polish for the next pass, got ' + res.currentVerb);
        if (res.iteration !== 1)
            throw new Error('iteration incremented to 1, got ' + res.iteration);
        if (!res.convergence || res.convergence.outcome !== 'running')
            throw new Error('outcome running');
        if (!res.convergence.findings || res.convergence.findings.length !== 1)
            throw new Error('findings returned to the model');
        const cp = d.store.read(s.checkpointId);
        if (cp.convergence.signatures.length !== 1)
            throw new Error('one signature persisted after pass 0');
    }
    // --- stall: identical failing state for maxNoProgress passes ---
    {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-stall-'));
        const d = deps(proj, () => fail('polish.no-transition-all')); // same rule each pass -> same signature
        const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-stall', d);
        let rev = s.revision;
        let last;
        for (let i = 0; i < 3; i++) {
            const { res } = await onePass(proj, d, s.checkpointId, rev, i);
            rev = res.revision;
            last = res;
        }
        if (!last.convergence || last.convergence.outcome !== 'stalled')
            throw new Error('stalled after 3 identical passes, got ' + last.convergence?.outcome);
        if (last.currentVerb !== 'critique' || last.iteration !== 2)
            throw new Error('stall must remain at terminal boundary and not serve iteration 3');
        const stopped = d.store.read(s.checkpointId);
        if (stopped.cursor !== 2 || stopped.iteration !== 2 || stopped.lease !== null)
            throw new Error('stall persisted terminal-pending with cleared lease');
        await mustReject(() => (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'complete', report: rep('critique', 2), expectedRevision: last.revision }, d), /explicit retry or resume/);
        await mustReject(() => (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'skip', reason: 'ordinary skip', expectedRevision: last.revision }, d), /explicit retry or resume/);
    }
    // --- CAP: maxIterations=1, one failing pass -> capped, terminal-pending ---
    {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-cap-'));
        const d = deps(proj, () => fail('polish.no-transition-all'));
        const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-cap', d);
        const cp0 = d.store.read(s.checkpointId);
        cp0.convergence.limits.maxIterations = 1; // cap after the first pass
        d.store.write(cp0);
        const { res } = await onePass(proj, d, s.checkpointId, s.revision, 0);
        if (!res.convergence || res.convergence.outcome !== 'capped')
            throw new Error('capped after 1 pass at maxIterations=1, got ' + res.convergence?.outcome);
        if (res.currentVerb !== 'critique')
            throw new Error('cap stays on the terminal boundary (critique), got ' + res.currentVerb);
        if (res.iteration !== 0)
            throw new Error('cap does not advance the iteration');
        const cp = d.store.read(s.checkpointId);
        if (cp.cursor !== 2 || cp.iteration !== 0 || cp.lease !== null)
            throw new Error('cap persisted terminal-pending: cursor 2, iteration 0, lease null');
        await mustReject(() => (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'complete', report: rep('critique', 0), expectedRevision: res.revision }, d), /explicit retry or resume/);
        await mustReject(() => (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'skip', reason: 'ordinary skip', expectedRevision: res.revision }, d), /explicit retry or resume/);
    }
    // --- RETRY: from capped, retry reruns the SAME boundary; clean validators converge ---
    {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-retry-'));
        let polish = () => fail('polish.no-transition-all');
        const d = deps(proj, () => polish());
        const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-retry', d);
        const cp0 = d.store.read(s.checkpointId);
        cp0.convergence.limits.maxIterations = 1;
        d.store.write(cp0);
        const { res } = await onePass(proj, d, s.checkpointId, s.revision, 0);
        if (res.convergence.outcome !== 'capped')
            throw new Error('precondition: capped, got ' + res.convergence.outcome);
        polish = () => clean(); // fix the product; retry must reach clean
        const retried = await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'retry', expectedRevision: res.revision }, d);
        if (retried.outcome !== 'converged')
            throw new Error('retry with clean validators converges, got ' + retried.outcome);
        if (!retried.convergence || retried.convergence.outcome !== 'converged')
            throw new Error('retry converges (convergence surface)');
        if (retried.lifecycle !== 'closed')
            throw new Error('retry-converged closes the lane');
        if (retried.iteration !== 0)
            throw new Error('retry stays on the same iteration (no advance)');
    }
    // --- RESUME: from stalled, resume begins the pending next pass ---
    {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-resume-'));
        const d = deps(proj, () => fail('polish.no-transition-all'));
        const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-resume', d);
        let rev = s.revision;
        let last;
        for (let i = 0; i < 3; i++) {
            const { res } = await onePass(proj, d, s.checkpointId, rev, i);
            rev = res.revision;
            last = res;
        }
        if (last.convergence.outcome !== 'stalled')
            throw new Error('precondition: stalled, got ' + last.convergence.outcome);
        const pendingIter = d.store.read(s.checkpointId).convergence.iteration;
        const resumed = await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'resume', expectedRevision: last.revision }, d);
        if (resumed.currentVerb !== 'polish')
            throw new Error('resume serves polish first, got ' + resumed.currentVerb);
        if (resumed.iteration !== pendingIter)
            throw new Error('resume moves to the pending iteration ' + pendingIter + ', got ' + resumed.iteration);
        const cp = d.store.read(s.checkpointId);
        if (cp.convergence.outcome !== 'running')
            throw new Error('resume sets convergence outcome back to running');
        if (cp.cursor !== 0)
            throw new Error('resume resets cursor to 0');
        if (cp.convergence.consecutiveNoProgress !== 0)
            throw new Error('resume resets consecutiveNoProgress');
    }
    // --- FRESH STORE/PROCESS CONTINUATION: a new store + deps continues to convergence ---
    {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-fresh-'));
        let polish = () => fail('polish.no-transition-all');
        const d1 = deps(proj, () => polish());
        const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-fresh', d1);
        const { res } = await onePass(proj, d1, s.checkpointId, s.revision, 0);
        if (res.convergence.outcome !== 'running' || res.iteration !== 1)
            throw new Error('precondition: running with iteration 1 pending');
        // New process: a fresh LaneCheckpointStore + deps; validators now clean. No in-memory state carried.
        let polish2 = () => clean();
        const d2 = deps(proj, () => polish2());
        const cont = await onePass(proj, d2, s.checkpointId, res.revision, 1);
        if (cont.res.outcome !== 'converged')
            throw new Error('a fresh store/process continues iteration 1 to convergence, got ' + cont.res.outcome);
    }
    // --- INCONCLUSIVE/ERROR: neither converges; both iterations + signatures persist, lease cleared ---
    {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-incerr-'));
        let polishCalls = 0;
        const d = deps(proj, () => { polishCalls++; return polishCalls === 1 ? inconclusiveResult() : erroredResult(); });
        const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-incerr', d);
        const p0 = await onePass(proj, d, s.checkpointId, s.revision, 0);
        if (p0.res.convergence.outcome === 'converged')
            throw new Error('an inconclusive boundary cannot converge');
        if (p0.res.convergence.outcome !== 'running')
            throw new Error('inconclusive stays resumable (running)');
        if (d.store.read(s.checkpointId).lease !== null)
            throw new Error('lease cleared after the inconclusive boundary');
        const p1 = await onePass(proj, d, s.checkpointId, p0.res.revision, 1);
        if (p1.res.convergence.outcome === 'converged')
            throw new Error('a typed-error boundary cannot converge');
        const cp = d.store.read(s.checkpointId);
        if (cp.convergence.history.length !== 2 || cp.convergence.signatures.length !== 2)
            throw new Error('both iterations and signatures persist');
        if (cp.lease !== null)
            throw new Error('lease cleared after the error boundary');
    }
    // --- skip of the FINAL step still runs the boundary gate (cannot bypass) ---
    {
        const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-skip-'));
        let boundaryRan = 0;
        const base = deps(proj, () => clean());
        const d = { ...base, runValidator: async (_vId) => { boundaryRan++; return clean(); } };
        const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-skip', d);
        const a = await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'complete', report: rep('polish', 0), expectedRevision: s.revision }, d);
        const b = await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'complete', report: rep('audit', 0), expectedRevision: a.revision }, d);
        // SKIP critique (the final coaching verb): the boundary gate MUST still run.
        const c = await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'skip', reason: 'critique coaching not needed this pass', expectedRevision: b.revision }, d);
        if (boundaryRan !== 4)
            throw new Error('skip of the final step must still run the 4 boundary validators, got ' + boundaryRan);
        if (c.outcome !== 'converged')
            throw new Error('all-clean boundary after a final-step skip still converges, got ' + c.outcome);
    }
    console.log('lane-loop-boundary-continue: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-loop-boundary-continue.test.js.map