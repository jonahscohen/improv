// sidecoach/src/__tests__/image-png-codec.test.ts
//
// Contract for src/image-png-codec.ts - the encoder and decoder the whole image-verification story rests on.
// If the decoder is wrong, every pixel-level claim above it is worthless, so this suite builds PNGs BY HAND
// (chunk writer + zlib + the five filter types) and checks the decoded pixels against the bytes that went in.
//
// What is proven here:
//   1. Round trip: encode then decode returns the exact pixels, including alpha.
//   2. Determinism: the same pixels and text chunks yield byte-identical output (the offline mode's contract).
//   3. All five scanline filters unfilter correctly, checked against independently-computed expected pixels.
//   4. All five color types and both supported bit depths decode, including palette transparency.
//   5. Every refusal path returns its NAMED reason rather than throwing or guessing: not a png, truncated,
//      interlaced, sub-byte depth, unknown color type, no IDAT, corrupt deflate, short IDAT, bad filter byte.

import * as zlib from 'zlib';
import { encodePng, decodePng, readPngHeader, crc32, PNG_SIGNATURE } from '../image-png-codec';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// A hand chunk writer, so fixtures are built from the spec rather than from the encoder under test.
// ---------------------------------------------------------------------------

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

interface IhdrSpec {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace?: number;
}

function ihdr(spec: IhdrSpec): Buffer {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(spec.width, 0);
  b.writeUInt32BE(spec.height, 4);
  b[8] = spec.bitDepth;
  b[9] = spec.colorType;
  b[10] = 0;
  b[11] = 0;
  b[12] = spec.interlace ?? 0;
  return b;
}

