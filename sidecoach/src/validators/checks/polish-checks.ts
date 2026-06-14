// sidecoach/src/validators/checks/polish-checks.ts  (Task 2 seed; Task 3 fills in the rest)
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive, hasCss, withRuleApplicability } from '../check-context';

// id 19, css-rule. Old code: cssRules?.some(...) ?? false (absence-failed silently).
// New: no CSS collected -> inconclusive; CSS present without the media query -> fail.
export function checkReducedMotion(ctx: ProductCheckContext): RuleVerdict {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected to check reduced-motion', 'unreadable_input');
  const present = ctx.cssText.includes('@media (prefers-reduced-motion');
  return present
    ? pass('prefers-reduced-motion media query present')
    : fail('no prefers-reduced-motion media query found in collected CSS', [], 'Add: @media (prefers-reduced-motion: reduce) { animation: none; }');
}

export const POLISH_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'polish/reduced-motion-respect': withRuleApplicability('polish/reduced-motion-respect', checkReducedMotion),
};
