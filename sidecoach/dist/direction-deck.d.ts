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
/** The primary design dimension a direction pushes on. Metadata; the roll does not read it. */
export type DirectionAxis = 'structure' | 'type' | 'color' | 'texture' | 'density' | 'mood' | 'motion';
/** One curated design direction. `id` is the stable slug the roll and the exclusion set key on. */
export interface Direction {
    /** Stable kebab-case slug. The only field the roll's identity logic depends on. */
    id: string;
    /** Short human name. */
    name: string;
    /** The dimension this direction primarily pushes on. */
    axis: DirectionAxis;
    /** One-sentence stance: what this direction commits to. */
    premise: string;
    /** Three to five concrete design moves a build in this direction would make. */
    moves: string[];
    /** The default this direction deliberately rejects - the sameness it exists to break. */
    avoid: string;
}
/**
 * The id ranked LAST by default: the safe product-marketing baseline a model reaches for unprompted. It stays
 * a real, nameable entry in the deck (it is a legitimate aesthetic, just the overused one); the roll simply
 * never DRAWS it unless a different --model-top names this build's actual instinct, at which point the default
 * baseline becomes eligible like any other direction.
 */
export declare const MODEL_DEFAULT_ID = "conventional-saas";
/**
 * The curated deck. Order here is the canonical order; it is fixed in source, so the draw is reproducible.
 * Every entry is a distinct, defensible design stance authored for this tool.
 */
export declare const DIRECTION_DECK: readonly Direction[];
/** All deck ids in canonical order. */
export declare function deckIds(): string[];
/** Look up a direction by id, or undefined if it is not in the deck. */
export declare function directionById(id: string): Direction | undefined;
/**
 * Of the given ids, the ones that are NOT in the deck. Empty means every id is a real deck id. The CLI uses
 * this to fail loud on a typo'd --exclude id rather than silently rolling as if the exclusion did not apply.
 */
export declare function unknownIds(ids: readonly string[]): string[];
/**
 * Resolve the id to rank LAST for this roll. An explicit value (the model's stated instinct for this build)
 * wins and MUST be a real deck id; absent one, the deck's default-instinct entry is ranked last. Throws on an
 * unknown explicit id so a bad hand-off fails loud instead of silently ranking nothing.
 */
export declare function resolveModelTopId(cliValue?: string | null): string;
/**
 * mulberry32 - a tiny deterministic PRNG. Given a 32-bit seed it yields a stable sequence of floats in [0, 1).
 * Standard public-domain construction; used here only to index the eligible pool.
 */
export declare function mulberry32(seed: number): () => number;
/**
 * Fold a base seed with an exclusion set into a single 32-bit seed. The set is SORTED first, so the fold is
 * order-independent: the same exclusion set in any order (and thus the same eligible pool) yields the same
 * pick. With an empty set this returns the base seed unchanged. FNV-style mixing; deterministic and pure.
 */
export declare function mixSeed(seed: number, excludeIds?: readonly string[]): number;
export interface RollInput {
    /** Unsigned 32-bit seed [0, 4294967295]. Same seed + same model-top + same exclusion set => same draw. */
    seed: number;
    /** The id ranked last (never drawn). Resolve via resolveModelTopId before calling. */
    modelTopId: string;
    /** Prior draws to never redraw. Order does not matter; duplicates are collapsed. */
    exclude?: readonly string[];
}
export interface RollOutcome {
    /** 'drawn' when a direction was returned; 'exhausted' when the eligible pool was empty. */
    status: 'drawn' | 'exhausted';
    /** Echo of the seed the pick used. */
    seed: number;
    /** The id that was ranked last for this roll. */
    modelTopId: string;
    /** The full applied exclusion set (model-top union prior draws), sorted and deduped. */
    excluded: string[];
    /** Eligible pool ids (deck minus excluded) before the draw, sorted for stable reporting. */
    eligibleIds: string[];
    /** Size of the eligible pool before the draw. */
    eligibleCount: number;
    /** The drawn direction, or null when exhausted. */
    draw: Direction | null;
    /** How many re-rolls remain after this draw (eligibleCount - 1 when drawn, else 0). */
    remaining: number;
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
export declare function roll(input: RollInput): RollOutcome;
//# sourceMappingURL=direction-deck.d.ts.map