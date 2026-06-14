import * as path from 'path';
import { intentEligible } from '../../src/keyword-resolver';
import { loadIntentRegistry } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const intent = loadIntentRegistry(silentLogger());
const corpusPath = path.resolve(__dirname, '..', '..', '..', 'parity', 'classifier-corpus.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const corpus = require(corpusPath) as { cases: Array<{ prompt: string; expect: string }> };

function corpusPrompt(prompt: string): string {
  const row = corpus.cases.find((c) => c.prompt === prompt);
  assert.ok(row, `missing shared corpus row: ${prompt}`);
  return row!.prompt;
}

export async function run(): Promise<void> {
  await test('null registry is never eligible', () => {
    assert.strictEqual(intentEligible('redesign the landing page', null), false);
  });

  await test('standalone signal fires (restyle the navbar)', () => {
    assert.strictEqual(intentEligible('restyle the navbar', intent), true);
  });

  await test('action + substantive target fires (build a dashboard)', () => {
    assert.strictEqual(intentEligible('build me a dashboard', intent), true);
  });

  await test('trivial-modify exempt framing stays silent (just tweak the padding)', () => {
    assert.strictEqual(intentEligible('just tweak the padding', intent), false);
  });

  await test('minor target alone does not fire (make the button bigger)', () => {
    assert.strictEqual(intentEligible('make the button bigger', intent), false);
  });

  await test('non-design backend work does not fire', () => {
    assert.strictEqual(intentEligible('fix the packet header parsing in the network layer', intent), false);
  });

  await test('what is a design system is informational', () => {
    assert.strictEqual(intentEligible('what is a design system?', intent), false);
  });

  await test('production hook informational frames suppress eligibility', () => {
    assert.strictEqual(intentEligible(corpusPrompt('tell me about design system'), intent), false);
    assert.strictEqual(intentEligible(corpusPrompt('what design system does'), intent), false);
    assert.strictEqual(intentEligible(corpusPrompt('what design system is'), intent), false);
  });

  await test('production hook sanitizer removes inline-code intent text', () => {
    assert.strictEqual(intentEligible(corpusPrompt('`restyle the navbar`'), intent), false);
  });

  await test('new-build overrides an exempt token (redesign the marketing site from scratch)', () => {
    assert.strictEqual(intentEligible('redesign the marketing site from scratch', intent), true);
  });
}
