/**
 * Generated-asset VERIFICATION - the half of image generation that nobody does.
 *
 * The industry-standard shape of an image tool is: call a provider, write bytes to a path, print the path,
 * report success. Every one of those steps can succeed while the asset is unusable. A 200 response can carry a
 * 1x1 transparent dot. A "1024x1024" request can come back 1024x1536 and the caller never looks. A safety
 * refusal can land as a flat gray field. A hero image can be perfectly fine and still make the headline that
 * sits on top of it unreadable. In all of those cases "the file exists" is true and the build is broken.
 *
 * This module is the answer to that. It reads the ACTUAL BYTES and answers a contract:
 *   - Is it the format we claimed? (magic bytes, not the file extension)
 *   - Is it the geometry we asked for? (the image's own header, not the request we sent)
 *   - Did anything actually render? (decoded pixels: color count, luminance spread, edge energy)
 *   - Does it satisfy the transparency requirement the slot has?
 *   - Will the text that sits ON it still be readable? (real WCAG contrast against the real pixels under the
 *     text region, worst-case by default, not against an average that hides a bright patch)
 *   - Is it provably not a synthetic placeholder being passed off as a provider render?
 *
 * THE THREE-VALUE RULE, which is the whole discipline: every check returns pass, fail, or UNVERIFIED, and
 * unverified is never rounded to pass. If the bytes are a format whose pixels this repo cannot decode, the
 * pixel checks report unverified and the overall verdict is unverified - not "verified" with a footnote. A
 * caller that receives `unverified` has received a refusal to certify, and the gate treats it as one. That is
 * the single most important property in this file: an unchecked image is reported as unchecked.
 *
 * PURITY: no IO, no network, no clock, no randomness. Bytes in, report out. Every function here is
 * deterministic and unit-testable without a browser, a provider key, or a temp directory.
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg';
/** Identify the format from the leading bytes. Returns null when nothing matches. */
export declare function sniffFormat(buf: Uint8Array): ImageFormat | null;
export interface Dimensions {
    width: number;
    height: number;
}
/**
 * Read intrinsic dimensions from the image's own bytes, per format. Returns null when the format's header does
 * not carry them in a form this function reads (which becomes an UNVERIFIED dimension check, never a pass).
 */
export declare function readDimensions(buf: Uint8Array, format: ImageFormat): Dimensions | null;
export interface Rgb {
    r: number;
    g: number;
    b: number;
}
export declare function parseHexColor(hex: string): Rgb | null;
export declare function relativeLuminance(c: Rgb): number;
export declare function contrastRatio(a: Rgb, b: Rgb): number;
export interface Region {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface PixelStats {
    /** Distinct composited RGB values seen, capped (see `uniqueColorsCapped`). */
    uniqueColors: number;
    uniqueColorsCapped: boolean;
    meanLuminance: number;
    stdDevLuminance: number;
    minLuminance: number;
    maxLuminance: number;
    /**
     * Fraction of adjacent pixel pairs (right and down neighbors) whose luminance differs by more than
     * EDGE_DELTA. A rendered image has structure; a flat fill or a failed render has effectively none.
     */
    edgeDensity: number;
    /** Fraction of pixels with alpha below 8/255 - i.e. effectively see-through. */
    transparentFraction: number;
    /**
     * Fraction of pixels with ANY alpha below 255. This, not transparentFraction, is what an "must be opaque"
     * contract has to read: a uniformly 50%-alpha image has no see-through pixels by the 8/255 test yet is not
     * opaque anywhere. Codex review 2026-07-29, finding 1.
     */
    nonOpaqueFraction: number;
    /** Pixel count the stats were computed over. */
    sampled: number;
}
/**
 * Compute pixel statistics over an RGBA8 buffer, optionally restricted to a region, compositing any alpha onto
 * `backdrop` so the numbers describe what a viewer would actually see rather than premultiplied nonsense.
 */
export declare function analyzePixels(rgba: Uint8Array, width: number, height: number, opts?: {
    region?: Region;
    backdrop?: Rgb;
}): PixelStats;
/**
 * Worst-case and mean contrast between an overlay ink color and the pixels underneath it. Worst-case is the
 * default the gate reads: an average hides the one bright patch that eats the headline, and the headline is
 * what the user has to read.
 */
export declare function contrastAgainstPixels(rgba: Uint8Array, width: number, height: number, ink: Rgb, opts?: {
    region?: Region;
    backdrop?: Rgb;
}): {
    worst: number;
    mean: number;
    sampled: number;
};
export type CheckStatus = 'pass' | 'fail' | 'unverified';
export interface AssetCheck {
    /** Stable machine id. Tests and gates assert on these, never on prose. */
    id: string;
    status: CheckStatus;
    detail: string;
}
export type AssetVerdict = 'verified' | 'failed' | 'unverified';
/** The blank-render thresholds, exposed so a caller can tighten them and a test can pin them. */
export interface BlankThresholds {
    minUniqueColors: number;
    minLuminanceStdDev: number;
    minEdgeDensity: number;
}
export declare const DEFAULT_BLANK_THRESHOLDS: BlankThresholds;
export interface PlacementContract {
    /** The ink color of text that will sit on this image, as hex. */
    inkHex: string;
    /** Where that text sits, in image pixels. Omitted means the whole image. */
    region?: Region;
    /** Minimum acceptable ratio. WCAG AA large text is 3.0; normal text is 4.5. */
    minContrast: number;
    /** `worst` (default) gates on the least-readable pixel; `mean` gates on the average. */
    mode?: 'worst' | 'mean';
    /** Backdrop any transparency is composited onto. Defaults to white. */
    backdropHex?: string;
}
export interface AssetContract {
    /** The format the caller claims this asset is. Sniffed bytes must agree. */
    format: ImageFormat;
    width: number;
    height: number;
    /** Reject files smaller than this. Default 1 - i.e. any zero-byte file fails. */
    minBytes?: number;
    /** true = the asset must have transparent pixels; false = it must have none; omitted = not checked. */
    alpha?: boolean;
    blank?: Partial<BlankThresholds>;
    placement?: PlacementContract;
    /**
     * Whether this asset is EXPECTED to be the deterministic offline placeholder. When false (the normal case
     * for a provider render) an asset carrying the offline marker FAILS: a placeholder must never be reported as
     * a real render, and the marker lives in the bytes so renaming the file cannot launder it.
     */
    expectSynthetic?: boolean;
}
export interface VerifyReport {
    verdict: AssetVerdict;
    bytes: number;
    sniffedFormat: ImageFormat | null;
    dimensions: Dimensions | null;
    pixels: PixelStats | null;
    contrast: {
        worst: number;
        mean: number;
        sampled: number;
    } | null;
    /** True when the bytes carry the offline placeholder marker. */
    synthetic: boolean;
    checks: AssetCheck[];
    /** Machine reasons for every check that could not run. Empty unless the verdict is unverified. */
    unverifiedReasons: string[];
}
/** The tEXt keyword the offline renderer stamps into its output. */
export declare const SYNTHETIC_MARKER_KEY = "sidecoach-synthetic";
/**
 * Verify an asset's bytes against a contract.
 *
 * The verdict folds every check with fail beating unverified beating pass: a failed check is a failure even if
 * something else could not be checked, and an unverified check can never produce a `verified` verdict.
 */
export declare function verifyAsset(buf: Uint8Array, contract: AssetContract): VerifyReport;
/** One-line human summary of a report, for stderr and for the flow lens. */
export declare function summarizeReport(report: VerifyReport): string;
//# sourceMappingURL=image-asset-verify.d.ts.map