import { CraftNote } from './craft-corpus';
/**
 * The floor, as an ordered list of corpus keys.
 *
 * Chosen on one criterion: would a competent producer, mid-edit, with no verb invoked and no brief in
 * front of them, get this wrong often enough to be worth the tokens? Anything whose absence is
 * merely suboptimal is left to the per-verb brief. Anything whose absence makes the result FAIL for a
 * real reader - unreachable by keyboard, unreadable at contrast, unusable on a phone - is here.
 *
 * Ordered hardest-consequence first rather than by domain, because a truncated floor must still
 * carry its most important line.
 */
export declare const FLOOR_KEYS: string[];
/**
 * Named defaults the floor refuses outright, with the rewrite rather than only the ban.
 *
 * A ban list that says only what not to do sends the producer looking for a variant of the same
 * pattern, which is how a banned shape comes back wearing different class names. Each line here
 * names the replacement.
 */
export declare const FLOOR_REFUSALS: Array<{
    refuse: string;
    instead: string;
}>;
/** Floor keys that no longer resolve to a note. Empty is the invariant. */
export declare function floorCoverageGaps(): string[];
/** The resolved floor notes, in declaration order. */
export declare function floorNotes(): CraftNote[];
export interface FloorOptions {
    /** How many notes to render. Defaults to all of FLOOR_KEYS. */
    limit?: number;
    /** Include the refusal list. Default true. */
    refusals?: boolean;
    /**
     * `full` prints Good/Why/Do plus the source for each note - the reference form.
     * `compact` prints the actionable Do line with a short good-state clause, for a hook injection
     * where the budget is tight. Compact still cites its source, because an uncited rule in a hook
     * injection is the one a reader has no way to check.
     */
    form?: 'full' | 'compact';
    /** Path of the file being edited, named in the header so the floor is visibly about this edit. */
    filePath?: string;
}
/**
 * Render the craft floor.
 *
 * The header is the part that must not be softened: it states that this is a FLOOR, that it loaded
 * without a verb, and that nothing was measured. A reader who mistakes it for findings will go
 * looking for defects that were never detected.
 */
export declare function craftFloorLines(opts?: FloorOptions): string[];
/** The floor as one string, for a hook to inject. */
export declare function craftFloorText(opts?: FloorOptions): string;
/**
 * File extensions the floor considers UI work.
 *
 * Deliberately conservative: a false positive costs a few hundred tokens on an edit that did not need
 * them, and a false negative means the floor silently does not load, which is the failure this whole
 * mechanism exists to prevent. So the list is broad on markup/style and includes the component
 * formats, and the hook narrows further by looking for UI content.
 */
export declare const UI_EXTENSIONS: string[];
/** Whether a path looks like UI work the floor should load for. */
export declare function isUiPath(filePath: string): boolean;
//# sourceMappingURL=craft-floor.d.ts.map