// sidecoach/src/__tests__/polish-checks.test.ts
import { POLISH_CHECKS } from '../validators/checks/polish-checks';
import type { ProductCheckContext } from '../validators/check-context';

const ctxCss = (css: string): ProductCheckContext => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const ctxMarkup = (html: string): ProductCheckContext => ({ cssText: '', markup: html, files: [{ path: 'a.html', sourceKind: 'html', cssText: '', markup: html, evidenceKindsPresent: ['html'] }] });
const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };
const get = (k: string) => { const f = POLISH_CHECKS[k]; if (!f) throw new Error(`no check for ${k}`); return f; };

function explicit() {
  for (const k of ['polish/scale-on-press', 'polish/no-transition-all', 'polish/state-completeness', 'polish/tabular-nums']) get(k);

  // css-rule: present-feature -> pass; present-css-missing-feature -> fail; no-css -> inconclusive
  if (get('polish/scale-on-press')(ctxCss(':active { transform: scale(0.96); }')).status !== 'pass') throw new Error('scale-on-press present must pass');
  if (get('polish/scale-on-press')(ctxCss('.btn:active { color: red; }')).status !== 'fail') throw new Error('applicable scale-on-press missing must fail');
  if (get('polish/scale-on-press')(ctxCss('.prose { color: red; }')).status !== 'not_applicable') throw new Error('no interactive target must be N/A');
  if (get('polish/scale-on-press')(empty).status !== 'inconclusive') throw new Error('scale-on-press no-css must be inconclusive');

  // NEGATION rule: transition: all present -> fail; absent -> pass (css present)
  if (get('polish/no-transition-all')(ctxCss('.x { transition: all 1s; }')).status !== 'fail') throw new Error('transition:all must fail');
  if (get('polish/no-transition-all')(ctxCss('.x { transition: opacity 1s; }')).status !== 'pass') throw new Error('explicit transition must pass');

  // N/A: tabular-nums is not_applicable only when sufficient evidence establishes no dynamic-number target
  if (get('polish/tabular-nums')(ctxCss('.btn { color: red; }')).status !== 'not_applicable') throw new Error('tabular-nums with no number selectors must be N/A');
  if (get('polish/tabular-nums')(ctxCss('.price { font-variant-numeric: tabular-nums; }')).status !== 'pass') throw new Error('tabular-nums present must pass');
  if (get('polish/tabular-nums')(ctxCss('.price { color: red; }')).status !== 'fail') throw new Error('number selector without tabular-nums must fail');

  // ABSENCE-PASS ELIMINATED: computed-style/dom rules must NOT pass on absence (browser-only -> inconclusive)
  const radius = POLISH_CHECKS['polish/concentric-radius'];
  if (radius && radius(empty).status === 'pass') throw new Error('computed-style rule must never pass on absent evidence');
  if (radius && radius(empty).status !== 'inconclusive') throw new Error('computed-style rule must be inconclusive without browser evidence');
  if (radius && radius({ ...empty, computedStyle: { borderRadius: '8px' } }).status !== 'inconclusive') throw new Error('ad hoc computed style must not bypass P4b collector');
  for (const k of ['polish/typography-rhythm', 'polish/anti-pattern-genericity']) {
    const f = POLISH_CHECKS[k];
    if (f && f(empty).status !== 'inconclusive') throw new Error(`${k} must be inconclusive (browser-only)`);
    if (f && f({ ...empty, computedStyle: { lineHeight: '1.5' }, designTokens: { genericityScore: 10 } }).status !== 'inconclusive') throw new Error(`${k} must not be bypassed by ad hoc fields`);
  }
}

