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
// sidecoach/src/__tests__/lane-checkpoint-migration.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
function run() {
    const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-mig-')));
    const dir = path.join(proj, '.claude', 'lane-checkpoints');
    fs.mkdirSync(dir, { recursive: true });
    const v1 = { schemaVersion: 1, checkpointId: 'lane-legacy', laneId: 'lane_build', target: 't',
        executionKind: 'sequence', lifecycle: 'in_progress', cursor: 0, iteration: 0,
        completedStepIds: [], skippedStepIds: [], completedFlowIds: [], stepReports: [], audit: [],
        servedSteps: {}, revision: 3, startRequestId: 'r', seenReportIds: [],
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    fs.writeFileSync(path.join(dir, 'lane-legacy.json'), JSON.stringify(v1));
    const store = new lane_checkpoint_store_1.LaneCheckpointStore(proj);
    const cp = store.read('lane-legacy');
    if (cp.schemaVersion !== 2)
        throw new Error('read must migrate v1 to v2');
    if (cp.fencingCounter !== 0)
        throw new Error('migration seeds fencingCounter 0');
    if (cp.lease !== null)
        throw new Error('migration seeds lease null');
    if (!Array.isArray(cp.sideEffectOutbox) || cp.sideEffectOutbox.length !== 0)
        throw new Error('migration seeds sideEffectOutbox []');
    if (Object.keys(cp.stepGateStatuses).length !== 0)
        throw new Error('migration seeds stepGateStatuses {}');
    if (cp.revision !== 3)
        throw new Error('migration preserves state');
    store.write(cp);
    const back = store.read('lane-legacy');
    if (back.schemaVersion !== 2 || back.fencingCounter !== 0)
        throw new Error('v2 round-trip failed');
    console.log('lane-checkpoint-migration: OK');
}
run();
//# sourceMappingURL=lane-checkpoint-migration.test.js.map