import type { ProductValidationResult, ProductRuleResult, CleanPolicy } from '../product-rule-types';
import type { CoverageObservation, RunCoverage } from '../clean-evaluator';
import type { BrowserEvidenceCollection } from './browser-evidence-collector';
export interface ValidatorRuntimeDeps {
    collectBrowserEvidence?: (renderUrl: string | undefined, signal?: AbortSignal) => Promise<BrowserEvidenceCollection>;
}
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
    activePolicy: CleanPolicy;
}
export declare function makeProductValidator(validatorId: string): (context: unknown, signal?: AbortSignal) => Promise<ProductValidationResult>;
export declare function runValidatorForTest(validatorId: string, context: unknown, deps?: ValidatorRuntimeDeps): Promise<ValidatorRunDetail>;
//# sourceMappingURL=run-validator.d.ts.map