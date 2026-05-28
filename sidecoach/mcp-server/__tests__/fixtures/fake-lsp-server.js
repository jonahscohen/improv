#!/usr/bin/env node
// T-0026 test fixture: a minimal LSP server that speaks the real Content-Length
// framed JSON-RPC protocol over stdio. Used by the integration suite to drive a
// genuine subprocess round-trip through the real transport + framing, WITHOUT
// depending on any language server being installed on the machine.
//
// It is deliberately dumb: it ignores positions and returns canned results so
// assertions are deterministic.

'use strict';

let buf = Buffer.alloc(0);

function send(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function handle(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;
  // Notifications (no id) need no reply.
  if (typeof id !== 'number') {
    if (method === 'exit') process.exit(0);
    return;
  }
  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id,
        result: { capabilities: { hoverProvider: true, definitionProvider: true, documentSymbolProvider: true } },
      });
      break;
    case 'textDocument/hover':
      send({
        jsonrpc: '2.0',
        id,
        result: { contents: { kind: 'markdown', value: 'fake hover: const answer = 42' }, range: null },
      });
      break;
    case 'textDocument/definition':
      send({
        jsonrpc: '2.0',
        id,
        result: [
          {
            uri: (params && params.textDocument && params.textDocument.uri) || 'file:///unknown',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
          },
        ],
      });
      break;
    case 'textDocument/references':
      send({
        jsonrpc: '2.0',
        id,
        result: [
          {
            uri: (params && params.textDocument && params.textDocument.uri) || 'file:///unknown',
            range: { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } },
          },
        ],
      });
      break;
    case 'textDocument/documentSymbol':
      send({
        jsonrpc: '2.0',
        id,
        result: [
          {
            name: 'fakeTopLevel',
            kind: 12,
            range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            children: [
              {
                name: 'fakeNested',
                kind: 6,
                range: { start: { line: 2, character: 2 }, end: { line: 4, character: 2 } },
              },
            ],
          },
        ],
      });
      break;
    case 'workspace/symbol':
      send({
        jsonrpc: '2.0',
        id,
        result: [
          {
            name: 'fakeWorkspaceSymbol',
            kind: 12,
            location: {
              uri: 'file:///workspace/fake.ts',
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
            },
          },
        ],
      });
      break;
    case 'shutdown':
      send({ jsonrpc: '2.0', id, result: null });
      break;
    default:
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
  }
}

process.stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const sep = buf.indexOf('\r\n\r\n');
    if (sep === -1) break;
    const header = buf.slice(0, sep).toString('utf8');
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) {
      buf = buf.slice(sep + 4);
      continue;
    }
    const len = Number(m[1]);
    const start = sep + 4;
    if (buf.length < start + len) break;
    const body = buf.slice(start, start + len).toString('utf8');
    buf = buf.slice(start + len);
    try {
      handle(JSON.parse(body));
    } catch (e) {
      // ignore malformed input
    }
  }
});

process.stdin.on('end', () => process.exit(0));
