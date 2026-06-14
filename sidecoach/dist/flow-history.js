"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowHistory = void 0;
exports.getFlowHistory = getFlowHistory;
exports.resetFlowHistorySingleton = resetFlowHistorySingleton;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FlowHistory {
    static get HISTORY_FILE() {
        return path.join(process.env.HOME || '~', '.claude', 'sidecoach-flow-history.json');
    }
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.history = new Map();
        this.load();
    }
    /**
     * Load history from disk
     */
    load() {
        try {
            if (fs.existsSync(FlowHistory.HISTORY_FILE)) {
                const data = fs.readFileSync(FlowHistory.HISTORY_FILE, 'utf-8');
                const parsed = JSON.parse(data);
                for (const [key, value] of Object.entries(parsed)) {
                    this.history.set(key, value);
                }
            }
        }
        catch (error) {
            // File doesn't exist or is corrupted, start fresh
            this.history.clear();
        }
    }
    /**
     * Save history to disk
     */
    save(throwOnError = false) {
        try {
            const dir = path.dirname(FlowHistory.HISTORY_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const data = Object.fromEntries(this.history);
            const tmp = `${FlowHistory.HISTORY_FILE}.tmp-${process.pid}-${Date.now()}`;
            fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
            fs.renameSync(tmp, FlowHistory.HISTORY_FILE);
        }
        catch (error) {
            console.error('Failed to save flow history:', error);
            if (throwOnError)
                throw error;
        }
    }
    /**
     * Get or create session history
     */
    getSessionHistory() {
        if (!this.history.has(this.sessionId)) {
            this.history.set(this.sessionId, {
                flowSequence: [],
                flowOutputs: {},
                context: {},
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId,
            });
        }
        return this.history.get(this.sessionId);
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
    reloadFromDisk() {
        this.history.clear();
        this.load();
    }
    /**
     * Append one run to its flow's array (cap at 20). The caller is responsible for
     * reloading from disk first and saving afterward, so the whole sequence stays one
     * synchronous reload -> mutate -> save block.
     */
    appendFlowCore(entry, now) {
        const session = this.getSessionHistory();
        const flowId = entry.flowId;
        if (!session.flowSequence.includes(flowId)) {
            session.flowSequence.push(flowId);
        }
        const entryWithTimestamp = {
            ...entry,
            timestamp: now(),
        };
        let runs = [];
        const existing = session.flowOutputs[flowId];
        if (existing && Array.isArray(existing)) {
            runs = existing;
        }
        else if (existing) {
            runs = [existing];
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
    recordFlow(entry) {
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
    upsertLaneFlow(logicalKey, fencingToken, entry, now = () => new Date().toISOString()) {
        this.reloadFromDisk();
        const session = this.getSessionHistory();
        if (!session.laneFencing)
            session.laneFencing = {};
        // Fencing decision comes from the PERSISTENT index, not the capped runs array, so
        // an evicted tagged run cannot let a stale same/lower token slip through as a new key.
        const acceptedToken = session.laneFencing[logicalKey];
        if (acceptedToken !== undefined) {
            if (fencingToken < acceptedToken)
                return { status: 'rejected' };
            if (fencingToken === acceptedToken)
                return { status: 'noop' };
        }
        // Accepted (new key or strictly higher token): record the new highest token first.
        session.laneFencing[logicalKey] = fencingToken;
        // Replace the tagged run in place if it is still retained; otherwise append through
        // the normal 20-run cap. Either way the persistent index above already advanced.
        for (const [flowId, stored] of Object.entries(session.flowOutputs)) {
            const runs = Array.isArray(stored) ? stored : [stored];
            const index = runs.findIndex((run) => run.laneLogicalKey === logicalKey);
            if (index < 0)
                continue;
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
    getLastFlow() {
        const session = this.getSessionHistory();
        if (session.flowSequence.length === 0)
            return null;
        const lastFlowId = session.flowSequence[session.flowSequence.length - 1];
        const runs = session.flowOutputs[lastFlowId];
        if (!runs || !Array.isArray(runs) || runs.length === 0)
            return null;
        return runs[runs.length - 1];
    }
    /**
     * Get a specific flow's output by ID (v2: returns latest run for backward compat)
     */
    getFlowOutput(flowId) {
        return this.getLatestRun(flowId);
    }
    /**
     * Get all executed flows in order (v2: returns latest run for each)
     */
    getFlowSequence() {
        const session = this.getSessionHistory();
        return session.flowSequence
            .map((flowId) => {
            const runs = session.flowOutputs[flowId];
            if (!runs)
                return undefined;
            if (Array.isArray(runs)) {
                return runs.length > 0 ? runs[runs.length - 1] : undefined;
            }
            // Handle v1 migration (single entry)
            return runs;
        })
            .filter((f) => f !== undefined);
    }
    /**
     * Set context data (shared between flows)
     */
    setContext(key, value) {
        const session = this.getSessionHistory();
        session.context[key] = value;
        this.save();
    }
    /**
     * Get context data
     */
    getContext(key) {
        const session = this.getSessionHistory();
        return session.context[key];
    }
    /**
     * Get all context
     */
    getAllContext() {
        const session = this.getSessionHistory();
        return { ...session.context };
    }
    /**
     * Clear session history (useful for testing or explicit reset)
     */
    clearSession() {
        this.history.delete(this.sessionId);
        this.save();
    }
    /**
     * Check if a flow has been executed in this session
     */
    hasFlowExecuted(flowId) {
        const session = this.getSessionHistory();
        return flowId in session.flowOutputs;
    }
    /**
     * Get flow execution count (fixed from v1 - now reads array length)
     */
    getFlowCount(flowId) {
        const session = this.getSessionHistory();
        const runs = session.flowOutputs[flowId];
        if (!runs)
            return 0;
        return Array.isArray(runs) ? runs.length : 1;
    }
    /**
     * v2: Get all runs for a flow in chronological order
     */
    getFlowRuns(flowId) {
        const session = this.getSessionHistory();
        const runs = session.flowOutputs[flowId];
        if (!runs)
            return [];
        return Array.isArray(runs) ? runs : [runs];
    }
    /**
     * v2: Get first successful run (baseline for regression detection)
     */
    getBaselineRun(flowId) {
        const runs = this.getFlowRuns(flowId);
        return runs.find((r) => r.status === 'success') || null;
    }
    /**
     * v2: Get most recent run (replaces old getFlowOutput for latest)
     */
    getLatestRun(flowId) {
        const runs = this.getFlowRuns(flowId);
        return runs.length > 0 ? runs[runs.length - 1] : null;
    }
}
exports.FlowHistory = FlowHistory;
// Module-level singleton instance
let _flowHistoryInstance = null;
/**
 * Get or create FlowHistory singleton instance
 * Ensures all callers share the same in-memory state within a process
 * Uses SIDECOACH_SESSION_ID environment variable
 */
function getFlowHistory() {
    if (!_flowHistoryInstance) {
        const sessionId = process.env.SIDECOACH_SESSION_ID || 'default';
        _flowHistoryInstance = new FlowHistory(sessionId);
    }
    return _flowHistoryInstance;
}
/**
 * Reset singleton instance (for testing only)
 */
function resetFlowHistorySingleton() {
    _flowHistoryInstance = null;
}
//# sourceMappingURL=flow-history.js.map