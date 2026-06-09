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
function mkSandbox() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint10-skip-'));
    fs.writeFileSync(path.join(dir, 'PRODUCT.md'), `# PRODUCT.md\n\n## Register\n\n**Brand**\n\n## Primary Users\n\ntest users\n\n## Anti-References\n\n- generic\n\n## Strategic Principles\n\n- concrete\n`, 'utf-8');
    const designSource = '/Users/spare3/Documents/Github/improv/reference/DESIGN.md';
    if (fs.existsSync(designSource)) {
        fs.copyFileSync(designSource, path.join(dir, 'DESIGN.md'));
    }
    return dir;
}
async function run() {
    const checks = [];
    const sandbox = mkSandbox();
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // Monkey-patch flowG_component_implementation's canExecute to return false.
    const handlers = engine.handlers;
    const original = handlers.get('flowG_component_implementation');
    handlers.set('flowG_component_implementation', {
        canExecute: () => false,
        execute: async () => { throw new Error('should not be called - canExecute returned false'); },
    });
    const result = await engine.process('/sidecoach craft', {
        projectPath: sandbox,
        projectContext: { register: 'brand' },
    });
    if (original)
        handlers.set('flowG_component_implementation', original);
    // T2.1: flowG appears in flowResults with status='skipped'
    const flowResults = result.flowResults || [];
    const skipped = flowResults.find((fr) => fr.flowId === 'flowG_component_implementation');
    checks.push(['T2.1: flowG present in flowResults', !!skipped]);
    if (skipped) {
        checks.push(['T2.1: flowG has status=skipped', skipped.status === 'skipped']);
        checks.push(['T2.1: flowG has actionable message', typeof skipped.message === 'string' && skipped.message.length > 0]);
    }
    else {
        checks.push(['T2.1: flowG has status=skipped', false]);
        checks.push(['T2.1: flowG has actionable message', false]);
    }
    fs.rmSync(sandbox, { recursive: true, force: true });
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint10-canexecute-records-skip PASS' : 'sprint10-canexecute-records-skip FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint10-canexecute-records-skip.test.js.map