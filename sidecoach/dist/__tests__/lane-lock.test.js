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
// sidecoach/src/__tests__/lane-lock.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_lock_1 = require("../lane-lock");
async function run() {
    const proj = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-lock-')));
    const dir = path.join(proj, '.claude', 'lane-checkpoints');
    fs.mkdirSync(dir, { recursive: true });
    // 1. mutual exclusion: a second acquire while held fails with retries:0; the body
    //    must NOT run; the lock releases after the body.
    let inner2Ran = false;
    await (0, lane_lock_1.withCheckpointLock)(dir, 'cp1', async () => {
        let threw = false;
        try {
            await (0, lane_lock_1.withCheckpointLock)(dir, 'cp1', async () => { inner2Ran = true; }, { retries: 0 });
        }
        catch {
            threw = true;
        }
        if (!threw)
            throw new Error('second acquire while held must fail with retries:0');
        if (inner2Ran)
            throw new Error('held lock must not let a second body run');
    });
    let ran = false;
    await (0, lane_lock_1.withCheckpointLock)(dir, 'cp1', async () => { ran = true; });
    if (!ran)
        throw new Error('lock must release after body');
    // 2. stale reclaim: a lock with an ancient mtime is reclaimable (a crashed holder).
    const lockDir = `${path.join(dir, 'cp2')}.lock`;
    fs.mkdirSync(lockDir);
    fs.utimesSync(lockDir, new Date(0), new Date(0)); // ancient -> stale
    let acquired = false;
    await (0, lane_lock_1.withCheckpointLock)(dir, 'cp2', async () => { acquired = true; }, { staleMs: 2000 });
    if (!acquired)
        throw new Error('stale lock must be reclaimable');
    // 3. MUTUAL EXCLUSION under 3 concurrent contenders on a LIVE (fresh) lock - the
    //    GUARANTEED property: proper-lockfile's atomic mkdir admits exactly one holder,
    //    the others queue (retry), critical sections never overlap, and all three run.
    //    NOTE: we deliberately do NOT assert strict at-most-one under CONCURRENT STALE
    //    reclaim - that is the documented BEST-EFFORT limitation (mtime-based reclaim has
    //    a tiny residual window); single-reclaimer stale takeover is covered in (2) above.
    const st = { inside: 0, maxInside: 0, entered: 0 };
    let releaseFirst;
    const firstHeld = new Promise((r) => { releaseFirst = r; });
    const body = async () => {
        st.entered++;
        st.inside++;
        st.maxInside = Math.max(st.maxInside, st.inside);
        if (st.entered === 1)
            await firstHeld; // first holder pauses so contenders pile up
        st.inside--;
    };
    const opts = { retries: 300, retryDelayMs: 5 }; // fresh lock (no stale seed) -> pure mkdir mutual exclusion
    const a = (0, lane_lock_1.withCheckpointLock)(dir, 'cp3', body, opts);
    const b = (0, lane_lock_1.withCheckpointLock)(dir, 'cp3', body, opts);
    const c = (0, lane_lock_1.withCheckpointLock)(dir, 'cp3', body, opts);
    a.catch(() => { });
    b.catch(() => { });
    c.catch(() => { });
    while (st.entered === 0)
        await new Promise((r) => setTimeout(r, 1));
    await new Promise((r) => setTimeout(r, 15));
    if (st.entered !== 1 || st.maxInside !== 1)
        throw new Error('only one of three concurrent contenders may hold a live lock at once');
    releaseFirst();
    await Promise.all([a, b, c]);
    if (Number(st.entered) !== 3 || Number(st.maxInside) !== 1)
        throw new Error(`all three must run, never overlapping (entered=${st.entered}, maxInside=${st.maxInside})`);
    console.log('lane-lock: OK');
}
run();
//# sourceMappingURL=lane-lock.test.js.map