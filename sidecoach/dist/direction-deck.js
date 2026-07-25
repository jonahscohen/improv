"use strict";
/**
 * Sidecoach direction deck (Stage 2c) - the outside-ranking direction roll.
 *
 * THE PROBLEM: left to its own devices a model gravitates to one default aesthetic (the centered-hero,
 * single-accent, friendly-rounded product-marketing look). Every build drifts toward the same place. This
 * module is the variance fix: it holds a SMALL curated deck of genuine design DIRECTIONS and draws one from
 * OUTSIDE the model's own top-ranked concept, so the build starts from a direction the model would not have
 * reached for on its own.
 *
 * THE MECHANISM (three structural invariants, each provable WITHOUT the RNG):
 *   1. Outside-ranking. The model's own instinct (the "model-top") is ranked LAST - it is removed from the
 *      draw pool, never returned. Absent an explicit --model-top, the deck's own default-instinct entry
 *      (MODEL_DEFAULT_ID) is the thing ranked last, because that IS the sameness we roll away from.
 *   2. No-repeat re-roll. A re-roll accepts an exclusion set (the prior draws) and never redraws a used id.
 *   3. Full-sweep termination. Because every roll removes {model-top} union {prior draws} from the pool and
 *      returns an eligible id that the caller then adds to the exclusion set, the pool strictly shrinks by one
 *      per re-roll; a full sweep visits every non-model-top direction exactly once and then reports exhausted.
 *
 *   Invariants 1-3 are properties of the POOL FILTER, not the random pick: the RNG only decides WHICH eligible
 *   direction, never WHETHER a direction is eligible. So "never the model-top", "never a used id", and
 *   "no repeats across a sweep" hold for every seed. The seed only controls order of visitation.
 *
 * DETERMINISM: the pick is a pure function of (seed, model-top, exclusion set). mixSeed folds the seed with the
 * SORTED exclusion set, so the same inputs in any order yield the same draw - reproducible and testable. No
 * clock, no ambient entropy, no map-iteration-order dependence.
 *
 * SCOPE: this file COMPUTES a draw and nothing else. Presenting the rolled direction for a decision is a
 * separate stage; there is no rendering, no network, no page injection here - a draw is data on stdout.
 *
 * OWNERSHIP: the deck below is our own curated authorship. It is intentionally small (a dozen-plus stances,
 * not a sprawling world catalog) and shares no identifiers with any studied comparator.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIRECTION_DECK = exports.MODEL_DEFAULT_ID = void 0;
exports.deckIds = deckIds;
exports.directionById = directionById;
exports.unknownIds = unknownIds;
exports.resolveModelTopId = resolveModelTopId;
exports.mulberry32 = mulberry32;
exports.mixSeed = mixSeed;
exports.roll = roll;
/**
 * The id ranked LAST by default: the safe product-marketing baseline a model reaches for unprompted. It stays
 * a real, nameable entry in the deck (it is a legitimate aesthetic, just the overused one); the roll simply
 * never DRAWS it unless a different --model-top names this build's actual instinct, at which point the default
 * baseline becomes eligible like any other direction.
 */
exports.MODEL_DEFAULT_ID = 'conventional-saas';
/**
 * The curated deck. Order here is the canonical order; it is fixed in source, so the draw is reproducible.
 * Every entry is a distinct, defensible design stance authored for this tool.
 */
