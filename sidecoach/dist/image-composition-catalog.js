"use strict";
/**
 * Sidecoach image COMPOSITION catalog - the staging half of the concept/composition layer.
 *
 * WHY THIS EXISTS. An image request that reaches a generator as "hero image for the pricing page" produces a
 * picture OF a pricing page: a vignette, a poster, a photograph with some lettering on it. What it needs to
 * produce is a designed surface whose regions are named in order with their scale relationships. That knowledge
 * is not in the human's brief and it is not in the model's default reach, so it has to live in a catalog and be
 * COMPILED IN. This file is that catalog.
 *
 * THE DIVISION OF LABOUR, and it is deliberate:
 *   - The WORLD (palette, material, type character) comes from `direction-deck.ts`. That deck already exists and
 *     already drives the direction roll, so the image world and the build's design direction are drawn from ONE
 *     catalog. Two consumers, one source of authorship.
 *   - The STAGING (frame, focal, depth, adaptation) comes from here, and carries NO palette and NO typeface, so
 *     any world can dress any staging. That separation is what lets a weak brief pick up a strong structure
 *     without also picking up a look nobody chose.
 *
 * THE PROPERTY NOTHING ELSE HERE HAS. Every entry declares an `inkZone`: the normalized rectangle where the
 * overlaid headline or label is going to sit. The prompt compiler emits that zone as a composition instruction
 * ("keep this region quiet") AND converts the same numbers into the pixel region the contrast check reads back
 * out of the decoded image. The instruction and the check are compiled from one field, so they cannot drift. An
 * asset that was told to keep its upper-left quiet is measured on its upper-left.
 *
 * THE VALIDATOR IS NOT DECORATION. `validateImageComposition` enforces the palette-free and type-free contract
 * MECHANICALLY: a grammar rule that names a colour, a hex, or a typeface is a validation error, not a comment
 * asking politely. A catalog whose separation is only documented drifts the first time somebody writes "warm
 * cream ground" into a staging rule. It is exercised over the shipped catalog by the test suite, so an entry
 * added later cannot land unchecked.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_COMPOSITION_CATALOG = exports.COMPOSITION_GRAMMAR_PREFIXES = exports.IMAGE_ROLES = exports.IMAGE_SURFACES = void 0;
exports.validateImageComposition = validateImageComposition;
exports.validateImageCompositionCatalog = validateImageCompositionCatalog;
exports.compositionById = compositionById;
exports.compositionsForRole = compositionsForRole;
exports.inkZoneToPixels = inkZoneToPixels;
exports.IMAGE_SURFACES = ['persuade', 'operate', 'read', 'experience'];
exports.IMAGE_ROLES = [
    'backdrop',
    'plate',
    'texture',
    'object',
    'portrait',
    'scene',
    'thumbnail',
    'social-card',
];
/**
 * Grammar prefixes, in fixed order. The order is the reading order of the emitted prompt: what the frame is,
 * then where the eye goes, then what it is made of, then how it survives a different crop. A generator reads the
 * front of a prompt hardest, which is why the frame is first.
 */
exports.COMPOSITION_GRAMMAR_PREFIXES = ['Frame:', 'Focal:', 'Depth:', 'Adaptation:'];
// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------
/**
 * Fourteen stagings. Small and authored, not sprawling: every entry names a frame a build could actually ship,
 * and the set spans all four visitor modes so a resolution never has to cross modes to find a match.
 */
