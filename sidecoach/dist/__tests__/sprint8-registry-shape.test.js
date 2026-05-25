"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verb_command_registry_1 = require("../verb-command-registry");
async function run() {
    const checks = [];
    const verbs = (0, verb_command_registry_1.getVerbList)();
    const expected = ['craft', 'polish', 'audit', 'critique', 'document'];
    for (const v of expected) {
        checks.push([`T1.1: registry contains '${v}'`, verbs.includes(v)]);
    }
    for (const v of expected) {
        const entry = (0, verb_command_registry_1.getVerbEntry)(v);
        checks.push([`T1.2: ${v} has command field`, !!entry && entry.command === v]);
        checks.push([`T1.2: ${v} has skillRefPath`, !!entry && typeof entry.skillRefPath === 'string' && entry.skillRefPath.includes('legacy-design-skill')]);
        checks.push([`T1.2: ${v} has phase`, !!entry && ['shape', 'craft', 'review', 'tone', 'docs', 'tactical'].includes(entry.phase)]);
        checks.push([`T1.2: ${v} has non-empty flowIds OR document special-case (empty allowed for document only)`, !!entry && (entry.flowIds.length > 0 || entry.command === 'document')]);
        checks.push([`T1.2: ${v} has non-empty parityChecklist`, !!entry && Array.isArray(entry.parityChecklist) && entry.parityChecklist.length > 0]);
        checks.push([`T1.2: ${v} has non-empty parityPlus`, !!entry && Array.isArray(entry.parityPlus) && entry.parityPlus.length > 0]);
    }
    checks.push(['T1.3: unknown verb returns undefined', (0, verb_command_registry_1.getVerbEntry)('does_not_exist') === undefined]);
    // T5: assert all 22 verbs are present (17 new + 5 prototype)
    const all22 = ['craft', 'shape', 'onboard', 'animate', 'bolder', 'colorize', 'delight', 'layout', 'overdrive', 'quieter', 'typeset', 'clarify', 'audit', 'critique', 'polish', 'harden', 'adapt', 'distill', 'optimize', 'document', 'extract', 'live'];
    checks.push([`T5: registry has all 22 verbs`, all22.every(v => verbs.includes(v)) && verbs.length === 22]);
    // T5: assert shape for each new verb
    const newVerbs = ['shape', 'onboard', 'animate', 'bolder', 'colorize', 'delight', 'layout', 'overdrive', 'quieter', 'typeset', 'clarify', 'harden', 'adapt', 'distill', 'optimize', 'extract', 'live'];
    for (const v of newVerbs) {
        const entry = (0, verb_command_registry_1.getVerbEntry)(v);
        checks.push([`T5: ${v} has skillRefPath`, !!entry && typeof entry.skillRefPath === 'string' && entry.skillRefPath.endsWith(`${v}.md`)]);
        checks.push([`T5: ${v} has phase`, !!entry && ['shape', 'craft', 'review', 'tone', 'docs', 'tactical'].includes(entry.phase)]);
        checks.push([`T5: ${v} has parityChecklist length >= 3`, !!entry && entry.parityChecklist.length >= 3]);
        checks.push([`T5: ${v} has parityPlus length >= 1`, !!entry && entry.parityPlus.length >= 1]);
    }
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint8-registry-shape PASS' : 'sprint8-registry-shape FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint8-registry-shape.test.js.map