import * as fs from 'fs';
import * as path from 'path';
import { FlowHistory, FlowHistoryEntry, FlowHistoryUpsertOutcome } from './flow-history';
import { withCheckpointLock } from './lane-lock';

export class LaneFlowHistoryPublisher {
  private readonly sessionId: string;
  private readonly lockDir: string;

  constructor(projectPath: string) {
    this.sessionId = fs.realpathSync(projectPath);
    this.lockDir = path.dirname(FlowHistory.HISTORY_FILE);
  }

  upsertSync(
    logicalKey: string,
    fencingToken: number,
    payload: FlowHistoryEntry,
    now?: () => string,
  ): FlowHistoryUpsertOutcome {
    const history = new FlowHistory(this.sessionId);
    return history.upsertLaneFlow(logicalKey, fencingToken, payload, now);
  }

  async upsert(
    logicalKey: string,
    fencingToken: number,
    payload: FlowHistoryEntry,
    now?: () => string,
  ): Promise<FlowHistoryUpsertOutcome> {
    return withCheckpointLock(
      this.lockDir,
      'flow-history',
      () => this.upsertSync(logicalKey, fencingToken, payload, now),
    );
  }
}
