// sidecoach/src/__tests__/lane-lock.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { withCheckpointLock } from '../lane-lock';

async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-lock-')));
  const dir = path.join(proj, '.claude', 'lane-checkpoints');
  fs.mkdirSync(dir, { recursive: true });

  // 1. mutual exclusion: a second acquire while held fails with retries:0; the body
  //    must NOT run; the lock releases after the body.
  let inner2Ran = false;
  await withCheckpointLock(dir, 'cp1', async () => {
    let threw = false;
    try { await withCheckpointLock(dir, 'cp1', async () => { inner2Ran = true; }, { retries: 0 }); }
    catch { threw = true; }
    if (!threw) throw new Error('second acquire while held must fail with retries:0');
    if (inner2Ran) throw new Error('held lock must not let a second body run');
  });
  let ran = false;
  await withCheckpointLock(dir, 'cp1', async () => { ran = true; });
  if (!ran) throw new Error('lock must release after body');

  // 2. stale reclaim: a lock with an ancient mtime is reclaimable (a crashed holder).
  const lockDir = `${path.join(dir, 'cp2')}.lock`;
  fs.mkdirSync(lockDir);
  fs.utimesSync(lockDir, new Date(0), new Date(0));   // ancient -> stale
  let acquired = false;
  await withCheckpointLock(dir, 'cp2', async () => { acquired = true; }, { staleMs: 2000 });
  if (!acquired) throw new Error('stale lock must be reclaimable');

  // 3. THREE contenders racing on a STALE lock: even though all observe it stale and
  //    try to reclaim, AT MOST ONE may hold it - critical sections never overlap and
  //    all three eventually run. (The proper-lockfile reclaim is the vetted CAS that
  //    the hand-rolled rename-takeover could not get right.)
  const p3 = `${path.join(dir, 'cp3')}.lock`;
  fs.mkdirSync(p3);
  fs.utimesSync(p3, new Date(0), new Date(0));         // seed a stale lock all three observe
  const st = { inside: 0, maxInside: 0, entered: 0 };
  let releaseFirst!: () => void;
  const firstHeld = new Promise<void>((r) => { releaseFirst = r; });
  const body = async () => {
    st.entered++; st.inside++; st.maxInside = Math.max(st.maxInside, st.inside);
    if (st.entered === 1) await firstHeld;             // first holder pauses so contenders pile up
    st.inside--;
  };
  const opts = { staleMs: 2000, retries: 200, retryDelayMs: 10 };
  const a = withCheckpointLock(dir, 'cp3', body, opts);
  const b = withCheckpointLock(dir, 'cp3', body, opts);
  const c = withCheckpointLock(dir, 'cp3', body, opts);
  a.catch(() => {}); b.catch(() => {}); c.catch(() => {});
  while (st.entered === 0) await new Promise((r) => setTimeout(r, 1));
  await new Promise((r) => setTimeout(r, 15));
  if (st.entered !== 1 || st.maxInside !== 1) throw new Error('only one of three stale reclaimers may hold the lock at once');
  releaseFirst();
  await Promise.all([a, b, c]);
  if (Number(st.entered) !== 3 || Number(st.maxInside) !== 1) throw new Error(`all three must run, never overlapping (entered=${st.entered}, maxInside=${st.maxInside})`);

  console.log('lane-lock: OK');
}
run();
