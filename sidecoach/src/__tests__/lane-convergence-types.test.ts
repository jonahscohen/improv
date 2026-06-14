// Task 1: convergence sub-state types + checkpoint round-trip (additive, schema v2).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, LaneCheckpoint } from '../lane-checkpoint-store';
import type { ConvergenceState } from '../lane-types';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-types-'));
  const store = new LaneCheckpointStore(proj);

  const conv: ConvergenceState = {
    outcome: 'running', iteration: 0, signatures: [], consecutiveNoProgress: 0,
    limits: { maxIterations: 10, maxNoProgress: 3 },
    history: [], findings: [], validatorErrors: [], advisoryRuns: [],
    runCoverage: { discoveredFiles: [], inspectedFiles: [], skippedFiles: [], unreadableFiles: [], unsupportedSourceKinds: [],
      unsupportedFiles: [], measuredScope: [], unverifiedScope: [], notApplicableRuleIds: [] },
  };
  const cp: LaneCheckpoint = {
    schemaVersion: 2, checkpointId: 'cp-conv', laneId: 'lane_converge', target: 'project',
    executionKind: 'loop', lifecycle: 'in_progress', outcome: undefined,
    cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
    stepReports: [], audit: [], servedSteps: {}, revision: 1, startRequestId: 'req',
    seenReportIds: [], fencingCounter: 1, sideEffectOutbox: [], stepGateStatuses: {},
    lease: null, convergence: conv, createdAt: 't', updatedAt: 't',
  };
  store.write(cp);
  const back = store.read('cp-conv');
  if (!back.convergence) throw new Error('convergence sub-state must round-trip');
  if (back.convergence.outcome !== 'running') throw new Error('convergence.outcome lost');
  if (back.convergence.limits.maxNoProgress !== 3) throw new Error('limits lost');
  if (!back.convergence.runCoverage || !Array.isArray(back.convergence.runCoverage.unsupportedFiles)) throw new Error('run coverage identities lost');

  // Regression: a SEQUENCE checkpoint with NO convergence still reads (additive field).
  const seq: LaneCheckpoint = { ...cp, checkpointId: 'cp-seq', laneId: 'lane_build', executionKind: 'sequence', convergence: undefined };
  store.write(seq);
  const seqBack = store.read('cp-seq');
  if (seqBack.convergence !== undefined) throw new Error('sequence checkpoint must have no convergence');

  console.log('lane-convergence-types: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
