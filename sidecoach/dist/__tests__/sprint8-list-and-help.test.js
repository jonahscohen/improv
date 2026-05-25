"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
async function run() {
    const checks = [];
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // T8.1: /sidecoach list includes both phase and verb commands
    const listResult = await engine.process('/sidecoach list', { projectPath: '/tmp', projectContext: { register: 'brand' } });
    const listOutput = (listResult.guidance || []).join('\n');
    checks.push(['T8.1: list mentions phase commands heading', /phase/i.test(listOutput)]);
    checks.push(['T8.1: list mentions verb commands heading', /verb commands/i.test(listOutput)]);
    for (const verb of ['craft', 'polish', 'audit', 'critique', 'document']) {
        checks.push([`T8.1: list contains verb '${verb}'`, listOutput.includes(verb)]);
    }
    for (const phase of ['research', 'review']) {
        checks.push([`T8.1: list contains phase '${phase}'`, listOutput.includes(phase)]);
    }
    // T8.2: /sidecoach help polish returns details for polish
    const helpResult = await engine.process('/sidecoach help polish', { projectPath: '/tmp', projectContext: { register: 'brand' } });
    const helpOutput = (helpResult.guidance || []).join('\n') + (helpResult.message || '');
    checks.push(['T8.2: help polish mentions polish', /polish/i.test(helpOutput)]);
    checks.push(['T8.2: help polish mentions parity', /parity/i.test(helpOutput)]);
    checks.push(['T8.2: help polish mentions flow chain', /flow/i.test(helpOutput)]);
    // T8.3: /sidecoach help unknown_verb returns failure
    const helpUnknown = await engine.process('/sidecoach help nonexistent_verb', { projectPath: '/tmp', projectContext: { register: 'brand' } });
    checks.push(['T8.3: help on unknown verb returns failure', helpUnknown.success === false || /unknown|not found/i.test(helpUnknown.message || '')]);
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint8-list-and-help PASS' : 'sprint8-list-and-help FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint8-list-and-help.test.js.map