exports.IMAGE_COMPOSITION_CATALOG = [
    {
        id: 'quiet-left-third',
        label: 'Quiet left third',
        surface: 'persuade',
        roles: ['backdrop', 'scene'],
        tags: ['asymmetric', 'overlay-ready', 'wide'],
        grammar: [
            'Frame: full-bleed field divided a third to two thirds, the narrow left third held deliberately empty and low-detail',
            'Focal: the single subject mass sits in the right two thirds, its weight centred about two thirds across',
            'Depth: three separated planes, a near edge, the subject, and an open far field, with air between them',
            'Adaptation: the right two thirds may be cropped to square without losing the subject; the left third never carries detail',
        ],
        inkZone: [0.04, 0.18, 0.34, 0.5],
        aspect: '16:9',
        refuses: 'the centred symmetrical composition that leaves nowhere for a headline to sit',
    },
    {
        id: 'horizon-band',
        label: 'Horizon band',
        surface: 'persuade',
        roles: ['backdrop'],
        tags: ['banded', 'calm', 'panoramic'],
        grammar: [
            'Frame: one horizontal band across the lower third carries all structure, the upper two thirds an open even field',
            'Focal: attention rests on the band edge itself, the sharpest transition in the frame',
            'Depth: two planes only, an open field above and a dense band below, no mid-ground clutter',
            'Adaptation: the band holds its proportion when the frame is cropped taller; the open field absorbs the loss',
        ],
        inkZone: [0.08, 0.1, 0.6, 0.4],
        aspect: '16:9',
        refuses: 'busy detail spread evenly across the whole frame so no region can hold text',
    },
    {
        id: 'centred-object-void',
        label: 'Centred object in void',
        surface: 'persuade',
        roles: ['object', 'thumbnail'],
        tags: ['isolated', 'product', 'square'],
        grammar: [
            'Frame: one subject centred in an otherwise empty field, occupying about half the shorter dimension',
            'Focal: a single hard-edged silhouette against uninterrupted ground, no competing mass',
            'Depth: the subject sits forward with a contact shadow only, the ground reading as flat',
            'Adaptation: the empty margin is the crop budget, so the frame survives a tighter square or a wider pad',
        ],
        inkZone: [0.06, 0.78, 0.88, 0.16],
        aspect: '1:1',
        refuses: 'a scene built around the object that makes it uncuttable and unreusable',
    },
    {
        id: 'stacked-registers',
        label: 'Stacked registers',
        surface: 'read',
        roles: ['plate', 'scene'],
        tags: ['layered', 'editorial', 'sequential'],
        grammar: [
            'Frame: three stacked horizontal registers of unequal height, the tallest second, each a distinct zone',
            'Focal: the eye enters at the tall middle register and travels down, the top register acting as a lintel',
            'Depth: registers overlap by a small margin so the stack reads as built rather than as three pictures',
            'Adaptation: the bottom register is the sacrificial one; losing it leaves the composition intact',
        ],
        inkZone: [0.08, 0.06, 0.84, 0.2],
        aspect: '4:5',
        refuses: 'the evenly divided triptych where no register leads',
    },
    {
        id: 'margin-figure',
        label: 'Margin figure',
        surface: 'read',
        roles: ['plate', 'portrait'],
        tags: ['offset', 'quiet', 'text-adjacent'],
        grammar: [
            'Frame: the subject held to one side against a wide open margin that runs the full height',
            'Focal: the subject faces or leans into the margin, so the empty side reads as intended rather than as a gap',
            'Depth: shallow, two planes, the subject and a near-flat ground behind it',
            'Adaptation: the margin narrows first under a tighter crop and the subject never moves',
        ],
        inkZone: [0.55, 0.12, 0.4, 0.72],
        aspect: '3:2',
        refuses: 'a tightly cropped subject with no margin for the copy that has to run beside it',
    },
    {
        id: 'grid-field',
        label: 'Grid field',
        surface: 'operate',
        roles: ['texture', 'backdrop'],
        tags: ['modular', 'repeating', 'tileable'],
        grammar: [
            'Frame: an even modular field with a visible repeating measure and no subject anywhere in it',
            'Focal: none by design, the field is uniform so nothing in it competes with what sits on top',
            'Depth: flat, a single plane, variation carried by the measure rather than by light',
            'Adaptation: the field tiles at its own module, so any crop is a valid crop',
        ],
        inkZone: [0.0, 0.0, 1.0, 1.0],
        aspect: '1:1',
        refuses: 'a decorative pattern with a focal accident in it that shows up once and tiles badly',
    },
    {
        id: 'instrument-face',
        label: 'Instrument face',
        surface: 'operate',
        roles: ['plate', 'object'],
        tags: ['frontal', 'measured', 'dense'],
        grammar: [
            'Frame: a flat frontal face divided into unequal measured zones, edges aligned to a shared rule',
            'Focal: the largest zone leads, secondary zones read as subordinate at a glance',
            'Depth: minimal, incised rather than layered, everything on one surface',
            'Adaptation: zones reflow along the shared rule, so a narrower frame drops the rightmost zone cleanly',
        ],
        inkZone: [0.05, 0.05, 0.42, 0.3],
        aspect: '3:2',
        refuses: 'a perspective view of an instrument that cannot be read straight on',
    },
    {
        id: 'ledger-rows',
        label: 'Ledger rows',
        surface: 'operate',
        roles: ['texture', 'plate'],
        tags: ['ruled', 'horizontal', 'data-adjacent'],
        grammar: [
            'Frame: repeated horizontal rules at a constant interval spanning the full width, no vertical incident',
            'Focal: even by design, with one interval break as the only event',
            'Depth: flat, the rules incised into the ground rather than floating over it',
            'Adaptation: rules continue past every edge so the frame reads as a window onto a longer run',
        ],
        inkZone: [0.0, 0.0, 1.0, 1.0],
        aspect: '16:9',
        refuses: 'a ruled field that ends inside the frame and exposes a stopping point',
    },
    {
        id: 'overlap-diptych',
        label: 'Overlap diptych',
        surface: 'experience',
        roles: ['scene', 'plate'],
        tags: ['overlapping', 'seamed', 'tense'],
        grammar: [
            'Frame: two unequal masses meeting off centre with a deliberate overlap along a hard seam',
            'Focal: the seam itself is the subject, the highest-contrast line in the frame',
            'Depth: the smaller mass reads in front, the larger recedes, the seam carrying the whole depth cue',
            'Adaptation: the seam holds its angle at any crop, and the larger mass absorbs the loss',
        ],
        inkZone: [0.06, 0.62, 0.42, 0.3],
        aspect: '3:2',
        refuses: 'two halves butted together with no overlap, which reads as a mistake rather than a decision',
    },
    {
        id: 'aperture-vignette',
        label: 'Aperture',
        surface: 'experience',
        roles: ['scene', 'backdrop'],
        tags: ['framed', 'inward', 'deep'],
        grammar: [
            'Frame: a dense border mass surrounding an open aperture set off centre, the aperture about a third of the area',
            'Focal: the eye is driven through the aperture, the border deliberately unreadable',
            'Depth: strong, the border near and dark, the aperture opening onto a far plane',
            'Adaptation: the border can be cropped to any thickness, the aperture never clipped',
        ],
        inkZone: [0.3, 0.3, 0.4, 0.4],
        aspect: '4:3',
        refuses: 'an even vignette applied as a filter rather than built as structure',
    },
    {
        id: 'drift-field',
        label: 'Drift field',
        surface: 'experience',
        roles: ['backdrop', 'texture'],
        tags: ['gradual', 'directional', 'atmospheric'],
        grammar: [
            'Frame: a continuous field with one directional drift from dense to open across the diagonal',
            'Focal: none, but the open corner is where the eye rests and where anything placed on top belongs',
            'Depth: continuous rather than layered, depth carried by density falling off along the drift',
            'Adaptation: the drift direction survives any crop because it is defined by the diagonal, not by an edge',
        ],
        inkZone: [0.5, 0.5, 0.46, 0.44],
        aspect: '16:9',
        refuses: 'a symmetrical soft glow with no direction, which gives nothing to compose against',
    },
    {
        id: 'shoulder-portrait',
        label: 'Shoulder portrait',
        surface: 'persuade',
        roles: ['portrait'],
        tags: ['human', 'offset', 'shallow'],
        grammar: [
            'Frame: head and shoulders held to one third, eyeline on the upper third rule, open field opposite',
            'Focal: the eyes, sharpest point in the frame, everything else falling off',
            'Depth: shallow, the subject separated from a soft continuous ground with no second subject',
            'Adaptation: the open field crops first; the eyeline stays on the upper third rule',
        ],
        inkZone: [0.52, 0.55, 0.42, 0.35],
        aspect: '4:5',
        refuses: 'a dead-centre passport framing with no room for anything beside it',
    },
    {
        id: 'card-crop',
        label: 'Card crop',
        surface: 'read',
        roles: ['thumbnail', 'plate'],
        tags: ['small-scale', 'legible-at-size', 'tight'],
        grammar: [
            'Frame: one idea only, sized to read at a third of the delivered dimension, edges kept clear of incident',
            'Focal: a single high-contrast shape that survives being shrunk, no fine detail carrying meaning',
            'Depth: flat to shallow, because depth cues vanish at thumbnail scale',
            'Adaptation: a safe inset all round takes the loss of any container crop or rounding',
        ],
        inkZone: [0.0, 0.7, 1.0, 0.3],
        aspect: '3:2',
        refuses: 'a detailed miniature scene that turns to mush at the size it will actually be shown',
    },
    {
        id: 'wide-safe-card',
        label: 'Wide safe card',
        surface: 'persuade',
        roles: ['social-card', 'backdrop'],
        tags: ['safe-zone', 'wide', 'cropped-by-others'],
        grammar: [
            'Frame: a wide field whose centre band is kept clear, all structure pushed to the outer thirds',
            'Focal: the clear centre band is the destination, the outer structure reads as a frame around it',
            'Depth: shallow and even, so no platform crop lands on an awkward plane transition',
            'Adaptation: the outer thirds are expendable, the centre band survives every platform crop',
        ],
        inkZone: [0.12, 0.28, 0.76, 0.44],
        aspect: '1.91:1',
        refuses: 'edge-anchored structure that a platform crop cuts through',
    },
];
// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
/**
 * Words that give away a palette or a typeface leaking into a staging rule. The catalog's separation of concerns
 * is only real if it is checked; this list is what does the checking. It is deliberately blunt: a false positive
 * costs one reworded rule, and a false negative costs the separation the whole layer is built on.
 */
