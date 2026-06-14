// Real-subprocess integration test. Spawns the built server as a child
// process talking over stdio JSON-RPC, sends initialize + tools/list +
// tools/call + SIGTERM, verifies clean exit.
//
// This is the "proof of life" - if this passes, the server actually works
// in the configuration that Claude Code uses to talk to MCP servers.

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { test, assert } from '../harness';

const SERVER_ENTRY = path.resolve(__dirname, '..', '..', 'dist', 'index.js');

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
}

interface SpawnedServer {
  proc: ChildProcessWithoutNullStreams;
  send: (msg: unknown) => void;
  /** Wait for a response with the given id. Throws if it doesn't arrive within ms. */
  waitFor: (id: number, ms: number) => Promise<JsonRpcResponse>;
  /** Stop and return the captured stderr transcript. */
  stop: (signal: NodeJS.Signals) => Promise<{ code: number | null; stderr: string }>;
  /** Captured stdin/stdout transcript (chronological, framed). */
  transcript: string[];
}

function spawnServer(): SpawnedServer {
  if (!fs.existsSync(SERVER_ENTRY)) {
    throw new Error(`server entry not built: ${SERVER_ENTRY} (run npm run build first)`);
  }
  const proc = spawn('node', [SERVER_ENTRY], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, SIDECOACH_MCP_LOG_LEVEL: 'warn' },
  });

  const transcript: string[] = [];
  const pendingResponses = new Map<number, (r: JsonRpcResponse) => void>();
  let stdoutBuf = '';
  let stderrBuf = '';

  proc.stdout.setEncoding('utf-8');
  proc.stderr.setEncoding('utf-8');

  proc.stdout.on('data', (chunk: string) => {
    stdoutBuf += chunk;
    // The SDK frames JSON-RPC as newline-delimited messages.
    let idx;
    while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, idx);
      stdoutBuf = stdoutBuf.slice(idx + 1);
      if (line.trim().length === 0) continue;
      transcript.push(`SERVER->CLIENT: ${line}`);
      try {
        const parsed = JSON.parse(line) as JsonRpcResponse;
        if (typeof parsed.id === 'number' && pendingResponses.has(parsed.id)) {
          const resolve = pendingResponses.get(parsed.id)!;
          pendingResponses.delete(parsed.id);
          resolve(parsed);
        }
      } catch {
        // Notification or malformed line - ignored.
      }
    }
  });
  proc.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk;
  });

  function send(msg: unknown): void {
    const line = JSON.stringify(msg);
    transcript.push(`CLIENT->SERVER: ${line}`);
    proc.stdin.write(line + '\n');
  }

  function waitFor(id: number, ms: number): Promise<JsonRpcResponse> {
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingResponses.delete(id);
        reject(new Error(`timed out waiting for response to id=${id}`));
      }, ms);
      pendingResponses.set(id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });
  }

  function stop(signal: NodeJS.Signals): Promise<{ code: number | null; stderr: string }> {
    return new Promise((resolve) => {
      proc.once('exit', (code) => resolve({ code, stderr: stderrBuf }));
      proc.kill(signal);
    });
  }

  return { proc, send, waitFor, stop, transcript };
}

