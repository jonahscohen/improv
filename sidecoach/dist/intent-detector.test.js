"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const intent_detector_1 = require("./intent-detector");
const detector = new intent_detector_1.IntentDetector();
// Test cases from implementation checklist
const testCases = [
    {
        utterance: 'Make the button feel better',
        expectedFlow: 'flow2_polish_enhance',
        reason: 'feel token + button context',
    },
    {
        utterance: 'The sidebar feels cluttered',
        expectedFlow: 'flow8_refactor_layout',
        reason: 'cluttered token + layout context',
    },
    {
        utterance: 'Refactor the button component',
        expectedFlow: 'flow8_refactor_layout',
        reason: 'refactor + no API keyword = layout refactor by default',
    },
    {
        utterance: 'Refactor button API',
        expectedFlow: 'flow14_migration',
        reason: 'refactor + API keyword = component migration',
    },
    {
        utterance: 'Build a date picker',
        expectedFlow: 'flow7_design_component',
        reason: 'new component context (no reference)',
    },
    {
        utterance: 'Build the date picker from the mockup',
        expectedFlow: 'flow10_implement_design',
        reason: 'build + from source context',
    },
    {
        utterance: 'What if we tried blue?',
        expectedFlow: 'flow4_explore_discovery',
        reason: 'what if token + no criteria',
    },
    {
        utterance: 'Let\'s iterate round 2',
        expectedFlow: 'flow13_rapid_iteration',
        reason: 'iterate + round token',
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