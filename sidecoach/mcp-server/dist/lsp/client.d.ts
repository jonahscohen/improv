/**
 * Minimal raw byte transport. The client layers framing on top - the transport
 * only moves bytes and reports lifecycle events.
 */
export interface RawTransport {
    write(data: Buffer): void;
    onData(cb: (chunk: Buffer) => void): void;
    onExit(cb: (code: number | null, signal: NodeJS.Signals | null) => void): void;
    onError(cb: (err: Error) => void): void;
    kill(signal?: NodeJS.Signals): void;
}
/** Wall-clock seam so eviction/timeout tests are deterministic. */
export type Clock = () => number;
export interface LspClientOptions {
    /** LSP languageId announced for opened documents. */
    languageId: string;
    /** Per-request timeout (hover/definition/etc.). */
    requestTimeoutMs?: number;
    /** initialize-handshake timeout. Separate from requestTimeoutMs because
     *  cold server start can be much slower than a steady-state request. */
    initTimeoutMs?: number;
    /** Grace period for a clean shutdown before force-killing the subprocess. */
    shutdownTimeoutMs?: number;
    clock?: Clock;
    /** Optional structured logger (byte counts only, never bodies). */
    log?: (msg: string, ctx?: Record<string, unknown>) => void;
}
export declare class LspClient {
    private readonly transport;
    private readonly framer;
    private readonly pending;
    private readonly opts;
    private nextId;
    private dead;
    private deadReason;
    private initialized;
    private exitInfo;
    constructor(transport: RawTransport, opts: LspClientOptions);
    private log;
    isAlive(): boolean;
    isInitialized(): boolean;
    private onData;
    private dispatch;
    private onExit;
    private onTransportError;
    /** Mark dead and reject every in-flight request. Idempotent. */
    private die;
    private sendRaw;
    /** Send a JSON-RPC notification (no response expected). */
    notify(method: string, params?: unknown): void;
    /** Send a JSON-RPC request and await its correlated response. */
    request(method: string, params?: unknown, timeoutMs?: number): Promise<unknown>;
    /**
     * Run the initialize handshake: initialize request (capability exchange) ->
     * initialized notification -> workspace-folder advertisement (already in the
     * initialize params). Uses the init timeout, not the request timeout.
     */
    initialize(rootUri: string): Promise<unknown>;
    /** Notify the server a document is open with its current text. */
    didOpen(uri: string, text: string): void;
    /** Notify the server a document is closed. Best-effort cleanup. */
    didClose(uri: string): void;
    /**
     * Graceful shutdown: shutdown request (bounded), then exit notification, then
     * force-kill the subprocess. If the shutdown request hangs past the grace
     * period we force-kill anyway so teardown never blocks.
     */
    shutdown(): Promise<void>;
}
/**
 * Spawn a language-server subprocess and adapt it to RawTransport. stdout is
 * the JSON-RPC channel; stderr is drained (and optionally logged) so the OS
 * pipe buffer never fills and blocks the child.
 */
export declare function spawnChildTransport(command: string, args: string[], cwd: string, log?: (msg: string, ctx?: Record<string, unknown>) => void): RawTransport;
//# sourceMappingURL=client.d.ts.map