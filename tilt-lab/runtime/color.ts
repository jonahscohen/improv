// Shared color parsing for every effect. Previously each effect duplicated its
// own hexToRgb/hexToRgba, with inconsistent handling of input lengths - and a
// naive `parseInt(hex,16)` mis-reads an 8-digit #rrggbbaa (the alpha shifts the
// channels). The color picker now emits #rrggbbaa for transparent values, so a
// single tolerant parser is the source of truth: it accepts #rgb, #rgba,
// #rrggbb, #rrggbbaa (with or without the leading #) and the keyword
// "transparent", and always yields normalized 0..1 channels plus alpha.

export interface Rgba {
  r: number; // 0..1
  g: number; // 0..1
  b: number; // 0..1
  a: number; // 0..1
}

const FALLBACK: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/**
 * Parse any supported color string to normalized {r,g,b,a} (each 0..1).
 * Invalid input returns opaque white (the historical fallback) so a bad value
 * never throws inside a render loop. `fallback` overrides that default.
 */
export function parseHexColor(input: unknown, fallback: Rgba = FALLBACK): Rgba {
  if (typeof input !== 'string') return fallback;
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const m = /^#?([0-9a-f]{3,8})$/.exec(s);
  if (!m) return fallback;
  let h = m[1];
  // Expand shorthand: #rgb -> #rrggbb, #rgba -> #rrggbbaa.
  if (h.length === 3 || h.length === 4) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 && h.length !== 8) return fallback;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

/** [r,g,b] in 0..1 (alpha dropped). */
export function rgb01(input: unknown, fallback?: Rgba): [number, number, number] {
  const c = parseHexColor(input, fallback);
  return [c.r, c.g, c.b];
}

/** [r,g,b,a] in 0..1. */
export function rgba01(input: unknown, fallback?: Rgba): [number, number, number, number] {
  const c = parseHexColor(input, fallback);
  return [c.r, c.g, c.b, c.a];
}

/** [r,g,b] in 0..255 (rounded, alpha dropped). */
export function rgb255(input: unknown, fallback?: Rgba): [number, number, number] {
  const c = parseHexColor(input, fallback);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

/** A CSS `rgba(...)` string, honoring alpha. */
export function toCssRgba(input: unknown, fallback?: Rgba): string {
  const c = parseHexColor(input, fallback);
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

/** Split a color value into its opaque #rrggbb part and its 0..1 alpha. Used by
 *  the ColorField, whose native <input type="color"> can only edit 6-digit RGB. */
export function splitHexAlpha(input: unknown): { rgb: string; alpha: number } {
  const c = parseHexColor(input);
  const hex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return { rgb: `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`, alpha: c.a };
}

/** Combine a #rrggbb and a 0..1 alpha back into a value: #rrggbb when fully
 *  opaque (keeps defaults/presets clean), #rrggbbaa when translucent. */
export function combineHexAlpha(rgb: string, alpha: number): string {
  const base = splitHexAlpha(rgb).rgb;
  if (alpha >= 1) return base;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${base}${a}`;
}
