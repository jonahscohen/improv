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
exports.TOOL_INPUT_SCHEMAS = exports.PythonReplExecuteInput = exports.pythonReplExecuteShape = exports.LspWorkspaceSymbolsInput = exports.lspWorkspaceSymbolsShape = exports.LspDocumentSymbolsInput = exports.lspDocumentSymbolsShape = exports.LspFindReferencesInput = exports.lspFindReferencesShape = exports.LspGotoDefinitionInput = exports.lspGotoDefinitionShape = exports.LspHoverInput = exports.lspHoverShape = exports.LSP_LANGUAGES = exports.AstGrepInput = exports.astGrepShape = exports.AST_GREP_LANGUAGES = exports.StateListKeysInput = exports.stateListKeysShape = exports.StateDeleteInput = exports.stateDeleteShape = exports.StateGetInput = exports.stateGetShape = exports.StateSetInput = exports.stateSetShape = exports.LaneInput = exports.laneShape = exports.GetFlowMetadataInput = exports.getFlowMetadataShape = exports.GetCheatsheetInput = exports.getCheatsheetShape = exports.GetCostLedgerInput = exports.getCostLedgerShape = exports.ValidateTasteInput = exports.validateTasteShape = exports.ValidateExtendedDomainInput = exports.validateExtendedDomainShape = exports.ValidatePolishInput = exports.validatePolishShape = exports.ClassifyIntentInput = exports.classifyIntentShape = exports.ListFlowsInput = exports.listFlowsShape = exports.ListLanesInput = exports.listLanesShape = exports.ListVerbsInput = exports.listVerbsShape = void 0;
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
// Tool 2: list_lanes (replaces list_modes - no input)
// ---------------------------------------------------------------------------
exports.listLanesShape = {};
exports.ListLanesInput = zod_1.z.object(exports.listLanesShape);
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
// Tool 4: classify_intent (replaces resolve_keyword) - natural lane classifier
// ---------------------------------------------------------------------------
exports.classifyIntentShape = {
    prompt: zod_1.z
        .string()
        .min(1)
        .max(MAX_PHRASE_CHARS)
        .describe('Natural user prompt to classify against the sidecoach lane registry.'),
};
exports.ClassifyIntentInput = zod_1.z.object(exports.classifyIntentShape);
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
        .enum(['lanes', 'verbs', 'flows', 'routing', 'all'])
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
// Tool: sidecoach_lane (P4d) - drive the four monitor lane operations
// ---------------------------------------------------------------------------
const LANE_PROJECT_MAX = 2048;
const LANE_ID_MAX = 128;
const LANE_TARGET_MAX = 2048;
const LANE_RENDER_URL_MAX = 4096;
// renderUrl protocol allowlist - mirrors the engine's renderUrlFromContext
// (http/https/file/data). A renderUrl outside this set is rejected at the schema
// boundary rather than silently ignored.
function isValidRenderUrl(v) {
    try {
        return ['http:', 'https:', 'file:', 'data:'].includes(new URL(v).protocol);
    }
    catch {
        return false;
    }
}
const LANE_CHECKPOINT_MAX = 256;
const LANE_REASON_MAX = 2048;
const StepReportSchema = zod_1.z.object({
    stepId: zod_1.z.string().min(1),
    iteration: zod_1.z.number().int().min(0),
    reportId: zod_1.z.string().min(1),
    verb: zod_1.z.string().min(1),
    summary: zod_1.z.string().min(1),
    evidence: zod_1.z.array(zod_1.z.object({
        kind: zod_1.z.enum(['files', 'screenshot', 'validation', 'note']),
        detail: zod_1.z.string().min(1),
    })).min(1),
    checklistResults: zod_1.z.array(zod_1.z.object({ itemId: zod_1.z.string().min(1), done: zod_1.z.boolean() })).optional(),
});
exports.laneShape = {
    operation: zod_1.z
        .enum(['start', 'advance', 'status', 'list'])
        .describe('Which lane engine method to invoke: start | advance | status | list.'),
    projectPath: zod_1.z
        .string()
        .min(1)
        .max(LANE_PROJECT_MAX)
        .optional()
        .describe('Project root for checkpoint storage. Defaults to SIDECOACH_PROJECT_ROOT (cwd).'),
    laneId: zod_1.z.string().min(1).max(LANE_ID_MAX).optional().describe('Lane id, e.g. "lane_build" (operation=start).'),
    target: zod_1.z.string().max(LANE_TARGET_MAX).optional().describe('Free-text target the lane operates on (operation=start).'),
    renderUrl: zod_1.z
        .string()
        .max(LANE_RENDER_URL_MAX)
        .refine(isValidRenderUrl, { message: 'renderUrl must be an http/https/file/data URL' })
        .optional()
        .describe('Optional render URL (http/https/file/data) for browser-evidence collection (operation=start). Distinct from the free-text target; activates the browser-backed rules (hit-area, contrast, concentric-radius, typography-rhythm).'),
    startRequestId: zod_1.z
        .string()
        .min(1)
        .max(LANE_CHECKPOINT_MAX)
        .optional()
        .describe('Caller-supplied required transport idempotency key for operation=start. A repeat reuses the active lane.'),
    checkpointId: zod_1.z
        .string()
        .min(1)
        .max(LANE_CHECKPOINT_MAX)
        .optional()
        .describe('Checkpoint id (operation=advance or status).'),
    action: zod_1.z
        .enum(['complete', 'retry', 'skip', 'resume', 'interrupt', 'stop'])
        .optional()
        .describe('Transition action (operation=advance).'),
    expectedRevision: zod_1.z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Best-effort in-process revision check (operation=advance).'),
    reason: zod_1.z.string().min(1).max(LANE_REASON_MAX).optional().describe('Required for skip; recorded for stop/interrupt.'),
    report: StepReportSchema.optional().describe('StepReport object required for action=complete.'),
    all: zod_1.z.boolean().optional().describe('Include closed lanes in the listing (operation=list).'),
};
exports.LaneInput = zod_1.z
    .object(exports.laneShape)
    .refine((v) => v.operation !== 'start' ||
    (typeof v.laneId === 'string' &&
        v.laneId.length > 0 &&
        typeof v.startRequestId === 'string' &&
        v.startRequestId.length > 0), { message: 'operation=start requires laneId and caller-supplied startRequestId' })
    .refine((v) => v.operation !== 'advance' ||
    (typeof v.checkpointId === 'string' &&
        v.checkpointId.length > 0 &&
        typeof v.action === 'string' &&
        typeof v.expectedRevision === 'number'), { message: 'operation=advance requires checkpointId, action, and expectedRevision' })
    .refine((v) => v.operation !== 'advance' || v.action !== 'complete' || v.report !== undefined, {
    message: 'operation=advance action=complete requires report',
})
    .refine((v) => v.operation !== 'advance' || v.action !== 'skip' || (typeof v.reason === 'string' && v.reason.length > 0), { message: 'operation=advance action=skip requires reason' })
    .refine((v) => v.operation !== 'status' || (typeof v.checkpointId === 'string' && v.checkpointId.length > 0), {
    message: 'operation=status requires checkpointId',
});
// ---------------------------------------------------------------------------
// Tool 11: state_set (T-0022)
// ---------------------------------------------------------------------------
/** State-store key cap. Mirrored in state-store.ts. */
const STATE_KEY_MAX = 4096;
/** State-store value cap. Mirrored in state-store.ts. */
const STATE_VALUE_MAX = 65536;
/** State-store TTL cap (24h). Mirrored in state-store.ts. */
const STATE_TTL_MAX_MS = 24 * 60 * 60 * 1000;
exports.stateSetShape = {
    key: zod_1.z
        .string()
        .min(1)
        .max(STATE_KEY_MAX)
        .describe('State key (1..4096 bytes UTF-8).'),
    value: zod_1.z
        .string()
        .max(STATE_VALUE_MAX)
        .describe('State value as a string. Callers JSON.stringify their payload if storing non-string data.'),
    ttlMs: zod_1.z
        .number()
        .int()
        .min(1)
        .max(STATE_TTL_MAX_MS)
        .optional()
        .describe('Optional TTL override in ms. Default 30 min. Max 24h.'),
};
exports.StateSetInput = zod_1.z.object(exports.stateSetShape);
// ---------------------------------------------------------------------------
// Tool 12: state_get
// ---------------------------------------------------------------------------
exports.stateGetShape = {
    key: zod_1.z.string().min(1).max(STATE_KEY_MAX).describe('State key to read.'),
};
exports.StateGetInput = zod_1.z.object(exports.stateGetShape);
// ---------------------------------------------------------------------------
// Tool 13: state_delete
// ---------------------------------------------------------------------------
exports.stateDeleteShape = {
    key: zod_1.z.string().min(1).max(STATE_KEY_MAX).describe('State key to delete.'),
};
exports.StateDeleteInput = zod_1.z.object(exports.stateDeleteShape);
// ---------------------------------------------------------------------------
// Tool 14: state_list_keys
// ---------------------------------------------------------------------------
exports.stateListKeysShape = {
    prefix: zod_1.z
        .string()
        .max(STATE_KEY_MAX)
        .optional()
        .describe('Optional prefix filter. Empty/omitted returns all live keys.'),
};
exports.StateListKeysInput = zod_1.z.object(exports.stateListKeysShape);
// ---------------------------------------------------------------------------
// Tool 15: ast_grep
// ---------------------------------------------------------------------------
/** Languages accepted by the ast-grep CLI we ship. */
exports.AST_GREP_LANGUAGES = [
    'javascript',
    'typescript',
    'tsx',
    'python',
    'go',
    'rust',
    'java',
    'c',
    'cpp',
    'html',
    'css',
    'json',
    'yaml',
];
exports.astGrepShape = {
    pattern: zod_1.z
        .string()
        .min(1)
        .max(4096)
        .describe('ast-grep pattern. Meta-variables: $NAME single node, $$$VARS multi-node.'),
    language: zod_1.z
        .enum(exports.AST_GREP_LANGUAGES)
        .optional()
        .describe('Language hint. Omit to let ast-grep auto-detect via file extensions.'),
    path: zod_1.z
        .string()
        .min(1)
        .max(2048)
        .optional()
        .describe('Path to search. Relative paths resolve against SIDECOACH_PROJECT_ROOT. Defaults to ".".'),
    maxResults: zod_1.z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Cap on returned matches (1..100). Default 50.'),
};
exports.AstGrepInput = zod_1.z.object(exports.astGrepShape);
// ---------------------------------------------------------------------------
// Tools 16-20: LSP (T-0026)
// ---------------------------------------------------------------------------
// T-0026: shared LSP bounds. Positions are 0-based to match the LSP wire
// protocol exactly (the first line/column is 0). Documented in README.
const LSP_FILE_MAX = 2048; // T-0026
const LSP_QUERY_MAX = 1024; // T-0026
// T-0026: language families accepted by the workspace_symbols `language` hint.
exports.LSP_LANGUAGES = ['typescript', 'javascript', 'go', 'rust', 'python', 'c', 'cpp']; // T-0026
// T-0026
const lspFileField = zod_1.z
    .string()
    .min(1)
    .max(LSP_FILE_MAX)
    .describe('Path to the source file. Relative paths resolve against SIDECOACH_PROJECT_ROOT; must stay inside it.');
