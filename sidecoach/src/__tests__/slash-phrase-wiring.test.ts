// sidecoach/src/__tests__/slash-phrase-wiring.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createExecutionEngine } from '../sidecoach-orchestrator';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-wire-'));
  const engine = createExecutionEngine();
  const ctx = { projectPath: proj, userId: 'test' };

  // ROUTE phrase -> a lane is actually STARTED through process()
  const routed: any = await engine.process('/sidecoach build me a dashboard from scratch and make it production-ready', ctx);
  if (!routed.lane || !routed.lane.checkpointId) throw new Error('ROUTE phrase must start a lane via process()');
  if (routed.lane.currentVerb !== 'shape') throw new Error('started lane should be on its first verb');

  // OUT_OF_SCOPE phrase -> refusal, NOT a lane. NB: the first word must NOT be a
  // known verb/phase command. A lane-lexicon term co-occurring with a backend
  // negative_filter in one clause trips OUT_OF_SCOPE (empirically verified).
  const oos: any = await engine.process('/sidecoach a greenfield backend service with a sql database', ctx);
  if (oos.lane) throw new Error('backend phrase must not start a lane');
  if (!/UI|design|scope/i.test(oos.message || '')) throw new Error('OUT_OF_SCOPE should explain the scope');

  // typo -> near-miss suggestion, no lane
  const typo: any = await engine.process('/sidecoach polsih', ctx);
  if (typo.lane) throw new Error('typo must not start a lane');
  if (!/did you mean/i.test(typo.message || '')) throw new Error('typo should suggest');

  // bare /sidecoach still shows the menu (unchanged)
  const menu: any = await engine.process('/sidecoach', ctx);
  if (menu.lane) throw new Error('bare /sidecoach must not start a lane');

  // a known verb still routes via parseSlashCommand (not the phrase path)
  const known: any = await engine.process('/sidecoach polish', ctx);
  if (known.lane) throw new Error('known verb must use the command path, not phrase routing');

  // CLASSIFY confirm-to-start round trip: a murky phrase surfaces a candidate,
  // and confirming it (calling startLane with classify.laneId - the SAME
  // terminal path as ROUTE) actually starts the lane. 'make it pop' is an
  // empirically-verified CLASSIFY phrase (-> lane_delight, a sequence lane).
  const murky: any = await engine.process('/sidecoach make it pop', ctx);
  if (murky.classify) {
    if (!murky.classify.laneId) throw new Error('CLASSIFY must surface a candidate laneId');
    const confirmed = await engine.startLane(murky.classify.laneId, 'confirmed via interview', { projectPath: proj }, 'confirm-1');
    if (confirmed.lifecycle !== 'in_progress' || !confirmed.currentVerb) throw new Error('confirming a CLASSIFY candidate must start the lane (same path as ROUTE)');
  } else {
    // if 'make it pop' did not classify, the implementer MUST substitute a
    // verified-CLASSIFY phrase here - this branch must not silently pass.
    throw new Error('CLASSIFY round-trip not exercised: substitute a phrase the classifier returns CLASSIFY for');
  }
  console.log('slash-phrase-wiring: OK');
}
run();
