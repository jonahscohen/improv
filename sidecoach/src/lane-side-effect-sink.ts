// sidecoach/src/lane-side-effect-sink.ts
import * as fs from 'fs';
import * as path from 'path';
import { withCheckpointLock } from './lane-lock';

interface SinkEntry { fencingToken: number; payload: unknown; updatedAt: string; }
export interface UpsertOutcome { status: 'written' | 'noop' | 'rejected'; }

export class LaneSideEffectSink {
  private dirPath: string;
  private file: string;
  constructor(projectPath: string) {
    this.dirPath = path.join(fs.realpathSync(projectPath), '.claude', 'lane-checkpoints');
    this.file = path.join(this.dirPath, 'lane-side-effects.json');
  }
  private read(): Record<string, SinkEntry> {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return {}; }
  }
  get(logicalKey: string): SinkEntry | null { return this.read()[logicalKey] ?? null; }

  // Conditional upsert by fencing token (spec lines 687-723): higher token writes;
  // same token is an idempotent no-op; lower token is rejected (stale replay).
  upsertSync(logicalKey: string, fencingToken: number, payload: unknown, now: () => string = () => new Date(Date.now()).toISOString()): UpsertOutcome {
    fs.mkdirSync(this.dirPath, { recursive: true });
    const map = this.read();
    const cur = map[logicalKey];
    if (cur && fencingToken < cur.fencingToken) return { status: 'rejected' };
    if (cur && fencingToken === cur.fencingToken) return { status: 'noop' };
    map[logicalKey] = { fencingToken, payload, updatedAt: now() };
    const tmp = `${this.file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(map, null, 2));
    fs.renameSync(tmp, this.file);
    return { status: 'written' };
  }
  // lock-guarded variant for concurrent publishers
  async upsert(logicalKey: string, fencingToken: number, payload: unknown, now?: () => string): Promise<UpsertOutcome> {
    return withCheckpointLock(this.dirPath, 'lane-side-effect-sink', () => this.upsertSync(logicalKey, fencingToken, payload, now));
  }
}
