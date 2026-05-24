// Sidecoach checkpoint persistence. One file per composite RUN under
// <projectPath>/.claude/checkpoints/. Atomic write via tmp + rename.

import * as fs from 'fs';
import * as path from 'path';
import type { FlowId } from './types';
import type { FlowExecutionContext, FlowExecutionResult } from './flow-handler';

export interface SidecoachCheckpoint {
  schemaVersion: 1;
  checkpointId: string;
  compositeFlowId: FlowId;
  createdAt: string;
  cursor: number;
  completedStepIds: FlowId[];
  flowResults: FlowExecutionResult[];
  executionContext: FlowExecutionContext;
  utterance: string;
}

export interface CheckpointSummary {
  checkpointId: string;
  compositeFlowId: FlowId;
  createdAt: string;
  cursor: number;
}

export class CheckpointStore {
  constructor(private projectPath: string) {}

  private checkpointsDir(): string {
    return path.join(this.projectPath, '.claude', 'checkpoints');
  }

  private ensureDir(): void {
    fs.mkdirSync(this.checkpointsDir(), { recursive: true });
  }

  private filePath(checkpointId: string): string {
    return path.join(this.checkpointsDir(), `${checkpointId}.json`);
  }

  writeCheckpoint(checkpoint: SidecoachCheckpoint): void {
    if (checkpoint.schemaVersion !== 1) {
      throw new Error(`writeCheckpoint: schemaVersion ${checkpoint.schemaVersion} not supported (this build writes schemaVersion 1)`);
    }
    this.ensureDir();
    const target = this.filePath(checkpoint.checkpointId);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(checkpoint, null, 2));
    fs.renameSync(tmp, target);
  }

  readCheckpoint(checkpointId: string): SidecoachCheckpoint {
    const target = this.filePath(checkpointId);
    if (!fs.existsSync(target)) {
      throw new Error(`readCheckpoint: file not found for id "${checkpointId}"`);
    }
    const raw = fs.readFileSync(target, 'utf8');
    let parsed: SidecoachCheckpoint;
    try {
      parsed = JSON.parse(raw) as SidecoachCheckpoint;
    } catch (err) {
      throw new Error(`readCheckpoint: malformed JSON in "${checkpointId}": ${(err as Error).message}`);
    }
    if (parsed.schemaVersion !== 1) {
      throw new Error(`readCheckpoint: schemaVersion ${parsed.schemaVersion} not supported (this Sidecoach build supports schemaVersion 1)`);
    }
    return parsed;
  }

  deleteCheckpoint(checkpointId: string): void {
    const target = this.filePath(checkpointId);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  }

  listCheckpoints(): CheckpointSummary[] {
    const dir = this.checkpointsDir();
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    const summaries: CheckpointSummary[] = [];
    for (const f of entries) {
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        const parsed = JSON.parse(raw) as SidecoachCheckpoint;
        summaries.push({
          checkpointId: parsed.checkpointId,
          compositeFlowId: parsed.compositeFlowId,
          createdAt: parsed.createdAt,
          cursor: parsed.cursor,
        });
      } catch {
        // skip unparseable files
      }
    }
    summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return summaries;
  }

  gcOldCheckpoints(maxAgeDays: number): number {
    const dir = this.checkpointsDir();
    if (!fs.existsSync(dir)) return 0;
    const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const full = path.join(dir, f);
      try {
        const stat = fs.statSync(full);
        if (stat.mtimeMs < cutoffMs) {
          fs.unlinkSync(full);
          deleted++;
        }
      } catch {
        // skip files we can't stat or delete
      }
    }
    return deleted;
  }
}
