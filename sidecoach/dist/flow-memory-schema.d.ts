/**
 * Flow Memory Schema
 *
 * Defines what each Sidecoach flow records to FlowHistory for session memory.
 * The record becomes the source of truth for design decisions and their rationale.
 *
 * Every flow's memory captures:
 * - Which design laws were applied
 * - User decisions made at checkpoints
 * - Metrics/measurements (e.g., color contrast ratio, font scale)
 * - Validation results (pass/fail/warning)
 * - References consulted
 * - Artifacts produced
 */
export interface FlowMemoryEntry {
    flowId: string;
    flowName: string;
    timestamp: string;
    status: 'success' | 'error' | 'skipped';
    appliedRules: {
        domain: string;
        rules: string[];
        violations?: string[];
    }[];
    userDecisions: {
        decision: string;
        rationale?: string;
        alternatives?: string[];
    }[];
    metrics: {
        name: string;
        value: number | string;
        target?: number | string;
        status: 'pass' | 'warning' | 'fail';
    }[];
    validationResults: {
        check: string;
        result: 'pass' | 'fail' | 'warning';
        details?: string;
    }[];
    referencesUsed: {
        system: string;
        query?: string;
        resultCount: number;
    }[];
    gates: {
        name: string;
        required: boolean;
        passed: boolean;
        error?: string;
    }[];
    artifactProduced: {
        type: string;
        count: number;
        consumed_by?: string[];
    }[];
    aiSlopDetection?: {
        categoryReflex: boolean;
        aestheticLaneChecked: string;
        antiReferencesRespected: boolean;
        score: number;
    };
    summary: string;
    nextSteps?: string[];
}
/**
 * Helper to build memory entries from flow execution
 */
export declare class FlowMemoryBuilder {
    private entry;
    constructor(flowId: string, flowName: string);
    addRule(domain: string, rules: string[], violations?: string[]): this;
    addDecision(decision: string, rationale?: string, alternatives?: string[]): this;
    addMetric(name: string, value: number | string, status: 'pass' | 'warning' | 'fail', target?: number | string): this;
    addValidation(check: string, result: 'pass' | 'fail' | 'warning', details?: string): this;
    addReference(system: string, resultCount: number, query?: string): this;
    addGate(name: string, required: boolean, passed: boolean, error?: string): this;
    addArtifact(type: string, count: number, consumedBy?: string[]): this;
    setStatus(status: 'success' | 'error' | 'skipped'): this;
    setSummary(summary: string): this;
    setNextSteps(steps: string[]): this;
    setAiSlopDetection(categoryReflex: boolean, aestheticLane: string, antiReferencesRespected: boolean, score: number): this;
    build(): FlowMemoryEntry;
}
/**
 * Convert FlowMemoryEntry to session memory markdown format
 * Used for writing to ~/.claude/projects/.../memory/ files
 */
export declare function formatFlowMemoryAsMarkdown(entry: FlowMemoryEntry): string;
//# sourceMappingURL=flow-memory-schema.d.ts.map