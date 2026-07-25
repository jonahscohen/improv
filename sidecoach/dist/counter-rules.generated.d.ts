export interface CounterRule {
    provider: string;
    rule: string;
    fired: number;
    total: number;
    rate: number;
    guidance: string;
}
export declare const COUNTER_RULE_RATE_MIN = 0.3;
export declare const COUNTER_RULE_MIN_TOTAL = 5;
export declare const COUNTER_RULES: CounterRule[];
/** The classes provider P over-produces, most-fired first. */
export declare function counterRulesForProvider(provider: string): CounterRule[];
/** The "watch <class>" guidance lines for provider P (empty when P has no over-produced class). */
export declare function counterRuleGuidanceForProvider(provider: string): string[];
//# sourceMappingURL=counter-rules.generated.d.ts.map