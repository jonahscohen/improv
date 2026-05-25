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
const build_report_aggregator_1 = require("../build-report-aggregator");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint4-memory-'));
    const fixturePath = path.join(tmp, 'session_2026-05-24_synthetic_run.md');
    const memoryEntry = {
        flowId: 'flowF_design_tokens',
        flowName: 'Design System Tokens',
        timestamp: new Date().toISOString(),
        status: 'success',
        rulesAppliedByDomain: {},
        decisions: [],
        userDecisions: [],
        metrics: [
            { name: 'color.contrast-pass-rate', value: 100, status: 'pass' },
            { name: 'typography.scale-pass-rate', value: 80, status: 'warning' },
        ],
        validationResults: [{ check: 'DESIGN.md_lint', result: 'fail', details: 'lint failed' }],
        referencesUsed: [],
        gates: [],
        artifactProduced: [],
        summary: 'tokens validated',
    };
    const fileContent = `---
name: session-2026-05-24-synthetic-run
description: Fixture for sprint4 memory-mode test.
type: project
---

## Flow execution

\`\`\`json
${JSON.stringify(memoryEntry, null, 2)}
\`\`\`
`;
    fs.writeFileSync(fixturePath, fileContent, 'utf8');
    const report = (0, build_report_aggregator_1.generateBuildReport)({
        source: 'memory',
        memoryPaths: [fixturePath],
    });
    assertTrue(report.verdict === 'blocked', `memory-mode: verdict computed (got: ${report.verdict})`);
    assertTrue(report.severityCounts.blocking === 1, 'memory-mode: blocking count correct');
    assertTrue(report.severityCounts.warning === 1, 'memory-mode: warning count correct');
    const colorDomain = report.domainGrades.find((d) => d.domain === 'color');
    const typoDomain = report.domainGrades.find((d) => d.domain === 'typography');
    assertTrue(colorDomain != null, 'memory-mode: color domain extracted');
    assertTrue(typoDomain != null, 'memory-mode: typography domain extracted');
    assertTrue(colorDomain.letter === 'A', 'memory-mode: color grade A');
    fs.unlinkSync(fixturePath);
    fs.rmdirSync(tmp);
    console.log('sprint4-build-report-memory-input PASS');
})();
//# sourceMappingURL=sprint4-build-report-memory-input.test.js.map