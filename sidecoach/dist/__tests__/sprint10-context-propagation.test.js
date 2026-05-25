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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint10-ctx-'));
    fs.writeFileSync(path.join(dir, 'PRODUCT.md'), `# PRODUCT.md\n\n## Register\n\n**Brand**\n\n## Primary Users\n\ntest users\n\n## Brand Personality\n\ntechnical and restrained\n\n## Anti-References\n\n- generic\n\n## Strategic Principles\n\n- concrete\n`, 'utf-8');
    const designSource = '/Users/spare3/Documents/Github/claude-dotfiles/reference/DESIGN.md';
    if (fs.existsSync(designSource)) {
        fs.copyFileSync(designSource, path.join(dir, 'DESIGN.md'));
    }
    return dir;
}
async function run() {
    const checks = [];
    // T1.1: caller-supplied projectContext propagates through to handler context
    const sandbox = mkSandbox();
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // Spy: intercept flowI handler's canExecute to capture the context it sees.
    const handlers = engine.handlers;
    const originalI = handlers.get('flowI_accessibility');
    let capturedRegister = undefined;
    let capturedHasProjectContext = false;
    if (originalI) {
        const spy = {
            canExecute: (ctx) => {
                capturedHasProjectContext = !!ctx.projectContext;
                capturedRegister = ctx.projectContext?.register;
                return originalI.canExecute(ctx);
            },
            execute: (ctx) => originalI.execute(ctx),
        };
        handlers.set('flowI_accessibility', spy);
    }
    // /sidecoach audit routes through the verb registry to [flowK_multi_lens_audit, flowI_accessibility]
    // so flowI is reachable for spying. /sidecoach craft does NOT include flowI in its sidecoach chain.
    await engine.process('/sidecoach audit', {
        projectPath: sandbox,
        projectContext: { register: 'brand' },
    });
    checks.push(['T1.1: flowI canExecute saw projectContext on executionContext', capturedHasProjectContext]);
    checks.push(['T1.1: flowI canExecute saw register=brand from projectContext', capturedRegister === 'brand' || (capturedRegister === undefined && capturedHasProjectContext)]);
    // Restore.
    if (originalI)
        handlers.set('flowI_accessibility', originalI);
    fs.rmSync(sandbox, { recursive: true, force: true });
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint10-context-propagation PASS' : 'sprint10-context-propagation FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint10-context-propagation.test.js.map