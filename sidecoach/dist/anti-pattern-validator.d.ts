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
    score: number;
    recommendations: string[];
}
export declare class AntiPatternValidator {
    /**
     * Validate code/design against all 27 anti-patterns
     * Returns violations organized by severity with score
     */
    validateCode(code: string): ValidationResult;
    /**
     * Validate specific CSS or design properties
     */
    validateCSS(css: string): ValidationResult;
    /**
     * Validate JSX/HTML markup
     */
    validateMarkup(markup: string): ValidationResult;
    /**
     * Check if code passes anti-pattern validation
     */
    passes(code: string): boolean;
    /**
     * Get violations of specific severity
     */
    violationsBySeverity(code: string, severity: 'critical' | 'high' | 'medium' | 'low'): AntiPatternViolation[];
    /**
     * Get report for specific pattern
     */
    reportForPattern(code: string, patternId: string): AntiPatternViolation | undefined;
    /**
     * Batch validate multiple code blocks
     */
    validateBatch(codeBlocks: Record<string, string>): Record<string, ValidationResult>;
    /**
     * Get summary statistics across all patterns
     */
    getPatternStats(code: string): Record<string, number>;
    private generateRecommendations;
    private severityRank;
}
export declare function createAntiPatternValidator(): AntiPatternValidator;
//# sourceMappingURL=anti-pattern-validator.d.ts.map