exports.DIRECTION_DECK = [
    {
        id: 'conventional-saas',
        name: 'Conventional SaaS',
        axis: 'mood',
        premise: 'The safe, agreeable product-marketing baseline every model reaches for by default.',
        moves: [
            'Centered hero with a single primary call to action',
            'One friendly accent hue over near-white surfaces',
            'Uniformly rounded cards in an even grid',
            'Humanist sans at comfortable, unremarkable sizes',
        ],
        avoid: 'Nothing - this IS the default. It is ranked last so the roll draws elsewhere.',
    },
    {
        id: 'editorial-print',
        name: 'Editorial Print',
        axis: 'structure',
        premise: 'Treat the screen like a well-set magazine spread rather than an app shell.',
        moves: [
            'Asymmetric multi-column grid with a wide measure for lead text',
            'Large serif display paired with a quiet text sans',
            'Real pull-quotes, drop-caps, and figure captions',
            'Generous, consistent baseline rhythm',
        ],
        avoid: 'The evenly centered, single-column app layout.',
    },
    {
        id: 'swiss-objective',
        name: 'Swiss Objective',
        axis: 'structure',
        premise: 'Order through a strict modular grid and neutral, objective typography.',
        moves: [
            'Rigid modular grid with visible alignment',
            'A single grotesque sans across the whole scale',
            'Flush-left, ragged-right, never justified',
            'Ornament removed; hierarchy from size and space alone',
        ],
        avoid: 'Decorative flourishes and centered symmetry.',
    },
    {
        id: 'brutalist-utility',
        name: 'Brutalist Utility',
        axis: 'texture',
        premise: 'Expose the structure; let raw materials and hard edges carry the character.',
        moves: [
            'System and monospace fonts, unstyled where honest',
            'Hard 1px borders and zero corner radius',
            'Visible layout seams instead of soft cards',
            'High-contrast ink on paper with one loud accent',
        ],
        avoid: 'Soft shadows, blur, and rounded friendliness.',
    },
    {
        id: 'quiet-minimal',
        name: 'Quiet Minimal',
        axis: 'density',
        premise: 'Say less; let whitespace and a single type ramp do the work.',
        moves: [
            'One restrained type scale, few weights',
            'Near-monochrome palette with a whisper of accent',
            'Whitespace as the primary structural material',
            'Remove every element that is not load-bearing',
        ],
        avoid: 'Dense chrome and competing focal points.',
    },
    {
        id: 'expressive-maximal',
        name: 'Expressive Maximal',
        axis: 'mood',
        premise: 'Fill the frame with confident type, color, and deliberate density.',
        moves: [
            'Oversized headlines that dominate the viewport',
            'Layered color blocks and overlapping elements',
            'Strong scale contrast between display and body',
            'Composed density rather than empty space',
        ],
        avoid: 'Timid whitespace and single-accent restraint.',
    },
    {
        id: 'warm-analog',
        name: 'Warm Analog',
        axis: 'color',
        premise: 'Trade the cool blue-gray default for a warm, paper-toned material world.',
        moves: [
            'Muted earth palette: clay, ochre, moss, ink',
            'Paper-toned surfaces instead of pure white',
            'Soft near-black text, never pure black',
            'Tactile warmth without skeuomorphic texture',
        ],
        avoid: 'The cool, clinical blue-on-white product palette.',
    },
    {
        id: 'nocturnal-dark',
        name: 'Nocturnal Dark',
        axis: 'color',
        premise: 'Design dark-first, with luminous restraint tuned for low-glare reading.',
        moves: [
            'Deep, slightly warm dark surfaces as the base',
            'One or two luminous accents used sparingly',
            'Contrast tuned to pass AA on dark, not just light',
            'Elevation by lightness, not heavy drop-shadow',
        ],
        avoid: 'A light layout inverted late as an afterthought.',
    },
    {
        id: 'technical-datafirst',
        name: 'Technical Data-First',
        axis: 'density',
        premise: 'Respect dense information; make numbers and rows first-class citizens.',
        moves: [
            'Tabular figures and monospaced numerics',
            'Compact, scannable rows over spacious cards',
            'Restrained chrome so the data is the focus',
            'Aligned decimal columns and consistent units',
        ],
        avoid: 'Marketing spacing that buries the actual data.',
    },
    {
        id: 'refined-restraint',
        name: 'Refined Restraint',
        axis: 'type',
        premise: 'Understated luxury through precise type and deep, quiet neutrals.',
        moves: [
            'Tight, deliberate tracking on display type',
            'Light weights against deep neutral grounds',
            'Hairline rules and precise optical alignment',
            'A single restrained metallic or jewel accent',
        ],
        avoid: 'Loud gradients and oversized friendly rounding.',
    },
    {
        id: 'geometric-play',
        name: 'Geometric Play',
        axis: 'mood',
        premise: 'Build from primary shapes and saturated blocks with unfussy confidence.',
        moves: [
            'Circles, squares, and triangles as real structure',
            'Saturated primary color blocking',
            'Chunky weights and bold, simple forms',
            'Playful but disciplined, never childish',
        ],
        avoid: 'Gradient-heavy, glassy softness.',
    },
    {
        id: 'architectural-grid',
        name: 'Architectural Grid',
        axis: 'structure',
        premise: 'Show the measure; let visible rules and columns express the structure.',
        moves: [
            'Exposed column and baseline rules',
            'Blueprint restraint: line, label, and dimension',
            'Precise, repeated alignment across sections',
            'Structure as ornament, ornament as structure',
        ],
        avoid: 'Free-floating cards with no shared measure.',
    },
    {
        id: 'humanist-soft',
        name: 'Humanist Soft',
        axis: 'type',
        premise: 'Warm and approachable through humanist type and a comfortable measure.',
        moves: [
            'Humanist sans with open, friendly curves',
            'Comfortable line length and generous leading',
            'Warm neutrals over stark white',
            'Gentle, purposeful corner rounding',
        ],
        avoid: 'Cold grotesques and a cramped measure.',
    },
    {
        id: 'monochrome-contrast',
        name: 'Monochrome Contrast',
        axis: 'color',
        premise: 'Ink, paper, and one decisive accent; hierarchy from weight and scale.',
        moves: [
            'Strict ink-and-paper base',
            'A single, decisive accent used with intent',
            'Weight and scale carry the hierarchy',
            'No secondary tints muddying the system',
        ],
        avoid: 'A palette of five near-identical grays.',
    },
    {
        id: 'documentary-photo',
        name: 'Documentary Photo',
        axis: 'texture',
        premise: 'Let full-bleed imagery lead; keep the chrome disciplined and deferential.',
        moves: [
            'Image-forward, full-bleed compositions',
            'Disciplined captions with a clear type role',
            'Neutral chrome that yields to the content',
            'Consistent crop ratios and alignment',
        ],
        avoid: 'Decorative interface that competes with the photography.',
    },
    {
        id: 'structured-motion',
        name: 'Structured Motion',
        axis: 'motion',
        premise: 'Use restrained, purposeful motion as wayfinding rather than decoration.',
        moves: [
            'Asymmetric enter and exit timing',
            'Motion that reinforces spatial relationships',
            'A small, named set of easings used consistently',
            'Respect reduced-motion; degrade to none',
        ],
        avoid: 'Ambient, decorative animation with no meaning.',
    },
];
// ---------------------------------------------------------------------------
// Deck lookups
// ---------------------------------------------------------------------------
/** All deck ids in canonical order. */
function deckIds() {
    return exports.DIRECTION_DECK.map((d) => d.id);
}
/** Look up a direction by id, or undefined if it is not in the deck. */
function directionById(id) {
    return exports.DIRECTION_DECK.find((d) => d.id === id);
}
/**
 * Of the given ids, the ones that are NOT in the deck. Empty means every id is a real deck id. The CLI uses
 * this to fail loud on a typo'd --exclude id rather than silently rolling as if the exclusion did not apply.
 */
