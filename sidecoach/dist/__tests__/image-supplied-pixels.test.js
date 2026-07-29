"use strict";
// sidecoach/src/__tests__/image-supplied-pixels.test.ts
//
// Contract for closing the pixel-verification hole on our own default provider WITHOUT loosening the three-value
// verdict, which is the one property that was not tradeable.
//
// Background: every Gemini image model answers a PNG request with JPEG. This repo decodes PNG only, so all four
// pixel checks returned `unverified` on the output of the provider we default to, and the overlay-contrast
// measurement produced no number at all. The fix supplies real RGBA obtained through a browser (playwright is
// already a dependency) rather than writing a JPEG decoder, whose hand-rolled inverse DCT would be a new
// correctness risk.
//
// What is proven here, in the order that matters:
//   1. NOTHING LOOSENED. Supplying pixels never turns a failure into a pass. `format-matches` still fails on a
//      JPEG answer to a PNG request, and the overall verdict stays failed.
//   2. NO PIXELS, NO CLAIM. Without a supply, a non-PNG asset behaves exactly as before: every pixel check
//      unverified, reason named, and the verdict can never be `verified`.
//   3. A SUPPLY IS CHECKED, NOT TRUSTED. Pixels whose dimensions disagree with the bytes' own header are REFUSED
//      by name, because measuring a different image and reporting the number as this asset's would be worse than
//      measuring nothing.
//   4. PROVENANCE CANNOT BE LAUNDERED THROUGH THE NEW DOOR. Supplied pixels can never assert the synthetic marker.
//   5. THE PNG PATH IS UNCHANGED, asserted by measuring the same image both ways and getting the same numbers.
//   6. The browser decoder AGREES WITH AN INDEPENDENT DECODER on real JPEG bytes, when one is available.
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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const image_asset_verify_1 = require("../image-asset-verify");
const image_png_codec_1 = require("../image-png-codec");
const image_jpeg_pixels_1 = require("../image-jpeg-pixels");
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-supplied-px-'));
/** A deterministic image with real structure: a light left band and a dark right field. */
function buildImage(w, h) {
    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const left = x < Math.floor(w / 3);
            // A ripple keeps it off a flat fill so the blank detectors have something honest to measure.
            const j = Math.round(Math.sin((x / w) * 12) * 6);
            rgba[i] = left ? 246 + (j % 4) : 27;
            rgba[i + 1] = left ? 244 + (j % 4) : 77;
            rgba[i + 2] = left ? 238 + (j % 4) : 77;
            rgba[i + 3] = 255;
        }
    }
    return { rgba, png: (0, image_png_codec_1.encodePng)(w, h, rgba) };
}
const W = 240;
const H = 120;
const IMG = buildImage(W, H);
/** A contract that asks for PNG and contracts a contrast measurement in the light left band. */
function pngContract(over = {}) {
    return {
        width: W,
        height: H,
        format: 'png',
        placement: { inkHex: '#141414', region: { x: 4, y: 10, width: 60, height: 90 }, minContrast: 4.5 },
        ...over,
    };
}
function checkOf(report, id) {
    return report.checks.find((c) => c.id === id);
}
// ---------------------------------------------------------------------------
// 1 + 2. A non-PNG asset: unverified without a supply, measured with one, and NEVER a pass on format
// ---------------------------------------------------------------------------
function testNothingLoosened() {
    // Real JPEG bytes are not constructible here without an encoder, so the substitution is modelled the way it
    // actually arrives: bytes whose sniffed format is not the contracted one. A minimal valid JPEG header is enough
    // for sniffFormat and readDimensions, which is exactly what the verifier keys on.
    const jpeg = minimalJpeg(W, H);
    assert((0, image_asset_verify_1.sniffFormat)(jpeg) === 'jpeg', 'the fixture must sniff as jpeg');
    // WITHOUT a supply: every pixel check unverified, reason named, verdict never verified.
    const bare = (0, image_asset_verify_1.verifyAsset)(jpeg, pngContract());
    assert(checkOf(bare, 'pixels-decodable').status === 'unverified', 'with no supply, pixels stay unreadable');
    assert(checkOf(bare, 'contrast-at-placement').status === 'unverified', 'with no supply, contrast produces no number');
    assert(/format-not-decodable/.test(bare.unverifiedReasons.join(' ')), 'the reason is named, not implied');
    assert(bare.verdict === 'failed', 'a jpeg answering a png contract fails on format');
    // WITH a supply: the pixel checks run and produce real numbers, and format STILL fails.
    const supplied = (0, image_asset_verify_1.verifyAsset)(jpeg, {
        ...pngContract(),
        decodedPixels: { rgba: IMG.rgba, width: W, height: H, source: 'a test harness' },
    });
    assert(checkOf(supplied, 'pixels-decodable').status === 'pass', 'a valid supply makes the pixels readable');
    assert(checkOf(supplied, 'rendered-not-blank').status === 'pass', 'the blank detectors run on supplied pixels');
    const contrast = checkOf(supplied, 'contrast-at-placement');
    assert(contrast.status === 'pass', `contrast must produce a real verdict, got ${contrast.status}: ${contrast.detail}`);
    assert(supplied.contrast !== null && supplied.contrast.worst > 4.5, 'a real contrast number is reported');
    // THE LOAD-BEARING ASSERTION. Supplying pixels must not soften what the provider actually did.
    assert(checkOf(supplied, 'format-matches').status === 'fail', 'format-matches must STILL fail; a supply is not a format');
    assert(supplied.verdict === 'failed', 'the overall verdict stays failed, so nothing was laundered into a pass');
    // And a supply cannot rescue a genuinely bad image either: a flat fill still fails the blank detectors.
    const flat = new Uint8Array(W * H * 4).fill(200);
    for (let i = 3; i < flat.length; i += 4)
        flat[i] = 255;
    const flatReport = (0, image_asset_verify_1.verifyAsset)(jpeg, {
        ...pngContract(),
        decodedPixels: { rgba: flat, width: W, height: H, source: 'a test harness' },
    });
    assert(checkOf(flatReport, 'rendered-not-blank').status === 'fail', 'a flat fill still fails, supplied or not');
}
// ---------------------------------------------------------------------------
// 3. A supply is checked against the bytes, not trusted
// ---------------------------------------------------------------------------
function testSupplyIsChecked() {
    const jpeg = minimalJpeg(W, H);
    const wrongDims = (0, image_asset_verify_1.verifyAsset)(jpeg, {
        ...pngContract(),
        decodedPixels: { rgba: buildImage(W + 8, H).rgba, width: W + 8, height: H, source: 'a test harness' },
    });
    assert(checkOf(wrongDims, 'pixels-decodable').status === 'unverified', 'a mismatched supply is refused, not measured');
    assert(/supplied-pixels-mismatch/.test(wrongDims.unverifiedReasons.join(' ')), 'the refusal is named');
    assert(checkOf(wrongDims, 'contrast-at-placement').status === 'unverified', 'no contrast number from a mismatched supply');
    const malformed = (0, image_asset_verify_1.verifyAsset)(jpeg, {
        ...pngContract(),
        decodedPixels: { rgba: new Uint8Array(10), width: W, height: H, source: 'a test harness' },
    });
    assert(/supplied-pixels-malformed/.test(malformed.unverifiedReasons.join(' ')), 'a short buffer is refused by name');
    // No readable dimensions in the bytes means there is nothing to anchor the supply to.
    const headerless = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    if ((0, image_asset_verify_1.sniffFormat)(headerless) === 'jpeg') {
        const unanchored = (0, image_asset_verify_1.verifyAsset)(headerless, {
            ...pngContract(),
            decodedPixels: { rgba: IMG.rgba, width: W, height: H, source: 'a test harness' },
        });
        assert(/supplied-pixels-unanchored/.test(unanchored.unverifiedReasons.join(' ')), 'a supply with no header to check against is refused by name');
    }
}
// ---------------------------------------------------------------------------
// 4 + 5. Provenance cannot be laundered, and the PNG path is unchanged
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 3b. A placement region is meaningless once the geometry drifts, so it is refused rather than measured
// ---------------------------------------------------------------------------
function testPlacementGeometryDrift() {
    // The live case that produced this rule: a 1024x576 request came back 1376x768, so the ink region computed for
    // the requested size landed on the wrong part of the returned image and the check reported a real measurement of
    // the wrong place. A wrong number is worse than an honest refusal.
    const bigger = buildImage(W + 40, H + 20);
    const jpeg = minimalJpeg(W + 40, H + 20);
    const report = (0, image_asset_verify_1.verifyAsset)(jpeg, {
        ...pngContract(), // contracted at WxH
        decodedPixels: { rgba: bigger.rgba, width: W + 40, height: H + 20, source: 'a test harness' },
    });
    assert(checkOf(report, 'pixels-decodable').status === 'pass', 'the pixels themselves are still readable');
    assert(checkOf(report, 'rendered-not-blank').status === 'pass', 'geometry drift does not stop the blank detectors, which are geometry-independent');
    const contrast = checkOf(report, 'contrast-at-placement');
    assert(contrast.status === 'unverified', `a drifted geometry must refuse the placement check, got ${contrast.status}`);
    assert(/no longer marks where the text will sit/.test(contrast.detail), 'the refusal explains why rather than just declining');
    assert(report.contrast === null, 'no contrast figure is reported at all when the region cannot be trusted');
    assert(report.verdict === 'failed', 'the geometry mismatch is itself still a failure');
    // At the contracted geometry the check runs normally, so this guard is scoped and not a blanket disable.
    const exact = (0, image_asset_verify_1.verifyAsset)(minimalJpeg(W, H), {
        ...pngContract(),
        decodedPixels: { rgba: IMG.rgba, width: W, height: H, source: 'a test harness' },
    });
    assert(checkOf(exact, 'contrast-at-placement').status === 'pass', 'at the contracted geometry the placement check still runs');
}
function testProvenanceAndParity() {
    // A supply cannot claim the synthetic marker, so a placeholder cannot enter through this door.
    const jpeg = minimalJpeg(W, H);
    const supplied = (0, image_asset_verify_1.verifyAsset)(jpeg, {
        ...pngContract(),
        expectSynthetic: false,
        decodedPixels: { rgba: IMG.rgba, width: W, height: H, source: 'a test harness' },
    });
    assert(supplied.synthetic === false, 'supplied pixels can never assert provenance');
    assert(checkOf(supplied, 'provenance-matches').status === 'pass', 'no marker present is the correct provenance for a provider render');
    // A real synthetic PNG still reports its marker, read from the bytes.
    const markedPng = (0, image_png_codec_1.encodePng)(W, H, IMG.rgba, { text: [[image_asset_verify_1.SYNTHETIC_MARKER_KEY, 'offline-deterministic']] });
    const marked = (0, image_asset_verify_1.verifyAsset)(markedPng, pngContract({ expectSynthetic: true }));
    assert(marked.synthetic === true, 'a marked PNG is still detected as synthetic');
    // THE PNG PATH IS UNCHANGED. The same image measured natively and via a supply must give the same numbers, which
    // is what proves the refactor did not alter the existing behaviour.
    const native = (0, image_asset_verify_1.verifyAsset)(IMG.png, pngContract());
    const viaSupply = (0, image_asset_verify_1.verifyAsset)(minimalJpeg(W, H), {
        ...pngContract(),
        decodedPixels: { rgba: IMG.rgba, width: W, height: H, source: 'a test harness' },
    });
    assert(native.verdict === 'verified', `the native PNG path must still verify, got ${native.verdict}`);
    assert(native.contrast !== null && viaSupply.contrast !== null, 'both paths produce a contrast reading');
    assert(Math.abs(native.contrast.worst - viaSupply.contrast.worst) < 1e-9, `the same pixels must measure identically either way: ${native.contrast.worst} vs ${viaSupply.contrast.worst}`);
    assert(native.pixels.uniqueColors === viaSupply.pixels.uniqueColors, 'the blank statistics are identical either way');
}
// ---------------------------------------------------------------------------
// 6. The browser decoder agrees with an independent decoder on real JPEG bytes
// ---------------------------------------------------------------------------
async function testBrowserAgreesWithOracle() {
    // Build a real JPEG by asking the platform to make one from our PNG. When the platform tool is absent the
    // comparison is skipped WITH A NOTICE, never silently, because a quiet skip is how a guard rots.
    const pngPath = path.join(TMP, 'src.png');
    const jpgPath = path.join(TMP, 'src.jpg');
    fs.writeFileSync(pngPath, IMG.png);
    let haveJpeg = false;
    try {
        (0, child_process_1.execFileSync)('sips', ['-s', 'format', 'jpeg', pngPath, '--out', jpgPath], { stdio: 'ignore' });
        haveJpeg = fs.existsSync(jpgPath);
    }
    catch {
        haveJpeg = false;
    }
    if (!haveJpeg) {
        console.log('image-supplied-pixels: NOTICE the browser/oracle comparison was skipped, no platform jpeg encoder available');
        return;
    }
    const jpegBytes = fs.readFileSync(jpgPath);
    const decoded = await (0, image_jpeg_pixels_1.decodeViaBrowser)(jpegBytes, 'jpeg', { playwrightPath: (0, image_jpeg_pixels_1.bundledPlaywrightPath)() });
    if (!decoded.ok) {
        // A missing browser must degrade to a NAMED refusal, which is itself the property worth asserting.
        assert(['browser-unavailable', 'browser-launch-failed'].includes(decoded.reason), `an unavailable browser must refuse by name, got ${decoded.reason}: ${decoded.detail}`);
        console.log(`image-supplied-pixels: NOTICE browser decode unavailable (${decoded.reason}), refusal path asserted instead`);
        return;
    }
    // The oracle: the same JPEG transcoded back to PNG by the platform and read by this repo's own decoder.
    const oraclePath = path.join(TMP, 'oracle.png');
    (0, child_process_1.execFileSync)('sips', ['-s', 'format', 'png', jpgPath, '--out', oraclePath], { stdio: 'ignore' });
    const oracleResult = (0, image_png_codec_1.decodePng)(fs.readFileSync(oraclePath));
    assert(oracleResult.ok, 'the oracle PNG must decode');
    if (!oracleResult.ok)
        return;
    const oracle = oracleResult;
    assert(decoded.width === oracle.width && decoded.height === oracle.height, 'both decoders must agree on dimensions');
    let diff = 0;
    let samples = 0;
    for (let i = 0; i < oracle.rgba.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            diff += Math.abs(decoded.rgba[i + c] - oracle.rgba[i + c]);
            samples++;
        }
    }
    const mean = diff / samples;
    // Two correct JPEG implementations differ by a fraction of a unit. A wrong one differs by tens. The threshold is
    // set where it can actually catch a broken decode rather than where it merely passes today.
    assert(mean < 2, `the browser decode must agree with an independent decoder, mean per-channel difference was ${mean.toFixed(3)}`);
    console.log(`image-supplied-pixels: browser/oracle mean per-channel difference ${mean.toFixed(3)} over ${samples} samples`);
}
/** A minimal JPEG whose SOF0 carries real dimensions. Enough for sniffFormat and readDimensions. */
function minimalJpeg(width, height) {
    const sof = [
        0xff, 0xc0, 0x00, 0x11, 0x08,
        (height >> 8) & 0xff, height & 0xff,
        (width >> 8) & 0xff, width & 0xff,
        0x03,
        0x01, 0x22, 0x00,
        0x02, 0x11, 0x01,
        0x03, 0x11, 0x01,
    ];
    return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, ...sof, 0xff, 0xd9]);
}
async function main() {
    testNothingLoosened();
    testSupplyIsChecked();
    testPlacementGeometryDrift();
    testProvenanceAndParity();
    await testBrowserAgreesWithOracle();
    console.log('image-supplied-pixels: OK (format still fails on a substitution, a drifted geometry refuses the placement check, no supply means unverified with a named reason, a supply is checked not trusted, provenance cannot be laundered, the PNG path measures identically, browser agrees with an independent decoder)');
}
main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
//# sourceMappingURL=image-supplied-pixels.test.js.map