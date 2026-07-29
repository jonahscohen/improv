// sidecoach/src/__tests__/image-asset-verify.test.ts
//
// Contract for src/image-asset-verify.ts - the check that makes a generated asset trustworthy, and the reason
// this pipeline can claim something a generate-and-ship tool cannot.
//
// The properties under test, in order of how badly a regression would hurt:
//   1. THE THREE-VALUE RULE. pass / fail / UNVERIFIED, and unverified NEVER folds into verified. An asset whose
//      pixels cannot be read reports unverified even when its header checks all pass, and a FAILED check beats
//      an unverified one so a wrong asset is never softened into "we could not tell".
//   2. Blank and flat renders are CAUGHT. A white page, a single flat fill, and a near-flat field each fail on
//      real measured statistics, not on a filesize heuristic.
//   3. Contrast is measured against the ACTUAL PIXELS under the text, worst-case by default, and the anchors
//      are checked against published WCAG values (black on white is exactly 21:1).
//   4. Geometry and format come from the BYTES. A png claimed as jpeg fails; a 64x64 claimed as 128x128 fails.
//   5. Provenance cannot be laundered in either direction: an offline placeholder presented as a real render
//      fails, and a real render presented as the placeholder fails too.

import { encodePng } from '../image-png-codec';
import {
  verifyAsset,
  sniffFormat,
  readDimensions,
  contrastRatio,
  parseHexColor,
  analyzePixels,
  summarizeReport,
  SYNTHETIC_MARKER_KEY,
  DEFAULT_BLANK_THRESHOLDS,
  type AssetContract,
  type VerifyReport,
} from '../image-asset-verify';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function check(report: VerifyReport, id: string) {
  const hit = report.checks.find((c) => c.id === id);
  assert(hit !== undefined, `report must carry a ${id} check`);
  return hit as { id: string; status: string; detail: string };
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function solid(width: number, height: number, r: number, g: number, b: number, a = 255, text?: Array<[string, string]>): Buffer {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }
  return encodePng(width, height, rgba, text ? { text } : {});
}

/** A structured image: horizontal gradient plus a hard vertical split, so it has real colors and real edges. */
function structured(width: number, height: number): Buffer {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = x / Math.max(1, width - 1);
      rgba[i] = Math.round(20 + t * 200);
      rgba[i + 1] = x % 8 < 4 ? 40 : 190;
      rgba[i + 2] = Math.round(y * (200 / Math.max(1, height - 1)));
      rgba[i + 3] = 255;
    }
  }
  return encodePng(width, height, rgba);
}

/** Left half near-black, right half near-white. Used for worst-case vs mean contrast. */
function halfSplit(width: number, height: number): Buffer {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dark = x < width / 2;
      rgba[i] = dark ? 8 : 246;
      rgba[i + 1] = dark ? 8 : 246;
      rgba[i + 2] = dark ? 8 : 246;
      rgba[i + 3] = 255;
      // A one-pixel jitter so the halves are not perfectly flat and the blank detector stays quiet.
      if ((x + y) % 7 === 0) rgba[i + 1] = dark ? 20 : 230;
    }
  }
  return encodePng(width, height, rgba);
}

function minimalJpeg(width: number, height: number): Buffer {
  // 21 bytes: the SOF0 segment declares length 17 starting at offset 4, so it ends at byte 20 inclusive.
  // A 19-byte version is a TRUNCATED segment and is now correctly refused by the bounds check.
  const sof = Buffer.alloc(21);
  sof[0] = 0xff;
  sof[1] = 0xd8; // SOI
  sof[2] = 0xff;
  sof[3] = 0xc0; // SOF0
  sof.writeUInt16BE(17, 4); // segment length
  sof[6] = 8; // precision
  sof.writeUInt16BE(height, 7);
  sof.writeUInt16BE(width, 9);
  sof[11] = 3; // components
  return sof;
}

