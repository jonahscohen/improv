// T-0026: fault-injection for the LSP subsystem. Every failure mode the spec
// calls out is forced here with an in-process fake transport - no real language
// server, so the suite is green regardless of what is installed.
//
// Covered: server crash mid-RPC, slow init (init-timeout), malformed responses,
// response for an unknown id, shutdown hang (force-kill), and per-language
// binary-missing -> DOWNSTREAM_UNAVAILABLE.

import { LspClient } from '../../src/lsp/client';
import { LspClientManager, type ProbeResult } from '../../src/lsp/index';
import { specForLanguage, type LanguageServerSpec } from '../../src/lsp/servers';
import { encodeMessage } from '../../src/lsp/framing';
import { SidecoachToolError } from '../../src/errors';
import { FakeTransport, autoRespond } from '../lsp-fakes';
import { test, assert } from '../harness';

const TS_SPEC = specForLanguage('typescript') as LanguageServerSpec;
const GO_SPEC = specForLanguage('go') as LanguageServerSpec;
const CTX = { rootUri: 'file:///root', cwd: '/root' };

function client(t: FakeTransport, overrides = {}) {
  return new LspClient(t, { languageId: 'typescript', requestTimeoutMs: 150, initTimeoutMs: 150, shutdownTimeoutMs: 80, ...overrides });
}

export async function run(): Promise<void> {
  await test('fault: server crash mid-RPC rejects the in-flight request', async () => {
    const t = new FakeTransport();
    const c = client(t);
    const inflight = c.request('textDocument/hover', {});
    t.crash(139, 'SIGSEGV'); // server segfaults while we wait
    try {
      await inflight;
      assert.fail('expected rejection');
    } catch (err) {
      assert.ok(err instanceof SidecoachToolError);
      assert.strictEqual((err as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    }
    assert.strictEqual(c.isAlive(), false);
  });

  await test('fault: slow init exceeds the init-timeout -> TIMEOUT, broken server evicted', async () => {
    // Transport that never answers `initialize`.
    const mgr = new LspClientManager({
      transportFactory: () => new FakeTransport(),
      probe: async (): Promise<ProbeResult> => ({ ok: true }),
      initTimeoutMs: 60,
      requestTimeoutMs: 60,
    });
    try {
      await mgr.acquire(TS_SPEC, CTX);
      assert.fail('expected init timeout');
    } catch (err) {
      assert.strictEqual((err as SidecoachToolError).code, 'TIMEOUT');
    }
    assert.strictEqual(mgr.serverCount(), 0, 'broken server must not linger in the pool');
  });

  await test('fault: malformed response frame is ignored; a later valid response still resolves', async () => {
    const t = new FakeTransport();
    t.onClientMessage = (msg) => {
      if (msg.id && msg.method === 'textDocument/hover') {
        // First: garbage bytes (bad Content-Length). Then: the real answer.
        t.emitRaw(Buffer.from('Content-Length: notanumber\r\n\r\n', 'ascii'));
        t.emit({ jsonrpc: '2.0', id: msg.id, result: { contents: 'recovered' } });
      }
    };
    const c = client(t);
    const res = (await c.request('textDocument/hover', {})) as any;
    assert.strictEqual(res.contents, 'recovered');
    assert.strictEqual(c.isAlive(), true, 'malformed frame must not kill the client');
  });

  await test('fault: a response for an unknown id is ignored, client stays usable', async () => {
    const t = new FakeTransport();
    autoRespond(t, { ping: () => 'pong' });
    const c = client(t);
    // Emit a response nobody is waiting for.
    t.emitRaw(encodeMessage({ jsonrpc: '2.0', id: 99999, result: { stray: true } }));
    assert.strictEqual(c.isAlive(), true);
    const res = await c.request('ping', {});
    assert.strictEqual(res, 'pong');
  });

  await test('fault: shutdown hang force-kills instead of blocking forever', async () => {
    const t = new FakeTransport();
    autoRespond(t, { /* no shutdown responder -> shutdown request will hang */ });
    // Override: strip the default shutdown responder so it never replies.
    t.onClientMessage = () => undefined;
    const c = client(t, { shutdownTimeoutMs: 50 });
    const start = Date.now();
    await c.shutdown(); // must resolve despite no shutdown response
    assert.ok(Date.now() - start < 2000, 'shutdown should not block');
    assert.ok(t.killSignals.length > 0, 'subprocess should have been killed');
  });

  await test('fault: binary missing is DOWNSTREAM_UNAVAILABLE per language', async () => {
    const mgr = new LspClientManager({
      transportFactory: () => new FakeTransport(),
      probe: async (spec): Promise<ProbeResult> => ({ ok: false, reason: `${spec.command} absent` }),
    });
    for (const spec of [TS_SPEC, GO_SPEC]) {
      try {
        await mgr.acquire(spec, CTX);
        assert.fail(`expected DOWNSTREAM_UNAVAILABLE for ${spec.id}`);
      } catch (err) {
        assert.strictEqual((err as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
        assert.strictEqual((err as SidecoachToolError).extra.resource, `lsp:${spec.id}`);
      }
    }
  });
}
