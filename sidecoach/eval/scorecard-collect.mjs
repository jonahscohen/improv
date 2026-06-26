#!/usr/bin/env node
/**
 * Contract-6 BASELINE SCORECARD - step 1: COLLECT both detectors' findings on the frozen corpus.
 *
 * Runs Sidecoach's CURRENT scanner (validateTaste + absolute-ban scanners, from dist) AND oracle
 * (via oracle-comparator) on each of the 90 frozen pages, caches the normalized findings, and prints
 * the distinct RULE VOCABULARY of each tool (so the rule->ground-truth-class mapping can be built from
 * what the tools actually emit on THIS corpus, not guessed). Read-only over the corpus; writes a cache.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOracle, runDetached, resolveOraclePath, stderrLooksProblematic } from './oracle-comparator.mjs';
import { COLLECTOR_VERSION, sha256, isCompleteRecord } from './scorecard-shared.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const CACHE = path.join(HERE, '.scorecard-cache');
const SIDECOACH_SCAN = path.join(HERE, 'sidecoach-scan.mjs');

// Run Sidecoach's current scanner in a SUBPROCESS with a group-kill timeout. The current scanner has a
// ReDoS hang (scanIdenticalCardGrids on large HTML) that a sync in-process call cannot interrupt; the
// subprocess lets a hang fail-closed (available:false for that page) instead of blocking the whole run.
async function runSidecoach(file, timeoutMs = 45000, mode = 'both') {
  const r = await runDetached('node', [SIDECOACH_SCAN, file, mode], { timeoutMs });
  if (r.timedOut) return { available: false, reason: `sidecoach ${mode} scan timed out after ${timeoutMs}ms (group-killed)`, findings: [] };
  if (r.code !== 0) return { available: false, reason: `sidecoach ${mode} scan exit ${r.code}`, findings: [] };
  // SYMMETRIC stderr check with the oracle (Codex pass2 #3): a problem-stderr on an otherwise-0 exit fails
  // closed for BOTH tools the same way. (Verified: both subprocesses emit empty stderr on a clean scan.)
  if (stderrLooksProblematic(r.stderr)) return { available: false, reason: `sidecoach scan stderr: ${r.stderr.trim().split('\n')[0]}`, findings: [] };
  // SYMMETRIC fail-closed with the oracle (which uses safeJsonArray): require a JSON ARRAY, not just
  // any valid JSON, so a non-array payload fails closed for BOTH tools the same way (no asymmetry).
  try { const parsed = JSON.parse(r.stdout); if (!Array.isArray(parsed)) return { available: false, reason: 'sidecoach scan stdout not a JSON array', findings: [] }; return { available: true, findings: parsed }; }
  catch { return { available: false, reason: 'sidecoach scan stdout not JSON', findings: [] }; }
}

// Run the oracle and normalize to the same { available, reason, findings } shape as runSidecoach, so the
// two detectors flow through identical available/fail-closed/timing handling (no per-tool special-casing).
async function runOracleStep(file, timeoutMs) {
  try { const r = await runOracle(file, { timeoutMs }); return { available: !!(r && r.available), reason: (r && r.reason) || null, findings: (r && r.available && r.findings) ? r.findings : [] }; }
  catch (e) { return { available: false, reason: e instanceof Error ? e.message : String(e), findings: [] }; }
}

const man = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
mkdirSync(CACHE, { recursive: true });
// SYMMETRIC global preflight (Codex pass2 #1 + pass3 #1 + pass4): smoke-RUN BOTH detectors on one tiny
// fixture before the corpus loop. A global config failure of EITHER tool (missing oracle/dist, import or
// runtime error) would otherwise be written as 90 false unavailables AND accepted by --resume as 'data'.
// Resolvability alone is insufficient - a script can EXIST yet fail at runtime - so each tool is actually
// RUN once; abort (no cache writes) if either can't. A genuine per-page ReDoS timeout is NOT a global
// failure (the probe is tiny and scans instantly), so this never masks a real per-page deficit.
if (!resolveOraclePath()) {
  console.error('FATAL: oracle detect.mjs not resolvable (set SIDECOACH_ORACLE_DETECT to a path that exists). Aborting before any cache write.');
  process.exit(1);
}
{
  const probe = path.join(tmpdir(), `scorecard-preflight-${process.pid}.html`);
  writeFileSync(probe, '<!doctype html><html><head><title>preflight</title></head><body><p>hello</p></body></html>');
  const scPf = await runSidecoach(probe, 30000);
  const orPf = await runOracleStep(probe, 30000);
  try { rmSync(probe, { force: true }); } catch { /* */ }
  if (!scPf.available) { console.error(`FATAL: Sidecoach scanner preflight failed (${scPf.reason}) - global scanner config error (build dist first?). Aborting before any cache write.`); process.exit(1); }
  if (!orPf.available) { console.error(`FATAL: oracle preflight failed (${orPf.reason}) - global oracle config/runtime error. Aborting before any cache write.`); process.exit(1); }
}
const oracleVocab = new Set(), sidecoachVocab = new Set();
const force = process.argv.includes('--force');
let n = 0, oracleUnavail = 0, sidecoachUnavail = 0;
for (let idx = 0; idx < man.length; idx++) {
  const c = man[idx];
  const cacheFile = path.join(CACHE, `${c.id}.json`);
  const file = path.join(CORPUS, c.file);
  const corpusSha = sha256(readFileSync(file)); // page content hash: a changed page invalidates its cached record
  if (!force && existsSync(cacheFile)) {
    const prev = JSON.parse(readFileSync(cacheFile, 'utf8'));
    // Resume ONLY a record that is fully complete for BOTH tools AND from THIS collector version AND for the
    // current page content (shared predicate with mapping). A partial/stale/old-schema record is re-run.
    const complete = isCompleteRecord(prev, corpusSha);
    if (complete) {
      for (const f of prev.sidecoach) sidecoachVocab.add(f.rule);
      for (const f of prev.oracle) oracleVocab.add(f.rule);
      if (prev.oracleAvailable === false) oracleUnavail++;
      if (prev.sidecoachAvailable === false) sidecoachUnavail++;
      n++; continue;
    }
  }
  // BOTH detectors in subprocesses with group-kill timeouts (Sidecoach has a ReDoS hang; oracle a browser hang).
  // SYMMETRIC timeout for both tools (lead fairness requirement): identical + generous, so a normally-slow
  // run isn't killed and neither tool is advantaged/disadvantaged by the bound. Genuine hangs (Sidecoach
  // ReDoS) still fail-closed; a tool that can't finish in the bound is a real robustness deficit for THAT tool.
  const TIMEOUT = 120000; // generous + SYMMETRIC (lead fairness): big-DOM oracle runs aren't cut; genuine hangs still fail-closed
  // PER-PAGE WALL-TIME per tool (lead requirement): Sidecoach's scanIdenticalCardGrids ReDoS COMPLETES
  // within the generous timeout but takes minutes - a real PERFORMANCE deficit that must show, not vanish.
  // ALTERNATE detector order per page (Codex item-8 #4): running one tool first on every page would give the
  // second tool a warm FS/module cache, biasing wall-time toward whichever runs second. Alternating cancels
  // that systematic bias across the corpus. performance.now() for high-resolution, monotonic timing.
  // DECOUPLE (lead ruling): Sidecoach runs as TWO subprocesses so the SUBJECTIVE ReDoS can't starve the
  // OBJECTIVE scan. The SUBJECTIVE family keeps the full symmetric TIMEOUT (its ReDoS wall-time/timeout is a
  // real Sidecoach deficit that must still SHOW); the OBJECTIVE scan gets its own backstop (>internal 60s) and
  // its availability is tracked SEPARATELY so an objective detection is never lost to a subjective hang.
  const OBJ_TIMEOUT = 90000;
  const scFirst = idx % 2 === 0;
  let sSubj, sObj, sSubjMs, sObjMs, oR, oMs, t0;
  const runSc = async () => {
    t0 = performance.now(); sSubj = await runSidecoach(file, TIMEOUT, 'subjective'); sSubjMs = Math.round(performance.now() - t0);
    t0 = performance.now(); sObj = await runSidecoach(file, OBJ_TIMEOUT, 'objective'); sObjMs = Math.round(performance.now() - t0);
  };
  const runImp = async () => { t0 = performance.now(); oR = await runOracleStep(file, TIMEOUT); oMs = Math.round(performance.now() - t0); };
  if (scFirst) { await runSc(); await runImp(); } else { await runImp(); await runSc(); }
  // Merge: subjective findings (if available) + objective findings (if available). Overall availability =
  // BOTH succeeded (so a subjective timeout still counts as a Sidecoach deficit); objective availability is
  // separate so the scorer can gate OBJECTIVE classes on it (immune to subjective hangs).
  const sFind = (sSubj.available ? sSubj.findings : []).concat(sObj.available ? sObj.findings : []);
  const sAvailable = sSubj.available && sObj.available;
  const sMs = sSubjMs + sObjMs;
  const sReason = [sSubj.available ? null : `subjective: ${sSubj.reason}`, sObj.available ? null : `objective: ${sObj.reason}`].filter(Boolean).join(' | ') || null;
  for (const f of sFind) sidecoachVocab.add(f.rule);
  if (!sAvailable) sidecoachUnavail++;
  const oFind = oR.available ? oR.findings : [];
  for (const f of oFind) oracleVocab.add(f.rule);
  if (!oR.available) oracleUnavail++;
  writeFileSync(cacheFile, JSON.stringify({ id: c.id, register: c.register, bucket: c.bucket, collectorVersion: COLLECTOR_VERSION, corpusSha, firstTool: scFirst ? 'sidecoach' : 'oracle', sidecoach: sFind, sidecoachAvailable: sAvailable, sidecoachObjectiveAvailable: sObj.available, sidecoachSubjectiveAvailable: sSubj.available, sidecoachReason: sReason, sidecoachMs: sMs, sidecoachObjectiveMs: sObjMs, sidecoachSubjectiveMs: sSubjMs, oracle: oFind, oracleAvailable: oR.available, oracleReason: oR.reason ?? null, oracleMs: oMs }, null, 2));
  n++;
  process.stderr.write(`  ${n}/${man.length} ${c.id}${sAvailable ? '' : ' [SC unavail' + (sObj.available ? '' : ' obj') + (sSubj.available ? '' : ' subj') + ']'}${oR.available ? '' : ' [imp unavail]'}\n`);
}
console.log(`collected ${n} pages -> ${CACHE} (sidecoach unavailable on ${sidecoachUnavail}, oracle unavailable on ${oracleUnavail})`);
console.log(`\nSIDECOACH rule vocabulary (${sidecoachVocab.size}):\n  ${[...sidecoachVocab].sort().join('\n  ')}`);
console.log(`\nORACLE rule vocabulary (${oracleVocab.size}):\n  ${[...oracleVocab].sort().join('\n  ')}`);
