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
// sidecoach/src/__tests__/lane-execution-e2e.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const lane_runner_1 = require("../lane-runner");
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-e2e-'));
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    const routed = await engine.process('/sidecoach build me a dashboard from scratch and make it production-ready', { projectPath: proj, userId: 't' });
    if (!routed.lane)
        throw new Error('phrase did not start a lane through process()');
    // The engine ROUTES + starts the lane (process()). Drive the routed checkpoint with
    // a clean-validator stub deps: this e2e asserts process() routing + lane completion
    // under a clean gate; the real validator wiring (production laneDeps) lands in Task 10
    // (covered by lane-engine-methods, whose validators gate inconclusive on an empty proj).
    const drive = {
        store: new lane_checkpoint_store_1.LaneCheckpointStore(proj),
        runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
        now: () => new Date().toISOString(),
        newCheckpointId: () => 'lane-e2e',
        newOperationId: () => `op-${Math.random().toString(36).slice(2)}`,
        runValidator: async () => ({ status: 'clean', rules: [], findings: [],
            coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
                ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
                findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } }),
    };
    let step = routed.lane;
    let guard = 0;
    while (step.lifecycle === 'in_progress' && guard++ < 50) {
        const verb = step.currentVerb;
        const rep = { stepId: verb, iteration: step.iteration, reportId: `e2e:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] };
        step = await (0, lane_runner_1.advanceLane)(proj, step.checkpointId, { action: 'complete', report: rep, expectedRevision: step.revision }, drive);
    }
    if (step.lifecycle !== 'closed' || step.outcome !== 'completed')
        throw new Error(`routed sequence lane must finish completed (got ${step.lifecycle}/${step.outcome})`);
    console.log('lane-execution-e2e: OK');
}
run();
//# sourceMappingURL=lane-execution-e2e.test.js.map