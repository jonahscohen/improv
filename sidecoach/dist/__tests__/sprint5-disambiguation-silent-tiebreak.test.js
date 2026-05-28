"use strict";
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
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
const path = __importStar(require("path"));
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(async () => {
    const refRoot = path.resolve(__dirname, '../../../reference');
    process.env.SIDECOACH_PROJECT_PATH = refRoot;
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // Construct a synthetic DisambiguationResult where the tiebreak was set via
    // the recommendation field. We patch the engine's intent detector so its
    // detect() returns our pre-built result. This isolates the orchestrator's
    // tiered-resolution behavior from the trigger registry state.
    const recommendedFlow = {
        flowId: 'flowF_design_tokens',
        flowName: 'Design System Tokens (DESIGN.md)',
        confidence: 0.85,
        matchedTokens: ['design.md'],
        reason: 'Rule-based match (confidence: 85%)',
    };
    // T-0015 (2026-05-28): flow11_extract_tokens was culled into flowF; the
    // disambiguation test now reuses flowS as a synthetic "other candidate".
    const otherCandidate = {
        flowId: 'flowS_typography_excellence',
        flowName: 'Typography Excellence',
        confidence: 0.85,
        matchedTokens: ['typography'],
        reason: 'Rule-based match (confidence: 85%)',
    };
    const syntheticDisambig = {
        candidates: [recommendedFlow, otherCandidate],
        isAmbiguous: true,
        recommendation: recommendedFlow,
        clarificationNeeded: undefined,
        tieBreak: {
            chosenFlowId: 'flowF_design_tokens',
            reason: 'Used recommendation field as tiebreaker among 2 equal-confidence matches',
        },
    };
    // Patch the orchestrator's intent detector. The engine exposes its
    // intent-detector at `engine.intentDetector` (the property is public-ish
    // for testing purposes - access via `as any` if TypeScript narrows).
    const originalDetect = engine.intentDetector.detect.bind(engine.intentDetector);
    engine.intentDetector.detect = (utterance) => {
        if (utterance === '__test_silent_tiebreak') {
            return syntheticDisambig;
        }
        return originalDetect(utterance);
    };
    const result = await engine.process('__test_silent_tiebreak', {
        projectPath: refRoot,
        projectContext: { register: 'brand' },
    });
    // Silent tiebreak: flowF should have been reached. We don't assert
    // success=true (downstream validators may still skip flowF), but we
    // assert the flow appears in flowResults (proves canExecute was reached
    // for the recommended flow, not short-circuited at the ambiguous check).
    const fResult = (result.flowResults || []).find((fr) => fr.flowId === 'flowF_design_tokens');
    assertTrue(fResult != null, `flowF appears in flowResults via silent tiebreak (got: ${(result.flowResults || []).map((fr) => fr.flowId).join(', ')})`);
    // needsDisambiguation must NOT be set (silent path means no user prompt).
    const r = result;
    assertTrue(r.needsDisambiguation !== true, `needsDisambiguation is not true (got: ${r.needsDisambiguation})`);
    // Restore the patched detector so other tests are unaffected.
    engine.intentDetector.detect = originalDetect;
    console.log('sprint5-disambiguation-silent-tiebreak PASS');
})();
//# sourceMappingURL=sprint5-disambiguation-silent-tiebreak.test.js.map