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
// Task 5: completing a NON-final loop verb step is advisory - cursor advances within
// the iteration and NO product validator runs (no per-step gate in a loop lane).
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const lane_runner_1 = require("../lane-runner");
let validatorCalls = 0;
function deps(proj) {
    let n = 0, t = 0, op = 0;
    return { store: new lane_checkpoint_store_1.LaneCheckpointStore(proj),
        runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
        now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
        newOperationId: () => `op-${++op}`,
        runValidator: async () => { validatorCalls++; throw new Error('no validator on a non-final loop step'); } };
}
const rep = (verb, iteration = 0) => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-adv-'));
    const d = deps(proj);
    const start = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-adv', d); // polish
    if (start.currentVerb !== 'polish')
        throw new Error('start at polish');
    // complete polish (non-final) -> advisory advance to audit, iteration stays 0, NO validator.
    const r1 = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: start.revision }, d);
    if (r1.currentVerb !== 'audit')
        throw new Error('advance to audit, got ' + r1.currentVerb);
    if (r1.iteration !== 0)
        throw new Error('iteration stays 0 within the pass');
    if (r1.lifecycle !== 'in_progress')
        throw new Error('still in_progress');
    // complete audit (non-final) -> advance to critique (the final/boundary step).
    const r2 = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: r1.revision }, d);
    if (r2.currentVerb !== 'critique')
        throw new Error('advance to critique, got ' + r2.currentVerb);
    if (validatorCalls !== 0)
        throw new Error('NO product validator may run on non-final loop steps; got ' + validatorCalls);
    const cp = d.store.read(start.checkpointId);
    if (cp.cursor !== 2)
        throw new Error('cursor at the final step (2)');
    if (cp.iteration !== 0)
        throw new Error('iteration still 0 before the boundary');
    if (!cp.convergence || cp.convergence.advisoryRuns.length < 2)
        throw new Error('advisory served flows recorded per non-final step');
    console.log('lane-loop-advance: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-loop-advance.test.js.map