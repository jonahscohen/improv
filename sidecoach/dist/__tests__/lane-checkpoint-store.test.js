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
// sidecoach/src/__tests__/lane-checkpoint-store.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
function fresh() {
    return {
        schemaVersion: 2, checkpointId: 'lane-abc123', laneId: 'lane_build', target: 'hero',
        executionKind: 'sequence', lifecycle: 'in_progress', outcome: undefined,
        cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
        stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId: 'req1',
        seenReportIds: [], fencingCounter: 0, lease: null, sideEffectOutbox: [], stepGateStatuses: {},
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
}
function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-ckpt-'));
    const store = new lane_checkpoint_store_1.LaneCheckpointStore(proj);
    store.write(fresh());
    if (store.read('lane-abc123').laneId !== 'lane_build')
        throw new Error('round-trip failed');
    if (store.findByStartRequestId('req1').checkpointId !== 'lane-abc123')
        throw new Error('findByStartRequestId failed');
    if (store.findByStartRequestId('nope') !== null)
        throw new Error('unknown req -> null');
    if (store.list().length !== 1)
        throw new Error('list failed');
    // checkpoint-id validation: path-traversal / illegal chars rejected BEFORE fs access
    for (const bad of ['../evil', 'a/b', 'a*', '..']) {
        let threw = false;
        try {
            store.read(bad);
        }
        catch {
            threw = true;
        }
        if (!threw)
            throw new Error(`illegal id "${bad}" must be rejected`);
    }
    let threw = false;
    try {
        store.write({ ...fresh(), schemaVersion: 3 });
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('schemaVersion 3 rejected (writes only v2)');
    // P2-1: when a CLOSED and an ACTIVE checkpoint share a startRequestId (a closed
    // run + a closed-restart), findByStartRequestId must prefer the ACTIVE one -
    // even when the closed one is more recently updated (so list() returns it
    // first). Otherwise startLane's dedup could resume/alias the wrong (closed) run.
    const proj2 = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-ckpt2-'));
    const store2 = new lane_checkpoint_store_1.LaneCheckpointStore(proj2);
    store2.write({ ...fresh(), checkpointId: 'lane-active', lifecycle: 'in_progress', startRequestId: 'shared', updatedAt: '2026-01-01T00:00:00.000Z' });
    store2.write({ ...fresh(), checkpointId: 'lane-closed', lifecycle: 'closed', outcome: 'completed', startRequestId: 'shared', updatedAt: '2026-09-09T00:00:00.000Z' }); // more recent
    const found = store2.findByStartRequestId('shared');
    if (!found || found.checkpointId !== 'lane-active')
        throw new Error('findByStartRequestId must prefer the ACTIVE checkpoint over a more-recent closed one');
    // when only a closed match exists, it is returned (closed-restart still finds it)
    const store3 = new lane_checkpoint_store_1.LaneCheckpointStore(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-ckpt3-')));
    store3.write({ ...fresh(), checkpointId: 'lane-only-closed', lifecycle: 'closed', outcome: 'stopped', startRequestId: 'solo' });
    if (store3.findByStartRequestId('solo')?.checkpointId !== 'lane-only-closed')
        throw new Error('a lone closed match must still be returned');
    console.log('lane-checkpoint-store: OK');
}
run();
//# sourceMappingURL=lane-checkpoint-store.test.js.map