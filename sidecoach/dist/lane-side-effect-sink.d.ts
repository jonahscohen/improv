interface SinkEntry {
    fencingToken: number;
    payload: unknown;
    updatedAt: string;
}
export interface UpsertOutcome {
    status: 'written' | 'noop' | 'rejected';
}
export declare class LaneSideEffectSink {
    private dirPath;
    private file;
    constructor(projectPath: string);
    private read;
    get(logicalKey: string): SinkEntry | null;
    upsertSync(logicalKey: string, fencingToken: number, payload: unknown, now?: () => string): UpsertOutcome;
    upsert(logicalKey: string, fencingToken: number, payload: unknown, now?: () => string): Promise<UpsertOutcome>;
}
export {};
//# sourceMappingURL=lane-side-effect-sink.d.ts.map