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
    // Utterance is chosen to uniquely match flowF_design_tokens.
    // 'lint design.md' is only in flow F's patterns; 'lint' and 'design.md' are
    // intent markers exclusive to flow F. Other tokens-related flows (flowN
    // rapid_iteration_refined, flow11 extract_tokens) do not match these phrases.
    // Generic phrases like 'validate tokens against DESIGN.md' produce ambiguous
    // 3-way matches and cause the orchestrator to short-circuit.
    const result = await engine.process('lint design.md', {
        projectPath: refRoot,
        projectContext: { register: 'brand' },
    });
    if (!result.success) {
        console.error('process() returned non-success:', JSON.stringify(result, null, 2));
        process.exit(1);
    }
    // The aggregate result has guidance from at least one flow.
    const allGuidance = (result.flowResults || []).flatMap((fr) => fr.guidance || []).join('\n');
    assertTrue(allGuidance.length > 0, 'process() returned non-empty guidance');
    // The DESIGN.md citation pattern must reach the public path output.
    // This is the T5 gap: if a future change drops enrichContextForHandler from
    // inside engine.process(), this assertion catches it.
    const citationRegex = /Source: DESIGN\.md L\d+/;
    assertTrue(citationRegex.test(allGuidance), 'guidance contains "Source: DESIGN.md L<n>" via process() path');
    const citations = allGuidance.split('\n').filter((l) => citationRegex.test(l));
    console.log(`process()-path citations found: ${citations.length}`);
    citations.slice(0, 3).forEach((c) => console.log(`  ${c.trim()}`));
    assertTrue(citations.length >= 1, 'at least 1 citation surfaces through process()');
    console.log('sprint3-process-path PASS');
})();
//# sourceMappingURL=sprint3-process-path.test.js.map