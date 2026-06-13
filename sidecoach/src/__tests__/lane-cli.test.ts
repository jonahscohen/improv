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

  // P2-3: --report validation hardening. Each malformed report must be REJECTED
  // (non-zero exit) BEFORE it mutates the lane. The current step is 'shape'.
  const advanceWith = (report: any) => execFileSync('node',
    [MONITOR, 'lane', 'advance', '--project', proj, '--checkpoint', startObj.checkpointId, '--action', 'complete', '--revision', '0', '--report', JSON.stringify(report)],
    { encoding: 'utf8', stdio: 'pipe' });
  const rejects = (report: any, label: string) => {
    let threw = false;
    try { advanceWith(report); } catch { threw = true; }
    if (!threw) throw new Error(`CLI must reject ${label}`);
  };
  const base = { stepId: 'shape', reportId: 'r-ok', verb: 'shape', summary: 's', iteration: 0, evidence: [{ kind: 'note', detail: 'x' }] };
  rejects({ ...base, evidence: [{ kind: 'bogus', detail: 'x' }] }, 'an invalid evidence.kind');
  rejects({ ...base, evidence: [{ kind: 'note', detail: '' }] }, 'an empty evidence.detail');
  rejects({ ...base, stepId: '' }, 'an empty stepId');
  rejects({ ...base, reportId: '   ' }, 'a blank reportId');
  rejects({ ...base, checklistResults: [{ itemId: 'a', done: 'yes' }] }, 'a malformed checklistResults entry');
  console.log('lane-cli: OK');
}
run();
