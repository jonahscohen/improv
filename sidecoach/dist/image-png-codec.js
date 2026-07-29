"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PNG_SIGNATURE = void 0;
exports.crc32 = crc32;
exports.encodePng = encodePng;
exports.readPngHeader = readPngHeader;
exports.decodePng = decodePng;
const zlib = __importStar(require("zlib"));
// ---------------------------------------------------------------------------
// CRC32 (PNG chunk integrity). Table built once, at module load, from the PNG spec polynomial.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
    const table = new Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();
/** CRC32 over a byte range, as PNG defines it (init 0xffffffff, final xor). */
function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++)
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
exports.PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------
function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'latin1');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}
/**
 * Encode 8-bit RGBA pixels as a non-interlaced truecolor-with-alpha PNG.
 *
 * `rgba` is row-major, 4 bytes per pixel, length exactly width*height*4. A length mismatch throws rather than
 * padding: silently encoding a short buffer would produce a corrupt image that still "succeeded".
 */
function encodePng(width, height, rgba, opts = {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        throw new Error(`encodePng: bad dimensions ${width}x${height}`);
    }
    const want = width * height * 4;
    if (rgba.length !== want) {
        throw new Error(`encodePng: rgba length ${rgba.length} does not match ${width}x${height}x4 = ${want}`);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type: truecolor + alpha
    ihdr[10] = 0; // compression: deflate
    ihdr[11] = 0; // filter method: adaptive (we emit filter type 0 per row)
    ihdr[12] = 0; // interlace: none
    // Filter type 0 (None) on every scanline. Keeps the writer trivially deterministic and the decoder path
    // exercised for the identity filter; the decoder's other four filters are covered by real provider PNGs
    // and by the suite's fixtures.
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0;
        Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
    }
    const parts = [exports.PNG_SIGNATURE, chunk('IHDR', ihdr)];
    for (const [key, value] of opts.text || []) {
        parts.push(chunk('tEXt', Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')])));
    }
    // Pinned level, no strategy override: deflateSync is deterministic for a fixed input and level.
    parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })));
    parts.push(chunk('IEND', Buffer.alloc(0)));
    return Buffer.concat(parts);
}
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
/**
 * The bit depths the PNG spec ALLOWS per color type. Enforced before the supported-depth check so an invalid
 * combination (color type 3 at 16 bits, say) is refused as malformed rather than decoded into plausible-looking
 * pixels. Codex review 2026-07-29, finding 3.
 */
const LEGAL_DEPTHS = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
};
/**
 * Read the IHDR geometry without inflating anything. Used by the dimension check, which must work even for a
 * PNG whose pixels are undecodable (so the report can still say "correct size, pixels unverified" instead of
 * collapsing both facts into one unknown).
 */
function readPngHeader(buf) {
    if (buf.length < 8 || !exports.PNG_SIGNATURE.equals(Buffer.from(buf.buffer, buf.byteOffset, 8))) {
        return { ok: false, reason: 'not-a-png', detail: 'signature mismatch' };
    }
    if (buf.length < 8 + 25)
        return { ok: false, reason: 'truncated', detail: 'shorter than signature + IHDR' };
    const view = Buffer.from(buf.buffer, buf.byteOffset, buf.length);
    const len = view.readUInt32BE(8);
    const type = view.toString('latin1', 12, 16);
    if (type !== 'IHDR' || len !== 13)
        return { ok: false, reason: 'missing-ihdr', detail: `first chunk was ${type} len ${len}` };
    return {
        ok: true,
        width: view.readUInt32BE(16),
        height: view.readUInt32BE(20),
        bitDepth: view[24],
        colorType: view[25],
        interlace: view[28],
    };
}
function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc)
        return a;
    if (pb <= pc)
        return b;
    return c;
}
/**
 * Decode a PNG to RGBA8. Every failure mode returns a named refusal; nothing here throws on malformed input,
 * because the caller's contract is "report unverified", not "crash the build step".
 */
