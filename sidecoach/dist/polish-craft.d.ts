/** One craft note: what good looks like, why, and the concrete fix. */
export interface PolishCraftNote {
    /** Canonical registry rule key, e.g. `polish/scale-on-press`. */
    ruleKey: string;
    /** Short human title for the brief heading. */
    title: string;
    /** What good looks like. */
    good: string;
    /** Why it matters - the reason a reader can act on, not a restatement of the rule. */
    why: string;
    /** The concrete remediation, with real values. */
    fix: string;
    /** Optional short snippet, emitted only for the highest-severity notes. */
    example?: string;
    /** Provenance: the in-repo file this note's substance comes from. */
    source: string;
}
/**
 * The corpus, keyed by canonical registry rule key.
 *
 * Coverage over the 24 `polish-standard:N` rules is asserted at runtime by
 * `craftCoverageGaps()` and in `__tests__/polish-craft.test.ts`, so a rule added to the registry
 * without a note here fails a test rather than silently falling back to the template.
 */
export declare const POLISH_CRAFT: Record<string, PolishCraftNote>;
/**
 * Notes for finding classes the polish flow reports that are NOT one of the 24 rules: the copy
 * scan, the named-ban scan, and the responsive gate. Same shape, keyed by the finding rule as it
 * reaches the executive report.
 */
export declare const POLISH_FINDING_CRAFT: Record<string, PolishCraftNote>;
/**
 * The per-ban finding rules (`anti-patterns:ban-<name>`) are resolved DYNAMICALLY from
 * `reference-loader.loadAbsoluteBans()` rather than restated here, because that list already owns
 * each ban's description and its prescribed rewrites. Restating them would create a second source
 * of truth that drifts the first time a ban is added, which is the failure that once let the
 * payload certify a ban whose scanner had been deleted.
 */
export declare const BAN_RULE_PREFIX = "anti-patterns:ban-";
/** A craft note for `anti-patterns:ban-<name>`, built from the ban reference. */
export declare function banCraftNote(rule: string): PolishCraftNote | undefined;
/**
 * How many notes may be TAUGHT in one brief, and how many of those carry an example.
 *
 * Not a guess. The brief has to stay short enough to be read in full by a producer that also has a
 * page and a task in front of it; past roughly eight principles a reader skims, and a skimmed
 * brief is the failure this file exists to fix. The findings list below the brief still enumerates
 * every violation, so the cap costs the reader an explanation, never a finding.
 */
export declare const MAX_TAUGHT_NOTES = 8;
export declare const MAX_EXAMPLES = 3;
interface RegistryPolishRule {
    n: number;
    key: string;
    severity: string;
}
/**
 * The `polish-standard:N` rules as the registry itself defines them: number, canonical key, and
 * severity. Read from the registry rather than restated here so the mapping cannot drift.
 *
 * Lazily required for the same reason `polish-standard-validator.ts` does it: the registry's check
 * modules import from that validator, and a static import chain through this file risks the same
 * cycle. Failure is non-fatal - an unreadable registry degrades to an empty mapping, and the
 * caller falls back to unranked ordering rather than throwing inside a guidance build.
 */
export declare function registryPolishRules(): RegistryPolishRule[];
/** `polish-standard:N` / `N` to the canonical rule key, or undefined when N is not a polish rule. */
export declare function polishRuleKeyForNumber(n: number): string | undefined;
/**
 * Normalise any of the shapes a polish rule arrives in to a craft-corpus key.
 *
 * Accepted: the canonical key (`polish/scale-on-press`), the BuildReport finding rule
 * (`polish-standard:rule-1`), the bare alias (`polish-standard:1`), and the finding-class keys in
 * POLISH_FINDING_CRAFT. Anything else returns undefined and the caller keeps its own fallback.
 */
export declare function normalizeCraftKey(rule: string | number | null | undefined): string | undefined;
/** The note for a rule in any accepted shape, or undefined. */
export declare function craftNote(rule: string | number | null | undefined): PolishCraftNote | undefined;
/** The concrete remediation for a rule, for the executive report's "After" column. */
export declare function craftRemediation(rule: string | number | null | undefined): string | undefined;
/**
 * The reason a rule matters, shaped for the executive report's plain-language CLAUSE.
 *
 * The renderer composes `<N> findings flagged; ` + this + `.`, and its own RULE_WHY map holds
 * lowercase sentence fragments for exactly that reason. A note's `why` is a full sentence because the
 * craft brief prints it as one, so handing it over raw produced
 * `flagged; It is reported so the total cannot drift..` - a capital mid-sentence and a doubled stop.
 * This converts sentence to clause: lowercase the first word unless it is an acronym or a code token,
 * and drop one trailing period. Only the FIRST sentence is used, so a two-sentence `why` cannot
 * smuggle a second full stop into the middle of the renderer's line.
 */
export declare function craftReason(rule: string | number | null | undefined): string | undefined;
/**
 * Registry polish rules with no craft note. Empty is the invariant; a non-empty return means a rule
 * was added to the registry without teaching content and the payload would fall back to a template.
 */
export declare function craftCoverageGaps(): string[];
/**
 * Select the notes to teach for a set of failing rules.
 *
 * Ordered by registry severity (blocker first), then by rule number so the order is stable across
 * runs, then capped. Unknown rules are dropped rather than guessed at.
 */
export declare function selectCraftNotes(rules: Array<string | number>, limit?: number): PolishCraftNote[];
/**
 * Render the craft brief: the TEACH half of the polish payload, selected by what actually failed.
 *
 * Returns [] when nothing failed, because a page that passes has nothing to be taught and a
 * constant block appended to every run is the defect this replaces.
 */
export declare function craftBriefLines(rules: Array<string | number>, opts?: {
    limit?: number;
    examples?: number;
}): string[];
export {};
//# sourceMappingURL=polish-craft.d.ts.map