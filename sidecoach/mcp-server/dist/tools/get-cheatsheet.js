"use strict";
// Tool 9: sidecoach_get_cheatsheet - return the CHEATSHEET.md content,
// optionally filtered to a specific section.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_get_cheatsheet',
    description: 'Return the sidecoach CHEATSHEET.md content. Optionally filter to a single section: ' +
        'modes (5 modes), verbs (22 verbs), flows (registry), or routing (how verbs route to flows). ' +
        'Default returns the full markdown document.',
    inputSchema: schemas_1.getCheatsheetShape,
    timeoutMs: 5000,
};
// Section headers in CHEATSHEET.md follow the pattern "## Section N - Title".
// We extract the body between the requested header and the next ## or EOF.
const SECTION_HEADERS = {
    modes: /^##\s+Section\s+0\b.*$/m,
    verbs: /^##\s+Section\s+1\b.*$/m,
    flows: /^##\s+Section\s+2\b.*$/m,
    routing: /^##\s+Section\s+3\b.*$/m,
    all: null,
};
function extractSection(markdown, section) {
    const startRe = SECTION_HEADERS[section];
    if (!startRe)
        return markdown;
    const startMatch = markdown.match(startRe);
    if (!startMatch || typeof startMatch.index !== 'number') {
        return '';
    }
    const start = startMatch.index;
    // Find the next "## " at the start of a line after `start`.
    const tail = markdown.slice(start + startMatch[0].length);
    const nextRe = /^##\s+/m;
    const nextMatch = tail.match(nextRe);
    if (!nextMatch || typeof nextMatch.index !== 'number') {
        return markdown.slice(start);
    }
    return markdown.slice(start, start + startMatch[0].length + nextMatch.index);
}
const handler = async (input, deps) => {
    if (!deps.registries.cheatsheet) {
        throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', 'cheatsheet not loaded (CHEATSHEET.md missing or unreadable at startup)', { resource: 'claude/skills/sidecoach/CHEATSHEET.md' });
    }
    const section = input.section ?? 'all';
    const content = section === 'all'
        ? deps.registries.cheatsheet.raw
        : extractSection(deps.registries.cheatsheet.raw, section);
    if (!content) {
        throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', `cheatsheet section "${section}" was not found in the document`, { resource: 'CHEATSHEET.md#' + section });
    }
    return {
        data: {
            section,
            source: deps.registries.cheatsheet.sourcePath,
            content,
        },
        summary: `sidecoach_get_cheatsheet: section=${section}, ${content.length} chars`,
    };
};
exports.handler = handler;
//# sourceMappingURL=get-cheatsheet.js.map