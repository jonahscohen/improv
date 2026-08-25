// sidecoach/src/__tests__/consolidate-mine-router.test.ts
//
// The slash router must RECOGNIZE the two self-updating-taste-loop maintenance commands - `consolidate`
// (the consolidation + contradiction map) and `mine` (the taste miner) - beside `doctor`. Before this
// branch the router returned isCommand:false ("Unknown command") for both, so `/sidecoach consolidate`
// and `node bin/sidecoach.js consolidate` could not resolve. They are no-flow maintenance commands, so
// they carry an EMPTY flow chain (like doctor), and dispatch to their engines happens in bin/sidecoach.js.

import { parseSlashCommand } from '../slash-command-router';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void { if (cond) passed += 1; else failures.push(label); }
function eq<T>(a: T, b: T, label: string): void { ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

// consolidate is recognized, with no flow chain
{
  const r = parseSlashCommand('/sidecoach consolidate');
  eq(r.isCommand, true, 'consolidate is recognized (isCommand true)');
  eq(r.command, 'consolidate', 'consolidate resolves to command "consolidate"');
  eq((r.flowIds || []).length, 0, 'consolidate carries no flow chain (maintenance command)');
}

// consolidate with a target keeps the target (so `sidecoach consolidate map` can pass it through)
{
  const r = parseSlashCommand('/sidecoach consolidate map');
  eq(r.isCommand, true, 'consolidate <target> is recognized');
  eq(r.target, 'map', 'consolidate keeps its target');
}

// mine is recognized, with no flow chain
{
  const r = parseSlashCommand('/sidecoach mine');
  eq(r.isCommand, true, 'mine is recognized (isCommand true)');
  eq(r.command, 'mine', 'mine resolves to command "mine"');
  eq((r.flowIds || []).length, 0, 'mine carries no flow chain');
}

// mirrors the existing doctor shape (no flow chain, isCommand true)
{
  const d = parseSlashCommand('/sidecoach doctor');
  eq(d.isCommand, true, 'doctor is still recognized (unchanged precedent)');
  eq((d.flowIds || []).length, 0, 'doctor still carries no flow chain');
}

// an unknown command is still rejected - the branch did not swallow everything
{
  const u = parseSlashCommand('/sidecoach definitely-not-a-command');
  eq(u.isCommand, false, 'an unknown command is still isCommand false (branch is not over-broad)');
}

// a real verb still routes to its flow chain (the maintenance branch is matched before the verb registry
// but only for the two exact words)
{
  const v = parseSlashCommand('/sidecoach audit');
  eq(v.isCommand, true, 'a real verb (audit) still resolves');
  ok((v.flowIds || []).length > 0, 'a real verb still carries its flow chain');
}

if (failures.length) {
  process.stderr.write(`consolidate-mine-router.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
console.log(`consolidate-mine-router: OK (${passed} assertions)`);
