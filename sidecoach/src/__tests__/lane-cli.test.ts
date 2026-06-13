// sidecoach/src/__tests__/lane-cli.test.ts
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const MONITOR = path.join(__dirname, '..', '..', 'bin', 'sidecoach-monitor.js');
function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-cli-'));
  const start = execFileSync('node', [MONITOR, 'lane', 'start', '--lane', 'lane_build', '--project', proj, '--target', 'hero', '--start-request-id', 'cli-1'], { encoding: 'utf8' });
  const startObj = JSON.parse(start);
  if (startObj.laneId !== 'lane_build' || startObj.currentVerb !== 'shape') throw new Error('CLI start failed');
  const list = JSON.parse(execFileSync('node', [MONITOR, 'lane', 'list', '--project', proj], { encoding: 'utf8' }));
  if (!Array.isArray(list) || list.length !== 1) throw new Error('CLI list failed');
  const status = JSON.parse(execFileSync('node', [MONITOR, 'lane', 'status', '--project', proj, '--checkpoint', startObj.checkpointId], { encoding: 'utf8' }));
  if (status.lifecycle !== 'in_progress') throw new Error('CLI status failed');
  console.log('lane-cli: OK');
}
run();
