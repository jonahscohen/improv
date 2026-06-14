// sidecoach/src/__tests__/flow-validation-capabilities.test.ts
import {
  VALIDATOR_REGISTRATIONS, FLOW_CAPABILITIES, LANE_POLICIES,
  getValidatorRegistration, getFlowCapability, deriveCapability,
} from '../flow-validation-capabilities';
import { RULES } from '../product-rule-registry';
import { LANES } from '../lanes.generated';

function run() {
  // a registration exists for EVERY ownerValidatorId in the rule registry
  for (const ownerId of new Set(RULES.map((r) => r.ownerValidatorId))) {
    if (!getValidatorRegistration(ownerId)) throw new Error(`missing registration for owner ${ownerId}`);
  }

  // Derive lane_converge membership from generated lane data. Every current or
  // future derived member must have an authored capability row and the expected
  // classification, so lane membership drift cannot bypass this test.
  const converge = LANES.find((l) => l.lane === 'lane_converge');
  if (!converge) throw new Error('lane_converge missing from generated lanes');
  const memberIds = new Set(converge.flowSequence.map((id) => id as string));
  for (const flowId of memberIds) {
    const f = getFlowCapability(flowId);
    if (!f) throw new Error(`missing capability for lane-converge member flow ${flowId}`);
    const expected = flowId === 'flowJ_tactical_polish' ? 'product_validator' : 'advisory';
    if (deriveCapability(f) !== expected) {
      throw new Error(`member flow ${flowId} capability ${deriveCapability(f)} != spec ${expected}`);
    }
  }
  // spec 949: flow I is ADVISORY and binds NO product validator
  const fi = getFlowCapability('flowI_accessibility');
  if (!fi || deriveCapability(fi) !== 'advisory' || fi.productValidatorIds.length !== 0) {
    throw new Error('flow I must be advisory and must NOT bind a product validator (static a11y is a lane validator)');
  }

  // deriveCapability matches the spec formula EXACTLY for every authored flow
  for (const f of FLOW_CAPABILITIES) {
    const expected = f.productValidatorIds.length > 0 ? 'product_validator' : f.baseCapability;
    if (deriveCapability(f) !== expected) throw new Error(`flow ${f.flowId} capability formula mismatch`);
  }
  // the three resolved capabilities are all represented in the seed
  const caps = new Set(FLOW_CAPABILITIES.map(deriveCapability));
  if (!caps.has('product_validator') || !caps.has('advisory') || !caps.has('none')) {
    throw new Error('seed must exercise product_validator, advisory, and none');
  }

  // static-a11y gates lane_converge through the LANE POLICY, not a flow binding
  const lc = LANE_POLICIES.find((p) => p.laneId === 'lane_converge');
  if (!lc || !lc.requiredProductValidatorIds.includes('static-a11y')) {
    throw new Error('static-a11y must gate lane_converge via requiredProductValidatorIds');
  }

  // every lane-policy member validator is classified (required or excluded) AND registered
  for (const p of LANE_POLICIES) {
    if (!Array.isArray(p.requiredProductValidatorIds) || !Array.isArray(p.excludedProductValidatorIds)) {
      throw new Error(`lane policy ${p.laneId} malformed`);
    }
    for (const v of [...p.requiredProductValidatorIds, ...p.excludedProductValidatorIds]) {
      if (!getValidatorRegistration(v)) throw new Error(`lane policy ${p.laneId} references unregistered validator ${v}`);
    }
  }
  console.log('flow-validation-capabilities: OK');
}
run();
