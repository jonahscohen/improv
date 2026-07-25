/**
 * Sidecoach palette recipe (Stage 2a) - deterministic palette CONSTRUCTION.
 *
 * From a brand's hue/chroma anchors (a small structured brand input read from PRODUCT.md-adjacent
 * fixtures), construct a structured palette: a neutral base ramp, a primary accent ramp, and four
 * semantic-role ramps (success / warning / danger / info), each an OKLCH LIGHTNESS ramp gamut-mapped
 * into sRGB. Emit DESIGN.md token frontmatter (@google/design.md shape) whose components/body reference
 * tokens via `{token.path}` rather than hard-coded hex.
 *
 * WHAT THIS FILE IS NOT: it is NOT a contrast checker. Every required text/background pair is WCAG-checked
 * by the SHIPPING rendered scanner (src/validators/objective-rendered-scanner.ts, imported by the CLI) -
 * this module only BUILDS colors and the swatch page the scanner reads, and RESOLVES the scanner's findings
 * into a pass/fail verdict. There is exactly one contrast implementation in the product, and it is the
 * scanner's; this file never re-derives a luminance or a ratio. The on-color (text-on-accent) choice is made
 * by picking among scanner-VERIFIED candidates, never by a local contrast calc.
 *
 * DETERMINISM: OKLCH -> sRGB is pure math with fixed constants; the same brand input yields byte-identical
 * ramps, the same swatch page, and (because the scanner render is hermetic and its walk is document-ordered)
 * the same verdict and the same emitted DESIGN.md. No clock, no map-iteration-order dependence, no RNG.
 */

// ---------------------------------------------------------------------------
// Brand input
// ---------------------------------------------------------------------------

/** One color family's OKLCH anchor: a hue (deg) + a peak chroma. Lightness comes from the fixed ramp. */
export interface FamilySpec {
  /** OKLCH hue in degrees [0, 360). */
  hue: number;
  /** OKLCH peak chroma (before gamut mapping). Typical 0 (neutral) .. ~0.20 (vivid). */
  chroma: number;
  /**
   * Ramp stop used as this family's SOLID fill (button/background surface that carries on-color text).
   * Default 700. A fixture may pin it (e.g. 500) to model a brand that chose a too-light solid - the
   * recipe then fail-closes on that family's on-color pair rather than emitting an AA-failing palette.
   */
  solidStop?: RampStop;
}

export interface BrandFonts {
  display?: string;
  body?: string;
  mono?: string;
}

export interface BrandInput {
  name: string;
  description?: string;
  base: FamilySpec;
  primary: FamilySpec;
  success: FamilySpec;
  warning: FamilySpec;
  danger: FamilySpec;
  info: FamilySpec;
  fonts: Required<BrandFonts>;
}

const DEFAULT_FONTS: Required<BrandFonts> = {
  display: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace",
};

// Standard semantic hues so a brand need only specify base + primary. Each is a defensible role hue,
// not tuned to any brand; a fixture may override any of them.
const SEMANTIC_DEFAULTS: Record<'success' | 'warning' | 'danger' | 'info', FamilySpec> = {
  success: { hue: 155, chroma: 0.11 },
  warning: { hue: 75, chroma: 0.14 },
  danger: { hue: 27, chroma: 0.16 },
  info: { hue: 245, chroma: 0.13 },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseFamily(raw: unknown, label: string, fallback?: FamilySpec): FamilySpec {
  if (raw === undefined && fallback) return { ...fallback };
  if (!isPlainObject(raw)) throw new Error(`brand.${label}: expected an object with { hue, chroma }`);
  const hue = raw.hue;
  const chroma = raw.chroma;
  if (typeof hue !== 'number' || !Number.isFinite(hue) || hue < 0 || hue >= 360) {
    throw new Error(`brand.${label}.hue: expected a number in [0, 360), got ${JSON.stringify(hue)}`);
  }
  if (typeof chroma !== 'number' || !Number.isFinite(chroma) || chroma < 0 || chroma > 0.5) {
    throw new Error(`brand.${label}.chroma: expected a number in [0, 0.5], got ${JSON.stringify(chroma)}`);
  }
  const out: FamilySpec = { hue, chroma };
  if (raw.solidStop !== undefined) {
    if (!RAMP_STOPS.includes(raw.solidStop as RampStop)) {
      throw new Error(`brand.${label}.solidStop: expected one of ${RAMP_STOPS.join(', ')}, got ${JSON.stringify(raw.solidStop)}`);
    }
    out.solidStop = raw.solidStop as RampStop;
  }
  return out;
}

/**
 * Validate and normalize a raw brand object (parsed from the --brand fixture JSON). Throws a precise Error on
 * any malformed field so the CLI can exit with a usage code and a named reason - never emit a partial palette.
 */
export function parseBrandInput(raw: unknown): BrandInput {
  if (!isPlainObject(raw)) throw new Error('brand input: expected a JSON object');
  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error('brand.name: required non-empty string');
  }
  const fontsRaw = isPlainObject(raw.fonts) ? raw.fonts : {};
  const fonts: Required<BrandFonts> = {
    display: typeof fontsRaw.display === 'string' && fontsRaw.display.trim() ? fontsRaw.display : DEFAULT_FONTS.display,
    body: typeof fontsRaw.body === 'string' && fontsRaw.body.trim() ? fontsRaw.body : DEFAULT_FONTS.body,
    mono: typeof fontsRaw.mono === 'string' && fontsRaw.mono.trim() ? fontsRaw.mono : DEFAULT_FONTS.mono,
  };
  return {
    name: raw.name.trim(),
    description: typeof raw.description === 'string' ? raw.description.trim() : undefined,
    base: parseFamily(raw.base, 'base'),
    primary: parseFamily(raw.primary, 'primary'),
    success: parseFamily(raw.success, 'success', SEMANTIC_DEFAULTS.success),
    warning: parseFamily(raw.warning, 'warning', SEMANTIC_DEFAULTS.warning),
    danger: parseFamily(raw.danger, 'danger', SEMANTIC_DEFAULTS.danger),
    info: parseFamily(raw.info, 'info', SEMANTIC_DEFAULTS.info),
    fonts,
  };
}

