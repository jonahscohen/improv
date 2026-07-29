/**
 * Sidecoach image BRIEF COMPILER - one weak brief in, a strong prompt AND its verification contract out.
 *
 * THE PROBLEM THIS SOLVES, stated as the failure it prevents. A human asks for "a hero image for the pricing
 * page". Handed straight to a generator that yields a photograph of an office with some lettering baked into it:
 * wrong medium, wrong structure, unusable text, and nothing anywhere that says whether the headline that lands on
 * top will be readable. Every part of what makes that request answerable - which visual world, which staging,
 * which regions in what order, which real palette, what must NOT appear, and where the live text will sit - is
 * absent from the brief. A prose instruction telling the model to remember all of it works exactly as well as
 * the model's attention that day. So it is compiled instead.
 *
 * WHAT COMPILATION MEANS HERE. Three catalogs and the project's own files are joined into one artifact:
 *
 *   WORLD      direction-deck.ts, the same deck the direction roll draws from. One authored catalog, two
 *              consumers, so the image world and the build's design direction cannot disagree. The deck's
 *              outside-ranking property comes along for free: the default product-marketing look is the entry
 *              this compiler will not draw, so an unspecified brief never lands on the sameness.
 *   STAGING    image-composition-catalog.ts, palette-free and type-free by enforced contract, so the structure
 *              can be strong without deciding a look nobody chose.
 *   TRUTH      the project's DESIGN.md tokens and PRODUCT.md anti-references. Real hexes beat adjectives, and a
 *              named anti-reference is a negative constraint the generator can actually act on.
 *
 * THE PROPERTY THAT MATTERS MOST. The prompt and the VERIFICATION CONTRACT are emitted from the same resolution.
 * The staging says where the live text sits; that one field becomes both the "keep this region quiet" instruction
 * and the pixel rectangle the contrast check reads back out of the decoded image. The check therefore measures
 * the region the prompt was told to protect. Nobody has to remember to pass the right numbers, because there is
 * only one set of numbers.
 *
 * HONESTY BOUNDARY, and it is load-bearing. This compiler never invents a fact. Where DESIGN.md has no text
 * colour, it does NOT pick one to make the contrast check look contracted; it reports the gap in
 * `briefStrength.missing` and leaves the ink unset, so the downstream verdict is honestly "contrast not checked"
 * rather than "contrast passed against a colour we made up". Same for the product's name, its claims, and its
 * numbers: absent means absent, and the prompt says so out loud in its text policy.
 *
 * PURITY. Everything here is a pure function of its inputs. No file reads, no network, no clock, no RNG. The
 * caller supplies parsed tokens; the compiler decides. Deterministic by construction, so the same brief compiles
 * to the same prompt and therefore hits the same content-addressed cache entry.
 */

import { createHash } from 'crypto';
import type { DesignTokens } from './design-md-parser';
import {
  DIRECTION_DECK,
  MODEL_DEFAULT_ID,
  directionById,
  type Direction,
} from './direction-deck';
import {
  IMAGE_COMPOSITION_CATALOG,
  compositionById,
  compositionsForRole,
  inkZoneToPixels,
  type ImageComposition,
  type ImageRole,
  type ImageSurface,
} from './image-composition-catalog';

// ---------------------------------------------------------------------------
// Input and output shapes
// ---------------------------------------------------------------------------

export interface ImageBrief {
  /** Whatever the human actually said. May be as thin as "hero image". */
  text: string;
  /** Explicit overrides. Each one supplied is one dimension the compiler did not have to resolve. */
  role?: ImageRole;
  surface?: ImageSurface;
  /** A direction-deck id, when the build has already committed to a world. */
  directionId?: string;
  compositionId?: string;
  /** "WIDTHxHEIGHT". When absent it is derived from the staging's native aspect. */
  size?: string;
  /** Alpha requirement, when the build knows it needs a cutout. */
  alpha?: 'require' | 'forbid';
}

export interface CompileContext {
  /** brand or product, from PRODUCT.md. */
  register?: string;
  /** The project's stated visual approach, matched against the deck before any draw happens. */
  approach?: string;
  /** The product's real name. Used only to permit ONE piece of legible text; never invented. */
  productName?: string;
  /** Parsed DESIGN.md frontmatter. The source of every hex this compiler will emit. */
  designTokens?: DesignTokens | null;
  /** PRODUCT.md anti-references, folded into the negative constraints verbatim. */
  antiReferences?: readonly string[];
  /**
   * What geometries the provider about to be called can actually serve. Defaults to the OpenAI list, the
   * strictest set in play. See SizePolicy for why this is not one fixed answer.
   */
  sizePolicy?: SizePolicy;
}

