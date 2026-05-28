"use strict";
// T-0026: Tool 17 - sidecoach_lsp_goto_definition.
//
// textDocument/definition at a 0-based {line, character}. Normalizes the
// several shapes a server can return (Location, Location[], LocationLink[]) into
// a flat list of {uri, range} with project-relative URIs.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
exports.normalizeLocations = normalizeLocations;
const schemas_1 = require("../schemas");
const tool_support_1 = require("../lsp/tool-support");
exports.definition = {
    name: 'sidecoach_lsp_goto_definition',
    description: 'LSP go-to-definition: locate where the symbol at a 0-based {line, character} is defined. ' +
        'Auto-discovers the language server from the file extension. Returns a list of {uri, range} (URIs relativized ' +
        'to SIDECOACH_PROJECT_ROOT). DOWNSTREAM_UNAVAILABLE if no matching server binary is on PATH.',
    inputSchema: schemas_1.lspGotoDefinitionShape,
    timeoutMs: 60000,
};
const MAX_LOCATIONS = 200;
/** Normalize Location | Location[] | LocationLink[] | null into {uri, range}[]. */
function normalizeLocations(result, projectRoot) {
    if (result == null)
        return [];
    const arr = Array.isArray(result) ? result : [result];
    const out = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object')
            continue;
        const obj = item;
        // Location: {uri, range}. LocationLink: {targetUri, targetRange, ...}.
        const uri = typeof obj.uri === 'string' ? obj.uri : typeof obj.targetUri === 'string' ? obj.targetUri : null;
        const range = obj.range ?? obj.targetRange ?? null;
        if (!uri)
            continue;
        out.push({ uri: (0, tool_support_1.relativizeUri)(uri, projectRoot), range });
        if (out.length >= MAX_LOCATIONS)
            break;
    }
    return out;
}
const handler = async (input, deps) => {
    const { projectRoot, language, result } = await (0, tool_support_1.runPositionRequest)(input.file, 'textDocument/definition', input.line, input.character);
    const locations = normalizeLocations(result, projectRoot);
    const data = {
        file: input.file,
        projectRoot,
        language,
        position: { line: input.line, character: input.character },
        definitionCount: locations.length,
        definitions: locations,
    };
    deps.logger.info('lsp_goto_definition complete', { language, count: locations.length });
    return {
        data,
        summary: `sidecoach_lsp_goto_definition: ${locations.length} location(s) (${language})`,
    };
};
exports.handler = handler;
//# sourceMappingURL=lsp-goto-definition.js.map