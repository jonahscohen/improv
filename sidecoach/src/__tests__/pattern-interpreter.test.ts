// sidecoach/src/__tests__/pattern-interpreter.test.ts
//
// Phase 3a Step 1: the static-css-regex INTERPRETER + its ReDoS screen. Self-contained plain-
// assert suite (no jest). Covers:
//   - screenRegexSource rejects the catastrophic families and admits ordinary patterns;
//   - interpretPatternSpec FIRES on a crafted positive, is CLEAN on the negative, not_applicable
//     when nothing matches, and fail-closed (inconclusive) on an unknown engine AND an unknown
//     predicateId;
//   - the optional numeric guard gates the fire (present-but-not-met => pass);
//   - a catastrophic-backtrack spec (/(a+)+$/ on a long non-matching input) is bounded/rejected
//     UNDER A HARD TIMEOUT rather than hanging - verified end-to-end in a CHILD PROCESS against
//     the compiled dist interpreter, so a regression that removed the screen would hang the child
//     and be killed at the timeout (a test failure) instead of hanging this suite.
import * as path from 'path';
import { execFileSync } from 'child_process';
import { interpretPatternSpec } from '../validators/checks/pattern-interpreter';
import { screenRegexSource } from '../validators/pattern-spec';
import type { PatternSpec } from '../validators/pattern-spec';
import type { ProductCheckContext, CollectedFile } from '../validators/check-context';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void { if (cond) passed += 1; else failures.push(label); }
function eq<T>(a: T, b: T, label: string): void { ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

// A ProductCheckContext from raw css/markup (files included so locate() can resolve a defect line).
function ctxOf(css: string, markup = ''): ProductCheckContext {
  const files: CollectedFile[] = [];
  if (css) files.push({ path: 'styles.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] });
  if (markup) files.push({ path: 'index.html', sourceKind: 'html', cssText: '', markup, evidenceKindsPresent: ['markup'] });
  return { cssText: css, markup, files };
}

// ----------------------------------------------------------------------------
// screenRegexSource: rejects catastrophic families, admits ordinary patterns
// ----------------------------------------------------------------------------
for (const bad of ['(a+)+$', '(a*)*', '(\\d+)+', '((a+))+', '(a(b+))+', '(a+){2,}', '(a)\\1', 'a'.repeat(1001)]) {
  ok(screenRegexSource(bad).safe === false, `screen REJECTS catastrophic/backref/overlong source: ${bad.slice(0, 24)}`);
}
for (const good of ['\\d+', '[a-z]+', 'font-family\\s*:\\s*[^;{}]+', 'cubic-bezier\\([^)]*\\)', '(a|b)+', '(?:foo|bar)+', '(a+)?', '<img\\b(?![^>]*\\balt=)']) {
  ok(screenRegexSource(good).safe === true, `screen ADMITS ordinary safe source: ${good}`);
}
// star-height >= 2 names the reason (so a preflight file is legible).
ok(/nested unbounded quantifier/.test(screenRegexSource('(a+)+').reason || ''), 'nested-quantifier rejection names star-height');

// ----------------------------------------------------------------------------
// interpret: a numeric-guarded bounce-easing spec (applicability -> defect -> guard)
// ----------------------------------------------------------------------------
const bounceSpec: PatternSpec = {
  specVersion: 1,
  engine: 'static-css-regex',
  applicability: { anyOf: ['transition\\s*:', 'animation\\s*:'], scope: 'css' },
  defect: { anyOf: [{ pattern: 'cubic-bezier\\([^)]*\\)', flags: 'i' }], numericGuard: { predicateId: 'cubic-bezier-overshoot', threshold: 0.1 } },
  message: 'bounce/elastic overshoot easing - real objects decelerate',
  remediation: 'use a decelerating curve, e.g. cubic-bezier(0.16, 1, 0.3, 1)',
  evidenceScope: 'css',
};

const firePos = interpretPatternSpec(bounceSpec, ctxOf('.x { transition: transform .3s cubic-bezier(0.5, 1.6, 0.4, 1); }'));
eq(firePos.status, 'fail', 'FIRES on the positive fixture (overshoot y=1.6 beyond tolerance)');
eq(firePos.message, bounceSpec.message, 'fire carries the spec message verbatim');
ok((firePos.evidenceLocations || []).length >= 1, 'fire points at the defect declaration (a located line)');

const guardNotMet = interpretPatternSpec(bounceSpec, ctxOf('.x { transition: transform .3s cubic-bezier(0.16, 1, 0.3, 1); }'));
eq(guardNotMet.status, 'pass', 'CLEAN when the defect regex matches but the numeric guard is NOT met (no overshoot)');

const noDefect = interpretPatternSpec(bounceSpec, ctxOf('.x { transition: transform .3s ease; }'));
eq(noDefect.status, 'pass', 'CLEAN on the negative fixture (applicable, no cubic-bezier defect)');

const notApp = interpretPatternSpec(bounceSpec, ctxOf('.x { color: #333; }'));
eq(notApp.status, 'not_applicable', 'not_applicable when no applicability pattern matches');

// unknown engine => inconclusive (fail-closed), even on an otherwise-firing input.
const unknownEngine = interpretPatternSpec({ ...bounceSpec, engine: 'python-ast' }, ctxOf('.x { transition: transform .3s cubic-bezier(0.5, 1.6, 0.4, 1); }'));
eq(unknownEngine.status, 'inconclusive', 'unknown engine => inconclusive');

// unknown predicateId => inconclusive (fail-closed) - reached because applicability + defect match.
const unknownPredicate = interpretPatternSpec(
  { ...bounceSpec, defect: { anyOf: bounceSpec.defect.anyOf, numericGuard: { predicateId: 'not-a-real-predicate', threshold: 1 } } },
  ctxOf('.x { transition: transform .3s cubic-bezier(0.5, 1.6, 0.4, 1); }'),
);
eq(unknownPredicate.status, 'inconclusive', 'unknown numericGuard predicateId => inconclusive');

// missing evidence => inconclusive (honest, never a false pass).
const noEvidence = interpretPatternSpec(bounceSpec, { cssText: '', markup: '', files: [] });
eq(noEvidence.status, 'inconclusive', 'no CSS collected for a css-scoped spec => inconclusive');

// a guard-less presence spec also fires (proves the no-guard path). NOTE: re2 (the linear-time
// engine) does not support lookaround or backreferences, so a mined spec uses plain presence
// patterns; anything needing lookaround fail-closes to inconclusive by design.
const noGuardSpec: PatternSpec = {
  specVersion: 1,
  engine: 'static-css-regex',
  applicability: { anyOf: ['color\\s*:', 'background\\s*:'], scope: 'css' },
  defect: { anyOf: [{ pattern: '!important', flags: 'i' }] },
  message: 'uses !important',
};
eq(interpretPatternSpec(noGuardSpec, ctxOf('.x { color: red !important; }')).status, 'fail', 'guard-less presence spec FIRES');
eq(interpretPatternSpec(noGuardSpec, ctxOf('.x { color: red; }')).status, 'pass', 'guard-less presence spec is CLEAN when the pattern is absent');

// ----------------------------------------------------------------------------
// Fold 2 (flags): a malformed flag is REJECTED (inconclusive), never silently dropped
// ----------------------------------------------------------------------------
// A dropped flag was a false-pass hazard: an intended `i` lost to sanitization made a defect that
// should match return pass. Now a non-string flag / an unsupported char fail-closes to inconclusive.
const overshootCss = '.x { transition: transform .3s cubic-bezier(0.5, 1.6, 0.4, 1); }';
const badFlagsNum = interpretPatternSpec({ ...bounceSpec, defect: { anyOf: [{ pattern: 'cubic-bezier\\([^)]*\\)', flags: 123 as unknown as string }], numericGuard: bounceSpec.defect.numericGuard } }, ctxOf(overshootCss));
eq(badFlagsNum.status, 'inconclusive', 'a non-string flags value => inconclusive (no silent drop, no false pass)');
const badFlagsChar = interpretPatternSpec({ ...bounceSpec, defect: { anyOf: [{ pattern: 'cubic-bezier\\([^)]*\\)', flags: 'g' }], numericGuard: bounceSpec.defect.numericGuard } }, ctxOf(overshootCss));
eq(badFlagsChar.status, 'inconclusive', 'an unsupported flag char (g) => inconclusive');

// ----------------------------------------------------------------------------
// ReDoS: UNTRUSTED regexes run through re2 (linear) - bounded UNDER A HARD TIMEOUT
// ----------------------------------------------------------------------------
// The compiled interpreter is required in a child; execFileSync enforces the hard wall-clock
// bound. re2 matches in linear time, so an ambiguous-alternation / nested-quantifier pattern that
// backtracks exponentially on a native RegExp returns a DEFINITE verdict instead of hanging. A
// regression that dropped re2 back to native RegExp would hang the child -> killed at the timeout
// -> the assertion FAILS (never silently passes).
const distInterp = path.resolve(__dirname, '..', '..', 'dist', 'validators', 'checks', 'pattern-interpreter.js');
const VALID_STATUSES = ['pass', 'fail', 'not_applicable', 'inconclusive'];

function runInterpChild(specLiteral: string, ctxLiteral: string, env: Record<string, string> = {}): { out: string; timedOut: boolean } {
  const script = `
    const { interpretPatternSpec } = require(${JSON.stringify(distInterp)});
    const v = interpretPatternSpec(${specLiteral}, ${ctxLiteral});
    process.stdout.write(String(v.status));
  `;
  try {
    const out = execFileSync(process.execPath, ['-e', script], { timeout: 8000, encoding: 'utf8', env: { ...process.env, ...env } }).trim();
    return { out, timedOut: false };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { killed?: boolean; signal?: string };
    const timedOut = err.killed === true || err.signal === 'SIGTERM' || err.code === 'ETIMEDOUT';
    return { out: `THREW(${err.signal || err.code || (err.message || '').slice(0, 40)})`, timedOut };
  }
}

// The exact Codex fold-1 exploit: ^(a|aa)*$ on "a"*40 + "b" hangs native V8, is linear under re2.
const ambiguous = runInterpChild(
  `{ specVersion:1, engine:'static-css-regex', applicability:{ anyOf:['a'], scope:'css' }, defect:{ anyOf:[{ pattern:'^(a|aa)*$' }] }, message:'ambiguous alternation' }`,
  `{ cssText: 'a'.repeat(40) + 'b', markup:'', files:[] }`,
);
ok(!ambiguous.timedOut, 'ambiguous-alternation ^(a|aa)*$ did NOT hang (bounded under the 8s hard timeout via re2)');
ok(VALID_STATUSES.includes(ambiguous.out), `ambiguous-alternation returns a definite bounded verdict (got ${ambiguous.out})`);

// A nested unbounded quantifier on a long non-matching input - also linear under re2.
const nested = runInterpChild(
  `{ specVersion:1, engine:'static-css-regex', applicability:{ anyOf:['a'], scope:'css' }, defect:{ anyOf:[{ pattern:'(a+)+$' }] }, message:'nested quantifier' }`,
  `{ cssText: 'a'.repeat(50000) + '!', markup:'', files:[] }`,
);
ok(!nested.timedOut, 'nested-quantifier (a+)+$ did NOT hang (bounded under re2)');
ok(VALID_STATUSES.includes(nested.out), `nested-quantifier returns a definite bounded verdict (got ${nested.out})`);

// re2 UNAVAILABLE (simulated) => fail-closed to inconclusive, never a false pass or a hang. The
// spec below WOULD fire under re2 (overshoot), so inconclusive proves the fail-closed path.
const noRe2 = runInterpChild(
  `{ specVersion:1, engine:'static-css-regex', applicability:{ anyOf:['transition\\\\s*:'], scope:'css' }, defect:{ anyOf:[{ pattern:'cubic-bezier\\\\([^)]*\\\\)', flags:'i' }], numericGuard:{ predicateId:'cubic-bezier-overshoot', threshold:0.1 } }, message:'overshoot', evidenceScope:'css' }`,
  `{ cssText: '.x { transition: transform .3s cubic-bezier(0.5, 1.6, 0.4, 1); }', markup:'', files:[] }`,
  { SIDECOACH_DISABLE_RE2: '1' },
);
ok(!noRe2.timedOut, 're2-unavailable path returns without hanging');
eq(noRe2.out, 'inconclusive', 're2 unavailable => patternSpec check is inconclusive (fail-closed), never a false pass');

// ----------------------------------------------------------------------------
// report
// ----------------------------------------------------------------------------
if (failures.length) {
  process.stderr.write(`pattern-interpreter.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
process.stdout.write(`pattern-interpreter.test: all ${passed} assertions passed\n`);
