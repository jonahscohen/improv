// sidecoach/src/__tests__/lane-engine-methods.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createExecutionEngine } from '../sidecoach-orchestrator';
import { StepReport } from '../lane-types';

const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `eng:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-eng-'));
  const engine = createExecutionEngine();               // factory registers handlers
  const res = await engine.startLane('lane_build', 'hero', { projectPath: proj }, 'req-1');
  if (res.laneId !== 'lane_build' || res.currentVerb !== 'shape') throw new Error('startLane via engine failed');
  if (!Array.isArray(res.guidance) || res.guidance.length === 0) throw new Error('engine must serve real guidance');
  const st = engine.laneStatus(proj, res.checkpointId);
  if (st.totalSteps !== 3) throw new Error('laneStatus via engine failed');
  if (engine.listLanes(proj).length !== 1) throw new Error('listLanes via engine failed');

  // Engine advanceLane runs the REAL async validators (laneDeps wiring). complete shape
  // binds no validator -> clean -> advance to craft; complete craft binds polish-standard,
  // whose required rules are inconclusive on an empty temp project -> gate
  // validation_inconclusive -> craft STAYS current; a later laneStatus persists that.
  const r2 = await engine.advanceLane(proj, res.checkpointId, { action: 'complete', report: rep('shape'), expectedRevision: res.revision });
  if (r2.currentVerb !== 'craft') throw new Error('engine: clean shape advances to craft');
  const cur = engine.laneStatus(proj, res.checkpointId);
  const r3 = await engine.advanceLane(proj, res.checkpointId, { action: 'complete', report: rep('craft'), expectedRevision: cur.revision });
  if (r3.currentVerb !== 'craft') throw new Error('engine: inconclusive gate keeps craft current');
  if (r3.gate?.status !== 'inconclusive') throw new Error(`engine: empty-project craft gate must be inconclusive, got ${r3.gate?.status}`);
  const later = engine.laneStatus(proj, res.checkpointId);
  const craftStep = later.steps.find((x) => x.verb === 'craft');
  if (craftStep?.status !== 'validation_inconclusive') throw new Error(`engine: craft must persist validation_inconclusive, got ${craftStep?.status}`);
  console.log('lane-engine-methods: OK');
}
run();
