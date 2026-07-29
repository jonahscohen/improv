// sidecoach/src/validators/checks/anti-pattern-checks.ts
//
// Thin adapter over the exported absolute-ban-detector scanners (see BAN_SCANNERS). The regexes
// are NOT re-derived here. The three precise CSS detectors scan collected CSS; the two
// HTML-structural heuristics (declared minor) scan assembled markup. Findings keep
// the REAL originating file path/line and ALL rewrite options (Codex P2#4).
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive, hasCss, hasMarkup } from '../check-context';
import { cssRegionsOf } from '../source-locator';
import {
  scanGradientText, scanGlassmorphism, scanSideStripeBorders,
  scanHeroMetricTemplate, scanModalAsFirstThought,
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

/**
 * Run a CSS ban scanner over every collected file's CSS REGIONS, remapping each finding's
 * line back to the line in the REAL FILE.
 *
 * This replaces `scanner(ctx.cssText, ctx.files[0].path)`, which was wrong twice over.
 * ctx.cssText is project-collector's concatenation of `<style>` bodies with the file
 * positions discarded, so a line computed in it is a line in an anonymous slice - yet it
 * was printed as `${file}:${line}` under a real filename. Measured 2026-07-29 on the
 * canary: the gradient-text rule lives on file line 6 and this path reported line 3. It
 * also labelled EVERY file's findings with files[0].path, so in a multi-file project a
 * finding in the second file named the first.
 *
 * cssRegionsOf re-derives the regions from the markup WITH their file start lines, so the
 * remap is exact. Evidence is untouched (cssText is still what the predicates read), so no
 * pass/fail verdict can move - only the reported location changes.
 */
function scanCssPerRegion(ctx: ProductCheckContext, scanner: Scanner): AbsoluteBanFinding[] {
  const out: AbsoluteBanFinding[] = [];
  for (const f of ctx.files || []) {
    for (const region of cssRegionsOf(f)) {
      if (!region.text.trim()) continue;
      for (const finding of scanner(region.text, region.path)) {
        // Scanner lines are 1-based within region.text, which begins at region.startLine.
        const line = finding.line === undefined ? undefined : region.startLine + finding.line - 1;
        out.push({ ...finding, line });
      }
    }
  }
  return out;
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
  return verdictFromBanFindings(scanCssPerRegion(ctx, scanGradientText), 'no gradient-text ban');
};

export const checkGlassmorphism = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanCssPerRegion(ctx, scanGlassmorphism), 'no glassmorphism-default ban');
};

export const checkSideStripeBorders = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanCssPerRegion(ctx, scanSideStripeBorders), 'no side-stripe-borders ban');
};

// --- HTML-structural heuristics (declared minor; still emit fail when matched) ---
// (checkIdenticalCardGrids deleted Stage-2 2026-06-24 - the underlying scanIdenticalCardGrids had a ReDoS + was a
// low-precision over-firing detector; removed, no replacement.)
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
  'anti-pattern/hero-metric-template': checkHeroMetricTemplate,
  'anti-pattern/modal-as-first-thought': checkModalAsFirstThought,
};
