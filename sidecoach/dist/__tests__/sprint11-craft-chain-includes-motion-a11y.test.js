"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verb_command_registry_1 = require("../verb-command-registry");
async function run() {
    const checks = [];
    const craft = verb_command_registry_1.VERB_REGISTRY.craft;
    checks.push(['T2.1: craft entry exists', !!craft]);
    if (craft) {
        checks.push(['T2.2: craft.flowIds includes flowH_motion_integration', craft.flowIds.includes('flowH_motion_integration')]);
        checks.push(['T2.2: craft.flowIds includes flowI_accessibility', craft.flowIds.includes('flowI_accessibility')]);
        checks.push(['T2.3: craft.flowIds has >= 6 entries (Sprint 11 lower bound; Sprint 12 grew it to 8)', craft.flowIds.length >= 6]);
        checks.push(['T2.4: parityChecklist mentions motion', craft.parityChecklist.some((s) => /motion/i.test(s))]);
        checks.push(['T2.4: parityChecklist mentions accessibility', craft.parityChecklist.some((s) => /accessibility/i.test(s))]);
        checks.push(['T2.5: guidanceAppend mentions motion integration', craft.guidanceAppend.some((s) => /motion/i.test(s))]);
        checks.push(['T2.5: guidanceAppend mentions accessibility', craft.guidanceAppend.some((s) => /accessibility/i.test(s))]);
    }
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint11-craft-chain-includes-motion-a11y PASS' : 'sprint11-craft-chain-includes-motion-a11y FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint11-craft-chain-includes-motion-a11y.test.js.map