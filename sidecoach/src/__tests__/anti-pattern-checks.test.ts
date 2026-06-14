// sidecoach/src/__tests__/anti-pattern-checks.test.ts
import { ANTI_PATTERN_CHECKS } from '../validators/checks/anti-pattern-checks';
import type { ProductCheckContext } from '../validators/check-context';

const ctxCss = (css: string): ProductCheckContext => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const ctxMarkup = (html: string): ProductCheckContext => ({ cssText: '', markup: html, files: [{ path: 'a.html', sourceKind: 'html', cssText: '', markup: html, evidenceKindsPresent: ['html'] }] });
const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };

function run() {
  const gt = ANTI_PATTERN_CHECKS['anti-pattern/gradient-text'];
  const gl = ANTI_PATTERN_CHECKS['anti-pattern/glassmorphism-default'];
  const ss = ANTI_PATTERN_CHECKS['anti-pattern/side-stripe-borders'];
  const cg = ANTI_PATTERN_CHECKS['anti-pattern/identical-card-grids'];
  const mo = ANTI_PATTERN_CHECKS['anti-pattern/modal-as-first-thought'];
  for (const [k, f] of Object.entries({ gt, gl, ss, cg, mo })) if (!f) throw new Error(`missing ${k}`);

  // gradient-text: clip + gradient -> fail; clean css -> pass; no css -> inconclusive
  if (gt(ctxCss('.h { background-clip: text; background: linear-gradient(#a,#b); }')).status !== 'fail') throw new Error('gradient-text must fail');
  if (gt(ctxCss('.h { color: red; }')).status !== 'pass') throw new Error('clean css gradient-text must pass');
  if (gt(empty).status !== 'inconclusive') throw new Error('gradient-text no-css must be inconclusive');

  // glassmorphism: blur + low alpha -> fail
  if (gl(ctxCss('.g { backdrop-filter: blur(8px); background: rgba(255,255,255,0.2); }')).status !== 'fail') throw new Error('glassmorphism must fail');

  // markup heuristic: dialog+form -> fail; no markup -> inconclusive (not pass)
  if (mo(ctxMarkup('<div class="modal"><form><input></form></div>')).status !== 'fail') throw new Error('modal-as-first-thought must fail');
  if (mo(empty).status !== 'inconclusive') throw new Error('markup detector with no markup must be inconclusive');
  if (cg(ctxMarkup('<main><p>hi</p></main>')).status !== 'pass') throw new Error('clean markup must pass');
  const repeatedCardsWithoutRepeatGrid = '<main><article class="card"><h2>A</h2><p>x</p></article><article class="card"><h2>B</h2><p>x</p></article><article class="card"><h2>C</h2><p>x</p></article></main>';
  if (cg(ctxMarkup(repeatedCardsWithoutRepeatGrid)).status !== 'pass') throw new Error('identical cards without repeat(...) grid precondition must not find');
  const repeatedCardsWithRepeatGrid = '<style>.grid{display:grid;grid-template-columns:repeat(3,1fr)}</style><main class="grid"><article class="card"><h2>A</h2><p>x</p></article><article class="card"><h2>B</h2><p>x</p></article><article class="card"><h2>C</h2><p>x</p></article></main>';
  if (cg(ctxMarkup(repeatedCardsWithRepeatGrid)).status !== 'fail') throw new Error('repeat(...) grid plus repeated cards must preserve source finding');

  console.log('anti-pattern-checks: OK');
}
run();
