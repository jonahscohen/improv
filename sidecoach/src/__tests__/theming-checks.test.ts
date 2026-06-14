// sidecoach/src/__tests__/theming-checks.test.ts
import { THEMING_CHECKS } from '../validators/checks/theming-checks';
import type { ProductCheckContext } from '../validators/check-context';

const ctxCss = (css: string): ProductCheckContext => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };

function run() {
  const hex = THEMING_CHECKS['theming/token-driven-interactive-state'];
  const radius = THEMING_CHECKS['theming/border-radius-consistency'];
  if (!hex || !radius) throw new Error('both theming checks must be present');

  if (hex(empty).status !== 'inconclusive') throw new Error('hex check needs CSS evidence');
  // file defines tokens AND a :hover uses a raw hex -> fail
  const offending = ':root { --c: #abc; } .b:hover { color: #ff0000; }';
  if (hex(ctxCss(offending)).status !== 'fail') throw new Error('hardcoded hex in :hover with tokens defined must fail');
  // tokens defined, interactive state token-driven -> pass
  if (hex(ctxCss(':root { --c: #abc; } .b:hover { color: var(--c); }')).status !== 'pass') throw new Error('token-driven hover must pass');
  // faithful Tailwind/shadcn carve-out: token utility makes incidental hex non-offending
  const tw = '@tailwind base; :root { --primary: 222 47% 11%; } .b:hover { @apply bg-primary/90; color: #fff; }';
  if (hex(ctxCss(tw)).status !== 'pass') throw new Error('Tailwind token utility must not false-positive');
  // no tokens in file at all -> not_applicable (no token system to violate)
  if (hex(ctxCss('.b:hover { color: #ff0000; }')).status !== 'not_applicable') throw new Error('no CSS vars -> N/A');

  // >2 distinct radius literals -> fail; <=2 -> pass
  if (radius(ctxCss('.a{border-radius:3px}.b{border-radius:5px}.c{border-radius:9px}')).status !== 'fail') throw new Error('3 radius literals must fail');
  if (radius(ctxCss('.a{border-radius:4px}.b{border-radius:8px}')).status !== 'pass') throw new Error('<=2 radius literals must pass');
  // no border-radius at all -> not_applicable
  if (radius(ctxCss('.a{color:red}')).status !== 'not_applicable') throw new Error('no radius -> N/A');

  console.log('theming-checks: OK');
}
run();
