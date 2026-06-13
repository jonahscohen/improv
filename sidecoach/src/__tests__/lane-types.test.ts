// sidecoach/src/__tests__/lane-types.test.ts
import { makeStepReport, isClosed, LaneLifecycle } from '../lane-types';

function run() {
  const r = makeStepReport({ stepId: 'shape', iteration: 0, reportId: 'r1', verb: 'shape', summary: 'did it', evidence: [{ kind: 'note', detail: 'x' }] });
  if (r.evidence.length !== 1) throw new Error('evidence not preserved');
  const closed: LaneLifecycle = 'closed';
  if (!isClosed(closed)) throw new Error('closed must be terminal');
  if (isClosed('in_progress')) throw new Error('in_progress is not terminal');
  if (isClosed('interrupted')) throw new Error('interrupted is not terminal (resumable)');
  console.log('lane-types: OK');
}
run();
