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
// Task 4: lane_converge starts (no longer rejected); convergence sub-state seeded.
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
        // never called at start (no boundary yet); throws if a step gate wrongly runs it.
        runValidator: async () => { throw new Error('runValidator must NOT run at lane start'); } };
}
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-start-'));
    const d = deps(proj);
    const start = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-loop', d);
    if (start.currentVerb !== 'polish')
        throw new Error('first loop step is polish, got ' + start.currentVerb);
    if (start.executionKind !== 'loop')
        throw new Error('executionKind loop');
    if (start.iteration !== 0)
        throw new Error('iteration 0 at start');
    if (start.lifecycle !== 'in_progress')
        throw new Error('in_progress at start');
    const cp = d.store.read(start.checkpointId);
    if (!cp.convergence)
        throw new Error('convergence sub-state must be seeded for a loop lane');
    if (cp.convergence.outcome !== 'running')
        throw new Error('seeded outcome running');
    if (cp.convergence.limits.maxNoProgress !== 3 || cp.convergence.limits.maxIterations !== 10)
        throw new Error('seeded default limits');
    // A loop lane whose policy is unknown would reject - sanity-check the happy path only here.
    console.log('lane-loop-start: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-loop-start.test.js.map