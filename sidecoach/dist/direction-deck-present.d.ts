/**
 * Sidecoach direction presentation (Stage 2d) - the exclusion-safe deck.
 *
 * Presents a set of rolled directions (drawn by the Stage 2c roll) for a DECISION, without any interactive
 * in-browser surface. Two renderings, chosen by the caller's surface:
 *   - RICH surface  -> a self-contained visualizer ARTIFACT: static HTML, one card per direction. The viewer
 *                      reads it and decides; nothing on the page does anything.
 *   - TEXT surface  -> a clean Markdown deck: a table plus a short per-direction detail block.
 * The user picks by RESPONDING (a number or an id). A re-roll is a re-invocation of Stage 2c - this module
 * never re-rolls, never edits, never previews a variant.
 *
 * HARD EXCLUSION (the load-bearing property): there is NO in-browser variant surface anywhere in this track.
 * The rich rendering is STATIC HTML only - no network server, no client runtime, no embedded preview frame,
 * no variant-preview code path. It reuses the Stage 2c deck by IMPORTING it; it owns no roll logic. These
 * exclusions are verified two ways: a self-source scan in the test asserts none of the forbidden runtime
 * patterns appear in this module or its bin, and the diff is grepped at review time.
 *
 * DETERMINISM: both renderers are pure string builders over the resolved directions - the same directions in
 * the same order yield byte-identical output. No clock, no RNG, no ambient state.
 */
import { type Direction } from './direction-deck';
export interface ResolveResult {
    directions: Direction[];
    /** ids that are not in the deck (empty => every id resolved). */
    unknown: string[];
    /** ids that appeared more than once (empty => no duplicates). */
    duplicates: string[];
}
/**
 * Resolve an ordered id list into deck directions, reporting any unknown or duplicate ids. The presentation
 * is a DECISION surface, so a typo'd id (silently dropped) or a duplicated option would corrupt the choice -
 * the bin fails loud on either rather than presenting a wrong deck.
 */
export declare function resolveDirections(ids: readonly string[]): ResolveResult;
export interface PresentOptions {
    /** Deck title, shown as the heading / artifact title. */
    title?: string;
}
/**
 * Render the directions as a clean Markdown deck: a summary table (option, direction, axis, premise) followed
 * by one detail block per direction (moves + what it avoids), closed by the pick instruction. Pure Markdown -
 * no HTML, no ANSI, no chrome.
 */
export declare function renderDeckMarkdown(directions: readonly Direction[], opts?: PresentOptions): string;
/**
 * Render the directions as a self-contained static HTML artifact for a rich surface. Theme-aware
 * (prefers-color-scheme), responsive (a fluid grid, wide content scrolls inside its own container), and
 * entirely inert: it carries no runtime code, opens no network channel, and embeds no preview frame. The
 * viewer reads the cards and picks by responding in chat.
 */
export declare function renderDeckArtifactHtml(directions: readonly Direction[], opts?: PresentOptions): string;
//# sourceMappingURL=direction-deck-present.d.ts.map