"use strict";
// Error taxonomy for the sidecoach MCP server.
//
// Section 5 of DESIGN.md defines three failure categories:
//   A. Protocol errors  - SDK-raised JSON-RPC errors. We never raise these.
//   B. Tool errors      - tool ran but returned a business-level failure.
//   C. Internal errors  - escapee throw caught by the uniform guard.
//
// This module covers B + C. Protocol errors are entirely the SDK's domain.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidecoachToolError = void 0;
exports.buildToolError = buildToolError;
exports.redactErrorMessage = redactErrorMessage;
exports.thrownToToolError = thrownToToolError;
/**
 * Internal exception class used inside the server to short-circuit a handler
 * with a known error code. The uniform guard catches this and converts to a
 * proper tool error response. Anything else that throws is INTERNAL_ERROR.
 */
class SidecoachToolError extends Error {
    constructor(code, message, extra = {}) {
        super(message);
        this.name = 'SidecoachToolError';
        this.code = code;
        this.extra = extra;
    }
}
exports.SidecoachToolError = SidecoachToolError;
/**
 * Build an MCP `CallToolResult`-shaped tool-error response. The MCP SDK
 * treats `{ isError: true, content: [...] }` as a tool error - the call
 * itself succeeded protocol-wise, but the tool reports a business failure.
 *
 * The content block is text with a JSON-stringified `ToolError` body. The
 * stringified body must round-trip cleanly so callers can `JSON.parse` the
 * text content back into a `ToolError`.
 */
function buildToolError(err) {
    return {
        isError: true,
        content: [
            {
                type: 'text',
                text: JSON.stringify(err),
            },
        ],
    };
}
/**
 * Sanitize an error message before logging or surfacing. Drops anything that
 * looks like a key/token/password and trims overly long traces.
 *
 * Defense-in-depth - the underlying validators never receive credentials, but
 * an HTML/CSS input the caller pastes could plausibly contain them. We do not
 * want them landing in stderr logs.
 */
function redactErrorMessage(raw) {
    let msg;
    if (raw instanceof Error) {
        msg = raw.message || raw.name || 'unknown error';
    }
    else if (typeof raw === 'string') {
        msg = raw;
    }
    else {
        try {
            msg = JSON.stringify(raw);
        }
        catch {
            msg = String(raw);
        }
    }
    // Cap length so a multi-megabyte HTML excerpt cannot blow up logs.
    if (msg.length > 2000) {
        msg = msg.slice(0, 2000) + '...[truncated]';
    }
    // Redact obvious credential patterns.
    msg = msg.replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
    msg = msg.replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/g, 'Bearer [REDACTED]');
    msg = msg.replace(/sk-[A-Za-z0-9_\-]{20,}/g, 'sk-[REDACTED]');
    return msg;
}
/**
 * Convert any thrown value into a `ToolError`. The uniform guard uses this
 * to ensure even a programmer-bug throw lands as a structured response.
 *
 * - `SidecoachToolError`     -> use its code + extras (it's intentional)
 * - Anything else            -> INTERNAL_ERROR with redacted message
 */
function thrownToToolError(thrown, requestId) {
    if (thrown instanceof SidecoachToolError) {
        return {
            code: thrown.code,
            message: thrown.message,
            ...thrown.extra,
        };
    }
    return {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred while handling the tool call. See server logs.',
        errorMessage: redactErrorMessage(thrown),
        requestId,
    };
}
//# sourceMappingURL=errors.js.map