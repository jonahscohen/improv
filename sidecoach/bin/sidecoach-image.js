#!/usr/bin/env node

/**
 * sidecoach-image - generate a raster asset AND verify it, or refuse to call it verified.
 *
 * The pairing is the point. Generating an image is the easy half and every tool does it; the half that decides
 * whether a build can rely on the result is reading the bytes back. This bin does both in one step and its exit
 * code distinguishes "verified" from "produced but not checkable" from "produced and wrong", because collapsing
 * those three into one success line is how an unusable asset reaches a page.
 *
 * SUBCOMMANDS
 *   generate   produce an asset from a prompt, then verify it against a contract   (default)
 *   verify     verify an asset that already exists on disk against a contract
 *   budget     report recorded spend from the ledger
 *
 * MODES
 *   offline (DEFAULT) - a deterministic PNG rendered from the prompt hash. No key, no network, no spend, and
 *                       byte-identical for the same request forever. The bytes carry a synthetic marker, so an
 *                       offline placeholder can never be reported later as a real render.
 *   openai            - OpenAI Images, current flagship model.
 *   nanobanana        - Nano Banana (Google Gemini image), current flagship model.
 *   auto              - walk the live providers in order, recording every attempt. NEVER falls back to
 *                       offline: a placeholder silently standing in for a real asset is a defect, not a
 *                       degradation path.
 *
 * SPEND: nothing live happens without --yes-spend (or SIDECOACH_IMAGE_ALLOW_SPEND=1); the projected cost is
 * stated before the first call of a session; every call is checked against the caps BEFORE it goes out, which is
 * where a cap can actually prevent spend; the ledger records the cost derived from the provider's own reported
 * token usage, or, when a provider reports none, the projection under the distinct `unmetered-projection` label
 * so a non-measured figure can never pass as a measured one. The ledger is kept even under --no-cache, because
 * that flag governs the image bytes and not the accounting. A call whose recorded cost lands ABOVE the cap is
 * reported as a budget overrun (exit 7): that money is already gone, and the cumulative cap blocks the next one.
 *
 * Exit codes (one per outcome class):
 *   0  verified        asset produced and every contracted check passed
 *   1  verify-failed   asset produced, a check FAILED
 *   2  usage           bad arguments, unreadable input, or no build in dist/
 *   3  unverified      asset produced, a contracted check COULD NOT RUN (never reported as verified)
 *   4  no-key          a live provider was asked for and no API key is present
 *   5  no-model        no resolvable model id
 *   6  provider        every provider in the chain failed
 *   7  budget          projected or cumulative spend exceeds the cap; nothing was spent. It ALSO means a call
 *                      completed and its recorded cost exceeded the cap - that money is already gone, and the
 *                      asset's own verdict is in the result JSON (it may itself be verified, failed, or
 *                      unverified). Check the budgetOverrun field to tell the two cases apart.
 *   8  needs-consent   a live call without the explicit spend signal; nothing was spent
 *   9  io              a read or write failed. It ALSO means a call completed and its spend could NOT be
 *                      recorded in the ledger - money moved with no durable record, so every future cumulative
 *                      cap will undercount until it is entered by hand. See the ledgerWriteFailed field.
 *  10  unpriced        a live call whose cost cannot be established; refuses to spend blind
 *  11  oversize        the request exceeds the provider's documented limits (checked locally)
 *  12  legacy-model    the resolved model id is a superseded generation
 */

'use strict';

const fs = require('fs');
const path = require('path');

let core = null;
let verify = null;

function loadModules() {
  if (core && verify) return;
  try {
    core = require('../dist/image-generation');
    verify = require('../dist/image-asset-verify');
  } catch (err) {
    console.error('sidecoach-image: failed to load ../dist. Run `npm run build` in sidecoach/ first.');
    console.error(err && err.message ? err.message : String(err));
    process.exit(2);
  }
}

// Exit codes are duplicated here as literals ONLY for the pre-dist usage path above; every other site reads
// them from core.EXIT so there is one source of truth once the build is loaded.
const USAGE_EXIT = 2;

