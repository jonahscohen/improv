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
exports.LaneFlowHistoryPublisher = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const flow_history_1 = require("./flow-history");
const lane_lock_1 = require("./lane-lock");
class LaneFlowHistoryPublisher {
    constructor(projectPath) {
        this.sessionId = fs.realpathSync(projectPath);
        this.lockDir = path.dirname(flow_history_1.FlowHistory.HISTORY_FILE);
    }
    upsertSync(logicalKey, fencingToken, payload, now) {
        const history = new flow_history_1.FlowHistory(this.sessionId);
        return history.upsertLaneFlow(logicalKey, fencingToken, payload, now);
    }
    async upsert(logicalKey, fencingToken, payload, now) {
        return (0, lane_lock_1.withCheckpointLock)(this.lockDir, 'flow-history', () => this.upsertSync(logicalKey, fencingToken, payload, now));
    }
}
exports.LaneFlowHistoryPublisher = LaneFlowHistoryPublisher;
//# sourceMappingURL=lane-flow-history-publisher.js.map