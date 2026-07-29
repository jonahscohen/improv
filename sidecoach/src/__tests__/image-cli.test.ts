// sidecoach/src/__tests__/image-cli.test.ts
//
// End-to-end contract for bin/sidecoach-image.js: the real binary, spawned, with its real exit codes.
//
// The unit suites prove the pieces. This one proves the ASSEMBLY, which is where a tool like this actually
// fails: a check that runs but whose result never reaches the exit code, a failure path that still writes a
// file, a cache that quietly re-spends, a placeholder that gets reported as a render.
//
// Specifically proven here:
//   1. Offline generation writes a real, verified PNG and exits 0, and two runs of the same prompt produce
//      byte-identical files.
//   2. EVERY failure class exits with its own documented code AND WRITES NOTHING.
//   3. A cache hit is proven by pointing the transport at a fixture that THROWS: if the second run is served
//      from cache it cannot have called the provider, so the pass is evidence, not a claim.
//   4. The verify subcommand distinguishes failed from unverified from verified on real files.
//   5. The spend ledger records what was spent and the budget subcommand reports it.
//   6. The test transport needs a second explicit signal, and any run using it is stamped as not live.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { encodePng } from '../image-png-codec';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-image.js');
const DIST = path.join(SC, 'dist', 'image-generation.js');

