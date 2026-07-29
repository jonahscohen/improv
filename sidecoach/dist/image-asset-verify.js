"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYNTHETIC_MARKER_KEY = exports.DEFAULT_BLANK_THRESHOLDS = void 0;
exports.sniffFormat = sniffFormat;
exports.readDimensions = readDimensions;
exports.parseHexColor = parseHexColor;
exports.relativeLuminance = relativeLuminance;
exports.contrastRatio = contrastRatio;
exports.analyzePixels = analyzePixels;
exports.contrastAgainstPixels = contrastAgainstPixels;
exports.verifyAsset = verifyAsset;
exports.summarizeReport = summarizeReport;
const image_png_codec_1 = require("./image-png-codec");
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
/** Identify the format from the leading bytes. Returns null when nothing matches. */
function sniffFormat(buf) {
    if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
        return 'png';
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
        return 'jpeg';
    if (buf.length >= 12) {
        const riff = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
        const webp = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
        if (riff === 'RIFF' && webp === 'WEBP')
            return 'webp';
    }
    if (buf.length >= 6) {
        const gif = String.fromCharCode(buf[0], buf[1], buf[2], buf[3], buf[4], buf[5]);
        if (gif === 'GIF87a' || gif === 'GIF89a')
            return 'gif';
    }
    // SVG is text; look for an <svg root within the leading window, tolerating an XML prolog or a BOM.
    const head = Buffer.from(buf.buffer, buf.byteOffset, Math.min(buf.length, 2048)).toString('utf8');
    if (/<svg[\s>]/i.test(head))
        return 'svg';
    return null;
}
/**
 * Read intrinsic dimensions from the image's own bytes, per format. Returns null when the format's header does
 * not carry them in a form this function reads (which becomes an UNVERIFIED dimension check, never a pass).
 */
