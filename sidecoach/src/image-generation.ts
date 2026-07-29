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

import { createHash } from 'crypto';
import { encodePng } from './image-png-codec';
import { SYNTHETIC_MARKER_KEY } from './image-asset-verify';

// ---------------------------------------------------------------------------
// Exit contract. One code per failure class - a caller can branch on the reason without parsing prose, and no
// two unrelated failures share a code.
// ---------------------------------------------------------------------------

export const EXIT = {
  /** Asset produced AND every contracted check passed. */
  OK: 0,
  /** Asset produced, a check FAILED (wrong size, blank render, contrast too low, laundered placeholder). */
  VERIFY_FAILED: 1,
  /** Bad arguments, unreadable input, missing build. Nothing was attempted. */
  USAGE: 2,
  /** Asset produced but a contracted check COULD NOT RUN. Never reported as verified. */
  UNVERIFIED: 3,
  /** A live provider was requested and no API key is present. Nothing was spent. */
  NO_KEY: 4,
  /** No resolvable model id for the provider. Refuses to guess one. */
  NO_MODEL: 5,
  /** Every provider in the chain failed (HTTP error, refusal, empty or malformed payload). */
  PROVIDER: 6,
  /** Projected or cumulative spend exceeds the cap. Checked BEFORE the request; nothing was spent. */
  BUDGET: 7,
  /** A live call was requested without the explicit spend signal. Nothing was spent. */
  NEEDS_CONSENT: 8,
  /** Reading or writing a file failed. */
  IO: 9,
  /** A live call whose cost cannot be established from the price record or an operator declaration. */
  UNPRICED: 10,
  /** The request exceeds the provider's documented limits (size, quality, prompt length). Checked locally. */
  OVERSIZE: 11,
  /** The resolved model id is a superseded generation. The standing no-legacy-models rule forbids it. */
  LEGACY_MODEL: 12,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

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

export function parseSize(size: string): { width: number; height: number } | null {
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(size.trim());
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (width < 16 || height < 16) return null;
  return { width, height };
}

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

export type FailureKind =
  | 'no-key'
  | 'no-model'
  | 'legacy-model'
  | 'oversize'
  | 'unpriced'
  | 'budget'
  | 'http'
  | 'refusal'
  | 'empty'
  | 'malformed'
  | 'network';

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
  usage: { inputTokens?: number; outputTokens?: number } | null;
  status: number;
}

export type ProviderResult = ProviderSuccess | ({ ok: false } & ProviderFailure);

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
  buildRequest(req: ImageRequest, key: string): { url: string; init: Record<string, unknown> };
  parseResponse(status: number, body: string): ProviderResult | { ok: false } & ProviderFailure;
}

/** Bucket a pixel size into the resolution tier the published per-image prices are quoted against. */
export function resolutionBucket(size: string): string {
  const dims = parseSize(size);
  if (!dims) return 'unknown';
  const max = Math.max(dims.width, dims.height);
  if (max <= 512) return '0.5K';
  if (max <= 1024) return '1K';
  if (max <= 2048) return '2K';
  return '4K';
}

/** Reduce a pixel size to the closest documented Gemini aspect ratio. */
export function aspectRatioFor(size: string): string {
  const dims = parseSize(size);
  if (!dims) return '1:1';
  const candidates: Array<[string, number]> = [
    ['1:1', 1],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
    ['2:3', 2 / 3],
    ['3:2', 3 / 2],
    ['5:4', 5 / 4],
    ['4:5', 4 / 5],
    ['21:9', 21 / 9],
  ];
  const want = dims.width / dims.height;
  let best = candidates[0];
  for (const c of candidates) if (Math.abs(c[1] - want) < Math.abs(best[1] - want)) best = c;
  return best[0];
}

function jsonBody(status: number, body: string): { ok: true; value: unknown } | ({ ok: false } & ProviderFailure) {
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, kind: 'malformed', provider: '', detail: `response was not JSON (status ${status}, ${body.length} bytes)`, status };
  }
}

