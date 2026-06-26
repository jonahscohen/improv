#!/usr/bin/env node
/**
 * MIGRATION HARNESS - convergence golden fixtures (Stage 0, item 2). HARDENED per Codex.
 *
 * Stage 3 replaces the lane convergence machine with the minimal `qa-run.mjs`
 * (Contract 1) - KEEPING the guarantee. Before that, the new qa-run must reproduce
 * the CURRENT convergence behavior on fixed scenarios (the COMPATIBILITY CONTRACT).
 *
 * Codex Stage-0 folds: (1) the result helpers now use the VALID ProductValidationResult
 * status enum (clean|findings|inconclusive|error - NOT 'fail') mirroring
 * src/__tests__/lane-convergence.test.ts, so goldens are real not degenerate;
 * (2) the snapshot captures the FULL deterministic boundary record (perValidator,
 * iterationStatus, converged, signature, findings, validatorErrors,
 * requiredValidatorRuns, runCoverage, measuredScope) + the progress decision, so a
 * rewrite cannot pass while dropping coverage/error behavior; (3) `verify` accepts a
 * PRODUCER seam so the NEW convergence logic is actually exercised, not the old module.
 * TEMP harness - sunset at Stage 5.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', '..', 'dist');
const GOLDEN = path.join(HERE, 'golden', 'convergence', 'scenarios.json');

// Valid ProductValidationResult helpers (mirror src/__tests__/lane-convergence.test.ts).
const COV_CLEAN = { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [], ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 }, findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: ['s1'], unverifiedScope: [] };
const COV_FAIL = { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [], ruleCounts: { pass: 0, fail: 1, notApplicable: 0, inconclusive: 0 }, findingCounts: { blockingExcess: 1, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: ['scope-x'] };
const COV_ERR = { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [], ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 }, findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] };

const clean = () => ({ validatorId: 'polish-standard', result: { status: 'clean', rules: [], findings: [], coverage: COV_CLEAN } });
const withFail = (ruleKey) => ({ validatorId: 'polish-standard', result: {
  status: 'findings',
  rules: [{ ruleId: ruleKey, canonicalRuleKey: ruleKey, status: 'fail', severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
  findings: [{ validatorId: 'polish-standard', ruleId: ruleKey, canonicalRuleKey: ruleKey, severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
  coverage: COV_FAIL } });
const errored = () => ({ validatorId: 'polish-standard', result: { status: 'error', normalizedErrorCategory: 'aborted', error: 'lease lost', rules: [], findings: [], coverage: COV_ERR } });

const SCENARIOS = {
  stall: [[withFail('polish.no-transition-all')], [withFail('polish.no-transition-all')], [withFail('polish.no-transition-all')]],
  converge: [[withFail('polish.no-transition-all')], [clean()]],
  progress_then_converge: [[withFail('polish.no-transition-all')], [withFail('a11y.contrast')], [clean()]],
  error_running: [[errored()], [errored()]],
};

async function loadConvergence() {
  return await import(path.join(DIST, 'lane-convergence.js'));
}

// `conv` lets verify() inject the NEW convergence module (producer seam, Codex BLOCKER 1).
async function runScenarios(conv) {
  conv = conv || await loadConvergence();
  const { seedConvergenceState, evaluateBoundary, decideProgress } = conv;
  const out = {};
  for (const [name, iterations] of Object.entries(SCENARIOS)) {
    let state = seedConvergenceState();
    const steps = [];
    for (const perValidator of iterations) {
      const ev = evaluateBoundary(perValidator);
      const decision = decideProgress(state, ev);
      // FULL deterministic boundary record + decision (Codex BLOCKER 2).
      steps.push({
        perValidator: ev.perValidator, iterationStatus: ev.iterationStatus, converged: ev.converged,
        signature: ev.signature, findings: ev.findings, validatorErrors: ev.validatorErrors,
        requiredValidatorRuns: ev.requiredValidatorRuns, runCoverage: ev.runCoverage, measuredScope: ev.measuredScope,
        outcome: decision.outcome, consecutiveNoProgress: decision.consecutiveNoProgress, nextIteration: decision.nextIteration,
      });
      state = { ...state, iteration: decision.nextIteration, signatures: [...state.signatures, ev.signature], consecutiveNoProgress: decision.consecutiveNoProgress };
      if (decision.outcome === 'converged' || decision.outcome === 'stalled' || decision.outcome === 'capped') break;
    }
    out[name] = steps;
  }
  return out;
}

async function capture() {
  const out = await runScenarios();
  mkdirSync(path.dirname(GOLDEN), { recursive: true });
  writeFileSync(GOLDEN, JSON.stringify(out, null, 2) + '\n');
  return out;
}

async function verify(conv) {
  if (!existsSync(GOLDEN)) return { ok: false, drift: ['no golden (run capture)'] };
  const golden = JSON.stringify(JSON.parse(readFileSync(GOLDEN, 'utf8')));
  const actual = JSON.stringify(await runScenarios(conv));
  return actual === golden ? { ok: true, drift: [] } : { ok: false, drift: ['convergence behavior differs from golden'] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  try {
    if (cmd === 'capture') { const o = await capture(); console.log(`captured convergence goldens (${Object.keys(o).map((k) => `${k}:${o[k][o[k].length - 1].outcome}`).join(', ')})`); }
    else if (cmd === 'verify') {
      const r = await verify();
      if (r.ok) { console.log('convergence goldens VERIFY OK (current == golden)'); process.exit(0); }
      console.error('convergence goldens DRIFT:'); for (const d of r.drift) console.error(`  - ${d}`); process.exit(1);
    } else { console.error('usage: convergence-snapshot.mjs <capture|verify>'); process.exit(2); }
  } catch (e) { console.error(`ERROR: ${e instanceof Error ? e.message : e}`); process.exit(2); }
}

export { runScenarios, capture, verify, SCENARIOS };