function readDimensions(buf, format) {
    const view = Buffer.from(buf.buffer, buf.byteOffset, buf.length);
    switch (format) {
        case 'png': {
            const h = (0, image_png_codec_1.readPngHeader)(buf);
            return h.ok ? { width: h.width, height: h.height } : null;
        }
        case 'gif':
            if (view.length < 10)
                return null;
            return { width: view.readUInt16LE(6), height: view.readUInt16LE(8) };
        case 'jpeg': {
            let pos = 2;
            while (pos + 9 < view.length) {
                if (view[pos] !== 0xff) {
                    pos++;
                    continue;
                }
                const marker = view[pos + 1];
                if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
                    pos += 2;
                    continue;
                }
                const segLen = view.readUInt16BE(pos + 2);
                // The segment must be long enough to CONTAIN the geometry and must lie inside the file. Reading the
                // dimensions out of whatever bytes happen to follow a truncated segment would produce a confident wrong
                // answer, which is worse than no answer. Codex finding 4.
                if (segLen < 2 || pos + 2 + segLen > view.length)
                    return null;
                if (JPEG_SOF.has(marker)) {
                    if (segLen < 7)
                        return null;
                    return { height: view.readUInt16BE(pos + 5), width: view.readUInt16BE(pos + 7) };
                }
                pos += 2 + segLen;
            }
            return null;
        }
        case 'webp': {
            // Walk the RIFF chunks; the geometry lives in whichever of VP8X / VP8L / VP8 comes first.
            let pos = 12;
            while (pos + 8 <= view.length) {
                const id = view.toString('latin1', pos, pos + 4);
                const size = view.readUInt32LE(pos + 4);
                const body = pos + 8;
                // The chunk must declare a size that both fits in the file and covers the fields being read. A chunk
                // that declares a short size can otherwise yield "dimensions" assembled from the bytes after it.
                // Codex finding 5.
                if (body + size > view.length)
                    return null;
                if (id === 'VP8X' && size >= 10 && body + 10 <= view.length) {
                    const w = 1 + (view[body + 4] | (view[body + 5] << 8) | (view[body + 6] << 16));
                    const h = 1 + (view[body + 7] | (view[body + 8] << 8) | (view[body + 9] << 16));
                    return { width: w, height: h };
                }
                if (id === 'VP8L' && size >= 5 && body + 5 <= view.length) {
                    const bits = view.readUInt32LE(body + 1);
                    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
                }
                if (id === 'VP8 ' && size >= 10 && body + 10 <= view.length) {
                    return { width: view.readUInt16LE(body + 6) & 0x3fff, height: view.readUInt16LE(body + 8) & 0x3fff };
                }
                pos = body + size + (size % 2);
            }
            return null;
        }
        case 'svg': {
            const text = view.toString('utf8', 0, Math.min(view.length, 8192));
            const attr = (name) => {
                const m = text.match(new RegExp(`${name}\\s*=\\s*["']([0-9.]+)(px)?["']`, 'i'));
                return m ? Math.round(parseFloat(m[1])) : null;
            };
            const w = attr('width');
            const h = attr('height');
            if (w && h)
                return { width: w, height: h };
            const vb = text.match(/viewBox\s*=\s*["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)/i);
            if (vb)
                return { width: Math.round(parseFloat(vb[1])), height: Math.round(parseFloat(vb[2])) };
            return null;
        }
        default:
            return null;
    }
}
function parseHexColor(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m)
        return null;
    const h = m[1];
    if (h.length === 3) {
        return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
    }
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function relativeLuminance(c) {
    const f = (v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
}
/** Straight-alpha "over" compositing onto an opaque backdrop (CSS Color 4 simple alpha compositing). */
function over(src, dst) {
    return {
        r: src.r * src.a + dst.r * (1 - src.a),
        g: src.g * src.a + dst.g * (1 - src.a),
        b: src.b * src.a + dst.b * (1 - src.a),
    };
}
const UNIQUE_COLOR_CAP = 65536;
const EDGE_DELTA = 0.02;
/**
 * Compute pixel statistics over an RGBA8 buffer, optionally restricted to a region, compositing any alpha onto
 * `backdrop` so the numbers describe what a viewer would actually see rather than premultiplied nonsense.
 */
function analyzePixels(rgba, width, height, opts = {}) {
    const backdrop = opts.backdrop || { r: 255, g: 255, b: 255 };
    const r = opts.region || { x: 0, y: 0, width, height };
    const x0 = Math.max(0, Math.min(width - 1, Math.floor(r.x)));
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(r.y)));
    const x1 = Math.max(x0 + 1, Math.min(width, Math.floor(r.x + r.width)));
    const y1 = Math.max(y0 + 1, Math.min(height, Math.floor(r.y + r.height)));
    const w = x1 - x0;
    const h = y1 - y0;
    const lum = new Float64Array(w * h);
    const colors = new Set();
    let transparent = 0;
    let nonOpaque = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const src = ((y + y0) * width + (x + x0)) * 4;
            const a = rgba[src + 3];
            if (a < 8)
                transparent++;
            if (a < 255)
                nonOpaque++;
            const c = a === 255 ? { r: rgba[src], g: rgba[src + 1], b: rgba[src + 2] } : over({ r: rgba[src], g: rgba[src + 1], b: rgba[src + 2], a: a / 255 }, backdrop);
            if (colors.size < UNIQUE_COLOR_CAP) {
                colors.add(((Math.round(c.r) & 0xff) << 16) | ((Math.round(c.g) & 0xff) << 8) | (Math.round(c.b) & 0xff));
            }
            const l = relativeLuminance(c);
            lum[y * w + x] = l;
            sum += l;
            if (l < min)
                min = l;
            if (l > max)
                max = l;
        }
    }
    const n = w * h;
    const mean = sum / n;
    let varAcc = 0;
    for (let i = 0; i < n; i++) {
        const d = lum[i] - mean;
        varAcc += d * d;
    }
    let edges = 0;
    let pairs = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const l = lum[y * w + x];
            if (x + 1 < w) {
                pairs++;
                if (Math.abs(l - lum[y * w + x + 1]) > EDGE_DELTA)
                    edges++;
            }
            if (y + 1 < h) {
                pairs++;
                if (Math.abs(l - lum[(y + 1) * w + x]) > EDGE_DELTA)
                    edges++;
            }
        }
    }
    return {
        uniqueColors: colors.size,
        uniqueColorsCapped: colors.size >= UNIQUE_COLOR_CAP,
        meanLuminance: mean,
        stdDevLuminance: Math.sqrt(varAcc / n),
        minLuminance: min === Infinity ? 0 : min,
        maxLuminance: max === -Infinity ? 0 : max,
        edgeDensity: pairs === 0 ? 0 : edges / pairs,
        transparentFraction: transparent / n,
        nonOpaqueFraction: nonOpaque / n,
        sampled: n,
    };
}
/**
 * Worst-case and mean contrast between an overlay ink color and the pixels underneath it. Worst-case is the
 * default the gate reads: an average hides the one bright patch that eats the headline, and the headline is
 * what the user has to read.
 */
