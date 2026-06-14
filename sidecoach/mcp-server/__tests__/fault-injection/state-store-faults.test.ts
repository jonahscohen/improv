// Fault-injection tests for the state-store tools. Forces the store into
// every error state we can drive at the tool surface.

import { createLogger } from '../../src/logger';
import { TOOLS } from '../../src/tools';
import { SidecoachToolError } from '../../src/errors';
import { resetSharedStore, getSharedStore, STATE_MAX_ENTRIES } from '../../src/state-store';
import type { RegistryBundle } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger() {
  return createLogger({ level: 'error', write: () => undefined });
}

const NULL_REG: RegistryBundle = {
  verbs: null,
  modes: null,
  flows: [],
  cheatsheet: null,
  lanes: null,
  intent: null,
};

function deps() {
  return { logger: silentLogger(), registries: NULL_REG };
}

function pickHandler(name: string) {
  const t = TOOLS.find((tool) => tool.definition.name === name);
  if (!t) throw new Error(`tool ${name} not registered`);
  return t.handler;
}

export async function run(): Promise<void> {
  await test('state_set raises VALIDATOR_FAILURE when store at TOO_MANY_ENTRIES cap', async () => {
    resetSharedStore();
    const store = getSharedStore();
    for (let i = 0; i < STATE_MAX_ENTRIES; i++) {
      store.set(`k${i}`, 'v');
    }
    const h = pickHandler('sidecoach_state_set');
    try {
      await h({ key: 'overflow', value: 'v' }, deps());
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(err instanceof SidecoachToolError);
      assert.strictEqual((err as SidecoachToolError).code, 'VALIDATOR_FAILURE');
    } finally {
      resetSharedStore();
    }
  });

  await test('state_set INVALID_TTL surfaces as INVALID_INPUT from handler', async () => {
    resetSharedStore();
    const h = pickHandler('sidecoach_state_set');
    // We bypass the Zod schema (which would reject TTL=0 at the protocol
    // level) by calling the handler directly with a value the store will
    // reject. This validates the store-error -> tool-error mapping.
    try {
      await h({ key: 'k', value: 'v', ttlMs: 0 }, deps());
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(err instanceof SidecoachToolError);
      assert.strictEqual((err as SidecoachToolError).code, 'INVALID_INPUT');
    } finally {
      resetSharedStore();
    }
  });

  await test('state_get on key whose TTL just expired returns null', async () => {
    resetSharedStore();
    const store = getSharedStore();
    // Set with 1ms TTL via direct store call (Zod schema requires >=1).
    store.set('soon', 'gone', 1);
    // Wait a small real interval so the clock advances past expiry.
    await new Promise((resolve) => setTimeout(resolve, 25));
    const h = pickHandler('sidecoach_state_get');
    const r = await h({ key: 'soon' }, deps());
    assert.strictEqual((r.data as any).value, null);
    assert.strictEqual(store.size(), 0, 'expired entry should have been swept');
    resetSharedStore();
  });

  await test('state_list_keys after total wipe returns empty', async () => {
    resetSharedStore();
    const store = getSharedStore();
    store.set('a', 'v');
    store.set('b', 'v');
    store.set('c', 'v');
    store.reset();
    const h = pickHandler('sidecoach_state_list_keys');
    const r = await h({}, deps());
    assert.strictEqual((r.data as any).keys.length, 0);
    assert.strictEqual((r.data as any).totalMatches, 0);
  });

  await test('state_list_keys with oversize prefix raises INVALID_INPUT', async () => {
    resetSharedStore();
    const h = pickHandler('sidecoach_state_list_keys');
    const big = 'x'.repeat(4097);
    try {
      await h({ prefix: big }, deps());
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(err instanceof SidecoachToolError);
      assert.strictEqual((err as SidecoachToolError).code, 'INVALID_INPUT');
    }
  });
}
