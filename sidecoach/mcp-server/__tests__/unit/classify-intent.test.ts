import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { definition, handler } from '../../src/tools/classify-intent';
import { loadAllRegistries } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const registries = loadAllRegistries(silentLogger());
const deps: any = { logger: silentLogger(), registries, signal: new AbortController().signal };

export async function run(): Promise<void> {
  await test('definition is named sidecoach_classify_intent', () => {
    assert.strictEqual(definition.name, 'sidecoach_classify_intent');
  });

  await test('a confident lane phrase ROUTEs with a winning label', async () => {
    const r = await handler({ prompt: 'make the landing page production-ready' } as any, deps);
    const d = (r.data as any).decision;
    assert.strictEqual(d.outcome, 'ROUTE');
    assert.strictEqual(d.winningLane, 'lane_ship');
    assert.ok((r.data as any).winningLabel && (r.data as any).winningLabel.length > 0);
  });

  await test('an explicit verb yields VERB', async () => {
    const r = await handler({ prompt: 'audit this and make it production-ready' } as any, deps);
    assert.strictEqual((r.data as any).decision.outcome, 'VERB');
    assert.strictEqual((r.data as any).decision.verbMatch, 'audit');
  });

  await test('an eligible natural prompt returns NUDGE_ELIGIBLE with nudge text', async () => {
    const r = await handler({ prompt: 'restyle the navbar' } as any, deps);
    assert.strictEqual((r.data as any).decision.outcome, 'NUDGE_ELIGIBLE');
    assert.ok((r.data as any).nudge && (r.data as any).nudge.length > 0);
  });

  await test('classify_intent never opens the cooldown state file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4d-cooldown-'));
    const cooldown = path.join(dir, '.sidecoach-intent-cooldown');
    const prev = process.env.SIDECOACH_INTENT_COOLDOWN_FILE;
    process.env.SIDECOACH_INTENT_COOLDOWN_FILE = cooldown;
    try {
      await handler({ prompt: 'restyle the navbar' } as any, deps);
      assert.strictEqual(fs.existsSync(cooldown), false, 'MCP must not touch cooldown state');
    } finally {
      if (prev === undefined) delete process.env.SIDECOACH_INTENT_COOLDOWN_FILE;
      else process.env.SIDECOACH_INTENT_COOLDOWN_FILE = prev;
    }
  });

  await test('a null lane registry throws DOWNSTREAM_UNAVAILABLE', async () => {
    const depsNoLanes: any = { logger: silentLogger(), registries: { ...registries, lanes: null }, signal: new AbortController().signal };
    let threw = false;
    try { await handler({ prompt: 'anything' } as any, depsNoLanes); } catch (e) { threw = /DOWNSTREAM_UNAVAILABLE|lane registry/.test(String(e)); }
    assert.strictEqual(threw, true);
  });
}
