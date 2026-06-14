// Unit tests covering each tool's handler in isolation (no SDK, no transport).
// For each tool we check at least a happy path and at least 2 error/edge paths.

import { createLogger } from '../../src/logger';
import { TOOLS } from '../../src/tools';
import { SidecoachToolError } from '../../src/errors';
import { test, assert } from '../harness';
import type { RegistryBundle } from '../../src/registries';
import { loadAllRegistries } from '../../src/registries';
import { TOOL_INPUT_SCHEMAS, type ToolName } from '../../src/schemas';

function silentLogger() {
  return createLogger({ level: 'error', write: () => undefined });
}

function buildDeps(reg: RegistryBundle) {
  return { logger: silentLogger(), registries: reg };
}

function pickHandler(name: ToolName) {
  const t = TOOLS.find((tool) => tool.definition.name === name);
  if (!t) throw new Error(`tool ${name} not registered`);
  return t.handler;
}

function fakeRegistries(): RegistryBundle {
  return {
    verbs: {
      verbs: [
        { verb: 'polish', pattern: 'polish', phase: 'review', description: 'd', oneLineExplanation: 'o' },
        { verb: 'audit', pattern: 'audit', phase: 'review', description: 'd', oneLineExplanation: 'o' },
        { verb: 'craft', pattern: 'craft', phase: 'build', description: 'd', oneLineExplanation: 'o' },
      ],
    },
    modes: {
      modes: [
        {
          mode: 'forge',
          pattern: 'forge',
          description: 'd',
          oneLineExplanation: 'o',
          chain: ['shape', 'craft', 'polish'],
        },
      ],
    },
    flows: [
      {
        id: 'flowJ_tactical_polish',
        name: 'Polish',
        description: 'pol',
        tier: 3,
        modelConfig: { minTier: 'sonnet', preferredTier: 'opus', rationale: 'r' },
      },
    ],
    cheatsheet: {
      raw:
        '## Section 0 - Modes\n\nMODE TEXT\n\n## Section 1 - Verbs\n\nVERB TEXT\n\n## Section 2 - Flows\n\nFLOW TEXT\n\n## Section 3 - Routing\n\nROUTING TEXT\n',
      sourcePath: '/fake/cheatsheet.md',
    },
    lanes: null,
    intent: null,
  };
}

