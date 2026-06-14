// sidecoach/src/lane-lock.ts
import * as fs from 'fs';
import * as path from 'path';
import * as lockfile from 'proper-lockfile';

export interface LockOpts {
  retries?: number;
  retryDelayMs?: number;
  staleMs?: number;
  ownerToken?: string;                            // legacy no-op (proper-lockfile manages identity internally)
  onCompromised?: (err: Error) => void;           // per-call compromise hook
  __beforeStaleTakeover?: () => Promise<void>;    // legacy seam, kept for signature compat (no-op under proper-lockfile)
}

const LOCK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// proper-lockfile enforces a >= 2000ms minimum stale window. This is the FILE-LOCK
// abandonment window only; the LEASE durability layer keeps its own staleMs (leaseIsLive)
// which can be much smaller and is unaffected by this floor.
const LOCK_STALE_FLOOR_MS = 2000;

// Global compromise handler: a compromised checkpoint lock signals the lane runner to
// abort any in-flight operation on that checkpoint (wired to LIVE_OPERATIONS). Held as a
// module-level hook to avoid a lane-lock -> lane-runner import cycle.
let compromiseHandler: ((checkpointId: string, err: Error) => void) | null = null;
export function setLockCompromiseHandler(fn: ((checkpointId: string, err: Error) => void) | null): void {
  compromiseHandler = fn;
}

// Cross-process checkpoint lock delegated to the vetted `proper-lockfile` library: an
// atomic mkdir lockfile with mtime-based staleness and a safe stale-reclaim CAS. The
// hand-rolled rename-takeover could not get the reclaim race right (a delayed reclaimer
// could rename away a newer live owner's lock); proper-lockfile does. The lease / CLAIM /
// FINALIZE / fencing protocol sits ON TOP of this lock, unchanged. Signature is identical
// to the prior implementation so every caller keeps working.
//
// DOCUMENTED LIMITATION - BEST-EFFORT cross-process lock (accepted for this single-user
// tool). proper-lockfile + the lease/fencing/onCompromised layer make the residual
// stale-reclaim window tiny and fully safe within a single process. We do NOT, however,
// guarantee strict at-most-one-committed under ADVERSARIAL multi-process concurrent
// stale-reclaim (e.g. three OS processes all reclaiming the same stale lockfile at the
// instant it crosses the stale threshold): proper-lockfile's reclaim is mtime-based, not
// an OS-kernel mutual-exclusion primitive, so a pathological window remains. This is an
// accepted limitation - the tool runs single-user, and the lease fencing token still
// fences the COMMIT identity in practice. If multi-process execution ever matters, an OS
// flock(2)-based lock (or an advisory-locked lockfile) could close the residual window;
// it is intentionally deferred to avoid a native dependency here.
export async function withCheckpointLock<T>(
  dir: string, checkpointId: string, fn: () => Promise<T> | T, opts: LockOpts = {},
): Promise<T> {
  if (!LOCK_ID_RE.test(checkpointId) || checkpointId.includes('..')) throw new Error(`withCheckpointLock: illegal checkpointId "${checkpointId}"`);
  const retries = opts.retries ?? 50;
  const delay = opts.retryDelayMs ?? 20;
  const stale = Math.max(opts.staleMs ?? 30000, LOCK_STALE_FLOOR_MS);
  fs.mkdirSync(dir, { recursive: true });
  const resource = path.join(dir, checkpointId);     // virtual resource; realpath:false -> need not exist
  const lockfilePath = `${resource}.lock`;
  const release = await lockfile.lock(resource, {
    realpath: false,
    stale,
    lockfilePath,
    retries: { retries, factor: 1, minTimeout: delay, maxTimeout: delay },
    onCompromised: (err: Error) => {
      try { opts.onCompromised?.(err); } catch { /* ignore hook error */ }
      try { compromiseHandler?.(checkpointId, err); } catch { /* ignore handler error */ }
      process.stderr.write(`[lane] checkpoint lock compromised for ${checkpointId}: ${err.message}\n`);
    },
  });
  try {
    return await fn();
  } finally {
    // release() can reject if the lock was already reclaimed/compromised - safe to ignore.
    try { await release(); } catch { /* already released/compromised */ }
  }
}
