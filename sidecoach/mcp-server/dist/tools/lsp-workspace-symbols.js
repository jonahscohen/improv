"use strict";
// T-0026: Tool 20 - sidecoach_lsp_workspace_symbols.
//
// workspace/symbol query across the whole project. Deviation from the
// file+line+character shape: workspace symbols are project-wide, so this tool
// takes a `query` string plus a server selector (`language` hint, or `file` to
// derive it, defaulting to typescript). Normalizes SymbolInformation[] /
// WorkspaceSymbol[] into {name, kind, location:{uri, range}}.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const schemas_1 = require("../schemas");
const tool_support_1 = require("../lsp/tool-support");
exports.definition = {
    name: 'sidecoach_lsp_workspace_symbols',
    description: 'LSP workspace symbols: search symbol names across the whole project. Takes a query string (not a position). ' +
        'Selects the language server via the optional `language` hint, or derives it from an optional `file`, ' +
        'defaulting to typescript. Returns {name, kind, location:{uri, range}}[] with project-relative URIs. ' +
        'DOWNSTREAM_UNAVAILABLE if the selected server binary is not on PATH.',
    inputSchema: schemas_1.lspWorkspaceSymbolsShape,
    timeoutMs: 60000,
};
const MAX_SYMBOLS = 500;
const handler = async (input, deps) => {
    const { projectRoot, language, result } = await (0, tool_support_1.runWorkspaceSymbolRequest)(input.query, input.language, input.file);
    const arr = Array.isArray(result) ? result : [];
    const symbols = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object')
            continue;
        const obj = item;
        if (typeof obj.name !== 'string' || typeof obj.kind !== 'number')
            continue;
        const loc = (obj.location ?? {});
        const uri = typeof loc.uri === 'string' ? loc.uri : '';
        symbols.push({
            name: obj.name,
            kind: obj.kind,
            location: { uri: uri ? (0, tool_support_1.relativizeUri)(uri, projectRoot) : '', range: loc.range ?? null },
        });
        if (symbols.length >= MAX_SYMBOLS)
            break;
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
exports.handler = handler;
//# sourceMappingURL=lsp-workspace-symbols.js.map