function buildPng(spec: IhdrSpec, idatRaw: Buffer, extra: Buffer[] = [], rawIdatOverride?: Buffer): Buffer {
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr(spec)),
    ...extra,
    chunk('IDAT', rawIdatOverride ?? zlib.deflateSync(idatRaw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 1. Round trip + determinism
// ---------------------------------------------------------------------------

function testRoundTrip(): void {
  const width = 5;
  const height = 4;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = (i * 17) % 256;
    rgba[i * 4 + 1] = (i * 53) % 256;
    rgba[i * 4 + 2] = (i * 97) % 256;
    rgba[i * 4 + 3] = i % 3 === 0 ? 0 : 255;
  }
  const png = encodePng(width, height, rgba, { text: [['sidecoach-test', 'round-trip']] });
  const decoded = decodePng(png);
  assert(decoded.ok, 'a PNG written by encodePng must decode');
  if (!decoded.ok) return;
  assert(decoded.width === width && decoded.height === height, 'round trip preserves geometry');
  assert(decoded.colorType === 6 && decoded.bitDepth === 8, 'encoder emits 8-bit truecolor with alpha');
  for (let i = 0; i < rgba.length; i++) {
    assert(decoded.rgba[i] === rgba[i], `round trip preserves byte ${i} (${decoded.rgba[i]} vs ${rgba[i]})`);
  }
  assert(decoded.text['sidecoach-test'] === 'round-trip', 'tEXt chunks round trip');

  const again = encodePng(width, height, rgba, { text: [['sidecoach-test', 'round-trip']] });
  assert(png.equals(again), 'encodePng is byte-deterministic for identical input');

  let threw = false;
  try {
    encodePng(width, height, rgba.subarray(0, rgba.length - 4));
  } catch {
    threw = true;
  }
  assert(threw, 'a short pixel buffer throws rather than encoding a corrupt image');

  const header = readPngHeader(png);
  assert(header.ok && header.width === width && header.interlace === 0, 'readPngHeader reads IHDR without inflating');
}

// ---------------------------------------------------------------------------
// 2. All five scanline filters, checked against independently-computed pixels
// ---------------------------------------------------------------------------

function paethRef(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Encode raw RGB rows with a chosen filter type per row, applying the filter arithmetic by the spec. */
function filteredIdat(rows: number[][], bpp: number, filters: number[]): Buffer {
  const stride = rows[0].length;
  const out: number[] = [];
  for (let y = 0; y < rows.length; y++) {
    const f = filters[y];
    out.push(f);
    for (let i = 0; i < stride; i++) {
      const raw = rows[y][i];
      const left = i >= bpp ? rows[y][i - bpp] : 0;
      const up = y > 0 ? rows[y - 1][i] : 0;
      const upLeft = y > 0 && i >= bpp ? rows[y - 1][i - bpp] : 0;
      let v: number;
      switch (f) {
        case 0: v = raw; break;
        case 1: v = raw - left; break;
        case 2: v = raw - up; break;
        case 3: v = raw - ((left + up) >> 1); break;
        case 4: v = raw - paethRef(left, up, upLeft); break;
        default: throw new Error(`bad filter ${f}`);
      }
      out.push(((v % 256) + 256) % 256);
    }
  }
  return Buffer.from(out);
}

function testFilters(): void {
  const width = 4;
  const height = 5;
  const bpp = 3;
  const rows: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width * bpp; x++) row.push((y * 31 + x * 7 + 13) % 256);
    rows.push(row);
  }
  // Row 0 must use a filter with no up-reference; rows 1-4 exercise sub, up, average, paeth.
  const filters = [0, 1, 2, 3, 4];
  const png = buildPng({ width, height, bitDepth: 8, colorType: 2 }, filteredIdat(rows, bpp, filters));
  const decoded = decodePng(png);
  assert(decoded.ok, 'a hand-built filtered PNG decodes');
  if (!decoded.ok) return;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dst = (y * width + x) * 4;
      assert(decoded.rgba[dst] === rows[y][x * 3], `filter ${filters[y]} row ${y} px ${x} red`);
      assert(decoded.rgba[dst + 1] === rows[y][x * 3 + 1], `filter ${filters[y]} row ${y} px ${x} green`);
      assert(decoded.rgba[dst + 2] === rows[y][x * 3 + 2], `filter ${filters[y]} row ${y} px ${x} blue`);
      assert(decoded.rgba[dst + 3] === 255, `filter ${filters[y]} row ${y} px ${x} alpha defaults opaque`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Color types and bit depths
// ---------------------------------------------------------------------------

function testColorTypes(): void {
  // Grayscale, 8-bit.
  const gray = buildPng({ width: 2, height: 1, bitDepth: 8, colorType: 0 }, Buffer.from([0, 10, 200]));
  const g = decodePng(gray);
  assert(g.ok, 'grayscale decodes');
  if (g.ok) {
    assert(g.rgba[0] === 10 && g.rgba[1] === 10 && g.rgba[2] === 10 && g.rgba[3] === 255, 'gray expands to opaque rgb');
    assert(g.rgba[4] === 200, 'second gray pixel');
  }

  // Palette with transparency.
  const plte = chunk('PLTE', Buffer.from([255, 0, 0, 0, 255, 0]));
  const trns = chunk('tRNS', Buffer.from([0, 128]));
  const pal = buildPng({ width: 2, height: 1, bitDepth: 8, colorType: 3 }, Buffer.from([0, 0, 1]), [plte, trns]);
  const p = decodePng(pal);
  assert(p.ok, 'palette decodes');
  if (p.ok) {
    assert(p.rgba[0] === 255 && p.rgba[1] === 0 && p.rgba[2] === 0, 'palette index 0 is red');
    assert(p.rgba[3] === 0, 'tRNS makes palette index 0 fully transparent');
    assert(p.rgba[4] === 0 && p.rgba[5] === 255 && p.rgba[7] === 128, 'palette index 1 is green at alpha 128');
  }

  // Grayscale + alpha.
  const ga = buildPng({ width: 2, height: 1, bitDepth: 8, colorType: 4 }, Buffer.from([0, 40, 0, 90, 255]));
  const a = decodePng(ga);
  assert(a.ok, 'gray+alpha decodes');
  if (a.ok) {
    assert(a.rgba[0] === 40 && a.rgba[3] === 0, 'first pixel gray 40 fully transparent');
    assert(a.rgba[4] === 90 && a.rgba[7] === 255, 'second pixel gray 90 opaque');
  }

  // 16-bit truecolor: the decoder keeps the high byte.
  const raw16 = Buffer.from([0, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]);
  const deep = buildPng({ width: 1, height: 1, bitDepth: 16, colorType: 2 }, raw16);
  const d = decodePng(deep);
  assert(d.ok, '16-bit truecolor decodes');
  if (d.ok) {
    assert(d.rgba[0] === 0x12 && d.rgba[1] === 0x56 && d.rgba[2] === 0x9a, '16-bit samples reduce to their high byte');
  }

  // Palette missing its PLTE is a named refusal, not a crash.
  const noPlte = buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 3 }, Buffer.from([0, 0]));
  const np = decodePng(noPlte);
  assert(!np.ok && np.reason === 'missing-palette', 'color type 3 with no PLTE refuses with missing-palette');
}

