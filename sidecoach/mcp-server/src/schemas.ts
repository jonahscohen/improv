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

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitive bounds
// ---------------------------------------------------------------------------

/** Reject pathological payloads early - 2MB per HTML/CSS blob. */
const MAX_DOC_BYTES = 2_000_000;

/** Phrases sent for keyword resolution. 4KB is plenty; this is "user prompt" scale. */
const MAX_PHRASE_CHARS = 4_000;

/** Flow IDs, verb names, mode names. */
const MAX_NAME_CHARS = 128;

// ---------------------------------------------------------------------------
// Tool 1: list_verbs
// ---------------------------------------------------------------------------

export const listVerbsShape = {
  phase: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe(
      'Optional phase filter. Sidecoach phases include shape-strategy, build, review, tone, docs, tactical.',
    ),
};
export const ListVerbsInput = z.object(listVerbsShape);
export type ListVerbsInputT = z.infer<typeof ListVerbsInput>;

// ---------------------------------------------------------------------------
// Tool 2: list_modes (no input)
// ---------------------------------------------------------------------------

export const listModesShape = {} as const;
export const ListModesInput = z.object(listModesShape);
export type ListModesInputT = z.infer<typeof ListModesInput>;

// ---------------------------------------------------------------------------
// Tool 3: list_flows
// ---------------------------------------------------------------------------

export const listFlowsShape = {
  tier: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe('Optional tier filter (1-6 currently in registry).'),
  idPrefix: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe('Optional flow-ID prefix filter, e.g. "flowA" or "flow1".'),
};
export const ListFlowsInput = z.object(listFlowsShape);
export type ListFlowsInputT = z.infer<typeof ListFlowsInput>;

// ---------------------------------------------------------------------------
// Tool 4: resolve_keyword
// ---------------------------------------------------------------------------

export const resolveKeywordShape = {
  phrase: z
    .string()
    .min(1)
    .max(MAX_PHRASE_CHARS)
    .describe('Free-text phrase to resolve against the verb/mode registries.'),
};
export const ResolveKeywordInput = z.object(resolveKeywordShape);
export type ResolveKeywordInputT = z.infer<typeof ResolveKeywordInput>;

// ---------------------------------------------------------------------------
// Tool 5: validate_polish_standard
// ---------------------------------------------------------------------------

export const validatePolishShape = {
  html: z.string().max(MAX_DOC_BYTES).optional().describe('HTML document content.'),
  css: z.string().max(MAX_DOC_BYTES).optional().describe('CSS rules content (may also be embedded in html).'),
  designTokens: z
    .record(z.unknown())
    .optional()
    .describe('Design-token map (key-value). Used for genericity scoring and concentric radius checks.'),
  contextOverrides: z
    .record(z.unknown())
    .optional()
    .describe(
      'Advanced: extra PolishCheckContext fields (accessibility, contrast, componentTree, etc.).',
    ),
};
export const ValidatePolishInput = z
  .object(validatePolishShape)
  .refine((v) => Boolean(v.html || v.css || v.designTokens), {
    message: 'at least one of html, css, or designTokens is required',
  });
export type ValidatePolishInputT = z.infer<typeof ValidatePolishInput>;

// ---------------------------------------------------------------------------
// Tool 6: validate_extended_domain
// ---------------------------------------------------------------------------

export const validateExtendedDomainShape = {
  html: z.string().max(MAX_DOC_BYTES).optional(),
  css: z.string().max(MAX_DOC_BYTES).optional(),
  designTokens: z.record(z.unknown()).optional(),
  typography: z.record(z.unknown()).optional(),
  colors: z.record(z.unknown()).optional(),
  spacing: z.record(z.unknown()).optional(),
  motion: z.record(z.unknown()).optional(),
  accessibility: z.record(z.unknown()).optional(),
  contrast: z.record(z.unknown()).optional(),
  performance: z.record(z.unknown()).optional(),
  visualization: z.record(z.unknown()).optional(),
  internationalization: z.record(z.unknown()).optional(),
};
export const ValidateExtendedDomainInput = z.object(validateExtendedDomainShape);
export type ValidateExtendedDomainInputT = z.infer<typeof ValidateExtendedDomainInput>;

// ---------------------------------------------------------------------------
// Tool 7: validate_taste
// ---------------------------------------------------------------------------

export const validateTasteShape = {
  html: z
    .string()
    .min(1)
    .max(MAX_DOC_BYTES)
    .describe('HTML document content. Required - taste validator is HTML-centric.'),
  css: z.string().max(MAX_DOC_BYTES).optional().describe('Optional external CSS content.'),
  iconLibrary: z
    .string()
    .min(1)
    .max(MAX_NAME_CHARS)
    .optional()
    .describe('Approved icon library name (heroicons, lucide, tabler, etc.).'),
};
export const ValidateTasteInput = z.object(validateTasteShape);
export type ValidateTasteInputT = z.infer<typeof ValidateTasteInput>;

// ---------------------------------------------------------------------------
// Tool 8: get_cost_ledger
// ---------------------------------------------------------------------------

