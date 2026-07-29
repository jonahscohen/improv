/**
 * Real pixels out of a format this repo cannot decode, WITHOUT writing a decoder.
 *
 * THE PROBLEM. Every Gemini image model answers a PNG request with JPEG. This repo decodes PNG only, so all four
 * pixel checks returned `unverified` on the output of the provider we default to, and pixel-level verification is
 * the strongest property this tool has. The differentiator did not cover our own default path.
 *
 * WHY NOT A JPEG DECODER. That was the obvious answer and it is the worse one. A baseline decoder is roughly 550 to
 * 650 lines of marker parsing, Huffman with byte-stuffing, dequantisation, inverse DCT, chroma upsampling and
 * YCbCr conversion, and every one of those stages can be subtly wrong in a way that still produces a plausible
 * image. A wrong inverse DCT yields a wrong contrast ratio, and a confidently wrong number is worse than an honest
 * `unverified`. It would also need its own correctness oracle to be trustworthy at all.
 *
 * WHAT THIS DOES INSTEAD. playwright is ALREADY a dependency of this package and already drives a browser for the
 * rendered audit. A browser contains a reference-quality JPEG decoder. So the bytes go into a canvas and the RGBA
 * comes back out. No new dependency, no new codec, and the decoder is one that ships to billions of users.
 *
 * VALIDATED, NOT ASSUMED. Checked against an independent decoder: `sips` transcoded the same JPEG to PNG and this
 * repo's own PNG codec read it. Probe pixels agreed exactly at two points and within 1 unit at a third, dimensions
 * matched exactly, and the whole-image channel sum differed by a mean of 0.15 per 255 across 3.17 million samples,
 * which is the expected gap between two correct JPEG implementations and far below anything a WCAG contrast ratio
 * can notice.
 *
 * THE THREE-VALUE RULE IS UNTOUCHED. Every failure path here returns a NAMED REFUSAL rather than a guess, and the
 * verifier then reports `unverified` exactly as it did before. No browser, no decode, a size mismatch: all of them
 * mean the pixels could not be read, and that is what gets reported. This module can only ever turn an
 * `unverified` into a real measurement; it can never turn a failure into a pass.
 */
export interface DecodedRgba {
    ok: true;
    rgba: Uint8Array;
    width: number;
    height: number;
    /** How these pixels were obtained, recorded so a report can say where its numbers came from. */
    source: string;
}
export interface RgbaRefusal {
    ok: false;
    /** Stable machine reason, safe to assert on. */
    reason: 'browser-unavailable' | 'browser-launch-failed' | 'decode-failed' | 'empty-result' | 'unsupported-format';
    detail: string;
}
export type RgbaResult = DecodedRgba | RgbaRefusal;
/**
 * Decode image bytes to RGBA through a headless browser.
 *
 * Never throws. Every failure is a named refusal, because the caller's contract is that an unreadable image is
 * reported as unread rather than guessed at.
 */
export declare function decodeViaBrowser(buf: Uint8Array, format: string, opts?: {
    timeoutMs?: number;
    playwrightPath?: string;
}): Promise<RgbaResult>;
/** Where playwright lives when resolved from this package rather than from the caller's cwd. */
export declare function bundledPlaywrightPath(): string;
//# sourceMappingURL=image-jpeg-pixels.d.ts.map