"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/flow-validation-capabilities.test.ts
const flow_validation_capabilities_1 = require("../flow-validation-capabilities");
const product_rule_registry_1 = require("../product-rule-registry");
const lanes_generated_1 = require("../lanes.generated");
function run() {
    // a registration exists for EVERY ownerValidatorId in the rule registry
    for (const ownerId of new Set(product_rule_registry_1.RULES.map((r) => r.ownerValidatorId))) {
        if (!(0, flow_validation_capabilities_1.getValidatorRegistration)(ownerId))
            throw new Error(`missing registration for owner ${ownerId}`);
    }
    // Derive lane_converge membership from generated lane data. Every current or
    // future derived member must have an authored capability row and the expected
    // classification, so lane membership drift cannot bypass this test.
    const converge = lanes_generated_1.LANES.find((l) => l.lane === 'lane_converge');
    if (!converge)
        throw new Error('lane_converge missing from generated lanes');
    const memberIds = new Set(converge.flowSequence.map((id) => id));
    for (const flowId of memberIds) {
        const f = (0, flow_validation_capabilities_1.getFlowCapability)(flowId);
        if (!f)
            throw new Error(`missing capability for lane-converge member flow ${flowId}`);
        const expected = flowId === 'flowJ_tactical_polish' ? 'product_validator' : 'advisory';
        if ((0, flow_validation_capabilities_1.deriveCapability)(f) !== expected) {
            throw new Error(`member flow ${flowId} capability ${(0, flow_validation_capabilities_1.deriveCapability)(f)} != spec ${expected}`);
        }
    }
    // spec 949: flow I is ADVISORY and binds NO product validator
    const fi = (0, flow_validation_capabilities_1.getFlowCapability)('flowI_accessibility');
    if (!fi || (0, flow_validation_capabilities_1.deriveCapability)(fi) !== 'advisory' || fi.productValidatorIds.length !== 0) {
        throw new Error('flow I must be advisory and must NOT bind a product validator (static a11y is a lane validator)');
    }
    // deriveCapability matches the spec formula EXACTLY for every authored flow
    for (const f of flow_validation_capabilities_1.FLOW_CAPABILITIES) {
        const expected = f.productValidatorIds.length > 0 ? 'product_validator' : f.baseCapability;
        if ((0, flow_validation_capabilities_1.deriveCapability)(f) !== expected)
            throw new Error(`flow ${f.flowId} capability formula mismatch`);
    }
    // the three resolved capabilities are all represented in the seed
    const caps = new Set(flow_validation_capabilities_1.FLOW_CAPABILITIES.map(flow_validation_capabilities_1.deriveCapability));
    if (!caps.has('product_validator') || !caps.has('advisory') || !caps.has('none')) {
        throw new Error('seed must exercise product_validator, advisory, and none');
    }
    // static-a11y gates lane_converge through the LANE POLICY, not a flow binding
    const lc = flow_validation_capabilities_1.LANE_POLICIES.find((p) => p.laneId === 'lane_converge');
    if (!lc || !lc.requiredProductValidatorIds.includes('static-a11y')) {
        throw new Error('static-a11y must gate lane_converge via requiredProductValidatorIds');
    }
    // every lane-policy member validator is classified (required or excluded) AND registered
    for (const p of flow_validation_capabilities_1.LANE_POLICIES) {
        if (!Array.isArray(p.requiredProductValidatorIds) || !Array.isArray(p.excludedProductValidatorIds)) {
            throw new Error(`lane policy ${p.laneId} malformed`);
        }
        for (const v of [...p.requiredProductValidatorIds, ...p.excludedProductValidatorIds]) {
            if (!(0, flow_validation_capabilities_1.getValidatorRegistration)(v))
                throw new Error(`lane policy ${p.laneId} references unregistered validator ${v}`);
        }
    }
    console.log('flow-validation-capabilities: OK');
}
run();
//# sourceMappingURL=flow-validation-capabilities.test.js.map