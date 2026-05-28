// Unit tests for the TS port of the bash hook's keyword resolver.

import { resolveKeyword, sanitize, isInformational } from '../../src/keyword-resolver';
import { test, assert } from '../harness';

const VERBS = [
  { verb: 'audit', pattern: 'audit', phase: 'review', description: '', oneLineExplanation: '' },
  { verb: 'polish', pattern: 'polish', phase: 'review', description: '', oneLineExplanation: '' },
  { verb: 'craft', pattern: 'craft', phase: 'build', description: '', oneLineExplanation: '' },
];

const MODES = [
  {
    mode: 'forge',
    pattern: 'forge',
    description: '',
    oneLineExplanation: '',
    chain: ['shape', 'craft', 'polish'],
  },
];

export async function run(): Promise<void> {
  await test('resolveKeyword: empty phrase returns kind=none', () => {
    const r = resolveKeyword('', { verbs: VERBS, modes: MODES });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: plain verb match', () => {
    const r = resolveKeyword('please polish the homepage', { verbs: VERBS, modes: MODES });
    assert.strictEqual(r.kind, 'verb');
    assert.strictEqual(r.name, 'polish');
  });

  await test('resolveKeyword: mode takes precedence over verb when both present', () => {
    const r = resolveKeyword('forge the homepage and polish it', { verbs: VERBS, modes: MODES });
    assert.strictEqual(r.kind, 'mode');
    assert.strictEqual(r.name, 'forge');
  });

  await test('resolveKeyword: word boundaries reject "polished"', () => {
    const r = resolveKeyword('this is already polished', { verbs: VERBS, modes: MODES });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: word boundaries reject "audit-trail"', () => {
    const r = resolveKeyword('check the audit-trail', { verbs: VERBS, modes: MODES });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: informational framing "what is audit" suppresses', () => {
    const r = resolveKeyword('what is audit?', { verbs: VERBS, modes: MODES });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: informational framing "explain polish" suppresses', () => {
    const r = resolveKeyword('explain polish', { verbs: VERBS, modes: MODES });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: code fence body does not fire', () => {
    const r = resolveKeyword('```\nfunction polish() {}\n```', {
      verbs: VERBS,
      modes: MODES,
    });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: inline backtick body does not fire', () => {
    const r = resolveKeyword('use `polish()` to format', { verbs: VERBS, modes: MODES });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: URL with verb in path does not fire', () => {
    const r = resolveKeyword('see https://example.com/polish for details', {
      verbs: VERBS,
      modes: MODES,
    });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: XML tag body does not fire', () => {
    const r = resolveKeyword('<verb>polish</verb> is suggested', {
      verbs: VERBS,
      modes: MODES,
    });
    assert.strictEqual(r.kind, 'none');
  });

  await test('resolveKeyword: empty registries report none with reason', () => {
    const r = resolveKeyword('polish this', { verbs: [], modes: [] });
    assert.strictEqual(r.kind, 'none');
    assert.ok(r.reason && r.reason.length > 0);
  });

  await test('sanitize strips a fenced block', () => {
    const out = sanitize('hello ```rm -rf /``` world');
    assert.ok(!out.includes('rm -rf'));
    assert.ok(out.includes('hello'));
    assert.ok(out.includes('world'));
  });

  await test('isInformational matches "X is a Y" framing', () => {
    assert.strictEqual(isInformational('audit is a check', 'audit'), true);
    assert.strictEqual(isInformational('please audit this', 'audit'), false);
  });
}
