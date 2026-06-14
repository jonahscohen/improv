// T-0020: Convergence-mode relentless cross-flow iteration tests.
//
// Covers the five scenarios from TASKS.md plus a handful of guard checks:
//   1. Convergence: mock validators return clean -> converges at iter 1
//   2. Stalled: mock validators return same findings 3 times -> stalled at iter 3
//   3. Capped: mock validators always return findings -> capped at iter 10
//   4. Progress signature: different findings each iter -> doesn't stall
//   5. Empty flow chain: returns error (invalid config)
// Plus: missing runFlow rejection, runner-throw isolation, chain ordering
// preserved in logs, fix-applier hook invocation, signature stability across
// finding order shuffles, and the log message format the team-lead spec
// called out verbatim.

import {
  runConvergenceLoop,
  computeProgressSignature,
  DEFAULT_CONVERGENCE_FLOW_CHAIN,
  DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS,
  DEFAULT_CONVERGENCE_MAX_NO_PROGRESS_ITERATIONS,
  ConvergenceFinding,
  ConvergenceFlowRunner,
} from '../convergence-loop';
import { FlowId } from '../types';

interface Check {
  label: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];

function expect(label: string, ok: boolean, detail?: string): void {
  checks.push({ label, ok, detail });
}

function makeFinding(flowId: FlowId, ruleId: string, validator = 'polish-standard'): ConvergenceFinding {
  return { flowId, validator, ruleId, severity: 'high', message: `rule ${ruleId} failed` };
}

