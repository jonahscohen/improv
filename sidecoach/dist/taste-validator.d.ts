#!/usr/bin/env node
import type { ValidationResult } from './flow-composition';
export type TasteSeverity = 'error';
export interface TasteViolation {
    ruleId: string;
    severity: TasteSeverity;
    category: string;
    message: string;
    excerpt?: string;
    lineNumbers?: number[];
}
export interface ValidateTasteOptions {
    iconLibrary?: string;
}
export declare function validateTaste(htmlContent: string, cssContent?: string, _opts?: ValidateTasteOptions): TasteViolation[];
export declare function formatViolations(violations: TasteViolation[], filePath: string): string;
export declare function toValidationResult(violations: TasteViolation[]): ValidationResult;
//# sourceMappingURL=taste-validator.d.ts.map