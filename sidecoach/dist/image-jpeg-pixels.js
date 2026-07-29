"use strict";
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
exports.decodeViaBrowser = decodeViaBrowser;
exports.bundledPlaywrightPath = bundledPlaywrightPath;
const path = __importStar(require("path"));
/** Formats a browser will decode for us. Anything else is refused by name rather than attempted. */
const BROWSER_DECODABLE = new Set(['jpeg', 'webp', 'png', 'gif', 'avif']);
/**
 * Decode image bytes to RGBA through a headless browser.
 *
 * Never throws. Every failure is a named refusal, because the caller's contract is that an unreadable image is
 * reported as unread rather than guessed at.
 */
async function decodeViaBrowser(buf, format, opts = {}) {
    if (!BROWSER_DECODABLE.has(format)) {
        return { ok: false, reason: 'unsupported-format', detail: `a browser is not being asked to decode ${format}` };
    }
    // Resolved at call time, not imported at module load. This module must not make playwright a hard requirement
    // of loading the verifier: an install without browsers still runs everything else, and simply reports that the
    // pixels could not be read.
    let chromium;
    try {
        const mod = require(opts.playwrightPath || 'playwright');
        chromium = mod.chromium;
        if (!chromium || typeof chromium.launch !== 'function')
            throw new Error('playwright exposed no chromium.launch');
    }
    catch (err) {
        return {
            ok: false,
            reason: 'browser-unavailable',
            detail: `playwright is not loadable (${err instanceof Error ? err.message : String(err)}); pixel checks cannot run on ${format}`,
        };
    }
    const timeoutMs = opts.timeoutMs ?? 30000;
    let browser = null;
    try {
        browser = await chromium.launch({ args: ['--disable-gpu'] });
    }
    catch (err) {
        return {
            ok: false,
            reason: 'browser-launch-failed',
            detail: `chromium did not launch (${err instanceof Error ? err.message : String(err)}); run \`npx playwright install chromium\``,
        };
    }
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(timeoutMs);
        const dataUrl = `data:image/${format};base64,${Buffer.from(buf).toString('base64')}`;
        const result = (await page.evaluate(async (url) => {
            const img = new Image();
            try {
                await new Promise((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error('the browser could not decode these bytes'));
                    img.src = url;
                });
            }
            catch (e) {
                return { error: e instanceof Error ? e.message : String(e) };
            }
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            if (!w || !h)
                return { error: 'decoded to zero dimensions' };
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx)
                return { error: 'no 2d context' };
            // No smoothing and a 1:1 draw, so the pixels read back are the decoded pixels and not a resample of them.
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, w, h);
            return { w, h, bytes: Array.from(data.data) };
        }, dataUrl));
        if (result.error)
            return { ok: false, reason: 'decode-failed', detail: result.error };
        if (!result.bytes || !result.w || !result.h || result.bytes.length !== result.w * result.h * 4) {
            return {
                ok: false,
                reason: 'empty-result',
                detail: `the browser returned ${result.bytes ? result.bytes.length : 0} samples for ${result.w ?? 0}x${result.h ?? 0}`,
            };
        }
        return {
            ok: true,
            rgba: Uint8Array.from(result.bytes),
            width: result.w,
            height: result.h,
            source: 'a headless chromium canvas decode',
        };
    }
    catch (err) {
        return { ok: false, reason: 'decode-failed', detail: err instanceof Error ? err.message : String(err) };
    }
    finally {
        try {
            await browser.close();
        }
        catch {
            // A browser that will not close is not a verification result. Nothing to report and nothing to salvage.
        }
    }
}
/** Where playwright lives when resolved from this package rather than from the caller's cwd. */
function bundledPlaywrightPath() {
    return path.resolve(__dirname, '..', 'node_modules', 'playwright');
}
//# sourceMappingURL=image-jpeg-pixels.js.map