if (!fs.existsSync(DIST)) {
  console.error('image-cli: dist/image-generation.js is missing. Run `npm run build` in sidecoach/ first.');
  process.exit(1);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-image-cli-'));
const CACHE = path.join(TMP, 'cache');

/** A clean environment: no provider keys, no consent, no fixture, whatever the developer's shell holds. */
function baseEnv(extra: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = { PATH: process.env.PATH || '', HOME: TMP };
  return { ...env, ...extra };
}

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

// spawnSync, not execFileSync: execFileSync returns only stdout on a zero exit, and several assertions here
// are about what the tool SAYS on stderr while succeeding (the spend notice, the fixture-transport warning).
// Dropping stderr on success would have made those assertions unfailable.
function run(args: string[], env: Record<string, string> = baseEnv()): Run {
  const res = spawnSync('node', [BIN, ...args], { encoding: 'utf8', cwd: SC, env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (res.error) throw res.error;
  return { code: typeof res.status === 'number' ? res.status : -1, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function writeFixture(name: string, value: unknown): string {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, JSON.stringify(value));
  return p;
}

/** A structured 64x64 PNG, base64, for the fixture-backed provider responses. */
function fixturePngB64(): string {
  const w = 64;
  const rgba = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      rgba[i] = 10 + x * 3;
      rgba[i + 1] = x % 6 < 3 ? 30 : 170;
      rgba[i + 2] = 20 + y * 3;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(w, w, rgba).toString('base64');
}

// ---------------------------------------------------------------------------
// 1. Offline: verified, and deterministic
// ---------------------------------------------------------------------------

function testOfflineHappyPath(): void {
  const outA = path.join(TMP, 'offline-a.png');
  const outB = path.join(TMP, 'offline-b.png');
  const prompt = 'an overhead studio shot of folded linen, low contrast, no text';
  const a = run(['generate', '--prompt', prompt, '--out', outA, '--size', '512x384', '--cache-dir', CACHE, '--quiet']);
  assert(a.code === 0, `offline generation exits 0 (got ${a.code}: ${a.stderr.slice(0, 300)})`);
  assert(fs.existsSync(outA), 'the asset is on disk');
  const bytesA = fs.readFileSync(outA);
  assert(bytesA.length > 1000, `the asset has real bytes (got ${bytesA.length})`);
  assert(bytesA[0] === 0x89 && bytesA.toString('latin1', 1, 4) === 'PNG', 'the asset is a real PNG by signature');

  const parsed = JSON.parse(a.stdout);
  assert(parsed.verdict === 'verified', 'the offline asset is reported verified');
  assert(parsed.synthetic === true, 'the offline asset is reported synthetic');
  assert(parsed.live === false && parsed.cost.usd === 0, 'the offline asset cost nothing and is not marked live');
  assert(parsed.verification.checks.length >= 5, 'the report carries the full check list');

  const b = run(['generate', '--prompt', prompt, '--out', outB, '--size', '512x384', '--cache-dir', CACHE, '--quiet']);
  assert(b.code === 0, 'the second offline run also exits 0');
  assert(fs.readFileSync(outB).equals(bytesA), 'two offline runs of the same prompt are byte-identical');

  const different = run(['generate', '--prompt', `${prompt}, warmer`, '--out', path.join(TMP, 'offline-c.png'), '--size', '512x384', '--cache-dir', CACHE, '--quiet']);
  assert(different.code === 0 && !fs.readFileSync(path.join(TMP, 'offline-c.png')).equals(bytesA), 'a different prompt yields different bytes');

  // A FAILED verification must NOT populate the cache. A wrong asset that gets cached is a wrong asset served
  // for free forever, and the next run would report it as a cache hit with no re-check.
  const failCache = path.join(TMP, 'cache-of-failures');
  const failOut = path.join(TMP, 'wrong-size.png');
  const failed = run(['generate', '--prompt', prompt, '--out', failOut, '--size', '512x384', '--expect-size', '256x256', '--cache-dir', failCache, '--quiet']);
  assert(failed.code === 1, `a geometry contract the asset does not meet exits 1 (got ${failed.code})`);
  assert(fs.existsSync(failOut), 'the failed asset is still written so a human can look at it');
  const cachedFiles = fs.existsSync(failCache) ? fs.readdirSync(failCache).filter((f) => f.endsWith('.png')) : [];
  assert(cachedFiles.length === 0, `a failed asset is NOT cached (found ${cachedFiles.join(',')})`);
  const failedJson = JSON.parse(failed.stdout);
  assert(failedJson.verdict === 'failed', 'the JSON verdict is failed, not verified');
  assert(
    failedJson.verification.checks.some((c: { id: string; status: string }) => c.id === 'dimensions-match' && c.status === 'fail'),
    'the geometry check is the one that failed',
  );
  // Without --quiet the tool says out loud that what it wrote is not verified.
  const loud = run(['generate', '--prompt', prompt, '--out', failOut, '--size', '512x384', '--expect-size', '256x256', '--cache-dir', failCache]);
  assert(loud.code === 1 && /NOT VERIFIED/.test(loud.stderr), 'a failed asset is announced as NOT VERIFIED on stderr');

  // Offline mode is png-only and says so rather than writing something mislabelled.
  const wrongFormat = run(['generate', '--prompt', prompt, '--out', path.join(TMP, 'nope.webp'), '--format', 'webp', '--cache-dir', CACHE]);
  assert(wrongFormat.code === 2, `offline with a non-png format is a usage error (got ${wrongFormat.code})`);
  assert(!fs.existsSync(path.join(TMP, 'nope.webp')), 'the rejected format wrote nothing');
}

// ---------------------------------------------------------------------------
// 2. Every failure class: its own code, and nothing written
// ---------------------------------------------------------------------------

function testFailureClasses(): void {
  const key = 'sk-not-a-real-key-never-used';
  const cases: Array<{ label: string; args: string[]; env: Record<string, string>; code: number }> = [
    { label: 'no key', args: ['generate', '--provider', 'openai', '--prompt', 'x', '--out', path.join(TMP, 'f1.png')], env: baseEnv(), code: 4 },
    { label: 'auto with no keys at all', args: ['generate', '--provider', 'auto', '--prompt', 'x', '--out', path.join(TMP, 'f2.png')], env: baseEnv(), code: 4 },
    {
      label: 'no spend consent',
      args: ['generate', '--provider', 'openai', '--prompt', 'x', '--out', path.join(TMP, 'f3.png'), '--assume-cost-usd', '0.1'],
      env: baseEnv({ OPENAI_API_KEY: key }),
      code: 8,
    },
    {
      label: 'unpriced',
      args: ['generate', '--provider', 'openai', '--prompt', 'x', '--out', path.join(TMP, 'f4.png'), '--yes-spend'],
      env: baseEnv({ OPENAI_API_KEY: key }),
      code: 10,
    },
    {
      label: 'over the per-run budget',
      args: ['generate', '--provider', 'openai', '--prompt', 'x', '--out', path.join(TMP, 'f5.png'), '--yes-spend', '--assume-cost-usd', '0.1', '--budget-usd', '0.01'],
      env: baseEnv({ OPENAI_API_KEY: key }),
      code: 7,
    },
    {
      label: 'legacy model id',
      args: ['generate', '--provider', 'openai', '--model', 'gpt-image-1', '--prompt', 'x', '--out', path.join(TMP, 'f6.png'), '--yes-spend', '--assume-cost-usd', '0.1'],
      env: baseEnv({ OPENAI_API_KEY: key }),
      code: 12,
    },
    {
      label: 'legacy nano banana id',
      args: ['generate', '--provider', 'nanobanana', '--model', 'gemini-2.5-flash-image', '--prompt', 'x', '--out', path.join(TMP, 'f7.png'), '--yes-spend'],
      env: baseEnv({ GEMINI_API_KEY: key }),
      code: 12,
    },
    {
      label: 'oversize request',
      args: ['generate', '--provider', 'openai', '--size', '4096x4096', '--prompt', 'x', '--out', path.join(TMP, 'f8.png'), '--yes-spend', '--assume-cost-usd', '0.1'],
      env: baseEnv({ OPENAI_API_KEY: key }),
      code: 11,
    },
  ];

  for (const c of cases) {
    const r = run([...c.args, '--cache-dir', CACHE], c.env);
    assert(r.code === c.code, `${c.label} exits ${c.code} (got ${r.code}: ${r.stderr.slice(0, 200)})`);
    const outPath = c.args[c.args.indexOf('--out') + 1];
    assert(!fs.existsSync(outPath), `${c.label} wrote NO file`);
    assert(/sidecoach-image:/.test(r.stderr), `${c.label} explains itself on stderr`);
  }

  // Provider-side HTTP failure, driven through the test transport: exit 6, nothing written.
  const httpFixture = writeFixture('http-500.json', { status: 500, body: { error: { message: 'upstream exploded' } } });
  const httpFail = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'x', '--out', path.join(TMP, 'f9.png'), '--size', '64x64', '--yes-spend', '--cache-dir', CACHE],
    baseEnv({ GEMINI_API_KEY: key, SIDECOACH_IMAGE_TEST_TRANSPORT: httpFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(httpFail.code === 6, `a provider HTTP failure exits 6 (got ${httpFail.code})`);
  assert(!fs.existsSync(path.join(TMP, 'f9.png')), 'a provider failure wrote NO file');
  assert(/upstream exploded/.test(httpFail.stderr), 'the provider message reaches the operator');

  // A content refusal is reported as a refusal, still exit 6, still nothing written.
  const refusalFixture = writeFixture('refusal.json', { status: 200, body: { prompt_feedback: { block_reason: 'SAFETY' } } });
  const refusal = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'x', '--out', path.join(TMP, 'f10.png'), '--size', '64x64', '--yes-spend', '--cache-dir', CACHE],
    baseEnv({ GEMINI_API_KEY: key, SIDECOACH_IMAGE_TEST_TRANSPORT: refusalFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(refusal.code === 6 && /refusal/.test(refusal.stderr), 'a content refusal is classified as a refusal');
  assert(!fs.existsSync(path.join(TMP, 'f10.png')), 'a refusal wrote NO file');
}

// ---------------------------------------------------------------------------
// 3. Usage errors
// ---------------------------------------------------------------------------

function testUsageErrors(): void {
  const cases: Array<[string, string[]]> = [
    ['no prompt at all', ['generate', '--out', path.join(TMP, 'u1.png')]],
    ['both prompt and prompt-file', ['generate', '--prompt', 'x', '--prompt-file', path.join(TMP, 'missing.txt'), '--out', path.join(TMP, 'u2.png')]],
    ['no --out', ['generate', '--prompt', 'x']],
    ['unknown provider', ['generate', '--prompt', 'x', '--out', path.join(TMP, 'u3.png'), '--provider', 'midjourney-ish']],
    ['bad size', ['generate', '--prompt', 'x', '--out', path.join(TMP, 'u4.png'), '--size', 'huge']],
    ['bad alpha value', ['generate', '--prompt', 'x', '--out', path.join(TMP, 'u5.png'), '--alpha', 'maybe']],
    ['ink-region without ink', ['generate', '--prompt', 'x', '--out', path.join(TMP, 'u6.png'), '--ink-region', '0,0,10,10']],
    ['malformed ink-region', ['generate', '--prompt', 'x', '--out', path.join(TMP, 'u7.png'), '--ink', '#fff', '--ink-region', '0,0,10']],
    ['flag with no value', ['generate', '--prompt']],
    ['unknown flag', ['generate', '--prompt', 'x', '--out', path.join(TMP, 'u8.png'), '--enhance-vibes']],
    ['verify with no file', ['verify', '--expect-size', '64x64']],
    ['verify with no expected size', ['verify', path.join(TMP, 'offline-a.png')]],
  ];
  for (const [label, args] of cases) {
    const r = run([...args, '--cache-dir', CACHE]);
    assert(r.code === 2, `${label} is a usage error (got ${r.code})`);
  }

  // An unreadable prompt file is an IO error, distinct from a usage error.
  const io = run(['generate', '--prompt-file', path.join(TMP, 'does-not-exist.txt'), '--out', path.join(TMP, 'u9.png'), '--cache-dir', CACHE]);
  assert(io.code === 9, `an unreadable prompt file is an IO error (got ${io.code})`);

  // The test transport refuses to engage without its second explicit signal.
  const guarded = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'x', '--out', path.join(TMP, 'u10.png'), '--size', '64x64', '--yes-spend', '--cache-dir', CACHE],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: writeFixture('unused.json', { status: 200, body: {} }) }),
  );
  assert(guarded.code === 2 && /ALLOW_FIXTURE/.test(guarded.stderr), 'the test transport needs a second explicit signal');
}

// ---------------------------------------------------------------------------
// 4. Cache: proven by a transport that would throw if it were called
// ---------------------------------------------------------------------------

function testCacheAndLedger(): void {
  const cacheDir = path.join(TMP, 'cache-proof');
  const out1 = path.join(TMP, 'cached-1.png');
  const out2 = path.join(TMP, 'cached-2.png');
  const prompt = 'a single ripe persimmon on a concrete ledge, north light';
  const okFixture = writeFixture('nb-ok.json', { status: 200, body: { output_image: { data: fixturePngB64() }, usage: { input_tokens: 11, output_tokens: 1120 } } });
  const boomFixture = writeFixture('nb-boom.json', { throw: 'the cache did not hold, so the provider was called again' });

  const first = run(
    ['generate', '--provider', 'nanobanana', '--prompt', prompt, '--out', out1, '--size', '64x64', '--yes-spend', '--cache-dir', cacheDir, '--quiet'],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: okFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(first.code === 0, `a fixture-backed generation verifies and exits 0 (got ${first.code}: ${first.stderr.slice(0, 400)})`);
  const firstJson = JSON.parse(first.stdout);
  assert(firstJson.verdict === 'verified', 'the fixture-backed asset verifies');
  assert(firstJson.cached === false, 'the first run is not a cache hit');
  assert(firstJson.transport === 'test-fixture' && firstJson.live === false, 'a fixture-backed run is stamped as NOT live');
  assert(/TEST FIXTURE/.test(first.stderr), 'a fixture-backed run announces itself loudly');
  assert(firstJson.cost.basis === 'usage-derived' && firstJson.cost.usd > 0, `the cost is derived from reported usage (got ${JSON.stringify(firstJson.cost)})`);
  assert(firstJson.synthetic === false, 'a provider-shaped asset is not marked synthetic');

  // The spend notice was stated before the call.
  assert(/SPEND NOTICE/.test(first.stderr), 'the spend notice is stated before the first live call of a session');

  // Second run: identical request, transport that THROWS. Passing proves the cache served it.
  const second = run(
    ['generate', '--provider', 'nanobanana', '--prompt', prompt, '--out', out2, '--size', '64x64', '--yes-spend', '--cache-dir', cacheDir, '--quiet'],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: boomFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(second.code === 0, `the cached run exits 0 (got ${second.code}: ${second.stderr.slice(0, 300)})`);
  const secondJson = JSON.parse(second.stdout);
  assert(secondJson.cached === true, 'the second identical request is served from cache');
  assert(secondJson.cost.usd === 0 && secondJson.cost.basis === 'cache-hit', 'a cache hit costs nothing');
  assert(fs.readFileSync(out2).equals(fs.readFileSync(out1)), 'the cached bytes are the same bytes');

  // --no-cache goes back to the provider: the throwing fixture must now actually be reached.
  const bypass = run(
    ['generate', '--provider', 'nanobanana', '--prompt', prompt, '--out', path.join(TMP, 'cached-3.png'), '--size', '64x64', '--yes-spend', '--no-cache', '--cache-dir', cacheDir, '--quiet'],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: boomFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(bypass.code === 6, `--no-cache reaches the provider and reports its failure (got ${bypass.code})`);

  // The ledger recorded exactly one spend, and the budget subcommand reports it.
  const budget = run(['budget', '--cache-dir', cacheDir, '--quiet']);
  assert(budget.code === 0, 'the budget subcommand exits 0');
  const ledger = JSON.parse(budget.stdout);
  assert(ledger.entries === 1, `the ledger holds exactly the one call that spent (got ${ledger.entries})`);
  assert(ledger.totalUsd > 0, 'the ledger total is the recorded spend');
  assert(ledger.ledger[0].provider === 'nanobanana' && ledger.ledger[0].model === 'gemini-3.1-flash-image', 'the ledger names the provider and model that spent');

  // --no-cache governs the IMAGE BYTES, not the accounting. A run with --no-cache must still record its spend,
  // or a cumulative cap could be walked straight past with no trace. Codex review 2026-07-29, spend finding 2.
  const noCacheDir = path.join(TMP, 'cache-nocache-ledger');
  const noCacheRun = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'a bowl of cherries on slate', '--out', path.join(TMP, 'nocache.png'), '--size', '64x64', '--yes-spend', '--no-cache', '--cache-dir', noCacheDir, '--quiet'],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: okFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(noCacheRun.code === 0, `a --no-cache run still completes (got ${noCacheRun.code}: ${noCacheRun.stderr.slice(0, 300)})`);
  const noCacheLedger = JSON.parse(run(['budget', '--cache-dir', noCacheDir, '--quiet']).stdout);
  assert(noCacheLedger.entries === 1, `a --no-cache run STILL records its spend in the ledger (got ${noCacheLedger.entries})`);
  assert(noCacheLedger.totalUsd > 0, 'the recorded --no-cache spend is nonzero');
  const noCacheAssets = fs.existsSync(noCacheDir) ? fs.readdirSync(noCacheDir).filter((f) => f.endsWith('.png')) : [];
  assert(noCacheAssets.length === 0, 'but --no-cache still stores NO image bytes');
  // And the cumulative cap now bites on the next --no-cache call, which was the hole.
  const cappedNoCache = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'a bowl of cherries on slate, closer', '--out', path.join(TMP, 'nocache2.png'), '--size', '64x64', '--yes-spend', '--no-cache', '--budget-total-usd', '0.00001', '--cache-dir', noCacheDir],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: boomFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(cappedNoCache.code === 7, `the cumulative cap applies under --no-cache too (got ${cappedNoCache.code})`);
  assert(!fs.existsSync(path.join(TMP, 'nocache2.png')), 'the capped --no-cache call wrote nothing');

  // A MEASURED cost above the cap: the preflight passed on the published projection (0.045 at the 0.5K tier) and
  // the reported usage prices out to 0.12, which is over the 0.05 cap. The money is gone, so the tool reports the
  // overrun loudly and exits 7 rather than printing a clean success. Codex spend finding 3.
  const overrunDir = path.join(TMP, 'cache-overrun');
  const expensiveFixture = writeFixture('nb-expensive.json', { status: 200, body: { output_image: { data: fixturePngB64() }, usage: { input_tokens: 10, output_tokens: 2000 } } });
  const overrun = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'an expensive plate of light', '--out', path.join(TMP, 'overrun.png'), '--size', '64x64', '--yes-spend', '--budget-usd', '0.05', '--cache-dir', overrunDir],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: expensiveFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(overrun.code === 7, `a measured cost above the cap exits 7 (got ${overrun.code}: ${overrun.stderr.slice(0, 300)})`);
  assert(/BUDGET OVERRUN/.test(overrun.stderr), 'the overrun is announced loudly');
  const overrunJson = JSON.parse(overrun.stdout);
  assert(typeof overrunJson.budgetOverrun === 'string' && overrunJson.budgetOverrun.length > 0, 'the overrun is recorded in the result JSON');
  assert(overrunJson.verdict === 'verified', 'the asset itself still carries its own verdict, which the exit code does not erase');
  assert(overrunJson.cost.usd > 0.05, `the recorded cost is the measured one, above the cap (got ${overrunJson.cost.usd})`);
  const overrunLedger = JSON.parse(run(['budget', '--cache-dir', overrunDir, '--quiet']).stdout);
  assert(overrunLedger.entries === 1 && overrunLedger.totalUsd > 0.05, 'the overspend is recorded so the cumulative cap catches the next call');

  // A provider that reports NO usage after a completed call gets the distinct unmetered-projection label, never
  // a figure that reads as measured. Codex spend finding 1.
  const unmeteredDir = path.join(TMP, 'cache-unmetered');
  const unmeteredFixture = writeFixture('nb-no-usage.json', { status: 200, body: { output_image: { data: fixturePngB64() } } });
  const unmetered = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'a plate with no receipt', '--out', path.join(TMP, 'unmetered.png'), '--size', '64x64', '--yes-spend', '--cache-dir', unmeteredDir, '--quiet'],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: unmeteredFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(unmetered.code === 0, `the call completes (got ${unmetered.code}: ${unmetered.stderr.slice(0, 300)})`);
  const unmeteredJson = JSON.parse(unmetered.stdout);
  assert(unmeteredJson.cost.basis === 'unmetered-projection', `an unmeasured cost is labelled unmetered-projection (got ${unmeteredJson.cost.basis})`);
  assert(/NOT a measurement/.test(unmeteredJson.cost.detail), 'the detail says plainly that it is not a measurement');
  assert(/no token usage/.test(unmetered.stderr), 'the operator is told on stderr');

  // An UNREADABLE ledger cannot support a cumulative cap, and it must not be overwritten either: whatever it
  // holds may be the only record of real spend. Codex re-review 2026-07-29, finding 1.
  const corruptDir = path.join(TMP, 'cache-corrupt-ledger');
  fs.mkdirSync(corruptDir, { recursive: true });
  const corruptLedger = path.join(corruptDir, 'spend-ledger.json');
  fs.writeFileSync(corruptLedger, '{ this is not json at all');
  const cappedOnCorrupt = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'a plate against an unreadable ledger', '--out', path.join(TMP, 'corrupt1.png'), '--size', '64x64', '--yes-spend', '--budget-total-usd', '1.00', '--cache-dir', corruptDir],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: boomFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(cappedOnCorrupt.code === 7, `a cumulative cap over an unreadable ledger refuses to spend (got ${cappedOnCorrupt.code})`);
  assert(/unreadable/.test(cappedOnCorrupt.stderr), 'the refusal says the ledger is unreadable');
  assert(!fs.existsSync(path.join(TMP, 'corrupt1.png')), 'the refusal wrote no asset');
  assert(fs.readFileSync(corruptLedger, 'utf8') === '{ this is not json at all', 'the unreadable ledger was NOT touched');

  // With no cumulative cap the call may proceed, but the unreadable file is moved aside rather than clobbered.
  const proceedOnCorrupt = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'a plate beside a quarantined ledger', '--out', path.join(TMP, 'corrupt2.png'), '--size', '64x64', '--yes-spend', '--cache-dir', corruptDir],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: okFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(proceedOnCorrupt.code === 0, `without a cumulative cap the call proceeds (got ${proceedOnCorrupt.code}: ${proceedOnCorrupt.stderr.slice(0, 300)})`);
  const quarantined = fs.readdirSync(corruptDir).filter((f) => f.startsWith('spend-ledger.unreadable-'));
  assert(quarantined.length === 1, `the unreadable ledger was quarantined, not destroyed (found ${quarantined.join(',')})`);
  assert(fs.readFileSync(path.join(corruptDir, quarantined[0]), 'utf8') === '{ this is not json at all', 'the quarantined file still holds the original bytes');
  const rebuilt = JSON.parse(run(['budget', '--cache-dir', corruptDir, '--quiet']).stdout);
  assert(rebuilt.ledgerStatus === 'ok' && rebuilt.entries === 1, 'a fresh readable ledger starts from that call');

  // A live request that WENT OUT and failed is recorded as an attempt: no cost, but a durable trace.
  const attemptDir = path.join(TMP, 'cache-attempts');
  const refusedFixture = writeFixture('nb-refused-for-ledger.json', { status: 200, body: { prompt_feedback: { block_reason: 'SAFETY' } } });
  const attemptRun = run(
    ['generate', '--provider', 'nanobanana', '--prompt', 'a plate the provider refuses', '--out', path.join(TMP, 'refused.png'), '--size', '64x64', '--yes-spend', '--cache-dir', attemptDir],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: refusedFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(attemptRun.code === 6, `a refused request exits 6 (got ${attemptRun.code})`);
  const attemptLedger = JSON.parse(run(['budget', '--cache-dir', attemptDir, '--quiet']).stdout);
  assert(attemptLedger.entries === 0 && attemptLedger.totalUsd === 0, 'a failed request records NO cost');
  assert(attemptLedger.failedAttempts === 1, `but the issued-and-failed request IS recorded (got ${attemptLedger.failedAttempts})`);
  assert(attemptLedger.attempts[0].kind === 'refusal' && attemptLedger.attempts[0].provider === 'nanobanana', 'the attempt record names what happened and to whom');

  // A no-key or no-consent failure never issued a request, so it records nothing at all.
  const notIssuedDir = path.join(TMP, 'cache-not-issued');
  run(['generate', '--provider', 'nanobanana', '--prompt', 'x', '--out', path.join(TMP, 'noissue.png'), '--size', '64x64', '--cache-dir', notIssuedDir], baseEnv({ GEMINI_API_KEY: 'k' }));
  const notIssued = JSON.parse(run(['budget', '--cache-dir', notIssuedDir, '--quiet']).stdout);
  assert(notIssued.entries === 0 && notIssued.failedAttempts === 0, 'a request that was never issued records neither cost nor attempt');

  // Spend that cannot be RECORDED is a hard failure, not a warning: make the ledger directory unwritable and
  // confirm the tool exits 9 and says the money is untracked. Codex re-review finding 1.
  const lockedDir = path.join(TMP, 'cache-locked');
  fs.mkdirSync(lockedDir, { recursive: true });
  fs.chmodSync(lockedDir, 0o500);
  let lockedCode = -1;
  let lockedStderr = '';
  let lockedStdout = '';
  try {
    const locked = run(
      ['generate', '--provider', 'nanobanana', '--prompt', 'a plate nobody can account for', '--out', path.join(TMP, 'locked.png'), '--size', '64x64', '--yes-spend', '--cache-dir', lockedDir, '--quiet'],
      baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: okFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
    );
    lockedCode = locked.code;
    lockedStderr = locked.stderr;
    lockedStdout = locked.stdout;
  } finally {
    fs.chmodSync(lockedDir, 0o700);
  }
  assert(lockedCode === 9, `spend that could not be recorded exits 9 (got ${lockedCode}: ${lockedStderr.slice(0, 300)})`);
  assert(/SPEND WAS INCURRED AND THE LEDGER WRITE FAILED/.test(lockedStderr), 'the untracked spend is announced in the loudest terms available');
  const lockedJson = JSON.parse(lockedStdout);
  assert(typeof lockedJson.ledgerWriteFailed === 'string' && lockedJson.ledgerWriteFailed.length > 0, 'the failure is recorded in the result JSON');
  assert(lockedJson.verdict === 'verified', 'the asset verdict is still reported even though the exit code is about the ledger');

  // A cumulative cap that the ledger already exceeds blocks the next call before it goes out.
  const capped = run(
    ['generate', '--provider', 'nanobanana', '--prompt', `${prompt} at dusk`, '--out', path.join(TMP, 'capped.png'), '--size', '64x64', '--yes-spend', '--budget-total-usd', '0.00001', '--cache-dir', cacheDir],
    baseEnv({ GEMINI_API_KEY: 'k', SIDECOACH_IMAGE_TEST_TRANSPORT: boomFixture, SIDECOACH_IMAGE_ALLOW_FIXTURE: '1' }),
  );
  assert(capped.code === 7, `a cumulative cap already exceeded blocks the call (got ${capped.code})`);
  assert(!fs.existsSync(path.join(TMP, 'capped.png')), 'a budget rejection wrote nothing');
}