const lspLineField = zod_1.z
    .number()
    .int()
    .min(0)
    .describe('0-based line number (LSP convention: first line is 0).');
const lspCharacterField = zod_1.z
    .number()
    .int()
    .min(0)
    .describe('0-based character offset within the line (LSP convention: first column is 0).');
// T-0026: Tool 16 - lsp_hover
exports.lspHoverShape = {
    file: lspFileField,
    line: lspLineField,
    character: lspCharacterField,
};
exports.LspHoverInput = zod_1.z.object(exports.lspHoverShape); // T-0026
// T-0026: Tool 17 - lsp_goto_definition
exports.lspGotoDefinitionShape = {
    file: lspFileField,
    line: lspLineField,
    character: lspCharacterField,
};
exports.LspGotoDefinitionInput = zod_1.z.object(exports.lspGotoDefinitionShape); // T-0026
// T-0026: Tool 18 - lsp_find_references
exports.lspFindReferencesShape = {
    file: lspFileField,
    line: lspLineField,
    character: lspCharacterField,
    includeDeclaration: zod_1.z
        .boolean()
        .optional()
        .describe('Include the declaration itself among the references. Default true.'),
};
exports.LspFindReferencesInput = zod_1.z.object(exports.lspFindReferencesShape); // T-0026
// T-0026: Tool 19 - lsp_document_symbols (file-level; no position needed)
exports.lspDocumentSymbolsShape = {
    file: lspFileField,
};
exports.LspDocumentSymbolsInput = zod_1.z.object(exports.lspDocumentSymbolsShape); // T-0026
// T-0026: Tool 20 - lsp_workspace_symbols (query + server selector, not a position)
exports.lspWorkspaceSymbolsShape = {
    query: zod_1.z
        .string()
        .min(1)
        .max(LSP_QUERY_MAX)
        .describe('Symbol-name query searched across the workspace.'),
    language: zod_1.z
        .enum(exports.LSP_LANGUAGES)
        .optional()
        .describe('Language server to query. Omit to derive from `file`, or default to typescript.'),
    file: zod_1.z
        .string()
        .min(1)
        .max(LSP_FILE_MAX)
        .optional()
        .describe('Optional file whose extension selects the language server when `language` is omitted.'),
};
exports.LspWorkspaceSymbolsInput = zod_1.z.object(exports.lspWorkspaceSymbolsShape); // T-0026
// ---------------------------------------------------------------------------
// Tool 21: python_repl_execute (T-0025)
// ---------------------------------------------------------------------------
// T-0025: code length cap. 256 KiB is generous for a one-shot snippet while
// still rejecting pathological multi-megabyte payloads before they reach the
// static screen or the container.
const PYTHON_CODE_MAX = 256 * 1024; // T-0025
// T-0025: caller-supplied timeout bounds. Floor 100ms, ceiling 10s (the
// container hard-kill budget). The per-tool wrapper timeout (30s) sits above
// this so the internal kill always fires first.
const PYTHON_TIMEOUT_MIN_MS = 100; // T-0025
const PYTHON_TIMEOUT_MAX_MS = 10000; // T-0025
exports.pythonReplExecuteShape = {
    code: zod_1.z
        .string()
        .min(1)
        .max(PYTHON_CODE_MAX)
        .describe('Python source to execute one-shot inside the sandbox container. Streamed via stdin.'),
    timeoutMs: zod_1.z
        .number()
        .int()
        .min(PYTHON_TIMEOUT_MIN_MS)
        .max(PYTHON_TIMEOUT_MAX_MS)
        .optional()
        .describe('Optional hard-kill timeout in ms (100..10000). Default 10000.'),
}; // T-0025
exports.PythonReplExecuteInput = zod_1.z.object(exports.pythonReplExecuteShape); // T-0025
// ---------------------------------------------------------------------------
// Map every tool name -> its wrapped Zod object schema (for tests + the
// uniform input-validation guard in index.ts).
// ---------------------------------------------------------------------------
exports.TOOL_INPUT_SCHEMAS = {
    sidecoach_list_verbs: exports.ListVerbsInput,
    sidecoach_list_lanes: exports.ListLanesInput,
    sidecoach_classify_intent: exports.ClassifyIntentInput,
    sidecoach_lane: exports.LaneInput,
    sidecoach_list_flows: exports.ListFlowsInput,
    sidecoach_validate_polish_standard: exports.ValidatePolishInput,
    sidecoach_validate_extended_domain: exports.ValidateExtendedDomainInput,
    sidecoach_validate_taste: exports.ValidateTasteInput,
    sidecoach_get_cost_ledger: exports.GetCostLedgerInput,
    sidecoach_get_cheatsheet: exports.GetCheatsheetInput,
    sidecoach_get_flow_metadata: exports.GetFlowMetadataInput,
    sidecoach_state_set: exports.StateSetInput,
    sidecoach_state_get: exports.StateGetInput,
    sidecoach_state_delete: exports.StateDeleteInput,
    sidecoach_state_list_keys: exports.StateListKeysInput,
    sidecoach_ast_grep: exports.AstGrepInput,
    sidecoach_lsp_hover: exports.LspHoverInput, // T-0026
    sidecoach_lsp_goto_definition: exports.LspGotoDefinitionInput, // T-0026
    sidecoach_lsp_find_references: exports.LspFindReferencesInput, // T-0026
    sidecoach_lsp_document_symbols: exports.LspDocumentSymbolsInput, // T-0026
    sidecoach_lsp_workspace_symbols: exports.LspWorkspaceSymbolsInput, // T-0026
    sidecoach_python_repl_execute: exports.PythonReplExecuteInput, // T-0025
};
//# sourceMappingURL=schemas.js.map