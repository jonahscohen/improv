import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../../src/server';
import { TOOLS } from '../../src/tools';
import { z } from 'zod';
import { test, assert } from '../harness';

function silentLogger(): any {
  const l: any = { info() {}, warn() {}, error() {}, exception() {} };
  l.child = () => l;
  return l;
}
const emptyRegistries: any = { verbs: { verbs: [] }, modes: { modes: [] }, flows: [], cheatsheet: null, lanes: null, intent: null };

export async function run(): Promise<void> {
  await test('buildServer wrapHandler supplies a real AbortSignal to a handler', async () => {
    let observedSignal: AbortSignal | undefined;
    TOOLS.push({
      definition: {
        name: 'signal_probe',
        description: 'test-only handler-deps probe',
        inputSchema: { value: z.string() },
        timeoutMs: 1_000,
      },
      handler: async (_input, deps) => {
        observedSignal = deps.signal;
        return { data: { sawSignal: deps.signal instanceof AbortSignal } };
      },
    });
    const built = buildServer({ logger: silentLogger(), registries: emptyRegistries });
    TOOLS.pop();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await built.mcp.connect(serverTransport);
    const client = new Client({ name: 'signal-probe-client', version: '0.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
    try {
      const response = await client.callTool({ name: 'signal_probe', arguments: { value: 'x' } });
      assert.notStrictEqual(response.isError, true);
      assert.ok(observedSignal instanceof AbortSignal, 'real wrapHandler path did not supply AbortSignal');
    } finally {
      await client.close();
      await built.close();
    }
  });
}
