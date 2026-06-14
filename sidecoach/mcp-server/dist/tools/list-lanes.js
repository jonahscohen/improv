"use strict";
// Tool: sidecoach_list_lanes. Return the lane registry's lanes. No fallback -
// a null lane registry is DOWNSTREAM_UNAVAILABLE.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_list_lanes',
    description: 'Return all sidecoach lanes (lane_build / lane_ship / lane_delight / lane_live / lane_calm / lane_converge). ' +
        'Each lane carries a human label, its interview label, a description, and its executionKind (sequence | loop). ' +
        'Lanes replace the legacy modes; the classifier routes natural prompts to a lane.',
    inputSchema: schemas_1.listLanesShape,
    timeoutMs: 5000,
};
const handler = async (_input, deps) => {
    const lanes = deps.registries.lanes;
    if (!lanes) {
        throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', 'lane registry not loaded (sidecoach-lanes.json missing or structure-invalid)', { resource: 'claude/hooks/sidecoach-lanes.json' });
    }
    const list = lanes.registry.lanes.map((l) => ({
        lane: l.lane,
        label: l.label,
        executionKind: l.executionKind ?? 'sequence',
        interviewLabel: l.interviewLabel ?? l.label,
        description: l.description ?? '',
    }));
    return {
        data: { count: list.length, lanes: list },
        summary: `sidecoach_list_lanes: ${list.length} lane(s)`,
    };
};
exports.handler = handler;
//# sourceMappingURL=list-lanes.js.map