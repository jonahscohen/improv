"use strict";
/**
 * qa-gate.test.ts - the orchestrated QA gate resolver.
 *
 * Guards the property the on-edit auto-invoke hook depends on: the
 * audit -> critique -> polish sequence resolves, in order, to the SAME flow
 * chains the verb registry defines, through the shared router - and fails LOUD
 * if any stage becomes unroutable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const qa_gate_1 = require("../qa-gate");
const verb_command_registry_1 = require("../verb-command-registry");
let failures = 0;
function check(name, cond) {
    if (cond) {
        console.log(`PASS ${name}`);
    }
    else {
        console.log(`FAIL ${name}`);
        failures++;
    }
}
// --- shape + order -------------------------------------------------------
const plan = (0, qa_gate_1.resolveQaGate)('index.html');
check('gate has exactly three stages', plan.steps.length === 3);
check('stage order is audit -> critique -> polish', plan.steps.map((s) => s.verb).join(',') === 'audit,critique,polish');
check('order fields are 1,2,3', plan.steps.map((s) => s.order).join(',') === '1,2,3');
check('QA_GATE_VERBS is the same ordered sequence', qa_gate_1.QA_GATE_VERBS.join(',') === 'audit,critique,polish');
// --- each stage grounded in the verb registry ---------------------------
for (const step of plan.steps) {
    const entry = (0, verb_command_registry_1.getVerbEntry)(step.verb);
    check(`${step.verb}: verb exists in registry`, Boolean(entry));
    check(`${step.verb}: flow chain is non-empty`, step.flowIds.length > 0);
    check(`${step.verb}: flow chain matches the registry chain`, Boolean(entry) && step.flowIds.join(',') === entry.flowIds.join(','));
    check(`${step.verb}: description matches the registry`, Boolean(entry) && step.description === entry.description);
}
// --- the three stages route to their canonical flows --------------------
const byVerb = Object.fromEntries(plan.steps.map((s) => [s.verb, s]));
check('audit stage runs the multi-lens audit flow', byVerb.audit.flowIds.includes('flowK_multi_lens_audit'));
check('critique stage runs the design-critique flow', byVerb.critique.flowIds.includes('flowL_design_critique'));
check('polish stage runs the tactical-polish flow', byVerb.polish.flowIds.includes('flowJ_tactical_polish'));
// --- slash command formatting -------------------------------------------
check('slash command carries the target', byVerb.audit.slashCommand === '/sidecoach audit index.html');
const noTarget = (0, qa_gate_1.resolveQaGate)();
check('empty target yields null target', noTarget.target === null);
check('slash command omits target when none given', noTarget.steps[0].slashCommand === '/sidecoach audit');
check('whitespace-only target is treated as no target', (0, qa_gate_1.resolveQaGate)('   ').target === null);
// --- JSON surface --------------------------------------------------------
const json = JSON.parse((0, qa_gate_1.qaGateToJson)(plan));
check('json names the gate', json.gate === 'audit->critique->polish');
check('json carries the target', json.target === 'index.html');
check('json carries three steps', Array.isArray(json.steps) && json.steps.length === 3);
check('json step carries slashCommand + flowIds', json.steps[0].slashCommand === '/sidecoach audit index.html' &&
    Array.isArray(json.steps[0].flowIds) && json.steps[0].flowIds.length > 0);
// --- text surface --------------------------------------------------------
const text = (0, qa_gate_1.renderQaGateText)(plan);
check('text lists all three slash commands', text.includes('/sidecoach audit index.html') &&
    text.includes('/sidecoach critique index.html') &&
    text.includes('/sidecoach polish index.html'));
check('text directs running in order to completion', /in order/i.test(text) && /do not stop after audit/i.test(text));
// --- summary -------------------------------------------------------------
if (failures > 0) {
    console.log(`\nStatus: FAILED (${failures} check(s) failed)`);
    process.exit(1);
}
console.log('\nStatus: PASSED (qa-gate resolver)');
//# sourceMappingURL=qa-gate.test.js.map