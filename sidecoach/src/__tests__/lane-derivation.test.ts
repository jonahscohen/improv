import * as assert from 'assert';
// NOTE: deriveFlowSequence lives in src/lane-derivation.ts (inside the engine
// rootDir), NOT in scripts/generate-lanes.ts. The plan's verbatim test imported
// it from ../../scripts/generate-lanes, but a src/ test importing scripts/
// (outside rootDir ./src) breaks `tsc` with TS6059, and Step 7 wires tsc into
// the build. The generator imports the same function from this module, so the
// derivation under test is identical.
import { deriveFlowSequence } from '../lane-derivation';

const GOLDEN: Record<string, string[]> = {
  lane_build: ['flowA_brand_verify','flowB_component_research','flowE_motion_patterns','flowF_design_tokens','flowG_component_implementation','flowH_motion_integration','flowI_accessibility','flowM_responsive_validation','flowJ_tactical_polish'],
  lane_ship: ['flowK_multi_lens_audit','flowI_accessibility','flowL_design_critique','flowV_all_seven_qa','flowM_responsive_validation','flowJ_tactical_polish'],
  lane_delight: ['flowF_design_tokens','flowH_motion_integration','flowT_ambitious_motion','flowJ_tactical_polish','flowM_responsive_validation'],
  lane_live: ['flowN_rapid_iteration_refined','flowF_design_tokens','flowJ_tactical_polish','flowM_responsive_validation','flowL_design_critique','flowK_multi_lens_audit'],
  lane_calm: ['flowJ_tactical_polish','flowX_copywriting','flowM_responsive_validation'],
  lane_converge: ['flowJ_tactical_polish','flowM_responsive_validation','flowK_multi_lens_audit','flowI_accessibility','flowL_design_critique'],
};
const CHAINS: Record<string, string[]> = {
  lane_build: ['shape','craft','polish'],
  lane_ship: ['audit','critique','harden','adapt','polish'],
  lane_delight: ['colorize','delight','animate','polish'],
  lane_live: ['live','colorize','polish','critique'],
  lane_calm: ['quieter','distill','clarify','polish'],
  lane_converge: ['polish','audit','critique'],
};
for (const lane of Object.keys(GOLDEN)) {
  assert.deepStrictEqual(deriveFlowSequence(CHAINS[lane]), GOLDEN[lane], `derivation for ${lane}`);
}
console.log('lane-derivation: OK');
