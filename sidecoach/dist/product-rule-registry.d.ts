import type { ProductRuleDefinition } from './product-rule-types';
export declare const RULES: ProductRuleDefinition[];
export declare function getRule(canonicalRuleKey: string): ProductRuleDefinition | null;
export declare function getRuleById(ruleId: string): ProductRuleDefinition | null;
export declare function resolveSourceAlias(sourceId: string): ProductRuleDefinition | null;
//# sourceMappingURL=product-rule-registry.d.ts.map