function minimalWebp(width: number, height: number): Buffer {
  const head = Buffer.alloc(30);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(22, 4);
  head.write('WEBP', 8, 'latin1');
  head.write('VP8X', 12, 'latin1');
  head.writeUInt32LE(10, 16);
  head[20] = 0;
  const w = width - 1;
  const h = height - 1;
  head[24] = w & 0xff;
  head[25] = (w >> 8) & 0xff;
  head[26] = (w >> 16) & 0xff;
  head[27] = h & 0xff;
  head[28] = (h >> 8) & 0xff;
  head[29] = (h >> 16) & 0xff;
  return head;
}

function minimalGif(width: number, height: number): Buffer {
  const b = Buffer.alloc(13);
  b.write('GIF89a', 0, 'latin1');
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return b;
}

const BASE: AssetContract = { format: 'png', width: 64, height: 64 };

// ---------------------------------------------------------------------------
// 1. Color math anchored to published values
// ---------------------------------------------------------------------------

function testColorMath(): void {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  assert(Math.abs(contrastRatio(black, white) - 21) < 0.01, `black on white is 21:1, got ${contrastRatio(black, white)}`);
  assert(Math.abs(contrastRatio(white, black) - 21) < 0.01, 'the ratio is symmetric');
  assert(Math.abs(contrastRatio(white, white) - 1) < 1e-9, 'a color against itself is 1:1');
  // #767676 on white is the canonical 4.54:1 boundary color for WCAG AA normal text.
  const grey = parseHexColor('#767676');
  assert(grey !== null, '#767676 parses');
  assert(Math.abs(contrastRatio(grey!, white) - 4.54) < 0.02, `#767676 on white is about 4.54:1, got ${contrastRatio(grey!, white)}`);
  assert(parseHexColor('#abc') !== null && parseHexColor('#abc')!.r === 0xaa, 'three-digit hex expands');
  assert(parseHexColor('not-a-color') === null, 'a bad hex returns null rather than a wrong color');
}

// ---------------------------------------------------------------------------
// 2. Blank and flat renders are caught
// ---------------------------------------------------------------------------

function testBlankDetection(): void {
  const white = verifyAsset(solid(64, 64, 255, 255, 255), BASE);
  assert(check(white, 'rendered-not-blank').status === 'fail', 'an all-white page fails the blank check');
  assert(white.verdict === 'failed', 'a blank render yields a failed verdict');
  assert(white.pixels !== null && white.pixels.uniqueColors === 1, 'a flat fill measures exactly one unique color');

  const flatColor = verifyAsset(solid(64, 64, 30, 90, 160), BASE);
  assert(check(flatColor, 'rendered-not-blank').status === 'fail', 'a single flat color fails the blank check');

  const transparent = verifyAsset(solid(64, 64, 0, 0, 0, 0), BASE);
  assert(check(transparent, 'rendered-not-blank').status === 'fail', 'a fully transparent image fails the blank check');

  const real = verifyAsset(structured(64, 64), BASE);
  assert(check(real, 'rendered-not-blank').status === 'pass', `a structured image passes the blank check (${check(real, 'rendered-not-blank').detail})`);
  assert(real.verdict === 'verified', `a structured, correctly-sized png verifies (got ${real.verdict})`);

  // The thresholds are the knob, and they really do gate: demand more colors than the image has and it fails.
  const tightened = verifyAsset(structured(64, 64), { ...BASE, blank: { minUniqueColors: 1000000 } });
  assert(check(tightened, 'rendered-not-blank').status === 'fail', 'a raised unique-color threshold is honored');
  assert(DEFAULT_BLANK_THRESHOLDS.minUniqueColors > 1, 'the default blank threshold demands more than one color');
}

// ---------------------------------------------------------------------------
// 3. Geometry and format come from the bytes
// ---------------------------------------------------------------------------

