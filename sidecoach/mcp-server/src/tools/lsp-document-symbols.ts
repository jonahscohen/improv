// T-0026: Tool 19 - sidecoach_lsp_document_symbols.
//
// textDocument/documentSymbol. File-level - no position. Normalizes both server
// response shapes (hierarchical DocumentSymbol[] and flat SymbolInformation[])
// into a flat list of {name, kind, range, detail}.

import { lspDocumentSymbolsShape, type LspDocumentSymbolsInputT } from '../schemas';
import { runDocumentRequest } from '../lsp/tool-support';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof lspDocumentSymbolsShape> = {
  name: 'sidecoach_lsp_document_symbols',
  description:
    'LSP document symbols: the outline (functions, classes, methods, variables) of a single file. ' +
    'File-level, so no line/character argument. Auto-discovers the language server from the file extension. ' +
    'Returns a flat list of {name, kind, detail, range}. DOWNSTREAM_UNAVAILABLE if no matching server binary is on PATH.',
  inputSchema: lspDocumentSymbolsShape,
  timeoutMs: 60_000,
};

const MAX_SYMBOLS = 1000;

interface FlatSymbol {
  name: string;
  kind: number;
  detail?: string;
  range: unknown;
}

/** Recursively flatten DocumentSymbol[] (which nest via `children`) and the
 *  flat SymbolInformation[] shape into one list, bounded at MAX_SYMBOLS. */
export function flattenSymbols(result: unknown): FlatSymbol[] {
  const out: FlatSymbol[] = [];
  const visit = (node: unknown): void => {
    if (out.length >= MAX_SYMBOLS) return;
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (typeof obj.name === 'string' && typeof obj.kind === 'number') {
      // DocumentSymbol has `range`; SymbolInformation has `location.range`.
      const range =
        obj.range ??
        (obj.location && typeof obj.location === 'object'
          ? (obj.location as Record<string, unknown>).range
          : null) ??
        null;
      out.push({
        name: obj.name,
        kind: obj.kind,
        detail: typeof obj.detail === 'string' ? obj.detail : undefined,
        range,
      });
    }
    if (Array.isArray(obj.children)) {
      for (const child of obj.children) visit(child);
    }
  };
  if (Array.isArray(result)) {
    for (const item of result) visit(item);
  }
  return out;
}

export const handler: ToolHandler<LspDocumentSymbolsInputT> = async (input, deps) => {
  const { projectRoot, language, result } = await runDocumentRequest(input.file, 'textDocument/documentSymbol');
  const symbols = flattenSymbols(result);
  const data = {
    file: input.file,
    projectRoot,
    language,
    symbolCount: symbols.length,
    symbols,
  };
  deps.logger.info('lsp_document_symbols complete', { language, count: symbols.length });
  return {
    data,
    summary: `sidecoach_lsp_document_symbols: ${symbols.length} symbol(s) (${language})`,
  };
};
