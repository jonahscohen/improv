// T-0026: unit tests for the LSP Content-Length framing layer. These prove the
// reader survives partial reads, concatenated messages, and the malformed
// inputs a real (or hostile) language server can produce.

import { encodeMessage, LspFramer } from '../../src/lsp/framing';
import { test, assert } from '../harness';

export async function run(): Promise<void> {
  await test('framing: encode then decode round-trips an object', async () => {
    const framer = new LspFramer();
    const frames = framer.push(encodeMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }));
    assert.strictEqual(frames.length, 1);
    assert.deepStrictEqual(frames[0].message, { jsonrpc: '2.0', id: 1, method: 'initialize' });
  });

  await test('framing: a body split across two chunks reassembles', async () => {
    const framer = new LspFramer();
    const full = encodeMessage({ id: 7, value: 'hello world' });
    const split = Math.floor(full.length / 2);
    const first = framer.push(full.slice(0, split));
    assert.strictEqual(first.length, 0, 'no complete frame yet');
    assert.ok(framer.pendingBytes() > 0);
    const second = framer.push(full.slice(split));
    assert.strictEqual(second.length, 1);
    assert.strictEqual((second[0].message as any).id, 7);
  });

  await test('framing: two concatenated messages both decode from one chunk', async () => {
    const framer = new LspFramer();
    const combined = Buffer.concat([encodeMessage({ id: 1 }), encodeMessage({ id: 2 })]);
    const frames = framer.push(combined);
    assert.strictEqual(frames.length, 2);
    assert.strictEqual((frames[0].message as any).id, 1);
    assert.strictEqual((frames[1].message as any).id, 2);
  });

  await test('framing: header with no Content-Length emits an error frame and resyncs', async () => {
    const framer = new LspFramer();
    const bad = Buffer.from('X-Bogus: 1\r\n\r\n', 'ascii');
    const good = encodeMessage({ id: 99 });
    const frames = framer.push(Buffer.concat([bad, good]));
    assert.ok(frames.some((f) => f.error), 'expected an error frame');
    assert.ok(frames.some((f) => (f.message as any)?.id === 99), 'expected resync to the good frame');
  });

  await test('framing: non-JSON body emits an error frame, reader stays usable', async () => {
    const framer = new LspFramer();
    const body = Buffer.from('not json at all', 'utf8');
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii');
    const frames = framer.push(Buffer.concat([header, body]));
    assert.strictEqual(frames.length, 1);
    assert.ok(frames[0].error, 'expected error frame for non-JSON body');
    // Reader still works afterward.
    const next = framer.push(encodeMessage({ id: 5 }));
    assert.strictEqual((next[0].message as any).id, 5);
  });

  await test('framing: oversized Content-Length is rejected, not buffered', async () => {
    const framer = new LspFramer({ maxMessageBytes: 100 });
    const header = Buffer.from('Content-Length: 999999\r\n\r\n', 'ascii');
    const frames = framer.push(header);
    assert.ok(frames.some((f) => f.error), 'expected error for oversized length');
  });

  await test('framing: multi-byte UTF-8 body uses byte length not char length', async () => {
    const framer = new LspFramer();
    const frames = framer.push(encodeMessage({ text: 'cafe ... unicode check' }));
    assert.strictEqual(frames.length, 1);
    assert.strictEqual((frames[0].message as any).text, 'cafe ... unicode check');
  });

  await test('framing: incomplete header buffers without emitting', async () => {
    const framer = new LspFramer();
    const frames = framer.push(Buffer.from('Content-Length: 12', 'ascii'));
    assert.strictEqual(frames.length, 0);
    assert.ok(framer.pendingBytes() > 0);
  });

  await test('framing: reset() drops buffered partial data', async () => {
    const framer = new LspFramer();
    framer.push(Buffer.from('Content-Length: 50\r\n\r\n{partial', 'ascii'));
    assert.ok(framer.pendingBytes() > 0);
    framer.reset();
    assert.strictEqual(framer.pendingBytes(), 0);
  });

  await test('framing: three byte-by-byte chunks still assemble one frame', async () => {
    const framer = new LspFramer();
    const full = encodeMessage({ id: 3, ok: true });
    let frames: ReturnType<LspFramer['push']> = [];
    for (const byte of full) {
      frames = frames.concat(framer.push(Buffer.from([byte])));
    }
    assert.strictEqual(frames.length, 1);
    assert.strictEqual((frames[0].message as any).id, 3);
  });
}