/** Pull a nested string without trusting any shape. */
function pick(obj: unknown, path: Array<string | number>): unknown {
  let cur: unknown = obj;
  for (const seg of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[seg as string];
  }
  return cur;
}

/**
 * OpenAI images. Model ids and rates verified against the live model list and the published pricing page on
 * 2026-07-29: gpt-image-2 is the current flagship, gpt-image-1.5 / gpt-image-1 / the dall-e ids are superseded
 * generations that the no-legacy-models rule forbids defaulting to or accepting.
 */
export const OPENAI_PROVIDER: ProviderSpec = {
  id: 'openai',
  label: 'OpenAI Images',
  keyEnv: ['SIDECOACH_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  modelEnv: 'SIDECOACH_IMAGE_MODEL_OPENAI',
  modelDefault: 'gpt-image-2',
  legacyModels: ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-1.5', 'dall-e-2', 'dall-e-3'],
  sizes: ['1024x1024', '1024x1536', '1536x1024'],
  qualities: ['low', 'medium', 'high'],
  maxPromptChars: 32000,
  tokenRates: {
    'gpt-image-2': { imageInput: 8.0, output: 30.0 },
  },
  // No per-image figure is published for this family; the projection therefore requires an operator
  // declaration rather than a number invented here. See projectCost.
  perImageUsd: {},
  priceSource: 'developers.openai.com/api/docs/pricing, read 2026-07-29: gpt-image-2 image input 8.00, output 30.00 per 1M tokens',
  buildRequest(req, key) {
    return {
      url: 'https://api.openai.com/v1/images/generations',
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: req.model,
          prompt: req.prompt,
          size: req.size,
          quality: req.quality,
          output_format: req.format,
          n: 1,
        }),
      },
    };
  },
  parseResponse(status, body) {
    const parsed = jsonBody(status, body);
    if (!parsed.ok) return { ...parsed, provider: 'openai' };
    const value = parsed.value;
    if (status < 200 || status >= 300) {
      const msg = pick(value, ['error', 'message']);
      const code = pick(value, ['error', 'code']);
      const detail = typeof msg === 'string' ? msg : `HTTP ${status}`;
      // A content refusal is a distinct outcome from an outage: retrying the same prompt elsewhere may also be
      // refused, and the operator needs to know which happened.
      const kind: FailureKind = typeof code === 'string' && /moderation|safety|content_policy/i.test(code) ? 'refusal' : 'http';
      return { ok: false, kind, provider: 'openai', detail, status };
    }
    const b64 = pick(value, ['data', 0, 'b64_json']);
    if (typeof b64 !== 'string' || b64.length === 0) {
      return { ok: false, kind: 'empty', provider: 'openai', detail: 'response carried no data[0].b64_json', status };
    }
    const inputTokens = pick(value, ['usage', 'input_tokens']);
    const outputTokens = pick(value, ['usage', 'output_tokens']);
    return {
      ok: true,
      provider: 'openai',
      model: typeof pick(value, ['model']) === 'string' ? (pick(value, ['model']) as string) : '',
      bytes: Buffer.from(b64, 'base64'),
      mime: 'image/png',
      usage:
        typeof inputTokens === 'number' || typeof outputTokens === 'number'
          ? {
              inputTokens: typeof inputTokens === 'number' ? inputTokens : undefined,
              outputTokens: typeof outputTokens === 'number' ? outputTokens : undefined,
            }
          : null,
      status,
    };
  },
};

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
export const NANOBANANA_PROVIDER: ProviderSpec = {
  id: 'nanobanana',
  label: 'Nano Banana (Google Gemini image)',
  keyEnv: ['SIDECOACH_NANOBANANA_API_KEY', 'NANOBANANA_GEMINI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  modelEnv: 'SIDECOACH_IMAGE_MODEL_NANOBANANA',
  modelDefault: 'gemini-3.1-flash-image',
  legacyModels: ['gemini-2.5-flash-image', 'gemini-2.0-flash-image', 'gemini-2.0-flash-preview-image-generation'],
  sizes: null,
  qualities: ['low', 'medium', 'high'],
  maxPromptChars: 32000,
  tokenRates: {
    'gemini-3.1-flash-image': { imageInput: 0.3, output: 60.0 },
    'gemini-3.1-flash-lite-image': { imageInput: 0.3, output: 30.0 },
    'gemini-3-pro-image': { imageInput: 2.0, output: 120.0 },
  },
  perImageUsd: {
    'gemini-3.1-flash-image': { '0.5K': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
    'gemini-3.1-flash-lite-image': { '1K': 0.0336 },
    'gemini-3-pro-image': { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
  },
  priceSource: 'ai.google.dev/gemini-api/docs/pricing, read 2026-07-29: per-image equivalents by resolution tier',
  buildRequest(req, key) {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: req.prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: aspectRatioFor(req.size), imageSize: resolutionBucket(req.size) },
          },
        }),
      },
    };
  },
  parseResponse(status, body) {
    const parsed = jsonBody(status, body);
    if (!parsed.ok) return { ...parsed, provider: 'nanobanana' };
    const value = parsed.value;
    if (status < 200 || status >= 300) {
      const msg = pick(value, ['error', 'message']);
      const st = pick(value, ['error', 'status']);
      const detail = typeof msg === 'string' ? msg : `HTTP ${status}`;
      const kind: FailureKind = typeof st === 'string' && /BLOCK|SAFETY|PROHIBIT/i.test(st) ? 'refusal' : 'http';
      return { ok: false, kind, provider: 'nanobanana', detail, status };
    }
    // LIVE path first: generateContent returns the image as inlineData on a candidate part. The two
    // interactions-surface shapes are kept after it because the documentation describes them and a key that
    // serves that surface would answer in one of them; they are fallbacks, not the primary.
    let b64: unknown;
    let mime = 'image/png';
    const candidates = pick(value, ['candidates']);
    if (Array.isArray(candidates)) {
      for (const candidate of candidates) {
        const parts = pick(candidate, ['content', 'parts']);
        if (!Array.isArray(parts)) continue;
        for (const part of parts) {
          const data = pick(part, ['inlineData', 'data']) ?? pick(part, ['inline_data', 'data']);
          if (typeof data === 'string' && data.length > 0) {
            b64 = data;
            const m = pick(part, ['inlineData', 'mimeType']) ?? pick(part, ['inline_data', 'mime_type']);
            if (typeof m === 'string' && m.length > 0) mime = m;
            break;
          }
        }
        if (typeof b64 === 'string') break;
      }
    }
    if (typeof b64 !== 'string') b64 = pick(value, ['output_image', 'data']);
    if (typeof b64 !== 'string') {
      const steps = pick(value, ['steps']);
      if (Array.isArray(steps)) {
        for (const step of steps) {
          const content = pick(step, ['content']);
          if (!Array.isArray(content)) continue;
          for (const part of content) {
            if (pick(part, ['type']) === 'image' && typeof pick(part, ['data']) === 'string') {
              b64 = pick(part, ['data']);
              break;
            }
          }
          if (typeof b64 === 'string') break;
        }
      }
    }
    if (typeof b64 !== 'string' || b64.length === 0) {
      // A refusal is a distinct outcome from an empty payload, and Gemini reports it in three places.
      const blocked =
        pick(value, ['promptFeedback', 'blockReason']) ??
        pick(value, ['prompt_feedback', 'block_reason']) ??
        pick(value, ['candidates', 0, 'finishReason']);
      if (typeof blocked === 'string' && /BLOCK|SAFETY|PROHIBIT|RECITATION/i.test(blocked)) {
        return { ok: false, kind: 'refusal', provider: 'nanobanana', detail: `blocked: ${blocked}`, status };
      }
      const finish = pick(value, ['candidates', 0, 'finishReason']);
      return {
        ok: false,
        kind: 'empty',
        provider: 'nanobanana',
        detail: `response carried no image payload${typeof finish === 'string' ? ` (finishReason ${finish})` : ''}`,
        status,
      };
    }
    // usageMetadata is the generateContent shape; usage.{input,output}_tokens is the interactions shape.
    const inputTokens = pick(value, ['usageMetadata', 'promptTokenCount']) ?? pick(value, ['usage', 'input_tokens']);
    const outputTokens = pick(value, ['usageMetadata', 'candidatesTokenCount']) ?? pick(value, ['usage', 'output_tokens']);
    const reportedModel = pick(value, ['modelVersion']) ?? pick(value, ['model']);
    return {
      ok: true,
      provider: 'nanobanana',
      model: typeof reportedModel === 'string' ? reportedModel : '',
      bytes: Buffer.from(b64, 'base64'),
      mime,
      usage:
        typeof inputTokens === 'number' || typeof outputTokens === 'number'
          ? {
              inputTokens: typeof inputTokens === 'number' ? inputTokens : undefined,
              outputTokens: typeof outputTokens === 'number' ? outputTokens : undefined,
            }
          : null,
      status,
    };
  },
};

