// sidecoach/src/flow-validation-capabilities.ts
import type { FlowId } from './types';
import type { ProductValidationResult } from './product-rule-types';
import { makeProductValidator } from './validators/run-validator';

export interface ProductValidatorRegistration {
  validatorId: string;
  label: string;
  // AUTHORED here is identity ONLY. validateProduct is attached in P4a-2; the
  // GENERATED per-validator fields (ownedRuleIds, registryScope,
  // supportedSourceKinds, cleanPolicy) live in validators.generated.ts.
  validateProduct?: (context: unknown, signal?: AbortSignal) => Promise<ProductValidationResult>;
}

export interface FlowValidationCapability {
  flowId: FlowId;
  productValidatorIds: string[];                 // AUTHORED: validators bound to this flow's step (may be empty)
  baseCapability: 'advisory' | 'none';           // AUTHORED: disposition WHEN no product validator is bound
}

export interface LaneValidationPolicy {
  laneId: string;
  requiredProductValidatorIds: string[];         // AUTHORED: loop gate
  excludedProductValidatorIds: string[];         // AUTHORED: member-flow validators intentionally not gating
}

// AUTHORED fixture-manifest entry per gating validator. P4a-1 checks PRESENCE
// only (clean/findings/inconclusive each declared). Paths are declarative anchors
// here; P4a-2 creates the fixture files and makes the suite EXECUTE them (spec
// 628-634; section 15 keeps these responsibilities separate).
export interface ValidatorFixtureManifest {
  validatorId: string;
  fixtures: { clean: string; findings: string; inconclusive: string };
}

// The single derivation rule for a flow's capability (spec lines 391-393). The
// generator emits the resolved value to validators.generated.ts and --check
// asserts file-level equality; this pure function is the contract both sides use.
export function deriveCapability(f: FlowValidationCapability): 'product_validator' | 'advisory' | 'none' {
  return f.productValidatorIds.length > 0 ? 'product_validator' : f.baseCapability;
}

export const VALIDATOR_REGISTRATIONS: ProductValidatorRegistration[] = [
  { validatorId: 'polish-standard', label: 'Polish Standard', validateProduct: makeProductValidator('polish-standard') },
  { validatorId: 'theming', label: 'Theming / Token Consistency', validateProduct: makeProductValidator('theming') },
  { validatorId: 'anti-pattern', label: 'CSS Anti-Patterns', validateProduct: makeProductValidator('anti-pattern') },
  { validatorId: 'static-a11y', label: 'Static Accessibility', validateProduct: makeProductValidator('static-a11y') },
];

// lane_converge's FIVE derived member flows (spec 939-950). ONLY Flow J binds a
// product validator (the Flow J static polish/copy/bans validator). M/K/I/L are
// advisory coaching. flow I is advisory: the STATIC a11y slice is a separate
// registered validator gating via lane policy, NOT this flow's framework output
// (spec 949). The trailing flowA_brand_verify is a NON-member flow kept only to
// exercise the 'none' branch of deriveCapability so the formula test covers all
// three resolved capabilities.
export const FLOW_CAPABILITIES: FlowValidationCapability[] = [
  { flowId: 'flowJ_tactical_polish' as FlowId, productValidatorIds: ['polish-standard'], baseCapability: 'none' },
  { flowId: 'flowM_responsive_validation' as FlowId, productValidatorIds: [], baseCapability: 'advisory' },
  { flowId: 'flowK_multi_lens_audit' as FlowId, productValidatorIds: [], baseCapability: 'advisory' },
  { flowId: 'flowI_accessibility' as FlowId, productValidatorIds: [], baseCapability: 'advisory' },
  { flowId: 'flowL_design_critique' as FlowId, productValidatorIds: [], baseCapability: 'advisory' },
  { flowId: 'flowA_brand_verify' as FlowId, productValidatorIds: [], baseCapability: 'none' },
];

// The required gate for lane_converge: Flow J static validator + theming +
// anti-patterns + static a11y, all clean (spec 952-958). These bind through the
// LANE POLICY, not flow ownership; M/K/I/L coach every iteration but never gate.
export const LANE_POLICIES: LaneValidationPolicy[] = [
  {
    laneId: 'lane_converge',
    requiredProductValidatorIds: ['polish-standard', 'theming', 'anti-pattern', 'static-a11y'],
    excludedProductValidatorIds: [],
  },
];

// One manifest entry per gating validator (every id in a lane policy's
// requiredProductValidatorIds). Each declares all three fixture categories.
export const FIXTURE_MANIFEST: ValidatorFixtureManifest[] = [
  { validatorId: 'polish-standard', fixtures: { clean: 'fixtures/polish-standard/clean', findings: 'fixtures/polish-standard/findings', inconclusive: 'fixtures/polish-standard/inconclusive' } },
  { validatorId: 'theming', fixtures: { clean: 'fixtures/theming/clean', findings: 'fixtures/theming/findings', inconclusive: 'fixtures/theming/inconclusive' } },
  { validatorId: 'anti-pattern', fixtures: { clean: 'fixtures/anti-pattern/clean', findings: 'fixtures/anti-pattern/findings', inconclusive: 'fixtures/anti-pattern/inconclusive' } },
  { validatorId: 'static-a11y', fixtures: { clean: 'fixtures/static-a11y/clean', findings: 'fixtures/static-a11y/findings', inconclusive: 'fixtures/static-a11y/inconclusive' } },
];

export function getValidatorRegistration(id: string): ProductValidatorRegistration | null {
  return VALIDATOR_REGISTRATIONS.find((v) => v.validatorId === id) ?? null;
}
export function getFlowCapability(flowId: string): FlowValidationCapability | null {
  return FLOW_CAPABILITIES.find((f) => (f.flowId as string) === flowId) ?? null;
}
