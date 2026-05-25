import type { ValidationResult } from './flow-composition';
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
export declare class PolishStandardValidator {
    static validateAll(context: PolishCheckContext): PolishValidationReport;
    static getRules(): PolishValidationRule[];
    static getSummary(): string;
    static toValidationResult(report: PolishValidationReport): ValidationResult;
}
//# sourceMappingURL=polish-standard-validator.d.ts.map