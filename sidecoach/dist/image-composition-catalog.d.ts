/**
 * Sidecoach image COMPOSITION catalog - the staging half of the concept/composition layer.
 *
 * WHY THIS EXISTS. An image request that reaches a generator as "hero image for the pricing page" produces a
 * picture OF a pricing page: a vignette, a poster, a photograph with some lettering on it. What it needs to
 * produce is a designed surface whose regions are named in order with their scale relationships. That knowledge
 * is not in the human's brief and it is not in the model's default reach, so it has to live in a catalog and be
 * COMPILED IN. This file is that catalog.
 *
 * THE DIVISION OF LABOUR, and it is deliberate:
 *   - The WORLD (palette, material, type character) comes from `direction-deck.ts`. That deck already exists and
 *     already drives the direction roll, so the image world and the build's design direction are drawn from ONE
 *     catalog. Two consumers, one source of authorship.
 *   - The STAGING (frame, focal, depth, adaptation) comes from here, and carries NO palette and NO typeface, so
 *     any world can dress any staging. That separation is what lets a weak brief pick up a strong structure
 *     without also picking up a look nobody chose.
 *
 * THE PROPERTY NOTHING ELSE HERE HAS. Every entry declares an `inkZone`: the normalized rectangle where the
 * overlaid headline or label is going to sit. The prompt compiler emits that zone as a composition instruction
 * ("keep this region quiet") AND converts the same numbers into the pixel region the contrast check reads back
 * out of the decoded image. The instruction and the check are compiled from one field, so they cannot drift. An
 * asset that was told to keep its upper-left quiet is measured on its upper-left.
 *
 * THE VALIDATOR IS NOT DECORATION. `validateImageComposition` enforces the palette-free and type-free contract
 * MECHANICALLY: a grammar rule that names a colour, a hex, or a typeface is a validation error, not a comment
 * asking politely. A catalog whose separation is only documented drifts the first time somebody writes "warm
 * cream ground" into a staging rule. It is exercised over the shipped catalog by the test suite, so an entry
 * added later cannot land unchecked.
 */
/**
 * The visitor's mode. A staging that serves someone deciding whether to buy is a different species from one that
 * serves someone reading a table, and pretending otherwise is how a dashboard ends up with a full-bleed
 * atmosphere behind its numbers.
 */
export type ImageSurface = 'persuade' | 'operate' | 'read' | 'experience';
export declare const IMAGE_SURFACES: readonly ImageSurface[];
/**
 * What the asset IS in the build. This drives the medium decision as much as the prompt: a `texture` tiles and
 * must not carry a subject, a `backdrop` will have live text over it and therefore owns a contrast obligation,
 * an `object` needs alpha.
 */
export type ImageRole = 'backdrop' | 'plate' | 'texture' | 'object' | 'portrait' | 'scene' | 'thumbnail' | 'social-card';
export declare const IMAGE_ROLES: readonly ImageRole[];
/**
 * Grammar prefixes, in fixed order. The order is the reading order of the emitted prompt: what the frame is,
 * then where the eye goes, then what it is made of, then how it survives a different crop. A generator reads the
 * front of a prompt hardest, which is why the frame is first.
 */
export declare const COMPOSITION_GRAMMAR_PREFIXES: readonly string[];
/** Normalized rectangle, [x, y, w, h], each in 0..1 of the image's own dimensions. */
export type NormalizedRect = readonly [number, number, number, number];
export interface ImageComposition {
    /** Stable kebab-case slug. The only field identity logic keys on. */
    id: string;
    /** Short human name. */
    label: string;
    /** Visitor mode this staging serves. */
    surface: ImageSurface;
    /** Asset roles this staging can stage. First entry is its home role. */
    roles: readonly ImageRole[];
    /** Exactly three structural tags. */
    tags: readonly string[];
    /** Exactly four rules, in COMPOSITION_GRAMMAR_PREFIXES order. Palette-free and type-free by contract. */
    grammar: readonly string[];
    /**
     * Where overlaid live text is going to sit, normalized. Emitted into the prompt as a quiet-region instruction
     * AND converted to the pixel region the contrast check measures. One field, both uses.
     */
    inkZone: NormalizedRect;
    /** The staging's native aspect, as a "W:H" string. A hint for size resolution, never a hard constraint. */
    aspect: string;
    /** The default arrangement this staging exists to refuse. Folded into the prompt's DO NOT block. */
    refuses: string;
}
/**
 * Fourteen stagings. Small and authored, not sprawling: every entry names a frame a build could actually ship,
 * and the set spans all four visitor modes so a resolution never has to cross modes to find a match.
 */
export declare const IMAGE_COMPOSITION_CATALOG: readonly ImageComposition[];
export interface CompositionValidationResult {
    errors: string[];
    warnings: string[];
}
/** Validate one entry. Returns every error found, not just the first. */
export declare function validateImageComposition(entry: ImageComposition, seen?: {
    ids: Set<string>;
    labels: Set<string>;
}): string[];
/**
 * Validate the whole catalog, including the coverage properties a single entry cannot express: every surface
 * reachable, every role stageable. A role with no staging is a request the compiler would have to answer by
 * inventing one, which is the thing this layer exists to prevent.
 */
export declare function validateImageCompositionCatalog(catalog?: readonly ImageComposition[]): CompositionValidationResult;
export declare function compositionById(id: string): ImageComposition | undefined;
/** Every staging that can stage a role, home role first. */
export declare function compositionsForRole(role: ImageRole): ImageComposition[];
/**
 * Convert a normalized ink zone to the pixel rectangle the verifier reads. Clamped to the image so a rounding
 * error can never produce a region that starts outside the bytes; a zero-extent result returns null rather than
 * a degenerate rectangle, because the caller must then decline to contract the check instead of contracting an
 * unmeasurable one.
 */
export declare function inkZoneToPixels(zone: NormalizedRect, width: number, height: number): {
    x: number;
    y: number;
    w: number;
    h: number;
} | null;
//# sourceMappingURL=image-composition-catalog.d.ts.map