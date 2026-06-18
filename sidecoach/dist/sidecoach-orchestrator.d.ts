import { FlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { FlowId } from './types';
import type { LaneTransition, LaneStepResult } from './lane-types';
import { BuildReport } from './build-report-types';
export declare class FlowExecutionEngine {
    private intentDetector;
    private handlers;
    private orchestrator;
    private compositionEngine;
    private contextManager;
    private checkpointStore;
    private gcRan;
    constructor();
    private initializeValidators;
    private initializeHandlers;
    private recordFlowWithMemory;
    /**
     * Run the composite-flow execution loop. Extracted from `process()` so both the
     * new-run path and the (forthcoming T5) resume path can share it.
     * Pure refactor in T3 - no new behavior, no checkpoint writes (those come in T4).
     */
    private runCompositeLoop;
    /**
     * Resume a composite run from a saved checkpoint. Seeds runCompositeLoop with
     * the checkpoint's executionContext + flowResults + cursor + utterance. The
     * loop mints a fresh runStartIso, so the resumed run writes to a NEW
     * checkpoint file. The caller (process() resume branch) deletes the original
     * pre-resume checkpoint after this method returns. (Sprint 6 T5.)
     */
    private runCompositeFromCheckpoint;
    private runTasteValidationGate;
    private cachedProjectCtx;
    private enrichContextForHandler;
    private validateFlowExecution;
    private cacheFlowResult;
    private trackFlowMetrics;
    private determineConditionalFlow;
    private getExecutablePath;
    private processWithEntryPoint;
    process(utterance: string, context?: Partial<FlowExecutionContext>): Promise<SidecoachResult>;
    /**
     * Sprint 8 T7: Build the verb-command guidance-append block.
     * Returns the array of strings to append to result.guidance for verbs that
     * have a registry entry (the 22 verb commands). The returned
     * array includes the parityChecklist and parityPlus tokens verbatim so the
     * sprint8 parity test sees them in the flattened output.
     */
    private buildVerbGuidanceAppend;
    private showInteractiveMenu;
    registerHandler(handler: FlowHandler): void;
    /**
     * Read-only view of the registered handler map. Used by CLI tools that need to
     * enumerate or dispatch by FlowId. Caller must not mutate.
     */
    getHandlers(): ReadonlyMap<FlowId, FlowHandler>;
    private laneDeps;
    startLane(laneId: string, target: string, context: {
        projectPath?: string;
    } & Record<string, any>, startRequestId: string, renderUrl?: string): Promise<LaneStepResult>;
    advanceLane(projectPath: string, checkpointId: string, transition: LaneTransition): Promise<LaneStepResult>;
    laneStatus(projectPath: string, checkpointId: string): import("./lane-types").LaneState;
    listLanes(projectPath: string, options?: {
        all?: boolean;
    }): import("./lane-types").LaneInfo[];
    /**
     * Union of all known flow ids - single handlers + composite preset ids.
     * Used by the metadata.forceFlowId bypass to validate caller-supplied flow ids
     * before routing past intent detection.
     */
    private getAllKnownFlowIds;
    getAvailableFlows(): FlowInfo[];
}
export interface FlowInfo {
    flowId: FlowId;
    name: string;
    description: string;
}
export interface SidecoachResult {
    success: boolean;
    message: string;
    detectedFlow: {
        flowId: FlowId;
        flowName: string;
        confidence: number;
    } | null;
    flowResults: FlowExecutionResult[];
    guidance?: string[];
    checklist?: any[];
    artifacts?: any[];
    ambiguousCandidates?: Array<{
        flowId: FlowId;
        flowName: string;
        confidence: number;
    }>;
    buildReport?: BuildReport;
    panel?: string;
    needsDisambiguation?: boolean;
    disambiguationPrompt?: string;
    lane?: LaneStepResult;
    classify?: {
        laneId: string;
        label: string;
        interviewLabel: string;
    };
}
export declare function createExecutionEngine(): FlowExecutionEngine;
//# sourceMappingURL=sidecoach-orchestrator.d.ts.map