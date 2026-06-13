"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeStepReport = makeStepReport;
exports.isClosed = isClosed;
function makeStepReport(r) { return { ...r, evidence: [...r.evidence] }; }
function isClosed(l) { return l === 'closed'; }
//# sourceMappingURL=lane-types.js.map