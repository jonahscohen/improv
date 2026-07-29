/**
 * Sidecoach image generation - the provider-agnostic core.
 *
 * WHAT THIS IS FOR: sidecoach can shape a concept, author a mock, render it, and scan it. What it could not do
 * was produce the raster assets a concept needs - the hero image, the texture, the illustrative plate - so
 * every mock either shipped with a gray box or borrowed something. This module generates them, and (through
 * image-asset-verify) refuses to hand back one it has not checked.
 *
 * FOUR PROPERTIES, each one a deliberate answer to how these tools usually fail:
 *
 *   1. PROVIDER-AGNOSTIC, WITH A REAL FALLBACK CHAIN. Providers are table entries: a key env list, a model
 *      resolver, a size/quality validator, a request builder, a response parser, and a price record. Adding one
 *      is a table entry, not a fork of the pipeline. `auto` walks the chain in order and records EVERY attempt.
 *      The chain never falls back to the offline renderer - see property 2 for why that matters.
 *
 *   2. OFFLINE MODE IS OPT-IN AND SELF-INCRIMINATING. The deterministic renderer produces a real PNG from the
 *      prompt hash, so tests and CI never spend a cent. It also stamps a marker INTO THE BYTES, and the
 *      verifier fails any asset whose marker state disagrees with what the caller claims. A placeholder
 *      therefore cannot be laundered into a report as a provider render - not by renaming it, not by moving it,
 *      not by a later step that forgot which mode it ran in. A silent placeholder standing in for a real asset
 *      is the exact defect class this design refuses to allow.
 *
 *   3. SPEND IS GATED, CAPPED, AND MEASURED, NOT ESTIMATED AFTER THE FACT. No live call happens without an
 *      explicit consent signal. Before the first call the projected cost is stated. Every call is checked
 *      against a per-run cap and a cumulative ledger cap BEFORE the request goes out, and the ledger records
 *      the ACTUAL cost derived from the provider's own reported token usage. Where a rate is not on record this
 *      module REFUSES to spend rather than print a number it made up: an unpriced call is an error, not a
 *      guess.
 *
 *   4. IDENTICAL REQUESTS DO NOT PAY TWICE. The cache is content-addressed on the canonical request, so a
 *      re-run of the same prompt at the same size against the same model is a file copy at zero cost.
 *
 * PURITY BOUNDARY: this module owns the request/response shapes, the canonicalization, the cache key, the price
 * math, the ledger math, and the deterministic renderer - all pure, all unit-testable. It performs exactly one
 * kind of IO, an outbound HTTPS request, and even that arrives through an injectable transport so the suite
 * drives every provider adapter and every failure class with no key and no network. Disk IO lives in the bin.
 */
