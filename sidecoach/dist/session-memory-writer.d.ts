/**
 * SessionMemoryWriter
 *
 * Writes accumulated flow history to persistent session memory files.
 * Location: ~/.claude/projects/<project-path>/memory/session_YYYY-MM-DD_sidecoach.md
 *
 * Called at session end or explicitly to create a permanent record of:
 * - All flows executed
 * - Design decisions made at each step
 * - Rules applied, metrics measured, validations passed
 * - References consulted, artifacts produced
 */
export declare class SessionMemoryWriter {
    private projectPath;
    private memoryDir;
    constructor(projectPath?: string);
    /**
     * Write session flow history to permanent memory file
     * Returns the path of the written file
     */
    writeSessionMemory(): string;
    /**
     * Build the markdown content for session memory
     */
    private buildSessionMemory;
    /**
     * Format flow with full memory schema
     */
    private formatFlowMemory;
    /**
     * Format flow with basic schema (fallback)
     */
    private formatFlowBasic;
    /**
     * Update MEMORY.md index to point to new session file
     */
    private updateMemoryIndex;
}
/**
 * Write session memory at session end
 * Call this from the orchestrator or CLI tool
 */
export declare function persistSessionMemory(projectPath?: string): string;
//# sourceMappingURL=session-memory-writer.d.ts.map