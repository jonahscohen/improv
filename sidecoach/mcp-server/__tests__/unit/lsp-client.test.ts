// T-0026: unit tests for the LSP JSON-RPC client, driven entirely by an
// in-process FakeTransport (no subprocess, no real language server).

import { LspClient } from '../../src/lsp/client';
import { SidecoachToolError } from '../../src/errors';
import { FakeTransport, autoRespond } from '../lsp-fakes';
import { test, assert } from '../harness';

function newClient(transport: FakeTransport, overrides = {}) {
  return new LspClient(transport, {
    languageId: 'typescript',
    requestTimeoutMs: 200,
    initTimeoutMs: 200,
    shutdownTimeoutMs: 100,
    ...overrides,
  });
}

export async function run(): Promise<void> {
  await test('client: initialize resolves and sends the initialized notification', async () => {
    const t = new FakeTransport();
    autoRespond(t);
    const client = newClient(t);
    const result = await client.initialize('file:///root');
    assert.deepStrictEqual(result, { capabilities: {} });
    assert.strictEqual(client.isInitialized(), true);
    // The handshake must include an `initialized` notification (no id).
    const notif = t.clientMessages.find((m: any) => m.method === 'initialized' && m.id === undefined);
    assert.ok(notif, 'expected an initialized notification');
  });

  await test('client: request correlates the response by id', async () => {
    const t = new FakeTransport();
    autoRespond(t, { 'textDocument/hover': () => ({ contents: 'hi' }) });
    const client = newClient(t);
    const res = (await client.request('textDocument/hover', {})) as any;
    assert.deepStrictEqual(res, { contents: 'hi' });
  });

  await test('client: concurrent requests get distinct ids', async () => {
    const t = new FakeTransport();
    // Do not auto-respond; just inspect the ids the client wrote.
    const client = newClient(t);
    const p1 = client.request('a').catch(() => undefined);
    const p2 = client.request('b').catch(() => undefined);
    const ids = t.clientMessages.filter((m: any) => m.method === 'a' || m.method === 'b').map((m: any) => m.id);
    assert.strictEqual(ids.length, 2);
    assert.notStrictEqual(ids[0], ids[1]);
    await Promise.all([p1, p2]); // let timeouts settle
  });

  await test('client: a server error response rejects with VALIDATOR_FAILURE', async () => {
    const t = new FakeTransport();
    t.onClientMessage = (msg) => {
      if (msg.id && msg.method === 'textDocument/hover') {
        t.emit({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'boom' } });
      }
    };
    const client = newClient(t);
    try {
      await client.request('textDocument/hover', {});
      assert.fail('expected rejection');
    } catch (err) {
      assert.ok(err instanceof SidecoachToolError);
      assert.strictEqual((err as SidecoachToolError).code, 'VALIDATOR_FAILURE');
    }
  });

  await test('client: request times out when the server never responds', async () => {
    const t = new FakeTransport();
    const client = newClient(t, { requestTimeoutMs: 50 });
    try {
      await client.request('textDocument/hover', {});
      assert.fail('expected timeout');
    } catch (err) {
      assert.strictEqual((err as SidecoachToolError).code, 'TIMEOUT');
    }
  });

  await test('client: a server->client request gets a null reply (no stall)', async () => {
    const t = new FakeTransport();
    const client = newClient(t);
    // Server asks the client something (e.g. workspace/configuration).
    t.emit({ jsonrpc: '2.0', id: 4242, method: 'workspace/configuration', params: {} });
    const reply = t.clientMessages.find((m: any) => m.id === 4242);
    assert.ok(reply, 'client must answer a server-issued request');
    assert.strictEqual((reply as any).result, null);
    void client;
  });

  await test('client: request after transport death rejects DOWNSTREAM_UNAVAILABLE', async () => {
    const t = new FakeTransport();
    const client = newClient(t);
    t.crash(1, null);
    assert.strictEqual(client.isAlive(), false);
    try {
      await client.request('textDocument/hover', {});
      assert.fail('expected rejection');
    } catch (err) {
      assert.strictEqual((err as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    }
  });

  await test('client: didOpen / didClose emit notifications with the right uri', async () => {
    const t = new FakeTransport();
    const client = newClient(t);
    client.didOpen('file:///a.ts', 'const x = 1;');
    client.didClose('file:///a.ts');
    const open = t.lastRequest('textDocument/didOpen');
    const close = t.lastRequest('textDocument/didClose');
    assert.ok(open && open.params.textDocument.uri === 'file:///a.ts');
    assert.strictEqual(open.params.textDocument.languageId, 'typescript');
    assert.ok(close && close.params.textDocument.uri === 'file:///a.ts');
  });
}