const COLOUR_LEAK_RE = /#[0-9a-f]{3,8}\b|\b(?:red|orange|yellow|green|blue|indigo|violet|purple|pink|magenta|cyan|teal|brown|beige|cream|ivory|ochre|terracotta|clay|moss|amber|crimson|sepia|gold|golden|silver|bronze|copper|navy|slate|charcoal|greyscale|grayscale|monochrome|saturated|desaturated|hue|oklch|rgb|hsl)\b/i;
const TYPE_LEAK_RE = /\b(?:serif|sans|sans-serif|grotesque|grotesk|monospace|typeface|font|lettering|headline type|display type|italic|tracking|kerning|leading|weight \d{3})\b/i;
/** Validate one entry. Returns every error found, not just the first. */
function validateImageComposition(entry, seen = { ids: new Set(), labels: new Set() }) {
    const errors = [];
    const id = entry?.id || '(unknown)';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry?.id || '')) {
        errors.push(`invalid composition id: ${String(entry?.id)}`);
    }
    else if (seen.ids.has(entry.id)) {
        errors.push(`duplicate composition id: ${entry.id}`);
    }
    if (typeof entry?.label !== 'string' || entry.label.trim().length < 3) {
        errors.push(`composition ${id} needs a label`);
    }
    else if (seen.labels.has(entry.label.trim().toLowerCase())) {
        errors.push(`duplicate composition label: ${entry.label}`);
    }
    if (!exports.IMAGE_SURFACES.includes(entry?.surface)) {
        errors.push(`composition ${id} needs a surface of ${exports.IMAGE_SURFACES.join(', ')}, got ${String(entry?.surface)}`);
    }
    if (!Array.isArray(entry?.roles) || entry.roles.length === 0) {
        errors.push(`composition ${id} must stage at least one role`);
    }
    else {
        for (const role of entry.roles) {
            if (!exports.IMAGE_ROLES.includes(role))
                errors.push(`composition ${id} names an unknown role: ${String(role)}`);
        }
        if (new Set(entry.roles).size !== entry.roles.length) {
            errors.push(`composition ${id} repeats a role`);
        }
    }
    if (!Array.isArray(entry?.tags) || entry.tags.length !== 3 || entry.tags.some((t) => typeof t !== 'string' || !t.trim())) {
        errors.push(`composition ${id} must have exactly three structural tags`);
    }
    if (!Array.isArray(entry?.grammar) || entry.grammar.length !== exports.COMPOSITION_GRAMMAR_PREFIXES.length) {
        errors.push(`composition ${id} needs exactly ${exports.COMPOSITION_GRAMMAR_PREFIXES.length} grammar rules`);
    }
    else {
        entry.grammar.forEach((rule, i) => {
            const prefix = exports.COMPOSITION_GRAMMAR_PREFIXES[i];
            if (typeof rule !== 'string' || !rule.startsWith(prefix)) {
                errors.push(`composition ${id} grammar rule ${i + 1} must start with ${prefix}`);
                return;
            }
            const body = rule.slice(prefix.length).trim();
            if (body.length < 20 || body.length > 220) {
                errors.push(`composition ${id} grammar rule ${i + 1} must be 20-220 characters of body, got ${body.length}`);
            }
            // The contract, mechanically enforced. A staging that names a colour or a typeface has stopped being a
            // staging and become half a direction, and it will then override the world the build actually chose.
            const colour = COLOUR_LEAK_RE.exec(body);
            if (colour) {
                errors.push(`composition ${id} grammar rule ${i + 1} names a palette term (${colour[0]}); stagings are palette-free`);
            }
            const type = TYPE_LEAK_RE.exec(body);
            if (type) {
                errors.push(`composition ${id} grammar rule ${i + 1} names a type term (${type[0]}); stagings are type-free`);
            }
        });
        if (new Set(entry.grammar.map((r) => String(r).toLowerCase())).size !== entry.grammar.length) {
            errors.push(`composition ${id} has duplicate grammar rules`);
        }
    }
    const zone = entry?.inkZone;
    if (!Array.isArray(zone) || zone.length !== 4 || zone.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
        errors.push(`composition ${id} needs an inkZone of four finite numbers`);
    }
    else {
        const [x, y, w, h] = zone;
        if (x < 0 || y < 0 || w <= 0 || h <= 0)
            errors.push(`composition ${id} inkZone must have positive extent inside the frame`);
        if (x + w > 1.0001 || y + h > 1.0001)
            errors.push(`composition ${id} inkZone runs outside the frame`);
        if (w * h < 0.02)
            errors.push(`composition ${id} inkZone is too small to measure contrast in (${(w * h * 100).toFixed(1)}% of the frame)`);
    }
    if (typeof entry?.aspect !== 'string' || !/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(entry.aspect)) {
        errors.push(`composition ${id} needs an aspect of the form W:H, got ${String(entry?.aspect)}`);
    }
    if (typeof entry?.refuses !== 'string' || entry.refuses.trim().length < 20) {
        errors.push(`composition ${id} must name the default it refuses, in at least 20 characters`);
    }
    if (entry?.id)
        seen.ids.add(entry.id);
    if (typeof entry?.label === 'string')
        seen.labels.add(entry.label.trim().toLowerCase());
    return errors;
}
/**
 * Validate the whole catalog, including the coverage properties a single entry cannot express: every surface
 * reachable, every role stageable. A role with no staging is a request the compiler would have to answer by
 * inventing one, which is the thing this layer exists to prevent.
 */