function testGeometryAndFormat(): void {
  const png = structured(64, 64);
  const wrongSize = verifyAsset(png, { ...BASE, width: 128, height: 128 });
  assert(check(wrongSize, 'dimensions-match').status === 'fail', 'a size mismatch fails');
  assert(/64x64/.test(check(wrongSize, 'dimensions-match').detail), 'the failure names the actual geometry');

  const wrongFormat = verifyAsset(png, { ...BASE, format: 'jpeg' });
  assert(check(wrongFormat, 'format-matches').status === 'fail', 'png bytes claimed as jpeg fail');

  const empty = verifyAsset(new Uint8Array(0), BASE);
  assert(check(empty, 'bytes-nonzero').status === 'fail', 'a zero-byte asset fails');
  assert(empty.verdict === 'failed', 'a zero-byte asset is a failure, never unverified');

  // Sniffing and dimensions across the formats this repo recognizes but cannot decode.
  assert(sniffFormat(minimalJpeg(300, 200)) === 'jpeg', 'jpeg is sniffed from its SOI marker');
  const jd = readDimensions(minimalJpeg(300, 200), 'jpeg');
  assert(jd !== null && jd.width === 300 && jd.height === 200, 'jpeg geometry comes from SOF0');
  assert(sniffFormat(minimalWebp(640, 480)) === 'webp', 'webp is sniffed from RIFF/WEBP');
  const wd = readDimensions(minimalWebp(640, 480), 'webp');
  assert(wd !== null && wd.width === 640 && wd.height === 480, 'webp geometry comes from VP8X canvas fields');
  assert(sniffFormat(minimalGif(12, 34)) === 'gif', 'gif is sniffed from its header');
  const gd = readDimensions(minimalGif(12, 34), 'gif');
  assert(gd !== null && gd.width === 12 && gd.height === 34, 'gif geometry comes from the logical screen descriptor');
  const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"></svg>');
  assert(sniffFormat(svg) === 'svg', 'svg is sniffed from its root element');
  const sd = readDimensions(svg, 'svg');
  assert(sd !== null && sd.width === 120 && sd.height === 80, 'svg geometry comes from width/height');
  const svgVb = Buffer.from('<svg viewBox="0 0 200 150"></svg>');
  const vd = readDimensions(svgVb, 'svg');
  assert(vd !== null && vd.width === 200 && vd.height === 150, 'svg geometry falls back to viewBox');
  assert(sniffFormat(Buffer.from('plain text, no image here')) === null, 'unknown bytes sniff as null');
}

// ---------------------------------------------------------------------------
// 4. The three-value rule
// ---------------------------------------------------------------------------

function testThreeValueRule(): void {
  const jpeg = minimalJpeg(64, 64);
  const asJpeg = verifyAsset(jpeg, { ...BASE, format: 'jpeg' });
  assert(check(asJpeg, 'dimensions-match').status === 'pass', 'a jpeg with the right geometry passes the geometry check');
  assert(check(asJpeg, 'pixels-decodable').status === 'unverified', 'jpeg pixels are unverified, not passed');
  assert(check(asJpeg, 'rendered-not-blank').status === 'unverified', 'the blank check on a jpeg is unverified, not passed');
  assert(asJpeg.verdict === 'unverified', 'an asset with an unverified check can never be verified');
  assert(asJpeg.unverifiedReasons.length >= 2, 'every unverified check is named in unverifiedReasons');

  // FAIL beats UNVERIFIED: an undecodable asset that is ALSO the wrong size is a failure.
  const wrongAndUndecodable = verifyAsset(jpeg, { ...BASE, format: 'jpeg', width: 999, height: 999 });
  assert(wrongAndUndecodable.verdict === 'failed', 'a failed check outranks an unverified one');

  // A verified asset reports no unverified reasons at all.
  const good = verifyAsset(structured(64, 64), BASE);
  assert(good.verdict === 'verified' && good.unverifiedReasons.length === 0, 'a verified report carries no unverified reasons');
}

// ---------------------------------------------------------------------------
// 5. Alpha requirement
// ---------------------------------------------------------------------------

