import type { Browser } from 'playwright';
export type SubjectiveRule = 'tiny-text' | 'nested-cards' | 'marketing-buzzword' | 'default-typeface' | 'extreme-negative-tracking' | 'tight-leading' | 'all-caps-body' | 'oversized-h1' | 'sub-11px-ui';
export interface SubjectiveFinding {
    rule: SubjectiveRule;
    severity: 'warning';
    selector?: string;
    detail?: string;
}
export type SubjectiveScan = {
    available: true;
    findings: SubjectiveFinding[];
} | {
    available: false;
    reason: string;
};
export declare const SUBJECTIVE_RULES: SubjectiveRule[];
export declare function stripScripts(html: string): string;
export declare function inPageSubjective(): SubjectiveFinding[];
export interface BuzzwordScore {
    density: number;
    effectiveDensity: number;
    words: number;
    weighted: number;
    distinctTerms: number;
    hasStrongOrPeak: boolean;
    matched: string[];
    selector?: string;
}
/**
 * marketing-buzzword (v2): the SINGLE SOURCE of the buzzword taxonomy + weighted-density computation, serialized
 * into the browser by page.evaluate. Returns the SCORE only - the firing THRESHOLD (BUZZ_DENSITY_THRESHOLD) is
 * applied in Node by BOTH the production scan (buzzwordFindingFromScore) AND the calibration harness, so the harness
 * sweeps EXACTLY what ships (no reimplementation - the integrity fix).
 *
 * The page LEANS on generic marketing buzzwords rather than concrete specifics - a HOLISTIC density over the content
 * copy (v1's tight prominent-cluster overfit a homogeneous corpus and collapsed on the diverse held-out). SCOPE =
 * all VISIBLE, non-peripheral content text, EXCLUDING testimonial/quote/review/case-study regions (customer social
 * proof != the brand's own copy). SCORE = (sum of VACUITY-tier weights over ALL occurrences) / content_words * 100,
 * tiers PEAK 4 / STRONG 2 / MILD 0.5 (v3 reweight). WHY vacuity-weighting: v2's FP mode (frozen p=0.333) = pages
 * that USE marketing vocabulary CONCRETELY (nasa "groundbreaking discoveries" = real science; onepassword "powerful
 * security" = a real feature) rather than leaning on empty fluff. The dev-FP analysis showed the FPs fire on
 * concrete-prone STRONG/MILD words (modern/advanced/enterprise-grade/ai-powered) with ~0 pure-hype PEAK terms (FP
 * peak=0.33 vs TP peak=1.36), while the TP fluff leans on PEAK clichés (seamless/supercharge/revolution/world-class).
 * So PEAK (content-free hype, impossible to use concretely) is upweighted and the concrete-prone MILD tier is
 * heavily discounted. QUALIFY guard (precision): a page firing WITHOUT any pure-hype/strong term (MILD-only product
 * descriptors) is not "leaning on buzzwords" - require >=1 STRONG/PEAK term. Each term is a bounded regex matched
 * with non-consuming lookarounds (counts ALL occurrences incl. adjacent repeats) - linear, ReDoS-safe.
 */
export declare function inPageBuzzword(): BuzzwordScore;
export declare const BUZZ_DENSITY_THRESHOLD = 0.75;
/** Node-side: turn a buzzword score into a marketing-buzzword finding (or null). The ONE place the production
 * threshold is applied; the calibration harness sweeps the same effectiveDensity. */
export declare function buzzwordFindingFromScore(s: BuzzwordScore): SubjectiveFinding | null;
export interface TypefaceScore {
    contentChars: number;
    defaultStackChars: number;
    defaultStackShare: number;
    families: {
        family: string;
        chars: number;
    }[];
    dominantFamily?: string;
    dominantShare: number;
    declaredFamilies: string[];
    defaultSelector?: string;
}
/**
 * default-typeface: the page's CONTENT text is not set in a typeface anyone CHOSE.
 *
 * ONE page-level judgment with two grounds, both expressed as a share of content text:
 *   (A) default stack   - the content text computes to a bare system/generic stack (the vocabulary in
 *                         reference-data.ts SYSTEM_FONT_STACK_FAMILIES), i.e. no typeface was chosen at all.
 *                         The historically over-used monoculture faces (Arial, Helvetica, Times, Georgia,
 *                         Verdana, Segoe UI) live IN that vocabulary - they are the families you get when
 *                         nobody chose, which is exactly what "monoculture" means for a rendered read.
 *   (B) brand mismatch  - a committed family IS known (caller-supplied, from PRODUCT.md / DESIGN.md) but it
 *                         barely paints the content text, so the commitment did not land.
 *
 * MEASUREMENT BASIS = the computed `font-family` STACK, not the painted face. This is deliberate and it is
 * the only honest basis here: the hermetic render aborts external subresources, so a page that loads its
 * typeface from a CDN paints in the fallback no matter how well it is built. Scoring the painted face would
 * therefore fire on nearly every real page as an artifact of the harness rather than a defect of the page.
 * The declared stack is render-independent and is what the page actually asked for.
 *
 * HONEST EXCLUSION (deliberately NOT detected): "over-used Google-font monoculture" in the Inter/Poppins
 * sense. Inter and Poppins are RECOMMENDED entries in our own catalog (reference-data.ts loadFontCatalog),
 * and 13 of the 48 real dev-corpus pages lead with Inter as a deliberate, well-executed choice. Firing on
 * them would be a low-precision taste guess about a family that is frequently the right answer - the
 * category the plan says to mark out-of-scope rather than ship. Recorded here so no later pass claims this
 * detector covers it.
 *
 * Returns the SCORE only; the firing thresholds are applied in Node by typefaceFindingFromScore, so the
 * calibration harness sweeps EXACTLY what ships (the inPageBuzzword / buzzwordFindingFromScore contract).
 */
