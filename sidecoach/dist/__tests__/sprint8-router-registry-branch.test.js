"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const slash_command_router_1 = require("../slash-command-router");
async function run() {
    const checks = [];
    // T2.1: each prototype verb routes via the registry branch
    for (const verb of ['craft', 'polish', 'audit', 'critique', 'document']) {
        const m = (0, slash_command_router_1.parseSlashCommand)(`/sidecoach ${verb}`);
        checks.push([`T2.1: ${verb} isCommand`, m.isCommand === true]);
        checks.push([`T2.1: ${verb} command field`, m.command === verb]);
        checks.push([`T2.1: ${verb} reason mentions verb-parity`, typeof m.reason === 'string' && m.reason.includes('verb-parity')]);
    }
    // T2.2: existing phase commands still work (regression)
    const research = (0, slash_command_router_1.parseSlashCommand)('/sidecoach research');
    checks.push(['T2.2: phase command research still routes', research.isCommand === true && research.command === 'research']);
    const list = (0, slash_command_router_1.parseSlashCommand)('/sidecoach list');
    checks.push(['T2.2: list still routes', list.isCommand === true && list.command === 'list']);
    const composite = (0, slash_command_router_1.parseSlashCommand)('/sidecoach composite:composite_qa_workflow');
    checks.push(['T2.2: composite still routes', composite.isCommand === true && composite.command === 'composite' && composite.target === 'composite_qa_workflow']);
    // T2.3: unknown verb still falls through
    const unknown = (0, slash_command_router_1.parseSlashCommand)('/sidecoach zzzz_nonexistent');
    checks.push(['T2.3: unknown command returns isCommand=false', unknown.isCommand === false]);
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint8-router-registry-branch PASS' : 'sprint8-router-registry-branch FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint8-router-registry-branch.test.js.map