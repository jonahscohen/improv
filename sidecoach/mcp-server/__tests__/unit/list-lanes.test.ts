import { definition, handler } from '../../src/tools/list-lanes';
import { loadAllRegistries } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const registries = loadAllRegistries(silentLogger());

export async function run(): Promise<void> {
  await test('definition is named sidecoach_list_lanes', () => {
    assert.strictEqual(definition.name, 'sidecoach_list_lanes');
  });

  await test('returns the registry lanes with lane + label', async () => {
    const deps: any = { logger: silentLogger(), registries, signal: new AbortController().signal };
    const r = await handler({} as any, deps);
    const d = r.data as any;
    assert.ok(d.count >= 1);
    assert.ok(d.lanes.every((l: any) => typeof l.lane === 'string' && typeof l.label === 'string'));
    assert.ok(d.lanes.some((l: any) => l.lane === 'lane_build'));
  });

  await test('a null lane registry throws DOWNSTREAM_UNAVAILABLE', async () => {
    const deps: any = { logger: silentLogger(), registries: { ...registries, lanes: null }, signal: new AbortController().signal };
    let threw = false;
    try { await handler({} as any, deps); } catch (e) { threw = /DOWNSTREAM_UNAVAILABLE|lane registry/.test(String(e)); }
    assert.strictEqual(threw, true);
  });
}