export declare function inPageTypeface(): TypefaceScore;
export declare const DEFAULT_STACK_SHARE = 0.75;
export declare const BRAND_PRESENCE_MIN = 0.25;
export declare const TYPEFACE_MIN_CONTENT_CHARS = 200;
export declare const DEFAULT_TYPEFACE_GROUND_DEFAULT_STACK = "default-stack";
export declare const DEFAULT_TYPEFACE_GROUND_BRAND_MISMATCH = "brand-mismatch";
export interface TypefaceFindingOptions {
    /** The brand's committed families (PRODUCT.md / DESIGN.md). Ground (B) is INERT unless this is supplied -
     *  "mismatch to the committed family" is only a defect where a committed family is actually known. */
    brandFamilies?: string[];
}
/** Node-side: turn a typeface score into a default-typeface finding (or null). The ONE place the production
 * thresholds are applied; the calibration harness sweeps the same defaultStackShare. */
export declare function typefaceFindingFromScore(s: TypefaceScore, opts?: TypefaceFindingOptions): SubjectiveFinding | null;
/** Which ground fired, for a consumer that phrases a user-facing verdict. Ground B can fire on a page that is
 *  set in a perfectly good CHOSEN face which simply is not the committed one, so a consumer must not describe
 *  every default-typeface finding as "renders on the default system stack" (Codex review P2). */
export declare function typefaceGroundOf(detail: string | undefined): 'default-stack' | 'brand-mismatch' | 'unknown';
export interface TypographyExtremesScore {
    contentChars: number;
    viewportWidth: number;
    tightTrackingChars: number;
    tightTrackingShare: number;
    tightestTrackingEm: number;
    trackingSelector?: string;
    runningTextChars: number;
    tightLeadingChars: number;
    tightLeadingShare: number;
    tightestLeading: number;
    leadingSelector?: string;
    allCapsBodyChars: number;
    allCapsShare: number;
    allCapsSelector?: string;
    largestH1Px: number;
    h1Ratio: number;
    h1Selector?: string;
    sub11Chars: number;
    sub11MinPx: number;
    sub11Selector?: string;
}
export declare const TRACKING_EXTREME_EM = -0.05;
export declare const LEADING_TIGHT_RATIO = 1.1;
export declare const LEADING_MIN_RUN_CHARS = 40;
export declare const LEADING_MAX_BODY_PX = 28;
export declare const ALLCAPS_MIN_RUN_CHARS = 40;
export declare const ALLCAPS_MAX_BODY_PX = 28;
export declare const ALLCAPS_MIN_CASED = 20;
export declare const SUB11_MAX_PX = 10;
export declare function inPageTypographyExtremes(): TypographyExtremesScore;
export declare const TYPO_MIN_CONTENT_CHARS = 200;
export declare const TRACKING_SHARE_MIN = 0.15;
export declare const LEADING_SHARE_MIN = 0.1;
export declare const ALLCAPS_SHARE_MIN = 0.15;
export declare const H1_VW_RATIO = 0.11;
export declare const SUB11_MIN_CHARS = 150;
/** Node-side: turn a typography-extremes score into 0-5 findings (one page-level verdict per firing class). The
 * ONE place these production thresholds are applied; the calibration harness sweeps the same raw score fields, so
 * the sweep measures exactly what ships (the inPageBuzzword / inPageTypeface contract). */
export declare function typographyExtremesFindingsFromScore(s: TypographyExtremesScore): SubjectiveFinding[];
export interface RenderOpts {
    stripScripts?: boolean;
    abortExternal?: boolean;
    viewport?: {
        width: number;
        height: number;
    };
}
export declare function analyzeHtmlOnBrowserSubjective(browser: Browser, html: string, timeoutMs?: number, render?: RenderOpts, typeface?: TypefaceFindingOptions): Promise<SubjectiveFinding[]>;
export interface ScanOptions {
    timeoutMs?: number;
    launcher?: () => Promise<Browser>;
    render?: RenderOpts;
    typeface?: TypefaceFindingOptions;
}
/** Render an HTML string deterministically and return subjective findings. FAIL-CLOSED: a launch/render error or
 * timeout returns { available:false } - never a false "clean". */
export declare function scanSubjectiveRendered(html: string, opts?: ScanOptions): Promise<SubjectiveScan>;
//# sourceMappingURL=subjective-rendered-scanner.d.ts.map