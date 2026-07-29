/**
 * Sidecoach image BRIEF COMPILER - one weak brief in, a strong prompt AND its verification contract out.
 *
 * THE PROBLEM THIS SOLVES, stated as the failure it prevents. A human asks for "a hero image for the pricing
 * page". Handed straight to a generator that yields a photograph of an office with some lettering baked into it:
 * wrong medium, wrong structure, unusable text, and nothing anywhere that says whether the headline that lands on
 * top will be readable. Every part of what makes that request answerable - which visual world, which staging,
 * which regions in what order, which real palette, what must NOT appear, and where the live text will sit - is
 * absent from the brief. A prose instruction telling the model to remember all of it works exactly as well as
 * the model's attention that day. So it is compiled instead.
 *
 * WHAT COMPILATION MEANS HERE. Three catalogs and the project's own files are joined into one artifact:
 *
 *   WORLD      direction-deck.ts, the same deck the direction roll draws from. One authored catalog, two
 *              consumers, so the image world and the build's design direction cannot disagree. The deck's
 *              outside-ranking property comes along for free: the default product-marketing look is the entry
 *              this compiler will not draw, so an unspecified brief never lands on the sameness.
 *   STAGING    image-composition-catalog.ts, palette-free and type-free by enforced contract, so the structure
 *              can be strong without deciding a look nobody chose.
 *   TRUTH      the project's DESIGN.md tokens and PRODUCT.md anti-references. Real hexes beat adjectives, and a
 *              named anti-reference is a negative constraint the generator can actually act on.
 *
 * THE PROPERTY THAT MATTERS MOST. The prompt and the VERIFICATION CONTRACT are emitted from the same resolution.
 * The staging says where the live text sits; that one field becomes both the "keep this region quiet" instruction
 * and the pixel rectangle the contrast check reads back out of the decoded image. The check therefore measures
 * the region the prompt was told to protect. Nobody has to remember to pass the right numbers, because there is
 * only one set of numbers.
 *
 * HONESTY BOUNDARY, and it is load-bearing. This compiler never invents a fact. Where DESIGN.md has no text
 * colour, it does NOT pick one to make the contrast check look contracted; it reports the gap in
 * `briefStrength.missing` and leaves the ink unset, so the downstream verdict is honestly "contrast not checked"
 * rather than "contrast passed against a colour we made up". Same for the product's name, its claims, and its
 * numbers: absent means absent, and the prompt says so out loud in its text policy.
 *
 * PURITY. Everything here is a pure function of its inputs. No file reads, no network, no clock, no RNG. The
 * caller supplies parsed tokens; the compiler decides. Deterministic by construction, so the same brief compiles
 * to the same prompt and therefore hits the same content-addressed cache entry.
 */