export declare const EXIT: {
    /** Asset produced AND every contracted check passed. */
    readonly OK: 0;
    /** Asset produced, a check FAILED (wrong size, blank render, contrast too low, laundered placeholder). */
    readonly VERIFY_FAILED: 1;
    /** Bad arguments, unreadable input, missing build. Nothing was attempted. */
    readonly USAGE: 2;
    /** Asset produced but a contracted check COULD NOT RUN. Never reported as verified. */
    readonly UNVERIFIED: 3;
    /** A live provider was requested and no API key is present. Nothing was spent. */
    readonly NO_KEY: 4;
    /** No resolvable model id for the provider. Refuses to guess one. */
    readonly NO_MODEL: 5;
    /** Every provider in the chain failed (HTTP error, refusal, empty or malformed payload). */
    readonly PROVIDER: 6;
    /** Projected or cumulative spend exceeds the cap. Checked BEFORE the request; nothing was spent. */
    readonly BUDGET: 7;
    /** A live call was requested without the explicit spend signal. Nothing was spent. */
    readonly NEEDS_CONSENT: 8;
    /** Reading or writing a file failed. */
    readonly IO: 9;
    /** A live call whose cost cannot be established from the price record or an operator declaration. */
    readonly UNPRICED: 10;
    /** The request exceeds the provider's documented limits (size, quality, prompt length). Checked locally. */
    readonly OVERSIZE: 11;
    /** The resolved model id is a superseded generation. The standing no-legacy-models rule forbids it. */
    readonly LEGACY_MODEL: 12;
};
export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
export interface ImageRequest {
    prompt: string;
    /** "WIDTHxHEIGHT" in pixels. */
    size: string;
    /** Provider-facing quality label. */
    quality: string;
    /** Output format asked of the provider. png is the only format whose pixels this repo can verify. */
    format: 'png' | 'jpeg' | 'webp';
    provider: string;
    model: string;
}
export declare function parseSize(size: string): {
    width: number;
    height: number;
} | null;
export type FailureKind = 'no-key' | 'no-model' | 'legacy-model' | 'oversize' | 'unpriced' | 'budget' | 'http' | 'refusal' | 'empty' | 'malformed' | 'network';
export interface ProviderFailure {
    kind: FailureKind;
    provider: string;
    detail: string;
    /** HTTP status when the failure came from a response. */
    status?: number;
}
export interface ProviderSuccess {
    ok: true;
    provider: string;
    model: string;
    bytes: Buffer;
    mime: string;
    /** Token counts exactly as the provider reported them. Absent when the provider reports none. */
    usage: {
        inputTokens?: number;
        outputTokens?: number;
    } | null;
    status: number;
}
export type ProviderResult = ProviderSuccess | ({
    ok: false;
} & ProviderFailure);
/** Per-1M-token rates, as published. `imageInput` is used for input tokens as a deliberate overestimate. */
export interface TokenRates {
    imageInput: number;
    output: number;
}
export interface ProviderSpec {
    id: string;
    label: string;
    /** Env vars checked in order for an API key. */
    keyEnv: string[];
    /** Env var that overrides the model id. */
    modelEnv: string;
    /** The current flagship id, or null to force an explicit choice rather than guess. */
    modelDefault: string | null;
    /** Superseded ids this provider refuses to use. */
    legacyModels: string[];
    /** Accepted size strings, or null when the provider takes arbitrary geometry. */
    sizes: string[] | null;
    qualities: string[];
    maxPromptChars: number;
    /** Per-1M token rates by model, for usage-derived ACTUAL cost. */
    tokenRates: Record<string, TokenRates>;
    /** Published per-image prices by model and size bucket, for the pre-call projection. */
    perImageUsd: Record<string, Record<string, number>>;
    /** Where the numbers above came from, recorded so the math is auditable rather than folklore. */
    priceSource: string;
    buildRequest(req: ImageRequest, key: string): {
        url: string;
        init: Record<string, unknown>;
    };
    parseResponse(status: number, body: string): ProviderResult | {
        ok: false;
    } & ProviderFailure;
}
/** Bucket a pixel size into the resolution tier the published per-image prices are quoted against. */
export declare function resolutionBucket(size: string): string;
/** Reduce a pixel size to the closest documented Gemini aspect ratio. */
export declare function aspectRatioFor(size: string): string;
/**
 * OpenAI images. Model ids and rates verified against the live model list and the published pricing page on
 * 2026-07-29: gpt-image-2 is the current flagship, gpt-image-1.5 / gpt-image-1 / the dall-e ids are superseded
 * generations that the no-legacy-models rule forbids defaulting to or accepting.
 */
