// Structured stderr logger for the sidecoach MCP server.
//
// stdout is reserved for JSON-RPC framing - any write to stdout from a
// handler corrupts the protocol stream. This module writes ONLY to stderr
// and emits one JSON object per line so logs are grep-friendly and
// machine-parseable.
//
// Levels (least to most verbose): error, warn, info, debug.
// Default level: info. Override via env var SIDECOACH_MCP_LOG_LEVEL.

import { redactErrorMessage } from './errors';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function parseLevel(raw: string | undefined, fallback: LogLevel): LogLevel {
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (lower === 'error' || lower === 'warn' || lower === 'info' || lower === 'debug') {
    return lower;
  }
  return fallback;
}

export interface LogContext {
  requestId?: string;
  tool?: string;
  [key: string]: unknown;
}

export interface Logger {
  level: LogLevel;
  error(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  debug(msg: string, ctx?: LogContext): void;
  /**
   * Log a thrown value at error level. The value is redacted before logging.
   * Use this in the uniform error guard.
   */
  exception(thrown: unknown, ctx?: LogContext): void;
  /** Return a child logger that adds permanent context (e.g. a requestId). */
  child(extra: LogContext): Logger;
}

interface LoggerOptions {
  level?: LogLevel;
  /** stderr-like writer. Tests inject a memory buffer; production uses process.stderr. */
  write?: (line: string) => void;
  /** Base context applied to every log line. */
  baseContext?: LogContext;
}

function defaultWrite(line: string): void {
  // Direct stderr write. Using process.stderr.write so we don't get the
  // newline behavior of console.* which routes through inspect formatters.
  try {
    process.stderr.write(line + '\n');
  } catch {
    // If stderr itself is broken there is nowhere to log; swallow silently.
  }
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const level: LogLevel = opts.level
    ?? parseLevel(process.env.SIDECOACH_MCP_LOG_LEVEL, 'info');
  const write = opts.write ?? defaultWrite;
  const baseContext: LogContext = opts.baseContext ?? {};

  function emit(lineLevel: LogLevel, msg: string, ctx?: LogContext): void {
    if (LEVEL_RANK[lineLevel] > LEVEL_RANK[level]) return;
    const payload: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level: lineLevel,
      ...baseContext,
      ...(ctx ?? {}),
      msg,
    };
    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      // ctx contained a circular reference. Fall back to a string repr.
      serialized = JSON.stringify({
        ts: new Date().toISOString(),
        level: lineLevel,
        msg,
        ctxError: 'unserializable context',
      });
    }
    write(serialized);
  }

  const logger: Logger = {
    level,
    error: (msg, ctx) => emit('error', msg, ctx),
    warn: (msg, ctx) => emit('warn', msg, ctx),
    info: (msg, ctx) => emit('info', msg, ctx),
    debug: (msg, ctx) => emit('debug', msg, ctx),
    exception: (thrown, ctx) => {
      const redacted = redactErrorMessage(thrown);
      // Stack appears at debug level only.
      const stack = thrown instanceof Error && level === 'debug' ? thrown.stack : undefined;
      emit('error', redacted, { ...ctx, ...(stack ? { stack } : {}) });
    },
    child: (extra) => createLogger({
      level,
      write,
      baseContext: { ...baseContext, ...extra },
    }),
  };

  return logger;
}

/**
 * Generate a v4-ish UUID without pulling in a dependency. Good enough for
 * log correlation - we are not using these as cryptographic identifiers.
 */
export function newRequestId(): string {
  // Use the built-in crypto.randomUUID if available (Node 14.17+).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto') as typeof import('crypto');
  if (typeof nodeCrypto.randomUUID === 'function') {
    return nodeCrypto.randomUUID();
  }
  // Fallback: hex from randomBytes shaped as a UUID.
  const bytes = nodeCrypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
