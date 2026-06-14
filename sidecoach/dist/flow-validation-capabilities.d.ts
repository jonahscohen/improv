import type { FlowId } from './types';
import type { ProductValidationResult } from './product-rule-types';
export interface ProductValidatorRegistration {
    validatorId: string;
    label: string;
    validateProduct?: (context: unknown, signal?: AbortSignal) => Promise<ProductValidationResult>;
}
export interface FlowValidationCapability {
    flowId: FlowId;
    productValidatorIds: string[];
    baseCapability: 'advisory' | 'none';
}
export interface LaneValidationPolicy {
    laneId: string;
    requiredProductValidatorIds: string[];
    excludedProductValidatorIds: string[];
}
export interface ValidatorFixtureManifest {
    validatorId: string;
    fixtures: {
        clean: string;
        findings: string;
        inconclusive: string;
    };
}
export declare function deriveCapability(f: FlowValidationCapability): 'product_validator' | 'advisory' | 'none';
export declare const VALIDATOR_REGISTRATIONS: ProductValidatorRegistration[];
export declare const FLOW_CAPABILITIES: FlowValidationCapability[];
export declare const LANE_POLICIES: LaneValidationPolicy[];
export declare const FIXTURE_MANIFEST: ValidatorFixtureManifest[];
export declare function getValidatorRegistration(id: string): ProductValidatorRegistration | null;
export declare function getFlowCapability(flowId: string): FlowValidationCapability | null;
//# sourceMappingURL=flow-validation-capabilities.d.ts.map