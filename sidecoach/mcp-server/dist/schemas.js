"use strict";
// Zod schemas for every tool's input.
//
// Two important properties enforced here:
//
//   1. Every string field has a max length. We never want a 50MB body to
//      slip past validation and reach a regex-heavy validator.
//   2. Required vs optional is explicit. Optional fields use .optional();
//      "at least one of these must be present" is enforced via .refine().
//
// MCP's SDK takes a Zod RAW SHAPE (a `Record<string, ZodSchema>`) for
// inputSchema in registerTool() rather than a wrapped ZodObject. We export
// both the raw shapes (for SDK registration) and the wrapped objects (for
// internal validation in unit tests).
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_INPUT_SCHEMAS = exports.GetFlowMetadataInput = exports.getFlowMetadataShape = exports.GetCheatsheetInput = exports.getCheatsheetShape = exports.GetCostLedgerInput = exports.getCostLedgerShape = exports.ValidateTasteInput = exports.validateTasteShape = exports.ValidateExtendedDomainInput = exports.validateExtendedDomainShape = exports.ValidatePolishInput = exports.validatePolishShape = exports.ResolveKeywordInput = exports.resolveKeywordShape = exports.ListFlowsInput = exports.listFlowsShape = exports.ListModesInput = exports.listModesShape = exports.ListVerbsInput = exports.listVerbsShape = void 0;
const zod_1 = require("zod");
// ---------------------------------------------------------------------------
// Shared primitive bounds
// ---------------------------------------------------------------------------
/** Reject pathological payloads early - 2MB per HTML/CSS blob. */
const MAX_DOC_BYTES = 2000000;
/** Phrases sent for keyword resolution. 4KB is plenty; this is "user prompt" scale. */
const MAX_PHRASE_CHARS = 4000;
/** Flow IDs, verb names, mode names. */
const MAX_NAME_CHARS = 128;
// ---------------------------------------------------------------------------
// Tool 1: list_verbs
// ---------------------------------------------------------------------------
exports.listVerbsShape = {
    phase: zod_1.z
        .string()
        .min(1)
        .max(64)
        .optional()
        .describe('Optional phase filter. Sidecoach phases include shape-strategy, build, review, tone, docs, tactical.'),
};
exports.ListVerbsInput = zod_1.z.object(exports.listVerbsShape);
// ---------------------------------------------------------------------------
// Tool 2: list_modes (no input)
// ---------------------------------------------------------------------------
exports.listModesShape = {};
exports.ListModesInput = zod_1.z.object(exports.listModesShape);
// ---------------------------------------------------------------------------
// Tool 3: list_flows
// ---------------------------------------------------------------------------
exports.listFlowsShape = {
    tier: zod_1.z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe('Optional tier filter (1-6 currently in registry).'),
    idPrefix: zod_1.z
        .string()
        .min(1)
        .max(64)
        .optional()
        .describe('Optional flow-ID prefix filter, e.g. "flowA" or "flow1".'),
};
exports.ListFlowsInput = zod_1.z.object(exports.listFlowsShape);
// ---------------------------------------------------------------------------
// Tool 4: resolve_keyword
// ---------------------------------------------------------------------------
exports.resolveKeywordShape = {
    phrase: zod_1.z
        .string()
        .min(1)
        .max(MAX_PHRASE_CHARS)
        .describe('Free-text phrase to resolve against the verb/mode registries.'),
};
exports.ResolveKeywordInput = zod_1.z.object(exports.resolveKeywordShape);
// ---------------------------------------------------------------------------
// Tool 5: validate_polish_standard
// ---------------------------------------------------------------------------
exports.validatePolishShape = {
    html: zod_1.z.string().max(MAX_DOC_BYTES).optional().describe('HTML document content.'),
    css: zod_1.z.string().max(MAX_DOC_BYTES).optional().describe('CSS rules content (may also be embedded in html).'),
    designTokens: zod_1.z
        .record(zod_1.z.unknown())
        .optional()
        .describe('Design-token map (key-value). Used for genericity scoring and concentric radius checks.'),
    contextOverrides: zod_1.z
        .record(zod_1.z.unknown())
        .optional()
        .describe('Advanced: extra PolishCheckContext fields (accessibility, contrast, componentTree, etc.).'),
};
exports.ValidatePolishInput = zod_1.z
    .object(exports.validatePolishShape)
    .refine((v) => Boolean(v.html || v.css || v.designTokens), {
    message: 'at least one of html, css, or designTokens is required',
});
// ---------------------------------------------------------------------------
// Tool 6: validate_extended_domain
// ---------------------------------------------------------------------------
exports.validateExtendedDomainShape = {
    html: zod_1.z.string().max(MAX_DOC_BYTES).optional(),
    css: zod_1.z.string().max(MAX_DOC_BYTES).optional(),
    designTokens: zod_1.z.record(zod_1.z.unknown()).optional(),
    typography: zod_1.z.record(zod_1.z.unknown()).optional(),
    colors: zod_1.z.record(zod_1.z.unknown()).optional(),
    spacing: zod_1.z.record(zod_1.z.unknown()).optional(),
    motion: zod_1.z.record(zod_1.z.unknown()).optional(),
    accessibility: zod_1.z.record(zod_1.z.unknown()).optional(),
    contrast: zod_1.z.record(zod_1.z.unknown()).optional(),
    performance: zod_1.z.record(zod_1.z.unknown()).optional(),
    visualization: zod_1.z.record(zod_1.z.unknown()).optional(),
    internationalization: zod_1.z.record(zod_1.z.unknown()).optional(),
};
exports.ValidateExtendedDomainInput = zod_1.z.object(exports.validateExtendedDomainShape);
// ---------------------------------------------------------------------------
// Tool 7: validate_taste
// ---------------------------------------------------------------------------
exports.validateTasteShape = {
    html: zod_1.z
        .string()
        .min(1)
        .max(MAX_DOC_BYTES)
        .describe('HTML document content. Required - taste validator is HTML-centric.'),
    css: zod_1.z.string().max(MAX_DOC_BYTES).optional().describe('Optional external CSS content.'),
    iconLibrary: zod_1.z
        .string()
        .min(1)
        .max(MAX_NAME_CHARS)
        .optional()
        .describe('Approved icon library name (heroicons, lucide, tabler, etc.).'),
};
exports.ValidateTasteInput = zod_1.z.object(exports.validateTasteShape);
// ---------------------------------------------------------------------------
// Tool 8: get_cost_ledger
// ---------------------------------------------------------------------------
exports.getCostLedgerShape = {
    format: zod_1.z
        .enum(['raw', 'summary'])
        .optional()
        .describe('Output format. "summary" (default) returns aggregates; "raw" returns all entries.'),
};
exports.GetCostLedgerInput = zod_1.z.object(exports.getCostLedgerShape);
// ---------------------------------------------------------------------------
// Tool 9: get_cheatsheet
// ---------------------------------------------------------------------------
exports.getCheatsheetShape = {
    section: zod_1.z
        .enum(['modes', 'verbs', 'flows', 'routing', 'all'])
        .optional()
        .describe('Optional section filter. "all" (default) returns the full document.'),
};
exports.GetCheatsheetInput = zod_1.z.object(exports.getCheatsheetShape);
// ---------------------------------------------------------------------------
// Tool 10: get_flow_metadata
// ---------------------------------------------------------------------------
exports.getFlowMetadataShape = {
    flowId: zod_1.z
        .string()
        .min(1)
        .max(MAX_NAME_CHARS)
        .describe('Flow ID (e.g. "flowJ_tactical_polish" or "flow1_clone_match").'),
};
exports.GetFlowMetadataInput = zod_1.z.object(exports.getFlowMetadataShape);
// ---------------------------------------------------------------------------
// Map every tool name -> its wrapped Zod object schema (for tests + the
// uniform input-validation guard in index.ts).
// ---------------------------------------------------------------------------
exports.TOOL_INPUT_SCHEMAS = {
    sidecoach_list_verbs: exports.ListVerbsInput,
    sidecoach_list_modes: exports.ListModesInput,
    sidecoach_list_flows: exports.ListFlowsInput,
    sidecoach_resolve_keyword: exports.ResolveKeywordInput,
    sidecoach_validate_polish_standard: exports.ValidatePolishInput,
    sidecoach_validate_extended_domain: exports.ValidateExtendedDomainInput,
    sidecoach_validate_taste: exports.ValidateTasteInput,
    sidecoach_get_cost_ledger: exports.GetCostLedgerInput,
    sidecoach_get_cheatsheet: exports.GetCheatsheetInput,
    sidecoach_get_flow_metadata: exports.GetFlowMetadataInput,
};
//# sourceMappingURL=schemas.js.map