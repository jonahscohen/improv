import type { CollectedFile, ProductCheckContext } from './check-context';
/** A contiguous run of source text, and the FILE line its first character sits on. */
export interface SourceRegion {
    path: string;
    text: string;
    /** 1-based file line of text[0]. */
    startLine: number;
}
export type LocationScope = 'css' | 'markup' | 'both';
/** 1-based line of a character offset. Counts newlines only - no allocation per line. */
export declare function lineOfOffset(text: string, offset: number): number;
/** Map an offset inside a region back to its file line. */
export declare function fileLineOf(region: SourceRegion, offsetInRegion: number): number;
/**
 * The CSS regions of one collected file, each carrying the file line it starts on.
 *
 * A css-family file is one region starting at line 1. A markup file's regions are its
 * `<style>` bodies, re-derived from `markup` (NOT from `cssText`, which has already lost
 * the positions). A markup file with no `<style>` block has no CSS regions, which is the
 * honest answer: there is no CSS in this file to point at.
 */
export declare function cssRegionsOf(file: CollectedFile): SourceRegion[];
/** The markup region of one collected file (the whole file), or none for a pure CSS file. */
export declare function markupRegionOf(file: CollectedFile): SourceRegion | undefined;
/** EXPORTED region accessor for callers that must scan source themselves (e.g. the patternSpec
 *  interpreter, which runs UNTRUSTED regexes through re2 rather than a native RegExp and so cannot
 *  use locate()). Same regions locate() uses, so reported lines stay consistent. */
export declare function sourceRegions(ctx: ProductCheckContext, scope: LocationScope): SourceRegion[];
/**
 * Every `path:line` where `re` matches, across the requested scope, capped at `limit`.
 *
 * Returns [] when nothing matched - and [] is what a check must then report, because an
 * invented location is worse than none. The caller never fabricates a fallback.
 */
export declare function locate(ctx: ProductCheckContext, re: RegExp, scope?: LocationScope, limit?: number): string[];
/** First location only - the common case for a single-anchor finding. */
export declare function locateFirst(ctx: ProductCheckContext, re: RegExp, scope?: LocationScope): string[];
/**
 * Locations of the matches of `re` that ALSO satisfy `keep`, indexed by match order.
 *
 * For rules that fail on a SUBSET of matches - "3 of 5 images lack width+height" - so the
 * reported lines are the three offending tags and not all five. `index` is the running
 * position across the whole scope, matching the order the check itself counts in, so an
 * order-sensitive predicate (the first image is the exempt hero) stays consistent with the
 * verdict it decorates.
 */
export declare function locateWhere(ctx: ProductCheckContext, re: RegExp, keep: (matchText: string, index: number) => boolean, scope?: LocationScope, limit?: number): string[];
/**
 * The anchor target per rule: the SAME regex that rule's applicability probe tested, in
 * probe order for the composite ones. Keyed by canonicalRuleKey so it lines up 1:1 with
 * check-context's PROBES table; `source-locator.test.ts` asserts the two key sets are
 * identical, so adding a probe without an anchor (or the reverse) fails the suite rather
 * than silently shipping a rule that can never report where to fix it.
 */
export declare const RULE_ANCHOR_TARGETS: Record<string, {
    re: RegExp;
    scope: LocationScope;
}[]>;
/** The focusable anchor is used by a11y/focus-visible, which has no PROBES entry. */
export declare const FOCUSABLE_ANCHOR: {
    re: RegExp;
    scope: LocationScope;
}[];
/** Resolve an anchor location list by trying each target in probe order. */
export declare function locateAnchor(ctx: ProductCheckContext, targets: {
    re: RegExp;
    scope: LocationScope;
}[]): string[];
/** Anchor location for a rule identified by canonicalRuleKey. [] when it has no anchor. */
export declare function locateRuleAnchor(ctx: ProductCheckContext, canonicalRuleKey: string): string[];
//# sourceMappingURL=source-locator.d.ts.map