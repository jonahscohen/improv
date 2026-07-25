export declare const COUNTER_RULE_RATE_MIN = 0.3;
export declare const COUNTER_RULE_MIN_TOTAL = 5;
export interface RuleCell {
    fired: number;
    total: number;
    rate: number | null;
}
export interface DistArtifact {
    schema: string;
    generatedUtc: string;
    ruleUniverse: string[];
    distribution: Record<string, Record<string, RuleCell>>;
}
export interface CounterRule {
    provider: string;
    rule: string;
    fired: number;
    total: number;
    rate: number;
    guidance: string;
}
/** Derive the counter-rule set from a distribution artifact. Deterministic order: provider asc, rate desc, rule asc.
 *  Throws on a distribution that names a class outside its own ruleUniverse (a corrupt artifact must fail the build,
 *  never silently emit a class the product does not detect). */
export declare function deriveCounterRules(art: DistArtifact): CounterRule[];
/** Render the generated product module text. Embeds only STABLE inputs (the artifact's own generatedUtc + the frozen
 *  thresholds), never new Date(), so re-running on the same distribution is byte-identical and --check is meaningful. */
export declare function renderCounterRulesModule(art: DistArtifact, rules: CounterRule[]): string;
//# sourceMappingURL=counter-rule-generation.d.ts.map