function contrastAgainstPixels(rgba, width, height, ink, opts = {}) {
    const backdrop = opts.backdrop || { r: 255, g: 255, b: 255 };
    const r = opts.region || { x: 0, y: 0, width, height };
    const x0 = Math.max(0, Math.min(width - 1, Math.floor(r.x)));
    const y0 = Math.max(0, Math.min(height - 1, Math.floor(r.y)));
    const x1 = Math.max(x0 + 1, Math.min(width, Math.floor(r.x + r.width)));
    const y1 = Math.max(y0 + 1, Math.min(height, Math.floor(r.y + r.height)));
    const inkLum = relativeLuminance(ink);
    let worst = Infinity;
    let sum = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const src = (y * width + x) * 4;
            const a = rgba[src + 3];
            const c = a === 255 ? { r: rgba[src], g: rgba[src + 1], b: rgba[src + 2] } : over({ r: rgba[src], g: rgba[src + 1], b: rgba[src + 2], a: a / 255 }, backdrop);
            const l = relativeLuminance(c);
            const ratio = (Math.max(inkLum, l) + 0.05) / (Math.min(inkLum, l) + 0.05);
            if (ratio < worst)
                worst = ratio;
            sum += ratio;
            n++;
        }
    }
    return { worst: worst === Infinity ? 0 : worst, mean: n === 0 ? 0 : sum / n, sampled: n };
}
exports.DEFAULT_BLANK_THRESHOLDS = {
    minUniqueColors: 8,
    minLuminanceStdDev: 0.004,
    minEdgeDensity: 0.0005,
};
/** The tEXt keyword the offline renderer stamps into its output. */
exports.SYNTHETIC_MARKER_KEY = 'sidecoach-synthetic';
function fold(checks) {
    if (checks.some((c) => c.status === 'fail'))
        return 'failed';
    if (checks.some((c) => c.status === 'unverified'))
        return 'unverified';
    return 'verified';
}
/**
 * Verify an asset's bytes against a contract.
 *
 * The verdict folds every check with fail beating unverified beating pass: a failed check is a failure even if
 * something else could not be checked, and an unverified check can never produce a `verified` verdict.
 */
