// sidecoach/src/__tests__/image-generation.test.ts
//
// Contract for src/image-generation.ts - the provider-agnostic core: key and model resolution, local request
// validation, cost projection and measurement, the budget caps, the content-addressed cache key, the
// deterministic offline renderer, and both live provider adapters driven end to end through an INJECTED
// transport so the suite needs no key, no network, and no spend.
//
// The properties that matter most:
//   1. OFFLINE IS DETERMINISTIC AND SELF-IDENTIFYING. The same request yields byte-identical PNG bytes, and
//      those bytes carry the synthetic marker so the verifier can refuse to call them a real render.
//   2. THE CHAIN NEVER DEGRADES TO A PLACEHOLDER. AUTO_CHAIN contains only real providers.
//   3. NO BLIND SPEND. An unpriced call has no projection at all, so the caller cannot proceed with a made-up
//      number; the caps reject BEFORE a request is built; and the measured cost comes from the provider's own
//      reported tokens.
//   4. NO LEGACY MODELS. A superseded id is refused by name, including the one the referenced Nano Banana
//      project defaults to.
//   5. EVERY PROVIDER FAILURE IS CLASSIFIED. http, refusal, empty, malformed and network are distinguished, so
//      a caller can tell an outage from a content refusal from a broken payload.

import {
  EXIT,
  PROVIDERS,
  AUTO_CHAIN,
  OFFLINE_PROVIDER_ID,
  OPENAI_PROVIDER,
  NANOBANANA_PROVIDER,
  canonicalRequest,
  cacheKey,
  parseSize,
  resolutionBucket,
  aspectRatioFor,
  resolveKey,
  resolveModel,
  validateRequest,
  projectCost,
  actualCost,
  costStatement,
  budgetCheck,
  ledgerTotal,
  renderOfflinePng,
  callProvider,
  redactSecrets,
  type ImageRequest,
  type ProviderSpec,
  type Transport,
} from '../image-generation';
import { verifyAsset, SYNTHETIC_MARKER_KEY } from '../image-asset-verify';
import { encodePng, decodePng } from '../image-png-codec';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const REQ: ImageRequest = {
  prompt: 'a matte clay study of a folded paper crane, single soft light',
  size: '1024x1024',
  quality: 'low',
  format: 'png',
  provider: 'openai',
  model: 'gpt-image-2',
};

