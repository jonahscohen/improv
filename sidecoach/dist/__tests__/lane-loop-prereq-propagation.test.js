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
// P2b: loop-complete must propagate the completed step's successfulFlowIds into the
// persisted completedFlowIds (mirroring the sequence path) so a later step's flows see
// their prerequisites through the real orchestrator prereq path. Without it, flowK can't
// see successful flowJ and flowL can't see J/K within a converge loop.
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const lane_runner_1 = require("../lane-runner");
function clean() {
    return { status: 'clean', rules: [], findings: [],
        coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
            ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 },
            findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: ['ok'], unverifiedScope: [] } };
}
// records the completedFlowIds each flow received (the prereq context the real laneDeps
// derives canExecute from).
const seen = {};
function deps(proj) {
    let n = 0, t = 0, op = 0;
    return { store: new lane_checkpoint_store_1.LaneCheckpointStore(proj),
        runFlow: async (flowId, context) => {
            seen[String(flowId)] = [...((context && context.completedFlowIds) || [])];
            return { flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] };
        },
        now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
        newOperationId: () => `op-${++op}`,
        runValidator: async () => clean() };
}
const rep = (verb) => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-prereq-'));
    const d = deps(proj);
    const s = await (0, lane_runner_1.startLane)('lane_converge', 'project', { projectPath: proj }, 'req-prereq', d); // serves polish (flowJ, flowM)
    const a = await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: s.revision }, d); // serves audit (flowK, flowI)
    // After completing polish, the audit step's flows must see flowJ (and flowM) as
    // completed prerequisites.
    if (!seen['flowK_multi_lens_audit'])
        throw new Error('flowK (audit) was not served');
    if (!seen['flowK_multi_lens_audit'].includes('flowJ_tactical_polish')) {
        throw new Error('loop-complete must propagate flowJ into completedFlowIds so flowK sees its prerequisite; got ' + JSON.stringify(seen['flowK_multi_lens_audit']));
    }
    // The persisted checkpoint must carry the completed flows (not reset across the loop).
    const cpAfterPolish = d.store.read(s.checkpointId);
    if (!cpAfterPolish.completedFlowIds.includes('flowJ_tactical_polish')) {
        throw new Error('completing polish in a loop must persist flowJ into completedFlowIds; got ' + JSON.stringify(cpAfterPolish.completedFlowIds));
    }
    await (0, lane_runner_1.advanceLane)(proj, s.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: a.revision }, d); // serves critique (flowL)
    if (!seen['flowL_design_critique'])
        throw new Error('flowL (critique) was not served');
    for (const need of ['flowJ_tactical_polish', 'flowK_multi_lens_audit']) {
        if (!seen['flowL_design_critique'].includes(need)) {
            throw new Error(`loop-complete must propagate ${need} so flowL (critique) sees it; got ` + JSON.stringify(seen['flowL_design_critique']));
        }
    }
    console.log('lane-loop-prereq-propagation: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-loop-prereq-propagation.test.js.map