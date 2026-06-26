#!/usr/bin/env node
/**
 * Tests for the OBJECTIVE-LABEL spec-faithful labeler. The labeler is the ground-truth
 * referee, so it is tested for correctness AND for no-false-positives, including the
 * parser-robustness cases Codex item-8 surfaced (key-selector subject, CSS comments,
 * @keyframes, depth-aware comma split, inline-style element tag, single/double quotes)
 * and confirmation that the boundary-moved classes no longer compute statically. Exit 0 = pass.
 */
import { objectiveLabelsStatic, keySelector, splitSelectorList } from './objective-label.mjs';

let failures = 0;
function check(name, html, expectIncludes, expectExcludes = []) {
  const got = objectiveLabelsStatic(html);
  const okInc = expectIncludes.every((c) => got.includes(c));
  const okExc = expectExcludes.every((c) => !got.includes(c));
  if (okInc && okExc) console.log(`  ok  ${name} -> [${got.join(',')}]`);
  else { console.error(`  FAIL ${name} -> [${got.join(',')}] (want incl ${expectIncludes}, excl ${expectExcludes})`); failures++; }
}
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ok  ${name} -> ${JSON.stringify(got)}`);
  else { console.error(`  FAIL ${name} -> ${JSON.stringify(got)} (want ${JSON.stringify(want)})`); failures++; }
}
const wrap = (css, body = '') => `<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`;

// ---- unit: selector parsing helpers (the Codex item-8 fixes) ----
eq('keySelector .hero p', keySelector('.hero p'), 'p');
eq('keySelector .nav>li', keySelector('.nav > li'), 'li');
eq('keySelector :is(a,b) p:hover', keySelector(':is(.a,.b) p:hover'), 'p:hover');
eq('splitSelectorList depth-aware', splitSelectorList(':is(.a,.b), p[data-x="a,b"]'), [':is(.a,.b)', 'p[data-x="a,b"]']);

// ---- broken-image (HTML structural) ----
check('broken-image (empty src)', wrap('', '<img src="">'), ['broken-image']);
check('broken-image (missing src)', wrap('', '<img alt="x">'), ['broken-image']);
check('broken-image (placeholder)', wrap('', '<img src="placeholder.png">'), ['broken-image']);
check('clean: real image src', wrap('', '<img src="/real.jpg" alt="real">'), [], ['broken-image']);
check('clean: single-quoted real src', wrap('', "<img src='/real.jpg'>"), [], ['broken-image']);

// ---- skipped-heading (WCAG 1.3.1) ----
check('skipped-heading h1->h3', wrap('', '<h1>A</h1><h3>B</h3>'), ['skipped-heading']);
check('clean: proper heading order', wrap('', '<h1>A</h1><h2>B</h2><h3>C</h3>'), [], ['skipped-heading']);

// ---- justified-text (WCAG 1.4.8 AAA), key-selector scoped ----
check('justified-text on p', wrap('p{text-align:justify}'), ['justified-text']);
check('justified-text on .prose', wrap('.prose{text-align:justify}'), ['justified-text']);
check('justified-text on .hero p (key=p)', wrap('.hero p{text-align:justify}'), ['justified-text']);
check('justified-text inline (double quote)', wrap('', '<p style="text-align:justify">x</p>'), ['justified-text']);
check('justified-text inline (single quote)', wrap('', "<p style='text-align:justify'>x</p>"), ['justified-text']);

// ---- no-false-positive parser robustness (Codex item-8) ----
check('NO justify from CSS comment', wrap('/* p{text-align:justify} */ .x{color:red}'), [], ['justified-text']);
check('NO justify on non-text div', wrap('div{text-align:justify}'), [], ['justified-text']);
check('NO justify inline on div', wrap('', '<div style="text-align:justify">x</div>'), [], ['justified-text']);
check('NO false class from @keyframes', wrap('@keyframes x{0%{letter-spacing:.1em}100%{letter-spacing:.3em}} p{color:red}'), [], ['wide-tracking', 'justified-text']);

// ---- boundary: moved/rendered classes do NOT compute statically anymore ----
check('tiny-text moved (subjective)', wrap('.x{font-size:9px}'), [], ['tiny-text']);
check('wide-tracking moved (subjective)', wrap('.lead{letter-spacing:0.12em}'), [], ['wide-tracking']);
check('all-caps-body moved (subjective)', wrap('p{text-transform:uppercase}', '<p>' + 'a'.repeat(80) + '</p>'), [], ['all-caps-body']);
check('layout-transition moved (subjective)', wrap('.x{transition:width .3s}'), [], ['layout-transition']);
check('bounce-easing moved (subjective)', wrap('.x{animation:bounce 1s}'), [], ['bounce-easing']);
check('tight-leading is rendered-pass now (not static)', wrap('p{line-height:0.9}'), [], ['tight-leading']);
check('extreme-negative-tracking is rendered-pass now', wrap('p{letter-spacing:-0.1em}'), [], ['extreme-negative-tracking']);

if (failures === 0) { console.log('objective-label.test: ALL PASS'); process.exit(0); }
console.error(`objective-label.test: ${failures} FAILURE(S)`); process.exit(1);
