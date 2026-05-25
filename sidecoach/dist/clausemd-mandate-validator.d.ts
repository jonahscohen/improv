import { FlowExecutionResult, FlowExecutionContext } from './flow-handler';
import type { ValidationResult } from './flow-composition';
export interface MandateViolation {
    rule: string;
    severity: 'critical' | 'warning' | 'info';
    location?: string;
    content?: string;
    suggestion?: string;
}
export interface MandateValidationResult {
    passed: boolean;
    violations: MandateViolation[];
    blockers: MandateViolation[];
}
export declare class ClaudemdMandateValidator {
    private static EMOJI_PATTERN;
    private static LONG_DASH_PATTERN;
    private static SELF_CREDIT_PATTERNS;
    private static HARDCODED_COLOR_PATTERN;
    private static ICON_LIBRARY_PATHS;
    static validateOutput(result: FlowExecutionResult, context?: FlowExecutionContext): MandateValidationResult;
    private static checkForEmojis;
    private static checkForLongDashes;
    private static checkForSelfCredit;
    private static checkForHardcodedColors;
    private static checkForFabricatedIcons;
    static toValidationResult(report: MandateValidationResult): ValidationResult;
    static reportViolations(validation: MandateValidationResult): string;
}
//# sourceMappingURL=clausemd-mandate-validator.d.ts.map