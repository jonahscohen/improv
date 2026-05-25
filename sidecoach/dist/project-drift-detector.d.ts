export interface DriftReport {
    newColorTokens: string[];
    newRadiusTokens: string[];
    newSpacingTokens: string[];
    newEasingTokens: string[];
    newDurationTokens: string[];
    summary: string;
}
export declare function detectTokenDrift(css: string, designTokens: any): DriftReport;
//# sourceMappingURL=project-drift-detector.d.ts.map