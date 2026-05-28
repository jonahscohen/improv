// Unit tests for errors.ts.

import {
  SidecoachToolError,
  buildToolError,
  redactErrorMessage,
  thrownToToolError,
} from '../../src/errors';
import { test, assert } from '../harness';

export async function run(): Promise<void> {
  await test('buildToolError shapes a proper isError CallToolResult', () => {
    const r = buildToolError({ code: 'INVALID_INPUT', message: 'bad' });
    assert.strictEqual(r.isError, true);
    assert.strictEqual(r.content.length, 1);
    assert.strictEqual(r.content[0].type, 'text');
    const parsed = JSON.parse(r.content[0].text);
    assert.strictEqual(parsed.code, 'INVALID_INPUT');
    assert.strictEqual(parsed.message, 'bad');
  });

  await test('thrownToToolError uses SidecoachToolError extras', () => {
    const t = new SidecoachToolError('TIMEOUT', 'too slow', { timeoutMs: 200 });
    const out = thrownToToolError(t, 'req-1');
    assert.strictEqual(out.code, 'TIMEOUT');
    assert.strictEqual(out.message, 'too slow');
    assert.strictEqual(out.timeoutMs, 200);
  });

  await test('thrownToToolError wraps an arbitrary throw as INTERNAL_ERROR', () => {
    const out = thrownToToolError(new Error('boom'), 'req-2');
    assert.strictEqual(out.code, 'INTERNAL_ERROR');
    assert.strictEqual(out.requestId, 'req-2');
    assert.ok(out.errorMessage && out.errorMessage.includes('boom'));
  });

  await test('redactErrorMessage drops apparent bearer tokens', () => {
    const out = redactErrorMessage('Auth failed: Bearer eyJabcdef.GHIJK.l-m_n0_o123');
    assert.ok(out.includes('[REDACTED]'));
    assert.ok(!out.includes('eyJabcdef'));
  });

  await test('redactErrorMessage drops apparent api keys (key=value form)', () => {
    const out = redactErrorMessage('config: api_key=sk-deadbeef12345678901234567890abcd');
    assert.ok(out.includes('[REDACTED]'));
    assert.ok(!out.includes('deadbeef'));
  });

  await test('redactErrorMessage caps overly long messages', () => {
    const big = 'a'.repeat(5000);
    const out = redactErrorMessage(big);
    assert.ok(out.length < 5000);
    assert.ok(out.endsWith('...[truncated]'));
  });

  await test('thrownToToolError stringifies non-Error values safely', () => {
    const out = thrownToToolError({ shape: 'unusual' }, 'req-3');
    assert.strictEqual(out.code, 'INTERNAL_ERROR');
    assert.ok(out.errorMessage && out.errorMessage.includes('unusual'));
  });
}
