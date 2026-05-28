"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const intent_detector_1 = require("./intent-detector");
const detector = new intent_detector_1.IntentDetector();
// Test cases from implementation checklist
// T-0015 (2026-05-28): updated to use post-cull canonical flow IDs.
// Legacy flow1..flow14 IDs are gone; lettered counterparts are now the targets.
const testCases = [
    {
        utterance: 'Make the button feel better',
        expectedFlow: 'flowJ_tactical_polish',
        reason: 'feel + polish folded into flowJ tactical polish',
    },
    {
        utterance: 'The sidebar feels cluttered',
        expectedFlow: 'flowR_layout_optimization',
        reason: 'cluttered + layout terms route to flowR layout optimization',
    },
    {
        utterance: 'Refactor the button component',
        expectedFlow: 'flowR_layout_optimization',
        reason: 'refactor + no API keyword routes to layout (flowR) by default',
    },
    {
        utterance: 'Refactor button API',
        expectedFlow: 'flowQ_migration_special',
        reason: 'refactor + API keyword routes to migration (flowQ)',
    },
    {
        utterance: 'Build a date picker',
        expectedFlow: 'flowZ_design_component',
        reason: 'design-from-scratch (no reference) preserved as flowZ',
    },
    {
        utterance: 'Build the date picker from the mockup',
        expectedFlow: 'flowG_component_implementation',
        reason: 'build + from source routes to flowG implement-from-design',
    },
    {
        utterance: 'What if we tried blue?',
        expectedFlow: 'flowY_explore_discovery',
        reason: 'open-ended exploration preserved as flowY',
    },
    {
        utterance: 'Let\'s iterate round 2',
        expectedFlow: 'flowN_rapid_iteration_refined',
        reason: 'iterate + round routes to flowN rapid iteration',
    },
];
function runTests() {
    console.log('Sidecoach Intent Detection Test Suite\n');
    console.log('='.repeat(80));
    let passed = 0;
    let failed = 0;
    for (const test of testCases) {
        const result = detector.detect(test.utterance);
        const isAmbiguous = 'isAmbiguous' in result;
        const actualFlow = isAmbiguous ? result.recommendation?.flowId : result.flowId;
        const match = actualFlow === test.expectedFlow;
        if (match) {
            passed++;
            console.log(`\n[PASS] "${test.utterance}"`);
            console.log(`   Expected: ${test.expectedFlow}`);
            console.log(`   Got: ${actualFlow}`);
            console.log(`   Reason: ${test.reason}`);
        }
        else {
            failed++;
            console.log(`\n[FAIL] "${test.utterance}"`);
            console.log(`   Expected: ${test.expectedFlow}`);
            console.log(`   Got: ${actualFlow}`);
            console.log(`   Reason: ${test.reason}`);
            if (isAmbiguous) {
                console.log(`   Candidates: ${result.candidates.map((c) => c.flowId).join(', ')}`);
            }
        }
    }
    console.log(`\n${'='.repeat(80)}`);
    console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
    console.log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);
    return failed === 0;
}
// Run if executed directly
if (require.main === module) {
    const success = runTests();
    process.exit(success ? 0 : 1);
}
//# sourceMappingURL=intent-detector.test.js.map