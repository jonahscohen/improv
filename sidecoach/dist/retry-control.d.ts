import { FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowId } from './types';
export interface RetryConfig {
    maxCycles: number;
    identicalErrorThreshold: number;
}
export interface RetryState {
    cycleCount: number;
    errorSignatures: string[];
}
export interface ErrorSignatureInput {
    validator: string;
    failedRules: string[];
    filePath: string;
}
export type HaltReason = 'max_cycles' | 'identical_error_loop';
export interface HaltDecision {
    halt: boolean;
    reason?: HaltReason;
    message?: string;
    cycleCount: number;
    signature?: string;
    attemptCount?: number;
    lastErrorSignature?: string;
}
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
/**
 * Read retry config from context.metadata.retryConfig, applying defaults for
 * any missing field. Callers can override either field independently.
 */
export declare function readRetryConfig(context: FlowExecutionContext): RetryConfig;
/**
 * Read retry state from context.metadata.retryState, returning a fresh-zero
 * state if not present. Fresh state means cycleCount=0 and no signatures
 * recorded - the next iteration is iteration 1.
 */
export declare function readRetryState(context: FlowExecutionContext): RetryState;
/**
 * Compute a deterministic 12-char hex signature from a validator name, the
 * sorted list of failed rule IDs, and the file path being validated. Two
 * iterations producing the same set of failed rules in the same validator
 * against the same file collide on this signature - which is exactly the
 * "still broken in the same way" signal the identical-error halt watches for.
 */
export declare function computeErrorSignature(input: ErrorSignatureInput): string;
/**
 * Evaluate halt conditions against current retry state. Called BEFORE running
 * the next iteration. Returns {halt: false} when iteration can proceed,
 * {halt: true, ...} when a cap is hit.
 *
 * Order matters: max_cycles is checked first so a maxed-out loop that also
 * happens to have identical errors halts as "max_cycles" (the broader cause)
 * rather than the narrower identical-error reason.
 */
export declare function evaluateHaltConditions(state: RetryState, config: RetryConfig): HaltDecision;
/**
 * Append a new iteration to retry state. Returns a new state object - does
 * not mutate the input.
 */
export declare function recordIteration(state: RetryState, signature: string): RetryState;
/**
 * Build a halt result with the right shape for a flow handler return. The
 * caller passes the handler's flowId and flowName for the result envelope and
 * an optional log-prefix used in the emitted console.log line.
 */
export declare function buildHaltResult(flowId: FlowId, flowName: string, decision: HaltDecision, validatorName: string, logPrefix?: string): FlowExecutionResult;
/**
 * Attach retry tracking to a successful (or partial-success) result so the
 * next invocation of the same handler can see updated state.
 */
export declare function attachRetryStateToResult(result: FlowExecutionResult, nextState: RetryState, config: RetryConfig): FlowExecutionResult;
//# sourceMappingURL=retry-control.d.ts.map