function testAlpha(): void {
  const opaque = structured(64, 64);
  const rgba = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    rgba[i * 4] = (i * 7) % 256;
    rgba[i * 4 + 1] = (i * 13) % 256;
    rgba[i * 4 + 2] = (i * 29) % 256;
    rgba[i * 4 + 3] = i % 2 === 0 ? 0 : 255;
  }
  const withAlpha = encodePng(64, 64, rgba);

  assert(check(verifyAsset(opaque, { ...BASE, alpha: true }), 'alpha-matches').status === 'fail', 'an opaque image fails a transparency requirement');
  assert(check(verifyAsset(withAlpha, { ...BASE, alpha: true }), 'alpha-matches').status === 'pass', 'a transparent image satisfies a transparency requirement');
  assert(check(verifyAsset(withAlpha, { ...BASE, alpha: false }), 'alpha-matches').status === 'fail', 'a transparent image fails an opaque requirement');
  assert(check(verifyAsset(opaque, { ...BASE, alpha: false }), 'alpha-matches').status === 'pass', 'an opaque image satisfies an opaque requirement');
  assert(verifyAsset(opaque, BASE).checks.every((c) => c.id !== 'alpha-matches'), 'with no alpha clause the check is not run at all');

  // The case the 8/255 see-through test missed (Codex review 2026-07-29, finding 1): a UNIFORMLY half-opaque
  // image has no fully see-through pixel anywhere, yet it is not opaque either. An "opaque required" slot has to
  // reject it, or a semi-transparent plate lands on a page and washes out whatever is behind it.
  const halfOpaque = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    halfOpaque[i * 4] = (i * 11) % 256;
    halfOpaque[i * 4 + 1] = (i * 37) % 256;
    halfOpaque[i * 4 + 2] = (i * 71) % 256;
    halfOpaque[i * 4 + 3] = 128;
  }
  const half = encodePng(64, 64, halfOpaque);
  const halfStats = verifyAsset(half, BASE);
  assert(halfStats.pixels !== null, 'the half-opaque fixture decodes');
  assert(halfStats.pixels!.transparentFraction === 0, 'a uniformly half-opaque image has NO fully see-through pixels');
  assert(halfStats.pixels!.nonOpaqueFraction === 1, 'but every one of its pixels is non-opaque');
  assert(check(verifyAsset(half, { ...BASE, alpha: false }), 'alpha-matches').status === 'fail', 'a uniformly half-opaque image FAILS an opaque requirement');
  assert(check(verifyAsset(half, { ...BASE, alpha: true }), 'alpha-matches').status === 'pass', 'and it satisfies a transparency requirement');
  assert(verifyAsset(opaque, BASE).pixels!.nonOpaqueFraction === 0, 'a fully opaque image reports a zero non-opaque fraction');
}

// ---------------------------------------------------------------------------
// 5b. Header parsing refuses to answer from bytes outside the declared segment
//
// Codex review 2026-07-29, findings 4 and 5: a lying segment length previously yielded confident wrong
// dimensions read from whatever followed. A wrong answer is worse than no answer, because the dimension check
// then passes or fails on fiction.
// ---------------------------------------------------------------------------

