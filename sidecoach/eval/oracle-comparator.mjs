#!/usr/bin/env node
/**
 * Contract-6 ORACLE COMPARATOR (Stage 0). FAIL-CLOSED.
 *
 * Foundation: REIMPLEMENT-AND-OWN. oracle is the studied ORACLE / quality-bar,
 * NEVER vendored code. This module invokes oracle's `detect.mjs` HEADLESS as a
 * PINNED dev/eval dependency and normalizes its JSON findings so the eval harness
 * can diff OUR scanner against the oracle on the externally-sourced LOCKED heldout
 * (Contract 6 A1-A4).
 *
 * FAIL-CLOSED (Codex Stage-0 review BLOCKER 1): a missing target, an oracle stderr
 * warning/error, a non-2 nonzero exit, or unparseable stdout must NEVER read as a
 * clean "0 findings" result - that would let our scanner pass A2/recall falsely.
 * Such cases return { available:false }.
 *
 * Oracle path resolves from $SIDECOACH_ORACLE_DETECT, else the plugin-cache default.
 * Stage 1 replaces the cache default with a properly pinned dev/eval dependency.
 */

import { spawn } from 'node:child_process';
import { existsSync, openSync, closeSync, readFileSync, rmSync, mkdtempSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

// Run a child in its OWN PROCESS GROUP, redirect stdout/stderr to FILES, and resolve on 'exit'
// (NOT pipe-EOF), group-killing the whole group on timeout. Rationale (both lead-flagged + observed):
//  - oracle's detect.mjs spawns a Chrome grandchild that inherits the stdio; resolving on the pipe
//    'close' waits for Chrome to release the pipe (hang), and reading a pipe in chunks truncated output
//    (observed: 8156 of 14045 bytes). Redirecting to a FILE + reading after 'exit' captures the full
//    bytes regardless of grandchildren, and 'exit' fires on the direct child without waiting for EOF.
//  - detached + process.kill(-pid) on timeout kills node + Chrome together (no leak, fail-closed).
// Returns { stdout, stderr, code, timedOut }.
export function runDetached(cmd, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'orc-'));
    const outPath = path.join(dir, 'out'), errPath = path.join(dir, 'err');
    const outFd = openSync(outPath, 'w'), errFd = openSync(errPath, 'w');
    let settled = false, timedOut = false;
    const child = spawn(cmd, args, { detached: true, stdio: ['ignore', outFd, errFd] });
    const groupKill = (sig) => { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* gone */ } } };
    const timer = setTimeout(() => { timedOut = true; groupKill('SIGKILL'); }, timeoutMs);
    const done = (code) => {
      if (settled) return; settled = true; clearTimeout(timer);
      try { closeSync(outFd); } catch { /* */ } try { closeSync(errFd); } catch { /* */ }
      let stdout = '', stderr = '';
      try { stdout = readFileSync(outPath, 'utf8'); } catch { /* */ }
      try { stderr = readFileSync(errPath, 'utf8'); } catch { /* */ }
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
      resolve({ stdout, stderr, code, timedOut });
    };
    child.on('error', () => done(null));
    child.on('exit', (code) => done(code)); // direct child exit; stdio is in files, no EOF wait
  });
}

// Safe directory listing: returns dir entry names, or [] if the path is missing/unreadable.
function safeDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

// Dynamically locate the comparator's detect.mjs in the plugin cache WITHOUT hardcoding any
// tool/marketplace/version name. Walks
//   ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<skill>/scripts/detect.mjs
// and collects every match. Returns it ONLY when the match is UNAMBIGUOUS (exactly one cached
// plugin exposes a scripts/detect.mjs) - so the discovery fallback can never silently run a
// DIFFERENT plugin's detector as the comparator (Codex P1). If zero or multiple are found, returns
// null; the operator must then pin the intended one via SIDECOACH_ORACLE_DETECT (resolveOraclePath).
export function findCachedOracleDetect() {
  const base = path.join(homedir(), '.claude/plugins/cache');
  const matches = [];
  for (const marketplace of safeDirs(base)) {
    const mDir = path.join(base, marketplace);
    for (const plugin of safeDirs(mDir)) {
      const pDir = path.join(mDir, plugin);
      for (const version of safeDirs(pDir)) {
        const skillsDir = path.join(pDir, version, 'skills');
        for (const skill of safeDirs(skillsDir)) {
          const candidate = path.join(skillsDir, skill, 'scripts', 'detect.mjs');
          if (existsSync(candidate)) matches.push(candidate);
        }
      }
    }
  }
  // Unambiguous discovery only. Ambiguity (multiple cached detectors) must be resolved explicitly
  // via SIDECOACH_ORACLE_DETECT rather than guessed, to avoid running the wrong comparator.
  return matches.length === 1 ? matches[0] : null;
}

