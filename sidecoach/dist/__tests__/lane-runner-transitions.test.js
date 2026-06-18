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
// sidecoach/src/__tests__/lane-runner-transitions.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const lane_runner_1 = require("../lane-runner");
function deps(proj) {
    let n = 0, t = 0, calls = 0;
    const d = { store: new lane_checkpoint_store_1.LaneCheckpointStore(proj),
        runFlow: async (flowId) => { calls++; return { flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [`g:${flowId}`], checklist: [] }; },
        now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
    d.calls = () => calls;
    return d;
}
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-trans-'));
    const d = deps(proj);
    const start = await (0, lane_runner_1.startLane)('lane_build', 'hero', { projectPath: proj }, 'req-1', d);
    const callsAfterStart = d.calls();
    // retry re-serves the SAME step from cache (no handler re-run), report optional but recorded
    const rt = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'retry', expectedRevision: start.revision, reason: 'redo' }, d);
    if (rt.currentVerb !== 'shape')
        throw new Error('retry stays on shape');
    if (d.calls() !== callsAfterStart)
        throw new Error('retry must NOT re-run handlers (served cache)');
    // interrupt -> interrupted, no handler re-run, returns paused state
    const ir = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'interrupt', expectedRevision: rt.revision }, d);
    if (ir.lifecycle !== 'interrupted' || ir.currentVerb !== undefined)
        throw new Error('interrupt -> interrupted/paused');
    if (d.calls() !== callsAfterStart)
        throw new Error('interrupt must not re-run handlers');
    // any non-resume action while interrupted is rejected
    let threw = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'retry', expectedRevision: ir.revision }, d);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('only resume valid while interrupted');
    // resume -> in_progress, re-serves shape from cache
    const rr = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'resume', expectedRevision: ir.revision }, d);
    if (rr.lifecycle !== 'in_progress' || rr.currentVerb !== 'shape')
        throw new Error('resume -> in_progress on shape');
    if (d.calls() !== callsAfterStart)
        throw new Error('resume must not re-run handlers');
    // stop -> closed/stopped, audited
    const st = await (0, lane_runner_1.advanceLane)(proj, start.checkpointId, { action: 'stop', expectedRevision: rr.revision, reason: 'parking it' }, d);
    if (st.lifecycle !== 'closed' || st.outcome !== 'stopped')
        throw new Error('stop -> closed/stopped');
    const state = (0, lane_runner_1.laneStatus)(proj, start.checkpointId, d);
    if (!state.audit.some((a) => a.action === 'stop' && a.reason === 'parking it'))
        throw new Error('stop must be audited with reason');
    // P1-2: an INTERRUPTED lane + a DUPLICATE reportId + a non-resume action must
    // REJECT (resume-only), not silently no-op via the dedup short-circuit. (Same
    // bug class as dup-on-closed; the dedup short-circuit must fire only on an
    // in_progress lane.)
    const rep = (verb) => ({ stepId: verb, iteration: 0, reportId: `r2:${verb}`, verb, summary: 's', evidence: [{ kind: 'note', detail: 'x' }] });
    const l2 = await (0, lane_runner_1.startLane)('lane_build', 'hero2', { projectPath: proj }, 'req-2', d);
    const c2 = await (0, lane_runner_1.advanceLane)(proj, l2.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: l2.revision }, d); // craft; r2:shape now seen
    const i2 = await (0, lane_runner_1.advanceLane)(proj, l2.checkpointId, { action: 'interrupt', expectedRevision: c2.revision }, d); // interrupted
    let threw2 = false;
    try {
        await (0, lane_runner_1.advanceLane)(proj, l2.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: i2.revision }, d);
    }
    catch {
        threw2 = true;
    }
    if (!threw2)
        throw new Error('interrupted lane + duplicate reportId + complete must reject (resume-only), not no-op');
    console.log('lane-runner-transitions: OK');
}
run();
//# sourceMappingURL=lane-runner-transitions.test.js.map