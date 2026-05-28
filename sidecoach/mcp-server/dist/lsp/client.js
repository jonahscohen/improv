"use strict";
// T-0026: stdio LSP JSON-RPC client.
//
// One LspClient drives one language-server subprocess. It owns:
//   - request/response correlation by JSON-RPC id
//   - the initialize -> initialized -> (workspace folder) handshake
//   - text-document lifecycle helpers (didOpen / didClose)
//   - clean shutdown (shutdown request -> exit notification -> force kill)
//   - rejection of every in-flight request when the transport dies
//
// The subprocess is injected as a RawTransport so the entire RPC layer is
// unit-testable without a real language server (see __tests__/unit/lsp-client
// and the fault-injection suite). Production wiring lives in the manager.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LspClient = void 0;
exports.spawnChildTransport = spawnChildTransport;
const child_process_1 = require("child_process");
const errors_1 = require("../errors");
const framing_1 = require("./framing");
const framing_2 = require("./framing");
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_INIT_TIMEOUT_MS = 30000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 4000;
class LspClient {
    constructor(transport, opts) {
        this.framer = new framing_1.LspFramer();
        this.pending = new Map();
        this.nextId = 1;
        this.dead = false;
        this.deadReason = null;
        this.initialized = false;
        this.exitInfo = null;
        this.transport = transport;
        this.opts = {
            languageId: opts.languageId,
            requestTimeoutMs: opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
            initTimeoutMs: opts.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS,
            shutdownTimeoutMs: opts.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS,
            clock: opts.clock ?? Date.now,
            log: opts.log,
        };
        this.transport.onData((chunk) => this.onData(chunk));
        this.transport.onExit((code, signal) => this.onExit(code, signal));
        this.transport.onError((err) => this.onTransportError(err));
    }
    log(msg, ctx) {
        if (this.opts.log)
            this.opts.log(msg, ctx);
    }
    isAlive() {
        return !this.dead;
    }
    isInitialized() {
        return this.initialized;
    }
    // -------------------------------------------------------------------------
    // Inbound frame handling
    // -------------------------------------------------------------------------
    onData(chunk) {
        const frames = this.framer.push(chunk);
        for (const frame of frames) {
            if (frame.error) {
                // Malformed framing/body. Log and keep going - one bad frame must not
                // crash the client or wedge unrelated in-flight requests.
                this.log('lsp framing error', { error: frame.error });
                continue;
            }
            this.dispatch(frame.message);
        }
    }
    dispatch(msg) {
        if (!msg || typeof msg !== 'object')
            return;
        const obj = msg;
        // A response carries an id plus result|error and no method.
        if ('id' in obj && (('result' in obj) || ('error' in obj)) && !('method' in obj)) {
            const id = typeof obj.id === 'number' ? obj.id : Number(obj.id);
            const pending = this.pending.get(id);
            if (!pending) {
                // Response for an unknown/expired id (e.g. one we already timed out).
                // Ignore rather than crash.
                this.log('lsp response for unknown id', { id });
                return;
            }
            this.pending.delete(id);
            clearTimeout(pending.timer);
            if ('error' in obj && obj.error) {
                const e = obj.error;
                pending.reject(new errors_1.SidecoachToolError('VALIDATOR_FAILURE', `LSP ${pending.method} error: ${e.message ?? 'unknown'}`, {
                    validator: 'lsp',
                    errorMessage: `code=${e.code ?? 'n/a'}`,
                }));
            }
            else {
                pending.resolve(obj.result);
            }
            return;
        }
        // A server-to-client REQUEST carries id + method. We must answer or the
        // server may stall. Respond with a null result (we advertise no special
        // capabilities, so requests like workspace/configuration get an empty
        // answer).
        if ('id' in obj && 'method' in obj) {
            this.sendRaw({ jsonrpc: '2.0', id: obj.id, result: null });
            return;
        }
        // Otherwise it's a server notification (window/logMessage, $/progress,
        // publishDiagnostics, ...). Nothing to correlate; ignore.
    }
    // -------------------------------------------------------------------------
    // Lifecycle (transport death)
    // -------------------------------------------------------------------------
    onExit(code, signal) {
        this.exitInfo = { code, signal };
        this.die(`language server exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`);
    }
    onTransportError(err) {
        this.die(`language server transport error: ${err.message}`);
    }
    /** Mark dead and reject every in-flight request. Idempotent. */
    die(reason) {
        if (this.dead)
            return;
        this.dead = true;
        this.deadReason = reason;
        this.log('lsp client dead', { reason, inFlight: this.pending.size });
        for (const [, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', `language server unavailable: ${reason}`, {
                resource: 'lsp',
            }));
        }
        this.pending.clear();
    }
    // -------------------------------------------------------------------------
    // Outbound
    // -------------------------------------------------------------------------
    sendRaw(obj) {
        if (this.dead)
            return;
        try {
            this.transport.write((0, framing_2.encodeMessage)(obj));
        }
        catch (err) {
            this.die(`write failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    /** Send a JSON-RPC notification (no response expected). */
    notify(method, params) {
        this.sendRaw({ jsonrpc: '2.0', method, params });
    }
    /** Send a JSON-RPC request and await its correlated response. */
    request(method, params, timeoutMs) {
        if (this.dead) {
            return Promise.reject(new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', `language server unavailable: ${this.deadReason ?? 'dead'}`, {
                resource: 'lsp',
            }));
        }
        const id = this.nextId++;
        const budget = timeoutMs ?? this.opts.requestTimeoutMs;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new errors_1.SidecoachToolError('TIMEOUT', `LSP ${method} exceeded ${budget}ms`, { timeoutMs: budget }));
            }, budget);
            // NOTE: deliberately NOT unref'd. A pending request must keep the event
            // loop alive until it settles or times out; the timer is cleared the
            // moment the response arrives (dispatch) and die() clears all pending
            // timers on transport death / shutdown, so it can never outlive its
            // request. (unref'ing here let an idle process exit before the timeout
            // fired - benign in production where stdio holds the loop open, but it
            // silently truncated the test runner.)
            this.pending.set(id, { resolve, reject, timer, method });
            this.sendRaw({ jsonrpc: '2.0', id, method, params });
        });
    }
    // -------------------------------------------------------------------------
    // Handshake + document lifecycle
    // -------------------------------------------------------------------------
    /**
     * Run the initialize handshake: initialize request (capability exchange) ->
     * initialized notification -> workspace-folder advertisement (already in the
     * initialize params). Uses the init timeout, not the request timeout.
     */
    async initialize(rootUri) {
        const params = {
            processId: process.pid,
            clientInfo: { name: 'sidecoach-mcp-lsp', version: '0.1.0' },
            rootUri,
            workspaceFolders: [{ uri: rootUri, name: 'sidecoach-project-root' }],
            capabilities: {
                textDocument: {
                    hover: { contentFormat: ['plaintext', 'markdown'] },
                    definition: { linkSupport: true },
                    references: {},
                    documentSymbol: { hierarchicalDocumentSymbolSupport: true },
                },
                workspace: {
                    symbol: {},
                    workspaceFolders: true,
                },
            },
        };
        const result = await this.request('initialize', params, this.opts.initTimeoutMs);
        this.notify('initialized', {});
        this.initialized = true;
        return result;
    }
    /** Notify the server a document is open with its current text. */
    didOpen(uri, text) {
        this.notify('textDocument/didOpen', {
            textDocument: { uri, languageId: this.opts.languageId, version: 1, text },
        });
    }
    /** Notify the server a document is closed. Best-effort cleanup. */
    didClose(uri) {
        this.notify('textDocument/didClose', { textDocument: { uri } });
    }
    /**
     * Graceful shutdown: shutdown request (bounded), then exit notification, then
     * force-kill the subprocess. If the shutdown request hangs past the grace
     * period we force-kill anyway so teardown never blocks.
     */
    async shutdown() {
        if (this.dead) {
            this.transport.kill('SIGKILL');
            return;
        }
        try {
            await this.request('shutdown', undefined, this.opts.shutdownTimeoutMs);
        }
        catch {
            // Timeout or error - fall through to forced kill.
        }
        try {
            this.notify('exit');
        }
        catch {
            // ignore
        }
        // Give the process a beat to exit on its own, then force-kill.
        this.transport.kill('SIGTERM');
        const killTimer = setTimeout(() => this.transport.kill('SIGKILL'), 500);
        if (typeof killTimer.unref === 'function')
            killTimer.unref();
        this.die('shutdown requested');
    }
}
exports.LspClient = LspClient;
// ---------------------------------------------------------------------------
// Production transport: a real child process over stdio.
// ---------------------------------------------------------------------------
/**
 * Spawn a language-server subprocess and adapt it to RawTransport. stdout is
 * the JSON-RPC channel; stderr is drained (and optionally logged) so the OS
 * pipe buffer never fills and blocks the child.
 */
function spawnChildTransport(command, args, cwd, log) {
    const child = (0, child_process_1.spawn)(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    // Drain stderr so the child never blocks on a full pipe.
    child.stderr?.on('data', (buf) => {
        if (log)
            log('lsp server stderr', { bytes: buf.length });
    });
    return {
        write: (data) => {
            child.stdin?.write(data);
        },
        onData: (cb) => {
            child.stdout?.on('data', (buf) => cb(buf));
        },
        onExit: (cb) => {
            child.on('exit', (code, signal) => cb(code, signal));
        },
        onError: (cb) => {
            child.on('error', (err) => cb(err));
        },
        kill: (signal) => {
            try {
                child.kill(signal);
            }
            catch {
                // already dead
            }
        },
    };
}
//# sourceMappingURL=client.js.map