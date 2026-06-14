// sidecoach/src/validators/checks/anti-pattern-checks.ts
//
// Thin adapter over the SIX exported absolute-ban-detector scanners. The regexes
// (including scanIdenticalCardGrids' repeat(N,1fr) N>=3 precondition) are NOT
// re-derived here. The three precise CSS detectors scan collected CSS; the three
// HTML-structural heuristics (declared minor) scan assembled markup. Findings keep
// the REAL originating file path/line and ALL rewrite options (Codex P2#4).
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive, hasCss, hasMarkup } from '../check-context';
import {
  scanGradientText, scanGlassmorphism, scanSideStripeBorders,
  scanIdenticalCardGrids, scanHeroMetricTemplate, scanModalAsFirstThought,
} from '../../absolute-ban-detector';
import type { AbsoluteBanFinding } from '../../absolute-ban-detector';

type Scanner = (content: string, file: string) => AbsoluteBanFinding[];

function verdictFromBanFindings(findings: AbsoluteBanFinding[], cleanMessage: string): RuleVerdict {
  if (!findings.length) return pass(cleanMessage);
  const f = findings[0];
  // Preserve ALL rewrite options across the matched findings, not just the first.
  const rewrites = [...new Set(findings.flatMap((x) => x.rewriteOptions))];
  return fail(
    `${f.banName}: ${f.reason}`,
    findings.map((x) => `${x.file}:${x.line ?? '?'}`),
    rewrites.length ? rewrites.join('; ') : undefined,
  );
}

// CSS detectors run per-file (executeRule passes a one-file context for scope:file);
// use the REAL collected file path so a finding points at the actual source.
function cssFile(ctx: ProductCheckContext): string {
  return ctx.files[0]?.path ?? '<collected-css>';
}

// Markup heuristics are scope:project, so the assembled context carries every markup
// file. Scan EACH originating file with its real path (source-mapping the assembly back
// to files) instead of one placeholder over the joined blob.
function scanMarkupPerFile(ctx: ProductCheckContext, scanner: Scanner): AbsoluteBanFinding[] {
  const out: AbsoluteBanFinding[] = [];
  for (const f of ctx.files) {
    if (!f.markup || !f.markup.trim()) continue;
    out.push(...scanner(f.markup, f.path));
  }
  return out;
}

export const checkGradientText = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanGradientText(ctx.cssText, cssFile(ctx)), 'no gradient-text ban');
};

export const checkGlassmorphism = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanGlassmorphism(ctx.cssText, cssFile(ctx)), 'no glassmorphism-default ban');
};

export const checkSideStripeBorders = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanSideStripeBorders(ctx.cssText, cssFile(ctx)), 'no side-stripe-borders ban');
};

// --- HTML-structural heuristics (declared minor; still emit fail when matched) ---
export const checkIdenticalCardGrids = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanMarkupPerFile(ctx, scanIdenticalCardGrids), 'no identical-card-grids shape');
};

export const checkHeroMetricTemplate = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanMarkupPerFile(ctx, scanHeroMetricTemplate), 'no hero-metric-template shape');
};

export const checkModalAsFirstThought = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanMarkupPerFile(ctx, scanModalAsFirstThought), 'no modal-as-first-thought shape');
};

export const ANTI_PATTERN_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'anti-pattern/gradient-text': checkGradientText,
  'anti-pattern/glassmorphism-default': checkGlassmorphism,
  'anti-pattern/side-stripe-borders': checkSideStripeBorders,
  'anti-pattern/identical-card-grids': checkIdenticalCardGrids,
  'anti-pattern/hero-metric-template': checkHeroMetricTemplate,
  'anti-pattern/modal-as-first-thought': checkModalAsFirstThought,
};
