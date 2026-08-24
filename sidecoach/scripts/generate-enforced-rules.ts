// sidecoach/scripts/generate-enforced-rules.ts
//
// Phase 3c Step C1 (wrapper): the ledger-gated CODEGEN that emits the LIVE, build-blocking
// mined-taste rules. THIN I/O wrapper - all gate logic lives in ../src/validators/enforced-rules-
// generation (inside rootDir ./src so the test imports it without TS6059, the generate-validators /
// generate-counter-rules precedent). This file:
//   1. If the enforced tier is empty -> emits an EMPTY module (no audit, no secret side effect).
//   2. Else runs the enforce-CLI `audit` (the HMAC ledger verification + content-digest match + the
//      no-unblessed / must-be-blocking checks). A NON-ZERO audit -> this exits non-zero -> the build
//      BREAKS. This is where the tamper-evident ledger crypto is enforced (NOT reimplemented here).
//   3. Reads the audit-verified ledger + the precision records + the current interpreter build stamp,
//      calls deriveEnforcedRules (the precision gate), and EXITS NON-ZERO if any rule fails.
//   4. Emits (or, with --check, compares) src/validators/enforced-rules.generated.ts.
//
// SIDECOACH_ENFORCE_TEST_ROOT relocates the enforced tier + ledger + secret (matches the enforce CLI)
// so the test drives a real seeded enforce end to end. SIDECOACH_ENFORCE_PRECISION_CACHE relocates the
// precision cache. --out overrides the write/compare target (so a test never lands synthetic rules in
// src/).
//
// EXIT: 0 ok | 1 --check drift | 2 IO/usage | 3 audit failed (ledger tampered / unblessed / content
//       mismatch) | 4 precision gate failed (a rule under threshold / missing / stale precision).
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import {
  deriveEnforcedRules, renderEnforcedRulesModule,
  type EnforcedRecord, type LedgerEntryView, type PrecisionRecordView,
} from '../src/validators/enforced-rules-generation';

export { deriveEnforcedRules, renderEnforcedRulesModule } from '../src/validators/enforced-rules-generation';

const SC = path.resolve(__dirname, '..');
const OUT_DEFAULT = path.resolve(SC, 'src', 'validators', 'enforced-rules.generated.ts');
const ENFORCE_CLI = path.resolve(SC, 'bin', 'sidecoach-taste-enforce.js');

const EXIT = { OK: 0, DRIFT: 1, IO: 2, AUDIT_FAILED: 3, PRECISION_FAILED: 4 };

function testRoot(): string { return process.env.SIDECOACH_ENFORCE_TEST_ROOT || ''; }
function enforcedDir(): string { const r = testRoot(); return r ? path.join(r, 'enforced-rules') : path.join(SC, 'data', 'enforced-rules'); }
function ledgerFile(): string { const r = testRoot(); return r ? path.join(r, 'enforcement-ledger.jsonl') : path.join(SC, 'data', 'enforcement-ledger.jsonl'); }
function precisionCacheDir(): string { return process.env.SIDECOACH_ENFORCE_PRECISION_CACHE || path.join(SC, 'eval', '.taste-enforce-cache'); }

// The interpreter build stamp - MUST match eval/taste-enforce-precision.mjs currentBuildStamp() byte
// for byte, or a precision record's stamp will never match and no rule could ever certify. Source-only
// (the two interpreter files) so this codegen, which runs BEFORE tsc emits dist, computes the same
// stamp as the harness without a build-order dependency on dist.
function currentBuildStamp(): string {
  const parts = [
    'src/validators/pattern-spec.ts',
    'src/validators/checks/pattern-interpreter.ts',
  ];
  const h = crypto.createHash('sha256');
  for (const rel of parts) {
    const f = path.join(SC, rel);
    if (!fs.existsSync(f)) { console.error(`generate-enforced-rules: ${rel} missing (build first)`); process.exit(EXIT.IO); }
    h.update(fs.readFileSync(f, 'utf8'));
  }
  return h.digest('hex').slice(0, 16);
}

function sanitizeId(id: string): string { return id.replace(/[^A-Za-z0-9._-]+/g, '_'); }

function loadEnforcedRecords(): EnforcedRecord[] {
  const dir = enforcedDir();
  let names: string[];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')); } catch (_e) { return []; }
  const out: EnforcedRecord[] = [];
  for (const n of names.sort()) {
    const stem = n.replace(/\.json$/, '');
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); }
    catch (e) { console.error(`generate-enforced-rules: enforced file ${n} is not valid JSON: ${(e as Error).message}`); process.exit(EXIT.AUDIT_FAILED); }
    out.push({ fileStem: stem, obj });
  }
  return out;
}

function loadLedger(): Map<string, LedgerEntryView> {
  const m = new Map<string, LedgerEntryView>();
  let raw: string;
  try { raw = fs.readFileSync(ledgerFile(), 'utf8'); } catch (_e) { return m; }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const e = JSON.parse(t);
      if (e && typeof e.ruleId === 'string') m.set(e.ruleId, { ruleId: e.ruleId, content_digest: e.content_digest, precision_digest: e.precision_digest, precision: e.precision });
    } catch (_e) { /* audit already guaranteed parseability; skip a bad line */ }
  }
  return m;
}

