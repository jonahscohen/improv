// sidecoach/src/__tests__/lane-engine-methods.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createExecutionEngine } from '../sidecoach-orchestrator';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-eng-'));
  const engine = createExecutionEngine();               // factory registers handlers
  const res = await engine.startLane('lane_build', 'hero', { projectPath: proj }, 'req-1');
  if (res.laneId !== 'lane_build' || res.currentVerb !== 'shape') throw new Error('startLane via engine failed');
  if (!Array.isArray(res.guidance) || res.guidance.length === 0) throw new Error('engine must serve real guidance');
  const st = engine.laneStatus(proj, res.checkpointId);
  if (st.totalSteps !== 3) throw new Error('laneStatus via engine failed');
  if (engine.listLanes(proj).length !== 1) throw new Error('listLanes via engine failed');
  console.log('lane-engine-methods: OK');
}
run();