function usage() {
  console.error('Usage: sidecoach-image [generate] --prompt <text> --out <file.png> [options]');
  console.error('       sidecoach-image verify <file> --expect-size <WxH> [--expect-format png] [contract options]');
  console.error('       sidecoach-image budget [--cache-dir <dir>]');
  console.error('');
  console.error('Prompt (exactly one required for generate):');
  console.error('  --prompt <text>            the prompt');
  console.error('  --prompt-file <path>       read the prompt from a file');
  console.error('');
  console.error('Generation:');
  console.error('  --out <file>               where to write the asset (required for generate)');
  console.error('  --provider <id>            offline (default) | openai | nanobanana | auto');
  console.error('  --model <id>               override the provider model id');
  console.error('  --size <WxH>               default 1024x1024');
  console.error('  --quality <low|medium|high>  default low');
  console.error('  --format <png|jpeg|webp>   default png (png is the only format whose pixels can be verified)');
  console.error('');
  console.error('Verification contract:');
  console.error('  --expect-size <WxH>        geometry the bytes must actually have (default: --size)');
  console.error('  --expect-format <fmt>      format the bytes must actually be (default: --format)');
  console.error('  --alpha <require|forbid>   transparency requirement (default: unchecked)');
  console.error('  --ink <#hex>               ink color of text that will sit on this image');
  console.error('  --ink-region <x,y,w,h>     where that text sits, in image pixels (default: whole image)');
  console.error('  --min-contrast <n>         minimum ratio (default 4.5 when --ink is given)');
  console.error('  --contrast-mode <worst|mean>  default worst');
  console.error('  --backdrop <#hex>          what transparency composites onto (default #ffffff)');
  console.error('  --min-unique-colors <n>    blank-render threshold override');
  console.error('  --min-stddev <n>           blank-render threshold override');
  console.error('  --min-edge-density <n>     blank-render threshold override');
  console.error('');
  console.error('Spend control:');
  console.error('  --yes-spend                the explicit signal required for any live call');
  console.error('  --budget-usd <n>           cap for this invocation');
  console.error('  --budget-total-usd <n>     cap on cumulative recorded spend (the ledger is kept even with --no-cache)');
  console.error('  --assume-cost-usd <n>      operator-declared ceiling where no per-image price is published');
  console.error('');
  console.error('Cache and output:');
  console.error('  --cache-dir <dir>          content-addressed cache (default <repo>/.sidecoach-cache/images)');
  console.error('  --no-cache                 neither read nor write the ASSET cache; the spend ledger is still kept');
  console.error('  --json                     result JSON on stdout (always emitted for generate/verify)');
  console.error('  --quiet                    suppress the stderr summary');
  console.error('');
  console.error('Exit: 0 verified, 1 verify-failed, 2 usage, 3 unverified, 4 no-key, 5 no-model, 6 provider,');
  console.error('      7 budget, 8 needs-consent, 9 io, 10 unpriced, 11 oversize, 12 legacy-model');
}

// ---------------------------------------------------------------------------
// Argument parsing. Exported for the unit suite so the parser is tested without spawning.
// ---------------------------------------------------------------------------

const VALUE_FLAGS = new Set([
  '--prompt',
  '--prompt-file',
  '--out',
  '--provider',
  '--model',
  '--size',
  '--quality',
  '--format',
  '--expect-size',
  '--expect-format',
  '--alpha',
  '--ink',
  '--ink-region',
  '--min-contrast',
  '--contrast-mode',
  '--backdrop',
  '--min-unique-colors',
  '--min-stddev',
  '--min-edge-density',
  '--budget-usd',
  '--budget-total-usd',
  '--assume-cost-usd',
  '--cache-dir',
]);

const BOOL_FLAGS = new Set(['--yes-spend', '--no-cache', '--json', '--quiet', '--help', '-h']);

function parseArgs(argv) {
  const out = { command: 'generate', positional: [], flags: {}, errors: [] };
  let i = 0;
  if (argv.length > 0 && !argv[0].startsWith('-')) {
    if (['generate', 'verify', 'budget'].includes(argv[0])) {
      out.command = argv[0];
      i = 1;
    }
  }
  for (; i < argv.length; i++) {
    const tok = argv[i];
    if (BOOL_FLAGS.has(tok)) {
      out.flags[tok.replace(/^--?/, '')] = true;
      continue;
    }
    if (VALUE_FLAGS.has(tok)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        out.errors.push(`${tok} needs a value`);
        continue;
      }
      out.flags[tok.replace(/^--/, '')] = value;
      i++;
      continue;
    }
    if (tok.startsWith('-')) {
      out.errors.push(`unknown flag ${tok}`);
      continue;
    }
    out.positional.push(tok);
  }
  return out;
}

function num(value, label, errors) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    errors.push(`${label} must be a number, got ${JSON.stringify(value)}`);
    return undefined;
  }
  return n;
}

function parseRegion(value, errors) {
  const parts = String(value).split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    errors.push(`--ink-region must be x,y,w,h with four numbers, got ${JSON.stringify(value)}`);
    return undefined;
  }
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

