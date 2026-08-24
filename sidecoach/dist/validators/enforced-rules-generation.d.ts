import type { ProductRuleDefinition, CanonicalSeverity } from '../product-rule-types';
/** The severity a certified enforced mined rule compiles at (blocking). */
export declare const ENFORCED_SEVERITY: CanonicalSeverity;
/** The precision threshold a ledgered enforced rule must have cleared to compile live. */
export declare const ENFORCE_GEN_PRECISION_THRESHOLD = 0.9;
/** One enforced-tier record as read off data/enforced-rules/<id>.json (the enforce CLI wrote it). */
export interface EnforcedRecord {
    fileStem: string;
    obj: Record<string, unknown>;
}
/** The trusted (audit-verified) ledger entry fields this gate reads. */
export interface LedgerEntryView {
    ruleId: string;
    content_digest?: string;
    precision_digest?: string;
    precision?: number | null;
}
/** The production floor a certified record must have been measured at (Codex MEDIUM #3). */
export declare const ENFORCE_GEN_MIN_HELDOUT_POSITIVES = 8;
export declare const ENFORCE_GEN_MIN_FIRES = 8;
/** A precision cache record (eval/.taste-enforce-cache/<id>.json). The floor fields it was measured
 *  UNDER are recorded so the codegen can reject a record measured under a weakened floor. */
export interface PrecisionRecordView {
    precisionDigest?: string;
    buildStamp?: string;
    pass?: boolean;
    precision?: number | null;
    threshold?: number;
    minHeldoutPositives?: number;
    minFires?: number;
    recomputedPrecisionDigest?: string;
}
export interface DeriveInputs {
    records: EnforcedRecord[];
    ledgerByRuleId: Map<string, LedgerEntryView>;
    precisionByRuleId: Map<string, PrecisionRecordView>;
    currentBuildStamp: string;
    requiredThreshold?: number;
    requiredMinHeldoutPositives?: number;
    requiredMinFires?: number;
    threshold?: number;
}
export interface DeriveResult {
    certified: ProductRuleDefinition[];
    errors: string[];
}
/**
 * Gate every enforced record and build the certified ProductRuleDefinitions. FAIL-CLOSED: any record
 * that lacks an audit-verified ledger entry, whose ledgered precision is under threshold, or whose
 * precision record is missing / mismatched / stale, is pushed to `errors` (and NOT certified). The
 * caller exits non-zero when `errors` is non-empty, so the build breaks rather than compiling it.
 */
export declare function deriveEnforcedRules(inp: DeriveInputs): DeriveResult;
/**
 * Render the generated TS module. The certified rules are inlined as LITERALS (like
 * counter-rules.generated.ts) - the module imports NO data, so src/ still imports nothing from the
 * data tier; the data was read only by the codegen wrapper at build time. A stable header + sorted
 * rules keep `--check` reproducible.
 */
export declare function renderEnforcedRulesModule(certified: ProductRuleDefinition[]): string;
//# sourceMappingURL=enforced-rules-generation.d.ts.map