function unknownIds(ids) {
    const known = new Set(exports.DIRECTION_DECK.map((d) => d.id));
    return ids.filter((id) => !known.has(id));
}
/**
 * Resolve the id to rank LAST for this roll. An explicit value (the model's stated instinct for this build)
 * wins and MUST be a real deck id; absent one, the deck's default-instinct entry is ranked last. Throws on an
 * unknown explicit id so a bad hand-off fails loud instead of silently ranking nothing.
 */
function resolveModelTopId(cliValue) {
    if (cliValue == null || cliValue === '')
        return exports.MODEL_DEFAULT_ID;
    if (!directionById(cliValue)) {
        throw new Error(`unknown model-top id "${cliValue}" (not in the direction deck)`);
    }
    return cliValue;
}
// ---------------------------------------------------------------------------
// Deterministic RNG (public-domain hash-based PRNG; no external dependency)
// ---------------------------------------------------------------------------
/**
 * mulberry32 - a tiny deterministic PRNG. Given a 32-bit seed it yields a stable sequence of floats in [0, 1).
 * Standard public-domain construction; used here only to index the eligible pool.
 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/**
 * Fold a base seed with an exclusion set into a single 32-bit seed. The set is SORTED first, so the fold is
 * order-independent: the same exclusion set in any order (and thus the same eligible pool) yields the same
 * pick. With an empty set this returns the base seed unchanged. FNV-style mixing; deterministic and pure.
 */
function mixSeed(seed, excludeIds = []) {
    let h = seed | 0;
    const sorted = [...excludeIds].sort();
    for (const id of sorted) {
        for (let i = 0; i < id.length; i++) {
            h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
        }
        h = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b);
    }
    return h >>> 0;
}
/**
 * Draw one direction from OUTSIDE the model-top, excluding any prior draws.
 *
 * The eligible pool is the deck minus {model-top} minus {prior draws}. If it is empty the roll is exhausted
 * (a distinct, honest outcome - never a silent fallback to the model-top or a used id). Otherwise a single
 * deterministic index (seeded by the base seed folded with the exclusion set) selects one eligible direction.
 *
 * The three invariants (never the model-top, never a used id, no repeats across a sweep) hold structurally
 * because the pick is taken from an already-filtered pool - they do not depend on the RNG.
 */
function roll(input) {
    // Canonicalize the seed as UNSIGNED 32-bit. mixSeed and mulberry32 both operate on the 32-bit pattern, so
    // storing/echoing the unsigned value (not `| 0`, which would surface a negative for seeds >= 2^31) keeps the
    // echoed seed inside the CLI's accepted [0, 4294967295] domain and therefore re-runnable.
    const seed = input.seed >>> 0;
    const modelTopId = input.modelTopId;
    const excludeInput = input.exclude ?? [];
    // The model-top is ALWAYS excluded (ranked last), joined with the caller's prior draws.
    const excludedSet = new Set([modelTopId, ...excludeInput]);
    const excluded = [...excludedSet].sort();
    // Eligible pool in canonical deck order (fixed in source -> reproducible).
    const pool = exports.DIRECTION_DECK.filter((d) => !excludedSet.has(d.id));
    const eligibleIds = pool.map((d) => d.id).sort();
    if (pool.length === 0) {
        return {
            status: 'exhausted',
            seed,
            modelTopId,
            excluded,
            eligibleIds,
            eligibleCount: 0,
            draw: null,
            remaining: 0,
        };
    }
    // Deterministic pick. mulberry32 yields a float in [0, 1), so idx is always in [0, pool.length - 1].
    const rng = mulberry32(mixSeed(seed, excluded));
    const idx = Math.floor(rng() * pool.length);
    const draw = pool[idx];
    return {
        status: 'drawn',
        seed,
        modelTopId,
        excluded,
        eligibleIds,
        eligibleCount: pool.length,
        draw,
        remaining: pool.length - 1,
    };
}
//# sourceMappingURL=direction-deck.js.map