import type { CleanPolicy, SourceKindSupport } from './product-rule-types';
export interface GeneratedValidator {
    validatorId: string;
    ownedRuleIds: string[];
    registryScope: string[];
    supportedSourceKinds: SourceKindSupport[];
    browserRuleIds: string[];
    browserCoverageByScope: import('./product-rule-types').RequiredCoverageRecord[];
    renderedRuleIds: string[];
    renderedCoverageByScope: import('./product-rule-types').RequiredCoverageRecord[];
    cleanPolicy: CleanPolicy;
}
export interface GeneratedFlowCapability {
    flowId: string;
    capability: 'product_validator' | 'advisory' | 'none';
}
export declare const GENERATED_VALIDATORS: GeneratedValidator[];
export declare const GENERATED_FLOW_CAPABILITIES: GeneratedFlowCapability[];
//# sourceMappingURL=validators.generated.d.ts.map