export const PROVIDERS: Record<string, ProviderSpec> = {
  openai: OPENAI_PROVIDER,
  nanobanana: NANOBANANA_PROVIDER,
};

/** Order the `auto` chain walks. First entry is preferred; every provider is attempted before giving up. */
export const AUTO_CHAIN: string[] = ['openai', 'nanobanana'];

/** The offline renderer's pseudo-provider id. It is never part of AUTO_CHAIN, by design. */
export const OFFLINE_PROVIDER_ID = 'offline';
export const OFFLINE_MODEL_ID = 'sidecoach-offline-v1';

// ---------------------------------------------------------------------------
// Key and model resolution
// ---------------------------------------------------------------------------

export interface ResolveOutcome<T> {
  value?: T;
  failure?: ProviderFailure;
}

export function resolveKey(spec: ProviderSpec, env: Record<string, string | undefined>): ResolveOutcome<string> {
  for (const name of spec.keyEnv) {
    const v = env[name];
    if (typeof v === 'string' && v.trim().length > 0) return { value: v.trim() };
  }
  return {
    failure: {
      kind: 'no-key',
      provider: spec.id,
      detail: `no API key: set one of ${spec.keyEnv.join(', ')}`,
    },
  };
}

export function resolveModel(
  spec: ProviderSpec,
  env: Record<string, string | undefined>,
  explicit?: string,
): ResolveOutcome<string> {
  const legacyAliases: Record<string, string> = { NANOBANANA_MODEL: 'nanobanana' };
  let model = explicit && explicit.trim().length > 0 ? explicit.trim() : undefined;
  if (!model) {
    const fromEnv = env[spec.modelEnv];
    if (typeof fromEnv === 'string' && fromEnv.trim()) model = fromEnv.trim();
  }
  if (!model) {
    for (const [name, provider] of Object.entries(legacyAliases)) {
      if (provider !== spec.id) continue;
      const v = env[name];
      if (typeof v === 'string' && v.trim()) model = v.trim();
    }
  }
  if (!model) model = spec.modelDefault ?? undefined;
  if (!model) {
    return {
      failure: {
        kind: 'no-model',
        provider: spec.id,
        detail: `no model id: pass --model or set ${spec.modelEnv} (this provider has no default, and guessing one is forbidden)`,
      },
    };
  }
  if (spec.legacyModels.includes(model)) {
    return {
      failure: {
        kind: 'legacy-model',
        provider: spec.id,
        detail: `${model} is a superseded generation; the no-legacy-models rule forbids it. Current default: ${spec.modelDefault ?? '(none)'}`,
      },
    };
  }
  return { value: model };
}

