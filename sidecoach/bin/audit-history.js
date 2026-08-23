'use strict';

/**
 * Append-only AUDIT-HISTORY capture for sidecoach-detect.
 *
 * WHY THIS EXISTS. Every `sidecoach-detect` scan already builds a full result JSON
 * ({target, verdict, findings[], severityCounts, lenses}) and writes it to stdout, where
 * the CLI and the taste-gate hook consume it TRANSIENTLY and drop it. The self-updating
 * taste pipeline's recurring-defect miner needs that fire-data to ACCRUE so it can find
 * defects that keep firing on our own pages over time (see the design beat
 * session_2026-08-23_self-updating-taste-pipeline-design.md, "INTERNAL-B audit history").
 * This module is the one persistence point: it records a compact line per scan into
 * data/audit-history.jsonl so fire-rates build up exactly like eval/corpus/defect-distribution.json,
 * but as a running log rather than a periodic snapshot.
 *
 * HARD CONTRACT (do not break):
 *   - NEVER writes to stdout. detect's stdout is a machine contract the taste-gate parses;
 *     capture writes to a FILE only. (A diagnostic on FAILURE may go to stderr, and only when
 *     SIDECOACH_AUDIT_DEBUG is set - never on the success path.)
 *   - APPEND-ONLY. One JSON object per line (JSONL), fsync-free appendFileSync with O_APPEND,
 *     so a small single-line write is atomic on POSIX even if the CLI and the hook race. No
 *     existing line is ever rewritten; the only file the log ever loses is the OLDEST rotation
 *     generation (see ROTATION), which is standard log-rotation aging, not a rewrite.
 *   - BEST-EFFORT / FAIL-OPEN. Nothing in here may throw out. A capture failure (unwritable
 *     path, full disk, malformed/hostile result) is swallowed and returns false; it can never
 *     break a scan, a build, or the taste gate. Failing to record a scan is strictly better
 *     than failing the scan. buildEntry/summarizeFindings are additionally TOTAL - every field
 *     read is guarded, so even a result with a throwing getter or a Symbol count still yields a
 *     well-formed entry recording that a scan happened.
 *
 * LINE SHAPE (v1): the fields the miner needs and nothing heavy.
 *   { v, utc, target, targetKind, verdict, counts:{blocking,warning,info}, findings:[{rule,severity,lens}] }
 * findings are REDUCED to (rule, severity, lens) on purpose - the full per-finding detail,
 * selectors, and remediation live in the transient stdout JSON; the accruing log only needs
 * WHICH rule fired at WHAT severity through WHICH lens, which is the fire-rate signal.
 *
 * ROTATION / SIZE PLAN. An append-only log grows without bound, so a size guard rolls the file
 * to a single `.1` sidecar once it crosses SIDECOACH_AUDIT_HISTORY_MAX_BYTES (default 5 MiB,
 * ~10k+ scan lines). This bounds on-disk size to ~2x the threshold with ONE generation of
 * history retained; the oldest generation ages out (the miner reads the live file PLUS any `.1`).
 * Rotation is CONCURRENCY-SAFE and does not lose a generation unexpectedly:
 *   - a best-effort mkdir mutex (atomic on POSIX) serializes the roll across the CLI and the hook;
 *   - inside the lock the size is RE-CHECKED, so a writer that finds a freshly-rotated (small) live
 *     file never rolls it over the `.1` sidecar - only a genuinely over-threshold live rolls;
 *   - a stale lock (a writer that crashed mid-roll) is stolen after 60s so rotation cannot wedge
 *     and defeat the size bound.
 * Everything about rotation is best-effort: a lock miss or a rename failure just skips the roll and
 * the append still happens (the line lands in the still-large file). One generation is deliberate -
 * recent fire-data is what the recurring-defect lens weighs; deep history is not worth an unbounded
 * scheme here.
 *
 * OVERRIDES (all optional; env is read at call time so tests can point it wherever):
 *   SIDECOACH_AUDIT_HISTORY            - absolute path to the log file (default data/audit-history.jsonl)
 *   SIDECOACH_NO_AUDIT_HISTORY         - truthy: disable capture entirely (used to prove stdout parity)
 *   SIDECOACH_AUDIT_HISTORY_MAX_BYTES  - rotation threshold in bytes (default 5 MiB)
 *   SIDECOACH_AUDIT_DEBUG              - truthy: emit ONE stderr line naming a capture failure
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'audit-history.jsonl');
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB
const LOCK_STALE_MS = 60 * 1000;

function isTruthyEnv(v) {
  return v !== undefined && v !== '' && v !== '0' && v.toLowerCase() !== 'false';
}

function resolvePath(opts) {
  if (opts && opts.file) return opts.file;
  const env = process.env.SIDECOACH_AUDIT_HISTORY;
  if (env) return env;
  return DEFAULT_PATH;
}

function resolveMaxBytes(opts) {
  if (opts && typeof opts.maxBytes === 'number') return opts.maxBytes;
  const env = process.env.SIDECOACH_AUDIT_HISTORY_MAX_BYTES;
  if (env) {
    const n = Number(env);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_MAX_BYTES;
}

// ---------------------------------------------------------------------------
// TOTAL field readers: read one property and coerce, NEVER throwing - even on a
// throwing getter or an un-coercible value (a Symbol, a bigint that Number rejects).
// This is what makes buildEntry total, so a malformed result still records a scan.
// ---------------------------------------------------------------------------
function safeStrProp(obj, key, fallback) {
  try {
    const v = obj == null ? undefined : obj[key];
    return v != null ? String(v) : fallback;
  } catch (_e) {
    return fallback;
  }
}

function safeNumProp(obj, key) {
  try {
    const n = Number(obj == null ? undefined : obj[key]);
    return Number.isFinite(n) ? n : 0;
  } catch (_e) {
    return 0;
  }
}

/**
 * Reduce a scan's findings to the fire-rate triple (rule, severity, lens). Total: a non-array,
 * a junk finding, or a finding whose fields throw when read never throws here - it degrades to
 * an 'unknown'-tagged entry so a malformed result still records that a scan happened.
 */
