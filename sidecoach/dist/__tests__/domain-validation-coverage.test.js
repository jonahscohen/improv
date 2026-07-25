"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Isolate flow-history persistence to a throwaway HOME BEFORE the singleton is constructed.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-domainval-'));
process.env.HOME = TMP_HOME;
process.env.SIDECOACH_SESSION_ID = `domainval-${process.pid}-${Date.now()}`;
delete process.env.SIDECOACH_PROJECT_PATH; // keep enrichContextForHandler a no-op (no project I/O)
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
const flow_history_1 = require("../flow-history");
(0, flow_history_1.resetFlowHistorySingleton)();
const results = [];
function check(name, passed, detail) {
    results.push({ name, passed, detail });
}
// A fake handler standing in for flowE_motion_patterns whose result is fully caller-controlled.
class FakeFlowEHandler {
    constructor(produce) {
        this.produce = produce;
        this.flowId = 'flowE_motion_patterns';
    }
    canExecute(_context) { return true; }
    async execute(_context) { return this.produce(); }
}
function makeOrchestratorWithFake(produce) {
    const orch = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // Overwrite the real handler with a deterministic fake (handlers is a private Map).
    orch.handlers.set('flowE_motion_patterns', new FakeFlowEHandler(produce));
    return orch;
}
const singleStepComposite = {
    id: 'test_composite_domainval',
    name: 'Domain-validation composite',
    description: 'single flowE step used to exercise runCompositeLoop domain validation',
    steps: [{ flowId: 'flowE_motion_patterns' }],
};
function baseCtx() {
    // No projectPath -> enrichContextForHandler returns the context unchanged (no project read).
    return { utterance: 'test domain validation', metadata: {} };
}
async function runComposite(orch) {
    (0, flow_history_1.getFlowHistory)().clearSession();
    // runCompositeLoop(compositeFlow, executionContext, flowResults, startIndex, utterance)
    return await orch.runCompositeLoop(singleStepComposite, baseCtx(), [], 0, 'test domain validation');
}
function persistedEntryFor(flowId) {
    return (0, flow_history_1.getFlowHistory)().getFlowSequence().find((e) => e.flowId === flowId);
}
// ---------------------------------------------------------------------------
// Test 1 (REQUIRED): a composite step that FAILS a domain rule has that failure
// in BOTH result.validationResults AND its persisted memory entry.
// ---------------------------------------------------------------------------
async function testFailureInBothPlaces() {
    const orch = makeOrchestratorWithFake(() => ({
        flowId: 'flowE_motion_patterns',
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
    const topVrs = (stepResult?.validationResults) || [];
    const perfTop = topVrs.find((v) => v.domain === 'performance');
    check('result.validationResults carries the failing performance domain', !!perfTop && perfTop.status !== 'pass' && Array.isArray(perfTop.failedRules) && perfTop.failedRules.length > 0, `perf=${JSON.stringify(perfTop)}`);
    const entry = persistedEntryFor('flowE_motion_patterns');
    const memVrs = (entry && entry.domainValidationResults) || [];
    const perfMem = memVrs.find((v) => v.domain === 'performance');
    check('persisted memory entry carries the failing performance domain (ordering fix)', !!perfMem && perfMem.status !== 'pass' && Array.isArray(perfMem.failedRules) && perfMem.failedRules.length > 0, `entryDomainVrs=${JSON.stringify(memVrs)}`);
    // Same failed rule set in both places -> memory is not a stale/partial snapshot.
    check('BOTH places agree on the failed performance rules', !!perfTop && !!perfMem && JSON.stringify(perfTop.failedRules) === JSON.stringify(perfMem.failedRules), `top=${JSON.stringify(perfTop?.failedRules)} mem=${JSON.stringify(perfMem?.failedRules)}`);
}
// ---------------------------------------------------------------------------
// Test 2: behavior preservation - a step that PASSES all domain rules still
// validates identically and persists its (passing) domain outcomes to memory.
// ---------------------------------------------------------------------------
async function testPassingStillValidates() {
    const orch = makeOrchestratorWithFake(() => ({
        flowId: 'flowE_motion_patterns',
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
    const topVrs = (stepResult?.validationResults) || [];
    const perfTop = topVrs.find((v) => v.domain === 'performance');
    check('passing step: performance domain validates as pass on the result', !!perfTop && perfTop.status === 'pass', `perf=${JSON.stringify(perfTop)}`);
    const entry = persistedEntryFor('flowE_motion_patterns');
    const memVrs = (entry && entry.domainValidationResults) || [];
    const perfMem = memVrs.find((v) => v.domain === 'performance');
    check('passing step: persisted memory carries the passing performance domain', !!perfMem && perfMem.status === 'pass', `entryDomainVrs=${JSON.stringify(memVrs)}`);
}
// ---------------------------------------------------------------------------
// Test 3: ISOLATION - the handler's own memory-channel validationResults
// ({ check, result, details }) survive intact and are NOT overwritten by the
// { domain, ... } domain outcomes (session-memory-writer reads v.result).
// ---------------------------------------------------------------------------
async function testMemoryChannelNotCorrupted() {
    const orch = makeOrchestratorWithFake(() => ({
        flowId: 'flowE_motion_patterns',
        flowName: 'flowE_motion_patterns',
        status: 'success',
        message: 'motion guidance produced',
        guidance: ['Ship the build now'], // performance fails -> non-empty domain outcomes exist
        checklist: [],
        memory: {
            // Only the fields recordFlowWithMemory reads; the memory channel uses the
            // { check, result, details } shape that session-memory-writer filters on v.result.
            validationResults: [{ check: 'handler-self-check', result: 'fail', details: 'handler said so' }],
        },
    }));
    await runComposite(orch);
    const entry = persistedEntryFor('flowE_motion_patterns');
    const memChannel = (entry && entry.validationResults) || [];
    const keptShape = memChannel.length === 1 && memChannel[0].check === 'handler-self-check' && memChannel[0].result === 'fail';
    check('memory-channel entry.validationResults keeps its { check, result, details } shape', keptShape, `entry.validationResults=${JSON.stringify(memChannel)}`);
    const domainChannel = (entry && entry.domainValidationResults) || [];
    const hasDomain = domainChannel.some((v) => v.domain === 'performance' && v.status !== 'pass');
    check('domain outcomes persist under the distinct entry.domainValidationResults key', hasDomain, `entry.domainValidationResults=${JSON.stringify(domainChannel)}`);
    // Explicit non-corruption guard: the memory channel must not contain a { domain } object.
    check('memory channel is NOT polluted with { domain, ... } domain-shape objects', !memChannel.some((v) => typeof v.domain === 'string'), `entry.validationResults=${JSON.stringify(memChannel)}`);
}
// ---------------------------------------------------------------------------
// Test 4 (uniform-append fix): domain validation APPENDS to result.validationResults
// rather than overwriting it, so a result the handler / taste gate / ClaudemdMandate
// check already pushed survives into result.validationResults AND the persisted memory
// (which the build-report reads). Directly exercises the composite auto-validator site.
// NEGATIVE CONTROL: asserting the pre-existing entry survives is exactly the assertion
// that FAILS under the old `result.validationResults = validations` overwrite. The
// natural-language single-flow site and the explicit-domain site apply the identical
// append expression.
// ---------------------------------------------------------------------------
async function testDomainValidationAppends() {
    const PRE = { domain: 'handler-preexisting', status: 'fail', passedRules: [], failedRules: ['handler-rule'] };
    const orch = makeOrchestratorWithFake(() => ({
        flowId: 'flowE_motion_patterns',
        flowName: 'flowE_motion_patterns',
        status: 'success',
        message: 'motion guidance produced',
        guidance: ['Ship the build now'], // performance domain fails -> auto domain validation produces outcomes
        checklist: [],
        // A result the handler (standing in for the taste gate / mandate check) pushed BEFORE domain validation runs.
        validationResults: [PRE],
    }));
    const composite = await runComposite(orch);
    const stepResult = composite.flowResults?.[0];
    const topVrs = (stepResult?.validationResults) || [];
    // the pre-existing entry SURVIVES (the old overwrite dropped it - this is the discriminating assertion).
    check('append: a pre-existing result.validationResults entry survives domain validation (not overwritten)', topVrs.some((v) => v.domain === 'handler-preexisting' && v.status === 'fail'), `topVrs=${JSON.stringify(topVrs)}`);
    // the domain-validation outcome is ALSO present (append added to, did not replace).
    check('append: the domain-validation outcome is present alongside the pre-existing entry', topVrs.some((v) => v.domain === 'performance' && v.status !== 'pass'), `topVrs=${JSON.stringify(topVrs)}`);
    // both survive into the persisted memory (build-report reads entry.domainValidationResults).
    const entry = persistedEntryFor('flowE_motion_patterns');
    const memVrs = (entry && entry.domainValidationResults) || [];
    check('append: BOTH the pre-existing entry and the domain outcome persist to memory', memVrs.some((v) => v.domain === 'handler-preexisting') && memVrs.some((v) => v.domain === 'performance'), `entryDomainVrs=${JSON.stringify(memVrs)}`);
}
async function runTests() {
    try {
        await testFailureInBothPlaces();
        await testPassingStillValidates();
        await testMemoryChannelNotCorrupted();
        await testDomainValidationAppends();
    }
    catch (err) {
        check('test harness ran without throwing', false, err.stack || String(err));
    }
    finally {
        try {
            fs.rmSync(TMP_HOME, { recursive: true, force: true });
        }
        catch { /* best-effort cleanup */ }
    }
    console.log('Domain-validation coverage + ordering tests');
    console.log('='.repeat(60));
    let failed = 0;
    for (const r of results) {
        console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.name}`);
        if (!r.passed) {
            failed++;
            if (r.detail)
                console.log(`     ${r.detail}`);
        }
    }
    console.log('='.repeat(60));
    console.log(`domain-validation-coverage: ${results.length - failed}/${results.length} passed`);
    if (failed > 0)
        process.exit(1);
}
runTests();
//# sourceMappingURL=domain-validation-coverage.test.js.map