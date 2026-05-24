import { CheckpointStore, SidecoachCheckpoint } from '../checkpoint-store';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function run() {
  const checks: Array<[string, boolean]> = [];

  // Sandbox dir
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-checkpoint-'));

  // Fixture builder
  const makeCheckpoint = (overrides: Partial<SidecoachCheckpoint> = {}): SidecoachCheckpoint => ({
    schemaVersion: 1,
    checkpointId: 'sidecoach-composite_craft_landing_page-20260524T120000000Z',
    compositeFlowId: 'composite_craft_landing_page' as any,
    createdAt: '2026-05-24T12:00:00.000Z',
    cursor: 3,
    completedStepIds: ['flowA' as any, 'flowB' as any, 'flowC' as any],
    flowResults: [
      { flowId: 'flowA' as any, flowName: 'flowA', status: 'success', message: 'ok', guidance: [], checklist: [] } as any,
    ],
    executionContext: { utterance: 'craft a landing page', projectPath: sandbox, metadata: {} } as any,
    utterance: 'craft a landing page',
    ...overrides,
  });

  const store = new CheckpointStore(sandbox);

  // T1: write -> read round-trip preserves all fields
  const cp1 = makeCheckpoint();
  store.writeCheckpoint(cp1);
  const read1 = store.readCheckpoint(cp1.checkpointId);
  checks.push(['T1: write/read round-trip preserves cursor', read1.cursor === 3]);
  checks.push(['T1: write/read round-trip preserves compositeFlowId', (read1.compositeFlowId as string) === 'composite_craft_landing_page']);
  checks.push(['T1: write/read round-trip preserves utterance', read1.utterance === 'craft a landing page']);
  checks.push(['T1: write/read round-trip preserves flowResults length', read1.flowResults.length === 1]);

  // T2: write produces atomic result (no leftover tmp file in checkpoints dir)
  const checkpointsDir = path.join(sandbox, '.claude', 'checkpoints');
  const entries = fs.readdirSync(checkpointsDir);
  const tmpFiles = entries.filter(e => e.endsWith('.tmp') || e.startsWith('.'));
  checks.push(['T2: no leftover tmp files in checkpoints dir', tmpFiles.length === 0]);
  checks.push(['T2: exactly one checkpoint file written', entries.length === 1]);

  // T3: delete is idempotent
  store.deleteCheckpoint(cp1.checkpointId);
  let secondDeleteThrew = false;
  try { store.deleteCheckpoint(cp1.checkpointId); } catch { secondDeleteThrew = true; }
  checks.push(['T3: delete of missing checkpoint does not throw', !secondDeleteThrew]);

  // T4: listCheckpoints returns CheckpointSummary objects sorted by createdAt desc
  const cpA = makeCheckpoint({ checkpointId: 'sidecoach-X-001', createdAt: '2026-05-24T10:00:00.000Z' });
  const cpB = makeCheckpoint({ checkpointId: 'sidecoach-X-002', createdAt: '2026-05-24T11:00:00.000Z' });
  const cpC = makeCheckpoint({ checkpointId: 'sidecoach-X-003', createdAt: '2026-05-24T12:00:00.000Z' });
  store.writeCheckpoint(cpA);
  store.writeCheckpoint(cpB);
  store.writeCheckpoint(cpC);
  const listed = store.listCheckpoints();
  checks.push(['T4: listCheckpoints returns 3 entries', listed.length === 3]);
  checks.push(['T4: listCheckpoints sorted by createdAt desc (newest first)', listed[0].checkpointId === 'sidecoach-X-003']);
  checks.push(['T4: listCheckpoints summary has cursor field', typeof listed[0].cursor === 'number']);
  checks.push(['T4: listCheckpoints summary excludes flowResults', !('flowResults' in listed[0])]);

  // T5: gcOldCheckpoints deletes only files older than maxAgeDays
  // Backdate cpA's file mtime to 10 days ago.
  const cpAPath = path.join(checkpointsDir, 'sidecoach-X-001.json');
  const tenDaysAgo = (Date.now() - 10 * 24 * 60 * 60 * 1000) / 1000;
  fs.utimesSync(cpAPath, tenDaysAgo, tenDaysAgo);
  const deletedCount = store.gcOldCheckpoints(7);
  checks.push(['T5: gcOldCheckpoints removed 1 stale file', deletedCount === 1]);
  checks.push(['T5: gcOldCheckpoints kept the 2 fresh files', store.listCheckpoints().length === 2]);

  // T6: readCheckpoint with mismatched schemaVersion throws
  const cpBad = makeCheckpoint({ checkpointId: 'sidecoach-bad-v2', schemaVersion: 2 as any });
  // Write directly without using writeCheckpoint (which would validate). Hand-craft the file.
  fs.writeFileSync(path.join(checkpointsDir, 'sidecoach-bad-v2.json'), JSON.stringify(cpBad));
  let badRead: string | null = null;
  try { store.readCheckpoint('sidecoach-bad-v2'); } catch (e) { badRead = (e as Error).message; }
  checks.push(['T6: readCheckpoint(badSchemaVersion) throws', badRead !== null]);
  checks.push(['T6: error message mentions schemaVersion', !!badRead && /schemaVersion/i.test(badRead)]);

  // T7: readCheckpoint with missing file throws
  let missingRead: string | null = null;
  try { store.readCheckpoint('sidecoach-not-there'); } catch (e) { missingRead = (e as Error).message; }
  checks.push(['T7: readCheckpoint(missingFile) throws', missingRead !== null]);

  // Cleanup sandbox
  fs.rmSync(sandbox, { recursive: true, force: true });

  // Report
  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint6-checkpoint-store-isolated PASS' : 'sprint6-checkpoint-store-isolated FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
