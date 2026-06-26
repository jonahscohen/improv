// Sidecoach Polish Standard Validator
// Utility for validating UI implementations against 24-point proprietary polish framework
// Separate from flow handlers - used by Flow J (Tactical Polish) and audit flows

import type { ValidationResult } from './flow-composition';
import type { ProductCheckContext } from './validators/check-context';
import type { CanonicalSeverity } from './product-rule-types';

export interface PolishValidationRule {
  id: number;
  name: string;
  category: 'baseline' | 'proprietary';
  description: string;
  checkFunction: (context: PolishCheckContext) => PolishCheckResult;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface PolishCheckContext {
  htmlElement?: HTMLElement;
  computedStyle?: CSSStyleDeclaration;
  cssRules?: string[];
  componentTree?: Record<string, any>;
  designTokens?: Record<string, any>;
  accessibility?: AccessibilityReport;
  contrast?: ContrastReport;
}

export interface PolishCheckResult {
  ruleId: number;
  passed: boolean;
  message: string;
  details?: string;
  remediation?: string;
  evidence?: string;
}

export interface AccessibilityReport {
  wcagLevel: 'A' | 'AA' | 'AAA';
  ariaRoles: string[];
  focusableElements: number;
  contrastRatios: Record<string, number>;
}

export interface ContrastReport {
  foreground: string;
  background: string;
  ratio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
}

export interface PolishValidationReport {
  totalRules: number;
  passed: number;
  violations: number;
  passRate: string;
  criticalViolations: number;
  results: PolishCheckResult[];
  summary: string;
}

// ============================================================================
// Shared static source predicates (P4a-2). Extracted so the live POLISH_RULES
// callbacks below AND the four-status adapter in validators/checks/polish-checks.ts
// call the SAME predicate - no regex/threshold is implemented twice. Each operates
// on a joined CSS-family string; the callbacks join ctx.cssRules before calling.
// ============================================================================
export const joinCssRules = (ctx: PolishCheckContext): string => (ctx.cssRules || []).join('\n');

export const hasScaleOnPress = (css: string): boolean => css.includes('scale(0.96)');
export const hasCompoundIconTransition = (css: string): boolean => css.includes('opacity') && css.includes('scale');
export const hasImageOutlineRule = (css: string): boolean =>
  /img\s*\{[^}]*(?:outline|border)[^}]*rgba\s*\(\s*0\s*,\s*0\s*,\s*0/i.test(css)
  || /(?:img|\.image)[^{]*\{[^}]*box-shadow[^}]*inset[^}]*rgba/i.test(css);