/** Build the verification contract from parsed flags. Returns { contract, errors }. */
function buildContract(flags, defaults) {
  const errors = [];
  const sizeStr = flags['expect-size'] || defaults.size;
  const dims = core.parseSize(String(sizeStr));
  if (!dims) errors.push(`--expect-size must be WxH, got ${JSON.stringify(sizeStr)}`);
  const format = String(flags['expect-format'] || defaults.format);
  if (!['png', 'jpeg', 'webp', 'gif', 'svg'].includes(format)) errors.push(`--expect-format ${format} is not a known image format`);

  const contract = {
    format,
    width: dims ? dims.width : 0,
    height: dims ? dims.height : 0,
    minBytes: 1,
    expectSynthetic: defaults.expectSynthetic === true,
  };

  if (flags.alpha !== undefined) {
    if (flags.alpha === 'require') contract.alpha = true;
    else if (flags.alpha === 'forbid') contract.alpha = false;
    else errors.push(`--alpha must be require or forbid, got ${JSON.stringify(flags.alpha)}`);
  }

  const blank = {};
  if (flags['min-unique-colors'] !== undefined) blank.minUniqueColors = num(flags['min-unique-colors'], '--min-unique-colors', errors);
  if (flags['min-stddev'] !== undefined) blank.minLuminanceStdDev = num(flags['min-stddev'], '--min-stddev', errors);
  if (flags['min-edge-density'] !== undefined) blank.minEdgeDensity = num(flags['min-edge-density'], '--min-edge-density', errors);
  if (Object.keys(blank).length > 0) contract.blank = blank;

  if (flags.ink !== undefined) {
    const placement = {
      inkHex: String(flags.ink),
      minContrast: flags['min-contrast'] !== undefined ? num(flags['min-contrast'], '--min-contrast', errors) : 4.5,
    };
    if (flags['contrast-mode'] !== undefined) {
      if (!['worst', 'mean'].includes(flags['contrast-mode'])) errors.push('--contrast-mode must be worst or mean');
      else placement.mode = flags['contrast-mode'];
    }
    if (flags.backdrop !== undefined) placement.backdropHex = String(flags.backdrop);
    if (flags['ink-region'] !== undefined) {
      const region = parseRegion(flags['ink-region'], errors);
      if (region) placement.region = region;
    }
    contract.placement = placement;
  } else if (flags['ink-region'] !== undefined || flags['min-contrast'] !== undefined) {
    errors.push('--ink-region and --min-contrast require --ink');
  }

  return { contract, errors };
}

// ---------------------------------------------------------------------------
// Paths, cache, ledger
// ---------------------------------------------------------------------------

function defaultCacheDir() {
  return path.resolve(__dirname, '..', '.sidecoach-cache', 'images');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ledgerPath(cacheDir) {
  return path.join(cacheDir, 'spend-ledger.json');
}

const EMPTY = () => ({ version: 1, entries: [], attempts: [] });

/**
 * Read the ledger, distinguishing MISSING from UNREADABLE.
 *
 * The distinction is load-bearing and was not made before. A missing ledger legitimately means no spend has been
 * recorded yet. An unreadable one means spend may well have been recorded and we cannot see it, so a cumulative
 * cap evaluated against it would be evaluated against a fiction. Collapsing the two into "empty" is how a cap
 * silently stops capping. Codex re-review 2026-07-29, finding 1.
 */
function readLedger(cacheDir) {
  const file = ledgerPath(cacheDir);
  if (!fs.existsSync(file)) return { status: 'missing', ledger: EMPTY() };
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { status: 'unreadable', ledger: EMPTY(), detail: err && err.message ? err.message : String(err) };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      return {
        status: 'ok',
        ledger: { version: 1, entries: parsed.entries, attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [] },
      };
    }
    return { status: 'unreadable', ledger: EMPTY(), detail: 'the file parsed but carries no entries array' };
  } catch (err) {
    return { status: 'unreadable', ledger: EMPTY(), detail: err && err.message ? err.message : String(err) };
  }
}