function validateImageCompositionCatalog(catalog = exports.IMAGE_COMPOSITION_CATALOG) {
    const errors = [];
    const warnings = [];
    const seen = { ids: new Set(), labels: new Set() };
    if (catalog.length < 12)
        errors.push(`catalog needs at least 12 stagings, found ${catalog.length}`);
    for (const entry of catalog)
        errors.push(...validateImageComposition(entry, seen));
    for (const surface of exports.IMAGE_SURFACES) {
        if (!catalog.some((c) => c.surface === surface))
            errors.push(`no staging serves the ${surface} surface`);
    }
    for (const role of exports.IMAGE_ROLES) {
        if (!catalog.some((c) => c.roles.includes(role)))
            errors.push(`no staging can stage the ${role} role`);
    }
    for (const surface of exports.IMAGE_SURFACES) {
        const n = catalog.filter((c) => c.surface === surface).length;
        if (n < 2)
            warnings.push(`only ${n} staging(s) serve ${surface}; a resolution there has no spread to draw from`);
    }
    return { errors, warnings };
}
// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
function compositionById(id) {
    return exports.IMAGE_COMPOSITION_CATALOG.find((c) => c.id === id);
}
/** Every staging that can stage a role, home role first. */
function compositionsForRole(role) {
    return exports.IMAGE_COMPOSITION_CATALOG.filter((c) => c.roles.includes(role)).sort((a, b) => Number(b.roles[0] === role) - Number(a.roles[0] === role) || a.id.localeCompare(b.id));
}
/**
 * Convert a normalized ink zone to the pixel rectangle the verifier reads. Clamped to the image so a rounding
 * error can never produce a region that starts outside the bytes; a zero-extent result returns null rather than
 * a degenerate rectangle, because the caller must then decline to contract the check instead of contracting an
 * unmeasurable one.
 */
function inkZoneToPixels(zone, width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1)
        return null;
    const x = Math.max(0, Math.min(width - 1, Math.round(zone[0] * width)));
    const y = Math.max(0, Math.min(height - 1, Math.round(zone[1] * height)));
    const w = Math.max(0, Math.min(width - x, Math.round(zone[2] * width)));
    const h = Math.max(0, Math.min(height - y, Math.round(zone[3] * height)));
    if (w < 1 || h < 1)
        return null;
    return { x, y, w, h };
}
//# sourceMappingURL=image-composition-catalog.js.map