/** The contract handed to the verifier. Every field here is derived, none is defaulted into existence. */
export interface ImageVerificationContract {
  size: string;
  format: 'png';
  /** The real hex of the text that will sit on this asset. Absent when DESIGN.md does not name one. */
  ink?: string;
  /** Pixel rectangle for the contrast measurement, derived from the staging's ink zone. */
  inkRegion?: { x: number; y: number; w: number; h: number };
  /** WCAG ratio the measured region must clear. Set only when `ink` is known. */
  minContrast?: number;
  alpha?: 'require' | 'forbid';
  /** Which DESIGN.md token the ink came from, so a reader can audit the number. */
  inkSource?: string;
}

export interface BriefStrength {
  /** 0-100. The share of the ten resolvable dimensions the HUMAN supplied. Low is normal, not a failure. */
  score: number;
  /** Dimensions the human supplied. */
  fromBrief: string[];
  /** Dimensions the compiler resolved, each with where it came from. */
  supplied: string[];
  /** Facts nothing could supply. These are honest gaps, and each one weakens a specific check. */
  missing: string[];
}

export interface CompiledImageBrief {
  /** The prompt, sections in reading order. */
  prompt: string;
  /** Section name to body, for inspection and testing without parsing the prompt back. */
  sections: Array<{ name: string; body: string }>;
  contract: ImageVerificationContract;
  concept: Direction;
  composition: ImageComposition;
  role: ImageRole;
  surface: ImageSurface;
  briefStrength: BriefStrength;
  /** Stable 12-hex digest of the compiled prompt. Used for output filenames. */
  digest: string;
}

// ---------------------------------------------------------------------------
// Resolution: role and surface from a thin brief
// ---------------------------------------------------------------------------

/**
 * Role keywords, checked longest-first so "social card" is not swallowed by "card". Order within a role matters
 * only for reporting which word matched.
 */
const ROLE_KEYWORDS: Array<[ImageRole, readonly string[]]> = [
  ['social-card', ['social card', 'og image', 'open graph', 'share image', 'twitter card', 'link preview']],
  // `texture` outranks `backdrop` deliberately. "a tiling texture for the dashboard background" is a texture that
  // happens to be used as a background: it must tile and must carry no subject, which are the texture role's
  // obligations, not the backdrop role's. Checking backdrop first resolved that brief to backdrop on the word
  // "background" and dropped the tiling requirement on the floor.
  ['texture', ['texture', 'pattern', 'tile', 'tiling', 'tileable', 'noise field', 'grain']],
  ['backdrop', ['backdrop', 'background', 'full-bleed', 'full bleed', 'hero image', 'hero backdrop', 'banner', 'behind the']],
  ['object', ['cutout', 'transparent', 'product shot', 'icon plate', 'object', 'device shot']],
  // `avatar` is deliberately NOT here. In UI work "the avatar" almost always names a component slot rather than a
  // request to generate a face, so it produced a portrait for briefs about styling an existing element. Caught by
  // the regression test written for the review's false-positive finding. A real request says portrait or headshot.
  ['portrait', ['portrait', 'headshot', 'founder photo', 'team photo']],
  ['thumbnail', ['thumbnail', 'thumb', 'card image', 'tile image', 'preview image']],
  ['scene', ['scene', 'illustration', 'environment', 'landscape', 'still life', 'photograph']],
  ['plate', ['plate', 'artwork', 'graphic', 'image', 'visual', 'asset', 'picture']],
];

/** Surface keywords. A dashboard is not a landing page and the staging must not cross that line. */
const SURFACE_KEYWORDS: Array<[ImageSurface, readonly string[]]> = [
  ['operate', ['dashboard', 'admin', 'console', 'settings', 'table', 'data grid', 'report', 'workflow', 'inbox', 'editor']],
  ['read', ['article', 'blog', 'docs', 'documentation', 'guide', 'changelog', 'essay', 'reading', 'post']],
  ['experience', ['immersive', 'gallery', 'showcase', 'portfolio', 'story', 'experience', 'exhibit', 'interactive']],
  ['persuade', ['landing', 'pricing', 'hero', 'marketing', 'signup', 'sign up', 'convert', 'campaign', 'launch', 'homepage', 'home page']],
];

