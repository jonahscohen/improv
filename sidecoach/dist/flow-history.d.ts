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
    artifacts?: any[];
    error?: string;
}
export interface SessionFlowHistory {
    flowSequence: string[];
    flowOutputs: Record<string, FlowHistoryEntry>;
    context: Record<string, any>;
    timestamp: string;
    sessionId: string;
}
export declare class FlowHistory {
    private static readonly HISTORY_FILE;
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
     * Record a flow execution
     */
    recordFlow(entry: FlowHistoryEntry): void;
    /**
     * Get the last executed flow
     */
    getLastFlow(): FlowHistoryEntry | null;
    /**
     * Get a specific flow's output by ID
     */
    getFlowOutput(flowId: string): FlowHistoryEntry | null;
    /**
     * Get all executed flows in order
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
     * Get flow execution count (useful for tracking iterations)
     */
    getFlowCount(flowId: string): number;
}
/**
 * Factory function to create or get FlowHistory instance
 * Uses SIDECOACH_SESSION_ID environment variable
 */
export declare function getFlowHistory(): FlowHistory;
//# sourceMappingURL=flow-history.d.ts.map