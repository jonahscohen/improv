import type { ProductCheckContext, RuleVerdict } from '../check-context';
export declare const checkImageDimensions: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkImageLazyLoad: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkTextOverflowStrategy: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkColorSchemeDark: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkChartA11yFallback: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkButtonLabelSpecific: (ctx: ProductCheckContext) => RuleVerdict;
export declare const PAGE_QUALITY_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict>;
//# sourceMappingURL=page-quality-checks.d.ts.map