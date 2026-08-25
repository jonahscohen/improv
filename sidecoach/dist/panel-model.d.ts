import { FlowExecutionResult } from './flow-handler';
import { BuildReport, LetterGrade } from './build-report-types';
export interface PanelGate {
    name: string;
    ok: boolean | null;
}
export interface PanelChecklistItem {
    label: string;
    done: boolean;
}
export type PanelCoverage = 'verified-clean' | 'checked' | 'partially-checked' | 'not-fully-checked';
export declare function coverageForVerdict(verdict?: 'clean' | 'warnings-only' | 'blocked'): PanelCoverage | undefined;
export interface SidecoachPanelModel {
    verb?: string;
    flowName: string;
    flowId: string;
    confidence?: number;
    chain: string[];
    checklist: PanelChecklistItem[];
    dims?: string[];
    gates: PanelGate[];
    verdict?: 'clean' | 'warnings-only' | 'blocked';
    grade?: LetterGrade;
    findings?: number;
    partial: boolean;
    notice?: string;
    coverage?: PanelCoverage;
}
export declare function shortFlowLabel(flowName: string, flowId: string): string;
export interface AssemblePanelInput {
    flowResults: FlowExecutionResult[];
    report?: BuildReport;
    verb?: string;
    confidence?: number;
    dims?: string[];
    /** Headline flow id; defaults to the last flow in the chain (usually the audit/critique). */
    headlineFlowId?: string;
    /** Force the partial flag; defaults to "no report yet". */
    partial?: boolean;
    /**
     * The underlying rendered audit could not scan every lens (a detection lens did not run), so its
     * coverage is INCOMPLETE even though it produced a verdict. Codex 2026-08-25 (Med): the panel is
     * built from the BuildReport alone and cannot see audit.unavailableReasons, so a partial audit was
     * rendering an unqualified CHECKED. When set, the panel downgrades to 'partially-checked'. The
     * orchestrator passes `audit.unavailableReasons.length > 0` here for a rendered audit.
     */
    auditPartial?: boolean;
    /** Whether the QA gates have executed; when false (and no report), gates render as pending. */
    ranGates?: boolean;
    /** Loud line printed above the card when this run measured nothing (see model.notice). */
    notice?: string;
}
export declare function assemblePanelModel(input: AssemblePanelInput): SidecoachPanelModel;
export interface LaneStepLike {
    currentVerb?: string;
    flowIds: Array<string | {
        toString(): string;
    }>;
    checklist: {
        id: string;
        label: string;
        completed: boolean;
    }[];
    gate?: {
        status?: string;
        validators?: {
            validatorId: string;
            status: string;
        }[];
        findings?: unknown[];
    } | null;
    convergence?: {
        findings?: unknown[];
    } | null;
}
export declare function laneStepToPanelModel(step: LaneStepLike): SidecoachPanelModel;
//# sourceMappingURL=panel-model.d.ts.map