function normalize(text: string): string {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Phrases in which a role keyword is NOT asking for a raster.
 *
 * Codex review 2026-07-29, finding 3. Raw substring matching fired on ordinary component work: "craft a settings
 * toggle with a background color transition on hover" resolved to `backdrop` on the word "background", so the flow
 * generated a plate for a request that named no asset. A capability that fires on everything gets muted, which is
 * the same end state as a capability nobody can find, reached from the opposite direction.
 *
 * These are the CSS-property and styling senses of the same nouns. Matching one of them cancels that keyword hit;
 * it does not cancel the whole brief, so "a hero backdrop and a background color transition" still resolves.
 */
const ROLE_FALSE_FRIENDS: readonly RegExp[] = [
  /\bbackground[- ](?:colou?r|gradient|position|size|repeat|blend|attachment|clip|origin|opacity|fill|tint|shade|transition|animation)\b/,
  /\b(?:colou?r|gradient|fill|tint|shade|opacity|blur|shadow|border|padding|margin|radius)\s+(?:of\s+)?(?:the\s+)?background\b/,
  /\bin the background\b/,
  /\bbackground (?:task|job|process|thread|worker|agent)\b/,
  /\bimage[- ](?:outline|rendering|orientation|fit|size|position|placeholder|alt|optimization|loading|lazy)\b/,
  /\b(?:aspect|object)[- ]fit\b/,
  /\bpattern[- ](?:library|matching)\b/,
  /\b(?:design|component|layout|interaction|naming|state) patterns?\b/,
  /\btexture[- ]mapping\b/,
  /\bscene[- ]graph\b/,
  // A role noun followed by a structural noun names an element that ALREADY EXISTS, so the brief is about styling
  // it rather than about producing art for it. This one rule covers the whole class ("set object-fit on the
  // thumbnail element", "the hero image slot", "the backdrop container"), which is why it is written generally
  // instead of as one more phrase per keyword.
  /\b(?:backdrop|background|texture|pattern|tile|plate|portrait|headshot|thumbnail|scene|image|visual|asset|picture|banner)s?[- ](?:element|component|slot|container|wrapper|div|node|placeholder|prop|field|class|selector|tag|ref|variant|token)\b/,
];

/**
 * The role the brief asked for, and the word that gave it away. Null when the brief names no raster at all.
 *
 * Matching is word-boundary anchored, so "imagery" does not match "image" and "backgrounds" still does. A hit
 * inside a false-friend phrase is discarded and the scan continues, so one CSS mention cannot suppress a real
 * asset request elsewhere in the same sentence.
 */
export function detectRole(text: string): { role: ImageRole; matched: string } | null {
  const t = normalize(text);
  if (!t) return null;
  const cancelled: Array<[number, number]> = [];
  for (const re of ROLE_FALSE_FRIENDS) {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(t)) !== null) {
      cancelled.push([m.index, m.index + m[0].length]);
      if (m.index === g.lastIndex) g.lastIndex++;
    }
  }
  const insideCancelled = (start: number, end: number): boolean =>
    cancelled.some(([cs, ce]) => start >= cs && end <= ce);

  for (const [role, words] of ROLE_KEYWORDS) {
    for (const word of words) {
      // Word-boundary anchored on both ends. `\b` is wrong against a phrase ending in a hyphen ("full-bleed"), so
      // the trailing guard accepts a boundary or end-of-string.
      const re = new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        const start = m.index + m[1].length;
        const end = start + word.length;
        if (!insideCancelled(start, end)) return { role, matched: word };
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
  }
  return null;
}

export function detectSurface(text: string): { surface: ImageSurface; matched: string } | null {
  const t = normalize(text);
  if (!t) return null;
  for (const [surface, words] of SURFACE_KEYWORDS) {
    for (const word of words) {
      if (t.includes(word)) return { surface, matched: word };
    }
  }
  return null;
}

/**
 * Whether this brief calls for a raster asset at all.
 *
 * Exported and used as a GATE by the flow wiring: a component that needs no image gets no image and is told so,
 * rather than the flow quietly generating a plate nobody asked for. A capability that fires on everything is not
 * discoverable, it is noise.
 */
export function briefWantsRaster(text: string): boolean {
  return detectRole(text) !== null;
}

// ---------------------------------------------------------------------------
// Resolution: the world
// ---------------------------------------------------------------------------

/** 32-bit digest of a string. Used only to make an unspecified choice deterministic. */
function seedOf(text: string): number {
  const hex = createHash('sha256').update(text).digest('hex').slice(0, 8);
  return parseInt(hex, 16) >>> 0;
}

/**
 * Resolve the visual world.
 *
 * Priority: an explicit deck id, then the project's stated approach matched against deck ids and names, then a
 * deterministic draw from the deck. The draw EXCLUDES the deck's default-instinct entry, which is the whole
 * reason to reuse this deck: an unspecified brief cannot land on the conventional product-marketing look, ever.
 */