// Table: every static Polish not_applicable rule across the 4-case contract.
// unknown -> inconclusive, knownNoTarget -> not_applicable, applicableMissing -> fail, applicableSatisfied -> pass.
interface Row { key: string; markup?: boolean; noTarget: string; missing: string; satisfied: string; }
const ROWS: Row[] = [
  { key: 'polish/scale-on-press', noTarget: '.prose { color: red; }', missing: '.btn:active { color: red; }', satisfied: '.btn:active { transform: scale(0.96); }' },
  { key: 'polish/icon-swap-compound', noTarget: '.prose { color: red; }', missing: '.btn:hover { color: red; }', satisfied: '.icon { opacity: 1; transform: scale(1); }' },
  { key: 'polish/image-outline-neutral', noTarget: '.prose { color: red; }', missing: 'img { color: red; }', satisfied: 'img { border: 1px solid rgba(0,0,0,0.1); }' },
  { key: 'polish/no-transition-all', noTarget: '.x { color: red; }', missing: '.x { transition: all 1s; }', satisfied: '.x { transition: opacity 1s; }' },
  { key: 'polish/tabular-nums', noTarget: '.btn { color: red; }', missing: '.price { color: red; }', satisfied: '.price { font-variant-numeric: tabular-nums; }' },
  { key: 'polish/text-wrap-balance', noTarget: '.btn { color: red; }', missing: 'h1 { color: red; }', satisfied: 'h1 { text-wrap: balance; }' },
  { key: 'polish/staggered-enter', noTarget: '.x { color: red; }', missing: '.x { transition: opacity 1s; }', satisfied: '.x { animation-delay: 30ms; }' },
  { key: 'polish/subtle-exit', noTarget: '.x { color: red; }', missing: '.x { transition: opacity 1s; }', satisfied: '.x { transition: opacity 1s; opacity: 0; transform: scale(0.96); }' },
  { key: 'polish/font-smoothing', noTarget: '.x { color: red; }', missing: 'body { color: red; }', satisfied: 'body { -webkit-font-smoothing: antialiased; }' },
  { key: 'polish/sparse-will-change', noTarget: '.x { color: red; }', missing: '.x { will-change: all; }', satisfied: '.x { will-change: transform; }' },
  { key: 'polish/shadows-over-borders', noTarget: '.prose { color: red; }', missing: '.card { border: 1px solid; }', satisfied: '.card { box-shadow: 0 1px 2px rgba(0,0,0,0.1); }' },
  { key: 'polish/shadow-hierarchy', noTarget: '.prose { color: red; }', missing: '.card { box-shadow: 0 1px 2px black; }', satisfied: ':root { --shadow-sm: 0 1px 2px; --shadow-md: 0 4px 6px; --shadow-lg: 0 10px 25px; }' },
  { key: 'polish/optical-alignment', noTarget: '.prose { color: red; }', missing: '.badge { color: red; }', satisfied: '.btn { padding: 12px; }' },
  { key: 'polish/state-completeness', noTarget: '.prose { color: red; }', missing: '.btn:hover { color: red; }', satisfied: '.s:default {} .s:hover {} .s:focus {} .s:active {} .s:disabled {} .s:loading {} .s:error {} .s:success {}' },
  { key: 'polish/reduced-motion-respect', noTarget: '.x { color: red; }', missing: '.x { transition: opacity 1s; }', satisfied: '@media (prefers-reduced-motion: reduce) { * { animation: none; } }' },
  { key: 'polish/animatepresence-initial', markup: true, noTarget: '<div>hi</div>', missing: '<AnimatePresence><div/></AnimatePresence>', satisfied: '<AnimatePresence initial={false}><div/></AnimatePresence>' },
];

function table() {
  for (const row of ROWS) {
    const f = get(row.key);
    const mk = (s: string) => (row.markup ? ctxMarkup(s) : ctxCss(s));
    if (f(empty).status !== 'inconclusive') throw new Error(`${row.key}: unknown evidence must be inconclusive`);
    if (f(mk(row.noTarget)).status !== 'not_applicable') throw new Error(`${row.key}: known no-target must be not_applicable (got ${f(mk(row.noTarget)).status})`);
    if (f(mk(row.missing)).status !== 'fail') throw new Error(`${row.key}: applicable-missing-feature must fail (got ${f(mk(row.missing)).status})`);
    if (f(mk(row.satisfied)).status !== 'pass') throw new Error(`${row.key}: applicable-satisfied must pass (got ${f(mk(row.satisfied)).status})`);
  }
}

function run() {
  explicit();
  table();
  console.log('polish-checks: OK');
}
run();
