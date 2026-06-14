// sidecoach/src/lane-checkpoint-store.ts
import * as fs from 'fs';
import * as path from 'path';
import type { FlowId } from './types';
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry, LeaseRecord, SideEffectOutboxRecord, PersistedStepGateStatus, ConvergenceState } from './lane-types';
import { withCheckpointLock } from './lane-lock';
import { LaneSideEffectSink } from './lane-side-effect-sink';

export interface LaneCheckpoint {
  schemaVersion: 2;
  checkpointId: string; laneId: string; target: string;
  executionKind: 'sequence' | 'loop';
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  cursor: number; iteration: number;
  completedStepIds: string[]; skippedStepIds: string[]; completedFlowIds: FlowId[];
  stepReports: StepReport[]; audit: LaneAuditEntry[];
  servedSteps: Record<string, { guidance: string[]; checklist: { id: string; label: string; required: boolean; completed: boolean }[]; flowIds: FlowId[]; successfulFlowIds: FlowId[]; flowOutcomes: { flowId: FlowId; status: 'success' | 'needs_input' | 'error' | 'skipped'; message: string }[] }>; // key: `${cursor}:${iteration}`; successfulFlowIds = flows whose handler returned status 'success' (NOT degraded/skipped/errored); flowOutcomes = every served flow's actual outcome (P4c truthful advisory qualification)
  revision: number; startRequestId: string; seenReportIds: string[];
  // P4b-1 durability (schema v2): fencing counter (monotonic), the active operation
  // lease (null when idle), the side-effect outbox (committed-but-unpublished
  // records), and the latest finalized gate status per current step attempt.
  fencingCounter: number;
  lease: LeaseRecord | null;
  sideEffectOutbox: SideEffectOutboxRecord[];
  stepGateStatuses: Record<string, PersistedStepGateStatus>; // key: `${stepId}:${iteration}`
  // P4c: loop convergence sub-state. Present only on loop lanes; undefined for
  // sequence lanes. Additive optional field - schema stays v2, migrate() passes it
  // through unchanged via the existing `...raw` spread.
  convergence?: ConvergenceState;
  createdAt: string; updatedAt: string;
}

export interface LaneCheckpointSummary { checkpointId: string; laneId: string; lifecycle: LaneLifecycle; outcome?: LaneOutcome; cursor: number; updatedAt: string; }

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function assertId(id: string): void {
  if (!ID_RE.test(id) || id.includes('..')) throw new Error(`LaneCheckpointStore: illegal checkpointId "${id}"`);
}

export class LaneCheckpointStore {
  private projectPath: string;
  constructor(projectPath: string) {
    // Genuine canonicalization: ensure the root exists, then realpath it so
    // symlinks/.. collapse to one canonical key (cheap boundary protection;
    // lease/fencing/outbox is P3). A truly unusable path throws loudly.
    try { fs.mkdirSync(projectPath, { recursive: true }); } catch { /* ignore - realpath will throw if still bad */ }
    this.projectPath = fs.realpathSync(projectPath);
  }
  dir(): string { return path.join(this.projectPath, '.claude', 'lane-checkpoints'); }   // public: the lock + lease helpers need it
  private filePath(id: string): string { assertId(id); return path.join(this.dir(), `${id}.json`); }

  // Read-time migration: v1 -> v2 seeds the durability fields; v2 passes through
  // (tolerating an older v2 missing the latest sub-fields). Any other version throws.
  private migrate(raw: any): LaneCheckpoint {
    if (raw.schemaVersion === 2) {
      return { ...raw, sideEffectOutbox: Array.isArray(raw.sideEffectOutbox) ? raw.sideEffectOutbox : [],
        stepGateStatuses: raw.stepGateStatuses && typeof raw.stepGateStatuses === 'object' ? raw.stepGateStatuses : {} } as LaneCheckpoint;
    }
    if (raw.schemaVersion === 1) {
      return { ...raw, schemaVersion: 2, fencingCounter: 0, lease: null, sideEffectOutbox: [], stepGateStatuses: {} } as LaneCheckpoint;
    }
    throw new Error(`LaneCheckpointStore: unsupported schemaVersion ${raw.schemaVersion}`);
  }

