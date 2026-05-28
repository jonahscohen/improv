// T-0016: benchmark runner ledger-awareness tests.
//
// Covers the four behaviors required of the live-vs-synthetic token-source
// detection in run-all.ts:
//
//   1. LIVE PATH - when the flow handler emits CostEntry rows during execute(),
//      the runner sums them and records tokenSource='live'.
//   2. SYNTHETIC FALLBACK - when the handler emits no entries (today's reality
//      for rule-based handlers), the runner falls back to the byte-length
//      estimator and records tokenSource='synthetic'.
//   3. MIXED RUN - in a single run, one flow may emit live entries while
//      another runs synthetic. Each row carries its own tokenSource.
//   4. LEDGER RESET BETWEEN FLOWS - a live entry from flow A must not bleed
//      into flow B's calculation. Each call to runFlowOnFixture is isolated.
//
// These tests use synthetic FlowDescriptors (not the real flowJ/K/L handlers)
// because we need handlers whose execute() either does or does not call
// trackCost(). Real handlers today never call trackCost, so we'd only ever
// exercise the synthetic path against the production set.

import * as path from 'path';

import { runFlowOnFixture } from '../../benchmarks/runner/run-all';
import { loadFixture, LoadedFixture } from '../../benchmarks/runner/score';
import {
  trackCost,
  getSessionLedger,
  resetLedger,
  TIERS,
} from '../model-routing';
import type { FlowExecutionContext, FlowExecutionResult } from '../flow-handler';
import type { FlowId } from '../types';

interface Check {
  label: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];

