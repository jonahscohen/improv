import type { ProductValidationResult, ProductRuleResult } from '../product-rule-types';
import type { CoverageObservation, RunCoverage } from '../clean-evaluator';
export interface RuleExecution {
    result: ProductRuleResult;
    discoveredApplicableFiles: Array<{
        file: string;
        evidenceKindsPresent: string[];
    }>;
    inspectedApplicableFiles: string[];
    sufficientlyCovered: boolean;
}
export interface ValidatorRunDetail {
    result: ProductValidationResult;
    executions: RuleExecution[];
    coverageObservations: CoverageObservation[];
    runCoverage: RunCoverage;
}
export declare function makeProductValidator(validatorId: string): (context: unknown, signal?: AbortSignal) => Promise<ProductValidationResult>;
export declare function runValidatorForTest(validatorId: string, context: unknown): Promise<ValidatorRunDetail>;
//# sourceMappingURL=run-validator.d.ts.map