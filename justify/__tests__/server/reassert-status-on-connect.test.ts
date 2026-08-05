import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import WebSocket from 'ws';
import { WsServer } from '../../server/ws-server.js';

// THE DAEMON MUST TELL A (RE)CONNECTING BROWSER WHAT IT ALREADY KNOWS.
//
// Jonah, 2026-08-03: "If Justify successfully received a request, it must,
// without failure, report back to the browser that it's 'Working'. This lets
// the user continue working without fear that their request has died in the
// background."
//
// Before this fix, a browser that (re)connected - a fresh tab, or a socket
// drop/reconnect - while a prompt was pending had no way to learn that except
// two client-side PULLS: the 5s /watch-status poll, or the one-shot, watch-
// gated `_loadClaudeState()` fetch chain run 500ms after init. Both leave a
// real window where the bar reads "Connected" (or nothing) for a request that
// is not dead - it just has not been reflected yet. This test drives a real
// WebSocket into a real WsServer (no mocks) and asserts the daemon PUSHES the
// correct status to the connection the instant its handshake completes, with
// no reliance on any subsequent poll or message from the client.

const dir = mkdtempSync(join(tmpdir(), 'jf-reassert-'));
process.env.JUSTIFY_STATE_DIR = dir;

const PROMPT_FILE = join(dir, 'prompts.json');
const BASE_PORT = 49300;

function connectAndCollect(port: number): Promise<{ ws: WebSocket; messages: Array<Record<string, unknown>> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const messages: Array<Record<string, unknown>> = [];

    ws.once('open', () => {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'handshake',
        params: { tabUrl: 'https://example.com', tabTitle: 'Example' },
      }));
    });

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    ws.once('error', reject);

    // Give the daemon a beat to send the handshake ack AND any immediate
    // follow-up push (both fire synchronously in the same handler, back to
    // back, well within this window).
    setTimeout(() => resolve({ ws, messages }), 200);
  });
}

describe('the daemon re-asserts current status to a client the instant it connects', () => {
  let server: InstanceType<typeof WsServer>;

  beforeEach(() => {
    writeFileSync(PROMPT_FILE, '[]');
  });

  afterEach(async () => {
    await server?.stop();
  });

  it('sends nothing extra when the queue is empty - "Connected" stays correct', async () => {
    server = new WsServer();
    const port = await server.start(BASE_PORT);
    const { ws, messages } = await connectAndCollect(port);

    // Exactly one message: the handshake ack. No phantom status push.
    expect(messages).toHaveLength(1);
    expect(messages[0].result).toBeTruthy();

    ws.close();
  });

  it('pushes justify_queued for an unclaimed pending prompt, unprompted', async () => {
    writeFileSync(PROMPT_FILE, JSON.stringify([
      { id: 'prompt-1', prompt: 'make it red', timestamp: Date.now() },
    ]));

    server = new WsServer();
    const port = await server.start(BASE_PORT + 10);
    const { ws, messages } = await connectAndCollect(port);

    const pushed = messages.find((m) => m.method === 'justify_queued');
    expect(pushed).toBeTruthy();
    expect((pushed?.params as Record<string, unknown>)?.promptId).toBe('prompt-1');

    ws.close();
  });

  it('pushes justify_working for a CLAIMED pending prompt, unprompted', async () => {
    writeFileSync(PROMPT_FILE, JSON.stringify([
      { id: 'prompt-2', prompt: 'make it blue', timestamp: Date.now(), claimedBy: 'justify-watch-owner', claimedAt: Date.now() },
    ]));

    server = new WsServer();
    const port = await server.start(BASE_PORT + 20);
    const { ws, messages } = await connectAndCollect(port);

    const pushed = messages.find((m) => m.method === 'justify_working');
    expect(pushed).toBeTruthy();
    expect((pushed?.params as Record<string, unknown>)?.promptId).toBe('prompt-2');
    // Must not ALSO walk it backwards by pushing justify_queued.
    expect(messages.find((m) => m.method === 'justify_queued')).toBeUndefined();

    ws.close();
  });

  it('re-asserts to a SECOND (reconnecting) client independently of the first', async () => {
    // Simulates the actual failure: browser A sent the prompt and is 'sending';
    // browser B is a fresh connection (a reload, or a second tab) that never
    // saw any broadcast at all. B must still learn the truth on connect.
    writeFileSync(PROMPT_FILE, JSON.stringify([
      { id: 'prompt-3', prompt: 'make it green', timestamp: Date.now() },
    ]));

    server = new WsServer();
    const port = await server.start(BASE_PORT + 30);

    const a = await connectAndCollect(port);
    expect(a.messages.find((m) => m.method === 'justify_queued')).toBeTruthy();

    const b = await connectAndCollect(port);
    expect(b.messages.find((m) => m.method === 'justify_queued')).toBeTruthy();

    a.ws.close();
    b.ws.close();
  });
});