/** Local, pre-network validation of the request against the provider's documented limits. */
export function validateRequest(spec: ProviderSpec, req: ImageRequest): ProviderFailure | null {
  if (req.prompt.trim().length === 0) {
    return { kind: 'oversize', provider: spec.id, detail: 'prompt is empty' };
  }
  if (req.prompt.length > spec.maxPromptChars) {
    return {
      kind: 'oversize',
      provider: spec.id,
      detail: `prompt is ${req.prompt.length} chars, limit is ${spec.maxPromptChars}`,
    };
  }
  if (!parseSize(req.size)) {
    return { kind: 'oversize', provider: spec.id, detail: `unparseable size ${JSON.stringify(req.size)}` };
  }
  if (spec.sizes && !spec.sizes.includes(req.size)) {
    return {
      kind: 'oversize',
      provider: spec.id,
      detail: `${spec.id} accepts ${spec.sizes.join(', ')}; got ${req.size}`,
    };
  }
  if (!spec.qualities.includes(req.quality)) {
    return {
      kind: 'oversize',
      provider: spec.id,
      detail: `${spec.id} accepts quality ${spec.qualities.join(', ')}; got ${req.quality}`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cost: projection before the call, actual after it
// ---------------------------------------------------------------------------

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
export function projectCost(spec: ProviderSpec, req: ImageRequest, declaredUsd?: number): CostFigure | null {
  const bucket = resolutionBucket(req.size);
  const published = spec.perImageUsd[req.model] && spec.perImageUsd[req.model][bucket];
  if (typeof published === 'number') {
    return {
      usd: published,
      basis: 'published-per-image',
      detail: `${spec.id}/${req.model} at ${bucket} (${spec.priceSource})`,
    };
  }
  if (typeof declaredUsd === 'number' && Number.isFinite(declaredUsd) && declaredUsd >= 0) {
    return {
      usd: declaredUsd,
      basis: 'operator-declared',
      detail: `no published per-image figure for ${spec.id}/${req.model} at ${bucket}; operator declared this ceiling`,
    };
  }
  return null;
}

/**
 * Compute the ACTUAL cost from the token counts the provider reported. Returns null when the provider reported
 * no usage or no rate is on record - in which case the caller reports the spend as unmetered rather than
 * printing a fiction.
 */
export function actualCost(spec: ProviderSpec, model: string, usage: { inputTokens?: number; outputTokens?: number } | null): CostFigure | null {
  if (!usage) return null;
  const rates = spec.tokenRates[model];
  if (!rates) return null;
  const inTok = usage.inputTokens ?? 0;
  const outTok = usage.outputTokens ?? 0;
  if (inTok === 0 && outTok === 0) return null;
  const usd = (inTok * rates.imageInput + outTok * rates.output) / 1e6;
  return {
    usd,
    basis: 'usage-derived',
    detail: `${inTok} input + ${outTok} output tokens at ${rates.imageInput}/${rates.output} per 1M (${spec.priceSource}); input priced at the image-input rate, a deliberate overestimate`,
  };
}

/** The line stated before the first live call of a session. Spend is never silent. */
export function costStatement(spec: ProviderSpec, req: ImageRequest, projection: CostFigure): string {
  return [
    `SPEND NOTICE: about to call ${spec.label} (${req.model}) for a ${req.size} ${req.quality}-quality image.`,
    `Projected cost for this call: ${projection.usd.toFixed(4)} USD (${projection.basis}).`,
    `Basis: ${projection.detail}`,
    'This is a real charge against the configured API key. Re-runs of an identical request are served from cache at no cost.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Budget ledger (pure math; the bin owns the file)
// ---------------------------------------------------------------------------

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

export const EMPTY_LEDGER: Ledger = { version: 1, entries: [], attempts: [] };

export function ledgerTotal(ledger: Ledger): number {
  return ledger.entries.reduce((sum, e) => sum + (Number.isFinite(e.usd) ? e.usd : 0), 0);
}

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
export function budgetCheck(
  projection: CostFigure,
  caps: BudgetCaps,
  spentThisRun: number,
  ledger: Ledger,
): ProviderFailure | null {
  const eps = 1e-9;
  if (typeof caps.runUsd === 'number' && spentThisRun + projection.usd > caps.runUsd + eps) {
    return {
      kind: 'budget',
      provider: 'budget',
      detail: `this run has spent ${spentThisRun.toFixed(4)} and the next call projects ${projection.usd.toFixed(4)}, over the per-run cap of ${caps.runUsd.toFixed(4)} USD`,
    };
  }
  if (typeof caps.totalUsd === 'number') {
    const total = ledgerTotal(ledger);
    if (total + projection.usd > caps.totalUsd + eps) {
      return {
        kind: 'budget',
        provider: 'budget',
        detail: `ledger total is ${total.toFixed(4)} and the next call projects ${projection.usd.toFixed(4)}, over the cumulative cap of ${caps.totalUsd.toFixed(4)} USD`,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Content-addressed cache key
// ---------------------------------------------------------------------------

/**
 * Bumping this invalidates every cached asset. Bump it when a change makes previously cached bytes no longer
 * the right answer for the same request (a changed provider payload, a changed offline renderer).
 */
export const CACHE_VERSION = 'v1';

/** The canonical, stably-ordered form of a request. Two requests with the same canonical form are the same. */
export function canonicalRequest(req: ImageRequest): string {
  return JSON.stringify({
    cacheVersion: CACHE_VERSION,
    format: req.format,
    model: req.model,
    prompt: req.prompt.replace(/\r\n/g, '\n').trim(),
    provider: req.provider,
    quality: req.quality,
    size: req.size,
  });
}

export function cacheKey(req: ImageRequest): string {
  return createHash('sha256').update(canonicalRequest(req)).digest('hex');
}

// ---------------------------------------------------------------------------
// The deterministic offline renderer
// ---------------------------------------------------------------------------

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255)];
}

/**
 * Render a deterministic PNG from the request alone: a two-stop gradient field, a set of hash-placed discs, a
 * horizon band, and a swatch strip that encodes the leading hash bytes.
 *
 * This is not a gray box. It has real structure, dozens of colors, and genuine edge energy, so it exercises the
 * verifier's not-blank detectors honestly instead of being waved past them, and it reads at a glance as a
 * placeholder rather than as art. Every value derives from sha256(canonical request): no clock, no RNG, no
 * ambient state, so the same request yields byte-identical output forever.
 */
export function renderOfflinePng(req: ImageRequest): Buffer {
  const dims = parseSize(req.size);
  if (!dims) throw new Error(`renderOfflinePng: unparseable size ${JSON.stringify(req.size)}`);
  const { width, height } = dims;
  const key = cacheKey(req);
  const hash = Buffer.from(key, 'hex');
  const at = (i: number) => hash[i % hash.length];

  const baseHue = (at(0) / 255) * 360;
  const topColor = hslToRgb(baseHue, 0.42 + (at(1) / 255) * 0.28, 0.16 + (at(2) / 255) * 0.14);
  const bottomColor = hslToRgb((baseHue + 40 + (at(3) / 255) * 90) % 360, 0.4 + (at(4) / 255) * 0.3, 0.52 + (at(5) / 255) * 0.2);
  const discColor = hslToRgb((baseHue + 180) % 360, 0.5 + (at(6) / 255) * 0.3, 0.55 + (at(7) / 255) * 0.2);

  const rgba = new Uint8Array(width * height * 4);
  const discCount = 3 + (at(8) % 4);
  const discs: Array<{ cx: number; cy: number; r: number }> = [];
  for (let i = 0; i < discCount; i++) {
    discs.push({
      cx: (at(9 + i * 3) / 255) * width,
      cy: (at(10 + i * 3) / 255) * height * 0.8,
      r: (0.06 + (at(11 + i * 3) / 255) * 0.16) * Math.min(width, height),
    });
  }
  const horizonY = Math.floor(height * (0.55 + (at(28) / 255) * 0.2));
  const bandThickness = Math.max(2, Math.floor(height * 0.012));
  const stripHeight = Math.max(4, Math.floor(height * 0.06));
  const stripTop = height - stripHeight;
  const cells = 16;

  for (let y = 0; y < height; y++) {
    const t = height === 1 ? 0 : y / (height - 1);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Gradient field with a fixed diagonal ripple, so no row or column is ever uniform.
      const ripple = Math.sin((x / Math.max(1, width)) * Math.PI * 3 + t * Math.PI) * 10;
      let r = topColor[0] + (bottomColor[0] - topColor[0]) * t + ripple;
      let g = topColor[1] + (bottomColor[1] - topColor[1]) * t + ripple;
      let b = topColor[2] + (bottomColor[2] - topColor[2]) * t + ripple;

      for (const d of discs) {
        const dx = x - d.cx;
        const dy = y - d.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < d.r) {
          const edge = 1 - dist / d.r;
          const w = Math.min(1, edge * 2.2);
          r = r * (1 - w) + discColor[0] * w;
          g = g * (1 - w) + discColor[1] * w;
          b = b * (1 - w) + discColor[2] * w;
        }
      }

      if (y >= horizonY && y < horizonY + bandThickness) {
        r = 255 - r * 0.2;
        g = 255 - g * 0.2;
        b = 255 - b * 0.2;
      }

      if (y >= stripTop) {
        const cell = Math.min(cells - 1, Math.floor((x / width) * cells));
        const byte = at(cell);
        const swatch = hslToRgb((byte / 255) * 360, 0.6, 0.35 + (byte % 7) * 0.05);
        r = swatch[0];
        g = swatch[1];
        b = swatch[2];
      }

      rgba[i] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
      rgba[i + 3] = 255;
    }
  }

  return encodePng(width, height, rgba, {
    text: [
      [SYNTHETIC_MARKER_KEY, 'offline-deterministic'],
      ['sidecoach-cache-key', key],
      ['sidecoach-offline-renderer', OFFLINE_MODEL_ID],
      ['Software', 'sidecoach-image'],
    ],
  });
}

// ---------------------------------------------------------------------------
// The transport
// ---------------------------------------------------------------------------

/**
 * The injectable HTTP surface. Narrow on purpose: a status, a body string, and nothing else, so the suite can
 * drive every provider adapter and every failure class with no network and no key.
 */
export type Transport = (url: string, init: Record<string, unknown>) => Promise<{ status: number; body: string }>;

/** The real transport. Node 18+ ships fetch; a missing global is a loud failure, not a silent skip. */
export const nodeFetchTransport: Transport = async (url, init) => {
  const f = (globalThis as { fetch?: (u: string, i: Record<string, unknown>) => Promise<{ status: number; text(): Promise<string> }> }).fetch;
  if (typeof f !== 'function') throw new Error('global fetch is unavailable; node 18 or newer is required');
  const res = await f(url, init);
  return { status: res.status, body: await res.text() };
};

/**
 * Strip anything key-shaped out of a message before it can be printed, logged, or written to a result file.
 *
 * This exists because of a real event on 2026-07-29: a rejected OpenAI key came back with the provider's own
 * partially-masked value inside the error message, and that message went straight to stderr. Provider-side
 * masking is not this tool's masking to rely on, and the standing instruction is that a key must never reach a
 * log line. The masked form is matched too, since a mask that preserves a tail still leaks the tail.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_*-]{6,}/g, 'sk-[REDACTED]')
    .replace(/AIza[A-Za-z0-9_*-]{10,}/g, 'AIza[REDACTED]')
    .replace(/AQ\.[A-Za-z0-9_*-]{10,}/g, 'AQ.[REDACTED]');
}

/** Issue one provider call. Never throws: a transport error comes back as a classified network failure. */
export async function callProvider(
  spec: ProviderSpec,
  req: ImageRequest,
  key: string,
  transport: Transport,
): Promise<ProviderResult> {
  const { url, init } = spec.buildRequest(req, key);
  let status = 0;
  let body = '';
  try {
    const res = await transport(url, init);
    status = res.status;
    body = res.body;
  } catch (err) {
    return { ok: false, kind: 'network', provider: spec.id, detail: redactSecrets(err instanceof Error ? err.message : String(err)) };
  }
  const parsed = spec.parseResponse(status, body);
  if (parsed.ok) return parsed;
  // Single choke point: every failure detail leaving this function is redacted, whichever adapter built it.
  return { ...parsed, provider: parsed.provider || spec.id, detail: redactSecrets(parsed.detail) };
}
