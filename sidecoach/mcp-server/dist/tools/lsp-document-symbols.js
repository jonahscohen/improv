"use strict";
// T-0026: Tool 19 - sidecoach_lsp_document_symbols.
//
// textDocument/documentSymbol. File-level - no position. Normalizes both server
// response shapes (hierarchical DocumentSymbol[] and flat SymbolInformation[])
// into a flat list of {name, kind, range, detail}.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
exports.flattenSymbols = flattenSymbols;
const schemas_1 = require("../schemas");
const tool_support_1 = require("../lsp/tool-support");
exports.definition = {
    name: 'sidecoach_lsp_document_symbols',
    description: 'LSP document symbols: the outline (functions, classes, methods, variables) of a single file. ' +
        'File-level, so no line/character argument. Auto-discovers the language server from the file extension. ' +
        'Returns a flat list of {name, kind, detail, range}. DOWNSTREAM_UNAVAILABLE if no matching server binary is on PATH.',
    inputSchema: schemas_1.lspDocumentSymbolsShape,
    timeoutMs: 60000,
};
const MAX_SYMBOLS = 1000;
/** Recursively flatten DocumentSymbol[] (which nest via `children`) and the
 *  flat SymbolInformation[] shape into one list, bounded at MAX_SYMBOLS. */
function flattenSymbols(result) {
    const out = [];
    const visit = (node) => {
        if (out.length >= MAX_SYMBOLS)
            return;
        if (!node || typeof node !== 'object')
            return;
        const obj = node;
        if (typeof obj.name === 'string' && typeof obj.kind === 'number') {
            // DocumentSymbol has `range`; SymbolInformation has `location.range`.
            const range = obj.range ??
                (obj.location && typeof obj.location === 'object'
                    ? obj.location.range
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
            for (const child of obj.children)
                visit(child);
        }
    };
    if (Array.isArray(result)) {
        for (const item of result)
            visit(item);
    }
    return out;
}
const handler = async (input, deps) => {
    const { projectRoot, language, result } = await (0, tool_support_1.runDocumentRequest)(input.file, 'textDocument/documentSymbol');
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
exports.handler = handler;
//# sourceMappingURL=lsp-document-symbols.js.map