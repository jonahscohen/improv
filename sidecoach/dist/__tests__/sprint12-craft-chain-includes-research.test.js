"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verb_command_registry_1 = require("../verb-command-registry");
async function run() {
    const checks = [];
    const craft = verb_command_registry_1.VERB_REGISTRY.craft;
    checks.push(['T1.1: craft entry exists', !!craft]);
    if (craft) {
        checks.push(['T1.2: craft.flowIds includes flowB_component_research', craft.flowIds.includes('flowB_component_research')]);
        checks.push(['T1.2: craft.flowIds includes flowE_motion_patterns', craft.flowIds.includes('flowE_motion_patterns')]);
        checks.push(['T1.2: craft.flowIds includes flowH_motion_integration', craft.flowIds.includes('flowH_motion_integration')]);
        checks.push(['T1.2: craft.flowIds includes flowI_accessibility', craft.flowIds.includes('flowI_accessibility')]);
        checks.push(['T1.3: craft.flowIds has 8 entries', craft.flowIds.length === 8]);
        // Order check: B before G, E before H (prereq order)
        const idx = (id) => craft.flowIds.indexOf(id);
        checks.push(['T1.4: flowB precedes flowG (prereq order)', idx('flowB_component_research') < idx('flowG_component_implementation')]);
        checks.push(['T1.4: flowE precedes flowH (prereq order)', idx('flowE_motion_patterns') < idx('flowH_motion_integration')]);
        checks.push(['T1.4: flowA precedes flowB (shape -> research)', idx('flowA_brand_verify') < idx('flowB_component_research')]);
        checks.push(['T1.5: parityChecklist mentions component research', craft.parityChecklist.some((s) => /component research/i.test(s))]);
        checks.push(['T1.5: parityChecklist mentions motion patterns researched', craft.parityChecklist.some((s) => /motion patterns researched/i.test(s))]);
        checks.push(['T1.6: guidanceAppend mentions component patterns researched', craft.guidanceAppend.some((s) => /component patterns researched/i.test(s))]);
        checks.push(['T1.6: guidanceAppend mentions motion patterns researched', craft.guidanceAppend.some((s) => /motion patterns researched/i.test(s))]);
    }
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint12-craft-chain-includes-research PASS' : 'sprint12-craft-chain-includes-research FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint12-craft-chain-includes-research.test.js.map