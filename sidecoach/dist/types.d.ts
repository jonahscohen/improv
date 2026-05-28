export type FlowId = 'flowA_brand_verify' | 'flowB_component_research' | 'flowC_font_research' | 'flowD_reference_inspiration' | 'flowE_motion_patterns' | 'flowF_design_tokens' | 'flowG_component_implementation' | 'flowH_motion_integration' | 'flowI_accessibility' | 'flowJ_tactical_polish' | 'flowK_multi_lens_audit' | 'flowL_design_critique' | 'flowM_responsive_validation' | 'flowN_rapid_iteration_refined' | 'flowO_clone_match_special' | 'flowP_constraint_design_special' | 'flowQ_migration_special' | 'flowR_layout_optimization' | 'flowS_typography_excellence' | 'flowT_ambitious_motion' | 'flowU_curate' | 'flowV_all_seven_qa' | 'flowW_landing_composition' | 'flowX_copywriting' | 'flowY_explore_discovery' | 'flowZ_design_component';
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