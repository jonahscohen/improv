"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/lane-validator-gating.test.ts
const lane_validators_1 = require("../lane-validators");
function run() {
    // discovery: lane_build "craft" step binds flowI(adv)/flowM(adv)/flowJ(polish-standard) -> ['polish-standard']
    const craft = { flowIds: ['flowI_accessibility', 'flowM_responsive_validation', 'flowJ_tactical_polish'] };
    const ids = (0, lane_validators_1.validatorsForStep)(craft);
    if (ids.length !== 1 || ids[0] !== 'polish-standard')
        throw new Error(`craft must discover ['polish-standard'], got ${JSON.stringify(ids)}`);
    // a step that binds the same validator via two flows de-dups
    const dupd = (0, lane_validators_1.validatorsForStep)({ flowIds: ['flowJ_tactical_polish', 'flowJ_tactical_polish'] });
    if (dupd.length !== 1)
        throw new Error('duplicate validators must de-dup');
    // a no-validator step discovers []
    if ((0, lane_validators_1.validatorsForStep)({ flowIds: ['flowA_brand_verify'] }).length !== 0)
        throw new Error('advisory/none flow contributes no validator');
    if ((0, lane_validators_1.validatorsForStep)({ flowIds: [] }).length !== 0)
        throw new Error('empty step contributes no validator');
    // worst-status total order: error > findings > inconclusive > clean
    if ((0, lane_validators_1.aggregateWorstStatus)(['clean', 'clean']) !== 'clean')
        throw new Error('all clean -> clean');
    if ((0, lane_validators_1.aggregateWorstStatus)(['clean', 'inconclusive']) !== 'inconclusive')
        throw new Error('inconclusive beats clean');
    if ((0, lane_validators_1.aggregateWorstStatus)(['findings', 'inconclusive']) !== 'findings')
        throw new Error('findings beats inconclusive');
    if ((0, lane_validators_1.aggregateWorstStatus)(['error', 'findings', 'inconclusive']) !== 'error')
        throw new Error('error is worst');
    if ((0, lane_validators_1.aggregateWorstStatus)([]) !== 'clean')
        throw new Error('no validators -> clean (vacuously gated)');
    // mapping
    if ((0, lane_validators_1.mapGateStatusToOutcome)('clean').proceed !== true)
        throw new Error('clean proceeds');
    if ((0, lane_validators_1.mapGateStatusToOutcome)('findings').stepStatus !== 'validation_failed')
        throw new Error('findings -> validation_failed');
    if ((0, lane_validators_1.mapGateStatusToOutcome)('inconclusive').stepStatus !== 'validation_inconclusive')
        throw new Error('inconclusive -> validation_inconclusive');
    if ((0, lane_validators_1.mapGateStatusToOutcome)('error').stepStatus !== 'validation_error')
        throw new Error('error -> validation_error');
    console.log('lane-validator-gating: OK');
}
run();
//# sourceMappingURL=lane-validator-gating.test.js.map