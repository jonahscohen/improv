// T-0026: integration tests for the 5 LSP tools through the real MCP SDK
// in-memory transport.
//
// Three layers of coverage that do NOT require a real language server:
//   1. DOWNSTREAM_UNAVAILABLE when no server binary is on PATH (injected probe).
//   2. A genuine SUBPROCESS round-trip via a fixture LSP server
//      (__tests__/fixtures/fake-lsp-server.js) that speaks the real
//      Content-Length framed protocol over stdio. This exercises client.ts +
//      framing.ts + the manager + the tool handlers end-to-end.
//   3. Path-escape and unsupported-file-type guards.
//
// A fourth, OPTIONAL layer runs one real round-trip IF a real language server
// (e.g. typescript-language-server) is detected on PATH - otherwise it logs a
// skip. Absence of a server never fails the suite.

import * as path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildServer } from '../../src/server';
import { createLogger } from '../../src/logger';
import { spawnChildTransport, type RawTransport } from '../../src/lsp/client';
import {
  LspClientManager,
  setSharedLspManager,
  resetSharedLspManager,
  probeBinaryOnPath,
} from '../../src/lsp/index';
import { specForFile, type LanguageServerSpec } from '../../src/lsp/servers';
import { PROJECT_ROOT_ENV } from '../../src/project-root';
import { test, assert } from '../harness';

const MCP_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(__dirname, '..', 'fixtures', 'fake-lsp-server.js');

