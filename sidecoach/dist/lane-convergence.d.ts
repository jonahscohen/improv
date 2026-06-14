import type { GateStatus, RequiredValidatorState, ConvergenceState, ConvergenceOutcome, ConvergenceIterationRecord } from './lane-types';
import type { ProductValidationResult, ProductFinding, NormalizedErrorCategory } from './product-rule-types';
export declare const DEFAULT_LOOP_MAX_ITERATIONS = 10;
export declare const DEFAULT_LOOP_MAX_NO_PROGRESS = 3;
export declare function toRequiredValidatorState(validatorId: string, result: ProductValidationResult): RequiredValidatorState;
export declare function computeRequiredStateSignature(states: RequiredValidatorState[]): string;
export interface BoundaryEvaluation {
    perValidator: RequiredValidatorState[];
    iterationStatus: GateStatus;
    converged: boolean;
    signature: string;
    findings: ProductFinding[];
    validatorErrors: {
        validatorId: string;
        category: NormalizedErrorCategory;
        message: string;
    }[];
    requiredValidatorRuns: ConvergenceIterationRecord['requiredValidatorRuns'];
    runCoverage: ConvergenceState['runCoverage'];
    measuredScope: string[];
}
export declare function evaluateBoundary(perValidator: {
    validatorId: string;
    result: ProductValidationResult;
}[]): BoundaryEvaluation;
export interface ProgressDecision {
    outcome: ConvergenceOutcome;
    consecutiveNoProgress: number;
    nextIteration: number;
}
export declare function decideProgress(prev: ConvergenceState, ev: BoundaryEvaluation): ProgressDecision;
export declare function seedConvergenceState(limits?: Partial<{
    maxIterations: number;
    maxNoProgress: number;
}>): ConvergenceState;
//# sourceMappingURL=lane-convergence.d.ts.map