function testHeaderBounds(): void {
  // JPEG: an SOF marker whose segment claims more bytes than the file holds.
  const lyingJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x40, 0x08, 0x01, 0x2c, 0x00, 0xc8, 0x03]);
  assert(sniffFormat(lyingJpeg) === 'jpeg', 'the truncated jpeg still sniffs as jpeg');
  assert(readDimensions(lyingJpeg, 'jpeg') === null, 'a jpeg segment that runs past the end of the file yields NO dimensions');

  // JPEG: a segment length too small to contain the geometry fields.
  const shortSof = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x04, 0x08, 0x01, 0x2c, 0x00, 0xc8, 0x03, 0x00, 0x00]);
  assert(readDimensions(shortSof, 'jpeg') === null, 'an SOF segment too short to hold the geometry yields NO dimensions');

  // WebP: a VP8X chunk that declares a size larger than the remaining file.
  const lyingWebp = Buffer.alloc(30);
  lyingWebp.write('RIFF', 0, 'latin1');
  lyingWebp.writeUInt32LE(22, 4);
  lyingWebp.write('WEBP', 8, 'latin1');
  lyingWebp.write('VP8X', 12, 'latin1');
  lyingWebp.writeUInt32LE(9999, 16);
  assert(sniffFormat(lyingWebp) === 'webp', 'the lying webp still sniffs as webp');
  assert(readDimensions(lyingWebp, 'webp') === null, 'a webp chunk claiming more bytes than the file holds yields NO dimensions');

  // WebP: a VP8X chunk that fits but declares too few bytes to carry a canvas size.
  const shortVp8x = Buffer.alloc(30);
  shortVp8x.write('RIFF', 0, 'latin1');
  shortVp8x.writeUInt32LE(22, 4);
  shortVp8x.write('WEBP', 8, 'latin1');
  shortVp8x.write('VP8X', 12, 'latin1');
  shortVp8x.writeUInt32LE(4, 16);
  assert(readDimensions(shortVp8x, 'webp') === null, 'a VP8X chunk too small for a canvas size yields NO dimensions');

  // And a well-formed one still answers, so the bounds checks did not simply disable the parsers.
  assert(readDimensions(minimalWebp(640, 480), 'webp') !== null, 'a well-formed webp still yields dimensions');
  assert(readDimensions(minimalJpeg(300, 200), 'jpeg') !== null, 'a well-formed jpeg still yields dimensions');
}

// ---------------------------------------------------------------------------
// 6. Contrast at placement, on real pixels
// ---------------------------------------------------------------------------

function testPlacementContrast(): void {
  const split = halfSplit(64, 64);

  // White ink over the WHOLE image: the near-white right half makes the worst case unreadable.
  const worstFail = verifyAsset(split, { ...BASE, placement: { inkHex: '#ffffff', minContrast: 4.5 } });
  assert(check(worstFail, 'contrast-at-placement').status === 'fail', 'white ink over a half-white image fails worst-case contrast');

  // The same image, mean mode: the dark half pulls the average up, which is exactly why worst is the default.
  const meanReport = verifyAsset(split, { ...BASE, placement: { inkHex: '#ffffff', minContrast: 4.5, mode: 'mean' } });
  assert(meanReport.contrast !== null, 'the report carries the measured contrast numbers');
  assert(meanReport.contrast!.mean > meanReport.contrast!.worst, 'mean contrast is higher than worst-case on a split field');
  assert(check(meanReport, 'contrast-at-placement').status === 'pass', 'mean mode passes where worst-case fails, proving the modes differ');

  // White ink restricted to the DARK half passes, which proves the region is honored rather than ignored.
  const region = verifyAsset(split, { ...BASE, placement: { inkHex: '#ffffff', minContrast: 4.5, region: { x: 0, y: 0, width: 30, height: 64 } } });
  assert(check(region, 'contrast-at-placement').status === 'pass', `white ink on the dark half passes (${check(region, 'contrast-at-placement').detail})`);
  assert(region.contrast !== null && region.contrast.sampled === 30 * 64, 'the sample count matches the region area');

  // Near-black ink on the same dark half fails: same region, opposite ink, opposite outcome.
  const inkFlip = verifyAsset(split, { ...BASE, placement: { inkHex: '#111111', minContrast: 4.5, region: { x: 0, y: 0, width: 30, height: 64 } } });
  assert(check(inkFlip, 'contrast-at-placement').status === 'fail', 'dark ink on the dark half fails');

  // A region outside the image is a contract error, and it FAILS rather than being quietly clamped.
  const oob = verifyAsset(split, { ...BASE, placement: { inkHex: '#ffffff', minContrast: 4.5, region: { x: 40, y: 40, width: 100, height: 100 } } });
  assert(check(oob, 'contrast-at-placement').status === 'fail', 'an out-of-bounds placement region fails');
  assert(/outside/.test(check(oob, 'contrast-at-placement').detail), 'the out-of-bounds failure says so');

  // An unparseable ink color fails rather than defaulting to something readable.
  const badInk = verifyAsset(split, { ...BASE, placement: { inkHex: 'chartreuse-ish', minContrast: 4.5 } });
  assert(check(badInk, 'contrast-at-placement').status === 'fail', 'an unparseable ink color fails the check');

  // Transparency composites onto the declared backdrop: the SAME transparent image reads differently against
  // white and against black, which is what a real placement needs.
  const clear = solid(32, 32, 255, 255, 255, 0);
  const onWhite = verifyAsset(clear, { format: 'png', width: 32, height: 32, placement: { inkHex: '#ffffff', minContrast: 1.5, backdropHex: '#ffffff' } });
  const onBlack = verifyAsset(clear, { format: 'png', width: 32, height: 32, placement: { inkHex: '#ffffff', minContrast: 1.5, backdropHex: '#000000' } });
  assert(check(onWhite, 'contrast-at-placement').status === 'fail', 'white ink on a transparent image over white fails');
  assert(check(onBlack, 'contrast-at-placement').status === 'pass', 'white ink on a transparent image over black passes');

  // analyzePixels honors its region too.
  const whole = analyzePixels(new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1);
  const half = analyzePixels(new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1, { region: { x: 0, y: 0, width: 1, height: 1 } });
  assert(whole.uniqueColors === 2 && half.uniqueColors === 1, 'analyzePixels restricts to its region');
  assert(whole.sampled === 2 && half.sampled === 1, 'the sample count reflects the region');
}

