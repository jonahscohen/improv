import { FlowHistoryEntry, FlowHistoryUpsertOutcome } from './flow-history';
export declare class LaneFlowHistoryPublisher {
    private readonly sessionId;
    private readonly lockDir;
    constructor(projectPath: string);
    upsertSync(logicalKey: string, fencingToken: number, payload: FlowHistoryEntry, now?: () => string): FlowHistoryUpsertOutcome;
    upsert(logicalKey: string, fencingToken: number, payload: FlowHistoryEntry, now?: () => string): Promise<FlowHistoryUpsertOutcome>;
}
//# sourceMappingURL=lane-flow-history-publisher.d.ts.map