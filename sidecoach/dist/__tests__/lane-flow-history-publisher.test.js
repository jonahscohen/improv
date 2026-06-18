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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const flow_history_1 = require("../flow-history");
const lane_flow_history_publisher_1 = require("../lane-flow-history-publisher");
function entry(message) {
    return {
        flowId: 'lane:lane_build:craft',
        flowName: 'Lane lane_build: craft',
        status: 'success',
        message,
        guidance: ['g'],
        checklist: [{ id: 'c', label: 'check', required: true, completed: false }],
    };
}
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
async function run() {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-home-'));
    process.env.HOME = home;
    const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-project-')));
    const history = new flow_history_1.FlowHistory(project);
    const logicalKey = 'lane-cp1:craft:0:flow-history';
    let tick = 0;
    const now = () => new Date(++tick * 1000).toISOString();
    const first = history.upsertLaneFlow(logicalKey, 7, entry('first'), now);
    assert(first.status === 'written', 'first token must write');
    assert(history.getFlowCount('lane:lane_build:craft') === 1, 'first write must append one tagged run');
    const replay = history.upsertLaneFlow(logicalKey, 7, entry('same-token replay'), now);
    assert(replay.status === 'noop', 'same token must be a no-op');
    assert(history.getFlowCount('lane:lane_build:craft') === 1, 'same token must not append a duplicate');
    assert(history.getLatestRun('lane:lane_build:craft')?.message === 'first', 'same token must preserve accepted payload');
    const stale = history.upsertLaneFlow(logicalKey, 6, entry('stale'), now);
    assert(stale.status === 'rejected', 'lower token must be rejected');
    assert(history.getFlowCount('lane:lane_build:craft') === 1, 'lower token must not append');
    assert(history.getLatestRun('lane:lane_build:craft')?.message === 'first', 'lower token must not replace accepted payload');
    const replacement = history.upsertLaneFlow(logicalKey, 8, entry('replacement'), now);
    assert(replacement.status === 'written', 'higher token must write');
    assert(history.getFlowCount('lane:lane_build:craft') === 1, 'higher token must replace instead of append');
    const accepted = history.getLatestRun('lane:lane_build:craft');
    assert(accepted?.message === 'replacement', 'higher token payload must supersede');
    assert(accepted?.laneLogicalKey === logicalKey, 'accepted run must persist the lane logical key');
    assert(accepted?.fencingToken === 8, 'accepted run must persist the highest fencing token');
    const blockedHome = path.join(home, 'blocked-home');
    fs.writeFileSync(blockedHome, 'not a directory');
    process.env.HOME = blockedHome;
    let strictSaveFailed = false;
    try {
        new flow_history_1.FlowHistory(project).upsertLaneFlow('lane-cp1:polish:0:flow-history', 9, entry('must fail'), now);
    }
    catch {
        strictSaveFailed = true;
    }
    assert(strictSaveFailed, 'lane conditional upsert must throw when the durable save fails');
    process.env.HOME = home;
    const publisherProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-publisher-project-')));
    const publisher = new lane_flow_history_publisher_1.LaneFlowHistoryPublisher(publisherProject);
    const publisherKey = 'lane-cp2:shape:0:flow-history';
    const publisherFirst = await publisher.upsert(publisherKey, 11, {
        flowId: 'lane:lane_build:shape',
        flowName: 'Lane lane_build: shape',
        status: 'success',
        message: 'published',
    }, now);
    assert(publisherFirst.status === 'written', 'publisher must write the first accepted token');
    assert((await publisher.upsert(publisherKey, 11, entry('ignored'), now)).status === 'noop', 'publisher same-token replay must no-op');
    assert((await publisher.upsert(publisherKey, 10, entry('ignored'), now)).status === 'rejected', 'publisher lower token must reject');
    const publisherHistory = new flow_history_1.FlowHistory(publisherProject);
    assert(publisherHistory.getFlowCount('lane:lane_build:shape') === 1, 'publisher must persist one idempotent run in the project session');
    // P1-1: a long-lived ordinary instance captured BEFORE a lane publish must not clobber
    // the committed lane entry when it later records its own flow. recordFlow must reload
    // fresh from disk before it mutates and saves, not write back from its stale snapshot.
    const clobberProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-clobber-')));
    const staleOrchestrator = new flow_history_1.FlowHistory(clobberProject); // captures an empty snapshot now
    const clobberPublisher = new lane_flow_history_publisher_1.LaneFlowHistoryPublisher(clobberProject);
    const laneWrite = await clobberPublisher.upsert('lane-cp9:craft:0:flow-history', 5, entry('lane-committed'), now);
    assert(laneWrite.status === 'written', 'publisher must write the lane entry before the stale recordFlow');
    staleOrchestrator.recordFlow({
        flowId: 'flowZ_unrelated',
        flowName: 'Unrelated',
        status: 'success',
        message: 'orchestrator-write',
    });
    const afterClobber = new flow_history_1.FlowHistory(clobberProject);
    assert(afterClobber.getLatestRun('lane:lane_build:craft')?.laneLogicalKey === 'lane-cp9:craft:0:flow-history', 'a later stale-instance recordFlow must not clobber the committed lane entry');
    assert(afterClobber.getFlowCount('flowZ_unrelated') === 1, 'the stale instance recordFlow must still persist its own run');
    // P1-2: the 20-run presentation cap must NOT erase the fencing decision. Once the
    // tagged run is evicted, a stale same/lower token must still no-op/reject (the
    // accepted token persists in a separate index, not in the capped runs array).
    const capProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-cap-')));
    const capHistory = new flow_history_1.FlowHistory(capProject);
    const capKey = 'lane-cp10:craft:0:flow-history';
    assert(capHistory.upsertLaneFlow(capKey, 30, entry('tagged-token-30'), now).status === 'written', 'cap: first lane write must be accepted');
    for (let i = 0; i < 20; i++) {
        capHistory.recordFlow({ flowId: 'lane:lane_build:craft', flowName: 'Lane lane_build: craft', status: 'success', message: `evict-${i}` });
    }
    assert(new flow_history_1.FlowHistory(capProject).getFlowRuns('lane:lane_build:craft').every((r) => r.laneLogicalKey !== capKey), 'cap: 20 newer runs must have evicted the tagged run from the presentation array');
    const countAfterEvict = new flow_history_1.FlowHistory(capProject).getFlowCount('lane:lane_build:craft');
    assert(capHistory.upsertLaneFlow(capKey, 30, entry('replay-after-evict'), now).status === 'noop', 'cap: same token after eviction must still no-op');
    assert(capHistory.upsertLaneFlow(capKey, 29, entry('stale-after-evict'), now).status === 'rejected', 'cap: lower token after eviction must still reject');
    assert(new flow_history_1.FlowHistory(capProject).getFlowCount('lane:lane_build:craft') === countAfterEvict, 'cap: a no-op/rejected replay after eviction must not append');
    assert(capHistory.upsertLaneFlow(capKey, 31, entry('supersede-after-evict'), now).status === 'written', 'cap: a higher token after eviction must be accepted');
    // P1 migration: PRE-INDEX persisted data has a retained tagged run but NO laneFencing
    // entry. The fencing decision must derive the accepted token from the retained run so a
    // stale same/lower token cannot blindly overwrite it.
    const migHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-mig-home-'));
    process.env.HOME = migHome;
    const migProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-mig-')));
    const migKey = 'lane-cp11:craft:0:flow-history';
    // Seed a tagged run at token 30 through the real path, then STRIP laneFencing to simulate
    // data written before the index existed.
    new flow_history_1.FlowHistory(migProject).upsertLaneFlow(migKey, 30, entry('pre-index-30'), now);
    const migFile = path.join(migHome, '.claude', 'sidecoach-flow-history.json');
    const migData = JSON.parse(fs.readFileSync(migFile, 'utf-8'));
    delete migData[migProject].laneFencing;
    fs.writeFileSync(migFile, JSON.stringify(migData, null, 2), 'utf-8');
    assert(new flow_history_1.FlowHistory(migProject).upsertLaneFlow(migKey, 30, entry('mig-replay'), now).status === 'noop', 'migration: same token vs a pre-index retained run must no-op');
    assert(new flow_history_1.FlowHistory(migProject).upsertLaneFlow(migKey, 29, entry('mig-stale'), now).status === 'rejected', 'migration: lower token vs a pre-index retained run must reject');
    assert(new flow_history_1.FlowHistory(migProject).getLatestRun('lane:lane_build:craft')?.fencingToken === 30, 'migration: a rejected lower token must not overwrite the pre-index token-30 run');
    assert(new flow_history_1.FlowHistory(migProject).upsertLaneFlow(migKey, 31, entry('mig-supersede'), now).status === 'written', 'migration: a higher token vs a pre-index retained run must be accepted');
    process.env.HOME = home;
    // MINOR: setContext is a saving mutator and must also reload-before-mutate, else a stale
    // instance clobbers a concurrently-written lane entry from its construction-time snapshot.
    const ctxProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-ctx-')));
    const staleCtxInstance = new flow_history_1.FlowHistory(ctxProject); // captures an empty snapshot now
    await new lane_flow_history_publisher_1.LaneFlowHistoryPublisher(ctxProject).upsert('lane-cp12:craft:0:flow-history', 4, entry('ctx-lane'), now);
    staleCtxInstance.setContext('phase', 'verify');
    const afterCtx = new flow_history_1.FlowHistory(ctxProject);
    assert(afterCtx.getLatestRun('lane:lane_build:craft')?.laneLogicalKey === 'lane-cp12:craft:0:flow-history', 'setContext on a stale instance must not clobber the committed lane entry');
    assert(afterCtx.getContext('phase') === 'verify', 'setContext must still persist its own value');
    // P1 invariant (Codex sequence): the seeded fencing token must be PERSISTED, not just
    // derived in-memory, so a later eviction cannot resurrect a stale token. Pre-index
    // token-30 run, strip the index; same/lower decisions, then evict the run via the
    // 20-cap, then a stale token must STILL be rejected (the evicting recordFlow persisted
    // the backfilled index before the eviction).
    const invHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-inv-home-'));
    process.env.HOME = invHome;
    const invProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-inv-')));
    const invKey = 'lane-cp13:craft:0:flow-history';
    new flow_history_1.FlowHistory(invProject).upsertLaneFlow(invKey, 30, entry('inv-30'), now);
    const invFile = path.join(invHome, '.claude', 'sidecoach-flow-history.json');
    const invData = JSON.parse(fs.readFileSync(invFile, 'utf-8'));
    delete invData[invProject].laneFencing;
    fs.writeFileSync(invFile, JSON.stringify(invData, null, 2), 'utf-8');
    assert(new flow_history_1.FlowHistory(invProject).upsertLaneFlow(invKey, 30, entry('inv-replay'), now).status === 'noop', 'invariant: same token vs a pre-index run must no-op');
    assert(new flow_history_1.FlowHistory(invProject).upsertLaneFlow(invKey, 29, entry('inv-stale'), now).status === 'rejected', 'invariant: lower token vs a pre-index run must reject');
    const invEvictor = new flow_history_1.FlowHistory(invProject);
    for (let i = 0; i < 20; i++) {
        invEvictor.recordFlow({ flowId: 'lane:lane_build:craft', flowName: 'Lane lane_build: craft', status: 'success', message: `inv-evict-${i}` });
    }
    assert(new flow_history_1.FlowHistory(invProject).getFlowRuns('lane:lane_build:craft').every((r) => r.laneLogicalKey !== invKey), 'invariant: 20 newer runs must have evicted the tagged run');
    assert(new flow_history_1.FlowHistory(invProject).upsertLaneFlow(invKey, 29, entry('inv-stale-after-evict'), now).status === 'rejected', 'invariant: a stale token after eviction must STILL be rejected (durably-seeded index survived eviction)');
    process.env.HOME = home;
    // P1 invariant (eviction-before-any-upsert): with NO upsert between the pre-index run
    // and its eviction, the evicting recordFlow itself must have backfilled + persisted the
    // index, so a later stale token is rejected and a higher one accepted.
    const inv2Home = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-inv2-home-'));
    process.env.HOME = inv2Home;
    const inv2Project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-inv2-')));
    const inv2Key = 'lane-cp14:craft:0:flow-history';
    new flow_history_1.FlowHistory(inv2Project).upsertLaneFlow(inv2Key, 30, entry('inv2-30'), now);
    const inv2File = path.join(inv2Home, '.claude', 'sidecoach-flow-history.json');
    const inv2Data = JSON.parse(fs.readFileSync(inv2File, 'utf-8'));
    delete inv2Data[inv2Project].laneFencing;
    fs.writeFileSync(inv2File, JSON.stringify(inv2Data, null, 2), 'utf-8');
    const inv2Evictor = new flow_history_1.FlowHistory(inv2Project);
    for (let i = 0; i < 20; i++) {
        inv2Evictor.recordFlow({ flowId: 'lane:lane_build:craft', flowName: 'Lane lane_build: craft', status: 'success', message: `inv2-evict-${i}` });
    }
    assert(new flow_history_1.FlowHistory(inv2Project).getFlowRuns('lane:lane_build:craft').every((r) => r.laneLogicalKey !== inv2Key), 'invariant2: 20 newer runs must have evicted the tagged run with no upsert in between');
    assert(new flow_history_1.FlowHistory(inv2Project).upsertLaneFlow(inv2Key, 29, entry('inv2-stale'), now).status === 'rejected', 'invariant2: a stale token after eviction-without-upsert must be rejected');
    assert(new flow_history_1.FlowHistory(inv2Project).upsertLaneFlow(inv2Key, 31, entry('inv2-supersede'), now).status === 'written', 'invariant2: a higher token after eviction-without-upsert must be accepted');
    process.env.HOME = home;
    const ordinary = new flow_history_1.FlowHistory('ordinary-session');
    for (let i = 0; i < 21; i++) {
        ordinary.recordFlow({
            flowId: 'flowJ_tactical_polish',
            flowName: 'Tactical Polish',
            status: 'success',
            message: `ordinary-${i}`,
        });
    }
    assert(ordinary.hasFlowExecuted('flowJ_tactical_polish'), 'existing hasFlowExecuted API must still work');
    assert(ordinary.getFlowCount('flowJ_tactical_polish') === 20, 'ordinary recordFlow must preserve the 20-run cap');
    assert(ordinary.getFlowRuns('flowJ_tactical_polish')[0].message === 'ordinary-1', 'ordinary cap must discard only the oldest run');
    assert(ordinary.getFlowSequence().length === 1, 'existing getFlowSequence API must still return one latest entry per flow');
    process.env.SIDECOACH_SESSION_ID = 'singleton-session';
    (0, flow_history_1.resetFlowHistorySingleton)();
    (0, flow_history_1.getFlowHistory)().recordFlow({
        flowId: 'flowK_multi_lens_audit',
        flowName: 'Multi-Lens Audit',
        status: 'success',
        message: 'singleton',
    });
    (0, flow_history_1.resetFlowHistorySingleton)();
    assert((0, flow_history_1.getFlowHistory)().getFlowCount('flowK_multi_lens_audit') === 1, 'existing singleton API must still reload persisted history');
    (0, flow_history_1.resetFlowHistorySingleton)();
    console.log('lane-flow-history-publisher conditional-upsert: OK');
}
run().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=lane-flow-history-publisher.test.js.map