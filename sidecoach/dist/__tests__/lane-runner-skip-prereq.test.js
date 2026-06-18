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
// sidecoach/src/__tests__/lane-runner-skip-prereq.test.ts
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
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-skip-'));
    const d = deps(proj);
    // lane_build verb 'shape' owns flowA_brand_verify; later flowF_design_tokens
    // REQUIRES flowA (flow-prerequisites.ts). Skipping shape must be REJECTED.
    const start = await (0, lane_runner_1.startLane)('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
    let threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'skip', expectedRevision: start.revision, reason: 'skip shape' }, d);
    }
    catch (e) {
        threw = /depend|prerequisite|flowA|strand/i.test(String(e.message));
    }
    if (!threw)
        throw new Error('skipping shape must be rejected (flowF requires flowA)');
    // skip requires a reason
    threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'skip', expectedRevision: start.revision }, d);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('skip requires a reason');
    // A safe skip: complete shape+craft, then the LAST step (polish) has no
    // dependents, so skipping it is allowed and closes the lane 'partial'.
    let r = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: { stepId: 'shape', iteration: 0, reportId: 'r-shape', verb: 'shape', summary: 's', evidence: [{ kind: 'note', detail: 'x' }] }, expectedRevision: start.revision }, d);
    r = await (0, lane_runner_1.advanceLane)(proj, r.checkpointId, { action: 'complete', report: { stepId: 'craft', iteration: 0, reportId: 'r-craft', verb: 'craft', summary: 's', evidence: [{ kind: 'note', detail: 'x' }] }, expectedRevision: r.revision }, d);
    const skipped = await (0, lane_runner_1.advanceLane)(proj, r.checkpointId, { action: 'skip', expectedRevision: r.revision, reason: 'no polish needed' }, d);
    if (skipped.lifecycle !== 'closed' || skipped.outcome !== 'partial')
        throw new Error('skipping last step closes lane partial');
    console.log('lane-runner-skip-prereq: OK');
}
run();
//# sourceMappingURL=lane-runner-skip-prereq.test.js.map