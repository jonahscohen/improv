"use strict";
// Tool 2: sidecoach_list_modes - return all 5 sidecoach modes.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_list_modes',
    description: 'Return all sidecoach modes (forge / kiln / bloom / canvas / trim). Each mode names a ' +
        'curated chain of verbs that maps to a recognizable shape of work. Modes take precedence ' +
        'over individual verbs when both match a phrase.',
    inputSchema: schemas_1.listModesShape,
    timeoutMs: 5000,
};
const handler = async (_input, deps) => {
    // Modes always have a fallback via modes.ts; deps.registries.modes is
    // therefore never null (loadAllRegistries guarantees it). But guard anyway.
    const modes = deps.registries.modes?.modes ?? [];
    return {
        data: {
            count: modes.length,
            modes,
        },
        summary: `sidecoach_list_modes: ${modes.length} mode(s)`,
    };
};
exports.handler = handler;
//# sourceMappingURL=list-modes.js.map