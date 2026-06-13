import * as assert from 'assert';
// NOTE: deriveFlowSequence lives in src/lane-derivation.ts (inside the engine
// rootDir), NOT in scripts/generate-lanes.ts. The plan's verbatim test imported
// it from ../../scripts/generate-lanes, but a src/ test importing scripts/
// (outside rootDir ./src) breaks `tsc` with TS6059, and Step 7 wires tsc into
// the build. The generator imports the same function from this module, so the
// derivation under test is identical.
import { deriveFlowSequence, deriveVerbSteps, deriveVerbGuidance } from '../lane-derivation';

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

// --- P2: verbSteps derivation (empty-flow steps are LEGAL) ---
import { LANES } from '../lanes.generated';
{
  const build = LANES.find((l) => l.lane === 'lane_build')!;
  const vs = (build as any).verbSteps;
  if (!Array.isArray(vs)) throw new Error('verbSteps not emitted');
  if (vs.length !== build.verbChain.length) throw new Error('one verbStep per verb');
  if (vs[0].verb !== build.verbChain[0]) throw new Error('order matches verbChain');
  // every verb appears once, guidance preserved (incl. for empty-flow steps)
  for (const step of vs) {
    if (typeof step.verb !== 'string') throw new Error('verbStep.verb missing');
    if (!Array.isArray(step.guidance)) throw new Error(`guidance missing for ${step.verb}`);
    for (const f of step.flowIds) if (!build.flowSequence.includes(f)) throw new Error(`flow ${f} not in flowSequence`);
  }
  // union of NONEMPTY step flows == flowSequence exactly (no flow dropped/invented)
  const union = new Set(vs.flatMap((s: any) => s.flowIds));
  if (union.size !== build.flowSequence.length) throw new Error('nonempty verbStep flows must cover flowSequence exactly');
  // a guidance-only empty-flow step is allowed and must keep its guidance
  const polish = vs.find((s: any) => s.verb === 'polish');
  if (polish && polish.flowIds.length === 0 && polish.guidance.length === 0) throw new Error('empty-flow step must still carry guidance');
  console.log('lane-derivation verbSteps: OK');
}

// --- P2-2: deriveVerbSteps unknown-verb guard (but empty first-owner steps stay legal) ---
{
  // an UNKNOWN verb in the chain must THROW (not silently yield an empty step)
  let threw = false;
  try { deriveVerbSteps(['definitely_not_a_verb'], [], []); } catch { threw = true; }
  if (!threw) throw new Error('deriveVerbSteps must throw on an unknown verb');

  // a KNOWN verb whose flows were all claimed by an earlier verb (first-owner)
  // legitimately yields an EMPTY-flow step - this must NOT throw.
  const seq = deriveFlowSequence(['shape']);                 // [flowA_brand_verify]
  const steps = deriveVerbSteps(['shape', 'shape'], seq, deriveVerbGuidance(['shape', 'shape']));
  if (steps.length !== 2) throw new Error('one step per verb (including repeats)');
  if (steps[0].flowIds.length === 0) throw new Error('first owner of a flow keeps it');
  if (steps[1].flowIds.length !== 0) throw new Error('second (claimed) owner must be an empty-flow step, not throw');
  console.log('lane-derivation verbSteps-guard: OK');
}
