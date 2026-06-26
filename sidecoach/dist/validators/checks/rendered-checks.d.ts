import type { ProductCheckContext, RuleVerdict } from '../check-context';
export declare const checkBrokenImage: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkSkippedHeading: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkGrayOnColor: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkJustifiedText: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkLowContrast: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkTinyText: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkMarketingBuzzword: (ctx: ProductCheckContext) => RuleVerdict;
export declare const RENDERED_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict>;
//# sourceMappingURL=rendered-checks.d.ts.map