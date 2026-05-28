// Error taxonomy for the sidecoach MCP server.
//
// Section 5 of DESIGN.md defines three failure categories:
//   A. Protocol errors  - SDK-raised JSON-RPC errors. We never raise these.
//   B. Tool errors      - tool ran but returned a business-level failure.
//   C. Internal errors  - escapee throw caught by the uniform guard.
//
// This module covers B + C. Protocol errors are entirely the SDK's domain.

/**
 * Stable error-code enum surfaced to MCP callers. Every tool error response
 * carries one of these in the JSON-stringified `ToolError` body.
 *
 * Strings (not numbers) so callers can switch on them ergonomically. Names
 * are deliberately verbose to avoid confusion with HTTP status codes or
 * JSON-RPC error codes.
 */
export type SidecoachErrorCode =
  | 'INVALID_INPUT'
  | 'DOWNSTREAM_UNAVAILABLE'
  | 'VALIDATOR_FAILURE'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

/**
 * Optional Zod-style validation issue. We mirror Zod's issue shape (path +
 * message) so callers can present per-field errors without depending on Zod.
 */
export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  /** Mirrors the Zod issue code (e.g. 'invalid_type', 'too_small'). Optional. */
  code?: string;
}

/**
 * Structured error body returned in the `text` content of an isError tool
 * result. Stringified as JSON so MCP clients can `JSON.parse` it.
 *
 * Fields beyond `code`/`message` are optional and vary by code:
 *  - INVALID_INPUT          : validationIssues
 *  - DOWNSTREAM_UNAVAILABLE : resource (name of missing dep)
 *  - VALIDATOR_FAILURE      : validator (name), errorMessage (redacted)
 *  - TIMEOUT                : timeoutMs
 *  - INTERNAL_ERROR         : requestId (for log lookup)
 */
export interface ToolError {
  code: SidecoachErrorCode;
  message: string;
  validationIssues?: ValidationIssue[];
  resource?: string;
  validator?: string;
  errorMessage?: string;
  timeoutMs?: number;
  requestId?: string;
}

/**
 * Internal exception class used inside the server to short-circuit a handler
 * with a known error code. The uniform guard catches this and converts to a
 * proper tool error response. Anything else that throws is INTERNAL_ERROR.
 */
export class SidecoachToolError extends Error {
  public readonly code: SidecoachErrorCode;
  public readonly extra: Partial<ToolError>;

  constructor(
    code: SidecoachErrorCode,
    message: string,
    extra: Partial<ToolError> = {},
  ) {
    super(message);
    this.name = 'SidecoachToolError';
    this.code = code;
    this.extra = extra;
  }
}

/**
 * Build an MCP `CallToolResult`-shaped tool-error response. The MCP SDK
 * treats `{ isError: true, content: [...] }` as a tool error - the call
 * itself succeeded protocol-wise, but the tool reports a business failure.
 *
 * The content block is text with a JSON-stringified `ToolError` body. The
 * stringified body must round-trip cleanly so callers can `JSON.parse` the
 * text content back into a `ToolError`.
 */
export function buildToolError(err: ToolError): {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
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
export function redactErrorMessage(raw: unknown): string {
  let msg: string;
  if (raw instanceof Error) {
    msg = raw.message || raw.name || 'unknown error';
  } else if (typeof raw === 'string') {
    msg = raw;
  } else {
    try {
      msg = JSON.stringify(raw);
    } catch {
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
export function thrownToToolError(
  thrown: unknown,
  requestId: string,
): ToolError {
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
