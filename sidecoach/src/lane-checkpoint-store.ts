// sidecoach/src/lane-checkpoint-store.ts
import * as fs from 'fs';
import * as path from 'path';
import type { FlowId } from './types';
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry } from './lane-types';

export interface LaneCheckpoint {
  schemaVersion: 1;
  checkpointId: string; laneId: string; target: string;
  executionKind: 'sequence' | 'loop';
  lifecycle: LaneLifecycle; outcome?: LaneOutcome;
  cursor: number; iteration: number;
  completedStepIds: string[]; skippedStepIds: string[]; completedFlowIds: FlowId[];
  stepReports: StepReport[]; audit: LaneAuditEntry[];
  servedSteps: Record<string, { guidance: string[]; checklist: { id: string; label: string; required: boolean; completed: boolean }[]; flowIds: FlowId[]; successfulFlowIds: FlowId[] }>; // key: `${cursor}:${iteration}`; successfulFlowIds = flows whose handler returned status 'success' (NOT degraded/skipped/errored)
  revision: number; startRequestId: string; seenReportIds: string[];
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
  private dir(): string { return path.join(this.projectPath, '.claude', 'lane-checkpoints'); }
  private filePath(id: string): string { assertId(id); return path.join(this.dir(), `${id}.json`); }

  write(cp: LaneCheckpoint): void {
    if (cp.schemaVersion !== 1) throw new Error(`LaneCheckpointStore.write: schemaVersion ${cp.schemaVersion} unsupported`);
    const target = this.filePath(cp.checkpointId);
    fs.mkdirSync(this.dir(), { recursive: true });
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(cp, null, 2));
    fs.renameSync(tmp, target);
  }
  read(id: string): LaneCheckpoint {
    const target = this.filePath(id);
    if (!fs.existsSync(target)) throw new Error(`LaneCheckpointStore.read: not found "${id}"`);
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as LaneCheckpoint;
    if (parsed.schemaVersion !== 1) throw new Error(`LaneCheckpointStore.read: schemaVersion ${parsed.schemaVersion} unsupported`);
    return parsed;
  }
  exists(id: string): boolean { try { return fs.existsSync(this.filePath(id)); } catch { return false; } }
  findByStartRequestId(reqId: string): LaneCheckpoint | null {
    for (const s of this.list()) { const cp = this.read(s.checkpointId); if (cp.startRequestId === reqId) return cp; }
    return null;
  }
  list(): LaneCheckpointSummary[] {
    const dir = this.dir();
    if (!fs.existsSync(dir)) return [];
    const out: LaneCheckpointSummary[] = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      try { const cp = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as LaneCheckpoint;
        out.push({ checkpointId: cp.checkpointId, laneId: cp.laneId, lifecycle: cp.lifecycle, outcome: cp.outcome, cursor: cp.cursor, updatedAt: cp.updatedAt });
      } catch { /* skip */ }
    }
    out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return out;
  }
  delete(id: string): void { const t = this.filePath(id); if (fs.existsSync(t)) fs.unlinkSync(t); }
}
