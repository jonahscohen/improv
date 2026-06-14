// Round-trip the sidecoach_lane tool against a real engine on a temp project:
// start a sequence lane -> status -> list. Uses lane_build (executionKind=sequence)
// to avoid the loop convergence preflight.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { handler } from '../../src/tools/lane';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}

export async function run(): Promise<void> {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'p4d-lane-proj-'));
  const deps: any = {
    logger: silentLogger(),
    registries: { lanes: null, intent: null, verbs: null, modes: null, flows: [], cheatsheet: null },
    signal: new AbortController().signal,
  };

  let checkpointId = '';
  let revision = 0;
  let servedVerb = '';
  let nextServedVerb = '';

  await test('start a sequence lane returns a checkpoint + first step', async () => {
    const r = await handler(
      { operation: 'start', laneId: 'lane_build', target: 'the landing page', projectPath: project, startRequestId: 'e2e-1' } as any,
      deps,
    );
    const res = (r.data as any).result;
    assert.strictEqual(res.laneId, 'lane_build');
    assert.strictEqual(res.executionKind, 'sequence');
    assert.ok(res.checkpointId && res.checkpointId.length > 0);
    assert.ok(res.currentVerb, 'start must serve the first step');
    checkpointId = res.checkpointId;
    revision = res.revision;
    servedVerb = res.currentVerb;
  });

  await test('advance completes the served step with a valid report and serves the next step', async () => {
    const report = {
      stepId: servedVerb,
      iteration: 0,
      reportId: 'e2e-report-1',
      verb: servedVerb,
      summary: 'completed by MCP e2e',
      evidence: [{ kind: 'note', detail: 'e2e evidence' }],
    };
    const r = await handler(
      { operation: 'advance', checkpointId, projectPath: project, action: 'complete', expectedRevision: revision, report } as any,
      deps,
    );
    const res = (r.data as any).result;
    assert.strictEqual(res.checkpointId, checkpointId);
    assert.ok(res.currentVerb, 'advance must serve the next step');
    assert.notStrictEqual(res.currentVerb, servedVerb);
    nextServedVerb = res.currentVerb;
    revision = res.revision;
  });

  await test('status reads the checkpoint back', async () => {
    const r = await handler({ operation: 'status', checkpointId, projectPath: project } as any, deps);
    const res = (r.data as any).result;
    assert.strictEqual(res.checkpointId, checkpointId);
    assert.strictEqual(res.laneId, 'lane_build');
    assert.strictEqual(res.lifecycle, 'in_progress');
    assert.strictEqual(res.currentVerb, nextServedVerb);
  });

  await test('list includes the started lane', async () => {
    const r = await handler({ operation: 'list', projectPath: project } as any, deps);
    const list = (r.data as any).lanes;
    assert.ok(Array.isArray(list) && list.some((l: any) => l.checkpointId === checkpointId));
  });

  await test('start is idempotent on the same startRequestId', async () => {
    const r = await handler(
      { operation: 'start', laneId: 'lane_build', target: 'the landing page', projectPath: project, startRequestId: 'e2e-1' } as any,
      deps,
    );
    assert.strictEqual((r.data as any).result.checkpointId, checkpointId);
  });
}
