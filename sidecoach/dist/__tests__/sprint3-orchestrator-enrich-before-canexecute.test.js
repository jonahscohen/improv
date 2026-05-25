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
    // Drive a flow that has a register-aware canExecute through the natural-language
    // path of engine.process(). FlowF's canExecute returns true ONLY when
    // projectContext.register is populated. We deliberately do NOT pass register
    // in the caller context - it must come from PRODUCT.md via
    // enrichContextForHandler. If enrichment runs BEFORE canExecute (the T11
    // carryover fix), register will be loaded from reference/PRODUCT.md and
    // flowF's canExecute will return true. Without the fix, canExecute would
    // see undefined register and the orchestrator would skip flowF with the
    // specific canExecute-skip message below.
    //
    // Utterance: 'lint design.md' is unique to flowF among the registered
    // detectors (flowW/flowX were added in Sprint 2 trigger registry but
    // never wired into intent-detector.ts - that's a separate Sprint 3 gap).
    const result = await engine.process('lint design.md', {
        projectPath: refRoot,
        // intentionally no projectContext.register
    });
    const fResult = (result.flowResults || []).find((fr) => fr.flowId === 'flowF_design_tokens');
    assertTrue(fResult != null, `flowF appears in flowResults (got: ${(result.flowResults || []).map((fr) => fr.flowId).join(', ')})`);
    // The canExecute-skip message comes from the orchestrator's natural-language
    // execution path (sidecoach-orchestrator.ts, the if-not-canExecute block).
    // It looks like: 'Flow cannot execute: prerequisites not met for <flowId>'.
    // If we see THAT specific message, the T11 fix isn't holding.
    // Any other status (success, error, or a different skip message from a
    // downstream validator) is acceptable - it proves canExecute saw enriched
    // context and returned true.
    const canExecuteSkipMessage = `Flow cannot execute: prerequisites not met for flowF_design_tokens`;
    assertTrue(fResult.message !== canExecuteSkipMessage, `flowF was NOT canExecute-skipped (got status=${fResult.status}, message=${JSON.stringify(fResult.message)}). The T11 fix should make canExecute see enriched register and return true.`);
    console.log(`sprint3-orchestrator-enrich-before-canexecute PASS (flowF reached its handler with status=${fResult.status})`);
})();
//# sourceMappingURL=sprint3-orchestrator-enrich-before-canexecute.test.js.map