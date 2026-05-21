export type FlowId = 'flow1_clone_match' | 'flow2_polish_enhance' | 'flow3_audit_page' | 'flow4_explore_discovery' | 'flow5_review_qa' | 'flow6_constraint_design' | 'flow7_design_component' | 'flow8_refactor_layout' | 'flow9_accessible' | 'flow10_implement_design' | 'flow11_extract_tokens' | 'flow12_responsive_review' | 'flow13_rapid_iteration' | 'flow14_migration';
export interface FlowTrigger {
    patterns: string[];
    intentMarkers: string[];
    avoidCollisionWith: FlowId[];
    negativeFilters?: string[];
}
export interface Flow {
    id: FlowId;
    name: string;
    description: string;
    triggers: FlowTrigger;
}
export interface MatchResult {
    flowId: FlowId;
    flowName: string;
    confidence: number;
    matchedTokens: string[];
    reason: string;
}
export interface DisambiguationResult {
    candidates: MatchResult[];
    isAmbiguous: boolean;
    recommendation?: MatchResult;
    clarificationNeeded?: string;
}
//# sourceMappingURL=types.d.ts.map