function decodePng(buf) {
    const head = readPngHeader(buf);
    if (!head.ok)
        return head;
    const { width, height, bitDepth, colorType, interlace } = head;
    if (interlace !== 0) {
        return { ok: false, reason: 'interlaced-unsupported', detail: 'Adam7 interlaced PNG; pixel checks cannot run' };
    }
    const channels = CHANNELS[colorType];
    if (!channels)
        return { ok: false, reason: 'color-type-unsupported', detail: `color type ${colorType}` };
    if (!LEGAL_DEPTHS[colorType].includes(bitDepth)) {
        return { ok: false, reason: 'bit-depth-unsupported', detail: `bit depth ${bitDepth} is not legal for color type ${colorType}` };
    }
    if (bitDepth !== 8 && bitDepth !== 16) {
        return { ok: false, reason: 'bit-depth-unsupported', detail: `bit depth ${bitDepth} (only 8 and 16 are decoded)` };
    }
    if (width < 1 || height < 1)
        return { ok: false, reason: 'truncated', detail: `IHDR dimensions ${width}x${height}` };
    const view = Buffer.from(buf.buffer, buf.byteOffset, buf.length);
    // IHDR carries the only two method fields PNG defines, and both have exactly one legal value. A file that
    // declares anything else is malformed, and decoding it anyway would be inventing pixels. Codex finding 2.
    if (view[26] !== 0)
        return { ok: false, reason: 'bad-ihdr-fields', detail: `compression method ${view[26]}, only 0 is defined` };
    if (view[27] !== 0)
        return { ok: false, reason: 'bad-ihdr-fields', detail: `filter method ${view[27]}, only 0 is defined` };
    const idat = [];
    const text = {};
    let palette = null;
    let paletteAlpha = null;
    let pos = 8;
    let sawIend = false;
    while (pos + 8 <= view.length && !sawIend) {
        const len = view.readUInt32BE(pos);
        if (len > 0x7fffffff)
            return { ok: false, reason: 'bad-chunk-length', detail: `length ${len} at offset ${pos}` };
        const type = view.toString('latin1', pos + 4, pos + 8);
        const dataStart = pos + 8;
        const dataEnd = dataStart + len;
        if (dataEnd + 4 > view.length)
            return { ok: false, reason: 'truncated', detail: `chunk ${type} runs past end of file` };
        const data = view.subarray(dataStart, dataEnd);
        // CRC every chunk. Without this a corrupted file decodes into plausible-looking pixels and the verifier
        // above happily certifies them, which is the same class of lie as not checking at all. Codex finding 2.
        const declaredCrc = view.readUInt32BE(dataEnd);
        const actualCrc = crc32(view.subarray(pos + 4, dataEnd));
        if (declaredCrc !== actualCrc) {
            return { ok: false, reason: 'bad-crc', detail: `chunk ${type} declares crc ${declaredCrc} but its bytes hash to ${actualCrc}` };
        }
        switch (type) {
            case 'IDAT':
                idat.push(Buffer.from(data));
                break;
            case 'PLTE':
                palette = Uint8Array.from(data);
                break;
            case 'tRNS':
                if (colorType === 3)
                    paletteAlpha = Uint8Array.from(data);
                break;
            case 'tEXt': {
                const nul = data.indexOf(0);
                if (nul > 0)
                    text[data.toString('latin1', 0, nul)] = data.toString('latin1', nul + 1);
                break;
            }
            case 'IEND':
                sawIend = true;
                break;
            default:
                break;
        }
        pos = dataEnd + 4;
    }
    if (idat.length === 0)
        return { ok: false, reason: 'missing-idat', detail: 'no IDAT chunk' };
    // A stream that never reached IEND is truncated, whatever else it happened to contain. Codex finding 2.
    if (!sawIend)
        return { ok: false, reason: 'missing-iend', detail: 'the chunk stream ended without an IEND chunk' };
    if (colorType === 3 && !palette)
        return { ok: false, reason: 'missing-palette', detail: 'color type 3 with no PLTE' };
    let raw;
    try {
        raw = zlib.inflateSync(Buffer.concat(idat));
    }
    catch (err) {
        return { ok: false, reason: 'inflate-failed', detail: err instanceof Error ? err.message : String(err) };
    }
    const bytesPerPixel = (channels * bitDepth) / 8;
    const stride = width * bytesPerPixel;
    // EXACT, not "at least". The zlib stream holds precisely one filter byte plus one scanline per row; anything
    // else is a file whose declared geometry disagrees with its own pixel data, and picking the header's word over
    // the data's would be a guess. Codex finding 2 (trailing bytes were previously accepted).
    if (raw.length !== (stride + 1) * height) {
        return {
            ok: false,
            reason: 'idat-size-mismatch',
            detail: `inflated ${raw.length} bytes, need exactly ${(stride + 1) * height} for ${width}x${height}`,
        };
    }
    const filterOffset = Math.max(1, Math.floor(bytesPerPixel));
    const cur = new Uint8Array(stride);
    const prev = new Uint8Array(stride);
    const rgba = new Uint8Array(width * height * 4);
    const step = bitDepth === 16 ? 2 : 1;
    for (let y = 0; y < height; y++) {
        const rowStart = y * (stride + 1);
        const filterType = raw[rowStart];
        cur.set(raw.subarray(rowStart + 1, rowStart + 1 + stride));
        switch (filterType) {
            case 0:
                break;
            case 1:
                for (let i = filterOffset; i < stride; i++)
                    cur[i] = (cur[i] + cur[i - filterOffset]) & 0xff;
                break;
            case 2:
                for (let i = 0; i < stride; i++)
                    cur[i] = (cur[i] + prev[i]) & 0xff;
                break;
            case 3:
                for (let i = 0; i < stride; i++) {
                    const left = i >= filterOffset ? cur[i - filterOffset] : 0;
                    cur[i] = (cur[i] + ((left + prev[i]) >> 1)) & 0xff;
                }
                break;
            case 4:
                for (let i = 0; i < stride; i++) {
                    const left = i >= filterOffset ? cur[i - filterOffset] : 0;
                    const upLeft = i >= filterOffset ? prev[i - filterOffset] : 0;
                    cur[i] = (cur[i] + paeth(left, prev[i], upLeft)) & 0xff;
                }
                break;
            default:
                return { ok: false, reason: 'bad-filter-type', detail: `filter ${filterType} on row ${y}` };
        }
        for (let x = 0; x < width; x++) {
            const src = x * bytesPerPixel;
            const dst = (y * width + x) * 4;
            switch (colorType) {
                case 0: {
                    const g = cur[src];
                    rgba[dst] = g;
                    rgba[dst + 1] = g;
                    rgba[dst + 2] = g;
                    rgba[dst + 3] = 255;
                    break;
                }
                case 2:
                    rgba[dst] = cur[src];
                    rgba[dst + 1] = cur[src + step];
                    rgba[dst + 2] = cur[src + 2 * step];
                    rgba[dst + 3] = 255;
                    break;
                case 3: {
                    const idx = cur[src];
                    const p = palette;
                    // An index past the end of PLTE is malformed data. Substituting black (the previous `?? 0`) would
                    // SYNTHESIZE pixels that were never in the file, and those invented pixels would then be measured by
                    // the blank and contrast detectors as if they were real. Refuse instead. Codex finding 3.
                    if (idx * 3 + 2 >= p.length) {
                        return {
                            ok: false,
                            reason: 'palette-index-out-of-range',
                            detail: `pixel (${x},${y}) references palette index ${idx} but PLTE holds ${Math.floor(p.length / 3)} entries`,
                        };
                    }
                    rgba[dst] = p[idx * 3];
                    rgba[dst + 1] = p[idx * 3 + 1];
                    rgba[dst + 2] = p[idx * 3 + 2];
                    rgba[dst + 3] = paletteAlpha && idx < paletteAlpha.length ? paletteAlpha[idx] : 255;
                    break;
                }
                case 4: {
                    const g = cur[src];
                    rgba[dst] = g;
                    rgba[dst + 1] = g;
                    rgba[dst + 2] = g;
                    rgba[dst + 3] = cur[src + step];
                    break;
                }
                default:
                    rgba[dst] = cur[src];
                    rgba[dst + 1] = cur[src + step];
                    rgba[dst + 2] = cur[src + 2 * step];
                    rgba[dst + 3] = cur[src + 3 * step];
                    break;
            }
        }
        prev.set(cur);
    }
    return { ok: true, width, height, bitDepth, colorType, rgba, text };
}
//# sourceMappingURL=image-png-codec.js.map