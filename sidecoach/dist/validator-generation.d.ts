import { CleanPolicy, ProductRuleDefinition, RequiredCoverageRecord, SourceKindSupport } from './product-rule-types';
import { ProductValidatorRegistration, LaneValidationPolicy, ValidatorFixtureManifest } from './flow-validation-capabilities';
export declare const BROWSER_BACKED_RULE_IDS: Set<string>;
export interface GeneratedValidator {
    validatorId: string;
    ownedRuleIds: string[];
    registryScope: string[];
    supportedSourceKinds: SourceKindSupport[];
    browserRuleIds: string[];
    browserCoverageByScope: RequiredCoverageRecord[];
    cleanPolicy: CleanPolicy;
}
export declare function deriveValidator(reg: ProductValidatorRegistration, rules: ProductRuleDefinition[]): GeneratedValidator;
export declare function validateRegistry(rules: ProductRuleDefinition[], regs: ProductValidatorRegistration[], gatingValidatorIdList?: string[], browserBackedRuleIds?: string[]): {
    ok: boolean;
    errors: string[];
};
export declare function gatingValidatorIds(policies: LaneValidationPolicy[]): string[];
export declare function validateFixtureManifest(gating: string[], manifest: ValidatorFixtureManifest[]): {
    ok: boolean;
    errors: string[];
};
export declare function deriveFlowCapabilities(): {
    flowId: string;
    capability: "advisory" | "none" | "product_validator";
}[];
//# sourceMappingURL=validator-generation.d.ts.map