// T-0026: Tool 16 - sidecoach_lsp_hover.
//
// textDocument/hover at a 0-based {line, character}. Returns the hover contents
// (type signature / doc comment) as plain text, or {found: false} when the
// server has nothing at that position. Delegates all lifecycle to lsp/tool-support.

import { lspHoverShape, type LspHoverInputT } from '../schemas';
import { runPositionRequest } from '../lsp/tool-support';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof lspHoverShape> = {
  name: 'sidecoach_lsp_hover',
  description:
    'LSP hover: type signature and docs at a 0-based {line, character} in a file. ' +
    'Auto-discovers the language server from the file extension (typescript/javascript, go, rust, python, c/c++). ' +
    'Returns DOWNSTREAM_UNAVAILABLE if no matching server binary is on PATH. File must resolve inside SIDECOACH_PROJECT_ROOT.',
  inputSchema: lspHoverShape,
  timeoutMs: 60_000,
};

/** Flatten LSP hover contents (string | MarkedString | MarkupContent | array) into text. */
function flattenContents(contents: unknown): string {
  if (contents == null) return '';
  if (typeof contents === 'string') return contents;
  if (Array.isArray(contents)) return contents.map(flattenContents).filter(Boolean).join('\n');
  if (typeof contents === 'object') {
    const obj = contents as Record<string, unknown>;
    if (typeof obj.value === 'string') return obj.value; // MarkupContent / MarkedString {language,value}
  }
  return '';
}

export const handler: ToolHandler<LspHoverInputT> = async (input, deps) => {
  const { projectRoot, language, result } = await runPositionRequest(
    input.file,
    'textDocument/hover',
    input.line,
    input.character,
  );
  const hover = result as { contents?: unknown; range?: unknown } | null;
  const text = hover ? flattenContents(hover.contents) : '';
  const data = {
    file: input.file,
    projectRoot,
    language,
    position: { line: input.line, character: input.character },
    found: Boolean(text),
    contents: text,
    range: hover?.range ?? null,
  };
  deps.logger.info('lsp_hover complete', { language, found: data.found, bytes: text.length });
  return {
    data,
    summary: `sidecoach_lsp_hover: ${data.found ? `${text.length} chars` : 'no hover'} (${language})`,
  };
};
