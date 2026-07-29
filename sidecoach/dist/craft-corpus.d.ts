import { PolishCraftNote } from './polish-craft';
/**
 * A craft note: what good looks like, why it matters, the concrete fix, and where it came from.
 *
 * Structurally the reference implementation's note plus an optional explicit `severity`, so a
 * `PolishCraftNote` is assignable here unchanged and the two corpora interoperate.
 */
export interface CraftNote extends PolishCraftNote {
    /** Explicit rank for notes with no registry severity (the law corpus). */
    severity?: 'blocker' | 'major' | 'minor' | 'advisory';
}
/**
 * Craft notes for the registry rules `POLISH_CRAFT` does not cover.
 *
 * Keyed by canonical rule key, so a probe result maps straight onto a note. Coverage over the whole
 * registry is asserted by `registryCraftGaps()` and by `__tests__/craft-corpus.test.ts`: a rule
 * added to the registry without a note here fails a test rather than reaching a payload as a bare
 * defect name.
 */
export declare const REGISTRY_CRAFT: Record<string, CraftNote>;
/**
 * Resolve any accepted rule shape to a craft note.
 *
 * Consults, in order: this module's registry notes, the law corpus, then the polish corpus (which
 * also handles the `polish-standard:N` aliases, the finding classes, and the dynamic named bans).
 * Returns undefined for an unknown key rather than guessing, so a caller keeps its own fallback.
 */
export declare function resolveCraftNote(rule: string | number | null | undefined): CraftNote | undefined;
/** The severity used to rank a note: the registry's, else the note's own, else unranked. */
export declare function craftSeverityRank(note: CraftNote): number;
/**
 * Registry rules with no craft note anywhere.
 *
 * Empty is the invariant. A non-empty return means a rule was added to the registry without teaching
 * content, and a payload that failed it would hand back the bare defect name - the exact defect this
 * module exists to remove.
 */
export declare function registryCraftGaps(): string[];
/** How many notes a single brief may teach, and how many of those may carry an example. */
export declare const MAX_BRIEF_NOTES = 6;
export declare const MAX_BRIEF_EXAMPLES = 2;
/**
 * Select notes for a set of subjects, hardest-first then stable, deduplicated, and capped.
 *
 * Ties break on the note's own key rather than input order, so two runs over one project produce
 * the same brief. Unknown subjects are dropped rather than guessed at.
 */
export declare function selectCraftNotes(subjects: Array<string | number>, limit?: number): CraftNote[];
export interface CraftBriefOptions {
    /**
     * `findings` - the subjects are rules that FAILED on this project. The default.
     * `standard` - the subjects are the up-front standard for a flow that has nothing to measure yet.
     * The header states which, because they are different claims about where the brief came from.
     */
    mode?: 'findings' | 'standard';
    limit?: number;
    examples?: number;
    /** What the flow is about, used in the header line, e.g. "responsive behaviour". */
    domainLabel?: string;
    /** Extra context appended to the provenance line, e.g. "measured across 12 files". */
    measuredNote?: string;
}
/**
 * Render the craft brief - the TEACH half of a flow payload.
 *
 * Returns [] when there is nothing to teach, because a constant block appended to every run is the
 * defect this replaces. A caller decides what to print in that case; a clean page should say so
 * rather than being handed a brief it did not earn.
 */
export declare function craftBriefLines(subjects: Array<string | number>, opts?: CraftBriefOptions): string[];
/** The concrete remediation for a rule, for a report's "what to do" column. */
export declare function craftRemediation(rule: string | number | null | undefined): string | undefined;
//# sourceMappingURL=craft-corpus.d.ts.map