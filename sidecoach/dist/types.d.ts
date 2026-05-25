export type FlowId = 'flowA_brand_verify' | 'flowB_component_research' | 'flowC_font_research' | 'flowD_reference_inspiration' | 'flowE_motion_patterns' | 'flowF_design_tokens' | 'flowG_component_implementation' | 'flowH_motion_integration' | 'flowI_accessibility' | 'flowJ_tactical_polish' | 'flowK_multi_lens_audit' | 'flowL_design_critique' | 'flowM_responsive_validation' | 'flowN_rapid_iteration_refined' | 'flowO_clone_match_special' | 'flowP_constraint_design_special' | 'flowQ_migration_special' | 'flowR_layout_optimization' | 'flowS_typography_excellence' | 'flowT_ambitious_motion' | 'flowU_curate' | 'flowV_all_seven_qa' | 'flowW_landing_composition' | 'flowX_copywriting' | 'flow1_clone_match' | 'flow2_polish_enhance' | 'flow3_audit_page' | 'flow4_explore_discovery' | 'flow5_review_qa' | 'flow6_constraint_design' | 'flow7_design_component' | 'flow8_refactor_layout' | 'flow9_accessible' | 'flow10_implement_design' | 'flow11_extract_tokens' | 'flow12_responsive_review' | 'flow13_rapid_iteration' | 'flow14_migration';
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
    tieBreak?: {
        chosenFlowId: string;
        reason: string;
    };
}
//# sourceMappingURL=types.d.ts.map