// ---------------------------------------------------------------------------
// OKLCH -> sRGB (Bjorn Ottosson's OKLab, public formula) with chroma-reduction gamut mapping.
// This is COLOR CONSTRUCTION, not contrast: it turns an (L, C, H) into a real, in-gamut #rrggbb.
// ---------------------------------------------------------------------------

export type RampStop = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export const RAMP_STOPS: RampStop[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

/** Fixed OKLCH lightness per stop. Perceptually even, light (surfaces) -> dark (ink). */
export const STOP_LIGHTNESS: Record<RampStop, number> = {
  50: 0.975, 100: 0.945, 200: 0.885, 300: 0.815, 400: 0.725,
  500: 0.635, 600: 0.545, 700: 0.455, 800: 0.365, 900: 0.275,
};

interface LinRGB { r: number; g: number; b: number; }

/** OKLab -> linear sRGB (may fall outside [0,1] when out of gamut). */
function oklabToLinearSrgb(L: number, a: number, b: number): LinRGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

const inGamut = (c: LinRGB, eps = 1e-4): boolean =>
  c.r >= -eps && c.r <= 1 + eps && c.g >= -eps && c.g <= 1 + eps && c.b >= -eps && c.b <= 1 + eps;

function linearToSrgb8(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

export interface OklchColor { L: number; C: number; H: number; }

/**
 * Convert an OKLCH color to an in-gamut sRGB hex. If (L,C,H) is outside sRGB, reduce chroma toward 0
 * (binary search, hue + lightness fixed) until it fits - the CSS Color 4 gamut-mapping approach, which
 * also gives the natural chroma taper at very light/dark stops. Deterministic (fixed iteration count).
 */
export function oklchToHex({ L, C, H }: OklchColor): string {
  const rad = (H * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const at = (chroma: number): LinRGB => oklabToLinearSrgb(L, chroma * cos, chroma * sin);

  let chroma = C;
  if (!inGamut(at(C))) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid;
      else hi = mid;
    }
    chroma = lo;
  }
  const lin = at(chroma);
  return `#${toHex(linearToSrgb8(lin.r))}${toHex(linearToSrgb8(lin.g))}${toHex(linearToSrgb8(lin.b))}`;
}

// ---------------------------------------------------------------------------
// Palette construction
// ---------------------------------------------------------------------------

export type Ramp = Record<RampStop, string>;

export function buildRamp(family: FamilySpec): Ramp {
  const ramp = {} as Ramp;
  for (const stop of RAMP_STOPS) {
    ramp[stop] = oklchToHex({ L: STOP_LIGHTNESS[stop], C: family.chroma, H: family.hue });
  }
  return ramp;
}

export type FamilyName = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export const ACCENT_FAMILIES: Exclude<FamilyName, 'neutral'>[] = ['primary', 'success', 'warning', 'danger', 'info'];

export interface Palette {
  brand: BrandInput;
  ramps: Record<FamilyName, Ramp>;
  /** The solid stop actually used for each family (default 700, or the family's pinned solidStop). */
  solidStop: Record<FamilyName, RampStop>;
}

export function buildPalette(brand: BrandInput): Palette {
  const ramps: Record<FamilyName, Ramp> = {
    neutral: buildRamp(brand.base),
    primary: buildRamp(brand.primary),
    success: buildRamp(brand.success),
    warning: buildRamp(brand.warning),
    danger: buildRamp(brand.danger),
    info: buildRamp(brand.info),
  };
  const specOf: Record<FamilyName, FamilySpec> = {
    neutral: brand.base, primary: brand.primary, success: brand.success,
    warning: brand.warning, danger: brand.danger, info: brand.info,
  };
  const solidStop = {} as Record<FamilyName, RampStop>;
  for (const fam of Object.keys(ramps) as FamilyName[]) {
    solidStop[fam] = specOf[fam].solidStop ?? 700;
  }
  return { brand, ramps, solidStop };
}

// Fixed role -> ramp-stop assignments. These are the palette's semantic contract; the required-pair gate
// verifies each one renders at its WCAG level before any of it is emitted.
export const ROLE_STOPS = {
  textPrimary: 900 as RampStop,
  textSecondary: 700 as RampStop,
  textTertiary: 600 as RampStop,   // low-emphasis; validated at the LARGE-text threshold only
  textInverse: 50 as RampStop,
  surfaceCanvas: 50 as RampStop,
  surfaceRaised: 100 as RampStop,
  surfaceSunken: 200 as RampStop,
  surfaceInverse: 900 as RampStop,
  link: 700 as RampStop,
} as const;

export const paper = (p: Palette): string => p.ramps.neutral[ROLE_STOPS.textInverse];
export const ink = (p: Palette): string => p.ramps.neutral[ROLE_STOPS.textPrimary];

/** The ramp stop `steps` positions darker than `stop` (clamped at 900). Used to derive hover/active shades
 * RELATIVE to a family's actual solid stop, so emitted state tokens never hard-code a stop that diverges
 * from the verified solid when solidStop is overridden. */
export function darkerStop(stop: RampStop, steps: number): RampStop {
  const i = RAMP_STOPS.indexOf(stop);
  return RAMP_STOPS[Math.min(RAMP_STOPS.length - 1, i + steps)];
}

// ---------------------------------------------------------------------------
// Required WCAG pairs + swatch page
// ---------------------------------------------------------------------------

export type PairSize = 'normal' | 'large';

/**
 * A single required text/background pair to be checked by the scanner. `onColorFor` marks the pair as an
 * on-accent CANDIDATE (paper or ink text on ONE of that accent's emitted surfaces - the solid, and for the
 * primary button its darker hover/active states). The verdict resolver picks, per accent, the ONE candidate
 * (paper or ink) that passed on EVERY one of that accent's surfaces, so the chosen on-color label is verified
 * on every background the palette actually emits for it. A pair with no `onColorFor` is a hard requirement.
 *
 * The integrity contract: EVERY text/background pair the recipe emits into DESIGN.md (button solid + hover +
 * active, badges, alert tints, wells, links, text-on-surface) is present here and gated. The recipe cannot
 * emit a pairing it did not scanner-verify.
 */
export interface RequiredPair {
  id: string;         // used verbatim as the swatch element id (scanner selector = `div#<id>`)
  name: string;       // human name for the report ("body text on canvas")
  fg: string;         // hex
  bg: string;         // hex
  size: PairSize;
  onColorFor?: { family: FamilyName; candidate: 'paper' | 'ink'; surface: string };
}

/** The background surfaces an accent's on-color text must pass on. Semantic families emit only a solid badge;
 * the primary also emits darker hover/active button states, so its label must clear all three. */
export function accentSurfaces(p: Palette, fam: FamilyName): { label: string; stop: RampStop }[] {
  const solid = p.solidStop[fam];
  if (fam === 'primary') {
    return [
      { label: 'solid', stop: solid },
      { label: 'hover', stop: darkerStop(solid, 1) },
      { label: 'active', stop: darkerStop(solid, 2) },
    ];
  }
  return [{ label: 'solid', stop: solid }];
}

export function requiredPairs(p: Palette): RequiredPair[] {
  const n = p.ramps.neutral;
  const pairs: RequiredPair[] = [
    { id: 'text-primary-on-canvas', name: 'primary text on canvas', fg: n[ROLE_STOPS.textPrimary], bg: n[ROLE_STOPS.surfaceCanvas], size: 'normal' },
    { id: 'text-secondary-on-canvas', name: 'secondary text on canvas', fg: n[ROLE_STOPS.textSecondary], bg: n[ROLE_STOPS.surfaceCanvas], size: 'normal' },
    { id: 'text-primary-on-raised', name: 'primary text on raised surface', fg: n[ROLE_STOPS.textPrimary], bg: n[ROLE_STOPS.surfaceRaised], size: 'normal' },
    { id: 'text-secondary-on-raised', name: 'secondary text on raised surface', fg: n[ROLE_STOPS.textSecondary], bg: n[ROLE_STOPS.surfaceRaised], size: 'normal' },
    { id: 'text-secondary-on-sunken', name: 'secondary text on sunken well', fg: n[ROLE_STOPS.textSecondary], bg: n[ROLE_STOPS.surfaceSunken], size: 'normal' },
    { id: 'text-inverse-on-inverse', name: 'inverse text on inverse surface', fg: n[ROLE_STOPS.textInverse], bg: n[ROLE_STOPS.surfaceInverse], size: 'normal' },
    { id: 'link-on-canvas', name: 'link text on canvas', fg: p.ramps.primary[ROLE_STOPS.link], bg: n[ROLE_STOPS.surfaceCanvas], size: 'normal' },
    // large-text roles (WCAG 3:1)
    { id: 'text-tertiary-on-canvas', name: 'tertiary (large) text on canvas', fg: n[ROLE_STOPS.textTertiary], bg: n[ROLE_STOPS.surfaceCanvas], size: 'large' },
    { id: 'display-accent-on-canvas', name: 'large accent display on canvas', fg: p.ramps.primary[p.solidStop.primary], bg: n[ROLE_STOPS.surfaceCanvas], size: 'large' },
  ];
  // alert tints: dark accent text on a light accent-tinted surface (the alert-<fam> component). Hard pairs.
  for (const fam of ACCENT_FAMILIES) {
    if (fam === 'primary') continue;
    pairs.push({ id: `alert-${fam}`, name: `${fam} alert text on tint`, fg: p.ramps[fam][800], bg: p.ramps[fam][50], size: 'normal' });
  }
  // on-accent labels: paper + ink candidate on EACH emitted surface of the family (solid, + hover/active for
  // primary). The resolver requires the chosen candidate to pass on all of them.
  for (const fam of ACCENT_FAMILIES) {
    for (const surf of accentSurfaces(p, fam)) {
      const bg = p.ramps[fam][surf.stop];
      pairs.push({ id: `on-${fam}-${surf.label}-paper`, name: `${fam} ${surf.label}: light label`, fg: paper(p), bg, size: 'normal', onColorFor: { family: fam, candidate: 'paper', surface: surf.label } });
      pairs.push({ id: `on-${fam}-${surf.label}-ink`, name: `${fam} ${surf.label}: dark label`, fg: ink(p), bg, size: 'normal', onColorFor: { family: fam, candidate: 'ink', surface: surf.label } });
    }
  }
  return pairs;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Build ONE self-contained HTML page with a labeled swatch per required pair. Each swatch carries its own
 * opaque background-color and text color inline, so the scanner's paint-order backdrop resolution reads
 * exactly the intended pair (no ancestor bg, no opacity, no image -> never indeterminate). Large-text pairs
 * render at 28px so the scanner classifies them large (3:1); normal pairs at 16px (4.5:1).
 */
export function buildSwatchHtml(pairs: RequiredPair[]): string {
  const rows = pairs.map((pr) => {
    const px = pr.size === 'large' ? 28 : 16;
    return `<div id="${esc(pr.id)}" style="color:${pr.fg};background-color:${pr.bg};font-size:${px}px;font-weight:400;padding:12px;line-height:1.5">`
      + `${esc(pr.name)}. The quick brown fox jumps over the lazy dog.</div>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>palette-swatches</title></head>`
    + `<body style="margin:0;background:#ffffff">\n${rows}\n</body></html>`;
}

// ---------------------------------------------------------------------------
// Verdict resolution (pure: findings in, verdict out - no browser here)
// ---------------------------------------------------------------------------

/** The subset of a scanner ObjectiveFinding this module reads. Kept structural to avoid importing the scanner into the pure module. */
export interface ScanFindingLike {
  rule: string;
  selector?: string;
  detail?: string;
}

export interface PairFailure {
  id: string;
  name: string;
  detail: string;  // the scanner's own ratio/threshold detail, e.g. "3.50:1 (need 4.5:1)"
}

export interface Verdict {
  /** Required pairs that failed contrast (empty => palette is clean). */
  failures: PairFailure[];
  /** Per accent family, the on-color the scanner verified ('paper' | 'ink'), or null if neither passed. */
  onColor: Record<string, 'paper' | 'ink' | null>;
  /** Count of required pairs that passed (for the report). */
  passCount: number;
  totalRequired: number;
}

function idFromSelector(selector?: string): string | undefined {
  if (!selector) return undefined;
  const hash = selector.indexOf('#');
  return hash >= 0 ? selector.slice(hash + 1) : undefined;
}

/**
 * Resolve scanner findings against the required pairs. A `low-contrast` finding on a swatch id means that
 * pair FAILED. For an accent's two on-color candidates, the accent's requirement is met if EITHER candidate
 * passed (prefer paper); it fails only if BOTH failed. Every non-on-color pair is a hard requirement.
 *
 * PURE + fail-closed by construction: it is given only the findings the scanner produced; a pair the scanner
 * never reported on is treated as passing ONLY because the caller guarantees the scan actually ran (available
 * === true). The CLI enforces that guarantee; if the scan did not run it never calls this.
 */
export function resolveVerdict(pairs: RequiredPair[], findings: ScanFindingLike[]): Verdict {
  const failedIds = new Set<string>();
  const detailById = new Map<string, string>();
  for (const f of findings) {
    if (f.rule !== 'low-contrast') continue; // gray-on-color is a subtype that only co-fires; low-contrast is the signal
    const id = idFromSelector(f.selector);
    if (id === undefined) continue;
    failedIds.add(id);
    if (!detailById.has(id)) detailById.set(id, f.detail || 'below WCAG AA contrast');
  }

  const onColor: Record<string, 'paper' | 'ink' | null> = {};
  const failures: PairFailure[] = [];

  // Hard (single-requirement) pairs.
  const hardPairs = pairs.filter((p) => !p.onColorFor);
  for (const p of hardPairs) {
    if (failedIds.has(p.id)) {
      failures.push({ id: p.id, name: p.name, detail: detailById.get(p.id) || 'below WCAG AA contrast' });
    }
  }

  // On-color accent groups: a candidate (paper|ink) is valid only if it passed on EVERY emitted surface of
  // the family. Prefer paper (light label). If neither candidate clears all surfaces, the accent fails-closed
  // and the failure names the surface each candidate died on - so a darker button state can never ship an
  // unverified label.
  const groupFor = (fam: FamilyName, cand: 'paper' | 'ink'): RequiredPair[] =>
    pairs.filter((p) => p.onColorFor && p.onColorFor.family === fam && p.onColorFor.candidate === cand);
  const groupPasses = (group: RequiredPair[]): boolean => group.length > 0 && group.every((p) => !failedIds.has(p.id));
  const firstFail = (group: RequiredPair[]): string => {
    const f = group.find((p) => failedIds.has(p.id));
    if (!f) return group.length ? 'passes all surfaces' : 'no candidate rendered';
    return `${f.onColorFor!.surface} ${detailById.get(f.id) || 'fail'}`;
  };

  for (const fam of ACCENT_FAMILIES) {
    const paperGroup = groupFor(fam, 'paper');
    const inkGroup = groupFor(fam, 'ink');
    if (groupPasses(paperGroup)) onColor[fam] = 'paper';
    else if (groupPasses(inkGroup)) onColor[fam] = 'ink';
    else {
      onColor[fam] = null;
      failures.push({
        id: `on-${fam}`,
        name: `${fam} label (no text color passes AA on every emitted ${fam} surface)`,
        detail: `light ${firstFail(paperGroup)}; dark ${firstFail(inkGroup)}`,
      });
    }
  }

  // passCount: hard pairs that passed + accents that resolved.
  const hardPass = hardPairs.filter((p) => !failedIds.has(p.id)).length;
  const accentPass = ACCENT_FAMILIES.filter((f) => onColor[f] !== null).length;
  const totalRequired = hardPairs.length + ACCENT_FAMILIES.length;
  return { failures, onColor, passCount: hardPass + accentPass, totalRequired };
}

// ---------------------------------------------------------------------------
// DESIGN.md emission (@google/design.md shape; canonical section order)
// ---------------------------------------------------------------------------

/** Resolved semantic role tokens (concrete hex) once the verdict has picked each accent's on-color. */
export interface ResolvedTokens {
  colors: Record<string, string>;   // flat token name -> hex, ordered by insertion
}

const onColorHex = (p: Palette, choice: 'paper' | 'ink' | null): string =>
  choice === 'ink' ? ink(p) : paper(p); // null cannot happen on the emit path (gate blocks it); default paper

export function resolveTokens(p: Palette, verdict: Verdict): ResolvedTokens {
  const n = p.ramps.neutral;
  const colors: Record<string, string> = {};
  // Top-level per-family SOLID aliases = each family's solid at its ACTUAL solidStop (default 700, or a pinned
  // override). These are the single source for "the accent surface that carries on-color text" - the exact
  // background the scanner verified. Components and the verified-pairs table reference these, never a raw
  // `-700`, so a solidStop override can never make the emitted/documented pair diverge from the scanned one.
  // ACCENT_FAMILIES is [primary, success, warning, danger, info] so `primary` (design.md-required) is first.
  for (const fam of ACCENT_FAMILIES) colors[fam] = p.ramps[fam][p.solidStop[fam]];
  colors['error'] = p.ramps.danger[p.solidStop.danger]; // spec-recommended alias for the danger solid
  // full ramps, flat hyphenated keys (spec idiom: colors.primary-60).
  for (const fam of ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as FamilyName[]) {
    for (const stop of RAMP_STOPS) colors[`${fam}-${stop}`] = p.ramps[fam][stop];
  }
  // semantic role aliases (concrete hex; body/components reference these via {colors.*}).
  colors['text-primary'] = n[ROLE_STOPS.textPrimary];
  colors['text-secondary'] = n[ROLE_STOPS.textSecondary];
  colors['text-tertiary'] = n[ROLE_STOPS.textTertiary];
  colors['text-inverse'] = n[ROLE_STOPS.textInverse];
  colors['surface-canvas'] = n[ROLE_STOPS.surfaceCanvas];
  colors['surface-raised'] = n[ROLE_STOPS.surfaceRaised];
  colors['surface-sunken'] = n[ROLE_STOPS.surfaceSunken];
  colors['surface-inverse'] = n[ROLE_STOPS.surfaceInverse];
  colors['link'] = p.ramps.primary[ROLE_STOPS.link];
  for (const fam of ACCENT_FAMILIES) {
    colors[`on-${fam}`] = onColorHex(p, verdict.onColor[fam]);
  }
  return colors as unknown as ResolvedTokens & Record<string, string>;
}

function yamlQuote(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// A typography scale (canonical level names). Sizes are rem; lineHeight unitless; letterSpacing em.
const TYPE_LEVELS: { name: string; size: string; weight: number; line: number; tracking: string; font: 'display' | 'body' | 'mono' }[] = [
  { name: 'display', size: '3.5rem', weight: 700, line: 1.05, tracking: '-0.02em', font: 'display' },
  { name: 'headline-lg', size: '2.5rem', weight: 700, line: 1.1, tracking: '-0.01em', font: 'display' },
  { name: 'headline-md', size: '2rem', weight: 600, line: 1.15, tracking: '-0.01em', font: 'display' },
  { name: 'headline-sm', size: '1.5rem', weight: 600, line: 1.2, tracking: '0em', font: 'display' },
  { name: 'body-lg', size: '1.125rem', weight: 400, line: 1.6, tracking: '0em', font: 'body' },
  { name: 'body-md', size: '1rem', weight: 400, line: 1.6, tracking: '0em', font: 'body' },
  { name: 'body-sm', size: '0.875rem', weight: 400, line: 1.55, tracking: '0em', font: 'body' },
  { name: 'label-md', size: '0.875rem', weight: 500, line: 1.2, tracking: '0.01em', font: 'body' },
  { name: 'label-sm', size: '0.75rem', weight: 500, line: 1.2, tracking: '0.04em', font: 'body' },
  { name: 'caption', size: '0.75rem', weight: 400, line: 1.4, tracking: '0em', font: 'body' },
  { name: 'code', size: '0.875rem', weight: 400, line: 1.5, tracking: '0em', font: 'mono' },
];

function emitFrontmatter(palette: Palette, tokens: Record<string, string>): string {
  const brand = palette.brand;
  const lines: string[] = [];
  lines.push('---');
  lines.push('version: alpha');
  lines.push(`name: ${yamlQuote(brand.name)}`);
  if (brand.description) lines.push(`description: ${yamlQuote(brand.description)}`);

  lines.push('colors:');
  for (const [k, v] of Object.entries(tokens)) lines.push(`  ${k}: ${yamlQuote(v)}`);

  lines.push('typography:');
  for (const t of TYPE_LEVELS) {
    lines.push(`  ${t.name}:`);
    lines.push(`    fontFamily: ${yamlQuote(brand.fonts[t.font])}`);
    lines.push(`    fontSize: ${t.size}`);
    lines.push(`    fontWeight: ${t.weight}`);
    lines.push(`    lineHeight: ${t.line}`);
    lines.push(`    letterSpacing: ${t.tracking}`);
  }

  lines.push('rounded:');
  lines.push('  none: 0px');
  lines.push('  sm: 4px');
  lines.push('  md: 8px');
  lines.push('  lg: 12px');
  lines.push('  xl: 20px');
  lines.push('  full: 9999px');

  lines.push('spacing:');
  const spacing: [string, string][] = [
    ['0', '0px'], ['1', '4px'], ['2', '8px'], ['3', '12px'], ['4', '16px'],
    ['6', '24px'], ['8', '32px'], ['12', '48px'], ['16', '64px'], ['24', '96px'],
  ];
  for (const [k, v] of spacing) lines.push(`  "${k}": ${v}`);

  // components: THIS is where UI guidance references tokens via {token.path} (team rule: no hard-coded hex).
  lines.push('components:');
  const comp = (name: string, entries: [string, string][]) => {
    lines.push(`  ${name}:`);
    for (const [k, v] of entries) lines.push(`    ${k}: ${yamlQuote(v)}`);
  };
  // hover/active are one/two stops darker than the ACTUAL primary solid (not a hard-coded 800/900), so they
  // stay consistent with the verified solid under a solidStop override.
  const pHover = darkerStop(palette.solidStop.primary, 1);
  const pActive = darkerStop(palette.solidStop.primary, 2);
  comp('button-primary', [
    ['backgroundColor', '{colors.primary}'], ['textColor', '{colors.on-primary}'],
    ['rounded', '{rounded.md}'], ['padding', '{spacing.3}'], ['typography', '{typography.label-md}'],
  ]);
  comp('button-primary-hover', [['backgroundColor', `{colors.primary-${pHover}}`]]);
  comp('button-primary-active', [['backgroundColor', `{colors.primary-${pActive}}`]]);
  comp('button-secondary', [
    ['backgroundColor', '{colors.surface-raised}'], ['textColor', '{colors.text-primary}'],
    ['rounded', '{rounded.md}'], ['padding', '{spacing.3}'],
  ]);
  comp('card', [
    ['backgroundColor', '{colors.surface-raised}'], ['textColor', '{colors.text-primary}'],
    ['rounded', '{rounded.lg}'], ['padding', '{spacing.6}'],
  ]);
  comp('input', [
    ['backgroundColor', '{colors.surface-canvas}'], ['textColor', '{colors.text-primary}'],
    ['rounded', '{rounded.sm}'], ['padding', '{spacing.3}'],
  ]);
  comp('well', [['backgroundColor', '{colors.surface-sunken}'], ['textColor', '{colors.text-secondary}'], ['rounded', '{rounded.md}']]);
  comp('tooltip', [['backgroundColor', '{colors.surface-inverse}'], ['textColor', '{colors.text-inverse}'], ['rounded', '{rounded.sm}'], ['typography', '{typography.label-sm}']]);
  comp('caption', [['textColor', '{colors.text-secondary}'], ['typography', '{typography.caption}']]);
  comp('link', [['textColor', '{colors.link}']]);
  // Semantic surfaces (soft-tint alert) + solid status badges consume the semantic ramps + on-color tokens.
  for (const fam of ACCENT_FAMILIES) {
    if (fam === 'primary') continue;
    // badge background = the family SOLID alias (= the exact stop the scanner verified on-<fam> against),
    // never a raw -700, so an override can't make the emitted badge pair diverge from the scanned pair.
    comp(`alert-${fam}`, [['backgroundColor', `{colors.${fam}-50}`], ['textColor', `{colors.${fam}-800}`], ['rounded', '{rounded.md}'], ['padding', '{spacing.3}']]);
    comp(`badge-${fam}`, [['backgroundColor', `{colors.${fam}}`], ['textColor', `{colors.on-${fam}}`], ['rounded', '{rounded.full}'], ['padding', '{spacing.1}']]);
  }
  lines.push('---');
  return lines.join('\n');
}

// The required pairs described in tokens-only prose, for the Colors "verified pairs" table.
interface PairDoc { fg: string; bg: string; level: string; }
function verifiedPairDocs(verdict: Verdict): PairDoc[] {
  const docs: PairDoc[] = [
    { fg: '{colors.text-primary}', bg: '{colors.surface-canvas}', level: '4.5:1' },
    { fg: '{colors.text-secondary}', bg: '{colors.surface-canvas}', level: '4.5:1' },
    { fg: '{colors.text-primary}', bg: '{colors.surface-raised}', level: '4.5:1' },
    { fg: '{colors.text-secondary}', bg: '{colors.surface-raised}', level: '4.5:1' },
    { fg: '{colors.text-inverse}', bg: '{colors.surface-inverse}', level: '4.5:1' },
    { fg: '{colors.link}', bg: '{colors.surface-canvas}', level: '4.5:1' },
    { fg: '{colors.text-tertiary}', bg: '{colors.surface-canvas}', level: '3:1 (large)' },
    { fg: '{colors.primary}', bg: '{colors.surface-canvas}', level: '3:1 (large)' },
  ];
  for (const fam of ACCENT_FAMILIES) {
    const which = verdict.onColor[fam] === 'ink' ? 'text-primary' : 'text-inverse';
    // bg = the family SOLID alias: the exact color on-<fam> was verified against (override-safe).
    docs.push({ fg: `{colors.on-${fam}} (${which})`, bg: `{colors.${fam}}`, level: '4.5:1' });
  }
  return docs;
}

function emitBody(brand: BrandInput, verdict: Verdict): string {
  const b: string[] = [];
  b.push(`# ${brand.name}`);
  b.push('');
  b.push('## Overview');
  b.push('');
  b.push(brand.description
    ? brand.description
    : `${brand.name}'s system is built on a neutral base ramp with one primary accent and four semantic roles. Every text/background pairing below was verified against the rendered WCAG engine before this file was written.`);
  b.push('');
  b.push('## Colors');
  b.push('');
  b.push('The palette is a set of OKLCH lightness ramps: a neutral base, one primary accent, and success / warning / danger / info semantic roles. Reference tokens by path (for example `{colors.primary}`), never by literal hex.');
  b.push('');
  b.push('- **Primary** (`{colors.primary}`): the single brand accent; reserve it for the most important action per screen.');
  b.push('- **Neutral** (`{colors.neutral-900}` .. `{colors.neutral-50}`): text, surfaces, and borders.');
  b.push('- **Semantic**: `{colors.success-500}`, `{colors.warning-500}`, `{colors.danger-500}`, `{colors.info-500}` for status only.');
  b.push('');
  b.push('Verified text/background pairs (checked through the rendered objective scanner; all pass before emit):');
  b.push('');
  b.push('| Text token | Background token | WCAG level |');
  b.push('| --- | --- | --- |');
  for (const d of verifiedPairDocs(verdict)) b.push(`| \`${d.fg}\` | \`${d.bg}\` | ${d.level} |`);
  b.push('');
  b.push('## Typography');
  b.push('');
  b.push(`Display and headings use ${brand.fonts.display === DEFAULT_FONTS.display ? 'the system UI stack' : brand.fonts.display}; body copy uses \`{typography.body-md}\` at a 1.6 line height for readability. Labels use \`{typography.label-md}\`. Do not use \`{colors.text-tertiary}\` for body copy - it is validated at the large-text threshold only.`);
  b.push('');
  b.push('## Layout');
  b.push('');
  b.push('A 4px spacing base (`{spacing.1}`) with an 8px rhythm (`{spacing.2}`). Section gaps default to `{spacing.24}` on desktop and `{spacing.12}` on small screens. Content sits on `{colors.surface-canvas}`; raised cards step up to `{colors.surface-raised}`.');
  b.push('');
  b.push('## Elevation & Depth');
  b.push('');
  b.push('Depth is tonal, not heavy shadow: `{colors.surface-canvas}` for the page, `{colors.surface-raised}` for cards, `{colors.surface-sunken}` for wells. Borders use `{colors.neutral-200}`.');
  b.push('');
  b.push('## Shapes');
  b.push('');
  b.push('Corners use `{rounded.sm}` for inputs, `{rounded.md}` for buttons, and `{rounded.lg}` for cards. Pills use `{rounded.full}`. Do not mix sharp and round corners in one view.');
  b.push('');
  b.push('## Components');
  b.push('');
  b.push('Buttons: primary uses `{components.button-primary}` (fill `{colors.primary}`, label `{colors.on-primary}`); secondary uses `{components.button-secondary}`. Cards use `{components.card}`. Inputs use `{components.input}`. Links use `{colors.link}`.');
  b.push('');
  b.push("## Do's and Don'ts");
  b.push('');
  b.push('- Do reference tokens by `{path.to.token}`; never hard-code a hex value in UI code.');
  b.push('- Do maintain WCAG AA contrast (4.5:1 normal text, 3:1 large text) - every pairing above is pre-verified.');
  b.push('- Do use `{colors.primary}` for a single primary action per screen.');
  b.push('- Don\'t use `{colors.text-tertiary}` for body copy; it is a large-text role.');
  b.push('- Don\'t place text directly on a raw accent solid unless it is `{colors.on-<role>}`.');
  b.push('');
  return b.join('\n');
}

/** Emit the full DESIGN.md (frontmatter + canonical body). Pure string build - deterministic. */
export function emitDesignMd(palette: Palette, verdict: Verdict): string {
  const tokens = resolveTokens(palette, verdict) as unknown as Record<string, string>;
  return `${emitFrontmatter(palette, tokens)}\n\n${emitBody(palette.brand, verdict)}`;
}
