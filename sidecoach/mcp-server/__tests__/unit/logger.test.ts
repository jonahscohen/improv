// Unit tests for logger.ts.

import { createLogger, newRequestId } from '../../src/logger';
import { test, assert } from '../harness';

function captureLogger(level: 'error' | 'warn' | 'info' | 'debug' = 'debug') {
  const lines: string[] = [];
  const logger = createLogger({ level, write: (l) => lines.push(l) });
  return { logger, lines };
}

export async function run(): Promise<void> {
  await test('logger emits JSON-per-line with ts and level', () => {
    const { logger, lines } = captureLogger('info');
    logger.info('hello', { tool: 'unit-test' });
    assert.strictEqual(lines.length, 1);
    const obj = JSON.parse(lines[0]);
    assert.strictEqual(obj.level, 'info');
    assert.strictEqual(obj.msg, 'hello');
    assert.strictEqual(obj.tool, 'unit-test');
    assert.ok(typeof obj.ts === 'string');
  });

  await test('logger respects level filtering', () => {
    const { logger, lines } = captureLogger('warn');
    logger.info('should not appear');
    logger.warn('should appear');
    logger.error('should appear');
    assert.strictEqual(lines.length, 2);
  });

  await test('logger child merges base context into every line', () => {
    const { logger, lines } = captureLogger('debug');
    const child = logger.child({ requestId: 'abc' });
    child.info('one');
    child.info('two', { tool: 'foo' });
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(JSON.parse(lines[0]).requestId, 'abc');
    assert.strictEqual(JSON.parse(lines[1]).requestId, 'abc');
    assert.strictEqual(JSON.parse(lines[1]).tool, 'foo');
  });

  await test('logger.exception redacts and tags level=error', () => {
    const { logger, lines } = captureLogger('debug');
    logger.exception(new Error('Bearer eyJabcdef.GHIJK.lmnop'));
    assert.strictEqual(lines.length, 1);
    const obj = JSON.parse(lines[0]);
    assert.strictEqual(obj.level, 'error');
    assert.ok(!String(obj.msg).includes('eyJabcdef'));
  });

  await test('logger tolerates circular context objects', () => {
    const { logger, lines } = captureLogger('debug');
    const circ: any = { name: 'circ' };
    circ.self = circ;
    logger.info('cycle test', circ);
    assert.strictEqual(lines.length, 1);
    // Either the safe-fallback ctxError line is emitted, or the regular line
    // succeeded. Either way, no crash.
    const obj = JSON.parse(lines[0]);
    assert.ok(obj.msg === 'cycle test' || obj.ctxError === 'unserializable context');
  });

  await test('newRequestId produces a unique UUID-shaped string', () => {
    const a = newRequestId();
    const b = newRequestId();
    assert.notStrictEqual(a, b);
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a));
  });
}
