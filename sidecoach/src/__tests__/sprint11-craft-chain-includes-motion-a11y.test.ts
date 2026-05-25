import { IMPECCABLE_VERB_REGISTRY } from '../impeccable-command-registry';

async function run() {
  const checks: Array<[string, boolean]> = [];

  const craft = IMPECCABLE_VERB_REGISTRY.craft;
  checks.push(['T2.1: craft entry exists', !!craft]);

  if (craft) {
    checks.push(['T2.2: craft.flowIds includes flowH_motion_integration', craft.flowIds.includes('flowH_motion_integration' as any)]);
    checks.push(['T2.2: craft.flowIds includes flowI_accessibility', craft.flowIds.includes('flowI_accessibility' as any)]);
    checks.push(['T2.3: craft.flowIds has >= 6 entries (Sprint 11 lower bound; Sprint 12 grew it to 8)', craft.flowIds.length >= 6]);
    checks.push(['T2.4: parityChecklist mentions motion', craft.parityChecklist.some((s) => /motion/i.test(s))]);
    checks.push(['T2.4: parityChecklist mentions accessibility', craft.parityChecklist.some((s) => /accessibility/i.test(s))]);
    checks.push(['T2.5: guidanceAppend mentions motion integration', craft.guidanceAppend.some((s) => /motion/i.test(s))]);
    checks.push(['T2.5: guidanceAppend mentions accessibility', craft.guidanceAppend.some((s) => /accessibility/i.test(s))]);
  }

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint11-craft-chain-includes-motion-a11y PASS' : 'sprint11-craft-chain-includes-motion-a11y FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
