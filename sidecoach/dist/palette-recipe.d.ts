/**
 * Sidecoach palette recipe (Stage 2a) - deterministic palette CONSTRUCTION.
 *
 * From a brand's hue/chroma anchors (a small structured brand input read from PRODUCT.md-adjacent
 * fixtures), construct a structured palette: a neutral base ramp, a primary accent ramp, and four
 * semantic-role ramps (success / warning / danger / info), each an OKLCH LIGHTNESS ramp gamut-mapped
 * into sRGB. Emit DESIGN.md token frontmatter (@google/design.md shape) whose components/body reference
 * tokens via `{token.path}` rather than hard-coded hex.
 *
 * WHAT THIS FILE IS NOT: it is NOT a contrast checker. Every required text/background pair is WCAG-checked
 * by the SHIPPING rendered scanner (src/validators/objective-rendered-scanner.ts, imported by the CLI) -
 * this module only BUILDS colors and the swatch page the scanner reads, and RESOLVES the scanner's findings
 * into a pass/fail verdict. There is exactly one contrast implementation in the product, and it is the
 * scanner's; this file never re-derives a luminance or a ratio. The on-color (text-on-accent) choice is made
 * by picking among scanner-VERIFIED candidates, never by a local contrast calc.
 *
 * DETERMINISM: OKLCH -> sRGB is pure math with fixed constants; the same brand input yields byte-identical
 * ramps, the same swatch page, and (because the scanner render is hermetic and its walk is document-ordered)
 * the same verdict and the same emitted DESIGN.md. No clock, no map-iteration-order dependence, no RNG.
 */
/** One color family's OKLCH anchor: a hue (deg) + a peak chroma. Lightness comes from the fixed ramp. */
export interface FamilySpec {
    /** OKLCH hue in degrees [0, 360). */
    hue: number;
    /** OKLCH peak chroma (before gamut mapping). Typical 0 (neutral) .. ~0.20 (vivid). */
    chroma: number;
    /**
     * Ramp stop used as this family's SOLID fill (button/background surface that carries on-color text).
     * Default 700. A fixture may pin it (e.g. 500) to model a brand that chose a too-light solid - the
     * recipe then fail-closes on that family's on-color pair rather than emitting an AA-failing palette.
     */
    solidStop?: RampStop;
}
export interface BrandFonts {
    display?: string;
    body?: string;
    mono?: string;
}
export interface BrandInput {
    name: string;
    description?: string;
    base: FamilySpec;
    primary: FamilySpec;
    success: FamilySpec;
    warning: FamilySpec;
    danger: FamilySpec;
    info: FamilySpec;
    fonts: Required<BrandFonts>;
}
/**
 * Validate and normalize a raw brand object (parsed from the --brand fixture JSON). Throws a precise Error on
 * any malformed field so the CLI can exit with a usage code and a named reason - never emit a partial palette.
 */
export declare function parseBrandInput(raw: unknown): BrandInput;
export type RampStop = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export declare const RAMP_STOPS: RampStop[];
/** Fixed OKLCH lightness per stop. Perceptually even, light (surfaces) -> dark (ink). */
export declare const STOP_LIGHTNESS: Record<RampStop, number>;
export interface OklchColor {
    L: number;
    C: number;
    H: number;
}
/**
 * Convert an OKLCH color to an in-gamut sRGB hex. If (L,C,H) is outside sRGB, reduce chroma toward 0
 * (binary search, hue + lightness fixed) until it fits - the CSS Color 4 gamut-mapping approach, which
 * also gives the natural chroma taper at very light/dark stops. Deterministic (fixed iteration count).
 */
export declare function oklchToHex({ L, C, H }: OklchColor): string;
export type Ramp = Record<RampStop, string>;
export declare function buildRamp(family: FamilySpec): Ramp;
export type FamilyName = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export declare const ACCENT_FAMILIES: Exclude<FamilyName, 'neutral'>[];
export interface Palette {
    brand: BrandInput;
    ramps: Record<FamilyName, Ramp>;
    /** The solid stop actually used for each family (default 700, or the family's pinned solidStop). */
    solidStop: Record<FamilyName, RampStop>;
}
export declare function buildPalette(brand: BrandInput): Palette;
export declare const ROLE_STOPS: {
    readonly textPrimary: RampStop;
    readonly textSecondary: RampStop;
    readonly textTertiary: RampStop;
    readonly textInverse: RampStop;
    readonly surfaceCanvas: RampStop;
    readonly surfaceRaised: RampStop;
    readonly surfaceSunken: RampStop;
    readonly surfaceInverse: RampStop;
    readonly link: RampStop;
};
export declare const paper: (p: Palette) => string;
export declare const ink: (p: Palette) => string;
/** The ramp stop `steps` positions darker than `stop` (clamped at 900). Used to derive hover/active shades
 * RELATIVE to a family's actual solid stop, so emitted state tokens never hard-code a stop that diverges
 * from the verified solid when solidStop is overridden. */
