"use strict";
// Server construction + uniform error guard + tool registration.
//
// Kept separate from `index.ts` (the executable entry) so tests can build a
// server instance and connect it to an in-memory transport without spawning a
// subprocess. `index.ts` only adds the stdio transport + signal wiring.
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const errors_1 = require("./errors");
const logger_1 = require("./logger");
const registries_1 = require("./registries");
const tools_1 = require("./tools");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json');
const DEFAULT_TIMEOUT_MS = (() => {
    const raw = process.env.SIDECOACH_MCP_TIMEOUT_MS;
    if (!raw)
        return 30000;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0)
        return n;
    return 30000;
})();
/**
 * Race a handler promise against a timeout. The timeout uses an
 * AbortController so a cooperating handler can short-circuit; for handlers
 * that don't observe the signal, the racing `setTimeout` ensures we still
 * resolve with a TIMEOUT tool error.
 */
async function withTimeout(handler, timeoutMs, controller) {
    let timerId;
    const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
            controller.abort();
            reject(new errors_1.SidecoachToolError('TIMEOUT', `tool exceeded its time budget of ${timeoutMs}ms`, { timeoutMs }));
        }, timeoutMs);
        // Don't keep the event loop alive on the timer alone.
        if (typeof timerId.unref === 'function')
            timerId.unref();
    });
    try {
        return await Promise.race([handler(), timeoutPromise]);
    }
    finally {
        if (timerId !== undefined)
            clearTimeout(timerId);
    }
}
function buildServer(opts = {}) {
    const logger = opts.logger ?? (0, logger_1.createLogger)();
    const registries = opts.registries ?? (0, registries_1.loadAllRegistries)(logger);
    const defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const mcp = new mcp_js_1.McpServer({
        name: pkg.name,
        version: pkg.version,
    });
    const inFlight = new Map();
    function snapshotInputForLog(input) {
        let bytes = 0;
        try {
            bytes = Buffer.byteLength(JSON.stringify(input ?? {}), 'utf8');
        }
        catch {
            bytes = -1;
        }
        return { bytes };
    }
    function wrapHandler(name, timeoutMs, handler) {
        return async (validatedInput) => {
            const requestId = (0, logger_1.newRequestId)();
            const childLogger = logger.child({ requestId, tool: name });
            const controller = new AbortController();
            const tracker = {
                controller,
                requestId,
                tool: name,
                startedAt: Date.now(),
            };
            inFlight.set(requestId, tracker);
            const inputSummary = snapshotInputForLog(validatedInput);
            childLogger.info('tool call start', { inputBytes: inputSummary.bytes });
            try {
                const result = await withTimeout(() => handler(validatedInput, {
                    logger: childLogger,
                    registries,
                }), timeoutMs, controller);
                const duration = Date.now() - tracker.startedAt;
                childLogger.info('tool call complete', { durationMs: duration, isError: false });
                const content = [];
                if (result.summary) {
                    content.push({ type: 'text', text: result.summary });
                }
                content.push({
                    type: 'text',
                    text: JSON.stringify(result.data, null, 2),
                });
                return {
                    content,
                };
            }
            catch (thrown) {
                const duration = Date.now() - tracker.startedAt;
                const toolError = (0, errors_1.thrownToToolError)(thrown, requestId);
                if (toolError.code === 'INTERNAL_ERROR') {
                    // Programmer bug - log full exception at error level.
                    childLogger.exception(thrown, { durationMs: duration, code: toolError.code });
                }
                else {
                    // Known tool error - log at warn with redacted message.
                    childLogger.warn('tool call error', {
                        durationMs: duration,
                        code: toolError.code,
                        errMessage: (0, errors_1.redactErrorMessage)(toolError.message),
                    });
                }
                return (0, errors_1.buildToolError)(toolError);
            }
            finally {
                inFlight.delete(requestId);
            }
        };
    }
    // Register every tool with the SDK.
    for (const tool of tools_1.TOOLS) {
        const wrapped = wrapHandler(tool.definition.name, tool.definition.timeoutMs, tool.handler);
        mcp.registerTool(tool.definition.name, {
            description: tool.definition.description,
            inputSchema: tool.definition.inputSchema,
        }, wrapped);
    }
    logger.info('tools registered', {
        count: tools_1.TOOLS.length,
        names: tools_1.TOOLS.map((t) => t.definition.name),
        defaultTimeoutMs,
    });
    function abortAllInFlight(reason) {
        for (const tracker of inFlight.values()) {
            try {
                tracker.controller.abort();
            }
            catch {
                // ignore - already aborted
            }
        }
        logger.info('in-flight calls aborted', { reason, count: inFlight.size });
    }
    function waitForInFlight(timeoutMs) {
        return new Promise((resolve) => {
            const startedAt = Date.now();
            const tick = () => {
                if (inFlight.size === 0)
                    return resolve(true);
                if (Date.now() - startedAt >= timeoutMs)
                    return resolve(false);
                setTimeout(tick, 25).unref?.();
            };
            tick();
        });
    }
    return {
        mcp,
        logger,
        registries,
        inFlightCount: () => inFlight.size,
        abortAllInFlight,
        waitForInFlight,
        connect: (transport) => mcp.connect(transport),
        close: () => mcp.close(),
    };
}
//# sourceMappingURL=server.js.map