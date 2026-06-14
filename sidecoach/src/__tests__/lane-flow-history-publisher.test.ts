import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FlowHistory, FlowHistoryEntry, getFlowHistory, resetFlowHistorySingleton } from '../flow-history';
import { LaneFlowHistoryPublisher } from '../lane-flow-history-publisher';

function entry(message: string): FlowHistoryEntry {
  return {
    flowId: 'lane:lane_build:craft',
    flowName: 'Lane lane_build: craft',
    status: 'success',
    message,
    guidance: ['g'],
    checklist: [{ id: 'c', label: 'check', required: true, completed: false }],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-home-'));
  process.env.HOME = home;
  const project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-project-')));
  const history = new FlowHistory(project);
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
    new FlowHistory(project).upsertLaneFlow('lane-cp1:polish:0:flow-history', 9, entry('must fail'), now);
  } catch {
    strictSaveFailed = true;
  }
  assert(strictSaveFailed, 'lane conditional upsert must throw when the durable save fails');
  process.env.HOME = home;

  const publisherProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-publisher-project-')));
  const publisher = new LaneFlowHistoryPublisher(publisherProject);
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
  const publisherHistory = new FlowHistory(publisherProject);
  assert(publisherHistory.getFlowCount('lane:lane_build:shape') === 1, 'publisher must persist one idempotent run in the project session');

  // P1-1: a long-lived ordinary instance captured BEFORE a lane publish must not clobber
  // the committed lane entry when it later records its own flow. recordFlow must reload
  // fresh from disk before it mutates and saves, not write back from its stale snapshot.
  const clobberProject = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-flow-history-clobber-')));
  const staleOrchestrator = new FlowHistory(clobberProject); // captures an empty snapshot now
  const clobberPublisher = new LaneFlowHistoryPublisher(clobberProject);
  const laneWrite = await clobberPublisher.upsert('lane-cp9:craft:0:flow-history', 5, entry('lane-committed'), now);
  assert(laneWrite.status === 'written', 'publisher must write the lane entry before the stale recordFlow');
  staleOrchestrator.recordFlow({
    flowId: 'flowZ_unrelated',
    flowName: 'Unrelated',
    status: 'success',
    message: 'orchestrator-write',
  });
  const afterClobber = new FlowHistory(clobberProject);
  assert(afterClobber.getLatestRun('lane:lane_build:craft')?.laneLogicalKey === 'lane-cp9:craft:0:flow-history',
    'a later stale-instance recordFlow must not clobber the committed lane entry');
  assert(afterClobber.getFlowCount('flowZ_unrelated') === 1, 'the stale instance recordFlow must still persist its own run');

  const ordinary = new FlowHistory('ordinary-session');
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
  resetFlowHistorySingleton();
  getFlowHistory().recordFlow({
    flowId: 'flowK_multi_lens_audit',
    flowName: 'Multi-Lens Audit',
    status: 'success',
    message: 'singleton',
  });
  resetFlowHistorySingleton();
  assert(getFlowHistory().getFlowCount('flowK_multi_lens_audit') === 1, 'existing singleton API must still reload persisted history');
  resetFlowHistorySingleton();

  console.log('lane-flow-history-publisher conditional-upsert: OK');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
