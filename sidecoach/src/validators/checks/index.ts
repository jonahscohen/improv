// sidecoach/src/validators/checks/index.ts
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { inconclusive } from '../check-context';
import { POLISH_CHECKS } from './polish-checks';
import { A11Y_CHECKS } from './a11y-checks';
import { THEMING_CHECKS } from './theming-checks';
import { ANTI_PATTERN_CHECKS } from './anti-pattern-checks';

export type CheckFn = (ctx: ProductCheckContext) => RuleVerdict;

// Keyed by canonicalRuleKey. The four slices are disjoint by construction.
export const CHECKS: Record<string, CheckFn> = {
  ...POLISH_CHECKS, ...A11Y_CHECKS, ...THEMING_CHECKS, ...ANTI_PATTERN_CHECKS,
};

// A rule whose check is not yet attached surfaces inconclusive, NEVER a false pass.
export const missingCheck: CheckFn = () => inconclusive('no checkProduct attached for this rule', 'unsupported_runtime');
