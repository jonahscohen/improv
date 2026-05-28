"use strict";
// T-0026: lspClientManager - per-language language-server lifecycle.
//
// Responsibilities:
//   - Spawn one language server per language family, ON DEMAND (first use).
//   - LEASE-BASED concurrency: while a request holds a lease the server cannot
//     be idle-evicted out from under it. Eviction only touches zero-lease
//     servers that have been idle past the threshold.
//   - Idle eviction of unused servers (lazy sweep on each acquire - no timer
//     pinning the event loop).
//   - Binary probe per language (cached), mirroring ast_grep's PATH probe, so a
//     missing server returns DOWNSTREAM_UNAVAILABLE instead of crashing.
//   - Graceful teardown of every server on server shutdown.
//
// Every external dependency (subprocess spawn, PATH probe, clock) is injected
// so the whole manager is unit-testable with a fake transport and no real
// language servers installed.
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
exports.LspClientManager = void 0;
exports.probeBinaryOnPath = probeBinaryOnPath;
exports.getSharedLspManager = getSharedLspManager;
exports.setSharedLspManager = setSharedLspManager;
exports.resetSharedLspManager = resetSharedLspManager;
exports.peekSharedLspManager = peekSharedLspManager;
exports.knownLanguages = knownLanguages;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const errors_1 = require("../errors");
const client_1 = require("./client");
const servers_1 = require("./servers");
const DEFAULT_IDLE_MS = 5 * 60 * 1000; // 5 min
/**
 * Scan PATH for an executable named `command`. Cheaper and more uniform than
 * spawning each server with its own `--version` flag (which differ per server).
 */