export declare const OPENAI_PROVIDER: ProviderSpec;
/**
 * Nano Banana - Google's Gemini image family, added on the CEO's instruction 2026-07-29 with
 * github.com/kkoppenhaver/cc-nano-banana as the naming and env-var reference.
 *
 * Two deliberate divergences from that reference, both required by standing rules here:
 *   - It defaults to gemini-2.5-flash-image. Google's own pricing and model pages list that id as the LEGACY
 *     option, superseded by the 3.1 image generation. This adapter therefore defaults to gemini-3.1-flash-image
 *     (Nano Banana 2) and REFUSES the 2.5 id outright, per the no-legacy-models rule.
 *   - The transport is `POST /v1beta/models/{model}:generateContent`, chosen from EVIDENCE rather than from a
 *     documentation page. Google's current image-generation docs describe a newer `/v1beta/interactions` surface
 *     with a `response_format` block, and this adapter was first built against it. A free capability probe of the
 *     authorized key (`GET /v1beta/models/{model}`) reported `supportedGenerationMethods:
 *     ['generateContent','countTokens','batchGenerateContent']` and no interactions support, so the documented
 *     surface is not what this key serves. Building for the documented shape would have spent the single
 *     authorized live call on a 404. The lesson is worth keeping: probe the endpoint for free before spending on
 *     it, and let the account's own answer outrank the docs.
 * NANOBANANA_GEMINI_API_KEY and NANOBANANA_MODEL are honored so an existing setup keeps working, with this
 * repo's own SIDECOACH_* names taking precedence and the generic GEMINI_API_KEY / GOOGLE_API_KEY as fallbacks.
 */
export declare const NANOBANANA_PROVIDER: ProviderSpec;
export declare const PROVIDERS: Record<string, ProviderSpec>;
/** Order the `auto` chain walks. First entry is preferred; every provider is attempted before giving up. */
export declare const AUTO_CHAIN: string[];
/** The offline renderer's pseudo-provider id. It is never part of AUTO_CHAIN, by design. */
export declare const OFFLINE_PROVIDER_ID = "offline";
export declare const OFFLINE_MODEL_ID = "sidecoach-offline-v1";
export interface ResolveOutcome<T> {
    value?: T;
    failure?: ProviderFailure;
}
export declare function resolveKey(spec: ProviderSpec, env: Record<string, string | undefined>): ResolveOutcome<string>;
export declare function resolveModel(spec: ProviderSpec, env: Record<string, string | undefined>, explicit?: string): ResolveOutcome<string>;
/** Local, pre-network validation of the request against the provider's documented limits. */
export declare function validateRequest(spec: ProviderSpec, req: ImageRequest): ProviderFailure | null;
export interface CostFigure {
    usd: number;
    /**
     * How the number was arrived at. Every figure this module emits carries its basis so a reader can tell a
     * measured cost from a projection from an operator's declaration. There is no unlabelled dollar figure.
     */
    /**
     * How the number was arrived at. `unmetered-projection` is the honest label for the one uncomfortable case:
     * a call COMPLETED, so money moved, but the provider reported no usable token usage, so the recorded figure
     * is the pre-call projection rather than a measurement. It is labelled distinctly rather than quietly filed
     * alongside measured costs. Codex review 2026-07-29, spend finding 1.
     */
    basis: 'published-per-image' | 'operator-declared' | 'usage-derived' | 'unmetered-projection' | 'cache-hit' | 'offline';
    detail: string;
}
/**
 * Project the cost of a call BEFORE making it, for the cap check and the consent statement.
 *
 * Returns null when neither a published per-image figure nor an operator declaration is available. A null
 * projection is a refusal to spend (EXIT.UNPRICED), not a zero.
 */
export declare function projectCost(spec: ProviderSpec, req: ImageRequest, declaredUsd?: number): CostFigure | null;
/**
 * Compute the ACTUAL cost from the token counts the provider reported. Returns null when the provider reported
 * no usage or no rate is on record - in which case the caller reports the spend as unmetered rather than
 * printing a fiction.
 */
export declare function actualCost(spec: ProviderSpec, model: string, usage: {
    inputTokens?: number;
    outputTokens?: number;
} | null): CostFigure | null;
/** The line stated before the first live call of a session. Spend is never silent. */
export declare function costStatement(spec: ProviderSpec, req: ImageRequest, projection: CostFigure): string;
export interface LedgerEntry {
    ts: string;
    provider: string;
    model: string;
    size: string;
    quality: string;
    usd: number;
    basis: CostFigure['basis'];
    cacheKey: string;
}
/**
 * A live request that was ISSUED and then failed. These carry NO cost figure and live in their own array so they
 * can never move the ledger total. They exist because "the request went out and errored" is a different fact
 * from "no request was made", and if a provider ever bills for a refusal this is the record to reconcile an
 * invoice against. Codex re-review 2026-07-29, finding 2.
 */
