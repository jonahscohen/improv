// Unit tests for the lane + intent registry loaders (P4d).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadLaneRegistry,
  loadIntentRegistry,
  resolveLanesJsonPath,
  resolveIntentJsonPath,
} from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}

export async function run(): Promise<void> {
  await test('resolveLanesJsonPath points at claude/hooks/sidecoach-lanes.json', () => {
    assert.ok(resolveLanesJsonPath().endsWith(path.join('claude', 'hooks', 'sidecoach-lanes.json')));
  });

  await test('resolveIntentJsonPath points at claude/hooks/sidecoach-intent.json', () => {
    assert.ok(resolveIntentJsonPath().endsWith(path.join('claude', 'hooks', 'sidecoach-intent.json')));
  });

  await test('loadLaneRegistry loads the real registry (lanes + scoring present)', () => {
    const b = loadLaneRegistry(silentLogger());
    assert.ok(b, 'expected a non-null lane bundle');
    assert.ok(Array.isArray(b!.registry.lanes) && b!.registry.lanes.length >= 1);
    assert.ok(b!.registry.scoring && typeof b!.registry.scoring.route_floor === 'number');
    assert.ok(b!.sourcePath.endsWith('sidecoach-lanes.json'));
  });

  await test('loadIntentRegistry loads the advisory registry (has nudge + actions)', () => {
    const intent = loadIntentRegistry(silentLogger());
    assert.ok(intent, 'expected a non-null intent registry');
    assert.ok(typeof intent.nudge === 'string' && intent.nudge.length > 0);
    assert.ok(Array.isArray(intent.actions));
  });

  await test('loadRegistry rejects a structure-invalid file (no silent pass)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4d-lanes-'));
    const bad = path.join(dir, 'bad-lanes.json');
    fs.writeFileSync(bad, JSON.stringify({ lanes: [{ lane: 'x', label: 'x', lexicon: [] }] }));
    const { loadRegistry } = require('../../src/keyword-resolver');
    let threw = false;
    try { loadRegistry(bad); } catch { threw = true; }
    assert.strictEqual(threw, true, 'structure-invalid registry must throw, not silently pass');
  });

  await test('loadIntentRegistry returns an object for the present file', () => {
    const intent = loadIntentRegistry(silentLogger());
    assert.strictEqual(typeof intent, 'object');
  });
}
