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
    const noFlag = await engine.process('lint design.md', {
        projectPath: refRoot,
        projectContext: { register: 'brand' },
    });
    const r1 = noFlag;
    assertTrue(r1.buildReport == null, `single flow w/o flag: no buildReport (got: ${typeof r1.buildReport})`);
    const withFlag = await engine.process('lint design.md', {
        projectPath: refRoot,
        projectContext: { register: 'brand' },
        metadata: { emitBuildReport: true },
    });
    const r2 = withFlag;
    assertTrue(r2.buildReport != null, `single flow with flag: buildReport attached (got: ${typeof r2.buildReport})`);
    assertTrue(typeof r2.buildReport.verdict === 'string', 'buildReport.verdict present');
    assertTrue(Array.isArray(r2.buildReport.flowsExecuted), 'buildReport.flowsExecuted present');
    assertTrue(r2.buildReport.composite == null, 'single-flow buildReport has no composite id');
    console.log('sprint4-build-report-single-opt-in PASS');
})();
//# sourceMappingURL=sprint4-build-report-single-opt-in.test.js.map