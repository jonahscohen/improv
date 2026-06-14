// sidecoach/src/__tests__/lane-lock.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { withCheckpointLock } from '../lane-lock';

async function run() {
  const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-lock-')));
  const dir = path.join(proj, '.claude', 'lane-checkpoints');
  fs.mkdirSync(dir, { recursive: true });

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

  // stale (old content timestamp) -> reclaimable by atomic rename takeover
  const lockPath = path.join(dir, 'cp2.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ owner: 'gone', pid: 999999, at: new Date(0).toISOString() }));
  let acquired = false;
  await withCheckpointLock(dir, 'cp2', async () => { acquired = true; }, { staleMs: 1 });
  if (!acquired) throw new Error('stale lock must be reclaimable');

  // ADVERSARIAL stale takeover: both reclaimers observe the same stale lock.
  // The injected barrier releases both immediately before renameSync. Exactly
  // one rename can claim that path; the loser retries and cannot enter while held.
  const p3 = path.join(dir, 'cp3.lock');
  fs.writeFileSync(p3, JSON.stringify({ owner: 'dead', pid: 999999, at: new Date(0).toISOString() }));
  let takeoverArrivals = 0; let releaseTakeovers!: () => void;
  const takeoversReady = new Promise<void>((r) => { releaseTakeovers = r; });
  const beforeTakeover = async () => { if (++takeoverArrivals === 2) releaseTakeovers(); await takeoversReady; };
  let inside = 0; let maxInside = 0; let entered = 0; let releaseWinner!: () => void;
  const winnerHeld = new Promise<void>((r) => { releaseWinner = r; });
  const body = async () => { entered++; inside++; maxInside = Math.max(maxInside, inside); await winnerHeld; inside--; };
  const a = withCheckpointLock(dir, 'cp3', body, { ownerToken: 'a', staleMs: 1, retries: 0, __beforeStaleTakeover: beforeTakeover });
  const b = withCheckpointLock(dir, 'cp3', body, { ownerToken: 'b', staleMs: 1, retries: 0, __beforeStaleTakeover: beforeTakeover });
  // The loser rejects (retries:0) before Promise.allSettled below attaches; guard
  // against an unhandled-rejection process crash without changing what is asserted.
  a.catch(() => {}); b.catch(() => {});
  while (entered === 0) await new Promise((r) => setTimeout(r, 1));
  await new Promise((r) => setTimeout(r, 5));
  if (entered !== 1 || maxInside !== 1) throw new Error('exactly one simultaneous stale reclaimer enters');
  releaseWinner();
  const settled = await Promise.allSettled([a, b]);
  if (settled.filter((x) => x.status === 'fulfilled').length !== 1) throw new Error('only takeover winner fulfills with retries:0');

  // Real reclaimed-owner release: owner A is still running after its lock is
  // made stale and atomically replaced by B. A's finally must not delete B's lock.
  let releaseA!: () => void; const holdA = new Promise<void>((r) => { releaseA = r; });
  let releaseB!: () => void; const holdB = new Promise<void>((r) => { releaseB = r; });
  const ownerA = withCheckpointLock(dir, 'cp4', async () => { await holdA; }, { ownerToken: 'owner-a' });
  while (!fs.existsSync(path.join(dir, 'cp4.lock'))) await new Promise((r) => setTimeout(r, 1));
  fs.writeFileSync(path.join(dir, 'cp4.lock'), JSON.stringify({ owner: 'owner-a', pid: process.pid, at: new Date(0).toISOString() }));
  const ownerB = withCheckpointLock(dir, 'cp4', async () => { await holdB; }, { ownerToken: 'owner-b', staleMs: 1 });
  while (JSON.parse(fs.readFileSync(path.join(dir, 'cp4.lock'), 'utf8')).owner !== 'owner-b') await new Promise((r) => setTimeout(r, 1));
  releaseA(); await ownerA;
  if (JSON.parse(fs.readFileSync(path.join(dir, 'cp4.lock'), 'utf8')).owner !== 'owner-b') throw new Error('reclaimed owner finally deleted replacement lock');
  releaseB(); await ownerB;
  console.log('lane-lock: OK');
}
run();
