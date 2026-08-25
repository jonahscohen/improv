import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
/** What the token-drift lens contributes to the Theming dimension. Exported so the ACTIVE flowK
 *  handler (flow-handlers-tier3-tier4.ts, the one the orchestrator registers) can invoke the same
 *  fail-closed token-drift lens without duplicating it. */
export interface DriftOutcome {
    status: 'pass' | 'warning' | 'fail';
    issue: string;
    check: string;
}
/**
 * Token-drift lens for the Theming dimension. Invokes the sibling bin
 * `bin/sidecoach-drift.js` against the project and maps its fail-closed verdict
 * onto the "token consistency" check the audit already claims to cover.
 *
 * FULLY CONTAINED: returns `null` on ANY failure (bin missing, spawn failure,
 * timeout, non-JSON, usage/IO error) so the caller keeps the static Theming
 * placeholder and the audit NEVER crashes. A non-zero drift exit that still
 * emits JSON (drift=1, inconclusive=3) is a real verdict, not a failure.
 * FAIL-CLOSED: an "inconclusive" verdict maps to a warning, never a false pass.
 */
export declare function runTokenDriftCheck(projectPath: string | undefined): DriftOutcome | null;
export declare class FlowKMultiLensAuditHandler extends BaseFlowHandler {
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
}
export declare function createFlowKHandler(): FlowKMultiLensAuditHandler;
//# sourceMappingURL=flow-handler-multi-lens-audit.d.ts.map