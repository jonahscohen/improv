// sidecoach/src/validators/checks/polish-checks.ts
//
// Four-status verdicts for the 19 polish-standard-owned rules. The static feature
// predicates are IMPORTED from polish-standard-validator.ts (the faithful source),
// never re-implemented here; only the four-status/applicability wrapper is new. The
// three browser-evidence rules (computed-style/dom) surface inconclusive until P4b.
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss, hasMarkup, withRuleApplicability } from '../check-context';
import {
  hasScaleOnPress, hasCompoundIconTransition, hasImageOutlineRule, hasNoImages,
  hasTransitionAll, hasTabularNums, hasTextWrapBalance, hasStaggerDelay, hasExitOpacity, hasExitScale,
  hasFontSmoothing, hasFramerSignal, hasWillChangeAll, hasBoxShadowElevation, hasShadowTokenTiers,
  countBoxShadowRules, hasOpticalPadding, countDefinedStates, hasReducedMotion,
} from '../../polish-standard-validator';

// A css-rule presence verdict: no CSS -> inconclusive; needle present -> pass; absent -> fail.
function cssPresence(ctx: ProductCheckContext, needle: (css: string) => boolean, okMsg: string, badMsg: string, fix: string): RuleVerdict {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return needle(ctx.cssText) ? pass(okMsg) : fail(badMsg, [], fix);
}

// id 19, css-rule. Old code absence-failed silently; new code keys on collected evidence.
export const checkReducedMotion = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, hasReducedMotion, 'prefers-reduced-motion media query present', 'no prefers-reduced-motion media query found in collected CSS', 'Add: @media (prefers-reduced-motion: reduce) { animation: none; }');

export const checkScaleOnPress = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, hasScaleOnPress, 'scale-on-press present', 'no :active scale(0.96) press feedback', 'Add :active { transform: scale(0.96); }');

export const checkIconSwapCompound = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, hasCompoundIconTransition, 'compound icon transition present', 'icon transitions need opacity + scale (+ blur)', 'Use opacity, transform scale, and filter blur in icon transitions');

export const checkNoTransitionAll = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return hasTransitionAll(ctx.cssText)
    ? fail('transition: all found; use explicit properties', [], 'Replace transition: all with specific properties')
    : pass('no transition: all');
};

export const checkSparseWillChange = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return hasWillChangeAll(ctx.cssText)
    ? fail('will-change: all found', [], 'Use will-change for specific properties only')
    : pass('no will-change: all');
};

export const checkTabularNums = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return hasTabularNums(ctx.cssText)
    ? pass('tabular-nums applied')
    : fail('numeric fields should use tabular-nums', [], 'Add font-variant-numeric: tabular-nums');
};

export const checkSubtleExit = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const ok = hasExitOpacity(ctx.cssText) && hasExitScale(ctx.cssText);
  return ok ? pass('exit choreography present') : fail('exit animations need opacity + scale', [], 'Fade opacity to 0 and scale toward 0.96 on exit');
};

export const checkImageOutline = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx) && !hasMarkup(ctx)) return inconclusive('no source collected', 'unreadable_input');
  const text = `${ctx.cssText}\n${ctx.markup}`;
  if (hasNoImages(text)) return notApplicable('no img rules in project');
  return hasImageOutlineRule(ctx.cssText)
    ? pass('neutral image outline present')
    : fail('image outlines should use neutral transparency', [], 'border: 1px solid rgba(0,0,0,0.1)');
};

export const checkAnimatePresenceInitial = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return /initial\s*=\s*\{?\s*false/.test(ctx.markup)
    ? pass('AnimatePresence initial={false} present')
    : fail('AnimatePresence children need initial={false}', [], 'Set initial={false} on AnimatePresence children');
};

export const checkShadowsOverBorders = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, hasBoxShadowElevation, 'box-shadow elevation present', 'use box-shadow for elevation', 'Add box-shadow: 0 1px 3px rgba(0,0,0,0.1) or elevation tokens');

export const checkShadowHierarchy = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return (hasShadowTokenTiers(ctx.cssText) || countBoxShadowRules(ctx.cssText) >= 3)
    ? pass('shadow hierarchy present')
    : fail('use an elevation-based shadow hierarchy', [], 'Define --shadow-sm/md/lg or 3+ elevation tiers');
};

export const checkStateCompleteness = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const defined = countDefinedStates(ctx.cssText);
  return defined >= 8 ? pass('all 8 component states defined') : fail(`${defined}/8 component states defined`, [], 'Define all 8 component states');
};

export const checkStaggeredEnter = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, hasStaggerDelay, 'stagger delays present', 'animations should use stagger delays', 'Apply animation-delay: calc(30ms * var(--index))');
export const checkFontSmoothing = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, hasFontSmoothing, 'font smoothing present', 'apply font smoothing', 'Add -webkit-font-smoothing: antialiased');
export const checkTextWrapBalance = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, hasTextWrapBalance, 'heading balance present', 'headings should use text-wrap: balance', 'Add text-wrap: balance to heading styles');
export const checkOpticalAlignment = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, hasOpticalPadding, 'optical alignment padding present', 'apply optical alignment adjustments', 'Subtract 2-4px from top padding for descender allowance');

// computed-style / dom rules: browser evidence absent in P4a-2 -> inconclusive (NOT pass).
export const checkConcentricRadius = (_ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('concentric radius needs computed-style evidence (browser collector, P4b)', 'unsupported_runtime');
export const checkTypographyRhythm = (_ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('typography rhythm needs computed-style evidence (browser collector, P4b)', 'unsupported_runtime');
export const checkGenericity = (_ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('genericity needs browser/design-token evidence (P4b)', 'unsupported_runtime');

const RAW_POLISH_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'polish/reduced-motion-respect': checkReducedMotion,
  'polish/scale-on-press': checkScaleOnPress,
  'polish/concentric-radius': checkConcentricRadius,
  'polish/icon-swap-compound': checkIconSwapCompound,
  'polish/image-outline-neutral': checkImageOutline,
  'polish/no-transition-all': checkNoTransitionAll,
  'polish/tabular-nums': checkTabularNums,
  'polish/text-wrap-balance': checkTextWrapBalance,
  'polish/staggered-enter': checkStaggeredEnter,
  'polish/subtle-exit': checkSubtleExit,
  'polish/font-smoothing': checkFontSmoothing,
  'polish/animatepresence-initial': checkAnimatePresenceInitial,
  'polish/sparse-will-change': checkSparseWillChange,
  'polish/shadows-over-borders': checkShadowsOverBorders,
  'polish/optical-alignment': checkOpticalAlignment,
  'polish/typography-rhythm': checkTypographyRhythm,
  'polish/shadow-hierarchy': checkShadowHierarchy,
  'polish/state-completeness': checkStateCompleteness,
  'polish/anti-pattern-genericity': checkGenericity,
};

// Every static Polish check is wrapped with its applicability probe (the browser-only
// rules have no probe, so withRuleApplicability runs their raw inconclusive directly).
export const POLISH_CHECKS = Object.fromEntries(
  Object.entries(RAW_POLISH_CHECKS).map(([key, fn]) => [key, withRuleApplicability(key, fn)]),
) as Record<string, (ctx: ProductCheckContext) => RuleVerdict>;
