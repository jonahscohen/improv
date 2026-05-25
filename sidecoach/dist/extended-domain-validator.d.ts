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
export declare class ExtendedDomainValidator {
    static validateAll(context: DomainCheckContext): DomainValidationReport;
    static getDomains(): string[];
    static getRulesByDomain(domain: string): DomainValidationRule[];
    static getSummary(): string;
}
//# sourceMappingURL=extended-domain-validator.d.ts.map