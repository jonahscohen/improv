import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// HTTP-level regression test for the incident: an agent POSTed /watch/disarm and
// the daemon happily turned the watch off. It must now refuse without a live,
// single-use, human-minted consent token.
//
// JUSTIFY_STATE_DIR must be set BEFORE importing ws-server, because WsServer
// constructs its DisarmConsentStore in a field initializer that reads the env.

let dir: string;
dir = mkdtempSync(join(tmpdir(), 'jf-disarm-ep-'));
process.env.JUSTIFY_STATE_DIR = dir;

const { WsServer } = await import('../../server/ws-server.js');
const { WatchStateStore } = await import('../../server/watch-state.js');

const BASE_PORT = 49400;

// Each test gets its OWN port pair. Node's fetch (undici) holds sockets alive, so
// a server closed in afterEach can still be bound when the next beforeEach tries
// to reuse the port - which surfaced as a bare "fetch failed". `connection: close`
// on every request keeps the sockets from lingering either way.
let portCursor = 0;
const nextPort = () => BASE_PORT + portCursor++ * 4;

const post = async (port: number, path: string, body: unknown) => {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', connection: 'close' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

const get = async (port: number, path: string) => {
  const res = await fetch(`http://localhost:${port}${path}`, { headers: { connection: 'close' } });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

const fakeDispatcher = {
  kick: () => {},
  status: () => ({ dispatcherRunning: true, pendingCount: 0, stalled: false }),
};

describe('POST /watch/disarm requires human consent', () => {
  let server: InstanceType<typeof WsServer>;
  let store: InstanceType<typeof WatchStateStore>;
  let port: number;

  beforeEach(async () => {
    server = new WsServer();
    port = await server.start(nextPort());
    store = new WatchStateStore(join(dir, `watch-${port}.json`));
    store.arm('/proj/root', 'jonah');
    server.attachWatch(store, fakeDispatcher);
  });

  afterEach(async () => {
    await server.stop();
    rmSync(join(dir, 'disarm-consent.json'), { force: true });
  });

  it('refuses a disarm with NO consent token, 403, and stays armed', async () => {
    const { status, json } = await post(port, '/watch/disarm', { by: 'claude' });

    expect(status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.error).toBe('consent_required');
    expect(json.armed).toBe(true);
    expect(json.how).toMatch(/human must run/i);
    expect(store.isArmed()).toBe(true);
  });

  it('refuses a disarm with a FABRICATED consent token, and stays armed', async () => {
    const { status, json } = await post(port, '/watch/disarm', {
      by: 'claude',
      consentToken: 'a'.repeat(64),
    });

    expect(status).toBe(403);
    expect(json.error).toBe('consent_required'); // nothing was ever issued
    expect(store.isArmed()).toBe(true);
  });

  it('accepts a freshly issued token exactly once, then refuses the replay', async () => {
    const issued = await post(port, '/watch/consent', { by: 'jonah' });
    expect(issued.status).toBe(200);
    const token = issued.json.token as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // issuing consent must NOT itself disarm anything
    expect(store.isArmed()).toBe(true);

    const ok = await post(port, '/watch/disarm', { by: 'jonah', consentToken: token });
    expect(ok.status).toBe(200);
    expect(ok.json.ok).toBe(true);
    expect(ok.json.armed).toBe(false);
    expect(store.isArmed()).toBe(false);

    // replay of a spent token
    store.arm('/proj/root', 'jonah');
    const replay = await post(port, '/watch/disarm', { by: 'claude', consentToken: token });
    expect(replay.status).toBe(403);
    expect(store.isArmed()).toBe(true);
  });

  it('a token issued for one disarm cannot be guessed at by a wrong token', async () => {
    const issued = await post(port, '/watch/consent', { by: 'jonah' });
    const token = issued.json.token as string;

    const wrong = await post(port, '/watch/disarm', { by: 'claude', consentToken: 'b'.repeat(64) });
    expect(wrong.status).toBe(403);
    expect(wrong.json.error).toBe('consent_mismatch');
    expect(store.isArmed()).toBe(true);

    // the real consent survived the bad guess
    const ok = await post(port, '/watch/disarm', { by: 'jonah', consentToken: token });
    expect(ok.status).toBe(200);
    expect(store.isArmed()).toBe(false);
  });

  it('/status reports watching=false when armed but the dispatcher is dead', async () => {
    server.attachWatch(store, {
      kick: () => {},
      status: () => ({ dispatcherRunning: false, pendingCount: 2, stalled: true }),
    });
    store.arm('/proj/root', 'jonah');

    const { json } = await get(port, '/status');
    expect(json.watchArmed).toBe(true);
    expect(json.dispatcherRunning).toBe(false);
    expect(json.watching).toBe(false); // armed is NOT the same as watching
    expect(json.stalled).toBe(true);
    expect(json.pendingCount).toBe(2);
  });

  it('/status reports watching=true only when armed AND dispatching', async () => {
    const { json } = await get(port, '/status');
    expect(json.watchArmed).toBe(true);
    expect(json.dispatcherRunning).toBe(true);
    expect(json.watching).toBe(true);
  });
});
