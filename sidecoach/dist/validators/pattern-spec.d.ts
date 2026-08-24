/** The only engine kind understood today. An unknown engine is fail-closed (inconclusive). */
export declare const PATTERN_SPEC_ENGINE: "static-css-regex";
export type PatternSpecScope = 'css' | 'markup' | 'both';
/** One defect regex carried as DATA. `pattern` is the source; `flags` is sanitized. */
export interface PatternSpecRegex {
    pattern: string;
    flags?: string;
}
/** A numeric refinement: run the named allowlisted predicate against `threshold`. */
export interface NumericGuard {
    predicateId: string;
    threshold: number;
}
export interface PatternSpec {
    specVersion: number;
    engine: string;
    applicability: {
        anyOf: string[];
        scope?: PatternSpecScope;
    };
    defect: {
        anyOf: PatternSpecRegex[];
        numericGuard?: NumericGuard;
    };
    message: string;
    remediation?: string;
    evidenceScope?: PatternSpecScope;
}
/** One labeled example, mirroring eval/corpus-tool.mjs canonicalRecord fields. */
export interface ExampleRef {
    id: string;
    file: string;
    contentSha256: string;
    label: 'fires' | 'clean';
    labeledBy: string;
    split: 'tune' | 'heldout';
    provenance?: Record<string, unknown>;
}
export interface ExampleCorpus {
    positives: ExampleRef[];
    negatives: ExampleRef[];
}
export declare const MAX_REGEX_SOURCE_LEN = 1000;
export declare const MAX_SCAN_LEN = 200000;
export declare const MAX_QUANTIFIERS = 60;
export declare const MAX_GROUP_DEPTH = 25;
export declare const MAX_DEFECT_MATCHES = 200;
export declare const DEFAULT_APPLICABILITY_FLAGS = "i";
/**
 * Validate candidate-supplied regex flags. REJECTS (never silently drops) a non-string value, a
 * character outside the allowed subset (`i`/`m`/`s`/`u` - `g`/`y` carry lastIndex state the
 * interpreter manages itself, `d`/`v` are unneeded), and a duplicate. Silently dropping a bad
 * flag was a false-pass hazard: an intended `i` lost to sanitization made a defect that should
 * match return pass (Codex fold 2). Returns the validated flag string or an error.
 */
export declare function validateFlags(flags?: unknown): {
    flags: string;
} | {
    error: string;
};
interface RE2Instance {
    test(s: string): boolean;
    exec(s: string): (RegExpExecArray | null);
    source: string;
    flags: string;
    lastIndex: number;
}
/** True iff the linear-time engine is available (used by tests / diagnostics). */
export declare function re2Available(): boolean;
/**
 * Reject a regex SOURCE that could backtrack catastrophically, BEFORE it is ever compiled or
 * run. This is a single linear pass, deliberately CONSERVATIVE: it favors rejecting a safe
 * pattern (which only ever yields an inconclusive verdict / a filed preflight error) over
 * admitting an unsafe one (which could hang the gate). It catches:
 *   - a source longer than MAX_REGEX_SOURCE_LEN,
 *   - a backreference (\1..\9 or \k<name>) - matching with backrefs is not linear,
 *   - a nested unbounded quantifier / star-height >= 2 (`(a+)+`, `(a*)*`, `((a+))+`, ...),
 *     the classic exponential family,
 *   - more than MAX_QUANTIFIERS quantifiers or deeper than MAX_GROUP_DEPTH group nesting.
 *
 * It does NOT attempt to decide ambiguous-alternation ReDoS (`(a|a)*`); that is undecidable by
 * a linear screen. The input-length cap bounds such cases, and re2/worker execution is the
 * noted upgrade path (Phase 3 design, Revisit). Every regex the interpreter and miner run has
 * passed this screen first.
 */
export declare function screenRegexSource(source: string): {
    safe: boolean;
    reason?: string;
};
/** A compiled UNTRUSTED regex: the linear-time re2 instance plus the validated source/flags. */
export interface GuardedRegex {
    re: RE2Instance;
    source: string;
    flags: string;
}
/**
 * Compile an UNTRUSTED candidate regex through the linear-time engine (re2). Validates the flags
 * (Codex fold 2), bounds the source length, then compiles via re2. Returns the compiled instance
 * or an error - fail-closed: if re2 is unavailable, or rejects the syntax, or the flags are
 * malformed, the caller (interpreter) turns the error into `inconclusive` and the miner files it.
 * re2 is the linear-time RUNTIME control; screenRegexSource (below) is a separate fast preflight
 * DIAGNOSTIC the miner also runs, no longer the sole control. Never throws.
 */
export declare function compileGuarded(source: string, flags?: string): {
    re: GuardedRegex;
} | {
    error: string;
};
/**
 * Run an UNTRUSTED regex over `text` with re2 (linear-time), collecting up to `cap` matches
 * ({ match, index }). Compiles a fresh GLOBAL re2 each call so there is no shared lastIndex state,
 * and steps past a zero-width match so it cannot loop forever. Fail-closed: re2 unavailable or a
 * compile failure returns an error. Never throws.
 */
export declare function execCapped(source: string, flags: string, text: string, cap: number): {
    matches: {
        match: string;
        index: number;
    }[];
    error?: string;
};
export interface PredicateInput {
    text: string;
    cssText: string;
    markup: string;
    matches: string[];
}
export type NumericPredicate = (input: PredicateInput, threshold: number) => boolean;
/**
 * The allowlist. Each predicate is a small pure fn keyed by id; the candidate supplies only the
 * id + threshold. Direction (>=, <=) is INTRINSIC to the predicate and documented per entry.
 */
export declare const NUMERIC_PREDICATES: Record<string, NumericPredicate>;
export declare function isKnownPredicate(id: unknown): id is string;
export declare function normalizeScope(scope: unknown): PatternSpecScope;
/**
 * Validate a patternSpec's DATA without executing it: engine is known, every applicability and
 * defect regex passes the ReDoS screen and compiles, an optional numericGuard names an
 * allowlisted predicate with a finite threshold, and message is present. Returns the full error
 * list (a malformed spec is FILED with these, never dropped). Never throws.
 */
export declare function screenPatternSpec(spec: unknown): {
    ok: boolean;
    errors: string[];
};
export {};
//# sourceMappingURL=pattern-spec.d.ts.map