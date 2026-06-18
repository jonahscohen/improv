import type { ProductCheckContext, RuleVerdict } from '../check-context';
export declare const checkGradientText: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkGlassmorphism: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkSideStripeBorders: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkIdenticalCardGrids: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkHeroMetricTemplate: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkModalAsFirstThought: (ctx: ProductCheckContext) => RuleVerdict;
export declare const ANTI_PATTERN_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict>;
//# sourceMappingURL=anti-pattern-checks.d.ts.map