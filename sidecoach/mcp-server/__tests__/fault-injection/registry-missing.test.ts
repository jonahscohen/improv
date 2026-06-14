// Fault injection: registries fail to load. The server should still come
// up; affected tools return DOWNSTREAM_UNAVAILABLE; unaffected tools work.

import { buildServer } from '../../src/server';
import { createLogger } from '../../src/logger';
import { TOOLS } from '../../src/tools';
import { SidecoachToolError } from '../../src/errors';
import { test, assert } from '../harness';

function silentLogger() {
  return createLogger({ level: 'error', write: () => undefined });
}

export async function run(): Promise<void> {
  await test('server boots with all registries null (no throw)', () => {
    const built = buildServer({
      logger: silentLogger(),
      registries: {
        verbs: null,
        modes: { modes: [] },
        flows: [],
        cheatsheet: null,
        lanes: null,
        intent: null,
      },
    });
    assert.ok(built.mcp);
    assert.strictEqual(built.inFlightCount(), 0);
  });

  await test('list_verbs returns DOWNSTREAM_UNAVAILABLE when verbs registry missing', async () => {
    const h = TOOLS.find((t) => t.definition.name === 'sidecoach_list_verbs')!.handler;
    try {
      await h(
        {},
        {
          logger: silentLogger(),
          registries: {
            verbs: null,
            modes: { modes: [] },
            flows: [],
            cheatsheet: null,
            lanes: null,
            intent: null,
          },
        },
      );
      assert.fail('expected throw');
    } catch (e) {
      assert.ok(e instanceof SidecoachToolError);
      assert.strictEqual((e as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    }
  });

  await test('list_modes still works when verbs are missing (independent dep)', async () => {
    const h = TOOLS.find((t) => t.definition.name === 'sidecoach_list_modes')!.handler;
    const r = await h(
      {},
      {
        logger: silentLogger(),
        registries: {
          verbs: null,
          modes: { modes: [{ mode: 'forge', pattern: 'forge', description: '', oneLineExplanation: '', chain: [] }] },
          flows: [],
          cheatsheet: null,
          lanes: null,
          intent: null,
        },
      },
    );
    assert.strictEqual((r.data as any).count, 1);
  });
}
