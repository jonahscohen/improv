import { describe, it, expect } from 'vitest';
import { parseHexColor, rgb01, rgb255, splitHexAlpha, combineHexAlpha, toCssRgba } from './color';

describe('parseHexColor', () => {
  it('parses 6-digit hex as opaque', () => {
    expect(parseHexColor('#ff8000')).toEqual({ r: 1, g: 128 / 255, b: 0, a: 1 });
  });

  it('parses 8-digit hex with alpha (the picker-transparent case)', () => {
    const c = parseHexColor('#ff800080');
    expect(c.r).toBe(1);
    expect(c.a).toBeCloseTo(128 / 255, 5);
  });

  it('expands #rgb and #rgba shorthand', () => {
    expect(parseHexColor('#f80')).toEqual({ r: 1, g: 136 / 255, b: 0, a: 1 });
    expect(parseHexColor('#f808').a).toBeCloseTo(136 / 255, 5);
  });

  it('treats the keyword transparent as fully transparent', () => {
    expect(parseHexColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('tolerates a missing leading # and uppercase', () => {
    expect(parseHexColor('FF8000')).toEqual({ r: 1, g: 128 / 255, b: 0, a: 1 });
  });

  it('falls back (opaque white) on invalid input rather than throwing', () => {
    expect(parseHexColor('nope')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseHexColor(undefined)).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('does NOT misread an 8-digit value the way a naive parseInt would', () => {
    // 0xff000080 >> 16 would yield 0x00 (wrong red); the slice parser keeps red=ff.
    expect(rgb255('#ff000080')).toEqual([255, 0, 0]);
  });
});

describe('rgb helpers', () => {
  it('rgb01 drops alpha', () => {
    expect(rgb01('#00ff0040')).toEqual([0, 1, 0]);
  });
  it('toCssRgba honors alpha', () => {
    expect(toCssRgba('#00000080')).toBe(`rgba(0, 0, 0, ${128 / 255})`);
  });
});

describe('split/combine round-trip (ColorField)', () => {
  it('splits a translucent value into rgb + alpha', () => {
    const { rgb, alpha } = splitHexAlpha('#11223380');
    expect(rgb).toBe('#112233');
    expect(alpha).toBeCloseTo(128 / 255, 5);
  });
  it('combines back to 6-digit when opaque, 8-digit when translucent', () => {
    expect(combineHexAlpha('#112233', 1)).toBe('#112233');
    expect(combineHexAlpha('#112233', 0)).toBe('#11223300');
    expect(combineHexAlpha('#112233', 0.5)).toBe('#11223380');
  });
});
