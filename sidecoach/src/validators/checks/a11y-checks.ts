// sidecoach/src/validators/checks/a11y-checks.ts
//
// focus-visible (id 18) is a real css-rule check reusing the source predicate.
// min-hit-area (id 5, dom) and color-contrast (id 20, contrast) have NO static
// source: they always return inconclusive in P4a-2 even when a unit caller supplies
// ad hoc browser-shaped fields, because P4b owns the trusted browser collector.
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss, focusableTargetApplicability } from '../check-context';
import { hasFocusVisible } from '../../polish-standard-validator';

export const checkFocusVisible = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const applicable = focusableTargetApplicability(ctx);
  if (applicable === 'unknown') return inconclusive('cannot establish focusable targets from collected evidence', 'unreadable_input');
  if (!applicable) return notApplicable('no focusable element or interactive selector');
  return hasFocusVisible(ctx.cssText)
    ? pass(':focus-visible present')
    : fail('implement :focus-visible for keyboard navigation', [], 'Add :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }');
};

// dom-only: no static source can provide hit-area geometry. Honest inconclusive until P4b.
export const checkMinHitArea = (_ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('hit-area geometry needs DOM evidence (browser collector, P4b)', 'unsupported_runtime');

// contrast-only: same. P4a-2 does not trust ad hoc browser-shaped fields.
export const checkColorContrast = (_ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('contrast ratio needs measured contrast evidence (browser collector, P4b)', 'unsupported_runtime');

export const A11Y_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'a11y/focus-visible': checkFocusVisible,
  'a11y/min-hit-area': checkMinHitArea,
  'a11y/color-contrast': checkColorContrast,
};
