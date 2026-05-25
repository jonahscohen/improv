"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const intent_detector_1 = require("../intent-detector");
const detector = (0, intent_detector_1.createDetector)();
const result = detector.detect('audit');
// Before tie-break: returns isAmbiguous + candidates with equal confidence.
// After tie-break: returns a single resolved flow OR an isAmbiguous result whose
// tieBreak field explains the chosen recommendation.
if (result.isAmbiguous && Array.isArray(result.candidates) && result.candidates.length > 1) {
    if (!result.tieBreak) {
        console.error('FAIL: ambiguous result missing tieBreak explanation field');
        process.exit(1);
    }
    if (!result.tieBreak.chosenFlowId) {
        console.error('FAIL: tieBreak missing chosenFlowId');
        process.exit(1);
    }
    if (typeof result.tieBreak.reason !== 'string') {
        console.error('FAIL: tieBreak missing reason');
        process.exit(1);
    }
}
else if (result.flowId) {
    // Single non-ambiguous result is also valid
}
else {
    console.error('FAIL: unexpected result shape: ' + JSON.stringify(result));
    process.exit(1);
}
console.log('intent-detector tiebreak test PASS');
//# sourceMappingURL=intent-detector-tiebreak.test.js.map