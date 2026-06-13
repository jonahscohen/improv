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
exports.LaneCheckpointStore = void 0;
// sidecoach/src/lane-checkpoint-store.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
function assertId(id) {
    if (!ID_RE.test(id) || id.includes('..'))
        throw new Error(`LaneCheckpointStore: illegal checkpointId "${id}"`);
}
class LaneCheckpointStore {
    constructor(projectPath) {
        // Genuine canonicalization: ensure the root exists, then realpath it so
        // symlinks/.. collapse to one canonical key (cheap boundary protection;
        // lease/fencing/outbox is P3). A truly unusable path throws loudly.
        try {
            fs.mkdirSync(projectPath, { recursive: true });
        }
        catch { /* ignore - realpath will throw if still bad */ }
        this.projectPath = fs.realpathSync(projectPath);
    }
    dir() { return path.join(this.projectPath, '.claude', 'lane-checkpoints'); }
    filePath(id) { assertId(id); return path.join(this.dir(), `${id}.json`); }
    write(cp) {
        if (cp.schemaVersion !== 1)
            throw new Error(`LaneCheckpointStore.write: schemaVersion ${cp.schemaVersion} unsupported`);
        const target = this.filePath(cp.checkpointId);
        fs.mkdirSync(this.dir(), { recursive: true });
        const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmp, JSON.stringify(cp, null, 2));
        fs.renameSync(tmp, target);
    }
    read(id) {
        const target = this.filePath(id);
        if (!fs.existsSync(target))
            throw new Error(`LaneCheckpointStore.read: not found "${id}"`);
        const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
        if (parsed.schemaVersion !== 1)
            throw new Error(`LaneCheckpointStore.read: schemaVersion ${parsed.schemaVersion} unsupported`);
        return parsed;
    }
    exists(id) { try {
        return fs.existsSync(this.filePath(id));
    }
    catch {
        return false;
    } }
    findByStartRequestId(reqId) {
        // Prefer an ACTIVE (in_progress/interrupted) match over a closed one so a
        // closed+active pair sharing an id (closed run + closed-restart) never aliases
        // dedup to the finished run - even on an updatedAt tie where list() order is
        // unstable. Fall back to the most-recent match (list() is updatedAt-desc).
        const matches = this.list().map((s) => this.read(s.checkpointId)).filter((cp) => cp.startRequestId === reqId);
        if (matches.length === 0)
            return null;
        return matches.find((cp) => cp.lifecycle === 'in_progress' || cp.lifecycle === 'interrupted') ?? matches[0];
    }
    list() {
        const dir = this.dir();
        if (!fs.existsSync(dir))
            return [];
        const out = [];
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
            try {
                const cp = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
                out.push({ checkpointId: cp.checkpointId, laneId: cp.laneId, lifecycle: cp.lifecycle, outcome: cp.outcome, cursor: cp.cursor, updatedAt: cp.updatedAt });
            }
            catch { /* skip */ }
        }
        out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
        return out;
    }
    delete(id) { const t = this.filePath(id); if (fs.existsSync(t))
        fs.unlinkSync(t); }
}
exports.LaneCheckpointStore = LaneCheckpointStore;
//# sourceMappingURL=lane-checkpoint-store.js.map