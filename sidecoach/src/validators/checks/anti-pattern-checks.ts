// sidecoach/src/validators/checks/anti-pattern-checks.ts
//
// Thin adapter over the SIX exported absolute-ban-detector scanners. The regexes
// (including scanIdenticalCardGrids' repeat(N,1fr) N>=3 precondition) are NOT
// re-derived here. The three precise CSS detectors scan collected CSS; the three
// HTML-structural heuristics (declared minor) scan assembled markup.
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive, hasCss, hasMarkup } from '../check-context';
import {
  scanGradientText, scanGlassmorphism, scanSideStripeBorders,
  scanIdenticalCardGrids, scanHeroMetricTemplate, scanModalAsFirstThought,
} from '../../absolute-ban-detector';
import type { AbsoluteBanFinding } from '../../absolute-ban-detector';

function verdictFromBanFindings(findings: AbsoluteBanFinding[], cleanMessage: string): RuleVerdict {
  if (!findings.length) return pass(cleanMessage);
  const f = findings[0];
  return fail(
    `${f.banName}: ${f.reason}`,
    findings.map((x) => `${x.file}:${x.line ?? '?'}`),
    f.rewriteOptions[0],
  );
}

export const checkGradientText = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanGradientText(ctx.cssText, '<collected-file>'), 'no gradient-text ban');
};

export const checkGlassmorphism = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanGlassmorphism(ctx.cssText, '<collected-file>'), 'no glassmorphism-default ban');
};

export const checkSideStripeBorders = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanSideStripeBorders(ctx.cssText, '<collected-file>'), 'no side-stripe-borders ban');
};

// --- HTML-structural heuristics (declared minor; still emit fail when matched) ---
export const checkIdenticalCardGrids = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanIdenticalCardGrids(ctx.markup, '<assembled-markup>'), 'no identical-card-grids shape');
};

export const checkHeroMetricTemplate = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanHeroMetricTemplate(ctx.markup, '<assembled-markup>'), 'no hero-metric-template shape');
};

export const checkModalAsFirstThought = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanModalAsFirstThought(ctx.markup, '<assembled-markup>'), 'no modal-as-first-thought shape');
};

export const ANTI_PATTERN_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'anti-pattern/gradient-text': checkGradientText,
  'anti-pattern/glassmorphism-default': checkGlassmorphism,
  'anti-pattern/side-stripe-borders': checkSideStripeBorders,
  'anti-pattern/identical-card-grids': checkIdenticalCardGrids,
  'anti-pattern/hero-metric-template': checkHeroMetricTemplate,
  'anti-pattern/modal-as-first-thought': checkModalAsFirstThought,
};