function silentLogger() {
  return createLogger({ level: 'error', write: () => undefined });
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const built = buildServer({ logger: silentLogger() });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await built.mcp.connect(serverTransport);
  const client = new Client({ name: 'lsp-integration-test', version: '0.0.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  try {
    return await fn(client);
  } finally {
    await client.close();
    await built.close();
  }
}

/** A manager whose servers are the fixture node script (real subprocess). */
function fixtureManager(): LspClientManager {
  return new LspClientManager({
    transportFactory: (_spec: LanguageServerSpec, cwd: string): RawTransport =>
      spawnChildTransport('node', [FIXTURE], cwd),
    probe: async () => ({ ok: true }),
    requestTimeoutMs: 8_000,
    initTimeoutMs: 8_000,
    shutdownTimeoutMs: 1_000,
  });
}

function body(res: any): any {
  // index.ts pushes [summary, jsonData] on success; [errorJson] on error.
  return JSON.parse((res.content as any[])[res.isError ? 0 : 1].text);
}

export async function run(): Promise<void> {
  // --- Layer 1: graceful unavailability ---
  await test('lsp_hover returns DOWNSTREAM_UNAVAILABLE when no server binary on PATH', async () => {
    const mgr = new LspClientManager({
      transportFactory: () => spawnChildTransport('node', [FIXTURE], MCP_ROOT),
      probe: async () => ({ ok: false, reason: 'simulated-missing' }),
    });
    setSharedLspManager(mgr);
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    try {
      await withClient(async (client) => {
        const res = await client.callTool({
          name: 'sidecoach_lsp_hover',
          arguments: { file: 'src/index.ts', line: 0, character: 0 },
        });
        assert.strictEqual(res.isError, true);
        const b = body(res);
        assert.strictEqual(b.code, 'DOWNSTREAM_UNAVAILABLE');
        assert.strictEqual(b.resource, 'lsp:typescript');
      });
    } finally {
      delete process.env[PROJECT_ROOT_ENV];
      resetSharedLspManager();
    }
  });

  // --- Layer 3: input guards ---
  await test('lsp_hover rejects a path escaping the project root with INVALID_INPUT', async () => {
    const mgr = fixtureManager();
    setSharedLspManager(mgr);
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    try {
      await withClient(async (client) => {
        const res = await client.callTool({
          name: 'sidecoach_lsp_hover',
          arguments: { file: '../../../../etc/hosts', line: 0, character: 0 },
        });
        assert.strictEqual(res.isError, true);
        assert.strictEqual(body(res).code, 'INVALID_INPUT');
      });
    } finally {
      delete process.env[PROJECT_ROOT_ENV];
      await mgr.shutdownAll();
      resetSharedLspManager();
    }
  });

  await test('lsp_hover on an unsupported file type returns DOWNSTREAM_UNAVAILABLE', async () => {
    const mgr = fixtureManager();
    setSharedLspManager(mgr);
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    try {
      await withClient(async (client) => {
        const res = await client.callTool({
          name: 'sidecoach_lsp_hover',
          arguments: { file: 'package.json', line: 0, character: 0 },
        });
        assert.strictEqual(res.isError, true);
        assert.strictEqual(body(res).code, 'DOWNSTREAM_UNAVAILABLE');
      });
    } finally {
      delete process.env[PROJECT_ROOT_ENV];
      await mgr.shutdownAll();
      resetSharedLspManager();
    }
  });

  // --- Layer 2: real subprocess round-trips against the fixture server ---
  await test('lsp_hover round-trips through a real subprocess LSP server (fixture)', async () => {
    const mgr = fixtureManager();
    setSharedLspManager(mgr);
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    try {
      await withClient(async (client) => {
        const res = await client.callTool({
          name: 'sidecoach_lsp_hover',
          arguments: { file: 'src/index.ts', line: 20, character: 10 },
        });
        if (res.isError) {
          // eslint-disable-next-line no-console
          console.log('    hover isError:', JSON.stringify(body(res)));
        }
        assert.notStrictEqual(res.isError, true);
        const b = body(res);
        assert.strictEqual(b.found, true);
        assert.ok(b.contents.includes('fake hover'));
        assert.strictEqual(b.language, 'typescript');
      });
    } finally {
      delete process.env[PROJECT_ROOT_ENV];
      await mgr.shutdownAll();
      resetSharedLspManager();
    }
  });

  await test('lsp_document_symbols round-trips and flattens nested symbols (fixture)', async () => {
    const mgr = fixtureManager();
    setSharedLspManager(mgr);
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    try {
      await withClient(async (client) => {
        const res = await client.callTool({
          name: 'sidecoach_lsp_document_symbols',
          arguments: { file: 'src/index.ts' },
        });
        assert.notStrictEqual(res.isError, true);
        const b = body(res);
        // Fixture returns one top-level symbol with one nested child -> 2 flat.
        assert.strictEqual(b.symbolCount, 2);
        assert.deepStrictEqual(b.symbols.map((s: any) => s.name), ['fakeTopLevel', 'fakeNested']);
      });
    } finally {
      delete process.env[PROJECT_ROOT_ENV];
      await mgr.shutdownAll();
      resetSharedLspManager();
    }
  });

  await test('lsp_goto_definition round-trips and relativizes the uri (fixture)', async () => {
    const mgr = fixtureManager();
    setSharedLspManager(mgr);
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    try {
      await withClient(async (client) => {
        const res = await client.callTool({
          name: 'sidecoach_lsp_goto_definition',
          arguments: { file: 'src/index.ts', line: 5, character: 3 },
        });
        assert.notStrictEqual(res.isError, true);
        const b = body(res);
        assert.strictEqual(b.definitionCount, 1);
        // Fixture echoes the opened doc uri; it should be relativized to src/index.ts.
        assert.strictEqual(b.definitions[0].uri, 'src/index.ts');
      });
    } finally {
      delete process.env[PROJECT_ROOT_ENV];
      await mgr.shutdownAll();
      resetSharedLspManager();
    }
  });

  await test('lsp_workspace_symbols round-trips a query (fixture)', async () => {
    const mgr = fixtureManager();
    setSharedLspManager(mgr);
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    try {
      await withClient(async (client) => {
        const res = await client.callTool({
          name: 'sidecoach_lsp_workspace_symbols',
          arguments: { query: 'fake', language: 'typescript' },
        });
        assert.notStrictEqual(res.isError, true);
        const b = body(res);
        assert.strictEqual(b.symbolCount, 1);
        assert.strictEqual(b.symbols[0].name, 'fakeWorkspaceSymbol');
      });
    } finally {
      delete process.env[PROJECT_ROOT_ENV];
      await mgr.shutdownAll();
      resetSharedLspManager();
    }
  });

  // --- Layer 4: optional real-server round-trip (skips if none installed) ---
  await test('lsp_document_symbols against a REAL language server (skipped if none on PATH)', async () => {
    const spec = specForFile('src/index.ts') as LanguageServerSpec;
    if (!probeBinaryOnPath(spec.command).ok) {
      // eslint-disable-next-line no-console
      console.log(`    (skipped: ${spec.command} not on PATH - exercised the DOWNSTREAM path instead)`);
      return;
    }
    // A real server IS present - do one genuine round-trip via the default manager.
    resetSharedLspManager();
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    try {
      await withClient(async (client) => {
        const res = await client.callTool({
          name: 'sidecoach_lsp_document_symbols',
          arguments: { file: 'src/index.ts' },
        });
        const b = body(res);
        // eslint-disable-next-line no-console
        console.log(`    real ${spec.command}: isError=${res.isError === true} symbolCount=${b.symbolCount ?? 'n/a'}`);
        assert.notStrictEqual(res.isError, true);
        assert.ok(typeof b.symbolCount === 'number');
      });
    } finally {
      delete process.env[PROJECT_ROOT_ENV];
      const { peekSharedLspManager } = require('../../src/lsp/index');
      const mgr = peekSharedLspManager();
      if (mgr) await mgr.shutdownAll();
      resetSharedLspManager();
    }
  });
}
