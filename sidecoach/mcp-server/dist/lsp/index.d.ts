import { LspClient, type Clock, type RawTransport } from './client';
import { type LanguageServerSpec } from './servers';
export type { LanguageServerSpec } from './servers';
/** Result of a binary-presence probe. */
export interface ProbeResult {
    ok: boolean;
    reason?: string;
}
export interface ManagerOptions {
    /** Build a raw transport for a spec. Default spawns a child process. */
    transportFactory?: (spec: LanguageServerSpec, cwd: string) => RawTransport;
    /** Probe whether a spec's binary is available. Default scans PATH. */
    probe?: (spec: LanguageServerSpec) => Promise<ProbeResult>;
    clock?: Clock;
    /** Idle threshold (ms) after which a zero-lease server is evicted. */
    idleMs?: number;
    requestTimeoutMs?: number;
    initTimeoutMs?: number;
    shutdownTimeoutMs?: number;
    log?: (msg: string, ctx?: Record<string, unknown>) => void;
}
/** A held lease. Caller MUST release() in a finally block. */
export interface Lease {
    client: LspClient;
    release: () => void;
}
/**
 * Scan PATH for an executable named `command`. Cheaper and more uniform than
 * spawning each server with its own `--version` flag (which differ per server).
 */
export declare function probeBinaryOnPath(command: string): ProbeResult;
export declare class LspClientManager {
    private readonly servers;
    private readonly probeCache;
    private readonly clock;
    private readonly idleMs;
    private readonly transportFactory;
    private readonly probeFn;
    private readonly requestTimeoutMs?;
    private readonly initTimeoutMs?;
    private readonly shutdownTimeoutMs?;
    private readonly log;
    constructor(opts?: ManagerOptions);
    /** Number of currently-pooled servers. Test/diagnostic seam. */
    serverCount(): number;
    /** Reset the cached binary probe for a language. Test seam. */
    resetProbeCache(): void;
    /**
     * Acquire a leased, initialized client for the given spec. While the returned
     * lease is held the server will not be idle-evicted. The caller MUST call
     * release() (in a finally) when done.
     *
     * Throws DOWNSTREAM_UNAVAILABLE if the server binary is missing, or surfaces
     * the init failure (TIMEOUT / transport death) if the handshake fails.
     */
    acquire(spec: LanguageServerSpec, ctx: {
        rootUri: string;
        cwd: string;
    }): Promise<Lease>;
    private spawn;
    private probeForSpec;
    /**
     * Evict zero-lease servers idle longer than the threshold. A leased server is
     * never touched - that is the whole point of the lease. Returns the number of
     * servers evicted. Exposed for tests.
     */
    evictIdle(): number;
    /** Graceful teardown of every pooled server. Called on server shutdown. */
    shutdownAll(): Promise<void>;
}
export declare function getSharedLspManager(): LspClientManager;
/** Inject a manager (fault-injection tests use a fake transport factory). */
export declare function setSharedLspManager(mgr: LspClientManager): void;
/** Drop the singleton so the next getShared rebuilds it. Test seam. */
export declare function resetSharedLspManager(): void;
/** Peek without creating. Used by the shutdown path so we don't spawn on exit. */
export declare function peekSharedLspManager(): LspClientManager | null;
/** Convenience: all known language families (for docs / introspection). */
export declare function knownLanguages(): string[];
//# sourceMappingURL=index.d.ts.map