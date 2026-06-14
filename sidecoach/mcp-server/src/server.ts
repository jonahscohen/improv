// Server construction + uniform error guard + tool registration.
//
// Kept separate from `index.ts` (the executable entry) so tests can build a
// server instance and connect it to an in-memory transport without spawning a
// subprocess. `index.ts` only adds the stdio transport + signal wiring.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import {
  SidecoachToolError,
  buildToolError,
  redactErrorMessage,
  thrownToToolError,
  type ToolError,
} from './errors';
import { createLogger, newRequestId, type Logger } from './logger';
import { loadAllRegistries, type RegistryBundle } from './registries';
import { TOOLS } from './tools';
import type { ToolHandler } from './tools/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { name: string; version: string };

const DEFAULT_TIMEOUT_MS = (() => {
  const raw = process.env.SIDECOACH_MCP_TIMEOUT_MS;
  if (!raw) return 30_000;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return 30_000;
})();

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

interface InFlight {
  controller: AbortController;
  requestId: string;
  tool: string;
  startedAt: number;
}

/**
 * Race a handler promise against a timeout. The timeout uses an
 * AbortController so a cooperating handler can short-circuit; for handlers
 * that don't observe the signal, the racing `setTimeout` ensures we still
 * resolve with a TIMEOUT tool error.
 */
async function withTimeout<T>(
  handler: () => Promise<T>,
  timeoutMs: number,
  controller: AbortController,
): Promise<T> {
  let timerId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      controller.abort();
      reject(
        new SidecoachToolError(
          'TIMEOUT',
          `tool exceeded its time budget of ${timeoutMs}ms`,
          { timeoutMs },
        ),
      );
    }, timeoutMs);
    // Don't keep the event loop alive on the timer alone.
    if (typeof timerId.unref === 'function') timerId.unref();
  });
  try {
    return await Promise.race([handler(), timeoutPromise]);
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
}

export function buildServer(opts: BuildServerOptions = {}): BuiltServer {
  const logger = opts.logger ?? createLogger();
  const registries = opts.registries ?? loadAllRegistries(logger);
  const defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  const mcp = new McpServer({
    name: pkg.name,
    version: pkg.version,
  });

  const inFlight = new Map<string, InFlight>();

  function snapshotInputForLog(input: unknown): { bytes: number } {
    let bytes = 0;
    try {
      bytes = Buffer.byteLength(JSON.stringify(input ?? {}), 'utf8');
    } catch {
      bytes = -1;
    }
    return { bytes };
  }

  function wrapHandler(name: string, timeoutMs: number, handler: ToolHandler<any>) {
    return async (validatedInput: unknown) => {
      const requestId = newRequestId();
      const childLogger = logger.child({ requestId, tool: name });
      const controller = new AbortController();
      const tracker: InFlight = {
        controller,
        requestId,
        tool: name,
        startedAt: Date.now(),
      };
      inFlight.set(requestId, tracker);

      const inputSummary = snapshotInputForLog(validatedInput);
      childLogger.info('tool call start', { inputBytes: inputSummary.bytes });

      try {
        const result = await withTimeout(
          () =>
            handler(validatedInput, {
              logger: childLogger,
              registries,
              signal: controller.signal,
            }),
          timeoutMs,
          controller,
        );

        const duration = Date.now() - tracker.startedAt;
        childLogger.info('tool call complete', { durationMs: duration, isError: false });

        const content: Array<{ type: 'text'; text: string }> = [];
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
      } catch (thrown) {
        const duration = Date.now() - tracker.startedAt;
        const toolError: ToolError = thrownToToolError(thrown, requestId);
        if (toolError.code === 'INTERNAL_ERROR') {
          // Programmer bug - log full exception at error level.
          childLogger.exception(thrown, { durationMs: duration, code: toolError.code });
        } else {
          // Known tool error - log at warn with redacted message.
          childLogger.warn('tool call error', {
            durationMs: duration,
            code: toolError.code,
            errMessage: redactErrorMessage(toolError.message),
          });
        }
        return buildToolError(toolError);
      } finally {
        inFlight.delete(requestId);
      }
    };
  }

  // Register every tool with the SDK.
  for (const tool of TOOLS) {
    const wrapped = wrapHandler(tool.definition.name, tool.definition.timeoutMs, tool.handler);
    mcp.registerTool(
      tool.definition.name,
      {
        description: tool.definition.description,
        inputSchema: tool.definition.inputSchema as any,
      },
      wrapped as any,
    );
  }
  logger.info('tools registered', {
    count: TOOLS.length,
    names: TOOLS.map((t) => t.definition.name),
    defaultTimeoutMs,
  });

  function abortAllInFlight(reason: string): void {
    for (const tracker of inFlight.values()) {
      try {
        tracker.controller.abort();
      } catch {
        // ignore - already aborted
      }
    }
    logger.info('in-flight calls aborted', { reason, count: inFlight.size });
  }

  function waitForInFlight(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const tick = () => {
        if (inFlight.size === 0) return resolve(true);
        if (Date.now() - startedAt >= timeoutMs) return resolve(false);
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