export const hasNoImages = (text: string): boolean => !/img\s*\{|\.image\b|<img\b/.test(text);
export const hasTransitionAll = (css: string): boolean => css.includes('transition: all');
export const hasTabularNums = (css: string): boolean => /font-variant-numeric\s*:\s*(?:[^;]*\b)?tabular-nums/i.test(css);
export const hasDynamicNumberSelectors = (css: string): boolean => /\.(?:counter|timer|stat|price|count|metric|number|kpi|tabular)\b/i.test(css);
export const hasTextWrapBalance = (css: string): boolean => css.includes('text-wrap: balance');
export const hasStaggerDelay = (css: string): boolean => css.includes('animation-delay');
export const hasExitOpacity = (css: string): boolean => css.includes('opacity: 0');
export const hasExitScale = (css: string): boolean => css.includes('scale(0.8)') || css.includes('scale(0.96)');
export const hasAnyMotion = (css: string): boolean => /transition\s*:|@keyframes\b|animation\s*:/.test(css);
export const hasFontSmoothing = (css: string): boolean => css.includes('-webkit-font-smoothing');
export const hasFramerSignal = (text: string): boolean => /framer-motion|<AnimatePresence/.test(text);
export const hasWillChangeAll = (css: string): boolean => css.includes('will-change: all');
export const hasBoxShadowElevation = (css: string): boolean => /box-shadow\s*:\s*[^;]*\(/.test(css);
export const hasShadowTokenTiers = (css: string): boolean => /--shadow-(?:sm|xs|md|lg|xl|2xl|small|medium|large)/i.test(css);
export const countBoxShadowRules = (css: string): number => (css.match(/box-shadow\s*:/g) || []).length;
export const hasOpticalPadding = (css: string): boolean => css.includes('padding');
export const POLISH_STATES = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
export const countDefinedStates = (css: string): number => POLISH_STATES.filter((s) => css.includes(`:${s}`)).length;
export const hasFocusVisible = (css: string): boolean => css.includes(':focus-visible');
export const hasReducedMotion = (css: string): boolean => css.includes('@media (prefers-reduced-motion');
// #4 Interruptible Animations: interactive state changes should use CSS transitions (interruptible),
// not keyframe `animation` (runs to completion). Flags :hover/:focus/:active blocks that declare an
// `animation:`/`animation-name:` property (shorthand/name set a keyframe; animation-delay/duration/play-state
// alone are not matched - those tune an existing animation and aren't the violation). The property must sit
// at a declaration boundary ({, ; or whitespace) so a `--animation` custom property or a `transition-property:
// animation` value does not false-match, while a `-webkit-`/`-moz-`/`-o-`/`-ms-` vendor prefix still counts.
// Bounded quantifiers (selectors <500, declaration blocks <4000) keep it linear/ReDoS-safe.
export const hasKeyframeAnimationOnInteractiveState = (css: string): boolean =>
  /(?::hover|:focus|:active)[^{}]{0,500}\{(?:[^}]{0,4000}[\s;{])?(?:-(?:webkit|moz|o|ms)-)?animation(?:-name)?\s*:/i.test(css);
// #13 Skip Animation on Page Load (CSS-only complement to AnimatePresence initial={false}): an entrance
// @keyframes (a from/0% frame setting opacity:0) replays on every page load unless gated. Returns true when
// such a frame exists; the check then fails only when nothing gates it (no reduced-motion guard, no
// AnimatePresence initial={false}).
export const hasEntranceKeyframe = (css: string): boolean => {
  // Scan each @keyframes block body with a brace-balanced walk and test ONLY that body for a from/0% frame
  // setting opacity:0. Scoping to the block (vs an unbounded lazy span) avoids attributing an opacity:0 from
  // an unrelated rule to a keyframe, and the bounded inner quantifier keeps it ReDoS-safe.
  const blockStart = /@keyframes[^{]{0,200}\{/gi;
  let m: RegExpExecArray | null;
  while ((m = blockStart.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const bodyStart = i;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    const body = css.slice(bodyStart, i - 1);
    if (/(?:\bfrom\b|\b0%)\s*\{[^}]{0,1000}\bopacity\s*:\s*0\b/i.test(body)) return true;
    blockStart.lastIndex = i;
  }
  return false;
};

// ============================================================================
// Registry-backed PolishStandardValidator (Stage 4 convergence).
// The private POLISH_RULES engine was DELETED - the 24 polish rules already live
// in the rule registry (21 under owner 'polish-standard' + 3 under 'static-a11y',
// each carrying a `polish-standard:N` sourceRuleAlias). validateAll now runs THOSE
// rules' checkProduct over a registry ProductCheckContext, so there is ONE engine.
// The exported helper predicates above are KEPT - the registry's checks/polish-checks.ts
// and checks/a11y-checks.ts import them. RULES is required LAZILY (not a top-level
// import) because those checks import from THIS module, so a static import would be
// circular. Behavior note: the registry checks are sync cssText/markup-only, so legacy
// ad-hoc computedStyle/contrast paths no longer force a pass (correct convergence).
// ============================================================================

const LEGACY_SEVERITY_POLISH: Record<CanonicalSeverity, 'critical' | 'high' | 'medium' | 'low'> = {
  blocker: 'critical', major: 'high', minor: 'medium', advisory: 'low',
};

let _polishRegistryRules: Array<{ n: number; rule: any }> | null = null;
function polishRegistryRules(): Array<{ n: number; rule: any }> {
  if (_polishRegistryRules === null) {
    // Lazy require breaks the cycle (the registry's checks import helpers from this file).
    const { RULES } = require('./product-rule-registry');
    _polishRegistryRules = (RULES as any[])
      .map((r) => {
        const alias = (r.sourceRuleAliases || []).find((a: string) => /^polish-standard:\d+$/.test(a));
        return alias && typeof r.checkProduct === 'function'
          ? { n: parseInt(alias.split(':')[1], 10), rule: r }
          : null;
      })
      .filter((x): x is { n: number; rule: any } => x !== null)
      .sort((a, b) => a.n - b.n);
  }
  return _polishRegistryRules;
}

function polishContextToProduct(ctx: PolishCheckContext): ProductCheckContext {
  let markup = '';
  if (ctx.htmlElement) { try { markup = (ctx.htmlElement as { outerHTML?: string }).outerHTML || ''; } catch { /* no DOM */ } }
  return { cssText: (ctx.cssRules || []).join('\n'), markup, files: [] };
}

export class PolishStandardValidator {
  static validateAll(context: PolishCheckContext): PolishValidationReport {
    const entries = polishRegistryRules();
    const pctx = polishContextToProduct(context);
    const results: PolishCheckResult[] = entries.map(({ n, rule }) => {
      const v = rule.checkProduct(pctx);
      return { ruleId: n, passed: v.status !== 'fail', message: v.message, remediation: v.remediation };
    });
    const passed = results.filter(r => r.passed).length;
    const violations = results.filter(r => !r.passed);
    const total = entries.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    // Registry 'blocker' severity maps to the legacy 'critical' tier.
    const critical = violations.filter(v => {
      const e = entries.find(x => x.n === v.ruleId);
      return !!e && e.rule.severity === 'blocker';
    }).length;

    return {
      totalRules: total,
      passed,
      violations: violations.length,
      passRate: `${passRate}%`,
      criticalViolations: critical,
      results,
      summary: `Polish Standard: ${passed}/${total} rules passed (${passRate}%)`
    };
  }

  static getRules(): PolishValidationRule[] {
    return polishRegistryRules().map(({ n, rule }) => ({
      id: n,
      name: rule.canonicalRuleKey,
      category: n <= 16 ? 'baseline' as const : 'proprietary' as const,
      description: rule.canonicalRuleKey,
      checkFunction: (ctx: PolishCheckContext): PolishCheckResult => {
        const v = rule.checkProduct(polishContextToProduct(ctx));
        // Only a real pass or a genuine not_applicable counts as passed; 'inconclusive'
        // (e.g. evidence absent) must NOT clean-pass - it blocks a clean result (Codex P0).
        return { ruleId: n, passed: v.status === 'pass' || v.status === 'not_applicable', message: v.message, remediation: v.remediation };
      },
      severity: LEGACY_SEVERITY_POLISH[rule.severity as CanonicalSeverity] || 'medium',
    }));
  }

  static getSummary(): string {
    return 'Sidecoach Polish Standard (registry-backed): 24 polish rules for production UI quality';
  }

  static toValidationResult(report: PolishValidationReport): ValidationResult {
    const failed = report.results.filter(r => !r.passed);
    const status: 'pass' | 'fail' | 'partial' =
      report.criticalViolations > 0 ? 'fail' :
      report.violations > 0 ? 'partial' :
      'pass';
    return {
      domain: 'polish-standard',
      status,
      passedRules: report.results.filter(r => r.passed).map(r => `rule-${r.ruleId}`),
      failedRules: failed.map(r => `rule-${r.ruleId}`),
      message: report.summary,
    };
  }
}
