"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIXTURE_MANIFEST = exports.LANE_POLICIES = exports.FLOW_CAPABILITIES = exports.VALIDATOR_REGISTRATIONS = void 0;
exports.deriveCapability = deriveCapability;
exports.getValidatorRegistration = getValidatorRegistration;
exports.getFlowCapability = getFlowCapability;
const run_validator_1 = require("./validators/run-validator");
// The single derivation rule for a flow's capability (spec lines 391-393). The
// generator emits the resolved value to validators.generated.ts and --check
// asserts file-level equality; this pure function is the contract both sides use.
function deriveCapability(f) {
    return f.productValidatorIds.length > 0 ? 'product_validator' : f.baseCapability;
}
exports.VALIDATOR_REGISTRATIONS = [
    { validatorId: 'polish-standard', label: 'Polish Standard', validateProduct: (0, run_validator_1.makeProductValidator)('polish-standard') },
    { validatorId: 'theming', label: 'Theming / Token Consistency', validateProduct: (0, run_validator_1.makeProductValidator)('theming') },
    { validatorId: 'anti-pattern', label: 'CSS Anti-Patterns', validateProduct: (0, run_validator_1.makeProductValidator)('anti-pattern') },
    { validatorId: 'static-a11y', label: 'Static Accessibility', validateProduct: (0, run_validator_1.makeProductValidator)('static-a11y') },
];
// lane_converge's FIVE derived member flows (spec 939-950). ONLY Flow J binds a
// product validator (the Flow J static polish/copy/bans validator). M/K/I/L are
// advisory coaching. flow I is advisory: the STATIC a11y slice is a separate
// registered validator gating via lane policy, NOT this flow's framework output
// (spec 949). The trailing flowA_brand_verify is a NON-member flow kept only to
// exercise the 'none' branch of deriveCapability so the formula test covers all
// three resolved capabilities.
exports.FLOW_CAPABILITIES = [
    { flowId: 'flowJ_tactical_polish', productValidatorIds: ['polish-standard'], baseCapability: 'none' },
    { flowId: 'flowM_responsive_validation', productValidatorIds: [], baseCapability: 'advisory' },
    { flowId: 'flowK_multi_lens_audit', productValidatorIds: [], baseCapability: 'advisory' },
    { flowId: 'flowI_accessibility', productValidatorIds: [], baseCapability: 'advisory' },
    { flowId: 'flowL_design_critique', productValidatorIds: [], baseCapability: 'advisory' },
    { flowId: 'flowA_brand_verify', productValidatorIds: [], baseCapability: 'none' },
];
// The required gate for lane_converge: Flow J static validator + theming +
// anti-patterns + static a11y, all clean (spec 952-958). These bind through the
// LANE POLICY, not flow ownership; M/K/I/L coach every iteration but never gate.
exports.LANE_POLICIES = [
    {
        laneId: 'lane_converge',
        requiredProductValidatorIds: ['polish-standard', 'theming', 'anti-pattern', 'static-a11y'],
        excludedProductValidatorIds: [],
    },
];
// One manifest entry per gating validator (every id in a lane policy's
// requiredProductValidatorIds). Each declares all three fixture categories.
exports.FIXTURE_MANIFEST = [
    { validatorId: 'polish-standard', fixtures: { clean: 'fixtures/polish-standard/clean', findings: 'fixtures/polish-standard/findings', inconclusive: 'fixtures/polish-standard/inconclusive' } },
    { validatorId: 'theming', fixtures: { clean: 'fixtures/theming/clean', findings: 'fixtures/theming/findings', inconclusive: 'fixtures/theming/inconclusive' } },
    { validatorId: 'anti-pattern', fixtures: { clean: 'fixtures/anti-pattern/clean', findings: 'fixtures/anti-pattern/findings', inconclusive: 'fixtures/anti-pattern/inconclusive' } },
    { validatorId: 'static-a11y', fixtures: { clean: 'fixtures/static-a11y/clean', findings: 'fixtures/static-a11y/findings', inconclusive: 'fixtures/static-a11y/inconclusive' } },
];
function getValidatorRegistration(id) {
    return exports.VALIDATOR_REGISTRATIONS.find((v) => v.validatorId === id) ?? null;
}
function getFlowCapability(flowId) {
    return exports.FLOW_CAPABILITIES.find((f) => f.flowId === flowId) ?? null;
}
//# sourceMappingURL=flow-validation-capabilities.js.map