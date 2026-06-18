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
// sidecoach/src/__tests__/lane-runner-status-list.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const lane_runner_1 = require("../lane-runner");
function deps(proj) {
    let n = 0, t = 0;
    return { store: new lane_checkpoint_store_1.LaneCheckpointStore(proj),
        runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
        now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}` };
}
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-stat-'));
    const d = deps(proj);
    const a = await (0, lane_runner_1.startLane)('lane_build', 'hero', { projectPath: proj }, 'req-a', d);
    const b = await (0, lane_runner_1.startLane)('lane_ship', 'site', { projectPath: proj }, 'req-b', d);
    await (0, lane_runner_1.advanceLane)(proj, b.checkpointId, { action: 'stop', expectedRevision: b.revision, reason: 'x' }, d); // close b
    const st = (0, lane_runner_1.laneStatus)(proj, a.checkpointId, d);
    if (st.laneId !== 'lane_build' || st.lifecycle !== 'in_progress')
        throw new Error('status wrong');
    if (st.totalSteps !== 3 || st.currentVerb !== 'shape')
        throw new Error('status step info wrong');
    // default: only active (in_progress/interrupted) lanes
    const active = (0, lane_runner_1.listLanes)(proj, d);
    if (active.length !== 1 || active[0].checkpointId !== a.checkpointId)
        throw new Error('default listLanes shows only active');
    // all: includes the closed one
    const all = (0, lane_runner_1.listLanes)(proj, d, { all: true });
    if (all.length !== 2)
        throw new Error('listLanes({all:true}) includes closed');
    console.log('lane-runner-status-list: OK');
}
run();
//# sourceMappingURL=lane-runner-status-list.test.js.map