export const getCostLedgerShape = {
  format: z
    .enum(['raw', 'summary'])
    .optional()
    .describe('Output format. "summary" (default) returns aggregates; "raw" returns all entries.'),
};
export const GetCostLedgerInput = z.object(getCostLedgerShape);
export type GetCostLedgerInputT = z.infer<typeof GetCostLedgerInput>;

// ---------------------------------------------------------------------------
// Tool 9: get_cheatsheet
// ---------------------------------------------------------------------------

export const getCheatsheetShape = {
  section: z
    .enum(['modes', 'verbs', 'flows', 'routing', 'all'])
    .optional()
    .describe('Optional section filter. "all" (default) returns the full document.'),
};
export const GetCheatsheetInput = z.object(getCheatsheetShape);
export type GetCheatsheetInputT = z.infer<typeof GetCheatsheetInput>;

// ---------------------------------------------------------------------------
// Tool 10: get_flow_metadata
// ---------------------------------------------------------------------------

export const getFlowMetadataShape = {
  flowId: z
    .string()
    .min(1)
    .max(MAX_NAME_CHARS)
    .describe('Flow ID (e.g. "flowJ_tactical_polish" or "flow1_clone_match").'),
};
export const GetFlowMetadataInput = z.object(getFlowMetadataShape);
export type GetFlowMetadataInputT = z.infer<typeof GetFlowMetadataInput>;

// ---------------------------------------------------------------------------
// Tool 11: state_set (T-0022)
// ---------------------------------------------------------------------------

/** State-store key cap. Mirrored in state-store.ts. */
const STATE_KEY_MAX = 4096;
/** State-store value cap. Mirrored in state-store.ts. */
const STATE_VALUE_MAX = 65_536;
/** State-store TTL cap (24h). Mirrored in state-store.ts. */
const STATE_TTL_MAX_MS = 24 * 60 * 60 * 1000;

export const stateSetShape = {
  key: z
    .string()
    .min(1)
    .max(STATE_KEY_MAX)
    .describe('State key (1..4096 bytes UTF-8).'),
  value: z
    .string()
    .max(STATE_VALUE_MAX)
    .describe(
      'State value as a string. Callers JSON.stringify their payload if storing non-string data.',
    ),
  ttlMs: z
    .number()
    .int()
    .min(1)
    .max(STATE_TTL_MAX_MS)
    .optional()
    .describe('Optional TTL override in ms. Default 30 min. Max 24h.'),
};
export const StateSetInput = z.object(stateSetShape);
export type StateSetInputT = z.infer<typeof StateSetInput>;

// ---------------------------------------------------------------------------
// Tool 12: state_get
// ---------------------------------------------------------------------------

export const stateGetShape = {
  key: z.string().min(1).max(STATE_KEY_MAX).describe('State key to read.'),
};
export const StateGetInput = z.object(stateGetShape);
export type StateGetInputT = z.infer<typeof StateGetInput>;

// ---------------------------------------------------------------------------
// Tool 13: state_delete
// ---------------------------------------------------------------------------

export const stateDeleteShape = {
  key: z.string().min(1).max(STATE_KEY_MAX).describe('State key to delete.'),
};
export const StateDeleteInput = z.object(stateDeleteShape);
export type StateDeleteInputT = z.infer<typeof StateDeleteInput>;

// ---------------------------------------------------------------------------
// Tool 14: state_list_keys
// ---------------------------------------------------------------------------

export const stateListKeysShape = {
  prefix: z
    .string()
    .max(STATE_KEY_MAX)
    .optional()
    .describe('Optional prefix filter. Empty/omitted returns all live keys.'),
};
export const StateListKeysInput = z.object(stateListKeysShape);
export type StateListKeysInputT = z.infer<typeof StateListKeysInput>;

// ---------------------------------------------------------------------------
// Tool 15: ast_grep
// ---------------------------------------------------------------------------

/** Languages accepted by the ast-grep CLI we ship. */
export const AST_GREP_LANGUAGES = [
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
] as const;

