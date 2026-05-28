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

  await test('resolve_keyword: rejects empty phrase', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_resolve_keyword.safeParse({ phrase: '' });
    assert.strictEqual(r.success, false);
  });

  await test('resolve_keyword: rejects > 4000 char phrase', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_resolve_keyword.safeParse({
      phrase: 'a'.repeat(4001),
    });
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
}
