#!/usr/bin/env node
"use strict";
// Executable entry point for the sidecoach MCP server.
//
// Section 6 of DESIGN.md describes the lifecycle:
//   1. Read env vars (timeout, log level).
//   2. Build the logger.
//   3. Build the server (loads registries + registers tools).
//   4. Connect StdioServerTransport.
//   5. Steady state: serve tool calls.
//   6. On SIGTERM/SIGINT: abort in-flight, 2s grace, server.close(), exit(0).
//
// This module owns the process. server.ts is testable on its own and does NOT
// touch process state.
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const logger_1 = require("./logger");
const server_1 = require("./server");
async function main() {
    const logger = (0, logger_1.createLogger)();
    logger.info('sidecoach mcp-server booting', {
        pid: process.pid,
        nodeVersion: process.version,
    });
    const built = (0, server_1.buildServer)({ logger });
    const transport = new stdio_js_1.StdioServerTransport();
    let shuttingDown = false;
    const shutdown = async (reason) => {
        if (shuttingDown) {
            // Double-signal: force exit.
            logger.warn('second shutdown signal received - forcing exit', { reason });
            process.exit(1);
        }
        shuttingDown = true;
        logger.info('shutting down', { reason, inFlight: built.inFlightCount() });
        built.abortAllInFlight(reason);
        const settled = await built.waitForInFlight(2000);
        if (!settled) {
            logger.warn('in-flight calls did not settle within 2s - exiting anyway', {
                remaining: built.inFlightCount(),
            });
        }
        try {
            await built.close();
        }
        catch (err) {
            logger.exception(err, { phase: 'close' });
        }
        logger.info('shutdown complete', {});
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    // beforeExit fires when the event loop is about to empty; treat as a
    // graceful exit signal.
    process.on('beforeExit', () => {
        if (!shuttingDown) {
            // No active work, no signal - just clean up.
            void shutdown('beforeExit');
        }
    });
    // Last-resort: log unhandled rejections and uncaught exceptions but DO NOT
    // exit. The MCP server is supposed to survive bug-class errors and keep
    // serving requests; only signals trigger shutdown.
    process.on('unhandledRejection', (reason) => {
        logger.exception(reason, { source: 'unhandledRejection' });
    });
    process.on('uncaughtException', (err) => {
        logger.exception(err, { source: 'uncaughtException' });
    });
    await built.connect(transport);
    logger.info('server ready', { transport: 'stdio' });
}
main().catch((err) => {
    // If main() itself rejects (registry load explosion, SDK construction
    // failure), there's nothing we can do but exit non-zero so the host
    // realizes the server failed to start.
    // eslint-disable-next-line no-console
    process.stderr.write(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        msg: 'fatal startup error',
        err: err instanceof Error ? err.message : String(err),
    }) + '\n');
    process.exit(1);
});
//# sourceMappingURL=index.js.map