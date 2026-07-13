import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 2026-07-12. The daemon had not applied a batch since 2026-07-09 and the whole
// team read that as "dispatch is dead." It was not. Owner mode (the default, and
// correct - see no-silent-worker.test.ts) means the daemon deliberately does not
// spawn a worker. The REAL defect was that the documented escape hatch,
// "Opt in with JUSTIFY_HEADLESS=1", could not actually be reached:
//
//   - justify-serve launches the daemon with `nohup node "$SERVER"` and never set
//     the var, so no supported command could turn headless on;
//   - index.ts never passed `headless` to the Dispatcher;
//   - and an env var cannot survive `justify-serve --restart` anyway, so even a
//     hand-exported one silently evaporated the next time anything bounced the
//     daemon.
//
// A switch you cannot reach, and that does not hold when you do, is the same as
// no switch. These tests pin it down THROUGH THE REAL SURFACES - the HTTP route
// and the shared resolveHeadless() the daemon actually calls - so they cannot
// pass while the production wiring is broken.

const bootDir = mkdtempSync(join(tmpdir(), 'jf-mode-'));
const projectRoot = mkdtempSync(join(tmpdir(), 'jf-mode-root-'));
process.env.JUSTIFY_STATE_DIR = bootDir;

const { Dispatcher } = await import('../../server/dispatcher.js');
const { WatchStateStore, resolveHeadless } = await import('../../server/watch-state.js');
const { WsServer } = await import('../../server/ws-server.js');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let server: InstanceType<typeof WsServer> | null = null;
let port = 0;
let portCursor = 0;

