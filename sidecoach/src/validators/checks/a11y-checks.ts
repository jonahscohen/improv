// sidecoach/src/validators/checks/a11y-checks.ts
//
// focus-visible (id 18) is a real css-rule check reusing the source predicate.
// min-hit-area (id 5, dom) has NO static source: it always returns inconclusive in
// P4a-2 even when a unit caller supplies ad hoc browser-shaped fields, because P4b
// owns the trusted browser collector.
// color-contrast (id 20) was MIGRATED to the rendered scan in Stage 6 convergence
// (checkLowContrast in rendered-checks.ts) - it no longer lives here.
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss, focusableTargetApplicability, hasTrustedBrowserEvidence } from '../check-context';
import { hasFocusVisible } from '../../polish-standard-validator';

export const checkFocusVisible = (ctx: ProductCheckContext): RuleVerdict => {
  // Applicability FIRST: a focusable target can live in markup (e.g. a <button> in an
  // html file with no inline <style>). A file with no focusable target is N/A; a file
  // WITH a focusable target but no readable CSS is an inconclusive gap (we cannot verify
  // the focus styling here, which may be cross-file) - never a silent pass.
  const applicable = focusableTargetApplicability(ctx);
  if (applicable === false) return notApplicable('no focusable element or interactive selector');
  if (!hasCss(ctx)) return inconclusive('focusable target present but no CSS collected to verify focus styling', 'unreadable_input');
  if (applicable === 'unknown') return inconclusive('cannot establish focusable targets from collected evidence', 'unreadable_input');
  return hasFocusVisible(ctx.cssText)
    ? pass(':focus-visible present')
    : fail('implement :focus-visible for keyboard navigation', [], 'Add :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }');
};

export const checkMinHitArea = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasTrustedBrowserEvidence(ctx, 'dom') || !ctx.dom) {
    return inconclusive('hit-area geometry needs trusted DOM evidence', 'unsupported_runtime');
  }
  const hit = ctx.dom.minHitArea;
  if (hit.checked === 0) return notApplicable('no visible interactive element found');
  return hit.failing === 0
    ? pass(`${hit.checked} visible interactive target(s) meet minimum hit area`)
    : fail(`${hit.failing}/${hit.checked} interactive target(s) miss minimum hit area; smallest is ${Math.round(hit.smallestWidth)}x${Math.round(hit.smallestHeight)}px`, [], 'Increase interactive target padding or dimensions to at least 40x40px, and buttons to 44x44px');
};

// a11y/color-contrast moved to rendered-checks.ts (checkLowContrast) in Stage 6 convergence -
// it reads the rendered scanner's low-contrast finding, the SAME detector the eval scores.

export const A11Y_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'a11y/focus-visible': checkFocusVisible,
  'a11y/min-hit-area': checkMinHitArea,
};
