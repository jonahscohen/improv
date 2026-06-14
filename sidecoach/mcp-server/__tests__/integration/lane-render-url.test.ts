// sidecoach_lane must accept an optional renderUrl (start-only), validate it as an
// http/https/file/data URL, and thread it through engine.startLane onto the checkpoint
// so the browser-backed rules can activate. Omitting it leaves renderUrl undefined.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { handler } from '../../src/tools/lane';
import { LaneInput } from '../../src/schemas';
import { LaneCheckpointStore } from '../../../dist/lane-checkpoint-store';
import { test, assert, finalize } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const deps = (): any => ({
  logger: silentLogger(),
  registries: { lanes: null, intent: null, verbs: null, modes: null, flows: [], cheatsheet: null },
  signal: new AbortController().signal,
});

export async function run(): Promise<void> {
  await test('schema accepts a valid renderUrl and rejects a non-URL', () => {
    const ok = LaneInput.safeParse({ operation: 'start', laneId: 'lane_build', startRequestId: 's1', renderUrl: 'data:text/html,test' });
    assert.strictEqual(ok.success, true);
    assert.strictEqual((ok as any).data.renderUrl, 'data:text/html,test');

    const okHttp = LaneInput.safeParse({ operation: 'start', laneId: 'lane_build', startRequestId: 's2', renderUrl: 'https://example.com/p' });
    assert.strictEqual(okHttp.success, true);

    const bad = LaneInput.safeParse({ operation: 'start', laneId: 'lane_build', startRequestId: 's3', renderUrl: 'not a url' });
    assert.strictEqual(bad.success, false);
  });

  await test('start threads renderUrl onto the checkpoint; omitting it leaves it undefined', async () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-ru-'));
    const url = 'data:text/html,' + encodeURIComponent('<main><p style="line-height:20px">t</p></main>');
    const r = await handler({ operation: 'start', laneId: 'lane_build', target: 'a free-text target', projectPath: project, startRequestId: 'ru-1', renderUrl: url } as any, deps());
    const cpId = (r.data as any).result.checkpointId;
    const cp = new LaneCheckpointStore(project).read(cpId);
    assert.strictEqual(cp.renderUrl, url);

    const project2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-ru2-'));
    const r2 = await handler({ operation: 'start', laneId: 'lane_build', target: 'a free-text target', projectPath: project2, startRequestId: 'ru-2' } as any, deps());
    const cp2 = new LaneCheckpointStore(project2).read((r2.data as any).result.checkpointId);
    assert.strictEqual(cp2.renderUrl, undefined);
  });
}

if (require.main === module) {
  run().then(() => finalize()).catch((e) => { console.error(e); process.exit(1); });
}
