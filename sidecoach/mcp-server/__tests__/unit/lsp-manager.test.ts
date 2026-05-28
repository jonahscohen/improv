// T-0026: unit tests for lspClientManager - spawn-on-demand, server reuse,
// lease-protected eviction, idle eviction, binary probe, and teardown. Uses a
// fake transport factory + mock clock so no real language server is needed.

import {
  LspClientManager,
  probeBinaryOnPath,
  type ProbeResult,
} from '../../src/lsp/index';
import { specForLanguage, type LanguageServerSpec } from '../../src/lsp/servers';
import { SidecoachToolError } from '../../src/errors';
import { FakeTransport, autoRespond } from '../lsp-fakes';
import { test, assert } from '../harness';

const TS_SPEC = specForLanguage('typescript') as LanguageServerSpec;

function makeClock(initial = 1_000_000) {
  let now = initial;
  return { read: () => now, advance: (d: number) => { now += d; } };
}

function okProbe(): (spec: LanguageServerSpec) => Promise<ProbeResult> {
  return async () => ({ ok: true });
}

function fakeFactory(transports: FakeTransport[]) {
  return () => {
    const t = new FakeTransport();
    autoRespond(t);
    transports.push(t);
    return t;
  };
}

const CTX = { rootUri: 'file:///root', cwd: '/root' };

export async function run(): Promise<void> {
  await test('manager: acquire spawns and initializes a server', async () => {
    const clock = makeClock();
    const transports: FakeTransport[] = [];
    const mgr = new LspClientManager({ transportFactory: fakeFactory(transports), probe: okProbe(), clock: clock.read });
    const lease = await mgr.acquire(TS_SPEC, CTX);
    assert.strictEqual(mgr.serverCount(), 1);
    assert.strictEqual(lease.client.isInitialized(), true);
    lease.release();
  });

  await test('manager: a second acquire for the same language reuses the server', async () => {
    const clock = makeClock();
    const transports: FakeTransport[] = [];
    const mgr = new LspClientManager({ transportFactory: fakeFactory(transports), probe: okProbe(), clock: clock.read });
    const l1 = await mgr.acquire(TS_SPEC, CTX);
    const l2 = await mgr.acquire(TS_SPEC, CTX);
    assert.strictEqual(mgr.serverCount(), 1, 'should reuse, not spawn a second');
    assert.strictEqual(transports.length, 1);
    l1.release();
    l2.release();
  });

  await test('manager: a held lease prevents idle eviction', async () => {
    const clock = makeClock();
    const mgr = new LspClientManager({
      transportFactory: fakeFactory([]),
      probe: okProbe(),
      clock: clock.read,
      idleMs: 1000,
    });
    const lease = await mgr.acquire(TS_SPEC, CTX);
    clock.advance(10_000); // well past idle threshold
    const evicted = mgr.evictIdle();
    assert.strictEqual(evicted, 0, 'leased server must NOT be evicted');
    assert.strictEqual(mgr.serverCount(), 1);
    lease.release();
  });

  await test('manager: idle eviction fires once the lease is released and time passes', async () => {
    const clock = makeClock();
    const mgr = new LspClientManager({
      transportFactory: fakeFactory([]),
      probe: okProbe(),
      clock: clock.read,
      idleMs: 1000,
    });
    const lease = await mgr.acquire(TS_SPEC, CTX);
    lease.release();
    clock.advance(2000);
    const evicted = mgr.evictIdle();
    assert.strictEqual(evicted, 1);
    assert.strictEqual(mgr.serverCount(), 0);
  });

  await test('manager: missing binary surfaces DOWNSTREAM_UNAVAILABLE', async () => {
    const mgr = new LspClientManager({
      transportFactory: fakeFactory([]),
      probe: async () => ({ ok: false, reason: 'not installed' }),
    });
    try {
      await mgr.acquire(TS_SPEC, CTX);
      assert.fail('expected DOWNSTREAM_UNAVAILABLE');
    } catch (err) {
      assert.ok(err instanceof SidecoachToolError);
      assert.strictEqual((err as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
      assert.strictEqual((err as SidecoachToolError).extra.resource, 'lsp:typescript');
    }
  });

  await test('manager: shutdownAll tears down every server', async () => {
    const transports: FakeTransport[] = [];
    const mgr = new LspClientManager({ transportFactory: fakeFactory(transports), probe: okProbe() });
    const lease = await mgr.acquire(TS_SPEC, CTX);
    lease.release();
    await mgr.shutdownAll();
    assert.strictEqual(mgr.serverCount(), 0);
    assert.ok(transports[0].killSignals.length > 0, 'transport should have been killed');
  });

  await test('manager: probeBinaryOnPath finds node and rejects a bogus binary', async () => {
    assert.strictEqual(probeBinaryOnPath('node').ok, true);
    assert.strictEqual(probeBinaryOnPath('definitely-not-a-real-binary-xyz123').ok, false);
  });

  await test('manager: a dead pooled server is replaced on the next acquire', async () => {
    const clock = makeClock();
    const transports: FakeTransport[] = [];
    const mgr = new LspClientManager({ transportFactory: fakeFactory(transports), probe: okProbe(), clock: clock.read });
    const l1 = await mgr.acquire(TS_SPEC, CTX);
    l1.release();
    transports[0].crash(1, null); // server died
    const l2 = await mgr.acquire(TS_SPEC, CTX);
    assert.strictEqual(transports.length, 2, 'a fresh server should have been spawned');
    assert.strictEqual(l2.client.isAlive(), true);
    l2.release();
  });
}
