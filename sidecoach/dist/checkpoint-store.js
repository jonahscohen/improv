"use strict";
// Sidecoach checkpoint persistence. One file per composite RUN under
// <projectPath>/.claude/checkpoints/. Atomic write via tmp + rename.
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
exports.CheckpointStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CheckpointStore {
    constructor(projectPath) {
        this.projectPath = projectPath;
    }
    checkpointsDir() {
        return path.join(this.projectPath, '.claude', 'checkpoints');
    }
    ensureDir() {
        fs.mkdirSync(this.checkpointsDir(), { recursive: true });
    }
    filePath(checkpointId) {
        return path.join(this.checkpointsDir(), `${checkpointId}.json`);
    }
    writeCheckpoint(checkpoint) {
        if (checkpoint.schemaVersion !== 1) {
            throw new Error(`writeCheckpoint: schemaVersion ${checkpoint.schemaVersion} not supported (this build writes schemaVersion 1)`);
        }
        this.ensureDir();
        const target = this.filePath(checkpoint.checkpointId);
        const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmp, JSON.stringify(checkpoint, null, 2));
        fs.renameSync(tmp, target);
    }
    readCheckpoint(checkpointId) {
        const target = this.filePath(checkpointId);
        if (!fs.existsSync(target)) {
            throw new Error(`readCheckpoint: file not found for id "${checkpointId}"`);
        }
        const raw = fs.readFileSync(target, 'utf8');
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch (err) {
            throw new Error(`readCheckpoint: malformed JSON in "${checkpointId}": ${err.message}`);
        }
        if (parsed.schemaVersion !== 1) {
            throw new Error(`readCheckpoint: schemaVersion ${parsed.schemaVersion} not supported (this Sidecoach build supports schemaVersion 1)`);
        }
        return parsed;
    }
    deleteCheckpoint(checkpointId) {
        const target = this.filePath(checkpointId);
        if (fs.existsSync(target)) {
            fs.unlinkSync(target);
        }
    }
    listCheckpoints() {
        const dir = this.checkpointsDir();
        if (!fs.existsSync(dir))
            return [];
        const entries = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
        const summaries = [];
        for (const f of entries) {
            try {
                const raw = fs.readFileSync(path.join(dir, f), 'utf8');
                const parsed = JSON.parse(raw);
                summaries.push({
                    checkpointId: parsed.checkpointId,
                    compositeFlowId: parsed.compositeFlowId,
                    createdAt: parsed.createdAt,
                    cursor: parsed.cursor,
                });
            }
            catch {
                // skip unparseable files
            }
        }
        summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
        return summaries;
    }
    gcOldCheckpoints(maxAgeDays) {
        const dir = this.checkpointsDir();
        if (!fs.existsSync(dir))
            return 0;
        const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        let deleted = 0;
        for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
            const full = path.join(dir, f);
            try {
                const stat = fs.statSync(full);
                if (stat.mtimeMs < cutoffMs) {
                    fs.unlinkSync(full);
                    deleted++;
                }
            }
            catch {
                // skip files we can't stat or delete
            }
        }
        return deleted;
    }
}
exports.CheckpointStore = CheckpointStore;
//# sourceMappingURL=checkpoint-store.js.map