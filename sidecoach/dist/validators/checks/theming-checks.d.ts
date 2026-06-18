import type { ProductCheckContext, RuleVerdict } from '../check-context';
import type { Applicability } from '../check-context';
export declare const interactiveTokenApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const radiusApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const checkHexInInteractiveState: (ctx: ProductCheckContext) => RuleVerdict;
export declare const checkBorderRadiusConsistency: (ctx: ProductCheckContext) => RuleVerdict;
export declare const THEMING_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict>;
//# sourceMappingURL=theming-checks.d.ts.map