// A logger that captures lines so tests can assert log format without
// spamming the console during the run. Tests can opt into the default
// console logger by omitting this.
function makeCaptureLogger(): { logger: (line: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { lines, logger: (line: string) => lines.push(line) };
}

async function run(): Promise<void> {
  // === Section 1: Convergence - validators clean on the first try ===
  {
    const cap = makeCaptureLogger();
    const runFlow: ConvergenceFlowRunner = async () => ({ findings: [] });
    const result = await runConvergenceLoop('/tmp/clean-target', { runFlow, logger: cap.logger });
    expect('convergence: status=converged', result.status === 'converged', result.status);
    expect('convergence: iterations=1', result.iterations === 1, String(result.iterations));
    expect('convergence: totalFindings=0', result.totalFindings === 0, String(result.totalFindings));
    expect(
      'convergence: history has one iteration',
      result.history.length === 1,
      `len=${result.history.length}`,
    );
    expect(
      'convergence: log mentions CONVERGED in 1 iter',
      cap.lines.some((l) => l.includes('CONVERGED in 1 iter')),
      cap.lines.join('\n'),
    );
    expect(
      'convergence: log includes per-flow zero-violation lines for default chain',
      DEFAULT_CONVERGENCE_FLOW_CHAIN.every((flowId) =>
        cap.lines.some((l) => l.includes(`${flowId} found 0 violations`)),
      ),
      cap.lines.join('\n'),
    );
  }

  // === Section 2: Stalled - same findings repeat for maxNoProgress iterations ===
  {
    const cap = makeCaptureLogger();
    const sameFindings: ConvergenceFinding[] = [
      makeFinding('flowJ_tactical_polish', 'rule-1'),
      makeFinding('flowK_multi_lens_audit', 'rule-A', 'multi-lens-audit'),
    ];
    const runFlow: ConvergenceFlowRunner = async ({ flowId }) => ({
      // Each flow surfaces its own portion of the static finding set so the
      // signature stays stable across iterations (no fix-applier wired).
      findings: sameFindings.filter((f) => f.flowId === flowId),
    });
    const result = await runConvergenceLoop('/tmp/stalled-target', {
      runFlow,
      logger: cap.logger,
      maxNoProgressIterations: 3,
    });
    expect('stalled: status=stalled', result.status === 'stalled', result.status);
    expect('stalled: iterations=3', result.iterations === 3, String(result.iterations));
    expect(
      'stalled: signature reported',
      typeof result.lastSignature === 'string' && result.lastSignature.length === 12,
      result.lastSignature,
    );
    expect(
      'stalled: remaining findings non-empty',
      Array.isArray(result.remainingFindings) && (result.remainingFindings?.length || 0) > 0,
      JSON.stringify(result.remainingFindings),
    );
    expect(
      'stalled: log emits STALLED line',
      cap.lines.some((l) => l.includes('STALLED at iter 3')),
      cap.lines.join('\n'),
    );
  }

  // === Section 3: Capped - findings persist but evolve enough to avoid stall ===
  {
    const cap = makeCaptureLogger();
    let iter = 0;
    const runFlow: ConvergenceFlowRunner = async ({ flowId, iteration }) => {
      iter = iteration;
      // Rotate the finding identity each iteration so the signature changes
      // every iteration. The loop cannot detect stall (signatures all
      // unique) and cannot converge (findings always non-empty). Eventually
      // it must hit the global cap.
      return {
        findings: [makeFinding(flowId, `rotating-rule-${iteration}`)],
      };
    };
    const result = await runConvergenceLoop('/tmp/capped-target', {
      runFlow,
      logger: cap.logger,
      // Default max is 10 - we accept that here to match the spec verbatim.
    });
    expect('capped: status=capped', result.status === 'capped', result.status);
    expect(
      'capped: iterations=default max (10)',
      result.iterations === DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS,
      String(result.iterations),
    );
    expect(
      'capped: hit exactly DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS (10) iter values',
      iter === DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS,
      String(iter),
    );
    expect(
      'capped: log emits CAPPED at maxIter (10)',
      cap.lines.some((l) => l.includes('CAPPED at maxIter (10)')),
      cap.lines.join('\n'),
    );
    expect(
      'capped: remainingFindings present',
      Array.isArray(result.remainingFindings) && (result.remainingFindings?.length || 0) > 0,
      JSON.stringify(result.remainingFindings),
    );
  }

  // === Section 4: Progress signature differs each iter -> no stall, no converge ===
  {
    const cap = makeCaptureLogger();
    const runFlow: ConvergenceFlowRunner = async ({ flowId, iteration }) => ({
      findings: [makeFinding(flowId, `unique-${iteration}`)],
    });
    // Limit to 5 to exercise the cap path cleanly (different from section 3
    // which uses default of 10).
    const result = await runConvergenceLoop('/tmp/no-stall-target', {
      runFlow,
      logger: cap.logger,
      maxGlobalIterations: 5,
      maxNoProgressIterations: 3,
    });
    expect('progress-signature: status=capped (not stalled)', result.status === 'capped', result.status);
    expect('progress-signature: iterations=5', result.iterations === 5, String(result.iterations));

    // Each iteration's signature must be distinct (the loop did not stall).
    const seenSigs = new Set(result.history.map((h) => h.signature));
    expect(
      'progress-signature: every iteration has a unique signature',
      seenSigs.size === result.history.length,
      `unique=${seenSigs.size} total=${result.history.length}`,
    );
  }

  // === Section 5: Empty flow chain -> error result ===
  {
    const cap = makeCaptureLogger();
    const runFlow: ConvergenceFlowRunner = async () => ({ findings: [] });
    const result = await runConvergenceLoop('/tmp/empty-chain-target', {
      runFlow,
      logger: cap.logger,
      flowChain: [],
    });
    expect('empty-chain: status=error', result.status === 'error', result.status);
    expect('empty-chain: iterations=0', result.iterations === 0, String(result.iterations));
    expect(
      'empty-chain: error message names flowChain',
      typeof result.error === 'string' && result.error.includes('flowChain'),
      result.error,
    );
    expect(
      'empty-chain: log emitted the error line',
      cap.lines.some((l) => l.includes('flowChain is empty')),
      cap.lines.join('\n'),
    );
  }

  // === Section 6: Missing runFlow -> error result ===
  {
    const cap = makeCaptureLogger();
    const result = await runConvergenceLoop('/tmp/no-runner-target', { logger: cap.logger });
    expect('missing-runner: status=error', result.status === 'error', result.status);
    expect(
      'missing-runner: error mentions runFlow',
      typeof result.error === 'string' && result.error.includes('runFlow'),
      result.error,
    );
  }

  // === Section 7: Per-iteration log format matches the spec verbatim ===
  // The spec calls for `[convergence] iter N/M: <flow> found <X> violations` lines.
  {
    const cap = makeCaptureLogger();
    const runFlow: ConvergenceFlowRunner = async ({ flowId, iteration }) => {
      // Iteration 1: finding. Iteration 2: clean -> converge.
      if (iteration === 1) {
        return { findings: [makeFinding(flowId, 'r-1')] };
      }
      return { findings: [] };
    };
    const result = await runConvergenceLoop('/tmp/format-target', {
      runFlow,
      logger: cap.logger,
      maxGlobalIterations: 5,
      flowChain: ['flowJ_tactical_polish'],
    });
    expect(
      'log-format: status=converged on iter 2',
      result.status === 'converged' && result.iterations === 2,
      `${result.status} iter=${result.iterations}`,
    );
    const iter1Line = cap.lines.find((l) =>
      l.includes('iter 1/5: flowJ_tactical_polish found 1 violations'),
    );
    expect(
      'log-format: iter 1 line matches `[convergence] iter N/M: <flow> found X violations`',
      typeof iter1Line === 'string' && iter1Line.startsWith('[convergence]'),
      iter1Line,
    );
    const iter2Line = cap.lines.find((l) =>
      l.includes('iter 2/5: flowJ_tactical_polish found 0 violations'),
    );
    expect(
      'log-format: iter 2 line includes 0 violations before CONVERGED',
      typeof iter2Line === 'string',
      iter2Line,
    );
  }

  // === Section 8: Runner throw can NO LONGER converge (truthful convergence) ===
  {
    const cap = makeCaptureLogger();
    let invocations = 0;
    const runFlow: ConvergenceFlowRunner = async ({ flowId }) => {
      invocations++;
      if (flowId === 'flowK_multi_lens_audit') throw new Error('synthetic-runner-failure');
      return { findings: [] };   // polish + critique find nothing; audit throws every pass
    };
    const result = await runConvergenceLoop('/tmp/runner-throw-target', { runFlow, logger: cap.logger });
    expect(
      'runner-throw: does NOT converge (a flow error blocks convergence)',
      result.status !== 'converged',
      `${result.status}`,
    );
    expect(
      'runner-throw: stalls because the same error repeats with no progress',
      result.status === 'stalled',
      `${result.status}`,
    );
    expect(
      'runner-throw: error line logged for the throwing flow',
      cap.lines.some((l) => l.includes('runner threw') && l.includes('flowK_multi_lens_audit')),
      cap.lines.join('\n'),
    );
    const auditRecord = result.history[0]?.flowResults.find((fr) => fr.flowId === 'flowK_multi_lens_audit');
    expect(
      'runner-throw: error recorded on the iteration flow result',
      !!auditRecord && typeof auditRecord.error === 'string',
      JSON.stringify(auditRecord),
    );
  }

  // === Section 9: Chain ordering preserved in invocation order ===
  {
    const seenFlows: FlowId[] = [];
    const runFlow: ConvergenceFlowRunner = async ({ flowId }) => {
      seenFlows.push(flowId);
      return { findings: [] };
    };
    await runConvergenceLoop('/tmp/order-target', {
      runFlow,
      logger: () => undefined,
      flowChain: ['flowL_design_critique', 'flowJ_tactical_polish', 'flowK_multi_lens_audit'],
    });
    expect(
      'chain-order: flows invoked in the order specified',
      seenFlows.length === 3 &&
        seenFlows[0] === 'flowL_design_critique' &&
        seenFlows[1] === 'flowJ_tactical_polish' &&
        seenFlows[2] === 'flowK_multi_lens_audit',
      JSON.stringify(seenFlows),
    );
  }

  // === Section 10: applyFixes is invoked between iterations and can affect findings ===
  {
    let fixesCalled = 0;
    let knockoutTriggered = false;
    const runFlow: ConvergenceFlowRunner = async ({ flowId, iteration }) => {
      // Iteration 1: 2 findings. Iteration 2 (after fix): 0 findings ->
      // converge. Demonstrates the forward-compat fix-applier signal.
      if (iteration === 1 || !knockoutTriggered) {
        return {
          findings: [
            makeFinding(flowId, 'r-a'),
            makeFinding(flowId, 'r-b'),
          ],
        };
      }
      return { findings: [] };
    };
    const applyFixes = async () => {
      fixesCalled++;
      knockoutTriggered = true;
    };
    const result = await runConvergenceLoop('/tmp/applyfixes-target', {
      runFlow,
      logger: () => undefined,
      applyFixes,
      maxGlobalIterations: 5,
      flowChain: ['flowJ_tactical_polish'],
    });
    expect('applyFixes: converged once fix was applied', result.status === 'converged', result.status);
    expect('applyFixes: invoked once', fixesCalled === 1, String(fixesCalled));
    expect('applyFixes: converged at iteration 2', result.iterations === 2, String(result.iterations));
  }

  // === Section 11: Signature is stable under permutation of findings ===
  {
    const a: ConvergenceFinding[] = [
      makeFinding('flowJ_tactical_polish', 'r1'),
      makeFinding('flowK_multi_lens_audit', 'r2'),
      makeFinding('flowL_design_critique', 'r3'),
    ];
    const b: ConvergenceFinding[] = [a[2], a[0], a[1]];
    const sigA = computeProgressSignature(a);
    const sigB = computeProgressSignature(b);
    expect('signature: stable across shuffles', sigA === sigB, `${sigA} vs ${sigB}`);
    expect('signature: 12 chars', sigA.length === 12, sigA);
    const sigEmpty = computeProgressSignature([]);
    expect('signature: empty findings still hashes', typeof sigEmpty === 'string' && sigEmpty.length === 12, sigEmpty);
    const sigDifferent = computeProgressSignature([makeFinding('flowJ_tactical_polish', 'rX')]);
    expect('signature: different findings differ', sigDifferent !== sigA && sigDifferent !== sigEmpty, sigDifferent);
  }

  // === Section 12: Defaults match the spec ===
  {
    expect(
      'defaults: maxGlobalIterations=10',
      DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS === 10,
      String(DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS),
    );
    expect(
      'defaults: maxNoProgressIterations=3',
      DEFAULT_CONVERGENCE_MAX_NO_PROGRESS_ITERATIONS === 3,
      String(DEFAULT_CONVERGENCE_MAX_NO_PROGRESS_ITERATIONS),
    );
    expect(
      'defaults: chain is [polish, audit, critique]',
      DEFAULT_CONVERGENCE_FLOW_CHAIN.length === 3 &&
        DEFAULT_CONVERGENCE_FLOW_CHAIN[0] === 'flowJ_tactical_polish' &&
        DEFAULT_CONVERGENCE_FLOW_CHAIN[1] === 'flowK_multi_lens_audit' &&
        DEFAULT_CONVERGENCE_FLOW_CHAIN[2] === 'flowL_design_critique',
      JSON.stringify(DEFAULT_CONVERGENCE_FLOW_CHAIN),
    );
  }

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
  console.log(`t20-convergence-loop: ${passed}/${total} passed`);
  console.log(allPass ? 't20-convergence-loop PASS' : 't20-convergence-loop FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
