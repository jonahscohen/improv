/**
 * FlowHistory
 *
 * Persistent store for tracking flow execution context across a session.
 * Allows flows to access outputs from previously-executed flows and maintain state.
 *
 * Stored at: ~/.claude/sidecoach-flow-history.json
 * Keyed by: SESSION_ID (from environment variable SIDECOACH_SESSION_ID)
 *
 * Structure:
 * {
 *   "session-id": {
 *     "flowSequence": ["flow1", "flow2"],
 *     "flowOutputs": {
 *       "flow1": { ... result ... },
 *       "flow2": { ... result ... }
 *     },
 *     "context": { shared context data },
 *     "timestamp": ISO timestamp
 *   }
 * }
 */
export interface FlowHistoryEntry {
    flowId: string;
    flowName: string;
    timestamp?: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
    guidance?: string[];
    checklist?: any[];
    nextSteps?: string[];
    artifacts?: any[];
    error?: string;
    laneLogicalKey?: string;
    fencingToken?: number;
}
export interface FlowHistoryUpsertOutcome {
    status: 'written' | 'noop' | 'rejected';
}
export interface SessionFlowHistory {
    flowSequence: string[];
    flowOutputs: Record<string, FlowHistoryEntry[]>;
    context: Record<string, any>;
    timestamp: string;
    sessionId: string;
    projectPath?: string;
    laneFencing?: Record<string, number>;
}
export declare class FlowHistory {
    static get HISTORY_FILE(): string;
    private sessionId;
    private history;
    constructor(sessionId: string);
    /**
     * Load history from disk
     */
    private load;
    /**
     * Save history to disk
     */
    private save;
    /**
     * Get or create session history
     */
    private getSessionHistory;
    /**
     * Discard the in-process snapshot and re-read the durable file. Called before every
     * mutation so a long-lived instance (e.g. the orchestrator's recordFlow singleton)
     * cannot overwrite writes made by another instance (e.g. the lane outbox publisher)
     * from a stale construction-time snapshot. Within one process the caller's
     * reloadFromDisk -> mutate -> save block runs synchronously with no interleaving, so
     * it is atomic; cross-process safety remains best-effort for recordFlow (the lane
     * publisher additionally serializes via withCheckpointLock around upsertLaneFlow).
     */
    private reloadFromDisk;
    /**
     * Enforce the lane-fencing invariant in memory: for every session, laneFencing[key]
     * must be >= the highest fencingToken of any retained tagged run for that key. Never
     * lowers an existing entry, so it is idempotent. Called after load() inside
     * reloadFromDisk so that every saving mutation (which reloads, mutates, then saves)
     * durably persists the index BEFORE the 20-run cap can evict the run that justified it.
     * This closes the whole stale-token class: once a tagged run has been observed, its
     * accepted token survives even after the run itself is evicted.
     */
    private backfillLaneFencingFromRuns;
    /**
     * Append one run to its flow's array (cap at 20). The caller is responsible for
     * reloading from disk first and saving afterward, so the whole sequence stays one
     * synchronous reload -> mutate -> save block.
     */
    private appendFlowCore;
    /**
     * Record an ordinary flow execution. Stays SYNCHRONOUS for existing callers.
     * Reloads fresh from disk before mutating so a stale singleton snapshot cannot
     * clobber a concurrently-written lane entry.
     */
    recordFlow(entry: FlowHistoryEntry): void;
    /**
     * Conditionally upsert one committed lane STEP result by logical key and token.
     * New keys append through the normal 20-run cap. Higher tokens replace the
     * accepted tagged run in place. Same tokens no-op and lower tokens reject.
     * Reloads fresh from disk first so the fencing decision and write act on the
     * current durable state, not a stale snapshot.
     */
    upsertLaneFlow(logicalKey: string, fencingToken: number, entry: FlowHistoryEntry, now?: () => string): FlowHistoryUpsertOutcome;
    /**
     * Get the last executed flow
     */
    getLastFlow(): FlowHistoryEntry | null;
    /**
     * Get a specific flow's output by ID (v2: returns latest run for backward compat)
     */
    getFlowOutput(flowId: string): FlowHistoryEntry | null;
    /**
     * Get all executed flows in order (v2: returns latest run for each)
     */
    getFlowSequence(): FlowHistoryEntry[];
    /**
     * Set context data (shared between flows)
     */
    setContext(key: string, value: any): void;
    /**
     * Get context data
     */
    getContext(key: string): any;
    /**
     * Get all context
     */
    getAllContext(): Record<string, any>;
    /**
     * Clear session history (useful for testing or explicit reset)
     */
    clearSession(): void;
    /**
     * Check if a flow has been executed in this session
     */
    hasFlowExecuted(flowId: string): boolean;
    /**
     * Get flow execution count (fixed from v1 - now reads array length)
     */
    getFlowCount(flowId: string): number;
    /**
     * v2: Get all runs for a flow in chronological order
     */
    getFlowRuns(flowId: string): FlowHistoryEntry[];
    /**
     * v2: Get first successful run (baseline for regression detection)
     */
    getBaselineRun(flowId: string): FlowHistoryEntry | null;
    /**
     * v2: Get most recent run (replaces old getFlowOutput for latest)
     */
    getLatestRun(flowId: string): FlowHistoryEntry | null;
}
/**
 * Get or create FlowHistory singleton instance
 * Ensures all callers share the same in-memory state within a process
 * Uses SIDECOACH_SESSION_ID environment variable
 */
export declare function getFlowHistory(): FlowHistory;
/**
 * Reset singleton instance (for testing only)
 */
export declare function resetFlowHistorySingleton(): void;
//# sourceMappingURL=flow-history.d.ts.map