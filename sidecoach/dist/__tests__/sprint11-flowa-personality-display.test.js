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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const TEACH_V2 = `# PRODUCT.md

## Register

**Brand**

## Primary Users

test users

## Brand Personality

Professional, technical, restrained, plainspoken.

## Anti-References

- generic SaaS

## Strategic Principles

- concrete deliverables
`;
const TEACH_V2_NO_PERSONALITY = `# PRODUCT.md

## Register

**Brand**

## Primary Users

test users

## Anti-References

- generic

## Strategic Principles

- concrete
`;
function mkSandbox(content) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint11-personality-'));
    fs.writeFileSync(path.join(dir, 'PRODUCT.md'), content, 'utf-8');
    const designSource = '/Users/spare3/Documents/Github/improv/reference/DESIGN.md';
    if (fs.existsSync(designSource))
        fs.copyFileSync(designSource, path.join(dir, 'DESIGN.md'));
    return dir;
}
async function run() {
    const checks = [];
    // T1.1: Personality renders real text when section is populated
    {
        const sandbox = mkSandbox(TEACH_V2);
        const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
        const result = await engine.process('/sidecoach craft', { projectPath: sandbox, projectContext: { register: 'brand' } });
        const flowA = (result.flowResults || []).find((fr) => fr.flowId === 'flowA_brand_verify');
        const allGuidance = (flowA?.guidance || []).join('\n');
        checks.push(['T1.1: Personality renders real text', allGuidance.includes('Professional, technical, restrained')]);
        checks.push(['T1.1: Personality is NOT empty string', !/Personality:\s*\n/.test(allGuidance) && !/Personality:\s*$/m.test(allGuidance)]);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // T1.2: Personality renders "Not specified" when section is absent
    {
        const sandbox = mkSandbox(TEACH_V2_NO_PERSONALITY);
        const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
        const result = await engine.process('/sidecoach craft', { projectPath: sandbox, projectContext: { register: 'brand' } });
        const flowA = (result.flowResults || []).find((fr) => fr.flowId === 'flowA_brand_verify');
        const allGuidance = (flowA?.guidance || []).join('\n');
        checks.push(['T1.2: Personality renders "Not specified" when absent', allGuidance.includes('Personality: Not specified')]);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint11-flowa-personality-display PASS' : 'sprint11-flowa-personality-display FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint11-flowa-personality-display.test.js.map