"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatorsForStep = validatorsForStep;
exports.aggregateWorstStatus = aggregateWorstStatus;
exports.mapGateStatusToOutcome = mapGateStatusToOutcome;
const flow_validation_capabilities_1 = require("./flow-validation-capabilities");
// A sequence step that maps to multiple flows gates on the UNION (de-duplicated,
// order-preserving) of those flows' bound productValidatorIds (spec line 351-353).
function validatorsForStep(step) {
    const ids = [];
    for (const f of step.flowIds) {
        const cap = (0, flow_validation_capabilities_1.getFlowCapability)(f);
        for (const v of cap?.productValidatorIds ?? [])
            if (!ids.includes(v))
                ids.push(v);
    }
    return ids;
}
// Total order, worst-first: a gate machinery failure (error) is loudest because the
// gate could not be evaluated at all; a confirmed blocking defect (findings) outranks
// an unverified gap (inconclusive); clean is best. No bound validators -> clean
// (the step is vacuously gated - nothing required it).
const RANK = { clean: 0, inconclusive: 1, findings: 2, error: 3 };
function aggregateWorstStatus(statuses) {
    let worst = 'clean';
    for (const s of statuses)
        if (RANK[s] > RANK[worst])
            worst = s;
    return worst;
}
function mapGateStatusToOutcome(status) {
    switch (status) {
        case 'clean': return { proceed: true };
        case 'findings': return { proceed: false, stepStatus: 'validation_failed' };
        case 'inconclusive': return { proceed: false, stepStatus: 'validation_inconclusive' };
        case 'error': return { proceed: false, stepStatus: 'validation_error' };
    }
}
//# sourceMappingURL=lane-validators.js.map