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
    // Spy on intentDetector.detect to confirm it is NOT called when forceFlowId is set.
    let detectCalled = false;
    const originalDetect = engine.intentDetector.detect.bind(engine.intentDetector);
    engine.intentDetector.detect = (...args) => {
        detectCalled = true;
        return originalDetect(...args);
    };
    // Happy path: forceFlowId routes directly to flowF_design_tokens.
    const happy = await engine.process('any utterance, totally ignored', {
        projectPath,
        projectContext: { register: 'brand' },
        metadata: { forceFlowId: 'flowF_design_tokens' },
    });
    const happyHasFlowF = happy.flowResults && happy.flowResults.some((r) => r.flowId === 'flowF_design_tokens');
    const detectSkipped = detectCalled === false;
    console.log(detectSkipped ? 'PASS detect skipped' : 'FAIL detect was invoked');
    console.log(happyHasFlowF ? 'PASS flowF executed via force bypass' : `FAIL flowF not executed (got: ${(happy.flowResults || []).map((r) => r.flowId).join(', ')})`);
    // Reset spy for invalid path.
    detectCalled = false;
    // Invalid path: forceFlowId points to a non-existent id.
    const invalid = await engine.process('any utterance', {
        projectPath,
        projectContext: { register: 'brand' },
        metadata: { forceFlowId: 'flowZ_does_not_exist' },
    });
    const invalidNotSuccess = invalid.success === false;
    const invalidMessageMentionsId = typeof invalid.message === 'string' &&
        (invalid.message.includes('flowZ_does_not_exist') ||
            invalid.message.toLowerCase().includes('unknown') ||
            invalid.message.toLowerCase().includes('invalid') ||
            invalid.message.toLowerCase().includes('not found'));
    console.log(invalidNotSuccess ? 'PASS invalid forceFlowId returns success=false' : 'FAIL invalid forceFlowId returned success=true');
    console.log(invalidMessageMentionsId ? 'PASS invalid forceFlowId message identifies the bad id' : `FAIL invalid forceFlowId message missing: "${invalid.message}"`);
    // Restore spy.
    engine.intentDetector.detect = originalDetect;
    const allPass = detectSkipped && happyHasFlowF && invalidNotSuccess && invalidMessageMentionsId;
    console.log(allPass ? 'sprint5-force-flowid-bypass PASS' : 'sprint5-force-flowid-bypass FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=sprint5-force-flowid-bypass.test.js.map