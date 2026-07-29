/**
 * PNG byte codec for the sidecoach image pipeline - a real encoder AND a real decoder, written over node's
 * built-in zlib so the project takes on NO image dependency.
 *
 * WHY THIS FILE EXISTS AT ALL: verifying a generated image means reading its PIXELS, not trusting the header
 * the provider sent back or the filename we asked for. "The API returned 200 and a path exists" is not
 * evidence that anything rendered. A blank canvas, a single flat fill, and a 1x1 transparent dot all pass a
 * file-exists check and all fail a build. Decoding is therefore not a nicety here; it is the whole point of
 * the verification step, and node ships zlib, so the decode costs one file and zero dependencies.
 *
 * The encoder exists for two reasons: the deterministic offline mode needs to WRITE a real PNG (not a stub
 * with a .png extension), and the test suite needs to construct exact adversarial fixtures - a truly blank
 * page, a single-color fill, a low-contrast field - to prove the detectors fire on them.
 *
 * DETERMINISM (load-bearing, and the offline mode's whole contract): encodePng writes no timestamp chunk,
 * seeds nothing from the clock, and pins the deflate level. The same pixels plus the same text chunks produce
 * byte-identical output on every call. There is no tIME chunk and no ambient state anywhere in the writer.
 *
 * SCOPE, stated honestly rather than implied: the decoder handles the non-interlaced 8-bit and 16-bit forms
 * of all five PNG color types, including palette with transparency. It does NOT handle Adam7 interlacing or
 * sub-byte bit depths (1/2/4). Those return a REFUSAL with a named reason, never a guess and never a silent
 * pass - an image the decoder cannot read is reported upstream as UNVERIFIED, which is the honest answer.
 */
/** CRC32 over a byte range, as PNG defines it (init 0xffffffff, final xor). */
export declare function crc32(buf: Uint8Array): number;
export declare const PNG_SIGNATURE: Buffer<ArrayBuffer>;
export interface EncodeOptions {
    /**
     * Latin-1 keyword/value pairs written as tEXt chunks, in the order given. The offline renderer uses these
     * to stamp its output as synthetic INSIDE THE BYTES, so an offline placeholder can never be laundered into
     * a report as a real provider render just by moving or renaming the file.
     */
    text?: Array<[string, string]>;
}
/**
 * Encode 8-bit RGBA pixels as a non-interlaced truecolor-with-alpha PNG.
 *
 * `rgba` is row-major, 4 bytes per pixel, length exactly width*height*4. A length mismatch throws rather than
 * padding: silently encoding a short buffer would produce a corrupt image that still "succeeded".
 */
export declare function encodePng(width: number, height: number, rgba: Uint8Array, opts?: EncodeOptions): Buffer;
export interface DecodedPng {
    ok: true;
    width: number;
    height: number;
    bitDepth: number;
    colorType: number;
    /** Row-major RGBA8, length width*height*4. */
    rgba: Uint8Array;
    /** tEXt keyword -> value, in file order (later duplicates win). */
    text: Record<string, string>;
}
export interface DecodeRefusal {
    ok: false;
    /** Stable machine reason, safe to assert on. */
    reason: 'not-a-png' | 'truncated' | 'bad-chunk-length' | 'bad-crc' | 'missing-ihdr' | 'bad-ihdr-fields' | 'missing-idat' | 'missing-iend' | 'interlaced-unsupported' | 'bit-depth-unsupported' | 'color-type-unsupported' | 'missing-palette' | 'palette-index-out-of-range' | 'inflate-failed' | 'idat-size-mismatch' | 'bad-filter-type';
    detail: string;
}
export type DecodeResult = DecodedPng | DecodeRefusal;
/**
 * Read the IHDR geometry without inflating anything. Used by the dimension check, which must work even for a
 * PNG whose pixels are undecodable (so the report can still say "correct size, pixels unverified" instead of
 * collapsing both facts into one unknown).
 */
export declare function readPngHeader(buf: Uint8Array): {
    ok: true;
    width: number;
    height: number;
    bitDepth: number;
    colorType: number;
    interlace: number;
} | DecodeRefusal;
/**
 * Decode a PNG to RGBA8. Every failure mode returns a named refusal; nothing here throws on malformed input,
 * because the caller's contract is "report unverified", not "crash the build step".
 */
export declare function decodePng(buf: Uint8Array): DecodeResult;
//# sourceMappingURL=image-png-codec.d.ts.map