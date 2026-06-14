// Schema-validation unit tests. The schemas are the gate that protects the
// handler bodies from malformed input - they need their own coverage.

import { TOOL_INPUT_SCHEMAS } from '../../src/schemas';
import { test, assert } from '../harness';

export async function run(): Promise<void> {
  await test('list_verbs: phase filter is optional', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_list_verbs.safeParse({});
    assert.strictEqual(r.success, true);
  });

  await test('list_verbs: phase must be a string when provided', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_list_verbs.safeParse({ phase: 123 });
    assert.strictEqual(r.success, false);
  });

  await test('validate_polish_standard: rejects all-empty input via refine', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_validate_polish_standard.safeParse({});
    assert.strictEqual(r.success, false);
  });

  await test('validate_polish_standard: accepts html only', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_validate_polish_standard.safeParse({
      html: '<div/>',
    });
    assert.strictEqual(r.success, true);
  });

  await test('validate_polish_standard: rejects > 2MB html', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_validate_polish_standard.safeParse({
      html: 'x'.repeat(2_000_001),
    });
    assert.strictEqual(r.success, false);
  });

  await test('validate_taste: html is required', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_validate_taste.safeParse({});
    assert.strictEqual(r.success, false);
  });

  await test('get_cost_ledger: format must be raw or summary', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_get_cost_ledger.safeParse({ format: 'csv' });
    assert.strictEqual(r.success, false);
  });

  await test('get_cheatsheet: section must be enum value', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_get_cheatsheet.safeParse({ section: 'random' });
    assert.strictEqual(r.success, false);
  });

  await test('get_flow_metadata: flowId required', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_get_flow_metadata.safeParse({});
    assert.strictEqual(r.success, false);
  });

  // T-0022 extension schemas

  await test('state_set: empty key rejected', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_state_set.safeParse({ key: '', value: 'x' });
    assert.strictEqual(r.success, false);
  });

  await test('state_set: oversize value rejected', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_state_set.safeParse({
      key: 'k',
      value: 'x'.repeat(65_537),
    });
    assert.strictEqual(r.success, false);
  });

  await test('state_set: ttlMs > 24h rejected', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_state_set.safeParse({
      key: 'k',
      value: 'x',
      ttlMs: 24 * 60 * 60 * 1000 + 1,
    });
    assert.strictEqual(r.success, false);
  });

  await test('state_set: happy path', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_state_set.safeParse({
      key: 'k',
      value: 'v',
      ttlMs: 5000,
    });
    assert.strictEqual(r.success, true);
  });

  await test('state_list_keys: prefix optional', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_state_list_keys.safeParse({});
    assert.strictEqual(r.success, true);
  });

  await test('ast_grep: pattern required', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_ast_grep.safeParse({});
    assert.strictEqual(r.success, false);
  });

  await test('ast_grep: maxResults capped at 100', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_ast_grep.safeParse({
      pattern: 'console.log($X)',
      maxResults: 101,
    });
    assert.strictEqual(r.success, false);
  });

  await test('ast_grep: invalid language rejected', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_ast_grep.safeParse({
      pattern: 'console.log($X)',
      language: 'cobol',
    });
    assert.strictEqual(r.success, false);
  });

  // T-0026 LSP schemas

  await test('lsp_hover: requires file + line + character', () => {
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lsp_hover.safeParse({}).success, false);
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_hover.safeParse({ file: 'a.ts', line: 0, character: 0 }).success,
      true,
    );
  });

  await test('lsp_hover: negative line/character rejected', () => {
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_hover.safeParse({ file: 'a.ts', line: -1, character: 0 }).success,
      false,
    );
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_hover.safeParse({ file: 'a.ts', line: 0, character: -3 }).success,
      false,
    );
  });

  await test('lsp_hover: non-integer position rejected', () => {
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_hover.safeParse({ file: 'a.ts', line: 1.5, character: 0 }).success,
      false,
    );
  });

  await test('lsp_find_references: includeDeclaration optional boolean', () => {
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_find_references.safeParse({ file: 'a.ts', line: 0, character: 0 }).success,
      true,
    );
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_find_references.safeParse({
        file: 'a.ts',
        line: 0,
        character: 0,
        includeDeclaration: 'yes',
      }).success,
      false,
    );
  });

  await test('lsp_document_symbols: file required, no position needed', () => {
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lsp_document_symbols.safeParse({}).success, false);
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_document_symbols.safeParse({ file: 'a.ts' }).success,
      true,
    );
  });

  await test('lsp_workspace_symbols: query required, language enum enforced', () => {
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lsp_workspace_symbols.safeParse({}).success, false);
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_workspace_symbols.safeParse({ query: 'Foo' }).success,
      true,
    );
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_lsp_workspace_symbols.safeParse({ query: 'Foo', language: 'cobol' }).success,
      false,
    );
  });

  // T-0025 Python REPL schema

  await test('python_repl_execute: code required', () => {
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_python_repl_execute.safeParse({}).success, false);
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_python_repl_execute.safeParse({ code: 'print(1)' }).success,
      true,
    );
  });

  await test('python_repl_execute: empty code rejected', () => {
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_python_repl_execute.safeParse({ code: '' }).success,
      false,
    );
  });

  await test('python_repl_execute: oversize code (>256 KiB) rejected', () => {
    const big = 'x = 1\n'.repeat(50_000); // ~300 KiB
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_python_repl_execute.safeParse({ code: big }).success,
      false,
    );
  });

  await test('python_repl_execute: timeoutMs bounds enforced (100..10000)', () => {
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_python_repl_execute.safeParse({ code: 'print(1)', timeoutMs: 50 }).success,
      false,
    );
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_python_repl_execute.safeParse({ code: 'print(1)', timeoutMs: 10_001 }).success,
      false,
    );
    assert.strictEqual(
      TOOL_INPUT_SCHEMAS.sidecoach_python_repl_execute.safeParse({ code: 'print(1)', timeoutMs: 5_000 }).success,
      true,
    );
  });

  await test('classify_intent: rejects empty prompt', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_classify_intent.safeParse({ prompt: '' });
    assert.strictEqual(r.success, false);
  });

  await test('classify_intent: accepts a normal prompt', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_classify_intent.safeParse({ prompt: 'restyle the navbar' });
    assert.strictEqual(r.success, true);
  });

  await test('classify_intent: rejects > 4000 char prompt', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_classify_intent.safeParse({ prompt: 'x'.repeat(4001) });
    assert.strictEqual(r.success, false);
  });

  await test('list_lanes: accepts empty input', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_list_lanes.safeParse({});
    assert.strictEqual(r.success, true);
  });

  await test('lane: start requires laneId', () => {
    const ok = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'start', laneId: 'lane_build', startRequestId: 'transport-1',
    });
    const badLane = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'start', startRequestId: 'transport-1' });
    const badKey = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'start', laneId: 'lane_build' });
    assert.strictEqual(ok.success, true);
    assert.strictEqual(badLane.success, false);
    assert.strictEqual(badKey.success, false);
  });

  await test('lane: complete requires a StepReport; skip requires a reason', () => {
    const report = {
      stepId: 'shape', iteration: 0, reportId: 'report-1', verb: 'shape',
      summary: 'done', evidence: [{ kind: 'note', detail: 'verified' }],
    };
    const complete = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'complete', expectedRevision: 0, report,
    });
    const completeWithoutReport = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'complete', expectedRevision: 0,
    });
    const skip = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'skip', expectedRevision: 0, reason: 'not needed',
    });
    const skipWithoutReason = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'skip', expectedRevision: 0,
    });
    assert.strictEqual(complete.success, true);
    assert.strictEqual(completeWithoutReport.success, false);
    assert.strictEqual(skip.success, true);
    assert.strictEqual(skipWithoutReason.success, false);
  });

  await test('lane: status requires checkpointId; list needs nothing', () => {
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'status', checkpointId: 'cp1' }).success, true);
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'status' }).success, false);
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'list' }).success, true);
  });
}
