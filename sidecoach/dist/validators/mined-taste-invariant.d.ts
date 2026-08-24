import type { CanonicalSeverity, SourceVocabulary } from '../product-rule-types';
/** The blocking severity set (mirrors validator-generation BLOCKING). */
export declare const BLOCKING_SEVERITIES: readonly CanonicalSeverity[];
/** The vocabulary tag every mined rule carries (bin/sidecoach-mine.js normalizeCandidate default). */
export declare const MINED_TASTE_VOCABULARY: SourceVocabulary;
/** The minimum shape the invariant needs off a rule (registry def OR an enforced-tier rule body). */
export interface MinedRuleView {
    ruleId: string;
    sourceVocabulary: SourceVocabulary | string;
    severity: CanonicalSeverity | string;
}
/** The two backing predicates the invariant is defined against - injected, never imported. */
export interface EnforcementBacking {
    /** True iff the enforcement ledger has an entry for this ruleId. */
    hasLedgerEntry(ruleId: string): boolean;
    /** True iff a passing precision record (P>=threshold, denominator over floor) exists for this ruleId. */
    hasPassingPrecision(ruleId: string): boolean;
}
export declare function isBlockingSeverity(sev: CanonicalSeverity | string): boolean;
export declare function isMinedTaste(vocab: SourceVocabulary | string): boolean;
/**
 * Return one human-readable error per invariant violation (empty => the invariant holds). A
 * violation is a mined-taste rule at a blocking severity that is missing its ledger entry and/or its
 * passing precision record. The caller fails loud (nonzero exit / a test failure) when this is
 * non-empty. Never throws.
 */
export declare function minedTasteBlockingViolations(rules: MinedRuleView[], backing: EnforcementBacking): string[];
//# sourceMappingURL=mined-taste-invariant.d.ts.map