  write(cp: LaneCheckpoint): void {
    if (cp.schemaVersion !== 2) throw new Error(`LaneCheckpointStore.write: schemaVersion ${cp.schemaVersion} unsupported (writes 2)`);
    const target = this.filePath(cp.checkpointId);
    fs.mkdirSync(this.dir(), { recursive: true });
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(cp, null, 2));
    fs.renameSync(tmp, target);
  }
  read(id: string): LaneCheckpoint {
    const target = this.filePath(id);
    if (!fs.existsSync(target)) throw new Error(`LaneCheckpointStore.read: not found "${id}"`);
    return this.migrate(JSON.parse(fs.readFileSync(target, 'utf8')));
  }
  exists(id: string): boolean { try { return fs.existsSync(this.filePath(id)); } catch { return false; } }
  findByStartRequestId(reqId: string): LaneCheckpoint | null {
    // Prefer an ACTIVE (in_progress/interrupted) match over a closed one so a
    // closed+active pair sharing an id (closed run + closed-restart) never aliases
    // dedup to the finished run - even on an updatedAt tie where list() order is
    // unstable. Fall back to the most-recent match (list() is updatedAt-desc).
    const matches = this.list().map((s) => this.read(s.checkpointId)).filter((cp) => cp.startRequestId === reqId);
    if (matches.length === 0) return null;
    return matches.find((cp) => cp.lifecycle === 'in_progress' || cp.lifecycle === 'interrupted') ?? matches[0];
  }
  list(): LaneCheckpointSummary[] {
    const dir = this.dir();
    if (!fs.existsSync(dir)) return [];
    const out: LaneCheckpointSummary[] = [];
    // Skip non-checkpoint json that shares this dir (e.g. the side-effect sink store)
    // by name AND by shape so a sibling file is never mis-read as a checkpoint.
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'lane-side-effects.json')) {
      try { const cp = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LaneCheckpoint;
        if (typeof cp?.checkpointId !== 'string' || typeof cp?.schemaVersion !== 'number') continue;
        out.push({ checkpointId: cp.checkpointId, laneId: cp.laneId, lifecycle: cp.lifecycle, outcome: cp.outcome, cursor: cp.cursor, updatedAt: cp.updatedAt });
      } catch { /* skip */ }
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return out;
  }
  delete(id: string): void { const t = this.filePath(id); if (fs.existsSync(t)) fs.unlinkSync(t); }
}

// ---------------------------------------------------------------------------
// Operation-lease helpers (P4b-1). CLAIM / heartbeat / FINALIZE all run under the
// O_EXCL checkpoint lock so the read-modify-write is atomic across processes.
// ---------------------------------------------------------------------------

export function leaseIsLive(lease: LeaseRecord | null, nowMs: number, staleMs = 30000): boolean {
  if (!lease) return false;
  const hb = Date.parse(lease.heartbeatAt);
  if (Number.isNaN(hb)) { process.stderr.write('[lane] malformed lease heartbeatAt; treating as not-live (reclaimable)\n'); return false; }
  return (nowMs - hb) <= staleMs;
}

// The FULL identity FINALIZE/heartbeat must match (spec line 709-712).
export type LeaseIdentity = Pick<LeaseRecord, 'operationId' | 'stepId' | 'iteration' | 'claimedCheckpointRevision' | 'fencingToken'>;
function ownsLease(L: LeaseRecord | null, id: LeaseIdentity): boolean {
  return !!L && L.operationId === id.operationId && L.stepId === id.stepId && L.iteration === id.iteration
    && L.claimedCheckpointRevision === id.claimedCheckpointRevision && L.fencingToken === id.fencingToken;
}

export interface ClaimOpts { expectedRevision: number; stepId: string; iteration: number; operationId: string; now?: () => string; staleMs?: number; }

export async function claimLease(store: LaneCheckpointStore, checkpointId: string, o: ClaimOpts): Promise<LaneCheckpoint> {
  const now = o.now ?? (() => new Date(Date.now()).toISOString());
  const staleMs = o.staleMs ?? 30000;
  return withCheckpointLock(store.dir(), checkpointId, () => {
    const cp = store.read(checkpointId);
    if (cp.revision !== o.expectedRevision) throw new Error(`claimLease: stale expectedRevision ${o.expectedRevision} (current ${cp.revision})`);
    if (leaseIsLive(cp.lease, Date.parse(now()), staleMs)) throw new Error(`claimLease: a live lease (op ${cp.lease!.operationId}) holds this checkpoint`);
    if (cp.lease) process.stderr.write(`[lane] reclaiming stale lease op=${cp.lease.operationId} on ${checkpointId}\n`);
    cp.fencingCounter += 1;
    const ts = now();
    cp.lease = { operationId: o.operationId, stepId: o.stepId, iteration: o.iteration, claimedCheckpointRevision: cp.revision, fencingToken: cp.fencingCounter, startedAt: ts, heartbeatAt: ts };
    cp.revision += 1; cp.updatedAt = ts;
    store.write(cp);
    return cp;
  });
}

