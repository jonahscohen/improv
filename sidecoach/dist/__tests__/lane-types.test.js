"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/lane-types.test.ts
const lane_types_1 = require("../lane-types");
function run() {
    const r = (0, lane_types_1.makeStepReport)({ stepId: 'shape', iteration: 0, reportId: 'r1', verb: 'shape', summary: 'did it', evidence: [{ kind: 'note', detail: 'x' }] });
    if (r.evidence.length !== 1)
        throw new Error('evidence not preserved');
    const closed = 'closed';
    if (!(0, lane_types_1.isClosed)(closed))
        throw new Error('closed must be terminal');
    if ((0, lane_types_1.isClosed)('in_progress'))
        throw new Error('in_progress is not terminal');
    if ((0, lane_types_1.isClosed)('interrupted'))
        throw new Error('interrupted is not terminal (resumable)');
    console.log('lane-types: OK');
}
run();
//# sourceMappingURL=lane-types.test.js.map