function expect(label: string, ok: boolean, detail?: string): void {
  checks.push({ label, ok, detail });
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Build a synthetic handler that calls trackCost during execute() with the
 * given (model, inputTokens, outputTokens). Use this to simulate a future
 * LLM-wired flow handler.
 */
function makeLiveHandler(
  flowId: FlowId,
  model: string,
  inputTokens: number,
  outputTokens: number,
) {
  return {
    execute: async (context: FlowExecutionContext): Promise<FlowExecutionResult> => {
      trackCost(flowId, model, inputTokens, outputTokens);
      return {
        flowId,
        flowName: `synthetic-live-${flowId}`,
        status: 'success' as const,
        message: 'live handler completed (trackCost recorded)',
      };
    },
  };
}

/**
 * Build a synthetic handler that NEVER calls trackCost. Mirrors the current
 * rule-based handlers - the runner should fall back to synthetic estimation.
 */
function makeRuleBasedHandler(flowId: FlowId) {
  return {
    execute: async (context: FlowExecutionContext): Promise<FlowExecutionResult> => {
      return {
        flowId,
        flowName: `synthetic-rule-${flowId}`,
        status: 'success' as const,
        message: 'rule-based handler (no trackCost call)',
      };
    },
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

async function run() {
  const benchmarkRoot = path.resolve(__dirname, '..', '..', 'benchmarks');
  const fixturesDir = path.join(benchmarkRoot, 'fixtures');
  const fixture: LoadedFixture = loadFixture(path.join(fixturesDir, 'brand-studio'));

  // === Test 1: LIVE PATH ===
  // Handler calls trackCost(flowJ, sonnet-id, 4000, 1200). Runner should
  // detect the entry, sum it, and mark tokenSource='live'.
  resetLedger();
  const liveResult = await runFlowOnFixture(fixture, {
    flowId: 'flowJ_tactical_polish' as FlowId,
    build: () =>
      makeLiveHandler('flowJ_tactical_polish' as FlowId, TIERS.sonnet.exactModel, 4000, 1200),
  });
  expect(
    'live: tokenSource is "live"',
    liveResult.tokenSource === 'live',
    `got '${liveResult.tokenSource}'`,
  );
  expect(
    'live: tokensInput matches handler call (4000)',
    liveResult.tokensInput === 4000,
    `got ${liveResult.tokensInput}`,
  );
  expect(
    'live: tokensOutput matches handler call (1200)',
    liveResult.tokensOutput === 1200,
    `got ${liveResult.tokensOutput}`,
  );
  // 4000 in @ $3/M + 1200 out @ $15/M = 0.012 + 0.018 = 0.030
  const expectedLiveCost = (4000 / 1_000_000) * 3.0 + (1200 / 1_000_000) * 15.0;
  expect(
    'live: estimatedCost computed from TIERS sonnet pricing',
    Math.abs(liveResult.estimatedCost - expectedLiveCost) < 1e-9,
    `expected ${expectedLiveCost} got ${liveResult.estimatedCost}`,
  );
  expect(
    'live: modelId picked up from ledger entry (sonnet)',
    liveResult.modelId === TIERS.sonnet.exactModel,
    `got ${liveResult.modelId}`,
  );
  expect(
    'live: tierUsed picked up from ledger entry',
    liveResult.tierUsed === 'sonnet',
    `got ${liveResult.tierUsed}`,
  );

  // === Test 2: SYNTHETIC FALLBACK ===
  // Handler never calls trackCost; runner should fall back to byte-length
  // estimator and mark tokenSource='synthetic'.
  resetLedger();
  const synthResult = await runFlowOnFixture(fixture, {
    flowId: 'flowK_multi_lens_audit' as FlowId,
    build: () => makeRuleBasedHandler('flowK_multi_lens_audit' as FlowId),
  });
  expect(
    'synthetic: tokenSource is "synthetic"',
    synthResult.tokenSource === 'synthetic',
    `got '${synthResult.tokenSource}'`,
  );
  expect(
    'synthetic: tokensInput is positive (estimator ran)',
    synthResult.tokensInput > 0,
    `got ${synthResult.tokensInput}`,
  );
  // The 3:1 input:output ratio from estimateSyntheticTokens.
  expect(
    'synthetic: outputTokens = ceil(inputTokens/3)',
    synthResult.tokensOutput === Math.ceil(synthResult.tokensInput / 3),
    `in=${synthResult.tokensInput} out=${synthResult.tokensOutput}`,
  );
  expect(
    'synthetic: estimatedCost is positive',
    synthResult.estimatedCost > 0,
    `got ${synthResult.estimatedCost}`,
  );
  // After the synthetic-fallback path, the ledger should contain exactly one
  // synthetic entry for THIS flow (the runner wrote it to mirror live shape).
  const postSynthLedger = getSessionLedger().filter(
    (e) => e.flowId === 'flowK_multi_lens_audit',
  );
  expect(
    'synthetic: runner wrote a synthetic CostEntry to mirror live shape',
    postSynthLedger.length === 1,
    `ledger entries=${postSynthLedger.length}`,
  );

  // === Test 3: MIXED RUN ===
  // Run two flows in sequence: one live, one synthetic. Each row should carry
  // its own tokenSource. Runner resets the ledger before each flow so they
  // don't interfere.
  resetLedger();
  const mixed1 = await runFlowOnFixture(fixture, {
    flowId: 'flowJ_tactical_polish' as FlowId,
    build: () =>
      makeLiveHandler('flowJ_tactical_polish' as FlowId, TIERS.opus.exactModel, 5000, 1500),
  });
  const mixed2 = await runFlowOnFixture(fixture, {
    flowId: 'flowL_design_critique' as FlowId,
    build: () => makeRuleBasedHandler('flowL_design_critique' as FlowId),
  });
  expect(
    'mixed: first flow (live) records tokenSource="live"',
    mixed1.tokenSource === 'live',
    `got ${mixed1.tokenSource}`,
  );
  expect(
    'mixed: second flow (rule-based) records tokenSource="synthetic"',
    mixed2.tokenSource === 'synthetic',
    `got ${mixed2.tokenSource}`,
  );
  expect(
    'mixed: first flow tokensInput from live entry (5000)',
    mixed1.tokensInput === 5000,
    `got ${mixed1.tokensInput}`,
  );
  expect(
    'mixed: first flow modelId from live entry (opus)',
    mixed1.modelId === TIERS.opus.exactModel,
    `got ${mixed1.modelId}`,
  );

  // === Test 4: LEDGER RESET BETWEEN FLOWS ===
  // Put a stale entry for flowJ in the ledger BEFORE invoking flowK. The
  // runner must reset the ledger before flowK runs, so the stale flowJ entry
  // does NOT contaminate flowK's row. Specifically: flowK should still go
  // through the synthetic path (its rule-based handler emitted nothing).
  resetLedger();
  // Stale entry that the runner should wipe before running flowK below.
  trackCost('flowJ_tactical_polish' as FlowId, TIERS.opus.exactModel, 99999, 33333);
  expect(
    'reset-precondition: stale entry seeded for flowJ',
    getSessionLedger().length === 1,
  );
  const reset1 = await runFlowOnFixture(fixture, {
    flowId: 'flowK_multi_lens_audit' as FlowId,
    build: () => makeRuleBasedHandler('flowK_multi_lens_audit' as FlowId),
  });
  expect(
    'reset: flowK still synthetic (stale flowJ entry wiped before flowK)',
    reset1.tokenSource === 'synthetic',
    `got ${reset1.tokenSource}`,
  );
  expect(
    'reset: flowK tokensInput is NOT the stale 99999',
    reset1.tokensInput !== 99999,
    `got ${reset1.tokensInput}`,
  );
  // Verify the ledger now contains only flowK's synthetic entry, no flowJ.
  const postResetLedger = getSessionLedger();
  expect(
    'reset: ledger after flowK contains NO flowJ entries',
    postResetLedger.every((e) => e.flowId !== 'flowJ_tactical_polish'),
    `ledger flowIds: ${postResetLedger.map((e) => e.flowId).join(',')}`,
  );
  expect(
    'reset: ledger after flowK contains exactly one flowK entry',
    postResetLedger.filter((e) => e.flowId === 'flowK_multi_lens_audit').length === 1,
  );

  // === Test 5: LIVE PATH WITH MULTIPLE CALLS ===
  // A handler that calls trackCost twice (e.g. two LLM invocations in one
  // flow) should have its tokens summed.
  resetLedger();
  const multiCallResult = await runFlowOnFixture(fixture, {
    flowId: 'flowJ_tactical_polish' as FlowId,
    build: () => ({
      execute: async (): Promise<FlowExecutionResult> => {
        trackCost('flowJ_tactical_polish' as FlowId, TIERS.haiku.exactModel, 1000, 300);
        trackCost('flowJ_tactical_polish' as FlowId, TIERS.haiku.exactModel, 2000, 600);
        return {
          flowId: 'flowJ_tactical_polish' as FlowId,
          flowName: 'multi-call',
          status: 'success' as const,
          message: 'two LLM calls',
        };
      },
    }),
  });
  expect(
    'multi-call live: tokensInput summed across calls (3000)',
    multiCallResult.tokensInput === 3000,
    `got ${multiCallResult.tokensInput}`,
  );
  expect(
    'multi-call live: tokensOutput summed across calls (900)',
    multiCallResult.tokensOutput === 900,
    `got ${multiCallResult.tokensOutput}`,
  );
  expect(
    'multi-call live: tokenSource still "live"',
    multiCallResult.tokenSource === 'live',
  );

  // === Test 6: ERROR-PATH SYNTHETIC FALLBACK ===
  // A handler that throws should still produce a row with tokenSource set.
  // No trackCost was called -> synthetic.
  resetLedger();
  const errorResult = await runFlowOnFixture(fixture, {
    flowId: 'flowL_design_critique' as FlowId,
    build: () => ({
      execute: async (): Promise<FlowExecutionResult> => {
        throw new Error('handler exploded');
      },
    }),
  });
  expect(
    'error-path: status is error',
    errorResult.status === 'error',
    `got ${errorResult.status}`,
  );
  expect(
    'error-path: tokenSource still set to "synthetic"',
    errorResult.tokenSource === 'synthetic',
    `got ${errorResult.tokenSource}`,
  );

  // === Report ===
  let allPass = true;
  for (const c of checks) {
    if (c.ok) {
      console.log(`PASS ${c.label}`);
    } else {
      console.log(`FAIL ${c.label}${c.detail ? ' :: ' + c.detail : ''}`);
      allPass = false;
    }
  }
  const total = checks.length;
  const passed = checks.filter((c) => c.ok).length;
  console.log('---');
  console.log(`t16-bench-ledger: ${passed}/${total} passed`);
  console.log(allPass ? 't16-bench-ledger PASS' : 't16-bench-ledger FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