describe('the headless opt-in is reachable, gated, and it holds', () => {
  let dispatcher: InstanceType<typeof Dispatcher>;
  let watch: InstanceType<typeof WatchStateStore>;
  let ran: string;
  // A FRESH state dir per test. The worker is spawned detached, so a straggler
  // child from the previous test can still run `echo '[]' > prompts.json` after
  // the next test has already staged its own queue - which silently empties it and
  // makes the new test look like it dispatched (or never dispatched) for reasons
  // that have nothing to do with the code. Isolate everything per test.
  let dir: string;
  let PROMPT_FILE: string;
  let STATE_FILE: string;
  let MODE_CONSENT_FILE: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'jf-mode-t-'));
    process.env.JUSTIFY_STATE_DIR = dir; // modeConsentPath() reads this
    PROMPT_FILE = join(dir, 'prompts.json');
    STATE_FILE = join(dir, 'watch.json');
    MODE_CONSENT_FILE = join(dir, 'mode-consent.json');

    writeFileSync(PROMPT_FILE, JSON.stringify([{ id: 'prompt-1', prompt: 'make it lime', timestamp: Date.now() }]));
    writeFileSync(STATE_FILE, JSON.stringify({ armed: false, projectRoot: null }));
    watch = new WatchStateStore(STATE_FILE);
    watch.arm(projectRoot, 'jonah');
    ran = join(dir, 'ran.log');
    writeFileSync(ran, '');
    process.env.JUSTIFY_WORKER_CMD = `echo spawned >> ${ran}; echo '[]' > ${PROMPT_FILE}`;
    rmSync(MODE_CONSENT_FILE, { force: true });
  });

  afterEach(async () => {
    dispatcher?.stop();
    delete process.env.JUSTIFY_WORKER_CMD;
    delete process.env.JUSTIFY_HEADLESS;
    if (server) { await server.stop(); server = null; }
  });

  afterAll(async () => { if (server) await server.stop(); });

  const waitForSpawn = async (ms = 4000) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop && readFileSync(ran, 'utf-8') === '') await sleep(25);
    return readFileSync(ran, 'utf-8');
  };

  // Boot the REAL WsServer + Dispatcher and talk to it over real HTTP, so the
  // route wiring (parse -> consent -> setHeadless -> kick) is what is under test.
  const boot = async () => {
    server = new WsServer();
    // A fresh port per test, well clear of the live :9223 daemon. start() claims
    // candidate AND candidate+1 (https), so step by 4 like the other suites do.
    port = await server.start(9400 + portCursor++ * 4);
    dispatcher = new Dispatcher(watch, { port, stateDir: dir, tickMs: 25 });
    server.attachWatch(watch, dispatcher);
    dispatcher.start();
    return { dispatcher, server, port };
  };

  // `connection: close` matches the other server suites. Without it undici keeps
  // the socket alive and reuses it across requests, and the second POST on a
  // reused socket comes back ECONNRESET.
  const post = async (path: string, body: unknown) => {
    const res = await fetch(`http://localhost:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', connection: 'close' },
      body: JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };

  // What `justify-serve --headless` does after the human types ENABLE at a TTY:
  // it WRITES the token to mode-consent.json (0600). There is deliberately no HTTP
  // mint endpoint - one would hand the key to any caller, including a hostile page,
  // which is the bypass an adversarial review caught in the first cut of this gate.
  const grantConsent = (token: string, opts: { expiresInMs?: number } = {}) => {
    const now = Date.now();
    writeFileSync(MODE_CONSENT_FILE, JSON.stringify({
      token,
      issuedAt: now,
      issuedBy: 'jonah',
      expiresAt: now + (opts.expiresInMs ?? 120000),
    }), { mode: 0o600 });
  };

  it('there is NO mint endpoint - a caller cannot ask the daemon for a token', async () => {
    await boot();
    // The bypass: mint a token over HTTP, then spend it. It must not exist.
    const { status } = await post('/watch/mode/consent', { by: 'attacker' });
    expect(status).toBe(404);
  });

  it('POST /watch/mode WITHOUT consent REFUSES to enable headless, and nothing dispatches', async () => {
    await boot();
    const { status, json } = await post('/watch/mode', { headless: true });

    expect(status).toBe(403);
    expect(json.refused).toBe(true);
    // The grant did not land: not in memory, not on disk, and no worker ran.
    expect(dispatcher.isHeadless()).toBe(false);
    expect(new WatchStateStore(STATE_FILE).isHeadless()).toBe(false);
    await sleep(300);
    expect(readFileSync(ran, 'utf-8')).toBe('');
  });

  it('a GUESSED token is refused - the grant is a 32-byte secret on disk', async () => {
    await boot();
    grantConsent('the-real-token');
    const { status } = await post('/watch/mode', { headless: true, consentToken: 'not-the-token' });
    expect(status).toBe(403);
    expect(dispatcher.isHeadless()).toBe(false);
  });

  it('a disarm token cannot be replayed to enable headless (separate consent files)', async () => {
    await boot();
    // A REAL, live disarm grant. Both gates use the same mechanism; only the
    // separate token FILES stop this from being a confused deputy.
    const { json: disarm } = await post('/watch/consent', { by: 'attacker' });
    expect(typeof disarm.token).toBe('string');

    const { status } = await post('/watch/mode', { headless: true, consentToken: disarm.token });
    expect(status).toBe(403);
    expect(dispatcher.isHeadless()).toBe(false);
    expect(new WatchStateStore(STATE_FILE).isHeadless()).toBe(false);
  });

  it('an EXPIRED consent is refused - a stale yes is not a yes', async () => {
    await boot();
    grantConsent('stale-token', { expiresInMs: -1000 });
    const { status } = await post('/watch/mode', { headless: true, consentToken: 'stale-token' });
    expect(status).toBe(403);
    expect(dispatcher.isHeadless()).toBe(false);
  });

  it('WITH consent, POST /watch/mode enables headless and the QUEUED batch dispatches now', async () => {
    await boot();
    await sleep(200);
    expect(readFileSync(ran, 'utf-8')).toBe(''); // owner mode: nothing ran

    grantConsent('good-token');
    const { status, json } = await post('/watch/mode', { headless: true, consentToken: 'good-token' });

    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.headless).toBe(true);
    // The route flipped the LIVE dispatcher and kicked it: the batch already in
    // the queue goes without waiting for a restart.
    expect(await waitForSpawn()).toContain('spawned');
  }, 12000);

  it('the consent token is single-use - a replay of the same token is refused', async () => {
    await boot();
    grantConsent('one-shot');
    const first = await post('/watch/mode', { headless: true, consentToken: 'one-shot' });
    expect(first.status).toBe(200);

    // Back to owner (ungated), then try to re-enable with the SAME token.
    await post('/watch/mode', { headless: false });
    expect(dispatcher.isHeadless()).toBe(false);

    const replay = await post('/watch/mode', { headless: true, consentToken: 'one-shot' });
    expect(replay.status).toBe(403);
    expect(dispatcher.isHeadless()).toBe(false);
  });

  it('DISABLING headless needs no consent - the brake is always reachable', async () => {
    await boot();
    grantConsent('good-token');
    await post('/watch/mode', { headless: true, consentToken: 'good-token' });
    expect(dispatcher.isHeadless()).toBe(true);

    const { status, json } = await post('/watch/mode', { headless: false });
    expect(status).toBe(200);
    expect(json.headless).toBe(false);
    expect(dispatcher.isHeadless()).toBe(false);
    expect(new WatchStateStore(STATE_FILE).isHeadless()).toBe(false);
  });

  // A GET /prompts poll is a PEEK, not a claim. An owner mid-apply is therefore
  // invisible in the queue, and a headless dispatcher would apply the same prompt
  // a second time - writing the same change into the user's source twice.
  describe('headless never takes work from an attached HTTP owner', () => {
    it('DEFERS while an owner is polling /prompts, and dispatches once it stops', async () => {
      let ownerPolling = true;
      dispatcher = new Dispatcher(watch, {
        port: 9223,
        stateDir: dir,
        tickMs: 25,
        headless: true,                       // fully armed to dispatch...
        ownerActive: () => ownerPolling,      // ...but an owner is attached
      });
      dispatcher.start();

      await sleep(400);
      expect(readFileSync(ran, 'utf-8')).toBe('');   // stood down
      expect(dispatcher.pendingCount()).toBe(1);      // and nothing was lost

      ownerPolling = false;                           // the owner goes away
      expect(await waitForSpawn()).toContain('spawned');
    }, 12000);

    it('with NO owner attached (the unattended case) it dispatches immediately', async () => {
      dispatcher = new Dispatcher(watch, {
        port: 9223, stateDir: dir, tickMs: 25, headless: true,
        ownerActive: () => false,
      });
      dispatcher.start();
      expect(await waitForSpawn()).toContain('spawned');
    }, 12000);

    // The ownerActive grace window alone only NARROWS the race: an owner that
    // polls once, then applies for two minutes without polling again, looks gone.
    // The durable per-prompt stamp is what actually closes it.
    it('a prompt SERVED to an owner is not claimable, even after the owner stops polling', async () => {
      writeFileSync(PROMPT_FILE, JSON.stringify([{
        id: 'prompt-1',
        prompt: 'make it lime',
        timestamp: Date.now(),
        servedToOwnerAt: Date.now() - 120000, // handed over 2 min ago; owner silent since
      }]));
      dispatcher = new Dispatcher(watch, {
        port: 9223, stateDir: dir, tickMs: 25, headless: true,
        ownerActive: () => false,       // the poll grace has long since lapsed
        claimTtlMs: 2400000,
      });
      dispatcher.start();

      await sleep(400);
      expect(readFileSync(ran, 'utf-8')).toBe('');   // did NOT double-apply
      expect(dispatcher.pendingCount()).toBe(1);      // and did not drop it
    });

    it('...but a STALE served stamp is reclaimed, so a dead owner cannot wedge the queue', async () => {
      writeFileSync(PROMPT_FILE, JSON.stringify([{
        id: 'prompt-1',
        prompt: 'make it lime',
        timestamp: Date.now(),
        servedToOwnerAt: Date.now() - 600000, // 10 min ago
      }]));
      dispatcher = new Dispatcher(watch, {
        port: 9223, stateDir: dir, tickMs: 25, headless: true,
        ownerActive: () => false,
        claimTtlMs: 60000,                    // stamp is well past TTL
      });
      dispatcher.start();
      expect(await waitForSpawn()).toContain('spawned');
    }, 12000);

    it('GET /prompts stamps served prompts in HEADLESS mode', async () => {
      await boot();
      grantConsent('good-token');
      await post('/watch/mode', { headless: true, consentToken: 'good-token' });

      const res = await fetch(`http://localhost:${port}/prompts`, { headers: { connection: 'close' } });
      const body = (await res.json()) as Array<{ servedToOwnerAt?: number }>;
      expect(typeof body[0].servedToOwnerAt).toBe('number');
    });

    it('GET /prompts does NOT touch the queue in OWNER mode - the hot path is unchanged', async () => {
      await boot(); // owner mode (default)
      const before = readFileSync(PROMPT_FILE, 'utf-8');

      const res = await fetch(`http://localhost:${port}/prompts`, { headers: { connection: 'close' } });
      const body = (await res.json()) as Array<{ servedToOwnerAt?: number }>;

      expect(body[0].servedToOwnerAt).toBeUndefined();
      expect(readFileSync(PROMPT_FILE, 'utf-8')).toBe(before); // byte-identical
    });
  });

  it('the dispatch mode cannot be changed from a browser (Origin header is refused)', async () => {
    await boot();
    grantConsent('good-token');
    await post('/watch/mode', { headless: true, consentToken: 'good-token' });
    expect(dispatcher.isHeadless()).toBe(true);

    // A hostile page cannot ENABLE headless (no token), but it must not be able to
    // DISABLE it either - that would stall an unattended daemon's queue forever.
    const res = await fetch(`http://localhost:${port}/watch/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', connection: 'close', Origin: 'https://evil.example' },
      body: JSON.stringify({ headless: false }),
    });

    expect(res.status).toBe(403);
    expect(dispatcher.isHeadless()).toBe(true); // still headless
  });

  it('PERSISTS the mode, so a daemon restart does not silently revert to owner', () => {
    expect(watch.isHeadless()).toBe(false); // default
    expect(watch.setHeadless(true).persisted).toBe(true);

    // A brand-new store over the same file - what the next daemon start does.
    const reloaded = new WatchStateStore(STATE_FILE);
    expect(reloaded.isHeadless()).toBe(true);
    expect(reloaded.isArmed()).toBe(true);              // did not clobber armed
    expect(reloaded.projectRoot()).toBe(projectRoot);   // ...or the root
  });

  // resolveHeadless() is the exact function index.ts calls to decide the boot
  // mode. Testing it (rather than re-implementing the `env || persisted` rule in
  // the test, which is what the first draft of this file did) means the test goes
  // red if the daemon ever stops honoring the persisted mode.
  describe('resolveHeadless - the daemon boot decision', () => {
    it('defaults to OWNER when nothing says otherwise', () => {
      expect(resolveHeadless(watch, {})).toBe(false);
    });

    it('honors the PERSISTED mode with no env var present', () => {
      watch.setHeadless(true);
      expect(resolveHeadless(new WatchStateStore(STATE_FILE), {})).toBe(true);
    });

    it('lets an explicit JUSTIFY_HEADLESS=1 win, for one-off and test runs', () => {
      expect(resolveHeadless(watch, { JUSTIFY_HEADLESS: '1' })).toBe(true);
    });

    it('treats any other JUSTIFY_HEADLESS value as off', () => {
      expect(resolveHeadless(watch, { JUSTIFY_HEADLESS: 'true' })).toBe(false);
      expect(resolveHeadless(watch, { JUSTIFY_HEADLESS: '0' })).toBe(false);
    });
  });

  it('a state file written before headless existed loads as OWNER (backward compat)', () => {
    writeFileSync(STATE_FILE, JSON.stringify({
      armed: true, projectRoot, armedAt: Date.now(), armedBy: 'jonah',
      disarmedAt: null, disarmedBy: null, // no `headless` key at all
    }));
    const legacy = new WatchStateStore(STATE_FILE);
    expect(legacy.isHeadless()).toBe(false);
    expect(legacy.isArmed()).toBe(true);
    expect(resolveHeadless(legacy, {})).toBe(false);
  });

  it('status() reports the mode, so a caller can tell a working watch from a waiting one', () => {
    dispatcher = new Dispatcher(watch, { port: 9223, stateDir: dir, tickMs: 25 });
    dispatcher.start();

    // Owner mode: armed, dispatcher live, and yet nothing will be applied. The
    // status has to make that visible - `dispatcherRunning:true` alone read
    // identically in both modes, which is what hid this for three days.
    expect(dispatcher.status().headless).toBe(false);
    expect(dispatcher.status().dispatcherRunning).toBe(true);
    expect(dispatcher.stalled()).toBe(true);

    dispatcher.setHeadless(true);
    expect(dispatcher.status().headless).toBe(true);
  });
});
