import type { ProductRuleDefinition, CanonicalSeverity } from './product-rule-types';
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