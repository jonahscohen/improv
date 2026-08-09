import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WsServer } from '../../server/ws-server.js';

// ws-server.test.ts constructs a WsServer directly over a data dir (JUSTIFY_STATE_DIR)
// and exercises it with zero connected clients. There is no exported
// makeTestServer/seedPrompt/readResponses/readPrompts helper, so - per the brief -
// we build the equivalent inline the same way: a WsServer pointed at a fresh temp
// dataDir with no sockets opened (start() is never called, so manager.size() is 0),
// plus small file readers/writers against that same dir.

type TestServer = WsServer & { __dir: string };

function makeTestServer(_opts: { clients: number } = { clients: 0 }): TestServer {
  const dir = mkdtempSync(join(tmpdir(), 'justify-respond-parity-'));
  // stateDir is captured in the WsServer constructor, so set the env before `new`.
  process.env.JUSTIFY_STATE_DIR = dir;
  const s = new WsServer() as TestServer;
  s.__dir = dir;
  return s;
}

function seedPrompt(
  s: TestServer,
  prompt: { id: string; selectors?: string[]; [k: string]: unknown },
): void {
  const file = join(s.__dir, 'prompts.json');
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : [];
  existing.push(prompt);
  writeFileSync(file, JSON.stringify(existing));
}

function readResponses(s: TestServer): any[] {
  const file = join(s.__dir, 'responses.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function readPrompts(s: TestServer): any[] {
  const file = join(s.__dir, 'prompts.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8'));
}

describe('respond parity: MCP path is as durable/complete as HTTP', () => {
  it('MCP respond persists to responses.json when no client is connected', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1', selectors: ['#hero'] });
    s.emitResponse({ promptId: 'p1', summary: 'did it', status: 'completed' });
    const resp = readResponses(s);
    expect(resp.length).toBe(1);
    expect(resp[0].summary).toBe('did it');
    // selectors joined from the original prompt even though caller omitted them
    expect(resp[0].targetSelectors).toEqual(['#hero']);
  });

  it('emitResponse stamps respondedAt on the originating prompt', async () => {
    const s = makeTestServer({ clients: 0 });
    seedPrompt(s, { id: 'p1' });
    s.emitResponse({ promptId: 'p1', summary: 'x', status: 'completed' });
    const p = readPrompts(s).find((p: any) => p.id === 'p1');
    expect(typeof p.respondedAt).toBe('number');
  });
});
