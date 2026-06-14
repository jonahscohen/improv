export interface LockOpts {
    retries?: number;
    retryDelayMs?: number;
    staleMs?: number;
    ownerToken?: string;
    __beforeStaleTakeover?: () => Promise<void>;
}
export declare function withCheckpointLock<T>(dir: string, checkpointId: string, fn: () => Promise<T> | T, opts?: LockOpts): Promise<T>;
//# sourceMappingURL=lane-lock.d.ts.map