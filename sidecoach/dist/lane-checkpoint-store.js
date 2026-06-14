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
exports.OUTBOX_PUBLISHERS = exports.LaneCheckpointStore = void 0;
exports.leaseIsLive = leaseIsLive;
exports.claimLease = claimLease;
exports.refreshHeartbeat = refreshHeartbeat;
exports.finalizeLease = finalizeLease;
exports.publishOutbox = publishOutbox;
exports.publishPendingOutbox = publishPendingOutbox;
// sidecoach/src/lane-checkpoint-store.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lane_lock_1 = require("./lane-lock");
const lane_side_effect_sink_1 = require("./lane-side-effect-sink");
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function assertId(id) {
    if (!ID_RE.test(id) || id.includes('..'))
        throw new Error(`LaneCheckpointStore: illegal checkpointId "${id}"`);
}
class LaneCheckpointStore {
    constructor(projectPath) {
        // Genuine canonicalization: ensure the root exists, then realpath it so
        // symlinks/.. collapse to one canonical key (cheap boundary protection;
        // lease/fencing/outbox is P3). A truly unusable path throws loudly.
        try {
            fs.mkdirSync(projectPath, { recursive: true });
        }
        catch { /* ignore - realpath will throw if still bad */ }
        this.projectPath = fs.realpathSync(projectPath);
    }
    dir() { return path.join(this.projectPath, '.claude', 'lane-checkpoints'); } // public: the lock + lease helpers need it
    filePath(id) { assertId(id); return path.join(this.dir(), `${id}.json`); }
    // Read-time migration: v1 -> v2 seeds the durability fields; v2 passes through
    // (tolerating an older v2 missing the latest sub-fields). Any other version throws.
    migrate(raw) {
        if (raw.schemaVersion === 2) {
            return { ...raw, sideEffectOutbox: Array.isArray(raw.sideEffectOutbox) ? raw.sideEffectOutbox : [],
                stepGateStatuses: raw.stepGateStatuses && typeof raw.stepGateStatuses === 'object' ? raw.stepGateStatuses : {} };
        }
        if (raw.schemaVersion === 1) {
            return { ...raw, schemaVersion: 2, fencingCounter: 0, lease: null, sideEffectOutbox: [], stepGateStatuses: {} };
        }
        throw new Error(`LaneCheckpointStore: unsupported schemaVersion ${raw.schemaVersion}`);
    }
    write(cp) {
        if (cp.schemaVersion !== 2)
            throw new Error(`LaneCheckpointStore.write: schemaVersion ${cp.schemaVersion} unsupported (writes 2)`);
        const target = this.filePath(cp.checkpointId);
        fs.mkdirSync(this.dir(), { recursive: true });
        const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmp, JSON.stringify(cp, null, 2));
        fs.renameSync(tmp, target);
    }
    read(id) {
        const target = this.filePath(id);
        if (!fs.existsSync(target))
            throw new Error(`LaneCheckpointStore.read: not found "${id}"`);
        return this.migrate(JSON.parse(fs.readFileSync(target, 'utf8')));
    }
    exists(id) { try {
        return fs.existsSync(this.filePath(id));
    }
    catch {
        return false;
    } }
    findByStartRequestId(reqId) {
        // Prefer an ACTIVE (in_progress/interrupted) match over a closed one so a
        // closed+active pair sharing an id (closed run + closed-restart) never aliases
        // dedup to the finished run - even on an updatedAt tie where list() order is
        // unstable. Fall back to the most-recent match (list() is updatedAt-desc).
        const matches = this.list().map((s) => this.read(s.checkpointId)).filter((cp) => cp.startRequestId === reqId);
        if (matches.length === 0)
            return null;
        return matches.find((cp) => cp.lifecycle === 'in_progress' || cp.lifecycle === 'interrupted') ?? matches[0];
    }
    list() {
        const dir = this.dir();
        if (!fs.existsSync(dir))
            return [];
        const out = [];
        // Skip non-checkpoint json that shares this dir (e.g. the side-effect sink store)
        // by name AND by shape so a sibling file is never mis-read as a checkpoint.
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'lane-side-effects.json')) {
            try {
                const cp = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
                if (typeof cp?.checkpointId !== 'string' || typeof cp?.schemaVersion !== 'number')
                    continue;
                out.push({ checkpointId: cp.checkpointId, laneId: cp.laneId, lifecycle: cp.lifecycle, outcome: cp.outcome, cursor: cp.cursor, updatedAt: cp.updatedAt });
            }
            catch { /* skip */ }
        }
        out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
        return out;
    }
    delete(id) { const t = this.filePath(id); if (fs.existsSync(t))
        fs.unlinkSync(t); }
}
exports.LaneCheckpointStore = LaneCheckpointStore;
// ---------------------------------------------------------------------------
// Operation-lease helpers (P4b-1). CLAIM / heartbeat / FINALIZE all run under the
// O_EXCL checkpoint lock so the read-modify-write is atomic across processes.
// ---------------------------------------------------------------------------
function leaseIsLive(lease, nowMs, staleMs = 30000) {
    if (!lease)
        return false;
    const hb = Date.parse(lease.heartbeatAt);
    if (Number.isNaN(hb)) {
        process.stderr.write('[lane] malformed lease heartbeatAt; treating as not-live (reclaimable)\n');
        return false;
    }
    return (nowMs - hb) <= staleMs;
}
function ownsLease(L, id) {
    return !!L && L.operationId === id.operationId && L.stepId === id.stepId && L.iteration === id.iteration
        && L.claimedCheckpointRevision === id.claimedCheckpointRevision && L.fencingToken === id.fencingToken;
}
async function claimLease(store, checkpointId, o) {
    const now = o.now ?? (() => new Date(Date.now()).toISOString());
    const staleMs = o.staleMs ?? 30000;
    return (0, lane_lock_1.withCheckpointLock)(store.dir(), checkpointId, () => {
        const cp = store.read(checkpointId);
        if (cp.revision !== o.expectedRevision)
            throw new Error(`claimLease: stale expectedRevision ${o.expectedRevision} (current ${cp.revision})`);
        if (leaseIsLive(cp.lease, Date.parse(now()), staleMs))
            throw new Error(`claimLease: a live lease (op ${cp.lease.operationId}) holds this checkpoint`);
        if (cp.lease)
            process.stderr.write(`[lane] reclaiming stale lease op=${cp.lease.operationId} on ${checkpointId}\n`);
        cp.fencingCounter += 1;
        const ts = now();
        cp.lease = { operationId: o.operationId, stepId: o.stepId, iteration: o.iteration, claimedCheckpointRevision: cp.revision, fencingToken: cp.fencingCounter, startedAt: ts, heartbeatAt: ts };
        cp.revision += 1;
        cp.updatedAt = ts;
        store.write(cp);
        return cp;
    });
}
// Update ONLY heartbeatAt under the lock; verify ownership; do NOT touch revision/fencing.
async function refreshHeartbeat(store, checkpointId, id, now) {
    const clock = now ?? (() => new Date(Date.now()).toISOString());
    return (0, lane_lock_1.withCheckpointLock)(store.dir(), checkpointId, () => {
        const cp = store.read(checkpointId);
        if (!ownsLease(cp.lease, id))
            throw new Error(`refreshHeartbeat: lease ownership lost (current op ${cp.lease?.operationId ?? 'none'})`);
        cp.lease.heartbeatAt = clock();
        store.write(cp);
        return cp;
    });
}
// Bump revision BEFORE mutate so the committed revision is available to the outbox key.
async function finalizeLease(store, checkpointId, id, mutate, now) {
    const clock = now ?? (() => new Date(Date.now()).toISOString());
    return (0, lane_lock_1.withCheckpointLock)(store.dir(), checkpointId, () => {
        const cp = store.read(checkpointId);
        if (!ownsLease(cp.lease, id))
            throw new Error(`finalizeLease: lease identity mismatch (current op ${cp.lease?.operationId ?? 'none'}, fencing ${cp.lease?.fencingToken ?? 'n/a'})`);
        cp.revision += 1;
        cp.updatedAt = clock();
        mutate(cp, cp.revision);
        cp.lease = null;
        store.write(cp);
        return cp;
    });
}
// ---------------------------------------------------------------------------
// Side-effect outbox publish (P4b-1). Drains each committed outbox record's pending
// publishers idempotently (the sink is fencing-token-conditional), then removes the
// acked record under the checkpoint lock WITHOUT bumping the semantic revision
// (spec lines 691-693). AT-MOST-ONE-COMMITTED-TRANSITION: replay is idempotent.
// ---------------------------------------------------------------------------
exports.OUTBOX_PUBLISHERS = ['lane-side-effect-sink'];
async function publishOutbox(store, checkpointId, projectPath, now) {
    const clock = now ?? (() => new Date(Date.now()).toISOString());
    const sink = new lane_side_effect_sink_1.LaneSideEffectSink(projectPath);
    // snapshot the records to publish (read outside the checkpoint lock; publishing is idempotent)
    const snapshot = store.read(checkpointId).sideEffectOutbox;
    for (const record of snapshot) {
        // Publish to the sink publisher if it is still pending. A 'rejected' upsert (a higher
        // token already won) is still DELIVERED for ack purposes. Other declared publishers
        // (e.g. P4f's FlowHistory) are NOT handled here and must stay pending.
        const acked = [];
        if (record.pendingPublishers.includes('lane-side-effect-sink')) {
            for (const entry of record.entries) {
                if (entry.publisher !== 'lane-side-effect-sink')
                    continue;
                await sink.upsert(entry.logicalKey, record.fencingToken, entry.payload, clock); // written | noop | rejected all = delivered
            }
            acked.push('lane-side-effect-sink');
        }
        if (acked.length === 0)
            continue;
        // ack publishers INDIVIDUALLY under the checkpoint lock; delete the record ONLY when
        // no publisher remains pending. Does NOT bump the semantic revision.
        await (0, lane_lock_1.withCheckpointLock)(store.dir(), checkpointId, () => {
            const cp = store.read(checkpointId);
            const rec = cp.sideEffectOutbox.find((x) => x.committedRevision === record.committedRevision && x.fencingToken === record.fencingToken);
            if (!rec)
                return;
            rec.pendingPublishers = rec.pendingPublishers.filter((p) => !acked.includes(p));
            if (rec.pendingPublishers.length === 0) {
                cp.sideEffectOutbox = cp.sideEffectOutbox.filter((x) => x !== rec);
            }
            cp.updatedAt = clock();
            store.write(cp);
        });
    }
}
// Startup/advance-time recovery: replay every checkpoint that still has pending outbox
// records (a process that crashed after FINALIZE but before publish). A failed replay
// is logged and left pending; it never corrupts or acks the record.
async function publishPendingOutbox(store, projectPath, now) {
    for (const summary of store.list()) {
        let cp;
        try {
            cp = store.read(summary.checkpointId);
        }
        catch {
            continue;
        }
        if (!cp.sideEffectOutbox || cp.sideEffectOutbox.length === 0)
            continue;
        try {
            await publishOutbox(store, summary.checkpointId, projectPath, now);
        }
        catch (e) {
            process.stderr.write(`[lane] outbox replay failed for ${summary.checkpointId}: ${String(e)}\n`);
        }
    }
}
//# sourceMappingURL=lane-checkpoint-store.js.map