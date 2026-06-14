import type { ProductRuleResult, CleanPolicy, ProductValidationResult, RequiredCoverageRecord, NormalizedErrorCategory } from './product-rule-types';
export interface DiscoveredApplicableFileEvidence {
    file: string;
    evidenceKindsPresent: string[];
}
export interface CoverageObservation {
    ruleId: string;
    inspectedFiles: string[];
    discoveredApplicableFiles: DiscoveredApplicableFileEvidence[];
}
export interface RunCoverage {
    inspectedFiles: string[];
    skippedFiles: string[];
    supportedSourceKinds: string[];
    unsupportedSourceKinds: string[];
    measuredScope: string[];
    unverifiedScope: string[];
    discoveredFiles: string[];
    unreadableFiles: string[];
    unsupportedFiles: string[];
}
export interface CleanEvalInput {
    validatorId: string;
    rules: ProductRuleResult[];
    coverageObservations: CoverageObservation[];
    runCoverage: RunCoverage;
    validatorError?: {
        category: NormalizedErrorCategory;
        message: string;
    };
}
export declare function isCoverageSatisfied(record: RequiredCoverageRecord | undefined, obs: CoverageObservation | undefined): boolean;
export declare function evaluateCleanPolicy(input: CleanEvalInput, policy: CleanPolicy): ProductValidationResult;
//# sourceMappingURL=clean-evaluator.d.ts.map