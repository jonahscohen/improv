"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flow_composition_1 = require("../flow-composition");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(() => {
    const def = flow_composition_1.FlowCompositionEngine.buildCraftLandingPageFlow();
    assertTrue(def.id === 'composite_craft_landing_page', 'composite id matches');
    assertTrue(def.steps.length >= 7, 'has at least 7 steps');
    const stepIds = def.steps.map((s) => s.flowId);
    // Required ordering: composition before copywriting; tokens between them; component/motion/polish/audit/taste after.
    const wIdx = stepIds.indexOf('flowW_landing_composition');
    const fIdx = stepIds.indexOf('flowF_design_tokens');
    const xIdx = stepIds.indexOf('flowX_copywriting');
    const gIdx = stepIds.indexOf('flowG_component_implementation');
    const hIdx = stepIds.indexOf('flowH_motion_integration');
    const jIdx = stepIds.indexOf('flowJ_tactical_polish');
    const kIdx = stepIds.indexOf('flowK_multi_lens_audit');
    assertTrue(wIdx >= 0 && fIdx > wIdx && xIdx > fIdx, 'composition -> tokens -> copywriting ordering');
    assertTrue(gIdx > xIdx, 'component implementation after copywriting');
    assertTrue(hIdx > gIdx, 'motion after component');
    assertTrue(jIdx > hIdx, 'polish after motion');
    assertTrue(kIdx > jIdx, 'audit after polish');
    // Preset registration
    const presetIds = flow_composition_1.PRESET_COMPOSITE_FLOWS.map((p) => p.id);
    assertTrue(presetIds.includes('composite_craft_landing_page'), 'craft landing page registered as preset');
    console.log('flow-composition-craft-landing PASS');
})();
//# sourceMappingURL=flow-composition-craft-landing.test.js.map