export function resolveConcept(
  brief: ImageBrief,
  ctx: CompileContext,
): { concept: Direction; basis: string } {
  if (brief.directionId) {
    const explicit = directionById(brief.directionId);
    if (explicit) return { concept: explicit, basis: `explicit direction id ${explicit.id}` };
  }
  const approach = normalize(ctx.approach || '');
  if (approach) {
    const byId = DIRECTION_DECK.find((d) => d.id === approach.replace(/\s+/g, '-'));
    if (byId) return { concept: byId, basis: `project approach "${ctx.approach}" matched deck id ${byId.id}` };
    // Word overlap, not substring containment.
    //
    // Substring matching failed on real input: a project approach of "restrained editorial" matched nothing,
    // because neither string contains the other, and the compiler silently fell through to a random draw and
    // ignored a stated design direction. Scoring shared words finds `editorial-print` on the word they share,
    // which is what a reader of that approach would expect.
    const approachWords = new Set(approach.split(/[^a-z0-9]+/).filter((w) => w.length > 3));
    if (approachWords.size > 0) {
      let best: { d: Direction; score: number } | null = null;
      for (const d of DIRECTION_DECK) {
        const deckWords = new Set(`${d.id} ${d.name}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
        let score = 0;
        for (const w of approachWords) if (deckWords.has(w)) score++;
        // Ties break on canonical deck order, which is fixed in source, so the resolution stays deterministic.
        if (score > 0 && (best === null || score > best.score)) best = { d, score };
      }
      if (best) {
        return {
          concept: best.d,
          basis: `project approach "${ctx.approach}" matched deck entry ${best.d.id} on ${best.score} shared word(s)`,
        };
      }
    }
  }
  // Deterministic draw from everything except the default instinct AND except the motion axis.
  //
  // A motion-axis direction describes what a surface does between states. Asked to dress a still frame it
  // contributes nothing usable: a live compilation drew `structured-motion` and produced a WORLD section reading
  // "asymmetric enter and exit timing" and "respect reduced-motion", which is not a look. The axis field already
  // exists on the deck for exactly this kind of filtering.
  const pool = DIRECTION_DECK.filter((d) => d.id !== MODEL_DEFAULT_ID && d.axis !== 'motion');
  const picked = pool[seedOf(`${brief.text}|${ctx.register || ''}|${ctx.approach || ''}`) % pool.length];
  return {
    concept: picked,
    basis: `no world was named, so it was drawn deterministically from the ${pool.length} deck entries that are neither ${MODEL_DEFAULT_ID} nor motion-axis`,
  };
}

// ---------------------------------------------------------------------------
// Resolution: the staging
// ---------------------------------------------------------------------------

/**
 * Resolve the staging for a role and surface.
 *
 * A role match is mandatory; a surface match is preferred but not required, because a role with no staging on the
 * requested surface is better served by that role's home staging than by a staging that cannot hold it. When it
 * falls back across surfaces the basis says so, so the compromise is visible rather than silent.
 */
export function resolveComposition(
  brief: ImageBrief,
  role: ImageRole,
  surface: ImageSurface,
): { composition: ImageComposition; basis: string } {
  if (brief.compositionId) {
    const explicit = compositionById(brief.compositionId);
    if (explicit) return { composition: explicit, basis: `explicit staging id ${explicit.id}` };
  }
  const forRole = compositionsForRole(role);
  if (forRole.length === 0) {
    // Cannot happen while the catalog validator passes (it requires every role to be stageable), and is handled
    // rather than thrown because a catalog edit must not be able to crash a build flow.
    return {
      composition: IMAGE_COMPOSITION_CATALOG[0],
      basis: `no staging declares the ${role} role, so the first catalog entry was used`,
    };
  }
  // Narrow in two steps, and prefer HOME role over merely-capable.
  //
  // A staging lists every role it can hold, so `wide-safe-card` (a social card) can technically hold a backdrop.
  // Drawing it for a plain hero backdrop while two purpose-built backdrop stagings sit in the same pool is a
  // worse answer arrived at by uniform sampling. Home-role entries therefore form their own pool and the draw
  // only widens when that pool is empty. Caught by reading the first compiled output rather than by reasoning:
  // "hero image" resolved to the platform-crop staging, which is not what a hero wants.
  const onSurface = forRole.filter((c) => c.surface === surface);
  const surfacePool = onSurface.length > 0 ? onSurface : forRole;
  const homePool = surfacePool.filter((c) => c.roles[0] === role);
  const pool = homePool.length > 0 ? homePool : surfacePool;
  const picked = pool[seedOf(`${brief.text}|${role}|${surface}`) % pool.length];
  const surfaceNote =
    onSurface.length > 0
      ? `on a ${surface} surface`
      : `(no staging serves a ${role} on a ${surface} surface, so the surface constraint was dropped)`;
  return {
    composition: picked,
    basis:
      homePool.length > 0
        ? `staging drawn from the ${pool.length} entr${pool.length === 1 ? 'y' : 'ies'} whose home role is ${role} ${surfaceNote}`
        : `no staging has ${role} as its home role ${surfaceNote}, so it was drawn from the ${pool.length} that can hold one`,
  };
}

// ---------------------------------------------------------------------------
// Resolution: the palette and the ink, from DESIGN.md and nowhere else
// ---------------------------------------------------------------------------

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export interface PaletteEntry {
  path: string;
  hex: string;
}

/**
 * Flatten DESIGN.md's colour tokens to dotted-path/hex pairs, in document order.
 *
 * Only real hex values survive. A token whose value is a `{reference}` or a non-colour string is dropped rather
 * than emitted as text, because a prompt carrying "{color.brand.primary}" is worse than one carrying no palette
 * at all: it looks specified and instructs nothing.
 */
export function flattenPalette(tokens: DesignTokens | null | undefined, limit = 8): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  const walk = (node: unknown, trail: string[]): void => {
    if (out.length >= limit) return;
    if (typeof node === 'string') {
      const v = node.trim();
      if (HEX_RE.test(v)) out.push({ path: trail.join('.'), hex: v.toLowerCase() });
      return;
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (out.length >= limit) return;
        walk(v, [...trail, k]);
      }
    }
  };
  walk(tokens?.colors ?? {}, ['colors']);
  return out;
}

/**
 * The colour of the text that will sit on this asset, if DESIGN.md names one.
 *
 * Searched by intent, in the order a design system usually spells it. Returns null rather than a guess: the whole
 * value of the contrast check is that its number is real, and a check run against an invented ink is a check that
 * certifies nothing while looking like it certified something.
 */
export function resolveInk(tokens: DesignTokens | null | undefined): PaletteEntry | null {
  const palette = flattenPalette(tokens, 200);
  if (palette.length === 0) return null;
  // Tiers, most specific first, so a system that spells it precisely wins over one that only hints. The last tier
  // is deliberately loose because a prose DESIGN.md names the role in words rather than in a token path ("Dark
  // Gray: #2C2C2C - Body text"), and dropping the ink for those projects would silently un-contract the contrast
  // check on most real repositories.
  const patterns: RegExp[] = [
    /(?:^|\.)(?:text|ink|foreground|fg)(?:$|\.)/i,
    /(?:^|\.)(?:text|ink|foreground|fg)[.-]?(?:primary|default|base|strong|high)(?:$|\.)/i,
    /(?:^|\.)on[.-]?(?:surface|background|base)(?:$|\.)/i,
    /(?:^|\.)neutral[.-]?9\d0?(?:$|\.)/i,
    /\b(?:body-?text|text|ink|typography)\b/i,
  ];
  for (const re of patterns) {
    const hit = palette.find((p) => re.test(p.path));
    if (hit) return hit;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Size
// ---------------------------------------------------------------------------

/** Parse "W:H" into a ratio. Returns null on anything malformed rather than defaulting to square. */
function aspectRatio(aspect: string): number | null {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(aspect).trim());
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0) || !(h > 0)) return null;
  return w / h;
}

/** The three geometries OpenAI images accepts. Anything else is rejected locally, before it can spend. */
export const OPENAI_SIZES: readonly string[] = ['1024x1024', '1536x1024', '1024x1536'];

/**
 * How a size may be chosen. Either snap to a fixed list, or take the staging's own aspect at a bounded edge.
 *
 * THIS EXISTS BECAUSE SIZE IS PROVIDER-SPECIFIC AND PRETENDING OTHERWISE COSTS A CALL. Discovered live: the
 * compiler emitted 1536x1024 for a 16:9 staging, which is valid on OpenAI, and the Gemini adapter buckets it as
 * 2K, and the cheapest Gemini image model answers "Image size 2K is not supported for this model" with an HTTP
 * 400. One geometry does not fit every provider, so the caller states the policy for the provider it is actually
 * going to call, and the rule is: the size must be servable by EVERY provider this invocation might reach.
 */
export interface SizePolicy {
  /** Snap to the nearest-aspect member of this list. */
  allowed?: readonly string[];
  /** Or: keep the staging's aspect exactly, with the longer edge at most this many pixels. */
  maxEdge?: number;
}

/** Round to a multiple of 8, the alignment every image pipeline here is happy with, never below 16. */
function align8(n: number): number {
  return Math.max(16, Math.round(n / 8) * 8);
}

/**
 * Derive a pixel size from the staging's aspect under a size policy.
 *
 * Defaults to the OpenAI list, which is the safe choice when nothing is known: it is the strictest set in play,
 * and every member of it is a real geometry rather than an arbitrary rectangle.
 */
export function sizeForAspect(aspect: string, policy: SizePolicy = {}): string {
  const ratio = aspectRatio(aspect);
  if (policy.allowed && policy.allowed.length > 0) {
    const parsed = policy.allowed
      .map((s) => ({ s, dims: parsePixels(s) }))
      .filter((e): e is { s: string; dims: { width: number; height: number } } => e.dims !== null);
    if (parsed.length === 0) return '1024x1024';
    if (ratio === null) return parsed[0].s;
    let best = parsed[0];
    for (const e of parsed) {
      const r = e.dims.width / e.dims.height;
      if (Math.abs(r - ratio) < Math.abs(best.dims.width / best.dims.height - ratio)) best = e;
    }
    return best.s;
  }
  const maxEdge = typeof policy.maxEdge === 'number' && policy.maxEdge >= 16 ? policy.maxEdge : 1024;
  if (ratio === null) return `${align8(maxEdge)}x${align8(maxEdge)}`;
  return ratio >= 1
    ? `${align8(maxEdge)}x${align8(maxEdge / ratio)}`
    : `${align8(maxEdge * ratio)}x${align8(maxEdge)}`;
}

function parsePixels(size: string): { width: number; height: number } | null {
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(String(size).trim());
  if (!m) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
}

// ---------------------------------------------------------------------------
// The negative constraints
// ---------------------------------------------------------------------------

/**
 * The standing negative constraints, in three groups.
 *
 * MEDIUM bans are what turns a picture into a designed surface, and they are the single highest-leverage lines in
 * the whole prompt: without them a generator returns a photograph of the subject instead of the subject's
 * interface.
 *
 * CALIBRATION bans name the looks that generated interfaces converge on regardless of subject. They are here
 * because a brief that leaves the aesthetic open gets the same three looks from every model, and a build that
 * lands there did not choose it.
 *
 * CALIBRATION BANS ARE CONDITIONAL, and this is the one rule in this file that must not be forgotten: they apply
 * only when NO palette is committed. A project whose DESIGN.md commits a warm paper surface has CHOSEN it, and
 * emitting "not the warm cream ground" alongside "use #f7f4ee" hands the generator a contradiction and quietly
 * overrides a real design decision with a generic caution. The committed palette always wins. Found by reading
 * the first compiled prompt, which contained exactly that contradiction.
 *
 * TRUTH bans are the ones that keep a generated asset from putting a claim in front of a user that the product
 * never made. An invented price or metric rendered into a hero plate is a false statement shipped as art.
 */
export const MEDIUM_BANS: readonly string[] = [
  'no photorealism and no photographic depth-of-field blur',
  'no glossy highlights, bevels, drop shadows, or 3D chrome',
  'no stock-photograph staging: no posed people at desks, no handshakes, no laptop-on-table vignette',
  'no rendering of browser chrome, window frames, cursors, or device bezels',
];

export const CALIBRATION_BANS: readonly string[] = [
  'not the warm cream ground with high-contrast serif display and a terracotta accent',
  'not near-black with one neon accent and glowing edges',
  'not the purple-to-blue diffuse gradient mesh',
  'not generic isometric technology illustration',
];

/**
 * The last entry is conditional on a permitted string existing. Emitting "no lettering other than the one
 * permitted string" when no string is permitted describes a permission that was never granted, which is exactly
 * the kind of small incoherence a generator resolves by inventing one.
 */
export const TRUTH_BANS: readonly string[] = [
  'no invented prices, dates, metrics, percentages, or customer names',
  'no logos, wordmarks, or brand marks of any kind',
];

export const TRUTH_BAN_ONE_STRING = 'no lettering other than the one permitted string named in the TEXT section';
export const TRUTH_BAN_NO_STRING = 'no lettering at all, anywhere, in any script';

// ---------------------------------------------------------------------------
// The compiler
// ---------------------------------------------------------------------------

const DIMENSIONS = [
  'role',
  'surface',
  'world',
  'staging',
  'palette',
  'focal',
  'text policy',
  'size',
  'negative constraints',
  'contrast target',
] as const;

/**
 * Compile a brief into a prompt and a verification contract.
 *
 * Returns null when the brief calls for no raster at all, which is a legitimate outcome and the caller must
 * report it as one. Never throws: a catalog or token problem degrades a dimension and says so in `briefStrength`
 * rather than failing a build flow.
 */
export function compileImageBrief(brief: ImageBrief, ctx: CompileContext = {}): CompiledImageBrief | null {
  const detectedRole = detectRole(brief.text);
  const role: ImageRole | null = brief.role ?? detectedRole?.role ?? null;
  if (!role) return null;

  const fromBrief: string[] = [];
  const supplied: string[] = [];
  const missing: string[] = [];

  if (brief.role) fromBrief.push(`role: given explicitly as ${brief.role}`);
  else if (detectedRole) supplied.push(`role: read as ${role} from the word "${detectedRole.matched}" in the brief`);

  const detectedSurface = detectSurface(brief.text);
  let surface: ImageSurface;
  if (brief.surface) {
    surface = brief.surface;
    fromBrief.push(`surface: given explicitly as ${brief.surface}`);
  } else if (detectedSurface) {
    surface = detectedSurface.surface;
    fromBrief.push(`surface: read as ${surface} from the word "${detectedSurface.matched}" in the brief`);
  } else {
    surface = ctx.register === 'brand' ? 'experience' : 'persuade';
    supplied.push(`surface: defaulted to ${surface} from the ${ctx.register || 'product'} register`);
  }

  const { concept, basis: conceptBasis } = resolveConcept(brief, ctx);
  if (brief.directionId) fromBrief.push(`world: ${concept.id}`);
  else supplied.push(`world: ${concept.id} (${conceptBasis})`);

  const { composition, basis: compositionBasis } = resolveComposition(brief, role, surface);
  if (brief.compositionId) fromBrief.push(`staging: ${composition.id}`);
  else supplied.push(`staging: ${composition.id} (${compositionBasis})`);
  supplied.push(`focal: from the staging's Focal rule (${composition.id})`);

  const policy = ctx.sizePolicy || { allowed: OPENAI_SIZES };
  const size = brief.size && parsePixels(brief.size) ? brief.size : sizeForAspect(composition.aspect, policy);
  if (brief.size && parsePixels(brief.size)) fromBrief.push(`size: ${size} given explicitly`);
  else
    supplied.push(
      `size: ${size} derived from the staging's ${composition.aspect} aspect under the ${
        policy.allowed ? `${policy.allowed.length}-geometry provider list` : `${policy.maxEdge ?? 1024}px max-edge`
      } policy`,
    );

  const palette = flattenPalette(ctx.designTokens, 6);
  if (palette.length > 0) {
    supplied.push(`palette: ${palette.length} real hex value(s) read from DESIGN.md tokens`);
  } else {
    supplied.push(`palette: no DESIGN.md colour tokens found, so the world's own material language carries the colour`);
    missing.push('DESIGN.md has no colour tokens, so the palette is described rather than specified by hex');
  }

  const ink = resolveInk(ctx.designTokens);
  const pixels = parsePixels(size);
  const inkRegion = pixels ? inkZoneToPixels(composition.inkZone, pixels.width, pixels.height) : null;

  const contract: ImageVerificationContract = { size, format: 'png' };
  if (brief.alpha) {
    contract.alpha = brief.alpha;
    fromBrief.push(`alpha: ${brief.alpha} given explicitly`);
  } else if (role === 'object') {
    contract.alpha = 'require';
    supplied.push('alpha: required, because an object role composites over the page');
  }
  if (ink && inkRegion) {
    contract.ink = ink.hex;
    contract.inkSource = ink.path;
    contract.inkRegion = inkRegion;
    contract.minContrast = 4.5;
    supplied.push(
      `contrast target: ${ink.hex} (from ${ink.path}) must clear 4.5:1 over the ${inkRegion.w}x${inkRegion.h} region at ${inkRegion.x},${inkRegion.y}, which is the staging's own ink zone`,
    );
  } else if (!ink) {
    missing.push(
      'DESIGN.md names no text colour, so the overlay-contrast check cannot be contracted; the asset will report contrast as not checked rather than as passed',
    );
  } else {
    missing.push('the staging ink zone does not resolve to a measurable pixel region at this size, so contrast cannot be contracted');
  }

  supplied.push(
    `negative constraints: ${MEDIUM_BANS.length + (palette.length > 0 ? 0 : CALIBRATION_BANS.length) + TRUTH_BANS.length + 1} standing bans plus the world's own refusal and the staging's own refusal`,
  );
  supplied.push(
    ctx.productName
      ? `text policy: one legible string permitted, the product name "${ctx.productName}"; everything else greeked`
      : 'text policy: no legible text permitted at all, because no product name was supplied and inventing one would put a false name in the asset',
  );

  const sections = buildSections({ brief, ctx, role, surface, concept, composition, palette, size, contract });
  const prompt = sections.map((s) => `${s.name}: ${s.body}`).join('\n');
  const digest = createHash('sha256').update(prompt).digest('hex').slice(0, 12);

  const score = Math.round((fromBrief.length / DIMENSIONS.length) * 100);
  return {
    prompt,
    sections,
    contract,
    concept,
    composition,
    role,
    surface,
    briefStrength: { score: Math.min(100, score), fromBrief, supplied, missing },
    digest,
  };
}

function buildSections(input: {
  brief: ImageBrief;
  ctx: CompileContext;
  role: ImageRole;
  surface: ImageSurface;
  concept: Direction;
  composition: ImageComposition;
  palette: PaletteEntry[];
  size: string;
  contract: ImageVerificationContract;
}): Array<{ name: string; body: string }> {
  const { brief, ctx, role, surface, concept, composition, palette, size, contract } = input;
  const subject = normalize(brief.text).slice(0, 240) || 'the surface described in the brief';
  const pixels = parsePixels(size);
  const zone = contract.inkRegion;

  const sections: Array<{ name: string; body: string }> = [];

  // STRUCTURE leads. A generator weights the front of a prompt hardest, and the single defect this whole layer
  // exists to prevent is a picture of the subject arriving where a designed surface was wanted.
  sections.push({
    name: 'STRUCTURE',
    body: `${composition.grammar[0].replace(/^Frame:\s*/, '')}. This is a designed ${role} for a ${surface} surface, built as flat graphic structure, not a photograph or an illustration of a scene.`,
  });
  sections.push({ name: 'FOCAL', body: composition.grammar[1].replace(/^Focal:\s*/, '') });
  sections.push({ name: 'DEPTH', body: composition.grammar[2].replace(/^Depth:\s*/, '') });
  sections.push({ name: 'SUBJECT', body: `${subject}.` });

  sections.push({
    name: 'WORLD',
    body: `${concept.premise} Carry it through: ${concept.moves.join('; ')}.`,
  });

  sections.push({
    name: 'PALETTE',
    body:
      palette.length > 0
        ? `Use these exact values and no others: ${palette.map((p) => `${p.hex} (${p.path})`).join(', ')}. Colour fields own whole regions rather than appearing as scattered accents.`
        : `No fixed palette is committed, so take the colour from the world's own material language and hold it to at most three values. Colour fields own whole regions rather than appearing as scattered accents.`,
  });

  sections.push({
    name: 'MATERIAL',
    body: `Flat matte surfaces with even, directionless light. Texture may come from the material itself; it may not come from a lighting effect.`,
  });

  const inkLine =
    zone && pixels
      ? `Keep the region ${zone.w} by ${zone.h} pixels at ${zone.x},${zone.y} (of ${pixels.width} by ${pixels.height}) quiet and low-detail: live text will be placed there by the build, and its readability is measured against these pixels.`
      : `Keep the region described by the staging quiet and low-detail: live text will be placed there by the build.`;
  // Two closures, both learned from a live render rather than reasoned about.
  //
  // The first: the world's moves can name a type character ("system and monospace fonts"), which reads as
  // permission to render words unless it is closed off. The type character shapes the marks; it never licenses a
  // glyph.
  //
  // The second is the one that actually damaged an image. A long prompt with a TEXT policy and a DO NOT list gives
  // an image model a supply of English sentences, and it typeset them: a live render came back with "Greeked to
  // copy", "readability for future live text", and "wordmarks, brand browser chrome, cursor, device bezels" set as
  // body copy inside the artwork. The instructions became the content. Naming the instruction itself as forbidden
  // material is the fix, and it has to sit in the TEXT section where the model is already deciding what to letter.
  // The clause is written to cover THREE observed leak classes, in the order they were caught, because each fix
  // exposed the next one. Round one leaked English sentences from the DO NOT and TEXT sections. Round two, after
  // those were closed, leaked the palette's hex strings ("#d44af37") into the same copy block: the model had
  // stopped typesetting the prose and started typesetting the only other literal tokens in front of it. Naming
  // hex codes and token paths explicitly is round three. The general lesson, written down because it will
  // recur: any literal string in a prompt is a candidate to be rendered as lettering, so a text policy has to
  // forbid the CLASS rather than the instance.
  const greekClause =
    "The world's type character informs the shape and rhythm of those greeked marks; it never licenses a readable glyph. Nothing from this instruction may appear as lettering anywhere in the image: not its sentences, not any hex colour code, not any token path or field name. This is a specification, not copy to typeset.";
  sections.push({
    name: 'TEXT',
    body: ctx.productName
      ? `${inkLine} The only legible lettering permitted anywhere in the image is the exact string "${ctx.productName}". Any other text region must be greeked into indistinct marks that clearly stand for copy without spelling anything. ${greekClause}`
      : `${inkLine} No legible lettering anywhere. Every text region is greeked into indistinct marks that clearly stand for copy without spelling anything. ${greekClause}`,
  });

  sections.push({ name: 'ADAPTATION', body: composition.grammar[3].replace(/^Adaptation:\s*/, '') });

  const antiRefs = (ctx.antiReferences || []).map((a) => `nothing resembling ${String(a).trim()}`).filter((a) => a.length > 22);
  sections.push({
    name: 'DO NOT',
    body: [
      ...MEDIUM_BANS,
      `not ${concept.avoid.replace(/\.$/, '').toLowerCase()}`,
      `not ${composition.refuses}`,
      // Only when the project has committed no palette. See the note above CALIBRATION_BANS.
      ...(palette.length > 0 ? [] : CALIBRATION_BANS),
      ...TRUTH_BANS,
      ctx.productName ? TRUTH_BAN_ONE_STRING : TRUTH_BAN_NO_STRING,
      ...antiRefs,
    ].join('; '),
  });

  sections.push({
    name: 'OUTPUT',
    body: `A single ${size} PNG image.${contract.alpha === 'require' ? ' The subject sits on a fully transparent background.' : ''} Fill the whole frame; no letterboxing, no border, no matte, no caption bar.`,
  });

  return sections;
}

/** One-line summary of a compilation, for a guidance line or a log. */
export function summarizeCompilation(c: CompiledImageBrief): string {
  return `${c.role} for a ${c.surface} surface, staged as ${c.composition.id} in the ${c.concept.id} world, ${c.contract.size}${
    c.contract.ink ? `, contrast contracted at ${c.contract.minContrast}:1 for ${c.contract.ink}` : ', contrast NOT contracted'
  }`;
}
