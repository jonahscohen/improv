import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import WebSocket from 'ws';

// The whole pipeline, over a real socket, on the real server code.
//
// Jonah, 2026-07-09: "You're still not getting my prompts. I want you to get them
// instantly." His prompts WERE arriving. Two things were broken:
//   1. the deployed daemon was stale, so push_prompt ignored `clientId` entirely
//      (no idempotency, no ledger) - `npm run deploy` never compiled the server
//   2. nothing ever told the browser a worker had started, so the pill sat on
//      "Sending to Claude." for the entire apply
//
// This test drives a real WebSocket into a real WsServer + Dispatcher and asserts
// the prompt lands, is deduped on retry, and that the browser is TOLD.

const dir = mkdtempSync(join(tmpdir(), 'jf-e2e-'));
const projectRoot = mkdtempSync(join(tmpdir(), 'jf-e2e-root-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { WsServer } = await import('../../server/ws-server.js');
const { WatchStateStore } = await import('../../server/watch-state.js');
const { Dispatcher } = await import('../../server/dispatcher.js');
const { registerTools } = await import('../../server/mcp-tools.js');

const PROMPT_FILE = join(dir, 'prompts.json');
const readQueue = () => JSON.parse(readFileSync(PROMPT_FILE, 'utf-8'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let server: InstanceType<typeof WsServer>;
let dispatcher: InstanceType<typeof Dispatcher>;
let port: number;
let ws: WebSocket;
const notifications: Array<{ method: string; params: Record<string, unknown> }> = [];
let nextId = 1;
const responsePending = new Set<number>();

const rpc = (method: string, params: Record<string, unknown>) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    const id = nextId++;
    responsePending.add(id);
    const onMsg = (raw: WebSocket.RawData) => {
      const m = JSON.parse(String(raw));
      if (m.id === id && m.method === undefined) { responsePending.delete(id); ws.off('message', onMsg); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });

beforeAll(async () => {
  writeFileSync(PROMPT_FILE, '[]');
  writeFileSync(join(dir, 'prompt-seq.json'), JSON.stringify({ next: 1 }));
  writeFileSync(join(dir, 'responses.json'), '[]');
  writeFileSync(join(dir, 'served-clients.json'), '[]');

  server = new WsServer();
  port = await server.start(49900);

  const watch = new WatchStateStore(join(dir, 'watch.json'));
  watch.arm(projectRoot, 'jonah');

  process.env.JUSTIFY_WORKER_CMD = 'sleep 1';
  dispatcher = new Dispatcher(watch, {
    port, stateDir: dir, tickMs: 50, headless: true,
    broadcast: (event, payload) => server.broadcastToClients(event, payload),
  });
  dispatcher.start();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTools({ tool: () => {} } as any, server as any);
  server.attachWatch(watch, dispatcher);

  ws = new WebSocket(`ws://localhost:${port}`);
  await new Promise<void>((res) => ws.on('open', () => res()));
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    // A server->client notification. NOTE: broadcastToClients sends `id: 0`, not
    // an absent id. Filtering on `id === undefined` silently drops every
    // broadcast - which is how the first version of this test "proved" the
    // browser was never told, when in fact the test was deaf.
    if (m.method && !responsePending.has(m.id)) {
      notifications.push({ method: m.method, params: m.params ?? {} });
    }
  });
  await rpc('handshake', { client: 'justify-browser', tabUrl: 'https://yes-ppai.local/', tabTitle: 't' });
}, 20000);

afterAll(async () => { dispatcher?.stop(); try { ws.close(); } catch {} await server.stop(); delete process.env.JUSTIFY_WORKER_CMD; });

describe('a Send-All from the browser lands, is deduped, and is ANNOUNCED', () => {
  it('push_prompt stores the clientId (the stale daemon dropped it)', async () => {
    const res = await rpc('push_prompt', { prompt: 'hover state transition font weight .2s ease in out', clientId: 'cid-jonah-1', context: '', elementCount: 1 });
    expect(res.accepted).toBe(1);
    const q = readQueue();
    expect(q).toHaveLength(1);
    expect(q[0].clientId).toBe('cid-jonah-1');
  });

  it('the browser is TOLD a worker started - no more silent "Sending to Claude."', async () => {
    const stop = Date.now() + 8000;
    while (Date.now() < stop && !notifications.some((n) => n.method === 'justify_working')) await sleep(25);
    const working = notifications.find((n) => n.method === 'justify_working');
    expect(working, 'browser never received justify_working').toBeTruthy();
    expect(working!.params.promptId).toBe('prompt-1');
  }, 15000);

  it('the outbox retrying the same clientId does NOT queue the work twice', async () => {
    const before = readQueue().length;
    const retry = await rpc('push_prompt', { prompt: 'hover state transition font weight .2s ease in out', clientId: 'cid-jonah-1', context: '', elementCount: 1 });
    expect(retry.accepted).toBe(0);
    expect(retry.duplicate).toBe(true);
    expect(readQueue().length).toBe(before);
  });
});
