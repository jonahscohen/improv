/**
 * qa-gate.test.ts - the orchestrated QA gate resolver.
 *
 * Guards the property the on-edit auto-invoke hook depends on: the
 * audit -> critique -> polish sequence resolves, in order, to the SAME flow
 * chains the verb registry defines, through the shared router - and fails LOUD
 * if any stage becomes unroutable.
 */

import {
  resolveQaGate,
  qaGateToJson,
  renderQaGateText,
  QA_GATE_VERBS,
} from '../qa-gate';
import { getVerbEntry } from '../verb-command-registry';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    console.log(`PASS ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    failures++;
  }
}

// --- shape + order -------------------------------------------------------
const plan = resolveQaGate('index.html');
check('gate has exactly three stages', plan.steps.length === 3);
check('stage order is audit -> critique -> polish',
  plan.steps.map((s) => s.verb).join(',') === 'audit,critique,polish');
check('order fields are 1,2,3',
  plan.steps.map((s) => s.order).join(',') === '1,2,3');
check('QA_GATE_VERBS is the same ordered sequence',
  QA_GATE_VERBS.join(',') === 'audit,critique,polish');

// --- each stage grounded in the verb registry ---------------------------
for (const step of plan.steps) {
  const entry = getVerbEntry(step.verb);
  check(`${step.verb}: verb exists in registry`, Boolean(entry));
  check(`${step.verb}: flow chain is non-empty`, step.flowIds.length > 0);
  check(`${step.verb}: flow chain matches the registry chain`,
    Boolean(entry) && step.flowIds.join(',') === entry!.flowIds.join(','));
  check(`${step.verb}: description matches the registry`,
    Boolean(entry) && step.description === entry!.description);
}

// --- the three stages route to their canonical flows --------------------
const byVerb = Object.fromEntries(plan.steps.map((s) => [s.verb, s]));
check('audit stage runs the multi-lens audit flow',
  byVerb.audit.flowIds.includes('flowK_multi_lens_audit' as any));
check('critique stage runs the design-critique flow',
  byVerb.critique.flowIds.includes('flowL_design_critique' as any));
check('polish stage runs the tactical-polish flow',
  byVerb.polish.flowIds.includes('flowJ_tactical_polish' as any));

// --- slash command formatting -------------------------------------------
check('slash command carries the target',
  byVerb.audit.slashCommand === '/sidecoach audit index.html');
const noTarget = resolveQaGate();
check('empty target yields null target', noTarget.target === null);
check('slash command omits target when none given',
  noTarget.steps[0].slashCommand === '/sidecoach audit');
check('whitespace-only target is treated as no target',
  resolveQaGate('   ').target === null);

// --- JSON surface --------------------------------------------------------
const json = JSON.parse(qaGateToJson(plan));
check('json names the gate', json.gate === 'audit->critique->polish');
check('json carries the target', json.target === 'index.html');
check('json carries three steps', Array.isArray(json.steps) && json.steps.length === 3);
check('json step carries slashCommand + flowIds',
  json.steps[0].slashCommand === '/sidecoach audit index.html' &&
  Array.isArray(json.steps[0].flowIds) && json.steps[0].flowIds.length > 0);

// --- text surface --------------------------------------------------------
const text = renderQaGateText(plan);
check('text lists all three slash commands',
  text.includes('/sidecoach audit index.html') &&
  text.includes('/sidecoach critique index.html') &&
  text.includes('/sidecoach polish index.html'));
check('text directs running in order to completion',
  /in order/i.test(text) && /do not stop after audit/i.test(text));

// --- summary -------------------------------------------------------------
if (failures > 0) {
  console.log(`\nStatus: FAILED (${failures} check(s) failed)`);
  process.exit(1);
}
console.log('\nStatus: PASSED (qa-gate resolver)');
