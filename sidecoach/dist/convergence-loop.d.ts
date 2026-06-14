import { FlowId } from './types';
import { FlowExecutionContext, FlowExecutionResult } from './flow-handler';
/**
 * Default flow chain for convergence-mode. Mirrors the T-0020 spec from TASKS.md:
 * tactical-polish -> multi-lens-audit -> design-critique. Each iteration walks
 * this chain in order.
 */
export declare const DEFAULT_CONVERGENCE_FLOW_CHAIN: FlowId[];
export declare const DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS = 10;
export declare const DEFAULT_CONVERGENCE_MAX_NO_PROGRESS_ITERATIONS = 3;
/** Status of a completed convergence loop. */
export type ConvergenceStatus = 'converged' | 'stalled' | 'capped' | 'error';
/**
 * A single finding produced by a flow during one convergence iteration. The shape
 * is intentionally narrow - a finding only needs a stable identity (flowId +
 * validator + ruleId + filePath when relevant) so its presence in successive
 * iterations can be detected via the progress signature. The optional fields
 * carry forward to the caller for surfacing in logs/reports.
 */
export interface ConvergenceFinding {
    flowId: FlowId;
    validator: string;
    ruleId: string;
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'error';
    message?: string;
    filePath?: string;
}
/**
 * Snapshot of one (iteration, flow) pair within the loop. Stored on the
 * ConvergenceResult so callers can inspect the trajectory after the fact.
 */
export interface ConvergenceIterationFlow {
    iteration: number;
    flowId: FlowId;
    findings: ConvergenceFinding[];
    /** Total finding count for this flow on this iteration (cached for log readability). */
    findingCount: number;
    /** When the underlying flow handler errored out, this is the message. */
    error?: string;
}
/**
 * Snapshot of a full iteration across the flow chain. Each iteration record
 * holds one entry per flow in flowChain.
 */
export interface ConvergenceIteration {
    iteration: number;
    flowResults: ConvergenceIterationFlow[];
    /** Aggregate findings across every flow in this iteration. */
    allFindings: ConvergenceFinding[];
    /** sha256-12 hash over the sorted finding identities (see computeProgressSignature). */
    signature: string;
}
export interface ConvergenceResult {
    status: ConvergenceStatus;
    iterations: number;
    /** Total findings remaining at the moment the loop exited. */
    totalFindings: number;
    /** Iteration-by-iteration trace. */
    history: ConvergenceIteration[];
    /** Findings still outstanding when status === 'capped' or 'stalled'. */
    remainingFindings?: ConvergenceFinding[];
    /** Signature that repeated and triggered the stall (status === 'stalled'). */
    lastSignature?: string;
    /** Log lines emitted during the loop. Captured for tests/post-hoc reporting. */
    log: string[];
    /** Top-level error message when status === 'error' (e.g. invalid config). */
    error?: string;
}
export interface ConvergenceOptions {
    maxGlobalIterations?: number;
    maxNoProgressIterations?: number;
    flowChain?: FlowId[];
    /**
     * Injection point: invoked once per (iteration, flow). Implementations run
     * the underlying flow handler against the target and return the findings
     * the validators surfaced. Tests use a mock; production callers wire a
     * real handler-runner here.
     *
     * If omitted, the loop short-circuits with an error - the loop has no
     * default way to invoke flows without a runner, by design (handlers carry
     * non-trivial setup that the loop itself should not hard-code).
     */
    runFlow?: ConvergenceFlowRunner;
    /**
     * Forward-compat: invoked after findings are collected for an iteration
     * and before the next iteration starts. If unset, findings accumulate
     * unchanged - which is the documented "no fix-mode today" behavior.
     * Wire this once handlers grow a fix-mode (or an LLM-driven fix step
     * fits between iterations).
     */
    applyFixes?: ConvergenceFixApplier;
    /** Log sink. Defaults to console.log. Set to a no-op to silence the loop. */
    logger?: (line: string) => void;
}
export type ConvergenceFlowRunner = (input: {
    flowId: FlowId;
    target: string;
    iteration: number;
}) => Promise<ConvergenceFlowRunOutput>;
export interface ConvergenceFlowRunOutput {
    findings: ConvergenceFinding[];
    /** Optional raw result for callers that want the full FlowExecutionResult shape. */
    rawResult?: FlowExecutionResult;
    /** Optional handler-level error. The loop records the error and continues with zero findings for this flow. */
    error?: string;
}
export type ConvergenceFixApplier = (input: {
    iteration: number;
    findings: ConvergenceFinding[];
    target: string;
}) => Promise<void>;
/**
 * Compute a deterministic 12-char hex signature from the set of findings
 * collected during one iteration. Two iterations producing the same findings
 * in any order yield the same signature - which is the "no progress" signal
 * the stall check watches for. Findings are serialized by their stable
 * identity (flowId + validator + ruleId + filePath) so ephemeral fields like
 * message do not destabilize the signature.
 */
export declare function computeProgressSignature(findings: ConvergenceFinding[]): string;
/**
 * Helper to extract findings from a FlowExecutionResult. Provided for
 * convenience to runners that invoke the real handlers - they can map the
 * handler's validationResults / executionMetadata into ConvergenceFinding[] using
 * this routine. Not used inside runConvergenceLoop itself (the runner is the only
 * thing that knows how its handlers shaped their results).
 */
export declare function extractFindingsFromFlowResult(flowId: FlowId, result: FlowExecutionResult): ConvergenceFinding[];
/**
 * Run a relentless cross-flow loop against `target`. See module header for
 * the contract and the auto-fix gap discussion.
 */
export declare function runConvergenceLoop(target: string, opts?: ConvergenceOptions): Promise<ConvergenceResult>;
/**
 * Re-export of the FlowExecutionContext shape for callers that want to
 * build their own runFlow injection. Not used by the loop itself.
 */
export type { FlowExecutionContext };
//# sourceMappingURL=convergence-loop.d.ts.map