function writeLedger(cacheDir, ledger) {
  const file = ledgerPath(cacheDir);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

/**
 * Move an unreadable ledger aside instead of overwriting it. Whatever it holds may be the only record of real
 * spend; a fresh file written on top of it would destroy that. Returns the quarantine path.
 */
function quarantineLedger(cacheDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(cacheDir, `spend-ledger.unreadable-${stamp}.json`);
  fs.renameSync(ledgerPath(cacheDir), dest);
  return dest;
}

/** Append a completed call. Throws on failure: the caller must treat a lost spend record as a hard failure. */
function appendLedger(cacheDir, entry) {
  const read = readLedger(cacheDir);
  if (read.status === 'unreadable') {
    const moved = quarantineLedger(cacheDir);
    console.error(`sidecoach-image: the existing spend ledger was unreadable and has been moved to ${moved}; a new one starts from this call.`);
  }
  const ledger = read.status === 'ok' ? read.ledger : EMPTY();
  ledger.entries.push(entry);
  writeLedger(cacheDir, ledger);
}

/**
 * Record a live request that was ISSUED and then failed.
 *
 * These carry no cost figure and are kept in a separate array, so they never move the ledger total. They exist
 * because "the request went out and came back an error" is not the same as "no request was made": if a provider
 * ever bills for a refused or errored request, this is the durable record to reconcile an invoice against.
 * Codex re-review 2026-07-29, finding 2.
 */
function appendAttempt(cacheDir, attempt) {
  const read = readLedger(cacheDir);
  if (read.status === 'unreadable') return;
  const ledger = read.status === 'ok' ? read.ledger : EMPTY();
  ledger.attempts.push(attempt);
  writeLedger(cacheDir, ledger);
}

function sessionId() {
  return process.env.SIDECOACH_SESSION_ID || `ppid-${process.ppid}`;
}

function statementAlreadyMade(cacheDir) {
  return fs.existsSync(path.join(cacheDir, '.session-statements', `${sessionId()}.json`));
}

function recordStatement(cacheDir, text) {
  const dir = path.join(cacheDir, '.session-statements');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${sessionId()}.json`), `${JSON.stringify({ statedAt: new Date().toISOString(), text }, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Transport selection
//
// SIDECOACH_IMAGE_TEST_TRANSPORT is a TEST-ONLY seam: it points at a JSON file of {status, body} and requires
// SIDECOACH_IMAGE_ALLOW_FIXTURE=1 as a second signal. It exists so the suite can drive real provider adapters
// and every HTTP failure class with no key and no network. Any run using it is stamped live:false and
// transport:"test-fixture" in the result JSON and announced on stderr, so a fixture run can never be read as a
// live provider result.
// ---------------------------------------------------------------------------

function selectTransport() {
  const fixture = process.env.SIDECOACH_IMAGE_TEST_TRANSPORT;
  if (!fixture) return { transport: core.nodeFetchTransport, kind: 'live' };
  if (process.env.SIDECOACH_IMAGE_ALLOW_FIXTURE !== '1') {
    return {
      error: 'SIDECOACH_IMAGE_TEST_TRANSPORT is set but SIDECOACH_IMAGE_ALLOW_FIXTURE is not 1; refusing to use the test transport',
    };
  }
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  } catch (err) {
    return { error: `unreadable test transport fixture ${fixture}: ${err && err.message ? err.message : String(err)}` };
  }
  const responses = Array.isArray(spec) ? spec.slice() : [spec];
  let callIndex = 0;
  const transport = async () => {
    const next = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    if (next && next.throw) throw new Error(String(next.throw));
    return { status: Number(next.status), body: typeof next.body === 'string' ? next.body : JSON.stringify(next.body) };
  };
  return { transport, kind: 'test-fixture' };
}

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

const FAILURE_EXIT_ORDER = [
  ['needs-consent', 'NEEDS_CONSENT'],
  ['legacy-model', 'LEGACY_MODEL'],
  ['oversize', 'OVERSIZE'],
  ['unpriced', 'UNPRICED'],
  ['budget', 'BUDGET'],
  ['http', 'PROVIDER'],
  ['refusal', 'PROVIDER'],
  ['empty', 'PROVIDER'],
  ['malformed', 'PROVIDER'],
  ['network', 'PROVIDER'],
  ['no-model', 'NO_MODEL'],
  ['no-key', 'NO_KEY'],
];

function exitForFailures(failures) {
  for (const [kind, code] of FAILURE_EXIT_ORDER) {
    if (failures.some((f) => f.kind === kind)) return core.EXIT[code];
  }
  return core.EXIT.PROVIDER;
}

async function runGenerate(parsed) {
  const flags = parsed.flags;
  const errors = parsed.errors.slice();

  let prompt = null;
  if (flags.prompt !== undefined && flags['prompt-file'] !== undefined) {
    errors.push('pass --prompt or --prompt-file, not both');
  } else if (flags.prompt !== undefined) {
    prompt = String(flags.prompt);
  } else if (flags['prompt-file'] !== undefined) {
    try {
      prompt = fs.readFileSync(String(flags['prompt-file']), 'utf8');
    } catch (err) {
      console.error(`sidecoach-image: cannot read --prompt-file ${flags['prompt-file']}: ${err && err.message ? err.message : String(err)}`);
      return core.EXIT.IO;
    }
  } else {
    errors.push('--prompt or --prompt-file is required');
  }

  const out = flags.out !== undefined ? String(flags.out) : null;
  if (!out) errors.push('--out is required');

  const providerId = String(flags.provider || core.OFFLINE_PROVIDER_ID);
  const size = String(flags.size || '1024x1024');
  const quality = String(flags.quality || 'low');
  const format = String(flags.format || 'png');
  if (!['png', 'jpeg', 'webp'].includes(format)) errors.push(`--format must be png, jpeg or webp, got ${format}`);
  if (!core.parseSize(size)) errors.push(`--size must be WxH, got ${JSON.stringify(size)}`);

  const known = [core.OFFLINE_PROVIDER_ID, 'auto', ...Object.keys(core.PROVIDERS)];
  if (!known.includes(providerId)) errors.push(`--provider must be one of ${known.join(', ')}`);

  const isOffline = providerId === core.OFFLINE_PROVIDER_ID;
  const built = buildContract(flags, { size, format, expectSynthetic: isOffline });
  errors.push(...built.errors);

  const caps = {};
  if (flags['budget-usd'] !== undefined) caps.runUsd = num(flags['budget-usd'], '--budget-usd', errors);
  if (flags['budget-total-usd'] !== undefined) caps.totalUsd = num(flags['budget-total-usd'], '--budget-total-usd', errors);
  const assumeCost = flags['assume-cost-usd'] !== undefined ? num(flags['assume-cost-usd'], '--assume-cost-usd', errors) : undefined;

  if (errors.length > 0) {
    for (const e of errors) console.error(`sidecoach-image: ${e}`);
    usage();
    return core.EXIT.USAGE;
  }

  const cacheDir = String(flags['cache-dir'] || defaultCacheDir());
  const useCache = flags['no-cache'] !== true;

  const result = {
    tool: 'sidecoach-image',
    command: 'generate',
    live: false,
    transport: isOffline ? 'none' : 'live',
    provider: providerId,
    model: null,
    size,
    quality,
    format,
    out,
    cacheKey: null,
    cached: false,
    // The mime type the PROVIDER said it returned, recorded separately from the format that was REQUESTED.
    // Gemini's generateContent surface chose jpeg for a png request on the first real call; without this field
    // the only signal was the format-matches failure, which says what is wrong but not who chose it.
    providerMime: null,
    synthetic: isOffline,
    attempts: [],
    cost: { usd: 0, basis: isOffline ? 'offline' : 'cache-hit', detail: 'no live call was made' },
    budgetOverrun: null,
    ledgerWriteFailed: null,
    usage: null,
    verification: null,
    verdict: null,
  };

  let bytes = null;

  if (isOffline) {
    const req = { prompt, size, quality, format: 'png', provider: core.OFFLINE_PROVIDER_ID, model: core.OFFLINE_MODEL_ID };
    if (format !== 'png') {
      console.error('sidecoach-image: offline mode renders png only; re-run with --format png or choose a live provider');
      return core.EXIT.USAGE;
    }
    result.model = core.OFFLINE_MODEL_ID;
    result.cacheKey = core.cacheKey(req);
    result.cost = { usd: 0, basis: 'offline', detail: 'offline deterministic render; no provider was contacted' };
    try {
      bytes = core.renderOfflinePng(req);
    } catch (err) {
      console.error(`sidecoach-image: offline render failed: ${err && err.message ? err.message : String(err)}`);
      return core.EXIT.IO;
    }
  } else {
    const chain = providerId === 'auto' ? core.AUTO_CHAIN.slice() : [providerId];
    const consented = flags['yes-spend'] === true || process.env.SIDECOACH_IMAGE_ALLOW_SPEND === '1';
    const sel = selectTransport();
    if (sel.error) {
      console.error(`sidecoach-image: ${sel.error}`);
      return core.EXIT.USAGE;
    }
    result.transport = sel.kind;
    if (sel.kind === 'test-fixture') {
      console.error('sidecoach-image: TRANSPORT IS A TEST FIXTURE. No provider was contacted and this result is not a live generation.');
    }

    const failures = [];
    let spentThisRun = 0;

    for (const id of chain) {
      const spec = core.PROVIDERS[id];
      const keyOut = core.resolveKey(spec, process.env);
      if (!keyOut.value) {
        failures.push(keyOut.failure);
        result.attempts.push(keyOut.failure);
        continue;
      }
      const modelOut = core.resolveModel(spec, process.env, flags.model ? String(flags.model) : undefined);
      if (!modelOut.value) {
        failures.push(modelOut.failure);
        result.attempts.push(modelOut.failure);
        continue;
      }
      const req = { prompt, size, quality, format, provider: id, model: modelOut.value };

      const invalid = core.validateRequest(spec, req);
      if (invalid) {
        failures.push(invalid);
        result.attempts.push(invalid);
        continue;
      }

      const key = core.cacheKey(req);
      if (useCache) {
        const hit = path.join(cacheDir, `${key}.${format}`);
        if (fs.existsSync(hit)) {
          try {
            bytes = fs.readFileSync(hit);
          } catch (err) {
            console.error(`sidecoach-image: cache hit ${hit} is unreadable: ${err && err.message ? err.message : String(err)}`);
            return core.EXIT.IO;
          }
          result.provider = id;
          result.model = modelOut.value;
          result.cacheKey = key;
          result.cached = true;
          result.live = false;
          result.cost = { usd: 0, basis: 'cache-hit', detail: `served from ${hit}; no provider call, no spend` };
          break;
        }
      }

      const projection = core.projectCost(spec, req, assumeCost);
      if (!projection) {
        const f = {
          kind: 'unpriced',
          provider: id,
          detail: `no published per-image price for ${id}/${modelOut.value} at this resolution and no --assume-cost-usd was given; refusing to spend an unknown amount`,
        };
        failures.push(f);
        result.attempts.push(f);
        continue;
      }

      if (!consented) {
        const f = {
          kind: 'needs-consent',
          provider: id,
          detail: `a live call to ${id} projects ${projection.usd.toFixed(4)} USD; pass --yes-spend (or SIDECOACH_IMAGE_ALLOW_SPEND=1) to authorize it`,
        };
        failures.push(f);
        result.attempts.push(f);
        continue;
      }

      // The SPEND LEDGER is not part of the asset cache and must never be switched off with it. --no-cache means
      // "do not reuse or store the image bytes"; it cannot mean "stop counting money", or it would be a path to
      // spend past a cumulative cap and leave no record. Codex review 2026-07-29, spend finding 2.
      try {
        ensureDir(cacheDir);
      } catch (err) {
        console.error(`sidecoach-image: cannot create the spend-ledger directory ${cacheDir}: ${err && err.message ? err.message : String(err)}`);
        return core.EXIT.IO;
      }
      const read = readLedger(cacheDir);
      // An unreadable ledger cannot support a cumulative cap. Refusing costs nothing; proceeding would evaluate
      // the cap against an empty record that may be hiding real spend.
      if (read.status === 'unreadable' && typeof caps.totalUsd === 'number') {
        const f = {
          kind: 'budget',
          provider: 'budget',
          detail: `the spend ledger at ${ledgerPath(cacheDir)} is unreadable (${read.detail}), so the cumulative cap of ${caps.totalUsd.toFixed(4)} USD cannot be evaluated; refusing to spend. Repair or move that file.`,
        };
        failures.push(f);
        result.attempts.push(f);
        continue;
      }
      if (read.status === 'unreadable') {
        console.error(`sidecoach-image: WARNING the spend ledger at ${ledgerPath(cacheDir)} is unreadable (${read.detail}). It will be moved aside, not overwritten.`);
      }
      const ledger = read.ledger;
      const overBudget = core.budgetCheck(projection, caps, spentThisRun, ledger);
      if (overBudget) {
        failures.push(overBudget);
        result.attempts.push(overBudget);
        continue;
      }

      // State the cost before the first call of a session. The session marker lives beside the ledger and is
      // likewise independent of --no-cache; when it cannot be read the statement is printed again, because
      // stating it twice is harmless and never stating it is not.
      const statement = core.costStatement(spec, req, projection);
      if (!statementAlreadyMade(cacheDir)) {
        console.error(statement);
        try {
          recordStatement(cacheDir, statement);
        } catch {
          // Failing to record the statement must not block the call the operator already authorized; the
          // statement was printed, which is the requirement.
        }
      }

      const call = await core.callProvider(spec, req, keyOut.value, sel.transport);
      if (!call.ok) {
        failures.push(call);
        result.attempts.push({ kind: call.kind, provider: call.provider, detail: call.detail, status: call.status });
        // The request WENT OUT and failed. No cost is claimed, but the attempt is recorded: a provider that
        // bills for refused or errored requests would otherwise spend with no trace at all.
        try {
          appendAttempt(cacheDir, {
            ts: new Date().toISOString(),
            provider: id,
            model: modelOut.value,
            size,
            quality,
            kind: call.kind,
            status: typeof call.status === 'number' ? call.status : null,
            detail: call.detail,
            transport: sel.kind,
          });
        } catch (err) {
          console.error(`sidecoach-image: WARNING could not record the failed attempt: ${err && err.message ? err.message : String(err)}`);
        }
        continue;
      }

      bytes = call.bytes;
      result.provider = id;
      result.model = modelOut.value;
      result.cacheKey = key;
      result.live = sel.kind === 'live';
      result.usage = call.usage;
      result.providerMime = call.mime || null;
      if (call.mime && call.mime !== `image/${format}`) {
        console.error(`sidecoach-image: the provider returned ${call.mime} for a ${format} request. The format check below will fail, and pixel checks only run on png.`);
      }
      result.attempts.push({ kind: 'ok', provider: id, detail: `HTTP ${call.status}, ${call.bytes.length} bytes` });

      const spentBeforeThisCall = spentThisRun;
      const measured = core.actualCost(spec, modelOut.value, call.usage);
      if (measured) {
        result.cost = measured;
        spentThisRun += measured.usd;
      } else {
        result.cost = {
          usd: projection.usd,
          basis: 'unmetered-projection',
          detail: `${projection.detail}. The provider reported no usable token usage, so this figure is the pre-call projection and NOT a measurement.`,
        };
        spentThisRun += projection.usd;
        console.error('sidecoach-image: provider reported no token usage; the recorded cost is the projection, not a measurement (basis unmetered-projection).');
      }

      // The cap is enforced before the call, which is where it can actually prevent spend. This second check
      // catches the case the first one cannot: a projection (typically an operator-declared ceiling) that came
      // in under the real cost. The money is already gone, so this reports rather than prevents - and the
      // ledger entry below means the cumulative cap will block the next call. Codex spend finding 3.
      const overrun = core.budgetCheck(result.cost, caps, spentBeforeThisCall, ledger);
      if (overrun) {
        result.budgetOverrun = overrun.detail;
        console.error(`sidecoach-image: BUDGET OVERRUN. The call completed and its recorded cost exceeds the cap, so this money is already spent: ${overrun.detail}`);
        if (result.cost.basis === 'unmetered-projection' || projection.basis === 'operator-declared') {
          console.error('sidecoach-image: the projection that passed the preflight check came from --assume-cost-usd; raise that ceiling to make the preflight gate accurate.');
        }
      }

      // The ledger records every completed call, cache setting notwithstanding.
      try {
        appendLedger(cacheDir, {
          ts: new Date().toISOString(),
          provider: id,
          model: modelOut.value,
          size,
          quality,
          usd: result.cost.usd,
          basis: result.cost.basis,
          cacheKey: key,
        });
      } catch (err) {
        // Money moved and there is now no durable record of it. That is a hard failure for a spend-control
        // tool, not a warning to scroll past: the next run's cumulative cap would be computed without this
        // call. Recorded in the result and carried to a nonzero exit. Codex re-review finding 1.
        result.ledgerWriteFailed = err && err.message ? err.message : String(err);
        console.error(`sidecoach-image: SPEND WAS INCURRED AND THE LEDGER WRITE FAILED: ${result.ledgerWriteFailed}`);
        console.error(`sidecoach-image: record ${result.cost.usd.toFixed(4)} USD for ${id}/${modelOut.value} by hand, or the cumulative cap will undercount.`);
      }
      break;
    }

    if (!bytes) {
      for (const f of failures) console.error(`sidecoach-image: ${f.provider}: ${f.kind}: ${f.detail}`);
      console.error(`sidecoach-image: no asset was produced (${failures.length} attempt(s) failed). Nothing was written.`);
      if (flags.json) console.log(JSON.stringify({ ...result, verdict: 'not-produced' }, null, 2));
      return exitForFailures(failures);
    }
  }

  // -------------------------------------------------------------------------
  // Verify BEFORE claiming anything. The asset is written either way so a human can look at it, but a failed
  // or unverifiable asset is never cached and never reported as verified.
  // -------------------------------------------------------------------------

  const report = verify.verifyAsset(bytes, built.contract);
  result.verification = report;
  result.verdict = report.verdict;
  result.synthetic = report.synthetic;

  try {
    ensureDir(path.dirname(path.resolve(out)));
    fs.writeFileSync(out, bytes);
  } catch (err) {
    console.error(`sidecoach-image: cannot write ${out}: ${err && err.message ? err.message : String(err)}`);
    return core.EXIT.IO;
  }

  if (report.verdict === 'verified' && useCache && result.cacheKey && !result.cached) {
    try {
      ensureDir(cacheDir);
      const dest = path.join(cacheDir, `${result.cacheKey}.${format}`);
      fs.writeFileSync(dest, bytes);
      fs.writeFileSync(
        path.join(cacheDir, `${result.cacheKey}.json`),
        `${JSON.stringify(
          {
            provider: result.provider,
            model: result.model,
            size,
            quality,
            format,
            synthetic: result.synthetic,
            cost: result.cost,
            usage: result.usage,
            verifiedAt: new Date().toISOString(),
            checks: report.checks,
          },
          null,
          2,
        )}\n`,
      );
    } catch (err) {
      console.error(`sidecoach-image: WARNING cache write failed: ${err && err.message ? err.message : String(err)}`);
    }
  }

  console.log(JSON.stringify(result, null, 2));
  if (!flags.quiet) {
    console.error('');
    console.error(`sidecoach-image: ${verify.summarizeReport(report)}`);
    for (const c of report.checks) console.error(`  [${c.status}] ${c.id}: ${c.detail}`);
    console.error(`  asset: ${path.resolve(out)}`);
    console.error(`  provider: ${result.provider} model: ${result.model} cost: ${result.cost.usd.toFixed(4)} USD (${result.cost.basis})`);
    if (report.verdict !== 'verified') {
      console.error(`  NOT VERIFIED: the asset was written but its verdict is ${report.verdict}. Do not treat it as checked.`);
    }
  }

  // Precedence in the EXIT CODE only; the asset's own verdict is always in the JSON and on stderr. Spend that
  // was incurred and NOT recorded outranks everything, because every future cap depends on that record. A
  // measured overrun comes next: that money has already left too.
  if (result.ledgerWriteFailed) return core.EXIT.IO;
  if (result.budgetOverrun) return core.EXIT.BUDGET;
  if (report.verdict === 'failed') return core.EXIT.VERIFY_FAILED;
  if (report.verdict === 'unverified') return core.EXIT.UNVERIFIED;
  return core.EXIT.OK;
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

function runVerify(parsed) {
  const flags = parsed.flags;
  const errors = parsed.errors.slice();
  const file = parsed.positional[0];
  if (!file) errors.push('verify needs a file path');
  if (flags['expect-size'] === undefined) errors.push('verify needs --expect-size <WxH>');

  const built = buildContract(flags, {
    size: flags['expect-size'] || '0x0',
    format: flags['expect-format'] || 'png',
    expectSynthetic: flags.provider === core.OFFLINE_PROVIDER_ID,
  });
  errors.push(...built.errors);
  if (errors.length > 0) {
    for (const e of errors) console.error(`sidecoach-image: ${e}`);
    usage();
    return core.EXIT.USAGE;
  }

  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (err) {
    console.error(`sidecoach-image: cannot read ${file}: ${err && err.message ? err.message : String(err)}`);
    return core.EXIT.IO;
  }

  const report = verify.verifyAsset(bytes, built.contract);
  console.log(JSON.stringify({ tool: 'sidecoach-image', command: 'verify', file: path.resolve(file), verdict: report.verdict, verification: report }, null, 2));
  if (!flags.quiet) {
    console.error('');
    console.error(`sidecoach-image: ${verify.summarizeReport(report)}`);
    for (const c of report.checks) console.error(`  [${c.status}] ${c.id}: ${c.detail}`);
  }
  if (report.verdict === 'failed') return core.EXIT.VERIFY_FAILED;
  if (report.verdict === 'unverified') return core.EXIT.UNVERIFIED;
  return core.EXIT.OK;
}

// ---------------------------------------------------------------------------
// budget
// ---------------------------------------------------------------------------

function runBudget(parsed) {
  const cacheDir = String(parsed.flags['cache-dir'] || defaultCacheDir());
  const read = readLedger(cacheDir);
  const ledger = read.ledger;
  const total = core.ledgerTotal(ledger);
  if (read.status === 'unreadable') {
    console.error(`sidecoach-image: the spend ledger at ${ledgerPath(cacheDir)} is UNREADABLE (${read.detail}). The totals below are not a record of spend.`);
  }
  console.log(
    JSON.stringify(
      {
        tool: 'sidecoach-image',
        command: 'budget',
        cacheDir,
        ledgerStatus: read.status,
        entries: ledger.entries.length,
        failedAttempts: ledger.attempts.length,
        totalUsd: Number(total.toFixed(6)),
        ledger: ledger.entries,
        attempts: ledger.attempts,
      },
      null,
      2,
    ),
  );
  if (!parsed.flags.quiet) {
    console.error('');
    console.error(`sidecoach-image: ${ledger.entries.length} recorded call(s), ${total.toFixed(4)} USD total, ledger at ${path.join(cacheDir, 'spend-ledger.json')}`);
  }
  return core.EXIT.OK;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    return 0;
  }
  const parsed = parseArgs(argv);
  loadModules();
  if (parsed.command === 'verify') return runVerify(parsed);
  if (parsed.command === 'budget') return runBudget(parsed);
  return runGenerate(parsed);
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('sidecoach-image: unhandled failure');
      console.error(err && err.stack ? err.stack : String(err));
      process.exit(USAGE_EXIT);
    });
}

// parseArgs needs no build; buildContract / exitForFailures read the exit table and the size parser out of
// dist, so a unit test must call loadModules() first. It is exported for exactly that reason.
module.exports = { parseArgs, buildContract, defaultCacheDir, exitForFailures, selectTransport, loadModules };
