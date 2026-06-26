// Task #23: Anti-Pattern Validator
// Validates code against 27 deterministic anti-patterns with severity scoring
// Used by audit flows (K, L, V) to detect design violations

import type { ProductCheckContext } from './validators/check-context';
import type { CanonicalSeverity } from './product-rule-types';

// Registry-backed (Stage 4 convergence). The private design-laws ANTI_PATTERNS engine
// (27 patterns; 21 were presence-of-CSS theater) is RETIRED. validateCode now runs the
// registry's anti-pattern owner rules (the real named bans, backed by absolute-ban-detector).
// RULES is required LAZILY so this module can be imported anywhere without a registry cycle.
const AP_SEVERITY: Record<CanonicalSeverity, 'critical' | 'high' | 'medium' | 'low'> = {
  blocker: 'critical', major: 'high', minor: 'medium', advisory: 'low',
};
let _antiPatternRules: any[] | null = null;
function antiPatternRegistryRules(): any[] {
  if (_antiPatternRules === null) {
    const { RULES } = require('./product-rule-registry');
    _antiPatternRules = (RULES as any[]).filter(
      (r) => r.ownerValidatorId === 'anti-pattern' && typeof r.checkProduct === 'function',
    );
  }
  return _antiPatternRules;
}

export interface AntiPatternViolation {
  patternId: string;
  patternName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line?: number;
  column?: number;
  match?: string;
  fix?: string;
}

export interface ValidationResult {
  totalViolations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  violations: AntiPatternViolation[];
  score: number; // 0-100, where 100 is no violations
  recommendations: string[];
}

export class AntiPatternValidator {
  /**
   * Validate code/design against all 27 anti-patterns
   * Returns violations organized by severity with score
   */
  validateCode(code: string): ValidationResult {
    const violations: AntiPatternViolation[] = [];
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;

    // Run the registry's anti-pattern owner rules over the code (as both CSS + markup).
    // Provide a synthetic CollectedFile too: the markup checks (hero-metric, modal) scan
    // ctx.files[].markup per-file, so files:[] would make them silently pass (Codex P1).
    const ctx: ProductCheckContext = {
      cssText: code,
      markup: code,
      files: [{ path: '<input>', sourceKind: 'html', cssText: code, markup: code, evidenceKindsPresent: ['css-rule', 'markup'] }],
    };
    for (const rule of antiPatternRegistryRules()) {
      const v = rule.checkProduct(ctx);
      if (v.status === 'fail') {
        const severity = AP_SEVERITY[rule.severity as CanonicalSeverity] || 'medium';
        violations.push({
          patternId: rule.canonicalRuleKey,
          patternName: rule.canonicalRuleKey,
          severity,
          match: v.message,
          fix: v.remediation,
        });
        if (severity === 'critical') criticalCount++;
        else if (severity === 'high') highCount++;
        else if (severity === 'medium') mediumCount++;
      }
    }

    // Calculate score: 0-100 with penalties
    // Critical: -10 each, High: -5 each, Medium: -2 each
    const score = Math.max(
      0,
      100 - criticalCount * 10 - highCount * 5 - mediumCount * 2
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      violations,
      score
    );

    return {
      totalViolations: violations.length,
      criticalCount,
      highCount,
      mediumCount,
      violations: violations.sort(
        (a, b) =>
          this.severityRank(b.severity) - this.severityRank(a.severity)
      ),
      score,
      recommendations,
    };
  }

  /**
   * Validate specific CSS or design properties
   */
  validateCSS(css: string): ValidationResult {
    return this.validateCode(css);
  }

  /**
   * Validate JSX/HTML markup
   */
  validateMarkup(markup: string): ValidationResult {
    return this.validateCode(markup);
  }

  /**
   * Check if code passes anti-pattern validation
   */
  passes(code: string): boolean {
    const result = this.validateCode(code);
    return result.criticalCount === 0 && result.highCount === 0;
  }

  /**
   * Get violations of specific severity
   */
  violationsBySeverity(
    code: string,
    severity: 'critical' | 'high' | 'medium' | 'low'
  ): AntiPatternViolation[] {
    const result = this.validateCode(code);
    return result.violations.filter((v) => v.severity === severity);
  }

  /**
   * Get report for specific pattern
   */
  reportForPattern(
    code: string,
    patternId: string
  ): AntiPatternViolation | undefined {
    const result = this.validateCode(code);
    return result.violations.find((v) => v.patternId === patternId);
  }

  /**
   * Batch validate multiple code blocks
   */
  validateBatch(
    codeBlocks: Record<string, string>
  ): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};
    for (const [name, code] of Object.entries(codeBlocks)) {
      results[name] = this.validateCode(code);
    }
    return results;
  }

  /**
   * Get summary statistics across all patterns
   */
  getPatternStats(code: string): Record<string, number> {
    const stats: Record<string, number> = {};
    const result = this.validateCode(code);

    for (const violation of result.violations) {
      const name = violation.patternName.replace(/\s+/g, '_').toLowerCase();
      stats[name] = (stats[name] || 0) + 1;
    }

    return stats;
  }

  // Private helper methods

  private generateRecommendations(
    violations: AntiPatternViolation[],
    score: number
  ): string[] {
    const recommendations: string[] = [];

    if (score >= 90) {
      recommendations.push('✓ Excellent anti-pattern score');
    } else if (score >= 70) {
      recommendations.push('⚠️  Minor anti-pattern violations detected - review suggestions');
    } else if (score >= 50) {
      recommendations.push('⚠️  Moderate anti-pattern violations - prioritize high/critical fixes');
    } else {
      recommendations.push('⚠️  Severe anti-pattern violations - major refactor recommended');
    }

    // Add specific recommendations
    const criticalViolations = violations.filter((v) => v.severity === 'critical');
    const highViolations = violations.filter((v) => v.severity === 'high');

    if (criticalViolations.length > 0) {
      recommendations.push(
        `Fix ${criticalViolations.length} CRITICAL issue(s): ${criticalViolations
          .map((v) => v.patternName)
          .join(', ')}`
      );
    }

    if (highViolations.length > 0) {
      recommendations.push(
        `Address ${highViolations.length} HIGH-severity issue(s) for accessibility and usability`
      );
    }

    if (violations.length === 0) {
      recommendations.push('✓ No anti-patterns detected - design follows best practices');
    }

    return recommendations;
  }

  private severityRank(severity: string): number {
    const ranks: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return ranks[severity] || 0;
  }
}

export function createAntiPatternValidator(): AntiPatternValidator {
  return new AntiPatternValidator();
}
