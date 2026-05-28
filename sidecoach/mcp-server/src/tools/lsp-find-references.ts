// T-0026: Tool 18 - sidecoach_lsp_find_references.
//
// textDocument/references at a 0-based {line, character}. The LSP method needs
// a `context.includeDeclaration` flag (default true) - the one deviation from
// the bare file+line+character shape. Returns a flat {uri, range}[].

import { lspFindReferencesShape, type LspFindReferencesInputT } from '../schemas';
import { runPositionRequest, relativizeUri } from '../lsp/tool-support';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof lspFindReferencesShape> = {
  name: 'sidecoach_lsp_find_references',
  description:
    'LSP find-references: every reference to the symbol at a 0-based {line, character}. ' +
    'Optional includeDeclaration (default true) controls whether the declaration is included. ' +
    'Auto-discovers the language server from the file extension. Returns {uri, range}[] (URIs relativized to ' +
    'SIDECOACH_PROJECT_ROOT). DOWNSTREAM_UNAVAILABLE if no matching server binary is on PATH.',
  inputSchema: lspFindReferencesShape,
  timeoutMs: 60_000,
};

const MAX_REFERENCES = 500;

export const handler: ToolHandler<LspFindReferencesInputT> = async (input, deps) => {
  const includeDeclaration = input.includeDeclaration ?? true;
  const { projectRoot, language, result } = await runPositionRequest(
    input.file,
    'textDocument/references',
    input.line,
    input.character,
    { context: { includeDeclaration } },
  );
  const arr = Array.isArray(result) ? result : [];
  const references: Array<{ uri: string; range: unknown }> = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.uri !== 'string') continue;
    references.push({ uri: relativizeUri(obj.uri, projectRoot), range: obj.range ?? null });
    if (references.length >= MAX_REFERENCES) break;
  }
  const data = {
    file: input.file,
    projectRoot,
    language,
    position: { line: input.line, character: input.character },
    includeDeclaration,
    referenceCount: references.length,
    truncated: arr.length > references.length,
    references,
  };
  deps.logger.info('lsp_find_references complete', { language, count: references.length });
  return {
    data,
    summary: `sidecoach_lsp_find_references: ${references.length} reference(s) (${language})`,
  };
};
