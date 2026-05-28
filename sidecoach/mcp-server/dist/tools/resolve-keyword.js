"use strict";
// Tool 4: sidecoach_resolve_keyword - run the bash hook's verb/mode resolver
// over a phrase and return the matched verb/mode (if any).
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const keyword_resolver_1 = require("../keyword-resolver");
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_resolve_keyword',
    description: 'Resolve a free-text phrase against the sidecoach verb and mode registries using the same ' +
        'sanitize + word-boundary + informational-suppression logic as the UserPromptSubmit hook. ' +
        'Returns the matched verb or mode (modes take precedence), or kind="none" with a reason.',
    inputSchema: schemas_1.resolveKeywordShape,
    timeoutMs: 5000,
};
const handler = async (input, deps) => {
    const verbs = deps.registries.verbs?.verbs ?? [];
    const modes = deps.registries.modes?.modes ?? [];
    if (verbs.length === 0 && modes.length === 0) {
        throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', 'verb and mode registries are both empty - cannot resolve keywords', { resource: 'sidecoach-verbs.json + sidecoach-modes.json' });
    }
    const match = (0, keyword_resolver_1.resolveKeyword)(input.phrase, { verbs, modes });
    return {
        data: { match },
        summary: match.kind === 'none'
            ? `sidecoach_resolve_keyword: no match (${match.reason ?? 'no reason given'})`
            : `sidecoach_resolve_keyword: matched ${match.kind}=${match.name}`,
    };
};
exports.handler = handler;
//# sourceMappingURL=resolve-keyword.js.map