import type { DesignTokens } from './design-md-parser';
import { type Direction } from './direction-deck';
import { type ImageComposition, type ImageRole, type ImageSurface } from './image-composition-catalog';
export interface ImageBrief {
    /** Whatever the human actually said. May be as thin as "hero image". */
    text: string;
    /** Explicit overrides. Each one supplied is one dimension the compiler did not have to resolve. */
    role?: ImageRole;
    surface?: ImageSurface;
    /** A direction-deck id, when the build has already committed to a world. */
    directionId?: string;
    compositionId?: string;
    /** "WIDTHxHEIGHT". When absent it is derived from the staging's native aspect. */
    size?: string;
    /** Alpha requirement, when the build knows it needs a cutout. */
    alpha?: 'require' | 'forbid';
}
export interface CompileContext {
    /** brand or product, from PRODUCT.md. */
    register?: string;
    /** The project's stated visual approach, matched against the deck before any draw happens. */
    approach?: string;
    /** The product's real name. Used only to permit ONE piece of legible text; never invented. */
    productName?: string;
    /** Parsed DESIGN.md frontmatter. The source of every hex this compiler will emit. */
    designTokens?: DesignTokens | null;
    /** PRODUCT.md anti-references, folded into the negative constraints verbatim. */
    antiReferences?: readonly string[];
    /**
     * What geometries the provider about to be called can actually serve. Defaults to the OpenAI list, the
     * strictest set in play. See SizePolicy for why this is not one fixed answer.
     */
    sizePolicy?: SizePolicy;
}
/** The contract handed to the verifier. Every field here is derived, none is defaulted into existence. */
export interface ImageVerificationContract {
    size: string;
    format: 'png';
    /** The real hex of the text that will sit on this asset. Absent when DESIGN.md does not name one. */
    ink?: string;
    /** Pixel rectangle for the contrast measurement, derived from the staging's ink zone. */
    inkRegion?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /** WCAG ratio the measured region must clear. Set only when `ink` is known. */
    minContrast?: number;
    alpha?: 'require' | 'forbid';
    /** Which DESIGN.md token the ink came from, so a reader can audit the number. */
    inkSource?: string;
}
export interface BriefStrength {
    /** 0-100. The share of the ten resolvable dimensions the HUMAN supplied. Low is normal, not a failure. */
    score: number;
    /** Dimensions the human supplied. */
    fromBrief: string[];
    /** Dimensions the compiler resolved, each with where it came from. */
    supplied: string[];
    /** Facts nothing could supply. These are honest gaps, and each one weakens a specific check. */
    missing: string[];
}
export interface CompiledImageBrief {
    /** The prompt, sections in reading order. */
    prompt: string;
    /** Section name to body, for inspection and testing without parsing the prompt back. */
    sections: Array<{
        name: string;
        body: string;
    }>;
    contract: ImageVerificationContract;
    concept: Direction;
    composition: ImageComposition;
    role: ImageRole;
    surface: ImageSurface;
    briefStrength: BriefStrength;
    /** Stable 12-hex digest of the compiled prompt. Used for output filenames. */
    digest: string;
}
/**
 * The role the brief asked for, and the word that gave it away. Null when the brief names no raster at all.
 *
 * Matching is word-boundary anchored, so "imagery" does not match "image" and "backgrounds" still does. A hit
 * inside a false-friend phrase is discarded and the scan continues, so one CSS mention cannot suppress a real
 * asset request elsewhere in the same sentence.
 */
export declare function detectRole(text: string): {
    role: ImageRole;
    matched: string;
} | null;
export declare function detectSurface(text: string): {
    surface: ImageSurface;
    matched: string;
} | null;
/**
 * Whether this brief calls for a raster asset at all.
 *
 * Exported and used as a GATE by the flow wiring: a component that needs no image gets no image and is told so,
 * rather than the flow quietly generating a plate nobody asked for. A capability that fires on everything is not
 * discoverable, it is noise.
 */
export declare function briefWantsRaster(text: string): boolean;
/**
 * Resolve the visual world.
 *
 * Priority: an explicit deck id, then the project's stated approach matched against deck ids and names, then a
 * deterministic draw from the deck. The draw EXCLUDES the deck's default-instinct entry, which is the whole
 * reason to reuse this deck: an unspecified brief cannot land on the conventional product-marketing look, ever.
 */
export declare function resolveConcept(brief: ImageBrief, ctx: CompileContext): {
    concept: Direction;
    basis: string;
};
/**
 * Resolve the staging for a role and surface.
 *
 * A role match is mandatory; a surface match is preferred but not required, because a role with no staging on the
 * requested surface is better served by that role's home staging than by a staging that cannot hold it. When it
 * falls back across surfaces the basis says so, so the compromise is visible rather than silent.
 */
export declare function resolveComposition(brief: ImageBrief, role: ImageRole, surface: ImageSurface): {
    composition: ImageComposition;
    basis: string;
};
export interface PaletteEntry {
    path: string;
    hex: string;
}
/**
 * Flatten DESIGN.md's colour tokens to dotted-path/hex pairs, in document order.
 *
 * Only real hex values survive. A token whose value is a `{reference}` or a non-colour string is dropped rather
 * than emitted as text, because a prompt carrying "{color.brand.primary}" is worse than one carrying no palette
 * at all: it looks specified and instructs nothing.
 */
