// sidecoach/src/validators/checks/index.ts
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { inconclusive } from '../check-context';
import { POLISH_CHECKS } from './polish-checks';
import { A11Y_CHECKS } from './a11y-checks';
import { THEMING_CHECKS } from './theming-checks';
import { ANTI_PATTERN_CHECKS } from './anti-pattern-checks';
import { RENDERED_CHECKS } from './rendered-checks';
import { FORMS_CHECKS } from './forms-checks';
import { PAGE_QUALITY_CHECKS } from './page-quality-checks';

export type CheckFn = (ctx: ProductCheckContext) => RuleVerdict;

// Keyed by canonicalRuleKey. The slices are disjoint by construction. RENDERED_CHECKS holds the rendered-scan
// checks; FORMS_CHECKS holds the absorbed forms-a11y markup checks (Stage 2); a11y/color-contrast stays in
// A11Y_CHECKS (collector-backed) until its rendered migration in a later stage.
export const CHECKS: Record<string, CheckFn> = {
  ...POLISH_CHECKS, ...A11Y_CHECKS, ...THEMING_CHECKS, ...ANTI_PATTERN_CHECKS, ...RENDERED_CHECKS, ...FORMS_CHECKS, ...PAGE_QUALITY_CHECKS,
};

// A rule whose check is not yet attached surfaces inconclusive, NEVER a false pass.
export const missingCheck: CheckFn = () => inconclusive('no checkProduct attached for this rule', 'unsupported_runtime');
