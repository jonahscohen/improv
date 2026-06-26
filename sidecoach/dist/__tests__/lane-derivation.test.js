"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
// NOTE: deriveFlowSequence lives in src/lane-derivation.ts (inside the engine
// rootDir), NOT in scripts/generate-lanes.ts. The plan's verbatim test imported
// it from ../../scripts/generate-lanes, but a src/ test importing scripts/
// (outside rootDir ./src) breaks `tsc` with TS6059, and Step 7 wires tsc into
// the build. The generator imports the same function from this module, so the
// derivation under test is identical.
const lane_derivation_1 = require("../lane-derivation");
const GOLDEN = {
    lane_build: ['flowA_brand_verify', 'flowB_component_research', 'flowC_font_research', 'flowD_reference_inspiration', 'flowE_motion_patterns', 'flowF_design_tokens', 'flowG_component_implementation', 'flowH_motion_integration', 'flowI_accessibility', 'flowM_responsive_validation', 'flowJ_tactical_polish'],
    lane_ship: ['flowK_multi_lens_audit', 'flowI_accessibility', 'flowL_design_critique', 'flowV_all_seven_qa', 'flowM_responsive_validation', 'flowJ_tactical_polish'],
    lane_delight: ['flowD_reference_inspiration', 'flowF_design_tokens', 'flowH_motion_integration', 'flowT_ambitious_motion', 'flowJ_tactical_polish', 'flowM_responsive_validation'],
    lane_live: ['flowN_rapid_iteration_refined', 'flowD_reference_inspiration', 'flowF_design_tokens', 'flowJ_tactical_polish', 'flowM_responsive_validation', 'flowL_design_critique', 'flowK_multi_lens_audit'],
    lane_calm: ['flowJ_tactical_polish', 'flowX_copywriting', 'flowM_responsive_validation'],
    lane_converge: ['flowJ_tactical_polish', 'flowM_responsive_validation', 'flowK_multi_lens_audit', 'flowI_accessibility', 'flowL_design_critique'],
};
const CHAINS = {
    lane_build: ['shape', 'craft', 'polish'],
    lane_ship: ['audit', 'critique', 'harden', 'adapt', 'polish'],
    lane_delight: ['colorize', 'delight', 'animate', 'polish'],
    lane_live: ['live', 'colorize', 'polish', 'critique'],
    lane_calm: ['quieter', 'distill', 'clarify', 'polish'],
    lane_converge: ['polish', 'audit', 'critique'],
};
for (const lane of Object.keys(GOLDEN)) {
    assert.deepStrictEqual((0, lane_derivation_1.deriveFlowSequence)(CHAINS[lane]), GOLDEN[lane], `derivation for ${lane}`);
}
console.log('lane-derivation: OK');
// --- P2: verbSteps derivation (empty-flow steps are LEGAL) ---
const lanes_generated_1 = require("../lanes.generated");
{
    const build = lanes_generated_1.LANES.find((l) => l.lane === 'lane_build');
    const vs = build.verbSteps;
    if (!Array.isArray(vs))
        throw new Error('verbSteps not emitted');
    if (vs.length !== build.verbChain.length)
        throw new Error('one verbStep per verb');
    if (vs[0].verb !== build.verbChain[0])
        throw new Error('order matches verbChain');
    // every verb appears once, guidance preserved (incl. for empty-flow steps)
    for (const step of vs) {
        if (typeof step.verb !== 'string')
            throw new Error('verbStep.verb missing');
        if (!Array.isArray(step.guidance))
            throw new Error(`guidance missing for ${step.verb}`);
        for (const f of step.flowIds)
            if (!build.flowSequence.includes(f))
                throw new Error(`flow ${f} not in flowSequence`);
    }
    // union of NONEMPTY step flows == flowSequence exactly (no flow dropped/invented)
    const union = new Set(vs.flatMap((s) => s.flowIds));
    if (union.size !== build.flowSequence.length)
        throw new Error('nonempty verbStep flows must cover flowSequence exactly');
    // a guidance-only empty-flow step is allowed and must keep its guidance
    const polish = vs.find((s) => s.verb === 'polish');
    if (polish && polish.flowIds.length === 0 && polish.guidance.length === 0)
        throw new Error('empty-flow step must still carry guidance');
    console.log('lane-derivation verbSteps: OK');
}
// --- P2-2: deriveVerbSteps unknown-verb guard (but empty first-owner steps stay legal) ---
{
    // an UNKNOWN verb in the chain must THROW (not silently yield an empty step)
    let threw = false;
    try {
        (0, lane_derivation_1.deriveVerbSteps)(['definitely_not_a_verb'], [], []);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error('deriveVerbSteps must throw on an unknown verb');
    // a KNOWN verb whose flows were all claimed by an earlier verb (first-owner)
    // legitimately yields an EMPTY-flow step - this must NOT throw.
    const seq = (0, lane_derivation_1.deriveFlowSequence)(['shape']); // [flowA_brand_verify]
    const steps = (0, lane_derivation_1.deriveVerbSteps)(['shape', 'shape'], seq, (0, lane_derivation_1.deriveVerbGuidance)(['shape', 'shape']));
    if (steps.length !== 2)
        throw new Error('one step per verb (including repeats)');
    if (steps[0].flowIds.length === 0)
        throw new Error('first owner of a flow keeps it');
    if (steps[1].flowIds.length !== 0)
        throw new Error('second (claimed) owner must be an empty-flow step, not throw');
    console.log('lane-derivation verbSteps-guard: OK');
}
//# sourceMappingURL=lane-derivation.test.js.map