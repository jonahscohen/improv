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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FlowHistory {
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
    save() {
        try {
            const dir = path.dirname(FlowHistory.HISTORY_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const data = Object.fromEntries(this.history);
            fs.writeFileSync(FlowHistory.HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Failed to save flow history:', error);
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
     * Record a flow execution
     */
    recordFlow(entry) {
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
    getLastFlow() {
        const session = this.getSessionHistory();
        if (session.flowSequence.length === 0)
            return null;
        const lastFlowId = session.flowSequence[session.flowSequence.length - 1];
        return session.flowOutputs[lastFlowId] || null;
    }
    /**
     * Get a specific flow's output by ID
     */
    getFlowOutput(flowId) {
        const session = this.getSessionHistory();
        return session.flowOutputs[flowId] || null;
    }
    /**
     * Get all executed flows in order
     */
    getFlowSequence() {
        const session = this.getSessionHistory();
        return session.flowSequence
            .map((flowId) => session.flowOutputs[flowId])
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
     * Get flow execution count (useful for tracking iterations)
     */
    getFlowCount(flowId) {
        const session = this.getSessionHistory();
        return session.flowSequence.filter((id) => id === flowId).length;
    }
}
exports.FlowHistory = FlowHistory;
FlowHistory.HISTORY_FILE = path.join(process.env.HOME || '~', '.claude', 'sidecoach-flow-history.json');
/**
 * Factory function to create or get FlowHistory instance
 * Uses SIDECOACH_SESSION_ID environment variable
 */
function getFlowHistory() {
    const sessionId = process.env.SIDECOACH_SESSION_ID || 'default';
    return new FlowHistory(sessionId);
}
//# sourceMappingURL=flow-history.js.map