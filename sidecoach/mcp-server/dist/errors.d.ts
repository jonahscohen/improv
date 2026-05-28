/**
 * Stable error-code enum surfaced to MCP callers. Every tool error response
 * carries one of these in the JSON-stringified `ToolError` body.
 *
 * Strings (not numbers) so callers can switch on them ergonomically. Names
 * are deliberately verbose to avoid confusion with HTTP status codes or
 * JSON-RPC error codes.
 */
export type SidecoachErrorCode = 'INVALID_INPUT' | 'DOWNSTREAM_UNAVAILABLE' | 'VALIDATOR_FAILURE' | 'TIMEOUT' | 'INTERNAL_ERROR';
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
export declare class SidecoachToolError extends Error {
    readonly code: SidecoachErrorCode;
    readonly extra: Partial<ToolError>;
    constructor(code: SidecoachErrorCode, message: string, extra?: Partial<ToolError>);
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
export declare function buildToolError(err: ToolError): {
    isError: true;
    content: Array<{
        type: 'text';
        text: string;
    }>;
};
/**
 * Sanitize an error message before logging or surfacing. Drops anything that
 * looks like a key/token/password and trims overly long traces.
 *
 * Defense-in-depth - the underlying validators never receive credentials, but
 * an HTML/CSS input the caller pastes could plausibly contain them. We do not
 * want them landing in stderr logs.
 */
export declare function redactErrorMessage(raw: unknown): string;
/**
 * Convert any thrown value into a `ToolError`. The uniform guard uses this
 * to ensure even a programmer-bug throw lands as a structured response.
 *
 * - `SidecoachToolError`     -> use its code + extras (it's intentional)
 * - Anything else            -> INTERNAL_ERROR with redacted message
 */
export declare function thrownToToolError(thrown: unknown, requestId: string): ToolError;
//# sourceMappingURL=errors.d.ts.map