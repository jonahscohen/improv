// sidecoach/src/validators/checks/theming-checks.ts
//
// Four-status verdicts for the two theming-owned rules. The scanners, Tailwind/
// shadcn detection, token-reference, CSS-block iteration, and radius-literal logic
// are REUSED from taste-validator.ts - this module only reconstructs allCss the way
// validateTaste does, runs the faithful scanners, and maps findings to verdicts.
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import type { Applicability } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss } from '../check-context';
import {
  detectTailwindContext, extractInlineStyles, checkHexInHoverWithCssVars, checkBorderRadiusInconsistency,
} from '../../taste-validator';
import type { ValidateTasteOptions } from '../../taste-validator';

// Reconstruct the analyzed CSS exactly as validateTaste does: external CSS plus the
// inline <style> blocks lifted out of the markup.
function buildAllCss(ctx: ProductCheckContext): string {
  const inline = extractInlineStyles(ctx.markup || '').map((b) => b.content).join('\n');
  return `${ctx.cssText || ''}\n${inline}`;
}
function tasteOpts(ctx: ProductCheckContext): ValidateTasteOptions | undefined {
  return ctx.tasteOptions?.componentsJson ? { componentsJson: true } : undefined;
}

const hasTokenSystem = (css: string): boolean => /--[\w-]+\s*:/.test(css) || /var\(\s*--[\w-]+/.test(css);
const hasInteractiveState = (css: string): boolean => /(:hover|:active)\b/.test(css);

// Applicable only when BOTH an interactive state and a token system are established;
// absence of either is N/A (no token system to violate).
export const interactiveTokenApplicability = (ctx: ProductCheckContext): Applicability => {
  if (!hasCss(ctx)) return 'unknown';
  const css = buildAllCss(ctx);
  return hasInteractiveState(css) && hasTokenSystem(css);
};

// Applicable when at least one radius declaration or rounded utility is established.
export const radiusApplicability = (ctx: ProductCheckContext): Applicability => {
  if (!hasCss(ctx) && !(ctx.markup || '').trim()) return 'unknown';
  const css = buildAllCss(ctx);
  return /border-radius\s*:/.test(css) || /\brounded(?:-(?:sm|md|lg|xl|2xl|3xl|full|none))?\b/.test(`${css} ${ctx.markup || ''}`);
};

export const checkHexInInteractiveState = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const applicability = interactiveTokenApplicability(ctx);
  if (applicability === 'unknown') return inconclusive('cannot establish interactive token applicability', 'unreadable_input');
  if (!applicability) return notApplicable('no interactive token-system target');
  const allCss = buildAllCss(ctx);
  const tailwind = detectTailwindContext(ctx.markup || '', allCss, tasteOpts(ctx));
  const offenders = checkHexInHoverWithCssVars(allCss, tailwind);
  return offenders.length
    ? fail(
        `interactive state(s) use hardcoded hex while tokens exist: ${offenders.map((o) => o.message).join(' | ')}`,
        offenders.map((o) => o.excerpt ?? o.ruleId),
        'Derive the interactive state from a token, e.g. var(--c-brand-hover)',
      )
    : pass('interactive states are token-driven');
};

export const checkBorderRadiusConsistency = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  if (!radiusApplicability(ctx)) return notApplicable('no radius declaration or rounded utility');
  const allCss = buildAllCss(ctx);
  const tailwind = detectTailwindContext(ctx.markup || '', allCss, tasteOpts(ctx));
  const violations = checkBorderRadiusInconsistency(allCss, tailwind);
  return violations.length
    ? fail(violations[0].message, [], 'Use 1-2 named radius tokens from a radius scale')
    : pass('radius usage satisfies taste scanner');
};

export const THEMING_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'theming/token-driven-interactive-state': checkHexInInteractiveState,
  'theming/border-radius-consistency': checkBorderRadiusConsistency,
};