export interface LedgerAttempt {
    ts: string;
    provider: string;
    model?: string;
    size?: string;
    quality?: string;
    kind: string;
    status?: number | null;
    detail?: string;
    transport?: string;
}
export interface Ledger {
    version: 1;
    entries: LedgerEntry[];
    attempts?: LedgerAttempt[];
}
export declare const EMPTY_LEDGER: Ledger;
export declare function ledgerTotal(ledger: Ledger): number;
export interface BudgetCaps {
    /** Max spend for this invocation. */
    runUsd?: number;
    /** Max cumulative spend recorded in the ledger, including this call. */
    totalUsd?: number;
}
/**
 * Decide whether a cost fits the caps.
 *
 * Called TWICE per live call. Before the request with the PROJECTION, where a rejection costs nothing and is the
 * real gate. And again after the response with the MEASURED cost, because a projection can under-declare: an
 * operator-supplied ceiling that turns out too low would otherwise let a call quietly settle above the cap. The
 * money is already gone by then, so the second call cannot prevent anything - it exists so the overrun is
 * REPORTED loudly and the cumulative cap blocks the next call. Codex review 2026-07-29, spend finding 3.
 *
 * The epsilon keeps float noise from rejecting a call that exactly meets its cap.
 */
export declare function budgetCheck(projection: CostFigure, caps: BudgetCaps, spentThisRun: number, ledger: Ledger): ProviderFailure | null;
/**
 * Bumping this invalidates every cached asset. Bump it when a change makes previously cached bytes no longer
 * the right answer for the same request (a changed provider payload, a changed offline renderer).
 */
export declare const CACHE_VERSION = "v1";
/** The canonical, stably-ordered form of a request. Two requests with the same canonical form are the same. */
export declare function canonicalRequest(req: ImageRequest): string;
export declare function cacheKey(req: ImageRequest): string;
/**
 * Render a deterministic PNG from the request alone: a two-stop gradient field, a set of hash-placed discs, a
 * horizon band, and a swatch strip that encodes the leading hash bytes.
 *
 * This is not a gray box. It has real structure, dozens of colors, and genuine edge energy, so it exercises the
 * verifier's not-blank detectors honestly instead of being waved past them, and it reads at a glance as a
 * placeholder rather than as art. Every value derives from sha256(canonical request): no clock, no RNG, no
 * ambient state, so the same request yields byte-identical output forever.
 */
export declare function renderOfflinePng(req: ImageRequest): Buffer;
/**
 * The injectable HTTP surface. Narrow on purpose: a status, a body string, and nothing else, so the suite can
 * drive every provider adapter and every failure class with no network and no key.
 */
export type Transport = (url: string, init: Record<string, unknown>) => Promise<{
    status: number;
    body: string;
}>;
/** The real transport. Node 18+ ships fetch; a missing global is a loud failure, not a silent skip. */
export declare const nodeFetchTransport: Transport;
/**
 * Strip anything key-shaped out of a message before it can be printed, logged, or written to a result file.
 *
 * This exists because of a real event on 2026-07-29: a rejected OpenAI key came back with the provider's own
 * partially-masked value inside the error message, and that message went straight to stderr. Provider-side
 * masking is not this tool's masking to rely on, and the standing instruction is that a key must never reach a
 * log line. The masked form is matched too, since a mask that preserves a tail still leaks the tail.
 */
export declare function redactSecrets(text: string): string;
/** Issue one provider call. Never throws: a transport error comes back as a classified network failure. */
export declare function callProvider(spec: ProviderSpec, req: ImageRequest, key: string, transport: Transport): Promise<ProviderResult>;
//# sourceMappingURL=image-generation.d.ts.map