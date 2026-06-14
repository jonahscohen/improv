// sidecoach/src/lane-lock.ts
import * as fs from 'fs';
import * as path from 'path';

export interface LockOpts {
  retries?: number; retryDelayMs?: number; staleMs?: number; ownerToken?: string;
  __beforeStaleTakeover?: () => Promise<void>; // deterministic adversarial test seam
}
const LOCK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// O_EXCL lock with a UNIQUE owner token. Three correctness properties:
// (a) a newly-created lock mid-write (unparseable/empty content) is NOT treated as
//     immediately stale - staleness for unparseable content falls back to FILE
//     MTIME, so a concurrent reader in the create->write window waits (grace) while
//     a genuinely crashed-mid-write lock (old mtime) is still reclaimable;
// (b) stale takeover is an atomic rename to a unique per-attempt path. Never
//     blind-unlink the shared lock path. Only the reclaimer whose rename succeeds
//     owns the stale file and may unlink that renamed claim;
// (c) release also atomically renames to a unique claim before checking owner,
//     then unlinks only that claimed file. It never check-then-unlinks lockPath.
export async function withCheckpointLock<T>(
  dir: string, checkpointId: string, fn: () => Promise<T> | T, opts: LockOpts = {},
): Promise<T> {
  if (!LOCK_ID_RE.test(checkpointId) || checkpointId.includes('..')) throw new Error(`withCheckpointLock: illegal checkpointId "${checkpointId}"`);
  const retries = opts.retries ?? 50;
  const delay = opts.retryDelayMs ?? 20;
  const staleMs = opts.staleMs ?? 30000;
  const myToken = opts.ownerToken ?? `${process.pid}-${process.hrtime.bigint().toString()}-${Math.random().toString(36).slice(2)}`;
  const lockPath = path.join(dir, `${checkpointId}.lock`);
  fs.mkdirSync(dir, { recursive: true });
  let attempt = 0;
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx');                 // O_EXCL atomic create
      try { fs.writeFileSync(fd, JSON.stringify({ owner: myToken, pid: process.pid, at: nowIso() })); } finally { fs.closeSync(fd); }
      break;
    } catch (e: any) {
      if (e.code !== 'EEXIST') throw e;
      let info: any = null;
      try { info = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { info = null; }
      const ts = info && typeof info.at === 'string' ? Date.parse(info.at) : NaN;
      let stale: boolean;
      if (!Number.isNaN(ts)) stale = (Date.now() - ts) > staleMs;       // parseable content: content age
      else { try { stale = (Date.now() - fs.statSync(lockPath).mtimeMs) > staleMs; } catch { stale = true; } } // unparseable: mtime (grace for mid-write)
      if (stale) {
        await opts.__beforeStaleTakeover?.();
        const claimPath = `${lockPath}.stale-${myToken}-${attempt}`;
        try {
          fs.renameSync(lockPath, claimPath);                 // atomic: one reclaimer wins
          const claimed = JSON.parse(fs.readFileSync(claimPath, 'utf8'));
          if (!claimed || claimed.owner !== info?.owner) {
            // The shared path changed after our stale observation. Restore only
            // with linkSync's no-replace behavior; never rename over a new lock.
            try { fs.linkSync(claimPath, lockPath); fs.unlinkSync(claimPath); } catch { /* quarantine claim; do not unlink/overwrite shared path */ }
            throw new Error('withCheckpointLock: stale takeover identity changed');
          }
          fs.unlinkSync(claimPath);                           // unlink only the file this attempt won
          continue;                                          // next loop creates our O_EXCL lock
        } catch (takeover: any) {
          if (takeover.code !== 'ENOENT' && !String(takeover.message).includes('identity changed')) throw takeover;
        }
      }
      if (attempt++ >= retries) throw new Error(`withCheckpointLock: could not acquire "${checkpointId}" after ${retries} retries`);
      await sleep(delay);
    }
  }
  try { return await fn(); }
  finally {
    const releasePath = `${lockPath}.release-${myToken}`;
    try {
      fs.renameSync(lockPath, releasePath);                   // atomically claim what is currently at lockPath
      const cur = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
      if (cur && cur.owner === myToken) fs.unlinkSync(releasePath);
      else {
        // We atomically claimed a replacement, not ours. Restore without replacing
        // any newer shared lock; remove the claim name only after the shared link exists.
        try { fs.linkSync(releasePath, lockPath); fs.unlinkSync(releasePath); } catch { /* quarantine; do not delete foreign lock */ }
      }
    } catch { /* gone/unparseable/foreign - never blind-unlink lockPath */ }
  }
}
function nowIso(): string { return new Date(Date.now()).toISOString(); }
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
