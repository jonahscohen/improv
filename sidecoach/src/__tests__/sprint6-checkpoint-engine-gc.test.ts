import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  const checks: Array<[string, boolean]> = [];

  // Sandbox a projectPath with an OLD checkpoint file already on disk.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-engine-gc-'));
  const checkpointsDir = path.join(sandbox, '.claude', 'checkpoints');
  fs.mkdirSync(checkpointsDir, { recursive: true });

  const oldFile = path.join(checkpointsDir, 'sidecoach-stale-001.json');
  const oldCheckpoint = {
    schemaVersion: 1,
    checkpointId: 'sidecoach-stale-001',
    compositeFlowId: 'composite_qa_workflow',
    createdAt: '2026-05-14T00:00:00.000Z',
    cursor: 0,
    completedStepIds: [],
    flowResults: [],
    executionContext: { utterance: '', projectPath: sandbox, metadata: {} },
    utterance: '',
  };
  fs.writeFileSync(oldFile, JSON.stringify(oldCheckpoint));
  // Backdate mtime to 10 days ago (older than the 7-day GC threshold).
  const tenDaysAgo = (Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000;
  fs.utimesSync(oldFile, tenDaysAgo, tenDaysAgo);

  // Sanity: file exists before engine boot.
  checks.push(['pre: stale checkpoint file exists', fs.existsSync(oldFile)]);

  // Boot the engine and invoke process() with the sandbox projectPath.
  const engine = new FlowExecutionEngine();
  await engine.process('hello sidecoach', { projectPath: sandbox, projectContext: { register: 'brand' } } as any);

  // After the first process() call, the stale file should be deleted.
  checks.push(['post: stale checkpoint file removed by GC', !fs.existsSync(oldFile)]);

  // Second process() call should NOT re-run GC (boot-once flag).
  const secondStale = path.join(checkpointsDir, 'sidecoach-stale-002.json');
  fs.writeFileSync(secondStale, JSON.stringify({ ...oldCheckpoint, checkpointId: 'sidecoach-stale-002' }));
  fs.utimesSync(secondStale, tenDaysAgo, tenDaysAgo);
  await engine.process('hello again', { projectPath: sandbox, projectContext: { register: 'brand' } } as any);
  checks.push(['second-call: GC does NOT re-fire (file still present)', fs.existsSync(secondStale)]);

  fs.rmSync(sandbox, { recursive: true, force: true });

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint6-checkpoint-engine-gc PASS' : 'sprint6-checkpoint-engine-gc FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
