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
// sidecoach/src/__tests__/lane-runner-advance-sequence.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const lane_runner_1 = require("../lane-runner");
function deps(proj) {
    let n = 0, t = 0, op = 0;
    return { store: new lane_checkpoint_store_1.LaneCheckpointStore(proj),
        runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
        now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
        newOperationId: () => `op-${++op}`,
        runValidator: async () => ({ status: 'clean', rules: [], findings: [],
            coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
                ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
                findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } }) };
}
const rep = (verb) => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-adv-'));
    const d = deps(proj);
    const start = await (0, lane_runner_1.startLane)('lane_build', 'hero', { projectPath: proj }, 'req-1', d); // shape, craft, polish
    let threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', expectedRevision: start.revision }, d);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('complete without report rejects');
    threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 99 }, d);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('stale revision rejects');
    threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: { ...rep('shape'), evidence: [] }, expectedRevision: start.revision }, d);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('report with no evidence rejects');
    const r1 = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: start.revision }, d);
    if (r1.currentVerb !== 'craft')
        throw new Error('advance to craft');
    if (r1.revision <= start.revision)
        throw new Error('revision must advance after a committed complete');
    // duplicate reportId is a no-op (still craft) regardless of revision
    const dup = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: 1 }, d);
    if (dup.currentVerb !== 'craft')
        throw new Error('duplicate reportId is no-op');
    // wrong stepId rejected
    threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: dup.revision }, d);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('mismatched stepId rejects');
    const r2 = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: dup.revision }, d);
    const r3 = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: r2.revision }, d);
    if (r3.lifecycle !== 'closed' || r3.outcome !== 'completed')
        throw new Error('sequence with no skips closes completed');
    if (r3.currentVerb !== undefined)
        throw new Error('closed lane has no currentVerb');
    // advancing a closed lane rejects
    threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: r3.revision }, d);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('advancing a closed lane rejects');
    // P1-3: a PARTIALLY-served step must NOT be completable. A mid-serve
    // interruption can leave servedSteps[key].flowIds covering only some of
    // step.flowIds; completing then would attest the step while skipping the
    // unserved flows. Simulate a truncated served cache and assert complete rejects.
    const p = await (0, lane_runner_1.startLane)('lane_build', 'heroP', { projectPath: proj }, 'req-P', d); // shape
    const pc = await (0, lane_runner_1.advanceLane)(proj, p.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: p.revision }, d); // craft (multi-flow, fully served)
    const cpRaw = d.store.read(p.checkpointId);
    const key = `${cpRaw.cursor}:${cpRaw.iteration}`;
    if ((cpRaw.servedSteps[key]?.flowIds.length ?? 0) < 2)
        throw new Error('test setup: craft step must have >=2 flows to truncate');
    cpRaw.servedSteps[key].flowIds = cpRaw.servedSteps[key].flowIds.slice(0, 1); // simulate mid-serve interruption
    d.store.write(cpRaw);
    threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, p.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: pc.revision }, d);
    }
    catch (e) {
        threw = /partial|served/i.test(String(e.message));
    }
    if (!threw)
        throw new Error('completing a partially-served step must be rejected');
    console.log('lane-runner-advance-sequence: OK');
}
run();
//# sourceMappingURL=lane-runner-advance-sequence.test.js.map