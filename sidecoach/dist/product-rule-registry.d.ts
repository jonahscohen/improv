import type { ProductRuleDefinition, ProductRuleResult, CanonicalSeverity } from './product-rule-types';
import type { CheckFn } from './validators/checks';
export declare function resolveCheckFn(def: ProductRuleDefinition): CheckFn;
export declare function buildCheckProduct(def: ProductRuleDefinition): (context: unknown) => ProductRuleResult;
export declare const RULES: ProductRuleDefinition[];
export declare function getRule(canonicalRuleKey: string): ProductRuleDefinition | null;
export declare function getRuleById(ruleId: string): ProductRuleDefinition | null;
export declare function resolveSourceAlias(sourceId: string): ProductRuleDefinition | null;
export type RenderedLens = 'objective' | 'subjective';
export interface RenderedRuleResolution {
    scannerRule: string;
    lens: RenderedLens;
    ruleId: string | null;
    canonicalRuleKey: string | null;
    severity: CanonicalSeverity;
    blocking: boolean;
    findingClass: string;
    registryScope: string;
    source: 'validator-owned' | 'audit-only';
}
export declare function resolveRenderedRule(scannerRule: string): RenderedRuleResolution | null;
export declare function renderedScannerRules(): string[];
export declare function listRenderedManifest(): RenderedRuleResolution[];
//# sourceMappingURL=product-rule-registry.d.ts.map