export async function run(): Promise<void> {
  await test('subprocess initialize -> tools/list -> tools/call (all tools) -> SIGTERM exit 0', async () => {
    const server = spawnServer();
    let exitInfo: { code: number | null; stderr: string } | undefined;
    try {
      // 1) initialize
      server.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'stdio-test', version: '0.0.0' },
        },
      });
      const initResp = await server.waitFor(1, 5_000);
      assert.ok(initResp.result, 'no result on initialize');
      assert.strictEqual(initResp.result.serverInfo.name, 'sidecoach-mcp-server');

      // The MCP spec requires sending an "initialized" notification after the
      // handshake completes (before any other requests).
      server.send({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      });

      // 2) tools/list
      server.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      const toolsResp = await server.waitFor(2, 5_000);
      assert.ok(toolsResp.result, 'no result on tools/list');
      // Tool count check is intentionally elastic - the registry grew from
      // 10 (T-0018) to 15 (T-0022 added 5 dev tools). We pin the floor and
      // assert the new tools appear so a future regression that drops a
      // tool is caught.
      const toolNames = (toolsResp.result.tools as any[]).map((t) => t.name);
      assert.ok(toolNames.length >= 15, `expected >=15 tools, got ${toolNames.length}`);
      for (const n of [
        'sidecoach_state_set',
        'sidecoach_state_get',
        'sidecoach_state_delete',
        'sidecoach_state_list_keys',
        'sidecoach_ast_grep',
      ]) {
        assert.ok(toolNames.includes(n), `missing T-0022 tool: ${n}`);
      }

      // 3) tools/call against each of the original 10 tools (T-0018 surface)
      const calls = [
        ['sidecoach_list_verbs', {}],
        ['sidecoach_list_lanes', {}],
        ['sidecoach_list_flows', {}],
        ['sidecoach_classify_intent', { prompt: 'polish the homepage' }],
        ['sidecoach_lane', { operation: 'list' }],
        ['sidecoach_get_cheatsheet', { section: 'lanes' }],
        ['sidecoach_get_flow_metadata', { flowId: 'flowJ_tactical_polish' }],
        ['sidecoach_get_cost_ledger', { format: 'summary' }],
        ['sidecoach_validate_taste', { html: '<div>hi</div>' }],
        ['sidecoach_validate_polish_standard', { css: '.btn:active { transform: scale(0.96); }' }],
        ['sidecoach_validate_extended_domain', { css: '.x { color: red; padding: 8px; }' }],
        // T-0022 extension tools - exercise via the live subprocess too.
        ['sidecoach_state_set', { key: 'stdio:test', value: 'v', ttlMs: 60_000 }],
        ['sidecoach_state_get', { key: 'stdio:test' }],
        ['sidecoach_state_list_keys', { prefix: 'stdio:' }],
        ['sidecoach_state_delete', { key: 'stdio:test' }],
      ] as const;

      for (let i = 0; i < calls.length; i++) {
        const [name, args] = calls[i];
        server.send({
          jsonrpc: '2.0',
          id: 10 + i,
          method: 'tools/call',
          params: { name, arguments: args },
        });
        const resp = await server.waitFor(10 + i, 10_000);
        assert.ok(resp.result, `no result on tools/call ${name}: ${JSON.stringify(resp)}`);
        assert.notStrictEqual(resp.result.isError, true, `${name} returned isError`);
      }

      // 4) tools/call with INVALID input -> isError true
      server.send({
        jsonrpc: '2.0',
        id: 99,
        method: 'tools/call',
        params: { name: 'sidecoach_get_flow_metadata', arguments: { flowId: 'nope_flow' } },
      });
      const badResp = await server.waitFor(99, 5_000);
      assert.ok(badResp.result, 'no result on bad call');
      assert.strictEqual(badResp.result.isError, true);
      const errPayload = JSON.parse(badResp.result.content[0].text);
      assert.strictEqual(errPayload.code, 'INVALID_INPUT');

      // 5) SIGTERM -> clean exit 0
      exitInfo = await server.stop('SIGTERM');
      assert.strictEqual(exitInfo.code, 0, `expected exit 0, got ${exitInfo.code}; stderr: ${exitInfo.stderr.slice(0, 500)}`);
    } catch (err) {
      if (server.proc.exitCode === null) {
        try {
          await server.stop('SIGKILL');
        } catch {
          // ignore
        }
      }
      throw err;
    }

    // Persist transcript artifact for the final report.
    try {
      const out = path.join(__dirname, 'stdio-transcript.txt');
      fs.writeFileSync(out, server.transcript.join('\n') + '\n');
    } catch {
      // ignore artifact failures
    }
  });

  await test('subprocess survives an invalid input across the wire (server stays alive)', async () => {
    const server = spawnServer();
    try {
      // initialize
      server.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'stdio-test2', version: '0.0.0' },
        },
      });
      await server.waitFor(1, 5_000);
      server.send({ jsonrpc: '2.0', method: 'notifications/initialized' });

      // Bad call
      server.send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'sidecoach_get_flow_metadata', arguments: { flowId: 'nope' } },
      });
      const r1 = await server.waitFor(2, 5_000);
      assert.strictEqual(r1.result.isError, true);

      // Good call afterward
      server.send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'sidecoach_list_lanes', arguments: {} },
      });
      const r2 = await server.waitFor(3, 5_000);
      assert.notStrictEqual(r2.result.isError, true);
    } finally {
      await server.stop('SIGTERM');
    }
  });
}
