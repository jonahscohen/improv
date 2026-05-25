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
async function run() {
    const checks = [];
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-parser-'));
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // T1: colon form
    const r1 = await engine.process('/sidecoach composite:composite_qa_workflow', {
        projectPath: sandbox,
        projectContext: { register: 'brand' },
    });
    const r1Message = r1.message || '';
    console.log('T1 response:', r1Message.substring(0, 100));
    checks.push(['T1: colon form does NOT return the help-text', !r1Message.includes('Please specify composite flow ID')]);
    // T2: space form
    const sandbox2 = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-parser-'));
    const r2 = await engine.process('/sidecoach composite composite_qa_workflow', {
        projectPath: sandbox2,
        projectContext: { register: 'brand' },
    });
    const r2Message = r2.message || '';
    console.log('T2 response:', r2Message.substring(0, 100));
    checks.push(['T2: space form does NOT return the help-text', !r2Message.includes('Please specify composite flow ID')]);
    // T3: no-target -> help text
    const sandbox3 = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-parser-'));
    const r3 = await engine.process('/sidecoach composite', {
        projectPath: sandbox3,
        projectContext: { register: 'brand' },
    });
    const r3Message = r3.message || '';
    console.log('T3 response:', r3Message.substring(0, 100));
    checks.push(['T3: no-target form returns help-text', r3Message.includes('Please specify composite flow ID')]);
    // T4: unknown command falls through (does not match composite branch)
    const sandbox4 = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-parser-'));
    const r4 = await engine.process('/sidecoach zzzz_nonexistent_command', {
        projectPath: sandbox4,
        projectContext: { register: 'brand' },
    });
    const r4Message = r4.message || '';
    console.log('T4 response:', r4Message.substring(0, 100));
    checks.push(['T4: unknown command does NOT return composite help-text', !r4Message.includes('Please specify composite flow ID')]);
    fs.rmSync(sandbox, { recursive: true, force: true });
    fs.rmSync(sandbox2, { recursive: true, force: true });
    fs.rmSync(sandbox3, { recursive: true, force: true });
    fs.rmSync(sandbox4, { recursive: true, force: true });
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint7-composite-parser-both-forms PASS' : 'sprint7-composite-parser-both-forms FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint7-composite-parser-both-forms.test.js.map