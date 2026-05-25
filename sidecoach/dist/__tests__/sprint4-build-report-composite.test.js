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
    const result = await engine.process('/sidecoach composite composite_craft_landing_page', {
        projectPath: refRoot,
        projectContext: { register: 'brand' },
    });
    assertTrue((result.flowResults || []).length > 0, 'composite produced flowResults');
    const r = result;
    assertTrue(r.buildReport != null, `result.buildReport present (got: ${typeof r.buildReport})`);
    const br = r.buildReport;
    assertTrue(typeof br.verdict === 'string', 'buildReport.verdict is a string');
    assertTrue(Array.isArray(br.flowsExecuted) && br.flowsExecuted.length > 0, 'buildReport.flowsExecuted populated');
    assertTrue(br.composite === 'composite_craft_landing_page', 'buildReport.composite matches preset id');
    assertTrue(typeof br.severityCounts === 'object', 'buildReport.severityCounts present');
    assertTrue(typeof br.overallGrade === 'string', 'buildReport.overallGrade is a string');
    const artifacts = r.artifacts || [];
    const buildReportArtifact = artifacts.find((a) => a.type === 'reference' && a.name === 'Build Report');
    assertTrue(buildReportArtifact != null, `Build Report artifact present (artifacts: ${artifacts.map((a) => a.name).join(', ')})`);
    assertTrue(typeof buildReportArtifact.content === 'string' && buildReportArtifact.content.length > 0, 'Build Report artifact has non-empty content');
    assertTrue(/Verdict:/i.test(buildReportArtifact.content), 'Build Report content contains a Verdict section');
    console.log('sprint4-build-report-composite PASS');
})();
//# sourceMappingURL=sprint4-build-report-composite.test.js.map