// ---------------------------------------------------------------------------
// 5. Verification outcomes on real files, through the CLI
// ---------------------------------------------------------------------------

function testVerifySubcommand(): void {
  const good = path.join(TMP, 'offline-a.png');

  // Declared correctly as the placeholder it is: verified.
  const honest = run(['verify', good, '--expect-size', '512x384', '--provider', 'offline', '--quiet']);
  assert(honest.code === 0, `an honestly-declared placeholder verifies (got ${honest.code})`);

  // The same file claimed as a real provider render: failed on provenance.
  const laundered = run(['verify', good, '--expect-size', '512x384', '--quiet']);
  assert(laundered.code === 1, `a laundered placeholder fails (got ${laundered.code})`);
  assert(/provenance-matches/.test(JSON.parse(laundered.stdout).verification.checks.map((c: { id: string }) => c.id).join(',')), 'the provenance check is the one that fired');

  // Wrong expected geometry: failed.
  const wrongSize = run(['verify', good, '--expect-size', '1024x1024', '--provider', 'offline', '--quiet']);
  assert(wrongSize.code === 1, `a geometry mismatch fails (got ${wrongSize.code})`);

  // A blank asset: failed on the blank check.
  const blank = path.join(TMP, 'blank.png');
  const flat = new Uint8Array(32 * 32 * 4).fill(255);
  fs.writeFileSync(blank, encodePng(32, 32, flat));
  const blankRun = run(['verify', blank, '--expect-size', '32x32', '--quiet']);
  assert(blankRun.code === 1, `a blank asset fails (got ${blankRun.code})`);
  const blankIds = JSON.parse(blankRun.stdout).verification.checks.filter((c: { status: string }) => c.status === 'fail').map((c: { id: string }) => c.id);
  assert(blankIds.includes('rendered-not-blank'), `the blank check is among the failures (${blankIds.join(',')})`);

  // A format whose pixels cannot be decoded: UNVERIFIED, exit 3, never 0.
  const jpegPath = path.join(TMP, 'tiny.jpg');
  // 21 bytes: the declared SOF0 segment length of 17 ends at byte 20 inclusive; a shorter file is truncated.
  const sof = Buffer.alloc(21);
  sof[0] = 0xff;
  sof[1] = 0xd8;
  sof[2] = 0xff;
  sof[3] = 0xc0;
  sof.writeUInt16BE(17, 4);
  sof[6] = 8;
  sof.writeUInt16BE(32, 7);
  sof.writeUInt16BE(32, 9);
  sof[11] = 3;
  fs.writeFileSync(jpegPath, sof);
  const jpegRun = run(['verify', jpegPath, '--expect-size', '32x32', '--expect-format', 'jpeg', '--quiet']);
  assert(jpegRun.code === 3, `an undecodable format is UNVERIFIED with exit 3 (got ${jpegRun.code})`);
  const jpegJson = JSON.parse(jpegRun.stdout);
  assert(jpegJson.verdict === 'unverified', 'the verdict is unverified, not verified');
  assert(jpegJson.verification.unverifiedReasons.length > 0, 'the unverified reasons are named');

  // A missing file is an IO error.
  assert(run(['verify', path.join(TMP, 'nope.png'), '--expect-size', '32x32', '--quiet']).code === 9, 'a missing file is an IO error');

  // --help answers without touching anything.
  const help = run(['--help']);
  assert(help.code === 0 && /Exit: 0 verified/.test(help.stderr), 'help documents the exit contract');
}

function main(): void {
  testOfflineHappyPath();
  testFailureClasses();
  testUsageErrors();
  testCacheAndLedger();
  testVerifySubcommand();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('image-cli: OK (offline verified + deterministic, failed asset never cached, ten failure classes each writing nothing, twelve usage errors, cache hit proven by a throwing transport, ledger kept under --no-cache, measured-overrun exit 7, unmetered-projection label, verify verdicts including unverified)');
}

main();
