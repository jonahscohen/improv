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
    componentsJson?: boolean;
}
export declare function detectTailwindContext(html: string, css: string, opts?: ValidateTasteOptions): boolean;
export declare function extractInlineStyles(html: string): Array<{
    content: string;
    start: number;
    contentStart: number;
}>;
export declare function checkHexInHoverWithCssVars(allCss: string, tailwind: boolean): TasteViolation[];
export declare function checkBorderRadiusInconsistency(allCss: string, tailwind: boolean): TasteViolation[];
export declare function validateTaste(htmlContent: string, cssContent?: string, _opts?: ValidateTasteOptions): TasteViolation[];
export declare function formatViolations(violations: TasteViolation[], filePath: string): string;
export declare function toValidationResult(violations: TasteViolation[]): ValidationResult;
//# sourceMappingURL=taste-validator.d.ts.map