// Deterministic serialization + the STABLE-field set the harness (eval/taste-enforce-precision.mjs)
// digests, replicated here byte-for-byte so the codegen can RE-COMPUTE the precision digest from a
// cache's own fields (Codex Caveat B). If these ever drift from the harness, the real enforce -> codegen
// integration test fails, so the test is the drift guard.
function canonicalCache(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonicalCache).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v as object).sort().map((k) => JSON.stringify(k) + ':' + canonicalCache((v as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const STABLE_KEYS = [
  'ruleId', 'buildStamp', 'specHash', 'threshold', 'minHeldoutPositives', 'minFires',
  'heldoutPositives', 'heldoutNegatives', 'sharedNegatives', 'tp', 'fp', 'fn', 'tn', 'fires',
  'precision', 'floorsMet', 'thresholdMet', 'pass', 'corpusFingerprint',
];
function recomputePrecisionDigest(cacheObj: Record<string, unknown>): string {
  const stable: Record<string, unknown> = {};
  for (const k of STABLE_KEYS) stable[k] = cacheObj[k];
  return crypto.createHash('sha256').update(canonicalCache(stable), 'utf8').digest('hex');
}

function loadPrecision(records: EnforcedRecord[]): Map<string, PrecisionRecordView> {
  const m = new Map<string, PrecisionRecordView>();
  const dir = precisionCacheDir();
  for (const rec of records) {
    const f = path.join(dir, `${sanitizeId(rec.fileStem)}.json`);
    try {
      const r = JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>;
      m.set(rec.fileStem, {
        precisionDigest: r.precisionDigest as string, buildStamp: r.buildStamp as string, pass: r.pass as boolean,
        precision: r.precision as number | null, threshold: r.threshold as number,
        minHeldoutPositives: r.minHeldoutPositives as number, minFires: r.minFires as number,
        recomputedPrecisionDigest: recomputePrecisionDigest(r),
      });
    } catch (_e) { /* absent -> deriveEnforcedRules reports the missing record */ }
  }
  return m;
}

// The PRODUCTION floor the codegen requires a certified record to have met (Codex MEDIUM #3). The env
// overrides are honored ONLY under a test root, EXACTLY like the harness - so the seeded-under-test
// records (floor 3) satisfy the required-floor-3 in tests, while production requires the fixed 0.90/8/8
// and a record measured under a weaker floor is rejected.
function requiredFloor(): { requiredThreshold: number; requiredMinHeldoutPositives: number; requiredMinFires: number } {
  const it = !!process.env.SIDECOACH_ENFORCE_TEST_ROOT;
  const num = (k: string, d: number): number => { const v = Number(process.env[k]); return it && Number.isFinite(v) && v > 0 ? v : d; };
  const int = (k: string, d: number): number => { const v = parseInt(process.env[k] || '', 10); return it && Number.isFinite(v) && v >= 0 ? v : d; };
  return {
    requiredThreshold: num('SIDECOACH_ENFORCE_PRECISION_THRESHOLD', 0.90),
    requiredMinHeldoutPositives: int('SIDECOACH_ENFORCE_MIN_HELDOUT_POSITIVES', 8),
    requiredMinFires: int('SIDECOACH_ENFORCE_MIN_FIRES', 8),
  };
}

function runAudit(): void {
  const res = spawnSync(process.execPath, [ENFORCE_CLI, 'audit'], { encoding: 'utf8', env: process.env });
  if (res.status !== 0) {
    console.error('generate-enforced-rules: enforce-CLI audit FAILED - refusing to compile the enforced tier into live code:');
    if (res.stdout) console.error(res.stdout.trim());
    if (res.stderr) console.error(res.stderr.trim());
    process.exit(EXIT.AUDIT_FAILED);
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const outIdx = argv.indexOf('--out');
  const outPath = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : OUT_DEFAULT;

  const records = loadEnforcedRecords();

  let want: string;
  if (records.length === 0) {
    // Empty enforced tier: emit the empty module. No audit, no ledger secret is created - the common
    // case (no rule enforced yet) has zero build side effects and works on any machine.
    want = renderEnforcedRulesModule([]);
  } else {
    // The enforced tier is non-empty: the HMAC ledger MUST verify (audit) before anything compiles.
    runAudit();
    const ledgerByRuleId = loadLedger();
    const precisionByRuleId = loadPrecision(records);
    const { certified, errors } = deriveEnforcedRules({
      records, ledgerByRuleId, precisionByRuleId, currentBuildStamp: currentBuildStamp(),
      ...requiredFloor(),
    });
    if (errors.length) {
      console.error('generate-enforced-rules: PRECISION/LEDGER gate FAILED - these enforced rules cannot compile live:');
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(EXIT.PRECISION_FAILED);
    }
    want = renderEnforcedRulesModule(certified);
  }

  if (check) {
    const have = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
    if (have !== want) { console.error(`generate-enforced-rules --check: DRIFT in ${path.relative(SC, outPath)} (regenerate via npm run build)`); process.exit(EXIT.DRIFT); }
    console.log(`generate-enforced-rules --check: OK (${records.length} enforced file(s), no drift)`);
    return;
  }
  fs.writeFileSync(outPath, want);
  const n = (want.match(/"ruleId":/g) || []).length;
  console.log(`generate-enforced-rules: wrote ${path.relative(SC, outPath)} (${n} certified live-blocking rule(s) from ${records.length} enforced file(s))`);
}

if (require.main === module) main();
