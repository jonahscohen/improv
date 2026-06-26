// Sidecoach Domain Validator (Stage 2 convergence - registry-backed facade).
// Was a 196-rule framework; the theater rules were retired and the real ones
// absorbed into the registry forms + page-quality validators. This file now keeps
// the legacy DomainValidationReport TYPES (19 importers) and a thin registry-backed
// ExtendedDomainValidator facade. See session_2026-06-25_sidecoach-migration-handoff.md.

export interface DomainValidationRule {
  id: string;
  domain: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  checkFunction: (context: DomainCheckContext) => DomainCheckResult;
}

export interface DomainCheckContext {
  htmlElement?: HTMLElement;
  computedStyle?: CSSStyleDeclaration;
  cssRules?: string[];
  // T-0030: raw HTML markup string. Used by the forms domain (and gesture
  // motion rules) to statically scan attribute-level markup that does not
  // surface through cssRules or a live htmlElement. Optional - rules degrade
  // gracefully when it is absent.
  html?: string;
  componentTree?: Record<string, any>;
  designTokens?: Record<string, any>;
  typography?: TypographyMetrics;
  colors?: ColorPalette;
  spacing?: SpacingSystem;
  motion?: MotionConfig;
  accessibility?: AccessibilityReport;
  contrast?: ContrastReport;
  performance?: PerformanceMetrics;
  visualization?: VisualizationContext;
  internationalization?: I18nContext;
}

export interface TypographyMetrics {
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  fontFamily: string;
  letterSpacing: number;
  textAlign: string;
}

export interface ColorPalette {
  primary: string[];
  secondary: string[];
  semantic: Record<string, string>;
  neutral: string[];
  customCount: number;
}

export interface SpacingSystem {
  baseUnit: number;
  scale: number[];
  gutter: number;
  containerMaxWidth: number;
}

export interface MotionConfig {
  duration: number;
  easing: string;
  delay: number;
  hasReducedMotionMedia: boolean;
}

export interface AccessibilityReport {
  wcagLevel: 'A' | 'AA' | 'AAA';
  ariaRoles: string[];
  focusableElements: number;
  contrastRatios: Record<string, number>;
  keyboardNavigable: boolean;
  screenReaderText: string[];
}

export interface ContrastReport {
  foreground: string;
  background: string;
  ratio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
}

export interface PerformanceMetrics {
  jsSize: number;
  cssSize: number;
  imageOptimized: boolean;
  fontCount: number;
  bundleSize: number;
}

export interface VisualizationContext {
  chartType?: string;
  hasLegend: boolean;
  hasAxisLabels: boolean;
  isColorblindSafe: boolean;
  hasTooltips: boolean;
}

export interface I18nContext {
  languages: string[];
  rtlSupport: boolean;
  dateFormat: string;
  numberFormat: string;
  pluralizationRules: string;
}

export interface DomainCheckResult {
  ruleId: string;
  domain: string;
  passed: boolean;
  message: string;
  details?: string;
  remediation?: string;
  evidence?: string;
}

export interface DomainValidationReport {
  status?: 'completed' | 'skipped';
  reason?: string;
  totalRules: number;
  passed: number;
  violations: number;
  passRate: string;
  violationsByDomain: Record<string, number>;
  passRateByDomain: Record<string, string>;
  criticalViolations: number;
  results: DomainCheckResult[];
  summary: string;
}

// ============================================================================
// REGISTRY-BACKED FACADE (Stage 2 convergence, 2026-06-25).
// The former 196 "domain" rules + the 2 Tier-2 modules were RETIRED: the bulk
// were theater (fake/keyword-proxy/always-pass/NLP detection). The genuinely-real
// rules were ABSORBED into the registry's `forms` (16) and `page-quality` (6)
// validators. ExtendedDomainValidator is now a thin SYNC facade that runs THOSE
// absorbed registry rules and shapes the legacy DomainValidationReport, so the
// flow-handlers keep working with HONEST (registry-derived) numbers.
// ============================================================================
import { RULES } from './product-rule-registry';
import { isStaticallySatisfiable, type CanonicalSeverity } from './product-rule-types';
import type { ProductCheckContext } from './validators/check-context';

const ABSORBED = RULES.filter(
  (r) => (r.ownerValidatorId === 'forms' || r.ownerValidatorId === 'page-quality')
    && isStaticallySatisfiable(r.evidenceRequirements)
    && typeof r.checkProduct === 'function',
);

const LEGACY_SEVERITY: Record<CanonicalSeverity, 'critical' | 'high' | 'medium' | 'low'> = {
  blocker: 'critical', major: 'high', minor: 'medium', advisory: 'low',
};

function toProductContext(ctx: DomainCheckContext): ProductCheckContext {
  const markupParts: string[] = [];
  if (ctx.html) markupParts.push(ctx.html);
  if (ctx.htmlElement) { try { markupParts.push((ctx.htmlElement as { outerHTML?: string }).outerHTML || ''); } catch { /* no DOM */ } }
  return { cssText: (ctx.cssRules || []).join('\n'), markup: markupParts.join('\n'), files: [] };
}

