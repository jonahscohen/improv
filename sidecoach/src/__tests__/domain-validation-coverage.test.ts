/**
 * Domain-validation coverage + ordering regression tests.
 *
 * Guards the live flow domain-validation path in sidecoach-orchestrator.ts:
 *   1. ORDERING (the closed bug): the composite loop (runCompositeLoop) used to persist a
 *      step's memory BEFORE attaching its domain-validation outcomes, so a composite could
 *      persist memory without its domain-validation results. These tests drive the real
 *      private runCompositeLoop and assert a domain-rule failure lands in BOTH
 *      result.validationResults AND the persisted flow-history memory entry.
 *   2. ISOLATION: recordFlowWithMemory persists the { domain, status, ... } domain outcomes
 *      under a DISTINCT key (domainValidationResults) so the { check, result, details }
 *      memory-channel array (result.memory.validationResults -> entry.validationResults,
 *      consumed by session-memory-writer + build-report) is never shape-corrupted.
 *
 * Uses flowE_motion_patterns: it has NO prerequisites (flow-prerequisites.ts) and is mapped
 * to ['performance', 'content_quality'] (flow-domain-validators.ts), so a fake handler can
 * make the performance domain fail deterministically without any project/PRODUCT.md setup.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Isolate flow-history persistence to a throwaway HOME BEFORE the singleton is constructed.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-domainval-'));
process.env.HOME = TMP_HOME;
process.env.SIDECOACH_SESSION_ID = `domainval-${process.pid}-${Date.now()}`;
delete process.env.SIDECOACH_PROJECT_PATH; // keep enrichContextForHandler a no-op (no project I/O)

import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import { getFlowHistory, resetFlowHistorySingleton } from '../flow-history';
import { FlowHandler, FlowExecutionContext, FlowExecutionResult } from '../flow-handler';
import { CompositeFlowDefinition } from '../flow-composition';

resetFlowHistorySingleton();

interface Case { name: string; passed: boolean; detail?: string; }
const results: Case[] = [];
function check(name: string, passed: boolean, detail?: string): void {
  results.push({ name, passed, detail });
}

// A fake handler standing in for flowE_motion_patterns whose result is fully caller-controlled.
class FakeFlowEHandler implements FlowHandler {
  flowId = 'flowE_motion_patterns' as any;
  constructor(private readonly produce: () => FlowExecutionResult) {}
  canExecute(_context: FlowExecutionContext): boolean { return true; }
  async execute(_context: FlowExecutionContext): Promise<FlowExecutionResult> { return this.produce(); }
}

function makeOrchestratorWithFake(produce: () => FlowExecutionResult): FlowExecutionEngine {
  const orch = new FlowExecutionEngine();
  // Overwrite the real handler with a deterministic fake (handlers is a private Map).
  (orch as any).handlers.set('flowE_motion_patterns', new FakeFlowEHandler(produce));
  return orch;
}

const singleStepComposite: CompositeFlowDefinition = {
  id: 'test_composite_domainval',
  name: 'Domain-validation composite',
  description: 'single flowE step used to exercise runCompositeLoop domain validation',
  steps: [{ flowId: 'flowE_motion_patterns' as any }],
};

function baseCtx(): FlowExecutionContext {
  // No projectPath -> enrichContextForHandler returns the context unchanged (no project read).
  return { utterance: 'test domain validation', metadata: {} };
}

async function runComposite(orch: FlowExecutionEngine): Promise<any> {
  getFlowHistory().clearSession();
  // runCompositeLoop(compositeFlow, executionContext, flowResults, startIndex, utterance)
  return await (orch as any).runCompositeLoop(singleStepComposite, baseCtx(), [], 0, 'test domain validation');
}

function persistedEntryFor(flowId: string): any {
  return getFlowHistory().getFlowSequence().find((e: any) => e.flowId === flowId);
}

// ---------------------------------------------------------------------------
// Test 1 (REQUIRED): a composite step that FAILS a domain rule has that failure
// in BOTH result.validationResults AND its persisted memory entry.
// ---------------------------------------------------------------------------
async function testFailureInBothPlaces(): Promise<void> {
  const orch = makeOrchestratorWithFake(() => ({
    flowId: 'flowE_motion_patterns' as any,
    flowName: 'flowE_motion_patterns',
    status: 'success',
    message: 'motion guidance produced',
    // No performance/fps/animation/motion/optimize/smooth keywords -> performance domain fails
    // both rules. No AI-slop -> content_quality passes. Guarantees a concrete failing domain.
    guidance: ['Ship the build now'],
    checklist: [],
  }));

  const composite = await runComposite(orch);
  const stepResult = composite.flowResults?.[0];

  const topVrs: any[] = (stepResult?.validationResults) || [];
  const perfTop = topVrs.find((v) => v.domain === 'performance');
  check(
    'result.validationResults carries the failing performance domain',
    !!perfTop && perfTop.status !== 'pass' && Array.isArray(perfTop.failedRules) && perfTop.failedRules.length > 0,
    `perf=${JSON.stringify(perfTop)}`
  );

  const entry = persistedEntryFor('flowE_motion_patterns');
  const memVrs: any[] = (entry && entry.domainValidationResults) || [];
  const perfMem = memVrs.find((v) => v.domain === 'performance');
  check(
    'persisted memory entry carries the failing performance domain (ordering fix)',
    !!perfMem && perfMem.status !== 'pass' && Array.isArray(perfMem.failedRules) && perfMem.failedRules.length > 0,
    `entryDomainVrs=${JSON.stringify(memVrs)}`
  );

  // Same failed rule set in both places -> memory is not a stale/partial snapshot.
  check(
    'BOTH places agree on the failed performance rules',
    !!perfTop && !!perfMem && JSON.stringify(perfTop.failedRules) === JSON.stringify(perfMem.failedRules),
    `top=${JSON.stringify(perfTop?.failedRules)} mem=${JSON.stringify(perfMem?.failedRules)}`
  );
}

// ---------------------------------------------------------------------------
// Test 2: behavior preservation - a step that PASSES all domain rules still
// validates identically and persists its (passing) domain outcomes to memory.
// ---------------------------------------------------------------------------
async function testPassingStillValidates(): Promise<void> {
  const orch = makeOrchestratorWithFake(() => ({
    flowId: 'flowE_motion_patterns' as any,
    flowName: 'flowE_motion_patterns',
    status: 'success',
    message: 'motion guidance produced',
    guidance: [
      'Performance budget: 60 FPS animation target',
      'Optimize for smoothness with a reduced-motion fallback',
    ],
    checklist: [],
  }));

  const composite = await runComposite(orch);
  const stepResult = composite.flowResults?.[0];
  const topVrs: any[] = (stepResult?.validationResults) || [];
  const perfTop = topVrs.find((v) => v.domain === 'performance');
  check(
    'passing step: performance domain validates as pass on the result',
    !!perfTop && perfTop.status === 'pass',
    `perf=${JSON.stringify(perfTop)}`
  );

  const entry = persistedEntryFor('flowE_motion_patterns');
  const memVrs: any[] = (entry && entry.domainValidationResults) || [];
  const perfMem = memVrs.find((v) => v.domain === 'performance');
  check(
    'passing step: persisted memory carries the passing performance domain',
    !!perfMem && perfMem.status === 'pass',
    `entryDomainVrs=${JSON.stringify(memVrs)}`
  );
}

// ---------------------------------------------------------------------------
// Test 3: ISOLATION - the handler's own memory-channel validationResults
// ({ check, result, details }) survive intact and are NOT overwritten by the
// { domain, ... } domain outcomes (session-memory-writer reads v.result).
// ---------------------------------------------------------------------------
async function testMemoryChannelNotCorrupted(): Promise<void> {
  const orch = makeOrchestratorWithFake(() => ({
    flowId: 'flowE_motion_patterns' as any,
    flowName: 'flowE_motion_patterns',
    status: 'success',
    message: 'motion guidance produced',
    guidance: ['Ship the build now'], // performance fails -> non-empty domain outcomes exist
    checklist: [],
    memory: {
      // Only the fields recordFlowWithMemory reads; the memory channel uses the
      // { check, result, details } shape that session-memory-writer filters on v.result.
      validationResults: [{ check: 'handler-self-check', result: 'fail', details: 'handler said so' }],
    } as any,
  }));

  await runComposite(orch);
  const entry = persistedEntryFor('flowE_motion_patterns');

  const memChannel: any[] = (entry && entry.validationResults) || [];
  const keptShape = memChannel.length === 1 && memChannel[0].check === 'handler-self-check' && memChannel[0].result === 'fail';
  check(
    'memory-channel entry.validationResults keeps its { check, result, details } shape',
    keptShape,
    `entry.validationResults=${JSON.stringify(memChannel)}`
  );

  const domainChannel: any[] = (entry && entry.domainValidationResults) || [];
  const hasDomain = domainChannel.some((v) => v.domain === 'performance' && v.status !== 'pass');
  check(
    'domain outcomes persist under the distinct entry.domainValidationResults key',
    hasDomain,
    `entry.domainValidationResults=${JSON.stringify(domainChannel)}`
  );

  // Explicit non-corruption guard: the memory channel must not contain a { domain } object.
  check(
    'memory channel is NOT polluted with { domain, ... } domain-shape objects',
    !memChannel.some((v) => typeof v.domain === 'string'),
    `entry.validationResults=${JSON.stringify(memChannel)}`
  );
}

async function runTests(): Promise<void> {
  try {
    await testFailureInBothPlaces();
    await testPassingStillValidates();
    await testMemoryChannelNotCorrupted();
  } catch (err) {
    check('test harness ran without throwing', false, (err as Error).stack || String(err));
  } finally {
    try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }

  console.log('Domain-validation coverage + ordering tests');
  console.log('='.repeat(60));
  let failed = 0;
  for (const r of results) {
    console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.name}`);
    if (!r.passed) {
      failed++;
      if (r.detail) console.log(`     ${r.detail}`);
    }
  }
  console.log('='.repeat(60));
  console.log(`domain-validation-coverage: ${results.length - failed}/${results.length} passed`);

  if (failed > 0) process.exit(1);
}

runTests();
