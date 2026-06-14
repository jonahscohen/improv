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
exports.LaneSideEffectSink = void 0;
// sidecoach/src/lane-side-effect-sink.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lane_lock_1 = require("./lane-lock");
class LaneSideEffectSink {
    constructor(projectPath) {
        this.dirPath = path.join(fs.realpathSync(projectPath), '.claude', 'lane-checkpoints');
        this.file = path.join(this.dirPath, 'lane-side-effects.json');
    }
    read() {
        try {
            return JSON.parse(fs.readFileSync(this.file, 'utf8'));
        }
        catch {
            return {};
        }
    }
    get(logicalKey) { return this.read()[logicalKey] ?? null; }
    // Conditional upsert by fencing token (spec lines 687-723): higher token writes;
    // same token is an idempotent no-op; lower token is rejected (stale replay).
    upsertSync(logicalKey, fencingToken, payload, now = () => new Date(Date.now()).toISOString()) {
        fs.mkdirSync(this.dirPath, { recursive: true });
        const map = this.read();
        const cur = map[logicalKey];
        if (cur && fencingToken < cur.fencingToken)
            return { status: 'rejected' };
        if (cur && fencingToken === cur.fencingToken)
            return { status: 'noop' };
        map[logicalKey] = { fencingToken, payload, updatedAt: now() };
        const tmp = `${this.file}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmp, JSON.stringify(map, null, 2));
        fs.renameSync(tmp, this.file);
        return { status: 'written' };
    }
    // lock-guarded variant for concurrent publishers
    async upsert(logicalKey, fencingToken, payload, now) {
        return (0, lane_lock_1.withCheckpointLock)(this.dirPath, 'lane-side-effect-sink', () => this.upsertSync(logicalKey, fencingToken, payload, now));
    }
}
exports.LaneSideEffectSink = LaneSideEffectSink;
//# sourceMappingURL=lane-side-effect-sink.js.map