function summarizeFindings(findings) {
  if (!Array.isArray(findings)) return [];
  const out = [];
  // The iteration itself is guarded: Array.isArray sees through a Proxy, so a hostile
  // findings value (a Proxy array whose Symbol.iterator getter throws, or a throwing length
  // trap) could throw here. Catching it returns whatever was collected so far, which keeps
  // buildEntry TOTAL - a malformed result still records that a scan happened.
  try {
    for (const f of findings) {
      out.push({
        rule: safeStrProp(f, 'rule', 'unknown'),
        severity: safeStrProp(f, 'severity', 'unknown'),
        lens: safeStrProp(f, 'lens', 'unknown'),
      });
    }
  } catch (_e) {
    return out;
  }
  return out;
}

/**
 * Build the one JSONL entry for a scan result. Pure and TOTAL: any shape of `result` (null, a
 * plain object, or an object with throwing getters / Symbol counts) yields a well-formed entry,
 * so buildEntry itself is safe to unit-test in isolation and never sinks a capture.
 */
function buildEntry(result, nowIso) {
  let counts;
  try { counts = result == null ? undefined : result.severityCounts; } catch (_e) { counts = undefined; }
  let rawFindings;
  try { rawFindings = result == null ? undefined : result.findings; } catch (_e) { rawFindings = undefined; }
  return {
    v: SCHEMA_VERSION,
    utc: nowIso || new Date().toISOString(),
    target: safeStrProp(result, 'target', null),
    targetKind: safeStrProp(result, 'targetKind', null),
    verdict: safeStrProp(result, 'verdict', 'unknown'),
    counts: {
      blocking: safeNumProp(counts, 'blocking'),
      warning: safeNumProp(counts, 'warning'),
      info: safeNumProp(counts, 'info'),
    },
    findings: summarizeFindings(rawFindings),
  };
}

/**
 * Run `fn` while holding a best-effort mkdir mutex on `<file>.rotate.lock`. mkdir is atomic on
 * POSIX, so it serializes the roll across concurrent CLI + hook processes. A held lock (EEXIST)
 * skips `fn` unless the lock is stale (a crashed writer), in which case it is stolen so rotation
 * cannot wedge forever and defeat the size bound. Every step is best-effort; a lock miss simply
 * skips the roll and the caller still appends.
 */
function withRotationLock(file, fn) {
  const lock = file + '.rotate.lock';
  let held = false;
  try {
    try {
      fs.mkdirSync(lock);
      held = true;
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        try {
          const age = Date.now() - fs.statSync(lock).mtimeMs;
          if (age > LOCK_STALE_MS) {
            fs.rmdirSync(lock);
            fs.mkdirSync(lock);
            held = true;
          }
        } catch (_e2) {
          // Lost the steal race, or the lock vanished under us - skip the roll this time.
        }
      }
      // Any other mkdir error: skip the roll, still append.
    }
    if (held) fn();
  } finally {
    if (held) {
      try { fs.rmdirSync(lock); } catch (_e) { /* best-effort release */ }
    }
  }
}

/**
 * Roll the log to a single `.1` sidecar when it crosses the size threshold. Best-effort and
 * concurrency-safe: the size is re-checked UNDER the lock so a freshly-rotated (small) live file
 * is never rolled over the sidecar - only a genuinely over-threshold live rolls.
 */
function maybeRotate(file, maxBytes) {
  let over = false;
  try {
    over = fs.statSync(file).size >= maxBytes;
  } catch (_e) {
    return; // no file yet (first write), or unstattable - nothing to roll.
  }
  if (!over) return;
  withRotationLock(file, () => {
    try {
      if (fs.statSync(file).size >= maxBytes) fs.renameSync(file, file + '.1');
    } catch (_e) {
      // Another writer rotated first, or the rename was denied - the append below still happens.
    }
  });
}

/**
 * Append one line for `result` to the audit-history log. Returns true if a line was written,
 * false if capture was disabled or failed. NEVER throws, NEVER writes to stdout.
 */
function captureScan(result, opts) {
  try {
    if (opts && opts.disabled) return false;
    if (isTruthyEnv(process.env.SIDECOACH_NO_AUDIT_HISTORY)) return false;

    const file = resolvePath(opts);
    const maxBytes = resolveMaxBytes(opts);
    const nowIso = (opts && opts.now) || new Date().toISOString();

    const entry = buildEntry(result, nowIso);
    const line = JSON.stringify(entry) + '\n';

    // Ensure the directory exists (data/ ships, but a custom path may not). Best-effort.
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); } catch (_e) { /* fall through */ }

    maybeRotate(file, maxBytes);
    fs.appendFileSync(file, line);
    return true;
  } catch (err) {
    if (isTruthyEnv(process.env.SIDECOACH_AUDIT_DEBUG)) {
      try {
        process.stderr.write(
          'sidecoach audit-history: capture failed (non-fatal): ' +
          (err && err.message ? err.message : String(err)) + '\n',
        );
      } catch (_e) { /* even the diagnostic is best-effort */ }
    }
    return false;
  }
}

module.exports = {
  captureScan,
  buildEntry,
  summarizeFindings,
  DEFAULT_PATH,
  DEFAULT_MAX_BYTES,
  SCHEMA_VERSION,
};
