import type { ProductCheckContext, RuleVerdict } from '../check-context';
export type CheckFn = (ctx: ProductCheckContext) => RuleVerdict;
export declare const CHECKS: Record<string, CheckFn>;
export declare const missingCheck: CheckFn;
//# sourceMappingURL=index.d.ts.map