function verifyAsset(buf, contract) {
    const checks = [];
    const minBytes = contract.minBytes ?? 1;
    const sniffed = sniffFormat(buf);
    checks.push(buf.length >= minBytes
        ? { id: 'bytes-nonzero', status: 'pass', detail: `${buf.length} bytes` }
        : { id: 'bytes-nonzero', status: 'fail', detail: `${buf.length} bytes, need at least ${minBytes}` });
    if (sniffed === null) {
        checks.push({ id: 'format-matches', status: 'fail', detail: `no known image signature; claimed ${contract.format}` });
    }
    else if (sniffed !== contract.format) {
        checks.push({ id: 'format-matches', status: 'fail', detail: `bytes are ${sniffed}, claimed ${contract.format}` });
    }
    else {
        checks.push({ id: 'format-matches', status: 'pass', detail: `bytes are ${sniffed}` });
    }
    const dims = sniffed ? readDimensions(buf, sniffed) : null;
    if (!dims) {
        checks.push({
            id: 'dimensions-match',
            status: 'unverified',
            detail: `dimensions not readable from ${sniffed ?? 'unknown'} bytes; wanted ${contract.width}x${contract.height}`,
        });
    }
    else if (dims.width !== contract.width || dims.height !== contract.height) {
        checks.push({
            id: 'dimensions-match',
            status: 'fail',
            detail: `image is ${dims.width}x${dims.height}, contract wants ${contract.width}x${contract.height}`,
        });
    }
    else {
        checks.push({ id: 'dimensions-match', status: 'pass', detail: `${dims.width}x${dims.height}` });
    }
    // Pixel-level checks require a decode. Only PNG is decodable in-repo; anything else is reported UNVERIFIED
    // with the reason named, which is what stops this whole module from being a rubber stamp on a webp.
    let pixels = null;
    let contrast = null;
    let synthetic = false;
    let decodeReason = '';
    // Resolve ONE pixel source, then run the same checks against it whatever produced it. Two sources: this repo's
    // own PNG decode, or pixels the caller decoded for a format this repo cannot read (see contract.decodedPixels).
    let src = null;
    let refusal = null;
    if (sniffed === 'png') {
        const decoded = (0, image_png_codec_1.decodePng)(buf);
        if (decoded.ok) {
            // Provenance is read from PNG bytes and nowhere else, so supplied pixels can never claim it.
            synthetic = Object.prototype.hasOwnProperty.call(decoded.text, exports.SYNTHETIC_MARKER_KEY);
            src = {
                rgba: decoded.rgba,
                width: decoded.width,
                height: decoded.height,
                label: `decoded ${decoded.width}x${decoded.height}, color type ${decoded.colorType}`,
            };
        }
        else {
            refusal = { reason: decoded.reason, detail: `${decoded.reason}: ${decoded.detail}` };
        }
    }
    else if (contract.decodedPixels) {
        const p = contract.decodedPixels;
        const expected = p.width * p.height * 4;
        if (!dims) {
            // Without the bytes' own header there is nothing to check the supply against, so it is refused rather than
            // trusted. Trusting it here would measure an unknown image and report the number as this asset's.
            refusal = { reason: 'supplied-pixels-unanchored', detail: 'pixels were supplied but the bytes carry no readable dimensions to check them against' };
        }
        else if (p.width !== dims.width || p.height !== dims.height) {
            refusal = {
                reason: 'supplied-pixels-mismatch',
                detail: `supplied pixels are ${p.width}x${p.height} but the bytes report ${dims.width}x${dims.height}; refusing to measure a different image`,
            };
        }
        else if (p.rgba.length !== expected) {
            refusal = {
                reason: 'supplied-pixels-malformed',
                detail: `supplied buffer is ${p.rgba.length} bytes, expected ${expected} for ${p.width}x${p.height} RGBA`,
            };
        }
        else {
            src = { rgba: p.rgba, width: p.width, height: p.height, label: `${p.width}x${p.height} RGBA supplied by ${p.source} (this repo cannot decode ${sniffed})` };
        }
    }
    else {
        refusal = {
            reason: 'format-not-decodable',
            detail: `pixel decoding is implemented for png only; this asset is ${sniffed ?? 'an unknown format'}`,
        };
    }
    {
        if (src) {
            const decoded = src;
            checks.push({ id: 'pixels-decodable', status: 'pass', detail: src.label });
            pixels = analyzePixels(decoded.rgba, decoded.width, decoded.height);
            const th = { ...exports.DEFAULT_BLANK_THRESHOLDS, ...(contract.blank || {}) };
            const blankFailures = [];
            if (pixels.uniqueColors < th.minUniqueColors)
                blankFailures.push(`${pixels.uniqueColors} unique colors < ${th.minUniqueColors}`);
            if (pixels.stdDevLuminance < th.minLuminanceStdDev)
                blankFailures.push(`luminance stddev ${pixels.stdDevLuminance.toFixed(5)} < ${th.minLuminanceStdDev}`);
            if (pixels.edgeDensity < th.minEdgeDensity)
                blankFailures.push(`edge density ${pixels.edgeDensity.toFixed(5)} < ${th.minEdgeDensity}`);
            checks.push(blankFailures.length === 0
                ? {
                    id: 'rendered-not-blank',
                    status: 'pass',
                    detail: `${pixels.uniqueColors} colors, stddev ${pixels.stdDevLuminance.toFixed(4)}, edges ${pixels.edgeDensity.toFixed(4)}`,
                }
                : { id: 'rendered-not-blank', status: 'fail', detail: blankFailures.join('; ') });
            if (contract.alpha !== undefined) {
                // Read nonOpaqueFraction, not transparentFraction: a uniformly half-transparent image has no
                // see-through pixels by the 8/255 test but is not opaque either, and an "opaque required" slot must
                // reject it. Codex finding 1.
                const hasAlpha = pixels.nonOpaqueFraction > 0;
                checks.push(hasAlpha === contract.alpha
                    ? {
                        id: 'alpha-matches',
                        status: 'pass',
                        detail: `non-opaque fraction ${pixels.nonOpaqueFraction.toFixed(4)} (fully see-through ${pixels.transparentFraction.toFixed(4)}), wanted ${contract.alpha ? 'transparency' : 'opaque'}`,
                    }
                    : {
                        id: 'alpha-matches',
                        status: 'fail',
                        detail: contract.alpha
                            ? 'contract requires transparency, every pixel is fully opaque'
                            : `contract requires opaque, ${(pixels.nonOpaqueFraction * 100).toFixed(1)}% of pixels carry alpha below 255`,
                    });
            }
            if (contract.placement && (decoded.width !== contract.width || decoded.height !== contract.height)) {
                // THE PLACEMENT REGION IS ONLY MEANINGFUL AT THE CONTRACTED GEOMETRY.
                //
                // Found live, and it is the exact failure class this module exists to prevent. Gemini honours an aspect
                // ratio and picks its own pixel ladder, so a 1024x576 request came back 1376x768. The ink region was
                // computed for the requested size, so on the returned image it landed partly on the dark field instead of
                // on the reserved band, and the check reported "worst contrast 1.00:1" - a real measurement of the wrong
                // place. A confidently wrong number is worse than an honest refusal, so this reports UNVERIFIED and names
                // why. Rescaling the region would be a guess about where the text goes on an image nobody asked for.
                checks.push({
                    id: 'contrast-at-placement',
                    status: 'unverified',
                    detail: `the image is ${decoded.width}x${decoded.height} but the placement region was specified against ${contract.width}x${contract.height}, so the region no longer marks where the text will sit; measuring it would report a number for the wrong pixels`,
                });
                decodeReason = decodeReason || 'placement-geometry-drift';
            }
            else if (contract.placement) {
                const ink = parseHexColor(contract.placement.inkHex);
                const backdrop = contract.placement.backdropHex ? parseHexColor(contract.placement.backdropHex) : { r: 255, g: 255, b: 255 };
                if (!ink || !backdrop) {
                    checks.push({
                        id: 'contrast-at-placement',
                        status: 'fail',
                        detail: `unparseable color in placement contract (ink ${contract.placement.inkHex}, backdrop ${contract.placement.backdropHex ?? '#ffffff'})`,
                    });
                }
                else {
                    const region = contract.placement.region;
                    const outOfBounds = region !== undefined &&
                        (region.x < 0 ||
                            region.y < 0 ||
                            region.width <= 0 ||
                            region.height <= 0 ||
                            region.x + region.width > decoded.width ||
                            region.y + region.height > decoded.height);
                    if (outOfBounds) {
                        checks.push({
                            id: 'contrast-at-placement',
                            status: 'fail',
                            detail: `placement region ${JSON.stringify(region)} falls outside the ${decoded.width}x${decoded.height} image`,
                        });
                    }
                    else {
                        contrast = contrastAgainstPixels(decoded.rgba, decoded.width, decoded.height, ink, { region, backdrop });
                        const mode = contract.placement.mode || 'worst';
                        const got = mode === 'mean' ? contrast.mean : contrast.worst;
                        checks.push(got >= contract.placement.minContrast
                            ? {
                                id: 'contrast-at-placement',
                                status: 'pass',
                                detail: `${mode} contrast ${got.toFixed(2)}:1 >= ${contract.placement.minContrast}:1 over ${contrast.sampled} px`,
                            }
                            : {
                                id: 'contrast-at-placement',
                                status: 'fail',
                                detail: `${mode} contrast ${got.toFixed(2)}:1 < ${contract.placement.minContrast}:1 over ${contrast.sampled} px (mean ${contrast.mean.toFixed(2)}:1)`,
                            });
                    }
                }
            }
        }
        else {
            // No pixel source. Unchanged behaviour: every pixel check reports UNVERIFIED with its reason named, and the
            // verdict can therefore never be `verified`. This is the property that must survive the whole change.
            const r = refusal || { reason: 'no-pixel-source', detail: 'no pixel source was available' };
            decodeReason = r.reason;
            checks.push({ id: 'pixels-decodable', status: 'unverified', detail: r.detail });
            checks.push({ id: 'rendered-not-blank', status: 'unverified', detail: `pixels not decoded (${r.reason})` });
            if (contract.alpha !== undefined)
                checks.push({ id: 'alpha-matches', status: 'unverified', detail: `pixels not decoded (${r.reason})` });
            if (contract.placement)
                checks.push({ id: 'contrast-at-placement', status: 'unverified', detail: `pixels not decoded (${r.reason})` });
        }
    }
    const expectSynthetic = contract.expectSynthetic === true;
    if (synthetic === expectSynthetic) {
        checks.push({
            id: 'provenance-matches',
            status: 'pass',
            detail: synthetic ? 'carries the offline synthetic marker, as expected' : 'no offline synthetic marker present',
        });
    }
    else if (synthetic) {
        checks.push({
            id: 'provenance-matches',
            status: 'fail',
            detail: 'bytes carry the offline synthetic marker but the caller claims a real provider render',
        });
    }
    else {
        checks.push({
            id: 'provenance-matches',
            status: 'fail',
            detail: 'caller claims the offline placeholder but the bytes carry no synthetic marker',
        });
    }
    const unverifiedReasons = checks
        .filter((c) => c.status === 'unverified')
        .map((c) => `${c.id}: ${decodeReason || c.detail}`);
    return {
        verdict: fold(checks),
        bytes: buf.length,
        sniffedFormat: sniffed,
        dimensions: dims,
        pixels,
        contrast,
        synthetic,
        checks,
        unverifiedReasons,
    };
}
/** One-line human summary of a report, for stderr and for the flow lens. */
function summarizeReport(report) {
    const failed = report.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    const unver = report.checks.filter((c) => c.status === 'unverified').map((c) => c.id);
    const parts = [`verdict=${report.verdict}`, `bytes=${report.bytes}`];
    if (report.dimensions)
        parts.push(`${report.dimensions.width}x${report.dimensions.height}`);
    if (report.sniffedFormat)
        parts.push(report.sniffedFormat);
    if (failed.length)
        parts.push(`failed=[${failed.join(',')}]`);
    if (unver.length)
        parts.push(`unverified=[${unver.join(',')}]`);
    return parts.join(' ');
}
//# sourceMappingURL=image-asset-verify.js.map