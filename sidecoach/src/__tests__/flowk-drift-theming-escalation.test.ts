// sidecoach/src/__tests__/flowk-drift-theming-escalation.test.ts
//
// ITEM 7: the ACTIVE flowK multi-lens audit handler (the one the orchestrator registers, in
// flow-handlers-tier3-tier4.ts) must invoke the Theming token-drift lens (bin/sidecoach-drift.js) so a
// REAL drift verdict ESCALATES the Theming dimension. Before this, the drift lens lived only in the
// sibling multi-lens module that nothing but tests imported, so the audit that actually ran never
// checked token drift.
//
// This exercises the REAL lens end to end: runTokenDriftCheck spawns the real sidecoach-drift bin
// against committed fixtures (drift-project -> a genuine `drift` verdict; clean-project -> `clean`), and
// the ACTIVE handler is run over them.

import { FlowKMultiLensAuditHandler } from '../flow-handlers-tier3-tier4';
import { runTokenDriftCheck } from '../flow-handler-multi-lens-audit';
import * as path from 'path';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void { if (cond) passed += 1; else failures.push(label); }

const FIX = path.resolve(__dirname, '..', '..', 'fixtures', 'drift');
const DRIFT_PROJECT = path.join(FIX, 'drift-project');
const CLEAN_PROJECT = path.join(FIX, 'clean-project');

function makeCtx(projectPath: string): any {
  return { utterance: 'audit', projectPath, metadata: {}, flowMetadata: { tags: [], customData: {} } };
}

async function main(): Promise<void> {
  // 1. The lens itself returns a REAL drift verdict on the drift fixture and a clean pass on the clean one.
  const driftOutcome = runTokenDriftCheck(DRIFT_PROJECT);
  ok(!!driftOutcome && driftOutcome.status === 'fail', 'runTokenDriftCheck returns a real fail verdict on the drift fixture');
  ok(!!driftOutcome && /drifted from DESIGN\.md/.test(driftOutcome.issue), 'the drift verdict names the drifted tokens');
  const cleanOutcome = runTokenDriftCheck(CLEAN_PROJECT);
  ok(!!cleanOutcome && cleanOutcome.status === 'pass', 'runTokenDriftCheck returns a clean pass on the clean fixture');

  // 2. The ACTIVE handler ESCALATES the Theming dimension on a real drift verdict.
  const handler = new FlowKMultiLensAuditHandler();
  const driftCtx = makeCtx(DRIFT_PROJECT);
  const driftResult = await handler.execute(driftCtx);

  ok(driftResult.status === 'success', 'the audit still completes (the lens is contained, never crashes)');
  const g = (driftResult.guidance || []).join('\n');
  ok(/Theming lens ESCALATED by token drift/.test(g), 'a real drift ESCALATES the Theming dimension in the guidance');
  ok((driftResult.guidance || []).some((l) => l.startsWith('Dimension 3: Theming [FAIL - token drift]')), 'the Theming dimension line is rewritten to [FAIL - token drift]');
  ok(/sidecoach-drift/.test(g), 'the guidance names the sidecoach-drift lens');
  ok(driftCtx.flowMetadata.customData['theming-drift'] === 'fail', "customData['theming-drift'] === 'fail' after a real drift verdict");
  const checklistLabels = (driftResult.checklist || []).map((c: any) => c.label || c.text || '').join('\n');
  ok(/Resolve token drift vs DESIGN\.md/.test(checklistLabels), 'a required checklist item to resolve the token drift is added');

  // 3. On a CLEAN project the Theming dimension is NOT escalated (no false positive).
  const cleanCtx = makeCtx(CLEAN_PROJECT);
  const cleanResult = await handler.execute(cleanCtx);
  const cg = (cleanResult.guidance || []).join('\n');
  ok(!/Theming lens ESCALATED/.test(cg), 'a clean project does NOT escalate the Theming dimension');
  ok((cleanResult.guidance || []).some((l) => l.startsWith('Dimension 3: Theming (')), 'the clean Theming dimension line is unchanged');
  ok(cleanCtx.flowMetadata.customData['theming-drift'] === 'pass', "customData['theming-drift'] === 'pass' on a clean project");
  ok(/Token drift vs DESIGN\.md \(sidecoach-drift\): none/.test(cg), 'the clean audit still records the drift lens ran (audited pass note)');

  if (failures.length) {
    process.stderr.write(`flowk-drift-theming-escalation.test: ${passed} passed, ${failures.length} FAILED\n`);
    for (const f of failures) process.stderr.write(`  x ${f}\n`);
    process.exit(1);
  }
  console.log(`flowk-drift-theming-escalation: OK (${passed} assertions)`);
}

main().catch((e) => { process.stderr.write(`flowk-drift-theming-escalation.test: threw ${e && e.message ? e.message : String(e)}\n`); process.exit(1); });