// ---------------------------------------------------------------------------
// 7. Provenance cannot be laundered in either direction
// ---------------------------------------------------------------------------

function testProvenance(): void {
  const marked = structuredWithMarker();
  const plain = structured(64, 64);

  const passedOffAsReal = verifyAsset(marked, BASE);
  assert(check(passedOffAsReal, 'provenance-matches').status === 'fail', 'a marked placeholder claimed as a real render fails');
  assert(passedOffAsReal.synthetic === true, 'the report surfaces that the bytes are synthetic');
  assert(passedOffAsReal.verdict === 'failed', 'laundering a placeholder is a hard failure');

  const honestOffline = verifyAsset(marked, { ...BASE, expectSynthetic: true });
  assert(check(honestOffline, 'provenance-matches').status === 'pass', 'a marked placeholder declared as one passes');
  assert(honestOffline.verdict === 'verified', 'an honestly-declared placeholder can verify');

  const realAsOffline = verifyAsset(plain, { ...BASE, expectSynthetic: true });
  assert(check(realAsOffline, 'provenance-matches').status === 'fail', 'a real render claimed as the placeholder fails');
  assert(verifyAsset(plain, BASE).synthetic === false, 'an unmarked asset is not reported synthetic');

  const summary = summarizeReport(passedOffAsReal);
  assert(/provenance-matches/.test(summary) && /verdict=failed/.test(summary), `the summary names the failed check: ${summary}`);
}

function structuredWithMarker(): Buffer {
  const base = structured(64, 64);
  // Re-encode the same pixels WITH the marker so the only difference from `plain` is the marker itself.
  const rgba = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const t = x / 63;
      rgba[i] = Math.round(20 + t * 200);
      rgba[i + 1] = x % 8 < 4 ? 40 : 190;
      rgba[i + 2] = Math.round(y * (200 / 63));
      rgba[i + 3] = 255;
    }
  }
  const out = encodePng(64, 64, rgba, { text: [[SYNTHETIC_MARKER_KEY, 'offline-deterministic']] });
  assert(!out.equals(base), 'the marked fixture differs from the unmarked one only by its marker chunk');
  return out;
}

function main(): void {
  testColorMath();
  testBlankDetection();
  testGeometryAndFormat();
  testThreeValueRule();
  testAlpha();
  testHeaderBounds();
  testPlacementContrast();
  testProvenance();
  console.log('image-asset-verify: OK (published contrast anchors, blank/flat/transparent caught, geometry+format from bytes, three-value rule, alpha both ways including uniform half-opacity, lying jpeg/webp segment lengths refused, placement regions and backdrops, provenance both directions)');
}

main();