export declare function flattenPalette(tokens: DesignTokens | null | undefined, limit?: number): PaletteEntry[];
/**
 * The colour of the text that will sit on this asset, if DESIGN.md names one.
 *
 * Searched by intent, in the order a design system usually spells it. Returns null rather than a guess: the whole
 * value of the contrast check is that its number is real, and a check run against an invented ink is a check that
 * certifies nothing while looking like it certified something.
 */
export declare function resolveInk(tokens: DesignTokens | null | undefined): PaletteEntry | null;
/** The three geometries OpenAI images accepts. Anything else is rejected locally, before it can spend. */
export declare const OPENAI_SIZES: readonly string[];
/**
 * How a size may be chosen. Either snap to a fixed list, or take the staging's own aspect at a bounded edge.
 *
 * THIS EXISTS BECAUSE SIZE IS PROVIDER-SPECIFIC AND PRETENDING OTHERWISE COSTS A CALL. Discovered live: the
 * compiler emitted 1536x1024 for a 16:9 staging, which is valid on OpenAI, and the Gemini adapter buckets it as
 * 2K, and the cheapest Gemini image model answers "Image size 2K is not supported for this model" with an HTTP
 * 400. One geometry does not fit every provider, so the caller states the policy for the provider it is actually
 * going to call, and the rule is: the size must be servable by EVERY provider this invocation might reach.
 */
export interface SizePolicy {
    /** Snap to the nearest-aspect member of this list. */
    allowed?: readonly string[];
    /** Or: keep the staging's aspect exactly, with the longer edge at most this many pixels. */
    maxEdge?: number;
}
/**
 * Derive a pixel size from the staging's aspect under a size policy.
 *
 * Defaults to the OpenAI list, which is the safe choice when nothing is known: it is the strictest set in play,
 * and every member of it is a real geometry rather than an arbitrary rectangle.
 */
export declare function sizeForAspect(aspect: string, policy?: SizePolicy): string;
/**
 * The standing negative constraints, in three groups.
 *
 * MEDIUM bans are what turns a picture into a designed surface, and they are the single highest-leverage lines in
 * the whole prompt: without them a generator returns a photograph of the subject instead of the subject's
 * interface.
 *
 * CALIBRATION bans name the looks that generated interfaces converge on regardless of subject. They are here
 * because a brief that leaves the aesthetic open gets the same three looks from every model, and a build that
 * lands there did not choose it.
 *
 * CALIBRATION BANS ARE CONDITIONAL, and this is the one rule in this file that must not be forgotten: they apply
 * only when NO palette is committed. A project whose DESIGN.md commits a warm paper surface has CHOSEN it, and
 * emitting "not the warm cream ground" alongside "use #f7f4ee" hands the generator a contradiction and quietly
 * overrides a real design decision with a generic caution. The committed palette always wins. Found by reading
 * the first compiled prompt, which contained exactly that contradiction.
 *
 * TRUTH bans are the ones that keep a generated asset from putting a claim in front of a user that the product
 * never made. An invented price or metric rendered into a hero plate is a false statement shipped as art.
 */
export declare const MEDIUM_BANS: readonly string[];
export declare const CALIBRATION_BANS: readonly string[];
/**
 * The last entry is conditional on a permitted string existing. Emitting "no lettering other than the one
 * permitted string" when no string is permitted describes a permission that was never granted, which is exactly
 * the kind of small incoherence a generator resolves by inventing one.
 */
export declare const TRUTH_BANS: readonly string[];
export declare const TRUTH_BAN_ONE_STRING = "no lettering other than the one permitted string named in the TEXT section";
export declare const TRUTH_BAN_NO_STRING = "no lettering at all, anywhere, in any script";
/**
 * Compile a brief into a prompt and a verification contract.
 *
 * Returns null when the brief calls for no raster at all, which is a legitimate outcome and the caller must
 * report it as one. Never throws: a catalog or token problem degrades a dimension and says so in `briefStrength`
 * rather than failing a build flow.
 */
export declare function compileImageBrief(brief: ImageBrief, ctx?: CompileContext): CompiledImageBrief | null;
/** One-line summary of a compilation, for a guidance line or a log. */
export declare function summarizeCompilation(c: CompiledImageBrief): string;
//# sourceMappingURL=image-brief-compiler.d.ts.map