// ---------------------------------------------------------------------------
// 4. Refusals - each one NAMED, none of them a silent pass
// ---------------------------------------------------------------------------

function testRefusals(): void {
  const cases: Array<[string, Buffer, string]> = [
    ['not a png', Buffer.from('this is not an image at all'), 'not-a-png'],
    ['truncated after signature', Buffer.concat([PNG_SIGNATURE, Buffer.from([0, 0])]), 'truncated'],
    [
      'interlaced',
      buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 6, interlace: 1 }, Buffer.from([0, 1, 2, 3, 4])),
      'interlaced-unsupported',
    ],
    ['4-bit palette', buildPng({ width: 2, height: 1, bitDepth: 4, colorType: 3 }, Buffer.from([0, 0]), [chunk('PLTE', Buffer.from([1, 2, 3]))]), 'bit-depth-unsupported'],
    ['unknown color type 5', buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 5 }, Buffer.from([0, 1])), 'color-type-unsupported'],
    [
      'no IDAT',
      Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr({ width: 1, height: 1, bitDepth: 8, colorType: 6 })), chunk('IEND', Buffer.alloc(0))]),
      'missing-idat',
    ],
    [
      'corrupt deflate stream',
      buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 6 }, Buffer.alloc(0), [], Buffer.from([0x01, 0x02, 0x03, 0x04])),
      'inflate-failed',
    ],
    ['IDAT too short for the geometry', buildPng({ width: 4, height: 4, bitDepth: 8, colorType: 6 }, Buffer.from([0, 1, 2, 3, 4])), 'idat-size-mismatch'],
    ['bad filter byte', buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 6 }, Buffer.from([9, 1, 2, 3, 4])), 'bad-filter-type'],
  ];
  for (const [label, bytes, reason] of cases) {
    const res = decodePng(bytes);
    assert(!res.ok, `${label} must refuse, not decode`);
    if (!res.ok) assert(res.reason === reason, `${label} refuses with ${reason}, got ${res.reason}`);
  }

  // ---------------------------------------------------------------------------
  // Strictness added after the 2026-07-29 Codex review (findings 2 and 3). Each of these previously DECODED
  // into plausible-looking pixels that the verifier above would then have certified.
  // ---------------------------------------------------------------------------

  // A corrupted chunk whose CRC no longer matches its bytes.
  const corrupt = Buffer.from(encodePng(2, 2, new Uint8Array(16).fill(120)));
  corrupt[8 + 13 + 12 + 4] ^= 0xff; // flip a byte inside the IDAT payload, leaving its declared CRC stale
  const crcRes = decodePng(corrupt);
  assert(!crcRes.ok && crcRes.reason === 'bad-crc', `a chunk whose bytes no longer match its CRC is refused (got ${crcRes.ok ? 'decoded' : crcRes.reason})`);

  // A stream that stops before IEND.
  const noIend = Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr({ width: 1, height: 1, bitDepth: 8, colorType: 6 })),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, 1, 2, 3, 4]), { level: 9 })),
  ]);
  const iendRes = decodePng(noIend);
  assert(!iendRes.ok && iendRes.reason === 'missing-iend', `a stream with no IEND is refused (got ${iendRes.ok ? 'decoded' : iendRes.reason})`);

  // IHDR declaring a compression or filter method that PNG does not define.
  for (const [offset, label] of [[10, 'compression'], [11, 'filter']] as Array<[number, string]>) {
    const h = ihdr({ width: 1, height: 1, bitDepth: 8, colorType: 6 });
    h[offset] = 7;
    const bad = Buffer.concat([
      PNG_SIGNATURE,
      chunk('IHDR', h),
      chunk('IDAT', zlib.deflateSync(Buffer.from([0, 1, 2, 3, 4]), { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    const res2 = decodePng(bad);
    assert(!res2.ok && res2.reason === 'bad-ihdr-fields', `an undefined ${label} method is refused (got ${res2.ok ? 'decoded' : res2.reason})`);
  }

  // A palette image at 16 bits: legal-looking to a naive reader, forbidden by the spec.
  const pal16 = buildPng({ width: 1, height: 1, bitDepth: 16, colorType: 3 }, Buffer.from([0, 0, 0]), [chunk('PLTE', Buffer.from([1, 2, 3]))]);
  const pal16Res = decodePng(pal16);
  assert(!pal16Res.ok && pal16Res.reason === 'bit-depth-unsupported', `color type 3 at 16 bits is refused (got ${pal16Res.ok ? 'decoded' : pal16Res.reason})`);
  assert(!pal16Res.ok && /not legal for color type 3/.test(pal16Res.detail), 'the refusal says the combination is illegal, not merely unsupported');

  // A pixel pointing past the end of the palette. Substituting black here would invent pixels the file never had.
  const oobIndex = buildPng({ width: 2, height: 1, bitDepth: 8, colorType: 3 }, Buffer.from([0, 0, 5]), [chunk('PLTE', Buffer.from([255, 0, 0, 0, 255, 0]))]);
  const oobRes = decodePng(oobIndex);
  assert(!oobRes.ok && oobRes.reason === 'palette-index-out-of-range', `an out-of-range palette index is refused (got ${oobRes.ok ? 'decoded' : oobRes.reason})`);

  // Extra bytes after the last scanline: the geometry and the pixel data disagree.
  const trailing = buildPng({ width: 1, height: 1, bitDepth: 8, colorType: 6 }, Buffer.from([0, 1, 2, 3, 4, 99, 99, 99]));
  const trailRes = decodePng(trailing);
  assert(!trailRes.ok && trailRes.reason === 'idat-size-mismatch', `trailing pixel bytes are refused (got ${trailRes.ok ? 'decoded' : trailRes.reason})`);
  assert(!trailRes.ok && /exactly/.test(trailRes.detail), 'the refusal states that the size must match exactly');

  // A chunk claiming a length that runs past the end of the file is refused rather than read out of bounds.
  const good = encodePng(1, 1, new Uint8Array([1, 2, 3, 4]));
  const lying = Buffer.from(good);
  lying.writeUInt32BE(0x7ffffff0, 8 + 13 + 12);
  const res = decodePng(lying);
  assert(!res.ok && (res.reason === 'truncated' || res.reason === 'bad-chunk-length'), 'an overlong chunk length is refused');
}

function main(): void {
  testRoundTrip();
  testFilters();
  testColorTypes();
  testRefusals();
  console.log('image-png-codec: OK (round trip, deterministic encode, all five filters, five color types, both bit depths, seventeen named refusals including crc, missing-iend, illegal ihdr fields, illegal palette depth, out-of-range palette index and trailing pixel bytes)');
}

main();
