import { definition, handler } from '../../src/tools/lane';
import { SidecoachToolError } from '../../src/errors';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const registries: any = { verbs: null, modes: null, flows: [], cheatsheet: null, lanes: null, intent: null };

export async function run(): Promise<void> {
  await test('definition is named sidecoach_lane', () => {
    assert.strictEqual(definition.name, 'sidecoach_lane');
  });

  await test('an already-expired response deadline rejects before touching the engine', async () => {
    const ac = new AbortController();
    ac.abort();
    const deps: any = { logger: silentLogger(), registries, signal: ac.signal };
    let threw = false;
    try {
      await handler({ operation: 'list' } as any, deps);
    } catch (e) {
      threw = /TIMEOUT|deadline exceeded/.test(String(e));
    }
    assert.strictEqual(threw, true);
  });

  await test('handler requires caller-supplied startRequestId before touching engine', async () => {
    const deps: any = { logger: silentLogger(), registries, signal: new AbortController().signal };
    let threw = false;
    try {
      await handler({ operation: 'start', laneId: 'lane_build' } as any, deps);
    } catch (e) {
      threw = e instanceof SidecoachToolError && e.code === 'INVALID_INPUT';
    }
    assert.strictEqual(threw, true);
  });

  await test('handler requires report for complete and reason for skip', async () => {
    const deps: any = { logger: silentLogger(), registries, signal: new AbortController().signal };
    for (const input of [
      { operation: 'advance', checkpointId: 'cp1', action: 'complete', expectedRevision: 0 },
      { operation: 'advance', checkpointId: 'cp1', action: 'skip', expectedRevision: 0 },
    ]) {
      let threw = false;
      try {
        await handler(input as any, deps);
      } catch (e) {
        threw = e instanceof SidecoachToolError && e.code === 'INVALID_INPUT';
      }
      assert.strictEqual(threw, true);
    }
  });
}
