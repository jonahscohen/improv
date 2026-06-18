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
// Task 1: convergence sub-state types + checkpoint round-trip (additive, schema v2).
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-types-'));
    const store = new lane_checkpoint_store_1.LaneCheckpointStore(proj);
    const conv = {
        outcome: 'running', iteration: 0, signatures: [], consecutiveNoProgress: 0,
        limits: { maxIterations: 10, maxNoProgress: 3 },
        history: [], findings: [], validatorErrors: [], advisoryRuns: [],
        runCoverage: { discoveredFiles: [], inspectedFiles: [], skippedFiles: [], unreadableFiles: [], unsupportedSourceKinds: [],
            unsupportedFiles: [], measuredScope: [], unverifiedScope: [], notApplicableRuleIds: [] },
    };
    const cp = {
        schemaVersion: 2, checkpointId: 'cp-conv', laneId: 'lane_converge', target: 'project',
        executionKind: 'loop', lifecycle: 'in_progress', outcome: undefined,
        cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
        stepReports: [], audit: [], servedSteps: {}, revision: 1, startRequestId: 'req',
        seenReportIds: [], fencingCounter: 1, sideEffectOutbox: [], stepGateStatuses: {},
        lease: null, convergence: conv, createdAt: 't', updatedAt: 't',
    };
    store.write(cp);
    const back = store.read('cp-conv');
    if (!back.convergence)
        throw new Error('convergence sub-state must round-trip');
    if (back.convergence.outcome !== 'running')
        throw new Error('convergence.outcome lost');
    if (back.convergence.limits.maxNoProgress !== 3)
        throw new Error('limits lost');
    if (!back.convergence.runCoverage || !Array.isArray(back.convergence.runCoverage.unsupportedFiles))
        throw new Error('run coverage identities lost');
    // Regression: a SEQUENCE checkpoint with NO convergence still reads (additive field).
    const seq = { ...cp, checkpointId: 'cp-seq', laneId: 'lane_build', executionKind: 'sequence', convergence: undefined };
    store.write(seq);
    const seqBack = store.read('cp-seq');
    if (seqBack.convergence !== undefined)
        throw new Error('sequence checkpoint must have no convergence');
    console.log('lane-convergence-types: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-convergence-types.test.js.map