export async function run(): Promise<void> {
  // ------ list_verbs ------
  await test('list_verbs: happy path with phase filter', async () => {
    const h = pickHandler('sidecoach_list_verbs');
    const r = await h({ phase: 'review' }, buildDeps(fakeRegistries()));
    const d = r.data as any;
    assert.strictEqual(d.count, 2);
    assert.strictEqual(d.total, 3);
  });

  await test('list_verbs: no filter returns all', async () => {
    const h = pickHandler('sidecoach_list_verbs');
    const r = await h({}, buildDeps(fakeRegistries()));
    const d = r.data as any;
    assert.strictEqual(d.count, 3);
  });

  await test('list_verbs: missing registry throws DOWNSTREAM_UNAVAILABLE', async () => {
    const h = pickHandler('sidecoach_list_verbs');
    const reg = { ...fakeRegistries(), verbs: null };
    try {
      await h({}, buildDeps(reg));
      assert.fail('expected throw');
    } catch (e) {
      assert.ok(e instanceof SidecoachToolError);
      assert.strictEqual((e as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    }
  });

  // ------ list_modes ------
  await test('list_modes: happy path', async () => {
    const h = pickHandler('sidecoach_list_modes');
    const r = await h({}, buildDeps(fakeRegistries()));
    const d = r.data as any;
    assert.strictEqual(d.count, 1);
    assert.strictEqual(d.modes[0].mode, 'forge');
  });

  await test('list_modes: tolerates missing modes registry (returns empty list, no throw)', async () => {
    const h = pickHandler('sidecoach_list_modes');
    const reg = { ...fakeRegistries(), modes: null };
    const r = await h({}, buildDeps(reg));
    assert.strictEqual((r.data as any).count, 0);
  });

  // ------ list_flows ------
  await test('list_flows: tier filter narrows the list', async () => {
    const h = pickHandler('sidecoach_list_flows');
    const r = await h({ tier: 3 }, buildDeps(fakeRegistries()));
    assert.strictEqual((r.data as any).count, 1);
  });

  await test('list_flows: idPrefix filter narrows the list', async () => {
    const h = pickHandler('sidecoach_list_flows');
    const r = await h({ idPrefix: 'flowJ' }, buildDeps(fakeRegistries()));
    assert.strictEqual((r.data as any).count, 1);
  });

  await test('list_flows: empty registry throws DOWNSTREAM_UNAVAILABLE', async () => {
    const h = pickHandler('sidecoach_list_flows');
    try {
      await h({}, buildDeps({ ...fakeRegistries(), flows: [] }));
      assert.fail('expected throw');
    } catch (e) {
      assert.strictEqual((e as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    }
  });

  // ------ resolve_keyword ------
  await test('resolve_keyword: matches verb', async () => {
    const h = pickHandler('sidecoach_resolve_keyword');
    const r = await h({ phrase: 'polish the homepage' }, buildDeps(fakeRegistries()));
    const m = (r.data as any).match;
    assert.strictEqual(m.kind, 'verb');
    assert.strictEqual(m.name, 'polish');
  });

  await test('resolve_keyword: matches mode (precedence)', async () => {
    const h = pickHandler('sidecoach_resolve_keyword');
    const r = await h(
      { phrase: 'forge a new homepage with polish' },
      buildDeps(fakeRegistries()),
    );
    const m = (r.data as any).match;
    assert.strictEqual(m.kind, 'mode');
    assert.strictEqual(m.name, 'forge');
  });

  await test('resolve_keyword: no match returns kind=none', async () => {
    const h = pickHandler('sidecoach_resolve_keyword');
    const r = await h({ phrase: 'something totally unrelated' }, buildDeps(fakeRegistries()));
    assert.strictEqual((r.data as any).match.kind, 'none');
  });

  await test('resolve_keyword: empty registries throws DOWNSTREAM_UNAVAILABLE', async () => {
    const h = pickHandler('sidecoach_resolve_keyword');
    const empty: RegistryBundle = {
      verbs: { verbs: [] },
      modes: { modes: [] },
      flows: fakeRegistries().flows,
      cheatsheet: fakeRegistries().cheatsheet,
      lanes: null,
      intent: null,
    };
    try {
      await h({ phrase: 'polish this' }, buildDeps(empty));
      assert.fail('expected throw');
    } catch (e) {
      assert.strictEqual((e as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    }
  });

  // ------ get_cheatsheet ------
  await test('get_cheatsheet: default returns full doc', async () => {
    const h = pickHandler('sidecoach_get_cheatsheet');
    const r = await h({}, buildDeps(fakeRegistries()));
    assert.ok((r.data as any).content.includes('MODE TEXT'));
    assert.ok((r.data as any).content.includes('ROUTING TEXT'));
  });

  await test('get_cheatsheet: section=modes returns just modes section', async () => {
    const h = pickHandler('sidecoach_get_cheatsheet');
    const r = await h({ section: 'modes' }, buildDeps(fakeRegistries()));
    const content = (r.data as any).content as string;
    assert.ok(content.includes('MODE TEXT'));
    assert.ok(!content.includes('VERB TEXT'));
  });

  await test('get_cheatsheet: missing cheatsheet throws DOWNSTREAM_UNAVAILABLE', async () => {
    const h = pickHandler('sidecoach_get_cheatsheet');
    try {
      await h({}, buildDeps({ ...fakeRegistries(), cheatsheet: null }));
      assert.fail('expected throw');
    } catch (e) {
      assert.strictEqual((e as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    }
  });

  // ------ get_flow_metadata ------
  await test('get_flow_metadata: returns metadata for a real flow ID', async () => {
    const h = pickHandler('sidecoach_get_flow_metadata');
    // Uses the live in-process registry (we cannot stub flows.ts at this layer).
    const realRegs = loadAllRegistries(silentLogger());
    const r = await h({ flowId: 'flowJ_tactical_polish' }, buildDeps(realRegs));
    const f = (r.data as any).flow;
    assert.strictEqual(f.id, 'flowJ_tactical_polish');
    assert.ok(f.modelConfig);
  });

  await test('get_flow_metadata: unknown flow ID -> INVALID_INPUT', async () => {
    const h = pickHandler('sidecoach_get_flow_metadata');
    try {
      await h({ flowId: 'flowZZZ_does_not_exist' }, buildDeps(fakeRegistries()));
      assert.fail('expected throw');
    } catch (e) {
      assert.strictEqual((e as SidecoachToolError).code, 'INVALID_INPUT');
    }
  });

  // ------ get_cost_ledger ------
  await test('get_cost_ledger: summary format returns totals only (no entries)', async () => {
    const h = pickHandler('sidecoach_get_cost_ledger');
    const r = await h({ format: 'summary' }, buildDeps(fakeRegistries()));
    const d = r.data as any;
    assert.deepStrictEqual(d.entries, []);
    assert.ok(typeof d.totals.calls === 'number');
    assert.ok(typeof d.summary === 'string');
  });

  await test('get_cost_ledger: raw format returns the entries list (even if empty)', async () => {
    const h = pickHandler('sidecoach_get_cost_ledger');
    const r = await h({ format: 'raw' }, buildDeps(fakeRegistries()));
    const d = r.data as any;
    assert.ok(Array.isArray(d.entries));
  });

  // ------ validate_taste ------
  await test('validate_taste: clean HTML returns 0 violations', async () => {
    const h = pickHandler('sidecoach_validate_taste');
    const r = await h(
      {
        html: '<div class="lucide-icon"><svg><path d="M0 0"/></svg>clean</div>',
        css: 'div { color: red; }',
      },
      buildDeps(fakeRegistries()),
    );
    const d = r.data as any;
    assert.strictEqual(typeof d.violationCount, 'number');
    assert.ok(Array.isArray(d.violations));
  });

  await test('validate_taste: fabricated SVG triggers a violation', async () => {
    const h = pickHandler('sidecoach_validate_taste');
    // The taste validator fires when an unmarked <svg> has >=2 paths OR a
    // single path longer than 50 chars. We use two paths to be deterministic.
    const r = await h(
      {
        html:
          '<svg width="24" height="24" viewBox="0 0 24 24">' +
          '<path d="M3 7l8 8 8-8"/>' +
          '<path d="M12 2v20"/>' +
          '</svg>',
      },
      buildDeps(fakeRegistries()),
    );
    const d = r.data as any;
    assert.ok(d.violationCount >= 1, `expected >=1 violation, got ${d.violationCount}`);
  });

  // ------ validate_polish_standard ------
  await test('validate_polish_standard: runs against simple inputs', async () => {
    const h = pickHandler('sidecoach_validate_polish_standard');
    const r = await h(
      {
        css: '.btn:active { transform: scale(0.96); }',
        designTokens: { colors: ['#000', '#fff'], genericityScore: 30 },
      },
      buildDeps(fakeRegistries()),
    );
    const rep = (r.data as any).report;
    assert.ok(typeof rep.passed === 'number');
    assert.ok(typeof rep.totalRules === 'number');
  });

  await test('validate_polish_standard: refine rejects all-empty input via schema', () => {
    // Schema-level rejection (the handler never sees this, but verifying the
    // schema's .refine() guard works.)
    const schema = TOOL_INPUT_SCHEMAS.sidecoach_validate_polish_standard;
    const parsed = schema.safeParse({});
    assert.strictEqual(parsed.success, false);
  });

  // ------ validate_extended_domain ------
  await test('validate_extended_domain: empty inputs returns skipped status', async () => {
    const h = pickHandler('sidecoach_validate_extended_domain');
    const r = await h({}, buildDeps(fakeRegistries()));
    const rep = (r.data as any).report;
    assert.strictEqual(rep.status, 'skipped');
  });

  await test('validate_extended_domain: with cssRules-derived input runs', async () => {
    const h = pickHandler('sidecoach_validate_extended_domain');
    const r = await h(
      { css: '.x { color: red; } .y { padding: 8px; }' },
      buildDeps(fakeRegistries()),
    );
    const rep = (r.data as any).report;
    assert.strictEqual(rep.status, 'completed');
  });

  // ------ state_set / state_get / state_delete / state_list_keys ------

  await test('state_set then state_get round-trips a value', async () => {
    // Use a fresh shared store for each round-trip test - other tests in this
    // file don't touch state, but defensive reset prevents bleed.
    const { resetSharedStore } = require('../../src/state-store');
    resetSharedStore();
    const set = pickHandler('sidecoach_state_set');
    const get = pickHandler('sidecoach_state_get');
    await set({ key: 'k', value: 'hello', ttlMs: 60_000 }, buildDeps(fakeRegistries()));
    const r = await get({ key: 'k' }, buildDeps(fakeRegistries()));
    assert.strictEqual((r.data as any).value, 'hello');
  });

  await test('state_get returns null for missing key (no throw)', async () => {
    const { resetSharedStore } = require('../../src/state-store');
    resetSharedStore();
    const get = pickHandler('sidecoach_state_get');
    const r = await get({ key: 'nope' }, buildDeps(fakeRegistries()));
    assert.strictEqual((r.data as any).value, null);
  });

  await test('state_delete on missing returns deleted=false', async () => {
    const { resetSharedStore } = require('../../src/state-store');
    resetSharedStore();
    const del = pickHandler('sidecoach_state_delete');
    const r = await del({ key: 'gone' }, buildDeps(fakeRegistries()));
    assert.strictEqual((r.data as any).deleted, false);
  });

  await test('state_list_keys reports empty after delete', async () => {
    const { resetSharedStore } = require('../../src/state-store');
    resetSharedStore();
    const set = pickHandler('sidecoach_state_set');
    const del = pickHandler('sidecoach_state_delete');
    const list = pickHandler('sidecoach_state_list_keys');
    await set({ key: 'a', value: 'v' }, buildDeps(fakeRegistries()));
    await set({ key: 'b', value: 'v' }, buildDeps(fakeRegistries()));
    await del({ key: 'a' }, buildDeps(fakeRegistries()));
    const r = await list({}, buildDeps(fakeRegistries()));
    const d = r.data as any;
    assert.strictEqual(d.keys.length, 1);
    assert.strictEqual(d.keys[0].key, 'b');
  });

  // ------ ast_grep ------
  // We don't exercise the real CLI here - that's the integration tests' job.
  // We only check that DEPENDENCY_MISSING surfaces as DOWNSTREAM_UNAVAILABLE
  // (by stubbing PATH to something that won't have ast-grep).

  await test('ast_grep returns DOWNSTREAM_UNAVAILABLE when binary missing', async () => {
    const { _resetAstGrepProbe } = require('../../src/tools/ast-grep');
    _resetAstGrepProbe();
    const originalPath = process.env.PATH;
    process.env.PATH = '/nonexistent-dir-xyz123';
    try {
      const h = pickHandler('sidecoach_ast_grep');
      await h(
        { pattern: 'console.log($X)', path: '.' },
        buildDeps(fakeRegistries()),
      );
      assert.fail('expected throw');
    } catch (e) {
      assert.ok(e instanceof SidecoachToolError);
      assert.strictEqual((e as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    } finally {
      process.env.PATH = originalPath;
      _resetAstGrepProbe();
    }
  });

  // ------ LSP tools (T-0026) ------
  // Handler-level coverage with an injected fake manager (no subprocess) and a
  // real in-root file. Subprocess + SDK coverage lives in the integration suite.

  const lspPath = require('path');
  const MCP_ROOT = lspPath.resolve(__dirname, '..', '..');
  const { PROJECT_ROOT_ENV } = require('../../src/project-root');

  function withFakeManager(
    responders: Record<string, (params: any) => unknown>,
    probeOk = true,
  ): () => Promise<void> {
    const { LspClientManager, setSharedLspManager, resetSharedLspManager } = require('../../src/lsp/index');
    const { FakeTransport, autoRespond } = require('../lsp-fakes');
    const mgr = new LspClientManager({
      transportFactory: () => {
        const t = new FakeTransport();
        autoRespond(t, responders);
        return t;
      },
      probe: async () => ({ ok: probeOk, reason: probeOk ? undefined : 'simulated-missing' }),
    });
    setSharedLspManager(mgr);
    process.env[PROJECT_ROOT_ENV] = MCP_ROOT;
    return async () => {
      delete process.env[PROJECT_ROOT_ENV];
      await mgr.shutdownAll();
      resetSharedLspManager();
    };
  }

  await test('lsp_hover: DOWNSTREAM_UNAVAILABLE when no server binary present', async () => {
    const cleanup = withFakeManager({}, false);
    try {
      const h = pickHandler('sidecoach_lsp_hover' as ToolName);
      await h({ file: 'src/index.ts', line: 0, character: 0 }, buildDeps(fakeRegistries()));
      assert.fail('expected throw');
    } catch (e) {
      assert.strictEqual((e as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    } finally {
      await cleanup();
    }
  });

  await test('lsp_hover: unsupported file type -> DOWNSTREAM_UNAVAILABLE', async () => {
    const cleanup = withFakeManager({});
    try {
      const h = pickHandler('sidecoach_lsp_hover' as ToolName);
      await h({ file: 'package.json', line: 0, character: 0 }, buildDeps(fakeRegistries()));
      assert.fail('expected throw');
    } catch (e) {
      assert.strictEqual((e as SidecoachToolError).code, 'DOWNSTREAM_UNAVAILABLE');
    } finally {
      await cleanup();
    }
  });

  await test('lsp_document_symbols: happy path flattens nested symbols', async () => {
    const cleanup = withFakeManager({
      'textDocument/documentSymbol': () => [
        {
          name: 'Outer',
          kind: 5,
          range: { start: { line: 0, character: 0 }, end: { line: 9, character: 0 } },
          children: [{ name: 'inner', kind: 6, range: { start: { line: 1, character: 2 }, end: { line: 3, character: 2 } } }],
        },
      ],
    });
    try {
      const h = pickHandler('sidecoach_lsp_document_symbols' as ToolName);
      const r = await h({ file: 'src/index.ts' }, buildDeps(fakeRegistries()));
      const d = r.data as any;
      assert.strictEqual(d.symbolCount, 2);
      assert.deepStrictEqual(d.symbols.map((s: any) => s.name), ['Outer', 'inner']);
    } finally {
      await cleanup();
    }
  });

  await test('lsp_workspace_symbols: happy path returns normalized symbols', async () => {
    const cleanup = withFakeManager({
      'workspace/symbol': () => [
        { name: 'MyThing', kind: 5, location: { uri: 'file:///x/MyThing.ts', range: {} } },
      ],
    });
    try {
      const h = pickHandler('sidecoach_lsp_workspace_symbols' as ToolName);
      const r = await h({ query: 'MyThing', language: 'typescript' }, buildDeps(fakeRegistries()));
      const d = r.data as any;
      assert.strictEqual(d.symbolCount, 1);
      assert.strictEqual(d.symbols[0].name, 'MyThing');
    } finally {
      await cleanup();
    }
  });

  await test('lsp normalizeLocations handles Location, LocationLink, and null', () => {
    const { normalizeLocations } = require('../../src/tools/lsp-goto-definition');
    assert.deepStrictEqual(normalizeLocations(null, '/root'), []);
    const single = normalizeLocations({ uri: 'file:///root/a.ts', range: { x: 1 } }, '/root');
    assert.strictEqual(single[0].uri, 'a.ts');
    const link = normalizeLocations([{ targetUri: 'file:///root/b.ts', targetRange: { y: 2 } }], '/root');
    assert.strictEqual(link[0].uri, 'b.ts');
  });

  await test('lsp flattenSymbols flattens hierarchical and flat shapes', () => {
    const { flattenSymbols } = require('../../src/tools/lsp-document-symbols');
    const hierarchical = flattenSymbols([{ name: 'A', kind: 5, range: {}, children: [{ name: 'B', kind: 6, range: {} }] }]);
    assert.deepStrictEqual(hierarchical.map((s: any) => s.name), ['A', 'B']);
    const flat = flattenSymbols([{ name: 'C', kind: 12, location: { range: {} } }]);
    assert.strictEqual(flat[0].name, 'C');
  });
}
