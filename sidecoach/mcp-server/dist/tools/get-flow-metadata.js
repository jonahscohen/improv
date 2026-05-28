"use strict";
// Tool 10: sidecoach_get_flow_metadata - given a flow ID, return its name,
// description, triggers, derived tier, and model-routing config.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const registries_1 = require("../registries");
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_get_flow_metadata',
    description: 'Return metadata for a single sidecoach flow. Includes id, name, description, trigger ' +
        'patterns / intent markers / collision-avoid / negative filters, derived tier, and the ' +
        'model-routing config (preferredTier, minTier, rationale).',
    inputSchema: schemas_1.getFlowMetadataShape,
    timeoutMs: 5000,
};
const handler = async (input, _deps) => {
    const flow = (0, registries_1.getFlowById)(input.flowId);
    if (!flow) {
        throw new errors_1.SidecoachToolError('INVALID_INPUT', `unknown flowId: "${input.flowId}". Use sidecoach_list_flows to discover valid IDs.`, { resource: input.flowId });
    }
    return {
        data: { flow },
        summary: `sidecoach_get_flow_metadata: ${flow.id} (${flow.name})`,
    };
};
exports.handler = handler;
//# sourceMappingURL=get-flow-metadata.js.map