// Update ONLY heartbeatAt under the lock; verify ownership; do NOT touch revision/fencing.
export async function refreshHeartbeat(store: LaneCheckpointStore, checkpointId: string, id: LeaseIdentity, now?: () => string): Promise<LaneCheckpoint> {
  const clock = now ?? (() => new Date(Date.now()).toISOString());
  return withCheckpointLock(store.dir(), checkpointId, () => {
    const cp = store.read(checkpointId);
    if (!ownsLease(cp.lease, id)) throw new Error(`refreshHeartbeat: lease ownership lost (current op ${cp.lease?.operationId ?? 'none'})`);
    cp.lease!.heartbeatAt = clock();
    store.write(cp);
    return cp;
  });
}

// Bump revision BEFORE mutate so the committed revision is available to the outbox key.
export async function finalizeLease(store: LaneCheckpointStore, checkpointId: string, id: LeaseIdentity, mutate: (cp: LaneCheckpoint, committedRevision: number) => void, now?: () => string): Promise<LaneCheckpoint> {
  const clock = now ?? (() => new Date(Date.now()).toISOString());
  return withCheckpointLock(store.dir(), checkpointId, () => {
    const cp = store.read(checkpointId);
    if (!ownsLease(cp.lease, id)) throw new Error(`finalizeLease: lease identity mismatch (current op ${cp.lease?.operationId ?? 'none'}, fencing ${cp.lease?.fencingToken ?? 'n/a'})`);
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

export const OUTBOX_PUBLISHERS = ['lane-side-effect-sink'] as const;

export async function publishOutbox(store: LaneCheckpointStore, checkpointId: string, projectPath: string, now?: () => string): Promise<void> {
  const clock = now ?? (() => new Date(Date.now()).toISOString());
  const sink = new LaneSideEffectSink(projectPath);
  // snapshot the records to publish (read outside the checkpoint lock; publishing is idempotent)
  const snapshot = store.read(checkpointId).sideEffectOutbox;
  for (const record of snapshot) {
    // Publish to the sink publisher if it is still pending. A 'rejected' upsert (a higher
    // token already won) is still DELIVERED for ack purposes. Other declared publishers
    // (e.g. P4f's FlowHistory) are NOT handled here and must stay pending.
    const acked: string[] = [];
    if (record.pendingPublishers.includes('lane-side-effect-sink')) {
      for (const entry of record.entries) {
        if (entry.publisher !== 'lane-side-effect-sink') continue;
        await sink.upsert(entry.logicalKey, record.fencingToken, entry.payload, clock); // written | noop | rejected all = delivered
      }
      acked.push('lane-side-effect-sink');
    }
    if (acked.length === 0) continue;
    // ack publishers INDIVIDUALLY under the checkpoint lock; delete the record ONLY when
    // no publisher remains pending. Does NOT bump the semantic revision.
    await withCheckpointLock(store.dir(), checkpointId, () => {
      const cp = store.read(checkpointId);
      const rec = cp.sideEffectOutbox.find((x) => x.committedRevision === record.committedRevision && x.fencingToken === record.fencingToken);
      if (!rec) return;
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
export async function publishPendingOutbox(store: LaneCheckpointStore, projectPath: string, now?: () => string): Promise<void> {
  for (const summary of store.list()) {
    let cp: LaneCheckpoint;
    try { cp = store.read(summary.checkpointId); } catch { continue; }
    if (!cp.sideEffectOutbox || cp.sideEffectOutbox.length === 0) continue;
    try { await publishOutbox(store, summary.checkpointId, projectPath, now); }
    catch (e) { process.stderr.write(`[lane] outbox replay failed for ${summary.checkpointId}: ${String(e)}\n`); }
  }
}
