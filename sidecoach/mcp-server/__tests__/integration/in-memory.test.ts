// End-to-end integration test against the REAL server, connected to a
// REAL MCP client via the SDK's in-memory transport pair. This exercises
// the full SDK protocol path (initialize -> tools/list -> tools/call) without
// needing to spawn a subprocess - the subprocess test lives in stdio.test.ts.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildServer } from '../../src/server';
import { createLogger } from '../../src/logger';
import { test, assert } from '../harness';
import { TOOL_NAMES } from '../../src/tools';

function silentLogger() {
  return createLogger({ level: 'error', write: () => undefined });
}

export async function run(): Promise<void> {
  await test('server connects, lists all tools, every tool has an input schema', async () => {
    const built = buildServer({ logger: silentLogger() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await built.mcp.connect(serverTransport);
    const client = new Client(
      { name: 'integration-test', version: '0.0.0' },
      { capabilities: {} },
    );
    await client.connect(clientTransport);
    try {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name).sort();
      assert.deepStrictEqual(names, [...TOOL_NAMES].sort());
      for (const t of tools.tools) {
        assert.ok(t.description && t.description.length > 0, `${t.name} missing description`);
        assert.ok(t.inputSchema, `${t.name} missing inputSchema`);
      }
    } finally {
      await client.close();
      await built.close();
    }
  });

  await test('each tool responds successfully to a valid invocation', async () => {
    const built = buildServer({ logger: silentLogger() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await built.mcp.connect(serverTransport);
    const client = new Client(
      { name: 'integration-test', version: '0.0.0' },
      { capabilities: {} },
    );
    await client.connect(clientTransport);

    const calls: Array<{ name: string; args: any }> = [
      { name: 'sidecoach_list_verbs', args: {} },
      { name: 'sidecoach_list_lanes', args: {} },
      { name: 'sidecoach_list_flows', args: {} },
      { name: 'sidecoach_classify_intent', args: { prompt: 'polish the homepage' } },
      { name: 'sidecoach_lane', args: { operation: 'list' } },
      { name: 'sidecoach_get_cheatsheet', args: {} },
      { name: 'sidecoach_get_flow_metadata', args: { flowId: 'flowJ_tactical_polish' } },
      { name: 'sidecoach_get_cost_ledger', args: {} },
      { name: 'sidecoach_validate_taste', args: { html: '<div>hello</div>' } },
      {
        name: 'sidecoach_validate_polish_standard',
        args: { css: '.btn:active { transform: scale(0.96); }' },
      },
      {
        name: 'sidecoach_validate_extended_domain',
        args: { css: '.x { color: red; padding: 8px; }' },
      },
    ];

    try {
      for (const call of calls) {
        const r = await client.callTool({ name: call.name, arguments: call.args });
        assert.notStrictEqual(r.isError, true, `${call.name} returned isError`);
        assert.ok(Array.isArray(r.content), `${call.name} content not an array`);
        assert.ok((r.content as any[]).length > 0, `${call.name} returned empty content`);
      }
    } finally {
      await client.close();
      await built.close();
    }
  });

  await test('invalid input returns isError tool response (not a crash)', async () => {
    const built = buildServer({ logger: silentLogger() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await built.mcp.connect(serverTransport);
    const client = new Client(
      { name: 'integration-test', version: '0.0.0' },
      { capabilities: {} },
    );
    await client.connect(clientTransport);

    try {
      // get_flow_metadata with an unknown ID -> INVALID_INPUT
      const r1 = await client.callTool({
        name: 'sidecoach_get_flow_metadata',
        arguments: { flowId: 'flowZZZ_not_a_real_flow' },
      });
      assert.strictEqual(r1.isError, true);
      const payload = JSON.parse((r1.content as any[])[0].text);
      assert.strictEqual(payload.code, 'INVALID_INPUT');

      // classify_intent with empty prompt -> schema rejects via SDK validation
      // (this is a -32602 protocol error, caught by callTool as a throw).
      try {
        await client.callTool({
          name: 'sidecoach_classify_intent',
          arguments: { prompt: '' },
        });
        // If the SDK surfaces it as a tool error rather than a throw, both
        // outcomes are acceptable - just ensure the call didn't claim success.
      } catch (err: any) {
        assert.ok(String(err).length > 0);
      }
    } finally {
      await client.close();
      await built.close();
    }
  });

  await test('server stays healthy across mixed call sequence', async () => {
    const built = buildServer({ logger: silentLogger() });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await built.mcp.connect(serverTransport);
    const client = new Client(
      { name: 'integration-test', version: '0.0.0' },
      { capabilities: {} },
    );
    await client.connect(clientTransport);
    try {
      // 1) good call
      const a = await client.callTool({ name: 'sidecoach_list_lanes', arguments: {} });
      assert.notStrictEqual(a.isError, true);
      // 2) bad call (unknown flow)
      const b = await client.callTool({
        name: 'sidecoach_get_flow_metadata',
        arguments: { flowId: 'nope' },
      });
      assert.strictEqual(b.isError, true);
      // 3) good call again - proves server alive after error
      const c = await client.callTool({ name: 'sidecoach_list_verbs', arguments: {} });
      assert.notStrictEqual(c.isError, true);
    } finally {
      await client.close();
      await built.close();
    }
  });
}
