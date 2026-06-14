import * as fs from 'fs';
import * as path from 'path';

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
  timestamp?: string; // Optional - recordFlow() sets this automatically
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
  flowOutputs: Record<string, FlowHistoryEntry[]>; // v2: array of runs per flow
  context: Record<string, any>;
  timestamp: string;
  sessionId: string;
  projectPath?: string; // v2: track by project for cross-session regression
  // P4f: logicalKey -> highest accepted lane fencing token. Persisted SEPARATELY from
  // flowOutputs so the fencing decision survives the 20-run presentation cap (a tagged
  // run can be evicted, but a stale same/lower-token replay must still no-op/reject).
  laneFencing?: Record<string, number>;
}

export class FlowHistory {
  static get HISTORY_FILE(): string {
    return path.join(
      process.env.HOME || '~',
      '.claude',
      'sidecoach-flow-history.json'
    );
  }

  private sessionId: string;
  private history: Map<string, SessionFlowHistory>;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.history = new Map();
    this.load();
  }

  /**
   * Load history from disk
   */
  private load(): void {
    try {
      if (fs.existsSync(FlowHistory.HISTORY_FILE)) {
        const data = fs.readFileSync(FlowHistory.HISTORY_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        for (const [key, value] of Object.entries(parsed)) {
          this.history.set(key, value as SessionFlowHistory);
        }
      }
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      this.history.clear();
    }
  }

  /**
   * Save history to disk
   */
  private save(throwOnError = false): void {
    try {
      const dir = path.dirname(FlowHistory.HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = Object.fromEntries(this.history);
      const tmp = `${FlowHistory.HISTORY_FILE}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmp, FlowHistory.HISTORY_FILE);
    } catch (error) {
      console.error('Failed to save flow history:', error);
      if (throwOnError) throw error;
    }
  }

  /**
   * Get or create session history
   */
  private getSessionHistory(): SessionFlowHistory {
    if (!this.history.has(this.sessionId)) {
      this.history.set(this.sessionId, {
        flowSequence: [],
        flowOutputs: {},
        context: {},
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
      });
    }
    return this.history.get(this.sessionId)!;
  }

  /**
   * Discard the in-process snapshot and re-read the durable file. Called before every
   * mutation so a long-lived instance (e.g. the orchestrator's recordFlow singleton)
   * cannot overwrite writes made by another instance (e.g. the lane outbox publisher)
   * from a stale construction-time snapshot. Within one process the caller's
   * reloadFromDisk -> mutate -> save block runs synchronously with no interleaving, so
   * it is atomic; cross-process safety remains best-effort for recordFlow (the lane
   * publisher additionally serializes via withCheckpointLock around upsertLaneFlow).
   */
  private reloadFromDisk(): void {
    this.history.clear();
    this.load();
  }

  /**
   * Append one run to its flow's array (cap at 20). The caller is responsible for
   * reloading from disk first and saving afterward, so the whole sequence stays one
   * synchronous reload -> mutate -> save block.
   */
  private appendFlowCore(entry: FlowHistoryEntry, now: () => string): void {
    const session = this.getSessionHistory();
    const flowId = entry.flowId;

    if (!session.flowSequence.includes(flowId)) {
      session.flowSequence.push(flowId);
    }

    const entryWithTimestamp: FlowHistoryEntry = {
      ...entry,
      timestamp: now(),
    };

    let runs: FlowHistoryEntry[] = [];
    const existing: any = session.flowOutputs[flowId];

    if (existing && Array.isArray(existing)) {
      runs = existing;
    } else if (existing) {
      runs = [existing as FlowHistoryEntry];
    }

    if (runs.length >= 20) {
      runs.shift();
    }
    runs.push(entryWithTimestamp);
    session.flowOutputs[flowId] = runs;
  }

  /**
   * Record an ordinary flow execution. Stays SYNCHRONOUS for existing callers.
   * Reloads fresh from disk before mutating so a stale singleton snapshot cannot
   * clobber a concurrently-written lane entry.
   */
  recordFlow(entry: FlowHistoryEntry): void {
    this.reloadFromDisk();
    this.appendFlowCore(entry, () => new Date().toISOString());
    this.save(false);
  }

  /**
   * Conditionally upsert one committed lane STEP result by logical key and token.
   * New keys append through the normal 20-run cap. Higher tokens replace the
   * accepted tagged run in place. Same tokens no-op and lower tokens reject.
   * Reloads fresh from disk first so the fencing decision and write act on the
   * current durable state, not a stale snapshot.
   */
  upsertLaneFlow(
    logicalKey: string,
    fencingToken: number,
    entry: FlowHistoryEntry,
    now: () => string = () => new Date().toISOString(),
  ): FlowHistoryUpsertOutcome {
    this.reloadFromDisk();
    const session = this.getSessionHistory();
    if (!session.laneFencing) session.laneFencing = {};

    // Migration: data written before the index existed has a retained tagged run but no
    // laneFencing entry. Derive the accepted token from that run first, so a stale
    // same/lower token cannot be mistaken for a brand-new key and blindly overwrite it.
    if (session.laneFencing[logicalKey] === undefined) {
      for (const stored of Object.values(session.flowOutputs)) {
        const runs = Array.isArray(stored) ? stored : [stored as FlowHistoryEntry];
        const retained = runs.find(
          (run) => run.laneLogicalKey === logicalKey && typeof run.fencingToken === 'number',
        );
        if (retained && typeof retained.fencingToken === 'number') {
          session.laneFencing[logicalKey] = retained.fencingToken;
          break;
        }
      }
    }

    // Fencing decision comes from the PERSISTENT index, not the capped runs array, so
    // an evicted tagged run cannot let a stale same/lower token slip through as a new key.
    const acceptedToken = session.laneFencing[logicalKey];
    if (acceptedToken !== undefined) {
      if (fencingToken < acceptedToken) return { status: 'rejected' };
      if (fencingToken === acceptedToken) return { status: 'noop' };
    }

    // Accepted (new key or strictly higher token): record the new highest token first.
    session.laneFencing[logicalKey] = fencingToken;

    // Replace the tagged run in place if it is still retained; otherwise append through
    // the normal 20-run cap. Either way the persistent index above already advanced.
    for (const [flowId, stored] of Object.entries(session.flowOutputs)) {
      const runs = Array.isArray(stored) ? stored : [stored as FlowHistoryEntry];
      const index = runs.findIndex((run) => run.laneLogicalKey === logicalKey);
      if (index < 0) continue;

      runs[index] = {
        ...entry,
        flowId,
        laneLogicalKey: logicalKey,
        fencingToken,
        timestamp: now(),
      };
      session.flowOutputs[flowId] = runs;
      this.save(true);
      return { status: 'written' };
    }

    this.appendFlowCore({ ...entry, laneLogicalKey: logicalKey, fencingToken }, now);
    this.save(true);
    return { status: 'written' };
  }

  /**
   * Get the last executed flow
   */
  getLastFlow(): FlowHistoryEntry | null {
    const session = this.getSessionHistory();
    if (session.flowSequence.length === 0) return null;

    const lastFlowId = session.flowSequence[session.flowSequence.length - 1];
    const runs = session.flowOutputs[lastFlowId];
    if (!runs || !Array.isArray(runs) || runs.length === 0) return null;
    return runs[runs.length - 1];
  }

  /**
   * Get a specific flow's output by ID (v2: returns latest run for backward compat)
   */
  getFlowOutput(flowId: string): FlowHistoryEntry | null {
    return this.getLatestRun(flowId);
  }

  /**
   * Get all executed flows in order (v2: returns latest run for each)
   */
  getFlowSequence(): FlowHistoryEntry[] {
    const session = this.getSessionHistory();
    return session.flowSequence
      .map((flowId) => {
        const runs = session.flowOutputs[flowId];
        if (!runs) return undefined;
        if (Array.isArray(runs)) {
          return runs.length > 0 ? runs[runs.length - 1] : undefined;
        }
        // Handle v1 migration (single entry)
        return runs as FlowHistoryEntry;
      })
      .filter((f) => f !== undefined) as FlowHistoryEntry[];
  }

  /**
   * Set context data (shared between flows)
   */
  setContext(key: string, value: any): void {
    this.reloadFromDisk();
    const session = this.getSessionHistory();
    session.context[key] = value;
    this.save();
  }

  /**
   * Get context data
   */
  getContext(key: string): any {
    const session = this.getSessionHistory();
    return session.context[key];
  }

  /**
   * Get all context
   */
  getAllContext(): Record<string, any> {
    const session = this.getSessionHistory();
    return { ...session.context };
  }

  /**
   * Clear session history (useful for testing or explicit reset)
   */
  clearSession(): void {
    this.reloadFromDisk();
    this.history.delete(this.sessionId);
    this.save();
  }

  /**
   * Check if a flow has been executed in this session
   */
  hasFlowExecuted(flowId: string): boolean {
    const session = this.getSessionHistory();
    return flowId in session.flowOutputs;
  }

  /**
   * Get flow execution count (fixed from v1 - now reads array length)
   */
  getFlowCount(flowId: string): number {
    const session = this.getSessionHistory();
    const runs = session.flowOutputs[flowId];
    if (!runs) return 0;
    return Array.isArray(runs) ? runs.length : 1;
  }

  /**
   * v2: Get all runs for a flow in chronological order
   */
  getFlowRuns(flowId: string): FlowHistoryEntry[] {
    const session = this.getSessionHistory();
    const runs = session.flowOutputs[flowId];
    if (!runs) return [];
    return Array.isArray(runs) ? runs : [runs as FlowHistoryEntry];
  }

  /**
   * v2: Get first successful run (baseline for regression detection)
   */
  getBaselineRun(flowId: string): FlowHistoryEntry | null {
    const runs = this.getFlowRuns(flowId);
    return runs.find((r) => r.status === 'success') || null;
  }

  /**
   * v2: Get most recent run (replaces old getFlowOutput for latest)
   */
  getLatestRun(flowId: string): FlowHistoryEntry | null {
    const runs = this.getFlowRuns(flowId);
    return runs.length > 0 ? runs[runs.length - 1] : null;
  }
}

// Module-level singleton instance
let _flowHistoryInstance: FlowHistory | null = null;

/**
 * Get or create FlowHistory singleton instance
 * Ensures all callers share the same in-memory state within a process
 * Uses SIDECOACH_SESSION_ID environment variable
 */
export function getFlowHistory(): FlowHistory {
  if (!_flowHistoryInstance) {
    const sessionId = process.env.SIDECOACH_SESSION_ID || 'default';
    _flowHistoryInstance = new FlowHistory(sessionId);
  }
  return _flowHistoryInstance;
}

/**
 * Reset singleton instance (for testing only)
 */
export function resetFlowHistorySingleton(): void {
  _flowHistoryInstance = null;
}
