"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLockCompromiseHandler = setLockCompromiseHandler;
exports.withCheckpointLock = withCheckpointLock;
// sidecoach/src/lane-lock.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lockfile = __importStar(require("proper-lockfile"));
const LOCK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
// proper-lockfile enforces a >= 2000ms minimum stale window. This is the FILE-LOCK
// abandonment window only; the LEASE durability layer keeps its own staleMs (leaseIsLive)
// which can be much smaller and is unaffected by this floor.
const LOCK_STALE_FLOOR_MS = 2000;
// Global compromise handler: a compromised checkpoint lock signals the lane runner to
// abort any in-flight operation on that checkpoint (wired to LIVE_OPERATIONS). Held as a
// module-level hook to avoid a lane-lock -> lane-runner import cycle.
let compromiseHandler = null;
function setLockCompromiseHandler(fn) {
    compromiseHandler = fn;
}
// Cross-process checkpoint lock delegated to the vetted `proper-lockfile` library: an
// atomic mkdir lockfile with mtime-based staleness and a safe stale-reclaim CAS. The
// hand-rolled rename-takeover could not get the reclaim race right (a delayed reclaimer
// could rename away a newer live owner's lock); proper-lockfile does. The lease / CLAIM /
// FINALIZE / fencing protocol sits ON TOP of this lock, unchanged. Signature is identical
// to the prior implementation so every caller keeps working.
async function withCheckpointLock(dir, checkpointId, fn, opts = {}) {
    if (!LOCK_ID_RE.test(checkpointId) || checkpointId.includes('..'))
        throw new Error(`withCheckpointLock: illegal checkpointId "${checkpointId}"`);
    const retries = opts.retries ?? 50;
    const delay = opts.retryDelayMs ?? 20;
    const stale = Math.max(opts.staleMs ?? 30000, LOCK_STALE_FLOOR_MS);
    fs.mkdirSync(dir, { recursive: true });
    const resource = path.join(dir, checkpointId); // virtual resource; realpath:false -> need not exist
    const lockfilePath = `${resource}.lock`;
    const release = await lockfile.lock(resource, {
        realpath: false,
        stale,
        lockfilePath,
        retries: { retries, factor: 1, minTimeout: delay, maxTimeout: delay },
        onCompromised: (err) => {
            try {
                opts.onCompromised?.(err);
            }
            catch { /* ignore hook error */ }
            try {
                compromiseHandler?.(checkpointId, err);
            }
            catch { /* ignore handler error */ }
            process.stderr.write(`[lane] checkpoint lock compromised for ${checkpointId}: ${err.message}\n`);
        },
    });
    try {
        return await fn();
    }
    finally {
        // release() can reject if the lock was already reclaimed/compromised - safe to ignore.
        try {
            await release();
        }
        catch { /* already released/compromised */ }
    }
}
//# sourceMappingURL=lane-lock.js.map