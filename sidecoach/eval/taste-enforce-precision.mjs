#!/usr/bin/env node
/**
 * Phase 3b Step 5: the HELD-OUT PRECISION HARNESS for the taste-enforce gate.
 *
 * A mined rule may only cross from advisory GUIDANCE to build-BLOCKING enforcement if its
 * data-driven detector (the FROZEN patternSpec) is precise OUT OF SAMPLE. This harness measures
 * that precision the honest way and REFUSES when it cannot:
 *
 *   - It runs the SHIPPING re2-backed interpreter (dist/validators/checks/pattern-interpreter.js -
 *     no reimplementation) over the candidate's exampleCorpus HELD-OUT split PLUS a shared negative
 *     pool. Measuring on synthetic-positives-only gives an unfalsifiable P=1.000 (the taste-precision
 *     lesson: default-typeface scored 1.000 on synthetic positives; nested-cards could not validate
 *     on a 4-fire held-out) - so real held-out negatives + a shared pool carry the false-positive term.
 *   - precision = TP / (TP + FP), where a "fire" is the interpreter returning status 'fail'.
 *   - The bar is TWO gates, BOTH required: P >= 0.90 AND a minimum-denominator FLOOR
 *     (>= MIN_HELDOUT_POSITIVES held-out positives AND >= MIN_FIRES total fires). Under floor is a
 *     REFUSAL ("cannot validate out of sample"), NOT a pass - a tiny denominator validates nothing.
 *   - BUILD-STAMP: the report is stamped with a hash of the interpreter source + dist. A cached
 *     report from a DIFFERENT interpreter build is stale and `verify-cache` refuses it (exit 6) -
 *     scoring an old report against new code produces numbers that look normal and mean nothing.
 *   - PRECISION-DIGEST: sha256 over the stable report fields (spec + corpus + build + the measured
 *     tp/fp/floor/pass). This is what the human signs (`enforce-confirm <ruleId> <precision-digest>`)
 *     and what the enforce CLI re-derives from a FRESH measurement, so a sign-off is bound to the
 *     exact precision it was granted for; any spec/corpus/build change moves the digest.
 *
 * The interpreter runs UNTRUSTED candidate regexes through re2 (linear time). If re2 is unavailable
 * every spec is inconclusive (never a fire) -> no fires -> under-floor REFUSAL. Fail-closed.
 *
 * USAGE:
 *   node eval/taste-enforce-precision.mjs measure <ruleId> --rule-file <path> [--base-dir <dir>]
 *        [--negatives-dir <dir>] [--json]          measure fresh, write a stamped cache, print the digest
 *   node eval/taste-enforce-precision.mjs verify-cache <ruleId>   refuse (exit 6) a stale cached report
 *   node eval/taste-enforce-precision.mjs show <ruleId>           print the cached report (no staleness gate)
 *
 * <rule-file> is a JSON carrying the rule body ({ rule: { patternSpec, exampleCorpus } } as a
 * quarantine/guidance/enforced record, OR a bare { patternSpec, exampleCorpus }). --base-dir resolves
 * each exampleCorpus.file relative path (default: the sidecoach repo root). --negatives-dir adds a
 * shared clean-page pool (every file counts as a labeled-clean negative).
 *
 * EXIT: 0 pass | 2 usage | 3 rule/corpus/io error | 4 under threshold (measured, P<0.90) |
 *       6 stale cache | 7 under-floor denominator (REFUSE - cannot validate out of sample)
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);                 // the sidecoach repo root
const CACHE_DIR = process.env.SIDECOACH_ENFORCE_PRECISION_CACHE || path.join(HERE, '.taste-enforce-cache');

// The bar. Documented, reviewed constants. The env overrides are a TEST SEAM honored ONLY under a test
// root (SIDECOACH_ENFORCE_TEST_ROOT) - Codex MEDIUM #3: in production the floor is the fixed 0.90/8/8,
// so an agent cannot weaken it (e.g. MIN_FIRES=0 to certify a tiny-denominator P=1.0) for a real
// measurement the enforce gate inherits. The floor the run used is recorded in the report, and the
// codegen re-checks it against the production constants, so even a forged record is rejected.
const IN_TEST_ROOT = !!process.env.SIDECOACH_ENFORCE_TEST_ROOT;
const THRESHOLD = IN_TEST_ROOT ? numEnv('SIDECOACH_ENFORCE_PRECISION_THRESHOLD', 0.90) : 0.90;
const MIN_HELDOUT_POSITIVES = IN_TEST_ROOT ? intEnv('SIDECOACH_ENFORCE_MIN_HELDOUT_POSITIVES', 8) : 8;
const MIN_FIRES = IN_TEST_ROOT ? intEnv('SIDECOACH_ENFORCE_MIN_FIRES', 8) : 8;

const EXIT = { OK: 0, USAGE: 2, RULE_ERROR: 3, UNDER_THRESHOLD: 4, STALE_CACHE: 6, UNDER_FLOOR: 7 };

function numEnv(k, d) { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? v : d; }
function intEnv(k, d) { const v = parseInt(process.env[k] || '', 10); return Number.isFinite(v) && v >= 0 ? v : d; }

function die(code, msg) { process.stderr.write(`taste-enforce-precision: ${msg}\n`); process.exit(code); }

// ---------------------------------------------------------------------------
// build stamp - identical discipline to eval/taste-precision-sweep.mjs. A cached report built from a
// different interpreter build is meaningless, so the stamp pins BOTH the src and the compiled dist of
// the two files that decide a verdict (pattern-spec.ts + pattern-interpreter.ts).
// ---------------------------------------------------------------------------
// The stamp is the interpreter SOURCE (pattern-spec.ts + pattern-interpreter.ts). It is source-only so
// the codegen (generate-enforced-rules.ts, which runs BEFORE tsc emits dist) computes the identical
// stamp - the dist is a deterministic compile of exactly these two files, so hashing the source
// detects any interpreter change without a build-order dependency on dist. (The dist must still EXIST
// to actually run the interpreter; that is a separate existence check, not part of the stamp.)
function currentBuildStamp() {
  const parts = [
    'src/validators/pattern-spec.ts',
    'src/validators/checks/pattern-interpreter.ts',
  ];
  const h = createHash('sha256');
  for (const rel of parts) {
    const f = path.join(ROOT, rel);
    if (!existsSync(f)) die(EXIT.RULE_ERROR, `interpreter source ${rel} missing (cannot stamp)`);
    h.update(readFileSync(f, 'utf8'));
  }
  return h.digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// deterministic serialization (recursively key-sorted) - the digest must not depend on key order.
// ---------------------------------------------------------------------------
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function sha256(s) { return createHash('sha256').update(s, 'utf8').digest('hex'); }

// ---------------------------------------------------------------------------
// rule + corpus loading
// ---------------------------------------------------------------------------
function loadRuleFile(p) {
  let obj;
  try { obj = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { die(EXIT.RULE_ERROR, `rule file ${p} unreadable/invalid JSON: ${e.message}`); }
  // Accept a quarantine/guidance/enforced record ({ rule: {...} }) OR a bare rule body.
  const body = obj && obj.rule && typeof obj.rule === 'object' ? obj.rule : obj;
  if (!body || typeof body !== 'object') die(EXIT.RULE_ERROR, `rule file ${p} has no rule body`);
  if (!body.patternSpec || typeof body.patternSpec !== 'object') die(EXIT.RULE_ERROR, `rule "${body.ruleId || '(no id)'}" carries no patternSpec (not a runnable mined detector)`);
  if (!body.exampleCorpus || typeof body.exampleCorpus !== 'object') die(EXIT.RULE_ERROR, `rule "${body.ruleId || '(no id)'}" carries no exampleCorpus (nothing to measure precision on)`);
  return body;
}

/** Build a ProductCheckContext-shaped object from ONE corpus file (deterministic; no browser). */
function ctxFromFile(absPath) {
  const content = readFileSync(absPath, 'utf8');
  const isCss = absPath.toLowerCase().endsWith('.css');
  let cssText = '';
  let markup = '';
  if (isCss) { cssText = content; } else {
    markup = content;
    cssText = [...content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  }
  const files = [];
  if (cssText) files.push({ path: isCss ? path.basename(absPath) : 'inline.css', sourceKind: 'css', cssText, markup: '', evidenceKindsPresent: ['css'] });
  if (markup) files.push({ path: path.basename(absPath), sourceKind: 'html', cssText: '', markup, evidenceKindsPresent: ['markup'] });
  return { cssText, markup, files };
}

function readExamples(bucket, refs, expectedLabel, baseDir) {
  const out = [];
  if (!Array.isArray(refs)) return out;
  for (const ref of refs) {
    if (!ref || typeof ref.file !== 'string') die(EXIT.RULE_ERROR, `exampleCorpus.${bucket} entry missing a string 'file'`);
    if (ref.split !== 'heldout') continue;   // held-out ONLY: never measure on the tune split
    const abs = path.isAbsolute(ref.file) ? ref.file : path.join(baseDir, ref.file);
    if (!existsSync(abs)) die(EXIT.RULE_ERROR, `exampleCorpus.${bucket} file not found: ${ref.file} (resolved ${abs})`);
    const content = readFileSync(abs, 'utf8');
    const contentSha256 = sha256(content);
    if (ref.contentSha256 && ref.contentSha256 !== contentSha256) {
      die(EXIT.RULE_ERROR, `exampleCorpus.${bucket} file ${ref.file} content does not match its frozen contentSha256 (corpus tampered since freeze)`);
    }
    out.push({ id: String(ref.id || path.basename(abs)), file: ref.file, abs, contentSha256, label: expectedLabel });
  }
  return out;
}

function readSharedNegatives(dir) {
  if (!dir) return [];
  let names;
  try { names = readdirSync(dir); } catch (e) { die(EXIT.RULE_ERROR, `--negatives-dir ${dir} unreadable: ${e.message}`); }
  const out = [];
  for (const n of names.sort()) {
    if (!/\.(html?|css)$/i.test(n)) continue;
    const abs = path.join(dir, n);
    try { if (!statSync(abs).isFile()) continue; } catch (_e) { continue; }
    const content = readFileSync(abs, 'utf8');
    out.push({ id: `shared:${n}`, file: n, abs, contentSha256: sha256(content), label: 'clean' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// measure
// ---------------------------------------------------------------------------
async function loadInterpreter() {
  const distInterp = path.join(ROOT, 'dist/validators/checks/pattern-interpreter.js');
  if (!existsSync(distInterp)) die(EXIT.RULE_ERROR, `dist interpreter missing (${distInterp}). Run: npm run build`);
  const m = await import(distInterp);
  if (typeof m.interpretPatternSpec !== 'function') die(EXIT.RULE_ERROR, 'dist interpreter has no interpretPatternSpec export');
  return m.interpretPatternSpec;
}

function fires(interpret, spec, absPath) {
  const verdict = interpret(spec, ctxFromFile(absPath));
  return { fired: verdict && verdict.status === 'fail', status: verdict ? verdict.status : 'inconclusive' };
}

async function cmdMeasure(ruleId, opts) {
  if (!ruleId) die(EXIT.USAGE, 'measure requires a <ruleId>');
  if (!opts.ruleFile) die(EXIT.USAGE, 'measure requires --rule-file <path>');
  const body = loadRuleFile(opts.ruleFile);
  const spec = body.patternSpec;
  const baseDir = opts.baseDir || ROOT;
  const buildStamp = currentBuildStamp();

  const pos = readExamples('positives', body.exampleCorpus.positives, 'fires', baseDir);
  const negHeldout = readExamples('negatives', body.exampleCorpus.negatives, 'clean', baseDir);
  const shared = readSharedNegatives(opts.negativesDir);
  const negatives = [...negHeldout, ...shared];

  const interpret = await loadInterpreter();
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const fpIds = [], fnIds = [];
  for (const ex of pos) { const r = fires(interpret, spec, ex.abs); if (r.fired) tp += 1; else { fn += 1; fnIds.push(ex.id); } }
  for (const ex of negatives) { const r = fires(interpret, spec, ex.abs); if (r.fired) { fp += 1; fpIds.push(ex.id); } else tn += 1; }

  const firesTotal = tp + fp;
  const precision = firesTotal > 0 ? tp / firesTotal : null;
  const floorPositivesMet = pos.length >= MIN_HELDOUT_POSITIVES;
  const floorFiresMet = firesTotal >= MIN_FIRES;
  const floorsMet = floorPositivesMet && floorFiresMet;
  const thresholdMet = precision !== null && precision >= THRESHOLD;
  const pass = floorsMet && thresholdMet;

  // corpus fingerprint (order-independent): binds the digest to the exact held-out + shared content.
  const corpusFingerprint = [...pos, ...negatives]
    .map((e) => `${e.label}:${e.file}:${e.contentSha256}`).sort();
  const specHash = sha256(canonical(spec));

  // The stable report the digest is computed over (NO timestamps / volatile fields).
  const stable = {
    ruleId, buildStamp, specHash,
    threshold: THRESHOLD, minHeldoutPositives: MIN_HELDOUT_POSITIVES, minFires: MIN_FIRES,
    heldoutPositives: pos.length, heldoutNegatives: negHeldout.length, sharedNegatives: shared.length,
    tp, fp, fn, tn, fires: firesTotal,
    precision: precision === null ? null : Number(precision.toFixed(6)),
    floorsMet, thresholdMet, pass,
    corpusFingerprint,
  };
  const precisionDigest = sha256(canonical(stable));

  const report = { ...stable, precisionDigest, fpIds, fnIds, measured_utc: new Date().toISOString() };
  writeCache(ruleId, report);

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    printHuman(report);
  }
  if (!floorsMet) process.exit(EXIT.UNDER_FLOOR);
  if (!thresholdMet) process.exit(EXIT.UNDER_THRESHOLD);
  process.exit(EXIT.OK);
}

function printHuman(r) {
  const p = r.precision === null ? 'n/a (no fires)' : r.precision.toFixed(3);
  process.stdout.write(`taste-enforce-precision: rule "${r.ruleId}"\n`);
  process.stdout.write(`  held-out positives : ${r.heldoutPositives}  (floor >= ${r.minHeldoutPositives}: ${r.heldoutPositives >= r.minHeldoutPositives ? 'met' : 'UNDER'})\n`);
  process.stdout.write(`  held-out negatives : ${r.heldoutNegatives}  shared negatives: ${r.sharedNegatives}\n`);
  process.stdout.write(`  TP=${r.tp} FP=${r.fp} FN=${r.fn} TN=${r.tn}  fires=${r.fires} (floor >= ${r.minFires}: ${r.fires >= r.minFires ? 'met' : 'UNDER'})\n`);
  process.stdout.write(`  precision          : ${p}  (threshold >= ${r.threshold})\n`);
  process.stdout.write(`  VERDICT            : ${r.pass ? 'PASS - eligible for enforce' : (!r.floorsMet ? 'REFUSE - cannot validate out of sample (denominator under floor)' : 'REJECT - precision below threshold')}\n`);
  process.stdout.write(`  build stamp        : ${r.buildStamp}\n`);
  process.stdout.write(`  PRECISION DIGEST   : ${r.precisionDigest}\n`);
  if (r.pass) process.stdout.write(`  To enforce, type in YOUR OWN prompt:  enforce-confirm ${r.ruleId} ${r.precisionDigest}\n`);
  if (r.fpIds && r.fpIds.length) process.stdout.write(`  false positives    : ${r.fpIds.join(', ')}\n`);
  if (r.fnIds && r.fnIds.length) process.stdout.write(`  false negatives    : ${r.fnIds.join(', ')}\n`);
}

// ---------------------------------------------------------------------------
// cache
// ---------------------------------------------------------------------------
function cachePath(ruleId) { return path.join(CACHE_DIR, `${sanitizeId(ruleId)}.json`); }
function sanitizeId(id) { return String(id).replace(/[^A-Za-z0-9._-]+/g, '_'); }
function writeCache(ruleId, report) {
  try { mkdirSync(CACHE_DIR, { recursive: true }); } catch (_e) { /* exists */ }
  writeFileSync(cachePath(ruleId), JSON.stringify(report, null, 2) + '\n');
}
function readCache(ruleId) {
  const f = cachePath(ruleId);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch (_e) { return null; }
}

function cmdVerifyCache(ruleId) {
  if (!ruleId) die(EXIT.USAGE, 'verify-cache requires a <ruleId>');
  const rec = readCache(ruleId);
  if (!rec) die(EXIT.RULE_ERROR, `no cached precision report for "${ruleId}" (run measure first)`);
  const current = currentBuildStamp();
  if (rec.buildStamp !== current) {
    process.stderr.write(`taste-enforce-precision: cached report for "${ruleId}" is STALE.\n`);
    process.stderr.write(`  cache buildStamp=${rec.buildStamp || '(none)'}  current=${current}\n`);
    process.stderr.write('  A report scored under a different interpreter build is meaningless. Re-run: npm run build && measure.\n');
    process.exit(EXIT.STALE_CACHE);
  }
  process.stdout.write(`taste-enforce-precision: cached report for "${ruleId}" is fresh (buildStamp ${current}); pass=${rec.pass}, digest ${rec.precisionDigest}\n`);
  process.exit(EXIT.OK);
}

function cmdShow(ruleId) {
  if (!ruleId) die(EXIT.USAGE, 'show requires a <ruleId>');
  const rec = readCache(ruleId);
  if (!rec) die(EXIT.RULE_ERROR, `no cached precision report for "${ruleId}"`);
  process.stdout.write(JSON.stringify(rec, null, 2) + '\n');
  process.exit(EXIT.OK);
}

// ---------------------------------------------------------------------------
// args + main
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const cmd = argv[0];
  const positional = [];
  const opts = { json: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--rule-file') { opts.ruleFile = argv[++i]; }
    else if (a === '--base-dir') { opts.baseDir = argv[++i]; }
    else if (a === '--negatives-dir') { opts.negativesDir = argv[++i]; }
    else positional.push(a);
  }
  return { cmd, ruleId: positional[0], opts };
}

function usage() {
  process.stderr.write(`taste-enforce-precision - held-out precision gate for the taste-enforce path.
Usage:
  node eval/taste-enforce-precision.mjs measure <ruleId> --rule-file <path> [--base-dir <dir>] [--negatives-dir <dir>] [--json]
  node eval/taste-enforce-precision.mjs verify-cache <ruleId>
  node eval/taste-enforce-precision.mjs show <ruleId>
Exit: 0 pass, 2 usage, 3 rule/corpus/io error, 4 under threshold, 6 stale cache, 7 under-floor denominator (REFUSE).
`);
}

async function main() {
  const { cmd, ruleId, opts } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case 'measure': await cmdMeasure(ruleId, opts); break;
    case 'verify-cache': cmdVerifyCache(ruleId); break;
    case 'show': cmdShow(ruleId); break;
    case '-h': case '--help': case 'help': usage(); process.exit(EXIT.OK); break;
    default: usage(); process.exit(EXIT.USAGE);
  }
}
main().catch((e) => die(EXIT.RULE_ERROR, `internal error: ${e && e.stack ? e.stack : e}`));
