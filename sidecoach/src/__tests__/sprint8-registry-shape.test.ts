import { IMPECCABLE_VERB_REGISTRY, getImpeccableVerbs, getImpeccableEntry } from '../impeccable-command-registry';

async function run() {
  const checks: Array<[string, boolean]> = [];

  const verbs = getImpeccableVerbs();
  const expected = ['craft', 'polish', 'audit', 'critique', 'document'];
  for (const v of expected) {
    checks.push([`T1.1: registry contains '${v}'`, verbs.includes(v)]);
  }

  for (const v of expected) {
    const entry = getImpeccableEntry(v);
    checks.push([`T1.2: ${v} has command field`, !!entry && entry.command === v]);
    checks.push([`T1.2: ${v} has impeccableSkillPath`, !!entry && typeof entry.impeccableSkillPath === 'string' && entry.impeccableSkillPath.includes('impeccable')]);
    checks.push([`T1.2: ${v} has phase`, !!entry && ['shape','craft','review','tone','docs','tactical'].includes(entry.phase)]);
    checks.push([`T1.2: ${v} has non-empty flowIds OR document special-case (empty allowed for document only)`, !!entry && (entry.flowIds.length > 0 || entry.command === 'document')]);
    checks.push([`T1.2: ${v} has non-empty parityChecklist`, !!entry && Array.isArray(entry.parityChecklist) && entry.parityChecklist.length > 0]);
    checks.push([`T1.2: ${v} has non-empty parityPlus`, !!entry && Array.isArray(entry.parityPlus) && entry.parityPlus.length > 0]);
  }

  checks.push(['T1.3: unknown verb returns undefined', getImpeccableEntry('does_not_exist') === undefined]);

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint8-registry-shape PASS' : 'sprint8-registry-shape FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
