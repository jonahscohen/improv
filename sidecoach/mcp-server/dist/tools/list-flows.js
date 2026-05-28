"use strict";
// Tool 3: sidecoach_list_flows - return all flow IDs + names + descriptions
// from sidecoach/src/flows.ts. Optionally filter by tier or idPrefix.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_list_flows',
    description: 'Return all sidecoach flows from the registry. Each flow includes id, human name, ' +
        'description, derived tier (1-6 / 0 for legacy / null for unknown), and its model-routing ' +
        'config (preferred tier + min tier + rationale). Filter by tier or idPrefix.',
    inputSchema: schemas_1.listFlowsShape,
    timeoutMs: 5000,
};
const handler = async (input, deps) => {
    const all = deps.registries.flows;
    if (all.length === 0) {
        throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', 'flow registry is empty - flows.ts could not be loaded at startup', { resource: 'sidecoach/src/flows.ts' });
    }
    let filtered = all;
    if (typeof input.tier === 'number') {
        filtered = filtered.filter((f) => f.tier === input.tier);
    }
    if (input.idPrefix) {
        const prefix = input.idPrefix;
        filtered = filtered.filter((f) => f.id.startsWith(prefix));
    }
    return {
        data: {
            count: filtered.length,
            total: all.length,
            flows: filtered,
        },
        summary: input.tier !== undefined || input.idPrefix
            ? `sidecoach_list_flows: ${filtered.length} flow(s) match filter (of ${all.length} total)`
            : `sidecoach_list_flows: ${all.length} flow(s)`,
    };
};
exports.handler = handler;
//# sourceMappingURL=list-flows.js.map