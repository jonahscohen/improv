"use strict";
/**
 * Phase I Block 3: Enhanced Context Tracking E2E Test
 * Verifies execution chain tracking, context snapshots, and metadata propagation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
const results = [];
async function testBlock3() {
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // Test 1: Single flow execution records execution chain
    try {
        const result = await engine.process('brand verify', {
            projectPath: process.cwd(),
            utterance: 'brand verify',
        });
        // Check if execution metadata is recorded
        const hasExecutionMetadata = result.flowResults.some(r => r.executionMetadata);
        results.push({
            test: 'Single flow execution records executionMetadata',
            passed: hasExecutionMetadata,
            message: hasExecutionMetadata ? 'executionMetadata present' : 'executionMetadata missing',
        });
        // Check if execution chain is populated
        const hasExecutionChain = result.flowResults.some(r => r.executionMetadata?.executionChain && r.executionMetadata.executionChain.length > 0);
        results.push({
            test: 'Single flow execution populates executionChain',
            passed: hasExecutionChain,
            message: hasExecutionChain ? 'chain populated' : 'chain empty',
        });
        // Check if duration is calculated.
        // VACUITY FIXED 2026-07-28 (Jonah, Codex review): this read
        // `r.executionMetadata?.executionDuration !== null`, and optional chaining yields
        // `undefined` when executionMetadata is absent - `undefined !== null` is TRUE, so the
        // assertion passed for every result that had NO metadata at all, which is the exact
        // opposite of what it claims to check. Requiring a number is the real contract.
        const hasDuration = result.flowResults.some(r => typeof r.executionMetadata?.executionDuration === 'number');
        results.push({
            test: 'Single flow execution calculates executionDuration',
            passed: hasDuration,
            message: hasDuration ? 'duration calculated' : 'duration missing',
        });
        // Check that flow status is recorded in execution chain
        const chainEntry = result.flowResults[0]?.executionMetadata?.executionChain?.[0];
        const chainHasStatus = chainEntry?.status === 'completed' || chainEntry?.status === 'error';
        results.push({
            test: 'Execution chain entry has status (completed or error)',
            passed: chainHasStatus,
            message: chainHasStatus ? `status: ${chainEntry?.status}` : 'status missing',
        });
    }
    catch (err) {
        results.push({
            test: 'Single flow execution test',
            passed: false,
            message: err instanceof Error ? err.message : String(err),
        });
    }
    // Test 2: Composite flow execution tracks multiple flows in chain
    try {
        const result = await engine.process('/sidecoach composite:composite_research_to_impl', {
            projectPath: process.cwd(),
            utterance: '/sidecoach composite:composite_research_to_impl',
        });
        // Check if composite returns results
        const hasFlowResults = result.flowResults && result.flowResults.length > 0;
        results.push({
            test: 'Composite flow execution returns flowResults',
            passed: hasFlowResults,
            message: hasFlowResults ? `${result.flowResults.length} flows` : 'no results',
        });
        // Check if multiple flows are tracked
        const multipleChains = result.flowResults.some(r => r.executionMetadata?.executionChain && r.executionMetadata.executionChain.length > 1);
        results.push({
            test: 'Composite flow tracks multiple flows in execution chain',
            passed: multipleChains,
            message: multipleChains ? 'multiple flows tracked' : 'single flow only',
        });
    }
    catch (err) {
        results.push({
            test: 'Composite flow execution test',
            passed: false,
            message: err instanceof Error ? err.message : String(err),
        });
    }
    // Test 3: Context metadata structure validation
    try {
        const result = await engine.process('brand verify', {
            projectPath: process.cwd(),
            utterance: 'brand verify',
        });
        if (result.flowResults.length > 0) {
            const firstResult = result.flowResults[0];
            const metadata = firstResult.executionMetadata;
            // Check structure
            const hasCorrectStructure = !!metadata &&
                'executionChain' in metadata &&
                'executionDuration' in metadata;
            results.push({
                test: 'ExecutionMetadata has correct structure',
                passed: hasCorrectStructure,
                message: hasCorrectStructure ? 'structure valid' : 'structure invalid',
            });
            // Check execution chain entry structure
            const chainEntry = metadata?.executionChain?.[0];
            const entryHasRequiredFields = !!chainEntry &&
                'flowId' in chainEntry &&
                'flowName' in chainEntry &&
                'startTime' in chainEntry &&
                'status' in chainEntry;
            results.push({
                test: 'ExecutionChainEntry has required fields',
                passed: entryHasRequiredFields,
                message: entryHasRequiredFields
                    ? 'all fields present'
                    : 'missing required fields',
            });
        }
        else {
            // SILENT-SKIP FIXED 2026-07-28 (Jonah, Codex review): with no flowResults this block
            // pushed NOTHING, so the two assertions above simply vanished and the suite reported
            // a smaller denominator (8/8 instead of 8/10) while claiming to have checked metadata
            // structure. A test that quietly stops existing when its subject is missing is the same
            // "looks like coverage, is not coverage" failure as an unreachable assertion.
            results.push({
                test: 'ExecutionMetadata has correct structure',
                passed: false,
                message: 'no flowResults returned - metadata structure could not be checked',
            });
            results.push({
                test: 'ExecutionChainEntry has required fields',
                passed: false,
                message: 'no flowResults returned - chain entry could not be checked',
            });
        }
    }
    catch (err) {
        results.push({
            test: 'Context metadata structure test',
            passed: false,
            message: err instanceof Error ? err.message : String(err),
        });
    }
    // Test 4: Error handling preserves execution metadata
    //
    // INPUT REPLACED 2026-07-28 (Jonah). The assertion is the same one; the input it was given
    // could never reach it.
    //
    // This case used to call `engine.process('unknown flow xyz')` and then assert
    // `flowResults.some(r => r.status === 'error' && r.executionMetadata)`. Measured under both
    // a cold and a warmed flow history, that call returns `flowResults: []` - an unrecognized
    // utterance never resolves to a flow, so there is no flow result of ANY status to carry
    // metadata, and `.some()` on an empty array is false unconditionally. The assertion was
    // unreachable by construction: it could not pass, and it could not have caught a regression
    // either. It looked like coverage of the error path and was coverage of nothing. The suite
    // printed `Status: FAILED` and exited 0, so the gate never surfaced it.
    //
    // The product genuinely HAS the behaviour being claimed: the natural-language chain wraps
    // handler.execute in try/catch and attaches executionMetadata on BOTH the success and error
    // paths (sidecoach-orchestrator.ts:1774). The only way in is a flow that RESOLVES and then
    // throws, so the test now injects exactly that and restores the handler afterwards.
    try {
        const INJECTED = 'phase-i-block3 injected handler failure';
        // Same access pattern as the green gated sprint2-orchestrator-getHandlers.test.ts:
        // getHandlers() is declared ReadonlyMap, so patching a member needs the loose view.
        const handlers = engine.getHandlers();
        const targetFlowId = 'flowA_brand_verify';
        const handler = handlers.get(targetFlowId);
        // NON-VACUITY GUARD 1: if the handler is not there to patch, every assertion below would
        // be measuring an unpatched run. Fail loudly rather than silently testing nothing.
        if (!handler) {
            results.push({
                test: 'Error flows record executionMetadata',
                passed: false,
                message: `cannot reach the error path: no handler registered for ${targetFlowId}`,
            });
        }
        else {
            const original = handler.execute;
            handler.execute = async () => {
                throw new Error(INJECTED);
            };
            let result;
            try {
                result = await engine.process('brand verify', {
                    projectPath: process.cwd(),
                    utterance: 'brand verify',
                });
            }
            finally {
                handler.execute = original;
            }
            const errored = result.flowResults.filter(r => r.status === 'error');
            // NON-VACUITY GUARD 2: the error must be OURS. Without this, an unrelated failure
            // elsewhere in the chain would satisfy the assertion and the test would pass without
            // ever exercising the injected path.
            const fromInjection = errored.filter(r => (r.message || '').includes(INJECTED) || (r.error || '').includes(INJECTED));
            results.push({
                test: 'Injected handler failure actually reached the error path',
                passed: fromInjection.length > 0,
                message: fromInjection.length > 0
                    ? `${fromInjection.length} error result(s) carry the injected marker`
                    : 'no error result carried the injected marker - the assertion below would be vacuous',
            });
            const hasMetadataOnError = fromInjection.some(r => !!r.executionMetadata);
            results.push({
                test: 'Error flows record executionMetadata',
                passed: hasMetadataOnError,
                message: hasMetadataOnError ? 'metadata on error' : 'no metadata on error',
            });
        }
    }
    catch (err) {
        results.push({
            test: 'Error handling test',
            passed: false,
            message: err instanceof Error ? err.message : String(err),
        });
    }
}
// Run tests
(async () => {
    await testBlock3();
    // Print results
    console.log('Phase I Block 3: Enhanced Context Tracking E2E Tests');
    console.log('====================================================\n');
    const passed = results.filter(r => r.passed).length;
    console.log(`Results: ${passed}/${results.length} tests passing\n`);
    results.forEach(r => {
        console.log(`  ${r.passed ? '✓' : '✗'} ${r.test}`);
        if (r.message) {
            console.log(`    ${r.message}`);
        }
    });
    // FAIL-LOUD 2026-07-28 (Jonah): this suite used to tally a verdict, print it, and then fall
    // off the end of the file, which exits 0. That is the defect class the runner fix in
    // scripts/run-tests.ts exists to catch; wiring the exit code makes the suite honest on its
    // own rather than depending on the runner's transcript scan to notice.
    const allPassed = passed === results.length;
    console.log(`\nStatus: ${allPassed ? 'PASSED' : 'FAILED'}`);
    process.exit(allPassed ? 0 : 1);
})();
//# sourceMappingURL=phase-i-block3-context-tracking-e2e.test.js.map