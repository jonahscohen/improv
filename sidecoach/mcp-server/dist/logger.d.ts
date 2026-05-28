export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
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
export declare function createLogger(opts?: LoggerOptions): Logger;
/**
 * Generate a v4-ish UUID without pulling in a dependency. Good enough for
 * log correlation - we are not using these as cryptographic identifiers.
 */
export declare function newRequestId(): string;
export {};
//# sourceMappingURL=logger.d.ts.map