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
async function run() {
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    const projectPath = path.resolve(__dirname, '../../');
    const utterance = 'validate tokens against DESIGN.md';
    // ROUND 1: synthetic ambiguity that should hit the prompt branch.
    const synthetic = {
        isAmbiguous: true,
        candidates: [
            { flowId: 'flowF_design_tokens', confidence: 0.7, matchedTriggers: ['tokens', 'DESIGN.md'], isAmbiguous: true },
            { flowId: 'flowJ_tactical_polish', confidence: 0.7, matchedTriggers: ['polish'], isAmbiguous: true },
        ],
        tieBreak: {
            chosenFlowId: 'flowF_design_tokens',
            reason: 'Alphabetical fallback among 2 equal-confidence matches',
        },
        clarificationNeeded: 'User must choose between candidate flows',
    };
    const originalDetect = engine.intentDetector.detect.bind(engine.intentDetector);
    let detectCallCount = 0;
    engine.intentDetector.detect = (..._args) => {
        detectCallCount++;
        return synthetic;
    };
    // Round 1: caller sends utterance, gets prompt back.
    const round1 = await engine.process(utterance, {
        projectPath,
        projectContext: { register: 'brand' },
    });
    const round1Checks = [
        ['round1: needsDisambiguation true', round1.needsDisambiguation === true],
        ['round1: success false', round1.success === false],
        ['round1: ambiguousCandidates has 2 entries', Array.isArray(round1.ambiguousCandidates) && round1.ambiguousCandidates.length === 2],
        ['round1: disambiguationPrompt string set', typeof round1.disambiguationPrompt === 'string' && round1.disambiguationPrompt.length > 0],
        ['round1: detect was invoked', detectCallCount === 1],
    ];
    // Simulate the caller picking the first candidate.
    const chosen = Array.isArray(round1.ambiguousCandidates) && round1.ambiguousCandidates[0]
        ? round1.ambiguousCandidates[0].flowId
        : undefined;
    // Round 2: caller re-invokes with metadata.forceFlowId.
    const detectCountBeforeRound2 = detectCallCount;
    const round2 = await engine.process(utterance, {
        projectPath,
        projectContext: { register: 'brand' },
        metadata: { forceFlowId: chosen },
    });
    // Restore spy.
    engine.intentDetector.detect = originalDetect;
    const round2Checks = [
        ['round2: chosen id was set', typeof chosen === 'string' && chosen.length > 0],
        ['round2: detect was NOT invoked again (bypass worked)', detectCallCount === detectCountBeforeRound2],
        ['round2: needsDisambiguation falsy', round2.needsDisambiguation !== true],
        ['round2: chosen flow appears in flowResults', Array.isArray(round2.flowResults) && round2.flowResults.some((r) => r.flowId === chosen)],
    ];
    const allChecks = [...round1Checks, ...round2Checks];
    let allPass = true;
    for (const [label, ok] of allChecks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint5-disambiguation-e2e-resolution PASS' : 'sprint5-disambiguation-e2e-resolution FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=sprint5-disambiguation-e2e-resolution.test.js.map