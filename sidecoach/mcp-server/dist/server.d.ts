import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { type Logger } from './logger';
import { type RegistryBundle } from './registries';
export interface BuildServerOptions {
    /** Optional logger override (tests use an in-memory writer). */
    logger?: Logger;
    /** Optional registries override (fault-injection tests stub registries). */
    registries?: RegistryBundle;
    /** Optional per-build timeout override (tests force a tiny timeout). */
    defaultTimeoutMs?: number;
}
export interface BuiltServer {
    mcp: McpServer;
    logger: Logger;
    registries: RegistryBundle;
    /** Number of currently in-flight tool calls. */
    inFlightCount: () => number;
    /** Abort every in-flight call (used during shutdown). */
    abortAllInFlight: (reason: string) => void;
    /** Promise that resolves when all in-flight calls settle. */
    waitForInFlight: (timeoutMs: number) => Promise<boolean>;
    /** Connect to a transport. Thin wrapper around mcp.connect(). */
    connect: (transport: Transport) => Promise<void>;
    /** Close the server cleanly. */
    close: () => Promise<void>;
}
export declare function buildServer(opts?: BuildServerOptions): BuiltServer;
//# sourceMappingURL=server.d.ts.map