export const astGrepShape = {
  pattern: z
    .string()
    .min(1)
    .max(4096)
    .describe('ast-grep pattern. Meta-variables: $NAME single node, $$$VARS multi-node.'),
  language: z
    .enum(AST_GREP_LANGUAGES)
    .optional()
    .describe('Language hint. Omit to let ast-grep auto-detect via file extensions.'),
  path: z
    .string()
    .min(1)
    .max(2048)
    .optional()
    .describe(
      'Path to search. Relative paths resolve against SIDECOACH_PROJECT_ROOT. Defaults to ".".',
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Cap on returned matches (1..100). Default 50.'),
};
export const AstGrepInput = z.object(astGrepShape);
export type AstGrepInputT = z.infer<typeof AstGrepInput>;

// ---------------------------------------------------------------------------
// Tools 16-20: LSP (T-0026)
// ---------------------------------------------------------------------------

// T-0026: shared LSP bounds. Positions are 0-based to match the LSP wire
// protocol exactly (the first line/column is 0). Documented in README.
const LSP_FILE_MAX = 2048; // T-0026
const LSP_QUERY_MAX = 1024; // T-0026

// T-0026: language families accepted by the workspace_symbols `language` hint.
export const LSP_LANGUAGES = ['typescript', 'javascript', 'go', 'rust', 'python', 'c', 'cpp'] as const; // T-0026

// T-0026
const lspFileField = z
  .string()
  .min(1)
  .max(LSP_FILE_MAX)
  .describe('Path to the source file. Relative paths resolve against SIDECOACH_PROJECT_ROOT; must stay inside it.');
const lspLineField = z
  .number()
  .int()
  .min(0)
  .describe('0-based line number (LSP convention: first line is 0).');
const lspCharacterField = z
  .number()
  .int()
  .min(0)
  .describe('0-based character offset within the line (LSP convention: first column is 0).');

// T-0026: Tool 16 - lsp_hover
export const lspHoverShape = {
  file: lspFileField,
  line: lspLineField,
  character: lspCharacterField,
};
export const LspHoverInput = z.object(lspHoverShape); // T-0026
export type LspHoverInputT = z.infer<typeof LspHoverInput>; // T-0026

// T-0026: Tool 17 - lsp_goto_definition
export const lspGotoDefinitionShape = {
  file: lspFileField,
  line: lspLineField,
  character: lspCharacterField,
};
export const LspGotoDefinitionInput = z.object(lspGotoDefinitionShape); // T-0026
export type LspGotoDefinitionInputT = z.infer<typeof LspGotoDefinitionInput>; // T-0026

// T-0026: Tool 18 - lsp_find_references
export const lspFindReferencesShape = {
  file: lspFileField,
  line: lspLineField,
  character: lspCharacterField,
  includeDeclaration: z
    .boolean()
    .optional()
    .describe('Include the declaration itself among the references. Default true.'),
};
export const LspFindReferencesInput = z.object(lspFindReferencesShape); // T-0026
export type LspFindReferencesInputT = z.infer<typeof LspFindReferencesInput>; // T-0026

// T-0026: Tool 19 - lsp_document_symbols (file-level; no position needed)
export const lspDocumentSymbolsShape = {
  file: lspFileField,
};
export const LspDocumentSymbolsInput = z.object(lspDocumentSymbolsShape); // T-0026
export type LspDocumentSymbolsInputT = z.infer<typeof LspDocumentSymbolsInput>; // T-0026

// T-0026: Tool 20 - lsp_workspace_symbols (query + server selector, not a position)
export const lspWorkspaceSymbolsShape = {
  query: z
    .string()
    .min(1)
    .max(LSP_QUERY_MAX)
    .describe('Symbol-name query searched across the workspace.'),
  language: z
    .enum(LSP_LANGUAGES)
    .optional()
    .describe('Language server to query. Omit to derive from `file`, or default to typescript.'),
  file: z
    .string()
    .min(1)
    .max(LSP_FILE_MAX)
    .optional()
    .describe('Optional file whose extension selects the language server when `language` is omitted.'),
};
export const LspWorkspaceSymbolsInput = z.object(lspWorkspaceSymbolsShape); // T-0026
export type LspWorkspaceSymbolsInputT = z.infer<typeof LspWorkspaceSymbolsInput>; // T-0026

// ---------------------------------------------------------------------------
// Map every tool name -> its wrapped Zod object schema (for tests + the
// uniform input-validation guard in index.ts).
// ---------------------------------------------------------------------------

export const TOOL_INPUT_SCHEMAS = {
  sidecoach_list_verbs: ListVerbsInput,
  sidecoach_list_modes: ListModesInput,
  sidecoach_list_flows: ListFlowsInput,
  sidecoach_resolve_keyword: ResolveKeywordInput,
  sidecoach_validate_polish_standard: ValidatePolishInput,
  sidecoach_validate_extended_domain: ValidateExtendedDomainInput,
  sidecoach_validate_taste: ValidateTasteInput,
  sidecoach_get_cost_ledger: GetCostLedgerInput,
  sidecoach_get_cheatsheet: GetCheatsheetInput,
  sidecoach_get_flow_metadata: GetFlowMetadataInput,
  sidecoach_state_set: StateSetInput,
  sidecoach_state_get: StateGetInput,
  sidecoach_state_delete: StateDeleteInput,
  sidecoach_state_list_keys: StateListKeysInput,
  sidecoach_ast_grep: AstGrepInput,
  sidecoach_lsp_hover: LspHoverInput, // T-0026
  sidecoach_lsp_goto_definition: LspGotoDefinitionInput, // T-0026
  sidecoach_lsp_find_references: LspFindReferencesInput, // T-0026
  sidecoach_lsp_document_symbols: LspDocumentSymbolsInput, // T-0026
  sidecoach_lsp_workspace_symbols: LspWorkspaceSymbolsInput, // T-0026
} as const;

export type ToolName = keyof typeof TOOL_INPUT_SCHEMAS;