function fixedTransport(status: number, body: unknown): Transport {
  return async () => ({ status, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

// ---------------------------------------------------------------------------
// 1. The exit contract and the chain
// ---------------------------------------------------------------------------

function testContract(): void {
  const codes = Object.values(EXIT);
  assert(new Set(codes).size === codes.length, 'every EXIT code is distinct, so a caller can branch on it');
  // Read through a runtime lookup on purpose: comparing the `as const` literals directly is a comparison the
  // compiler resolves, which makes the assertion unfailable. This form breaks if a code is ever renumbered,
  // which is the thing the bin's documented exit table depends on.
  const codeOf = (name: keyof typeof EXIT): number => EXIT[name];
  assert(codeOf('OK') === 0, 'success is 0');
  assert(codeOf('VERIFY_FAILED') === 1 && codeOf('UNVERIFIED') === 3, 'verify-failed and unverified are 1 and 3, as the bin documents');

  assert(AUTO_CHAIN.length >= 2, 'the fallback chain has at least two providers, which is the point of having one');
  assert(!AUTO_CHAIN.includes(OFFLINE_PROVIDER_ID), 'the chain NEVER falls back to the offline placeholder');
  for (const id of AUTO_CHAIN) assert(PROVIDERS[id] !== undefined, `chain entry ${id} is a registered provider`);
  assert(PROVIDERS.openai !== undefined && PROVIDERS.nanobanana !== undefined, 'both providers are registered');
  for (const spec of Object.values(PROVIDERS)) {
    assert(spec.keyEnv.length > 0, `${spec.id} declares at least one key env var`);
    assert(spec.priceSource.length > 20, `${spec.id} records where its prices came from`);
    assert(spec.legacyModels.length > 0, `${spec.id} names the superseded ids it refuses`);
  }
}

// ---------------------------------------------------------------------------
// 2. Canonicalization and the cache key
// ---------------------------------------------------------------------------

function testCacheKey(): void {
  const a = cacheKey(REQ);
  assert(a === cacheKey({ ...REQ }), 'the same request yields the same key');
  assert(/^[0-9a-f]{64}$/.test(a), 'the key is a sha256 hex digest');

  // Field order in the literal must not matter; the canonical form is sorted.
  const reordered: ImageRequest = { model: REQ.model, provider: REQ.provider, quality: REQ.quality, format: REQ.format, size: REQ.size, prompt: REQ.prompt };
  assert(cacheKey(reordered) === a, 'the key is independent of object key order');

  // Whitespace normalization: a CRLF prompt and a padded prompt are the same request.
  assert(cacheKey({ ...REQ, prompt: `  ${REQ.prompt.replace(/\n/g, '\r\n')}  ` }) === a, 'CRLF and surrounding whitespace normalize');

  // Every semantic field changes the key.
  const variants: Array<[string, ImageRequest]> = [
    ['prompt', { ...REQ, prompt: `${REQ.prompt} at night` }],
    ['size', { ...REQ, size: '1536x1024' }],
    ['quality', { ...REQ, quality: 'high' }],
    ['format', { ...REQ, format: 'webp' }],
    ['model', { ...REQ, model: 'gpt-image-2-2026-04-21' }],
    ['provider', { ...REQ, provider: 'nanobanana' }],
  ];
  for (const [label, v] of variants) {
    assert(cacheKey(v) !== a, `changing ${label} changes the cache key`);
  }
  assert(canonicalRequest(REQ).includes('"cacheVersion"'), 'the canonical form is version-stamped so a semantic change can invalidate it');

  assert(parseSize('1024x1024') !== null, 'a WxH size parses');
  assert(parseSize('1024') === null && parseSize('1024x') === null && parseSize('8x8') === null, 'a malformed or absurdly small size is rejected');
  assert(resolutionBucket('512x512') === '0.5K', '512 buckets to 0.5K');
  assert(resolutionBucket('1024x1024') === '1K' && resolutionBucket('1024x1536') === '2K', 'the bucket follows the LONGEST edge');
  assert(resolutionBucket('2048x2048') === '2K' && resolutionBucket('4096x2048') === '4K', 'the upper buckets are right');
  assert(resolutionBucket('nonsense') === 'unknown', 'an unparseable size buckets to unknown rather than to a priced tier');
  assert(aspectRatioFor('1024x1024') === '1:1', 'a square maps to 1:1');
  assert(aspectRatioFor('1536x1024') === '3:2' && aspectRatioFor('1024x1536') === '2:3', 'portrait and landscape map to their own ratios');
  assert(aspectRatioFor('1920x1080') === '16:9', 'widescreen maps to 16:9');
}

// ---------------------------------------------------------------------------
// 3. The offline renderer
// ---------------------------------------------------------------------------

function testOffline(): void {
  const req: ImageRequest = { ...REQ, provider: OFFLINE_PROVIDER_ID, model: 'sidecoach-offline-v1', size: '256x192' };
  const first = renderOfflinePng(req);
  const second = renderOfflinePng({ ...req });
  assert(first.equals(second), 'the offline renderer is byte-deterministic for an identical request');

  const other = renderOfflinePng({ ...req, prompt: `${req.prompt}, but colder` });
  assert(!first.equals(other), 'a different prompt renders different bytes');

  const decoded = decodePng(first);
  assert(decoded.ok, 'the offline render is a decodable PNG');
  if (decoded.ok) {
    assert(decoded.width === 256 && decoded.height === 192, 'the offline render honors the requested geometry');
    assert(decoded.text[SYNTHETIC_MARKER_KEY] === 'offline-deterministic', 'the offline render stamps the synthetic marker into its bytes');
    assert(decoded.text['sidecoach-cache-key'] === cacheKey(req), 'the marker records the cache key that produced it');
  }

  // It must survive the real verifier as an honestly-declared placeholder, and fail as a claimed real render.
  const honest = verifyAsset(first, { format: 'png', width: 256, height: 192, expectSynthetic: true });
  assert(honest.verdict === 'verified', `the offline render verifies when declared synthetic (got ${honest.verdict})`);
  const laundered = verifyAsset(first, { format: 'png', width: 256, height: 192 });
  assert(laundered.verdict === 'failed', 'the offline render fails when claimed as a real provider render');

  // It is not a flat placeholder: it has to clear the same blank detectors a real asset does.
  assert(honest.pixels !== null && honest.pixels.uniqueColors > 100, `the placeholder has real color variety (${honest.pixels?.uniqueColors})`);
  assert(honest.pixels!.edgeDensity > 0, 'the placeholder has real edge energy');

  let threw = false;
  try {
    renderOfflinePng({ ...req, size: 'not-a-size' });
  } catch {
    threw = true;
  }
  assert(threw, 'an unparseable size throws rather than rendering something arbitrary');
}

// ---------------------------------------------------------------------------
// 4. Key and model resolution
// ---------------------------------------------------------------------------

function testResolution(): void {
  const found = resolveKey(OPENAI_PROVIDER, { OPENAI_API_KEY: 'sk-second-choice' });
  assert(found.value === 'sk-second-choice', 'a key is found from a later env var in the list');
  const preferred = resolveKey(OPENAI_PROVIDER, { SIDECOACH_OPENAI_API_KEY: 'sk-first', OPENAI_API_KEY: 'sk-second' });
  assert(preferred.value === 'sk-first', 'the first env var in the list wins');
  const blank = resolveKey(OPENAI_PROVIDER, { OPENAI_API_KEY: '   ' });
  assert(blank.value === undefined && blank.failure!.kind === 'no-key', 'a whitespace-only key is no key');
  const missing = resolveKey(NANOBANANA_PROVIDER, {});
  assert(missing.failure!.kind === 'no-key' && /NANOBANANA_GEMINI_API_KEY/.test(missing.failure!.detail), 'the no-key message names the env vars to set');

  assert(resolveModel(OPENAI_PROVIDER, {}).value === 'gpt-image-2', 'openai defaults to the current flagship');
  assert(resolveModel(NANOBANANA_PROVIDER, {}).value === 'gemini-3.1-flash-image', 'nanobanana defaults to the current flagship');
  assert(resolveModel(OPENAI_PROVIDER, { SIDECOACH_IMAGE_MODEL_OPENAI: 'gpt-image-2-2026-04-21' }).value === 'gpt-image-2-2026-04-21', 'the env override is honored');
  assert(resolveModel(OPENAI_PROVIDER, { SIDECOACH_IMAGE_MODEL_OPENAI: 'from-env' }, 'from-flag').value === 'from-flag', 'an explicit model beats the env override');
  assert(resolveModel(NANOBANANA_PROVIDER, { NANOBANANA_MODEL: 'gemini-3-pro-image' }).value === 'gemini-3-pro-image', "the referenced project's NANOBANANA_MODEL var is honored");
  assert(
    resolveModel(NANOBANANA_PROVIDER, { SIDECOACH_IMAGE_MODEL_NANOBANANA: 'gemini-3-pro-image', NANOBANANA_MODEL: 'gemini-3.1-flash-lite-image' }).value === 'gemini-3-pro-image',
    "this repo's own env var takes precedence over the imported one",
  );

  // The legacy refusal, including the exact id the referenced Nano Banana project defaults to.
  const legacyNb = resolveModel(NANOBANANA_PROVIDER, {}, 'gemini-2.5-flash-image');
  assert(legacyNb.value === undefined && legacyNb.failure!.kind === 'legacy-model', 'gemini-2.5-flash-image is refused as superseded');
  assert(/gemini-3.1-flash-image/.test(legacyNb.failure!.detail), 'the refusal names the current default to use instead');
  for (const id of ['gpt-image-1', 'gpt-image-1.5', 'dall-e-3']) {
    assert(resolveModel(OPENAI_PROVIDER, {}, id).failure!.kind === 'legacy-model', `${id} is refused as superseded`);
  }
  assert(resolveModel(NANOBANANA_PROVIDER, { NANOBANANA_MODEL: 'gemini-2.5-flash-image' }).failure!.kind === 'legacy-model', 'a legacy id arriving through the imported env var is still refused');

  // A provider with no default refuses to guess one.
  const noDefault: ProviderSpec = { ...OPENAI_PROVIDER, id: 'hypothetical', modelDefault: null, modelEnv: 'HYPOTHETICAL_MODEL' };
  const guessed = resolveModel(noDefault, {});
  assert(guessed.value === undefined && guessed.failure!.kind === 'no-model', 'a provider with no default returns no-model rather than guessing');
  assert(/HYPOTHETICAL_MODEL/.test(guessed.failure!.detail), 'the no-model message names the env var that would fix it');
}

// ---------------------------------------------------------------------------
// 5. Local request validation, before any network
// ---------------------------------------------------------------------------

function testValidation(): void {
  assert(validateRequest(OPENAI_PROVIDER, REQ) === null, 'a well-formed openai request validates');
  assert(validateRequest(OPENAI_PROVIDER, { ...REQ, prompt: '   ' })!.detail === 'prompt is empty', 'an empty prompt is rejected');
  const long = validateRequest(OPENAI_PROVIDER, { ...REQ, prompt: 'x'.repeat(OPENAI_PROVIDER.maxPromptChars + 1) });
  assert(long !== null && long.kind === 'oversize', 'an over-length prompt is rejected locally');
  const badSize = validateRequest(OPENAI_PROVIDER, { ...REQ, size: '4096x4096' });
  assert(badSize !== null && badSize.kind === 'oversize' && /1024x1024/.test(badSize.detail), 'an unsupported openai size is rejected and the supported list is named');
  assert(validateRequest(NANOBANANA_PROVIDER, { ...REQ, size: '1408x768', provider: 'nanobanana' }) === null, 'nanobanana accepts arbitrary geometry');
  const badQuality = validateRequest(OPENAI_PROVIDER, { ...REQ, quality: 'ultra' });
  assert(badQuality !== null && badQuality.kind === 'oversize', 'an unknown quality label is rejected');
  assert(validateRequest(NANOBANANA_PROVIDER, { ...REQ, size: '8x8' })!.kind === 'oversize', 'an unparseable size is rejected even where geometry is free');
}

// ---------------------------------------------------------------------------
// 6. Cost: projection, measurement, and the caps
// ---------------------------------------------------------------------------

function testCost(): void {
  // Published per-image figure, no operator input needed.
  const nb: ImageRequest = { ...REQ, provider: 'nanobanana', model: 'gemini-3.1-flash-image' };
  const published = projectCost(NANOBANANA_PROVIDER, nb);
  assert(published !== null && published.basis === 'published-per-image', 'a published per-image price is used directly');
  assert(published!.usd === 0.067, `1K nano banana is 0.067 USD, got ${published!.usd}`);
  assert(projectCost(NANOBANANA_PROVIDER, { ...nb, size: '2048x2048' })!.usd === 0.101, 'the 2K tier is priced separately');

  // No published per-image figure: the projection is null, which is a refusal, not a zero.
  assert(projectCost(OPENAI_PROVIDER, REQ) === null, 'an unpriced call has NO projection rather than a fabricated one');
  const declared = projectCost(OPENAI_PROVIDER, REQ, 0.08);
  assert(declared !== null && declared.basis === 'operator-declared' && declared.usd === 0.08, 'an operator-declared ceiling is used and labelled as such');
  assert(projectCost(OPENAI_PROVIDER, REQ, -1) === null, 'a negative declaration is not accepted');
  assert(projectCost(OPENAI_PROVIDER, REQ, Number.NaN) === null, 'a non-finite declaration is not accepted');

  // Measured cost from real reported tokens: 1000 input at 8.00/1M plus 300 output at 30.00/1M.
  const measured = actualCost(OPENAI_PROVIDER, 'gpt-image-2', { inputTokens: 1000, outputTokens: 300 });
  assert(measured !== null && measured.basis === 'usage-derived', 'reported usage produces a usage-derived figure');
  const expected = (1000 * 8.0 + 300 * 30.0) / 1e6;
  assert(Math.abs(measured!.usd - expected) < 1e-12, `the measured cost is ${expected}, got ${measured!.usd}`);
  assert(actualCost(OPENAI_PROVIDER, 'gpt-image-2', null) === null, 'no reported usage means no measured cost, not a zero');
  assert(actualCost(OPENAI_PROVIDER, 'gpt-image-2', { inputTokens: 0, outputTokens: 0 }) === null, 'all-zero usage is treated as unreported');
  assert(actualCost(OPENAI_PROVIDER, 'some-unrecorded-model', { outputTokens: 500 }) === null, 'a model with no rate on record produces no figure');

  const statement = costStatement(OPENAI_PROVIDER, REQ, declared!);
  assert(/0\.0800 USD/.test(statement), 'the spend notice states the projected dollar figure');
  assert(/gpt-image-2/.test(statement) && /real charge/.test(statement), 'the spend notice names the model and says it is a real charge');

  // Caps, all checked before any request is built.
  const proj = { usd: 0.1, basis: 'operator-declared' as const, detail: 'test' };
  assert(budgetCheck(proj, {}, 0, { version: 1, entries: [] }) === null, 'with no caps declared nothing is rejected');
  assert(budgetCheck(proj, { runUsd: 0.5 }, 0, { version: 1, entries: [] }) === null, 'a call inside the per-run cap passes');
  assert(budgetCheck(proj, { runUsd: 0.1 }, 0, { version: 1, entries: [] }) === null, 'a call exactly at the cap passes');
  const overRun = budgetCheck(proj, { runUsd: 0.15 }, 0.1, { version: 1, entries: [] });
  assert(overRun !== null && overRun.kind === 'budget', 'the per-run cap counts what this run already spent');
  const ledger = { version: 1 as const, entries: [{ ts: 't', provider: 'openai', model: 'gpt-image-2', size: '1024x1024', quality: 'low', usd: 0.9, basis: 'usage-derived' as const, cacheKey: 'k' }] };
  const overTotal = budgetCheck(proj, { totalUsd: 0.95 }, 0, ledger);
  assert(overTotal !== null && /cumulative/.test(overTotal.detail), 'the cumulative cap counts the recorded ledger');
  assert(budgetCheck(proj, { totalUsd: 1.0 }, 0, ledger) === null, 'a call that exactly reaches the cumulative cap passes');
  assert(Math.abs(ledgerTotal(ledger) - 0.9) < 1e-12, 'ledgerTotal sums the recorded spend');
  assert(ledgerTotal({ version: 1, entries: [] }) === 0, 'an empty ledger totals zero');
  // Failed-attempt records must never move the total; that is the whole reason they are a separate array.
  const withAttempts = {
    ...ledger,
    attempts: [{ ts: 't', provider: 'openai', model: 'gpt-image-2', kind: 'http', status: 500, detail: 'boom' }],
  };
  assert(Math.abs(ledgerTotal(withAttempts) - 0.9) < 1e-12, 'recorded failed attempts do not change the ledger total');
}

// ---------------------------------------------------------------------------
// 7. Both provider adapters, end to end through an injected transport
// ---------------------------------------------------------------------------

async function testOpenAiAdapter(): Promise<void> {
  const png = encodePng(2, 2, new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]));

  // Request shape.
  const built = OPENAI_PROVIDER.buildRequest(REQ, 'sk-test-key');
  assert(built.url === 'https://api.openai.com/v1/images/generations', 'openai posts to the images endpoint');
  const headers = built.init.headers as Record<string, string>;
  assert(headers.authorization === 'Bearer sk-test-key', 'the key travels as a bearer token');
  const body = JSON.parse(built.init.body as string);
  assert(body.model === 'gpt-image-2' && body.size === '1024x1024' && body.quality === 'low' && body.n === 1, 'the body carries model, size, quality and n=1');
  assert(body.output_format === 'png', 'the requested output format is passed through');

  const ok = await callProvider(OPENAI_PROVIDER, REQ, 'k', fixedTransport(200, { model: 'gpt-image-2', data: [{ b64_json: png.toString('base64') }], usage: { input_tokens: 42, output_tokens: 1056 } }));
  assert(ok.ok, 'a well-formed 200 response is a success');
  if (ok.ok) {
    assert(ok.bytes.equals(png), 'the decoded bytes are exactly what the provider sent');
    assert(ok.usage !== null && ok.usage.inputTokens === 42 && ok.usage.outputTokens === 1056, 'reported token usage is carried through');
    assert(actualCost(OPENAI_PROVIDER, 'gpt-image-2', ok.usage)!.usd > 0, 'the carried usage prices out to a real cost');
  }

  const failures: Array<[string, Awaited<ReturnType<typeof callProvider>>, string]> = [
    ['401', await callProvider(OPENAI_PROVIDER, REQ, 'k', fixedTransport(401, { error: { message: 'Incorrect API key provided' } })), 'http'],
    ['500', await callProvider(OPENAI_PROVIDER, REQ, 'k', fixedTransport(500, { error: { message: 'server error' } })), 'http'],
    ['moderation', await callProvider(OPENAI_PROVIDER, REQ, 'k', fixedTransport(400, { error: { code: 'moderation_blocked', message: 'blocked by safety' } })), 'refusal'],
    ['empty payload', await callProvider(OPENAI_PROVIDER, REQ, 'k', fixedTransport(200, { data: [] })), 'empty'],
    ['empty b64', await callProvider(OPENAI_PROVIDER, REQ, 'k', fixedTransport(200, { data: [{ b64_json: '' }] })), 'empty'],
    ['non-json', await callProvider(OPENAI_PROVIDER, REQ, 'k', fixedTransport(200, '<html>gateway timeout</html>')), 'malformed'],
  ];
  for (const [label, res, kind] of failures) {
    assert(!res.ok, `${label} must not be reported as a success`);
    if (!res.ok) {
      assert(res.kind === kind, `${label} classifies as ${kind}, got ${res.kind}`);
      assert(res.provider === 'openai', `${label} names the provider that failed`);
    }
  }

  // A provider that echoes the key back inside its error message must not get it onto a log line. This is the
  // exact shape OpenAI returned for a rejected key on 2026-07-29, including its own partial mask.
  const echoed = await callProvider(
    OPENAI_PROVIDER,
    REQ,
    'k',
    fixedTransport(401, { error: { message: 'Incorrect API key provided: sk-proj-********************pSZg. You can find your API key at https://platform.openai.com/account/api-keys.' } }),
  );
  assert(!echoed.ok, 'a rejected key is a failure');
  if (!echoed.ok) {
    assert(!/pSZg/.test(echoed.detail), `the echoed key tail is redacted (got ${echoed.detail})`);
    assert(!/sk-proj-\*/.test(echoed.detail), 'the masked key body is redacted too');
    assert(/sk-\[REDACTED\]/.test(echoed.detail), 'the redaction is visible rather than silent');
    assert(/Incorrect API key provided/.test(echoed.detail), 'the useful part of the message survives redaction');
  }
  assert(redactSecrets('key AIzaSyABCDEFGHIJKLMNOPQRSTUV and AQ.Ab8RN6abcdefghijklmn') === 'key AIza[REDACTED] and AQ.[REDACTED]', 'google key formats are redacted too');
  assert(redactSecrets('no secrets here') === 'no secrets here', 'ordinary text passes through untouched');

  const thrown = await callProvider(OPENAI_PROVIDER, REQ, 'k', async () => {
    throw new Error('socket hang up');
  });
  assert(!thrown.ok && thrown.kind === 'network', 'a transport throw becomes a classified network failure, never an exception');
  if (!thrown.ok) assert(/socket hang up/.test(thrown.detail), 'the network failure keeps the underlying message');
}

async function testNanoBananaAdapter(): Promise<void> {
  const png = encodePng(1, 1, new Uint8Array([9, 8, 7, 255]));
  const nb: ImageRequest = { ...REQ, provider: 'nanobanana', model: 'gemini-3.1-flash-image', size: '1536x1024' };

  // The LIVE surface, confirmed by a free capability probe of the authorized key: generateContent, with the
  // model in the path. Not the interactions surface the current documentation describes.
  const built = NANOBANANA_PROVIDER.buildRequest(nb, 'goog-key');
  assert(
    built.url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent',
    `nano banana posts to the model's generateContent endpoint (got ${built.url})`,
  );
  const headers = built.init.headers as Record<string, string>;
  assert(headers['x-goog-api-key'] === 'goog-key', 'the key travels in the x-goog-api-key header');
  assert(JSON.stringify(built.init).indexOf('goog-key') === JSON.stringify(built.init).lastIndexOf('goog-key'), 'the key appears exactly once, in the header, and never in the body');
  const body = JSON.parse(built.init.body as string);
  assert(body.contents[0].parts[0].text === nb.prompt, 'the prompt travels as a text part');
  assert(Array.isArray(body.generationConfig.responseModalities) && body.generationConfig.responseModalities[0] === 'IMAGE', 'an IMAGE response modality is requested');
  assert(body.generationConfig.imageConfig.aspectRatio === '3:2' && body.generationConfig.imageConfig.imageSize === '2K', 'geometry maps to an aspect ratio and a size tier');
  assert(body.model === undefined, 'the model is in the path, not duplicated in the body');

  // The live response shape: inlineData on a candidate part, usage in usageMetadata.
  const live = await callProvider(
    NANOBANANA_PROVIDER,
    nb,
    'k',
    fixedTransport(200, {
      candidates: [{ content: { parts: [{ text: 'here you go' }, { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 14, candidatesTokenCount: 1290 },
      modelVersion: 'gemini-3.1-flash-image',
    }),
  );
  assert(live.ok, 'the live generateContent shape is a success');
  if (live.ok) {
    assert(live.bytes.equals(png), 'the decoded bytes match what the provider sent');
    assert(live.mime === 'image/png', 'the reported mime type is carried through rather than assumed');
    assert(live.usage!.inputTokens === 14 && live.usage!.outputTokens === 1290, 'usageMetadata token counts are carried');
    assert(actualCost(NANOBANANA_PROVIDER, 'gemini-3.1-flash-image', live.usage)!.usd > 0, 'the carried usage prices out to a real cost');
  }

  // snake_case inline_data, which some responses use.
  const snake = await callProvider(
    NANOBANANA_PROVIDER,
    nb,
    'k',
    fixedTransport(200, { candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/webp', data: png.toString('base64') } }] } }] }),
  );
  assert(snake.ok && snake.mime === 'image/webp', 'the snake_case inline_data shape is also read, with its own mime type');

  // A candidate that finished without any image part is EMPTY, not a success, and names the finish reason.
  const noPart = await callProvider(NANOBANANA_PROVIDER, nb, 'k', fixedTransport(200, { candidates: [{ content: { parts: [{ text: 'no image today' }] }, finishReason: 'MAX_TOKENS' }] }));
  assert(!noPart.ok && noPart.kind === 'empty', 'a candidate with no image part is empty');
  if (!noPart.ok) assert(/MAX_TOKENS/.test(noPart.detail), 'the empty failure names the finish reason it was given');

  // A safety finishReason is a refusal even when nothing else says so.
  const finishBlocked = await callProvider(NANOBANANA_PROVIDER, nb, 'k', fixedTransport(200, { candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] }));
  assert(!finishBlocked.ok && finishBlocked.kind === 'refusal', 'a prohibited-content finish reason is a refusal, not an empty response');

  const direct = await callProvider(NANOBANANA_PROVIDER, nb, 'k', fixedTransport(200, { output_image: { data: png.toString('base64') }, usage: { input_tokens: 12, output_tokens: 1120 } }));
  assert(direct.ok, 'the documented interactions output_image path still parses as a fallback');
  if (direct.ok) {
    assert(direct.bytes.equals(png), 'the decoded bytes match what the provider sent');
    assert(direct.usage!.outputTokens === 1120, 'reported usage is carried');
  }

  const interleaved = await callProvider(
    NANOBANANA_PROVIDER,
    nb,
    'k',
    fixedTransport(200, { steps: [{ content: [{ type: 'text', text: 'thinking' }] }, { content: [{ type: 'image', data: png.toString('base64') }] }] }),
  );
  assert(interleaved.ok, 'the interleaved steps path is also handled');
  if (interleaved.ok) assert(interleaved.bytes.equals(png), 'the interleaved path decodes the same bytes');

  const blocked = await callProvider(NANOBANANA_PROVIDER, nb, 'k', fixedTransport(200, { promptFeedback: { blockReason: 'SAFETY' } }));
  assert(!blocked.ok && blocked.kind === 'refusal', 'a promptFeedback blockReason is a refusal, not an empty response');
  const snakeBlocked = await callProvider(NANOBANANA_PROVIDER, nb, 'k', fixedTransport(200, { prompt_feedback: { block_reason: 'SAFETY' } }));
  assert(!snakeBlocked.ok && snakeBlocked.kind === 'refusal', 'the snake_case block reason is also a refusal');
  const safetyStatus = await callProvider(NANOBANANA_PROVIDER, nb, 'k', fixedTransport(400, { error: { status: 'BLOCKED_BY_SAFETY', message: 'no' } }));
  assert(!safetyStatus.ok && safetyStatus.kind === 'refusal', 'a safety status on an error response is a refusal');
  const httpErr = await callProvider(NANOBANANA_PROVIDER, nb, 'k', fixedTransport(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }));
  assert(!httpErr.ok && httpErr.kind === 'http', 'a quota error is an http failure, distinct from a refusal');
  const empty = await callProvider(NANOBANANA_PROVIDER, nb, 'k', fixedTransport(200, { steps: [{ content: [{ type: 'text', text: 'no image' }] }] }));
  assert(!empty.ok && empty.kind === 'empty', 'a response with no image part is empty');
}

async function main(): Promise<void> {
  testContract();
  testCacheKey();
  testOffline();
  testResolution();
  testValidation();
  testCost();
  await testOpenAiAdapter();
  await testNanoBananaAdapter();
  console.log('image-generation: OK (exit contract, chain excludes offline, cache key sensitivity, deterministic self-marking offline render, key/model resolution with legacy refusal, local validation, projected vs measured cost, both caps, both provider adapters and six failure classes)');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
