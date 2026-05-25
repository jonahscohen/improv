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
(async () => {
    const refRoot = path.resolve(__dirname, '../../../reference');
    process.env.SIDECOACH_PROJECT_PATH = refRoot;
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    const projectPath = path.resolve(__dirname, '../../');
    // Real-world fixture: a tokens-related utterance that could plausibly match
    // multiple flows. The orchestrator should NOT silently resolve the tie
    // because the synthetic tieBreak reason is an alphabetical fallback, not a
    // recommendation-field tiebreaker.
    const utterance = 'validate tokens against DESIGN.md';
    const candidateF = {
        flowId: 'flowF_design_tokens',
        flowName: 'Design System Tokens (DESIGN.md)',
        confidence: 0.7,
        matchedTokens: ['tokens', 'design.md'],
        reason: 'Rule-based match (confidence: 70%)',
    };
    const candidateJ = {
        flowId: 'flowJ_tactical_polish',
        flowName: 'Tactical Polish',
        confidence: 0.7,
        matchedTokens: ['polish'],
        reason: 'Rule-based match (confidence: 70%)',
    };
    const synthetic = {
        candidates: [candidateF, candidateJ],
        isAmbiguous: true,
        clarificationNeeded: 'User must choose between candidate flows',
        tieBreak: {
            chosenFlowId: 'flowF_design_tokens',
            // Alphabetical fallback - NOT a recommendation-field tiebreak. This
            // forces the orchestrator to take the user-prompt branch.
            reason: 'Alphabetical fallback among 2 equal-confidence matches',
        },
    };
    const originalDetect = engine.intentDetector.detect.bind(engine.intentDetector);
    engine.intentDetector.detect = (u) => {
        if (u === utterance) {
            return synthetic;
        }
        return originalDetect(u);
    };
    const result = await engine.process(utterance, {
        projectPath,
        projectContext: { register: 'brand' },
    });
    // Restore the patched detector so other tests are unaffected.
    engine.intentDetector.detect = originalDetect;
    const checks = [
        ['needsDisambiguation is true', result.needsDisambiguation === true],
        ['success is false', result.success === false],
        ['detectedFlow is null', result.detectedFlow === null],
        ['flowResults is empty', Array.isArray(result.flowResults) && result.flowResults.length === 0],
        ['ambiguousCandidates has 2 entries', Array.isArray(result.ambiguousCandidates) && result.ambiguousCandidates.length === 2],
        ['ambiguousCandidates contains flowF_design_tokens', Array.isArray(result.ambiguousCandidates) && result.ambiguousCandidates.some((c) => c.flowId === 'flowF_design_tokens')],
        ['ambiguousCandidates contains flowJ_tactical_polish', Array.isArray(result.ambiguousCandidates) && result.ambiguousCandidates.some((c) => c.flowId === 'flowJ_tactical_polish')],
        ['disambiguationPrompt mentions the utterance', typeof result.disambiguationPrompt === 'string' && result.disambiguationPrompt.includes(utterance)],
        ['disambiguationPrompt mentions multiple flows', typeof result.disambiguationPrompt === 'string' && /multiple flows/i.test(result.disambiguationPrompt)],
    ];
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint5-disambiguation-prompt-path PASS' : 'sprint5-disambiguation-prompt-path FAIL');
    process.exit(allPass ? 0 : 1);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=sprint5-disambiguation-prompt-path.test.js.map