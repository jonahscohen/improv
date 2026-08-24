import type { ProductRuleDefinition } from '../../product-rule-types';
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import type { PatternSpec } from '../pattern-spec';
/**
 * Run one patternSpec against the collected evidence. Returns a RuleVerdict; the registry's
 * checkProduct wrapper stamps the rule's severity/class and catches any throw as inconclusive.
 */
export declare function interpretPatternSpec(spec: PatternSpec | undefined, ctx: ProductCheckContext): RuleVerdict;
/** Bind a rule definition to its interpreter as a CheckFn (used by the CHECKS resolution). */
export declare function interpreterFor(def: ProductRuleDefinition): (ctx: ProductCheckContext) => RuleVerdict;
//# sourceMappingURL=pattern-interpreter.d.ts.map