function probeBinaryOnPath(command) {
    // An absolute/relative path with a separator is checked directly.
    if (command.includes(path.sep)) {
        return fs.existsSync(command)
            ? { ok: true }
            : { ok: false, reason: `${command} does not exist` };
    }
    const pathEnv = process.env.PATH ?? '';
    const dirs = pathEnv.split(path.delimiter).filter(Boolean);
    const exts = process.platform === 'win32'
        ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')
        : [''];
    for (const dir of dirs) {
        for (const ext of exts) {
            const candidate = path.join(dir, command + ext);
            try {
                if (fs.existsSync(candidate))
                    return { ok: true };
            }
            catch {
                // unreadable dir entry - keep scanning
            }
        }
    }
    return { ok: false, reason: `${command} not found on PATH` };
}
class LspClientManager {
    constructor(opts = {}) {
        this.servers = new Map();
        this.probeCache = new Map();
        this.clock = opts.clock ?? Date.now;
        this.idleMs = opts.idleMs ?? DEFAULT_IDLE_MS;
        this.transportFactory =
            opts.transportFactory ??
                ((spec, cwd) => (0, client_1.spawnChildTransport)(spec.command, spec.args, cwd, this.log));
        this.probeFn = opts.probe ?? (async (spec) => probeBinaryOnPath(spec.command));
        this.requestTimeoutMs = opts.requestTimeoutMs;
        this.initTimeoutMs = opts.initTimeoutMs;
        this.shutdownTimeoutMs = opts.shutdownTimeoutMs;
        this.log = opts.log ?? (() => undefined);
    }
    /** Number of currently-pooled servers. Test/diagnostic seam. */
    serverCount() {
        return this.servers.size;
    }
    /** Reset the cached binary probe for a language. Test seam. */
    resetProbeCache() {
        this.probeCache.clear();
    }
    /**
     * Acquire a leased, initialized client for the given spec. While the returned
     * lease is held the server will not be idle-evicted. The caller MUST call
     * release() (in a finally) when done.
     *
     * Throws DOWNSTREAM_UNAVAILABLE if the server binary is missing, or surfaces
     * the init failure (TIMEOUT / transport death) if the handshake fails.
     */
    async acquire(spec, ctx) {
        // Lazy idle sweep: free up dead weight before we (maybe) spawn a new one.
        this.evictIdle();
        const probe = await this.probeForSpec(spec);
        if (!probe.ok) {
            throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', `no language server for ${spec.id}: ${probe.reason ?? 'binary missing'}. ` +
                `Install \`${spec.command}\` and ensure it is on PATH.`, { resource: `lsp:${spec.id}` });
        }
        let managed = this.servers.get(spec.id);
        if (!managed || !managed.client.isAlive()) {
            if (managed && !managed.client.isAlive()) {
                // A dead server lingered in the pool - drop it before respawning.
                this.servers.delete(spec.id);
            }
            managed = this.spawn(spec, ctx.rootUri, ctx.cwd);
            this.servers.set(spec.id, managed);
        }
        // Reserve the lease BEFORE awaiting init so a concurrent eviction can't
        // remove the server while we wait for the handshake.
        managed.leases += 1;
        try {
            await managed.ready;
        }
        catch (err) {
            // Init failed: release our lease, evict the broken server, rethrow.
            managed.leases -= 1;
            this.servers.delete(spec.id);
            try {
                await managed.client.shutdown();
            }
            catch {
                // ignore
            }
            throw err;
        }
        let released = false;
        return {
            client: managed.client,
            release: () => {
                if (released)
                    return;
                released = true;
                const m = this.servers.get(spec.id);
                if (m) {
                    m.leases = Math.max(0, m.leases - 1);
                    m.lastUsedAt = this.clock();
                }
            },
        };
    }
    spawn(spec, rootUri, cwd) {
        const transport = this.transportFactory(spec, cwd);
        const client = new client_1.LspClient(transport, {
            languageId: spec.languageId(spec.extensions[0] ?? ''),
            requestTimeoutMs: this.requestTimeoutMs,
            initTimeoutMs: this.initTimeoutMs,
            shutdownTimeoutMs: this.shutdownTimeoutMs,
            clock: this.clock,
            log: this.log,
        });
        this.log('lsp server spawned', { language: spec.id, command: spec.command });
        const ready = client.initialize(rootUri).then(() => undefined);
        // Avoid an unhandled-rejection if nobody is awaiting ready yet; acquire()
        // always awaits, but the .then() above creates a floating promise.
        ready.catch(() => undefined);
        return { spec, client, leases: 0, lastUsedAt: this.clock(), ready };
    }
    async probeForSpec(spec) {
        const cached = this.probeCache.get(spec.id);
        if (cached)
            return cached;
        const result = await this.probeFn(spec);
        this.probeCache.set(spec.id, result);
        return result;
    }
    /**
     * Evict zero-lease servers idle longer than the threshold. A leased server is
     * never touched - that is the whole point of the lease. Returns the number of
     * servers evicted. Exposed for tests.
     */
    evictIdle() {
        const now = this.clock();
        const toEvict = [];
        for (const [id, m] of this.servers) {
            if (m.leases > 0)
                continue;
            if (!m.client.isAlive()) {
                toEvict.push(id);
                continue;
            }
            if (now - m.lastUsedAt >= this.idleMs)
                toEvict.push(id);
        }
        for (const id of toEvict) {
            const m = this.servers.get(id);
            this.servers.delete(id);
            if (m) {
                this.log('lsp server evicted (idle)', { language: id });
                void m.client.shutdown().catch(() => undefined);
            }
        }
        return toEvict.length;
    }
    /** Graceful teardown of every pooled server. Called on server shutdown. */
    async shutdownAll() {
        const all = Array.from(this.servers.values());
        this.servers.clear();
        await Promise.all(all.map((m) => m.client.shutdown().catch(() => undefined)));
        this.log('lsp manager shutdown complete', { count: all.length });
    }
}
exports.LspClientManager = LspClientManager;
// ---------------------------------------------------------------------------
// Process-wide singleton (mirrors getSharedStore in state-store.ts).
// ---------------------------------------------------------------------------
let SHARED = null;
function getSharedLspManager() {
    if (!SHARED)
        SHARED = new LspClientManager();
    return SHARED;
}
/** Inject a manager (fault-injection tests use a fake transport factory). */
function setSharedLspManager(mgr) {
    SHARED = mgr;
}
/** Drop the singleton so the next getShared rebuilds it. Test seam. */
function resetSharedLspManager() {
    SHARED = null;
}
/** Peek without creating. Used by the shutdown path so we don't spawn on exit. */
function peekSharedLspManager() {
    return SHARED;
}
/** Convenience: all known language families (for docs / introspection). */
function knownLanguages() {
    return servers_1.LANGUAGE_SERVERS.map((s) => s.id);
}
//# sourceMappingURL=index.js.map