export declare function darkerStop(stop: RampStop, steps: number): RampStop;
export type PairSize = 'normal' | 'large';
/**
 * A single required text/background pair to be checked by the scanner. `onColorFor` marks the pair as an
 * on-accent CANDIDATE (paper or ink text on ONE of that accent's emitted surfaces - the solid, and for the
 * primary button its darker hover/active states). The verdict resolver picks, per accent, the ONE candidate
 * (paper or ink) that passed on EVERY one of that accent's surfaces, so the chosen on-color label is verified
 * on every background the palette actually emits for it. A pair with no `onColorFor` is a hard requirement.
 *
 * The integrity contract: EVERY text/background pair the recipe emits into DESIGN.md (button solid + hover +
 * active, badges, alert tints, wells, links, text-on-surface) is present here and gated. The recipe cannot
 * emit a pairing it did not scanner-verify.
 */
export interface RequiredPair {
    id: string;
    name: string;
    fg: string;
    bg: string;
    size: PairSize;
    onColorFor?: {
        family: FamilyName;
        candidate: 'paper' | 'ink';
        surface: string;
    };
}
/** The background surfaces an accent's on-color text must pass on. Semantic families emit only a solid badge;
 * the primary also emits darker hover/active button states, so its label must clear all three. */
export declare function accentSurfaces(p: Palette, fam: FamilyName): {
    label: string;
    stop: RampStop;
}[];
export declare function requiredPairs(p: Palette): RequiredPair[];
/**
 * Build ONE self-contained HTML page with a labeled swatch per required pair. Each swatch carries its own
 * opaque background-color and text color inline, so the scanner's paint-order backdrop resolution reads
 * exactly the intended pair (no ancestor bg, no opacity, no image -> never indeterminate). Large-text pairs
 * render at 28px so the scanner classifies them large (3:1); normal pairs at 16px (4.5:1).
 */
export declare function buildSwatchHtml(pairs: RequiredPair[]): string;
/** The subset of a scanner ObjectiveFinding this module reads. Kept structural to avoid importing the scanner into the pure module. */
export interface ScanFindingLike {
    rule: string;
    selector?: string;
    detail?: string;
}
export interface PairFailure {
    id: string;
    name: string;
    detail: string;
}
export interface Verdict {
    /** Required pairs that failed contrast (empty => palette is clean). */
    failures: PairFailure[];
    /** Per accent family, the on-color the scanner verified ('paper' | 'ink'), or null if neither passed. */
    onColor: Record<string, 'paper' | 'ink' | null>;
    /** Count of required pairs that passed (for the report). */
    passCount: number;
    totalRequired: number;
}
/**
 * Resolve scanner findings against the required pairs. A `low-contrast` finding on a swatch id means that
 * pair FAILED. For an accent's two on-color candidates, the accent's requirement is met if EITHER candidate
 * passed (prefer paper); it fails only if BOTH failed. Every non-on-color pair is a hard requirement.
 *
 * PURE + fail-closed by construction: it is given only the findings the scanner produced; a pair the scanner
 * never reported on is treated as passing ONLY because the caller guarantees the scan actually ran (available
 * === true). The CLI enforces that guarantee; if the scan did not run it never calls this.
 */
export declare function resolveVerdict(pairs: RequiredPair[], findings: ScanFindingLike[]): Verdict;
/** Resolved semantic role tokens (concrete hex) once the verdict has picked each accent's on-color. */
export interface ResolvedTokens {
    colors: Record<string, string>;
}
export declare function resolveTokens(p: Palette, verdict: Verdict): ResolvedTokens;
/** Emit the full DESIGN.md (frontmatter + canonical body). Pure string build - deterministic. */
export declare function emitDesignMd(palette: Palette, verdict: Verdict): string;
//# sourceMappingURL=palette-recipe.d.ts.map