const URL_RE = /^(https?|file|data):/i;
// stderr lines that mean "the scan did not cleanly cover the target". Exported so BOTH detectors apply the
// SAME problem check (Codex item-8 pass2 #3): the oracle previously failed closed on problem-stderr while
// Sidecoach ignored stderr entirely - an asymmetry. Now identical for both.
const STDERR_PROBLEM_RE = /\b(cannot access|warning|error|aborted|failed)\b/i;
export function stderrLooksProblematic(stderr) {
  return typeof stderr === 'string' && STDERR_PROBLEM_RE.test(stderr);
}

export function resolveOraclePath() {
  const fromEnv = process.env.SIDECOACH_ORACLE_DETECT;
  // set-but-missing must FAIL CLOSED, not silently fall back to a DIFFERENT (cache) oracle than the one
  // the operator pinned via the env var - that would run an unintended oracle and still mark pages available.
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null;
  return findCachedOracleDetect();
}

/** Best-effort numeric contrast detail for A3. oracle's low-contrast snippet
 *  reads like: "4.1:1 (need 4.5:1) ... text #aaa on #bbb". Returns null when absent. */
export function parseContrastDetail(snippet) {
  if (typeof snippet !== 'string') return null;
  const m = snippet.match(/([\d.]+)\s*:\s*1\s*\(need\s*([\d.]+)\s*:\s*1\)/i);
  if (!m) return null;
  return { ratio: Number(m[1]), threshold: Number(m[2]) };
}

/** Normalize one oracle finding to the comparable shape (A1-A4 + A3 detail). */
export function normalizeFinding(f) {
  return {
    rule: f.antipattern ?? null,
    severity: f.severity ?? null,
    file: f.file ?? null,
    line: typeof f.line === 'number' ? f.line : null,
    snippet: typeof f.snippet === 'string' ? f.snippet : null,
    contrast: parseContrastDetail(f.snippet),
  };
}

/**
 * Run the oracle headless over a local file/dir (or url/file/data target).
 * Returns { available, findings, raw, exitCode } or { available:false, reason }.
 * FAIL-CLOSED on missing target, stderr problem, non-2 nonzero exit, or bad JSON.
 */
export async function runOracle(target, { oraclePath, timeoutMs = 120000 } = {}) {
  if (oraclePath === undefined) {
    // Distinguish "env var set but path missing" (operator error - fail closed with the exact path) from
    // "no env var" (fall back to cache default). Both never read as a clean 0-findings result.
    const fromEnv = process.env.SIDECOACH_ORACLE_DETECT;
    if (fromEnv && !existsSync(fromEnv)) return unavail(`SIDECOACH_ORACLE_DETECT set but not found: ${fromEnv}`);
    oraclePath = resolveOraclePath();
  }
  if (!oraclePath) return unavail('oracle detect.mjs not found (set SIDECOACH_ORACLE_DETECT)');
  if (typeof target !== 'string' || !target) return unavail('no target');
  // Local-path targets must exist (a missing file makes oracle emit [] exit 0 = false clean).
  if (!URL_RE.test(target) && !existsSync(target)) return unavail(`target not found: ${target}`);

  // group-kill timeout (fail-closed): a hang -> available:false for that page (NOT a false "clean"),
  // and the whole node+Chrome group is killed so one hang can't block the run or leak browsers.
  const { stdout, stderr, code, timedOut } = await runDetached('node', [oraclePath, '--json', target], { timeoutMs });
  if (timedOut) return unavail(`oracle timed out after ${timeoutMs}ms (group-killed)`);
  if (stderr && STDERR_PROBLEM_RE.test(stderr)) return unavail(`oracle stderr: ${stderr.trim().split('\n')[0]}`);
  // detect.mjs: exit 0 = clean (empty array), exit 2 = findings on stdout. Both carry a JSON array.
  if (code === 0 || code === 2) {
    const parsed = safeJsonArray(stdout);
    if (parsed) return { available: true, findings: parsed.map(normalizeFinding), raw: parsed, exitCode: code };
    return unavail(`oracle exit ${code} but stdout not a JSON array`);
  }
  return unavail(`oracle failed (code ${code ?? '?'})`);
}

function unavail(reason) { return { available: false, reason, findings: [], raw: null, exitCode: null }; }
function safeJsonArray(s) { try { const v = JSON.parse(s); return Array.isArray(v) ? v : null; } catch { return null; } }

// CLI: `node oracle-comparator.mjs <target>` -> prints the result JSON (exit 0 if available).
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  if (!target) { console.error('usage: oracle-comparator.mjs <file|dir|url>'); process.exit(2); }
  const res = await runOracle(target);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.available ? 0 : 1);
}