export class ExtendedDomainValidator {
  static validateAll(context: DomainCheckContext): DomainValidationReport {
    const ctx = context || ({} as DomainCheckContext);
    const designTokensEmpty = !ctx.designTokens || Object.keys(ctx.designTokens).length === 0;
    const cssRulesEmpty = !ctx.cssRules || ctx.cssRules.length === 0;
    const anyOtherInput = !!ctx.htmlElement || !!ctx.html || !!ctx.computedStyle || !!ctx.colors
      || !!ctx.typography || !!ctx.spacing || !!ctx.motion || !!ctx.accessibility || !!ctx.contrast
      || !!ctx.performance || !!ctx.visualization || !!ctx.internationalization;
    if (designTokensEmpty && cssRulesEmpty && !anyOtherInput) {
      return {
        status: 'skipped', reason: 'no inputs provided', totalRules: 0, passed: 0, violations: 0,
        passRate: 'n/a', violationsByDomain: {}, passRateByDomain: {}, criticalViolations: 0, results: [],
        summary: 'Validation skipped: no inputs provided (designTokens, cssRules, and all domain-specific inputs are empty/missing)',
      };
    }
    const pctx = toProductContext(ctx);
    const results: DomainCheckResult[] = ABSORBED.map((r) => {
      const v = r.checkProduct!(pctx);
      return { ruleId: r.ruleId, domain: r.findingClass, passed: v.status !== 'fail', message: v.message, remediation: v.remediation };
    });
    const total = ABSORBED.length;
    const passed = results.filter((r) => r.passed).length;
    const violationsList = results.filter((r) => !r.passed);
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    const critical = violationsList.filter((v) => {
      const def = ABSORBED.find((r) => r.ruleId === v.ruleId);
      return !!def && (def.severity === 'blocker' || def.severity === 'major');
    }).length;
    const violationsByDomain: Record<string, number> = {};
    const passRateByDomain: Record<string, string> = {};
    // Key BOTH by findingClass (a11y/perf/theming/polish...) AND by ownerValidatorId
    // (forms/page-quality). Callers ask for either name: flow-handlers read
    // passRateByDomain['forms'] by OWNER, while the absorbed forms rules carry
    // findingClass 'a11y'. Keying by findingClass alone made passRateByDomain['forms']
    // undefined, so flow-handler-component-implementation reported Forms as 0/N
    // regardless of real results (Codex P1, sibling of the getRulesByDomain fix).
    const domainKeys = new Set<string>();
    for (const r of ABSORBED) { domainKeys.add(r.findingClass); domainKeys.add(r.ownerValidatorId); }
    for (const domain of domainKeys) {
      const domainRuleIds = new Set(
        ABSORBED.filter((r) => r.findingClass === domain || r.ownerValidatorId === domain).map((r) => r.ruleId),
      );
      const domainPassed = results.filter((r) => domainRuleIds.has(r.ruleId) && r.passed).length;
      violationsByDomain[domain] = domainRuleIds.size - domainPassed;
      passRateByDomain[domain] = `${((domainPassed / domainRuleIds.size) * 100).toFixed(1)}%`;
    }
    return {
      status: 'completed', totalRules: total, passed, violations: violationsList.length,
      passRate: `${passRate}%`, violationsByDomain, passRateByDomain, criticalViolations: critical, results,
      summary: `Domain validation (registry-backed): ${passed}/${total} rules passed (${passRate}%)`,
    };
  }

  static getDomains(): string[] {
    return [...new Set(ABSORBED.map((r) => r.findingClass))];
  }

  static getRulesByDomain(domain: string): DomainValidationRule[] {
    // Match on the owning validator id OR the finding-class. The absorbed FORMS
    // rules carry findingClass 'a11y' (not 'forms'), so a findingClass-only match
    // made getRulesByDomain('forms') return empty and silently dropped the forms
    // guidance from flows that ask for it by owner name (e.g. component-implementation).
    return ABSORBED.filter((r) => r.findingClass === domain || r.ownerValidatorId === domain).map((r) => ({
      id: r.ruleId, domain: r.findingClass, name: r.canonicalRuleKey, description: r.canonicalRuleKey,
      severity: LEGACY_SEVERITY[r.severity],
      checkFunction: (ctx: DomainCheckContext): DomainCheckResult => {
        const v = r.checkProduct!(toProductContext(ctx));
        return { ruleId: r.ruleId, domain: r.findingClass, passed: v.status !== 'fail', message: v.message, remediation: v.remediation };
      },
    }));
  }

  static getSummary(): string {
    return `Sidecoach domain validation runs via the registry: ${ABSORBED.length} rules across ${ExtendedDomainValidator.getDomains().length} finding-classes.`;
  }
}
