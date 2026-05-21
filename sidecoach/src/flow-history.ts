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

export class FlowHistory {
  private static readonly HISTORY_FILE = path.join(
    process.env.HOME || '~',
    '.claude',
    'sidecoach-flow-history.json'
  );

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
  private save(): void {
    try {
      const dir = path.dirname(FlowHistory.HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = Object.fromEntries(this.history);
      fs.writeFileSync(FlowHistory.HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save flow history:', error);
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
   * Record a flow execution
   */
  recordFlow(entry: FlowHistoryEntry): void {
    const session = this.getSessionHistory();
    const flowId = entry.flowId;

    if (!session.flowSequence.includes(flowId)) {
      session.flowSequence.push(flowId);
    }

    session.flowOutputs[flowId] = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.save();
  }

  /**
   * Get the last executed flow
   */
  getLastFlow(): FlowHistoryEntry | null {
    const session = this.getSessionHistory();
    if (session.flowSequence.length === 0) return null;

    const lastFlowId = session.flowSequence[session.flowSequence.length - 1];
    return session.flowOutputs[lastFlowId] || null;
  }

  /**
   * Get a specific flow's output by ID
   */
  getFlowOutput(flowId: string): FlowHistoryEntry | null {
    const session = this.getSessionHistory();
    return session.flowOutputs[flowId] || null;
  }

  /**
   * Get all executed flows in order
   */
  getFlowSequence(): FlowHistoryEntry[] {
    const session = this.getSessionHistory();
    return session.flowSequence
      .map((flowId) => session.flowOutputs[flowId])
      .filter((f) => f !== undefined) as FlowHistoryEntry[];
  }

  /**
   * Set context data (shared between flows)
   */
  setContext(key: string, value: any): void {
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
   * Get flow execution count (useful for tracking iterations)
   */
  getFlowCount(flowId: string): number {
    const session = this.getSessionHistory();
    return session.flowSequence.filter((id) => id === flowId).length;
  }
}

/**
 * Factory function to create or get FlowHistory instance
 * Uses SIDECOACH_SESSION_ID environment variable
 */
export function getFlowHistory(): FlowHistory {
  const sessionId = process.env.SIDECOACH_SESSION_ID || 'default';
  return new FlowHistory(sessionId);
}
