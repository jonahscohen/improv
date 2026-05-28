// T-0026: Tool 20 - sidecoach_lsp_workspace_symbols.
//
// workspace/symbol query across the whole project. Deviation from the
// file+line+character shape: workspace symbols are project-wide, so this tool
// takes a `query` string plus a server selector (`language` hint, or `file` to
// derive it, defaulting to typescript). Normalizes SymbolInformation[] /
// WorkspaceSymbol[] into {name, kind, location:{uri, range}}.

import { lspWorkspaceSymbolsShape, type LspWorkspaceSymbolsInputT } from '../schemas';
import { runWorkspaceSymbolRequest, relativizeUri } from '../lsp/tool-support';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof lspWorkspaceSymbolsShape> = {
  name: 'sidecoach_lsp_workspace_symbols',
  description:
    'LSP workspace symbols: search symbol names across the whole project. Takes a query string (not a position). ' +
    'Selects the language server via the optional `language` hint, or derives it from an optional `file`, ' +
    'defaulting to typescript. Returns {name, kind, location:{uri, range}}[] with project-relative URIs. ' +
    'DOWNSTREAM_UNAVAILABLE if the selected server binary is not on PATH.',
  inputSchema: lspWorkspaceSymbolsShape,
  timeoutMs: 60_000,
};

const MAX_SYMBOLS = 500;

export const handler: ToolHandler<LspWorkspaceSymbolsInputT> = async (input, deps) => {
  const { projectRoot, language, result } = await runWorkspaceSymbolRequest(
    input.query,
    input.language,
    input.file,
  );
  const arr = Array.isArray(result) ? result : [];
  const symbols: Array<{ name: string; kind: number; location: { uri: string; range: unknown } }> = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.name !== 'string' || typeof obj.kind !== 'number') continue;
    const loc = (obj.location ?? {}) as Record<string, unknown>;
    const uri = typeof loc.uri === 'string' ? loc.uri : '';
    symbols.push({
      name: obj.name,
      kind: obj.kind,
      location: { uri: uri ? relativizeUri(uri, projectRoot) : '', range: loc.range ?? null },
    });
    if (symbols.length >= MAX_SYMBOLS) break;
  }
  const data = {
    query: input.query,
    projectRoot,
    language,
    symbolCount: symbols.length,
    truncated: arr.length > symbols.length,
    symbols,
  };
  deps.logger.info('lsp_workspace_symbols complete', { language, count: symbols.length });
  return {
    data,
    summary: `sidecoach_lsp_workspace_symbols: ${symbols.length} symbol(s) for "${input.query}" (${language})`,
  };
};
