export type FlowId =
  // Tier 1: Strategy/Research
  | 'flowA_brand_verify'
  | 'flowB_component_research'
  | 'flowC_font_research'
  | 'flowD_reference_inspiration'
  | 'flowE_motion_patterns'
  // Tier 2: Execution
  | 'flowF_design_tokens'
  | 'flowG_component_implementation'
  | 'flowH_motion_integration'
  | 'flowI_accessibility'
  // Tier 3: Polish/QA
  | 'flowJ_tactical_polish'
  | 'flowK_multi_lens_audit'
  | 'flowL_design_critique'
  | 'flowM_responsive_validation'
  | 'flowN_rapid_iteration_refined'
  // Tier 4: Special
  | 'flowO_clone_match_special'
  | 'flowP_constraint_design_special'
  | 'flowQ_migration_special'
  // Tier 5: Specialized Refinement (NEW - v2.1.9)
  | 'flowR_layout_optimization'
  | 'flowS_typography_excellence'
  | 'flowT_ambitious_motion'
  // Special: Curate & All-Seven QA
  | 'flowU_curate'
  | 'flowV_all_seven_qa'
  // Tier 6: Composition & Copy
  | 'flowW_landing_composition'
  | 'flowX_copywriting'
  // Tier 7: Renamed legacy (T-0015) - unique flows preserved with letter prefix
  | 'flowY_explore_discovery'
  | 'flowZ_design_component';

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
  tieBreak?: { chosenFlowId: string; reason: string };
}
