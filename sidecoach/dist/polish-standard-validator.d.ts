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
export declare const joinCssRules: (ctx: PolishCheckContext) => string;
export declare const hasScaleOnPress: (css: string) => boolean;
export declare const hasCompoundIconTransition: (css: string) => boolean;
export declare const hasImageOutlineRule: (css: string) => boolean;
export declare const hasNoImages: (text: string) => boolean;
export declare const hasTransitionAll: (css: string) => boolean;
export declare const hasTabularNums: (css: string) => boolean;
export declare const hasDynamicNumberSelectors: (css: string) => boolean;
export declare const hasTextWrapBalance: (css: string) => boolean;
export declare const hasStaggerDelay: (css: string) => boolean;
export declare const hasExitOpacity: (css: string) => boolean;
export declare const hasExitScale: (css: string) => boolean;
export declare const hasAnyMotion: (css: string) => boolean;
export declare const hasFontSmoothing: (css: string) => boolean;
export declare const hasFramerSignal: (text: string) => boolean;
export declare const hasWillChangeAll: (css: string) => boolean;
export declare const hasBoxShadowElevation: (css: string) => boolean;
export declare const hasShadowTokenTiers: (css: string) => boolean;
export declare const countBoxShadowRules: (css: string) => number;
export declare const hasOpticalPadding: (css: string) => boolean;
export declare const POLISH_STATES: string[];
export declare const countDefinedStates: (css: string) => number;
export declare const hasFocusVisible: (css: string) => boolean;
export declare const hasReducedMotion: (css: string) => boolean;
export declare class PolishStandardValidator {
    static validateAll(context: PolishCheckContext): PolishValidationReport;
    static getRules(): PolishValidationRule[];
    static getSummary(): string;
    static toValidationResult(report: PolishValidationReport): ValidationResult;
}
//# sourceMappingURL=polish-standard-validator.d.ts.map