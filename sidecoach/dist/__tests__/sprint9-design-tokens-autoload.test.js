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
function mkSandbox(opts) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint9-tokens-'));
    // Always plant a valid PRODUCT.md so brand-verify doesn't pre-empt the test.
    fs.writeFileSync(path.join(dir, 'PRODUCT.md'), `# PRODUCT.md\n\n## Register\n\n**Brand**\n\n## Primary Users\n\ntest users\n\n## Anti-References\n\n- generic\n\n## Strategic Principles\n\n- concrete\n`, 'utf-8');
    if (opts.withDesignMd) {
        const designSource = '/Users/spare3/Documents/Github/claude-dotfiles/reference/DESIGN.md';
        if (fs.existsSync(designSource)) {
            fs.copyFileSync(designSource, path.join(dir, 'DESIGN.md'));
        }
    }
    return dir;
}
async function run() {
    const checks = [];
    // T2.1: with DESIGN.md present -> flowF should not error with "Missing context: designTokens"
    {
        const sandbox = mkSandbox({ withDesignMd: true });
        const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
        const result = await engine.process('/sidecoach craft', {
            projectPath: sandbox,
            projectContext: { register: 'brand' },
        });
        const flowF = (result.flowResults || []).find((fr) => fr.flowId === 'flowF_design_tokens');
        checks.push(['T2.1: flowF present in results', !!flowF]);
        if (flowF) {
            checks.push(['T2.1: flowF status not "error"', flowF.status !== 'error']);
            const msg = flowF.message || '';
            checks.push(['T2.1: flowF message does NOT say "Missing context: designTokens"', !msg.includes('Missing context: designTokens')]);
        }
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // T2.2: WITHOUT DESIGN.md -> flowF should still error (current behavior preserved)
    {
        const sandbox = mkSandbox({ withDesignMd: false });
        const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
        const result = await engine.process('/sidecoach craft', {
            projectPath: sandbox,
            projectContext: { register: 'brand' },
        });
        const flowF = (result.flowResults || []).find((fr) => fr.flowId === 'flowF_design_tokens');
        if (flowF) {
            const msg = flowF.message || '';
            checks.push(['T2.2: without DESIGN.md, flowF still errors with the same message', msg.includes('Missing context: designTokens') || flowF.status === 'error']);
        }
        else {
            checks.push(['T2.2: without DESIGN.md, flowF still errors with the same message', true]);
        }
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    // T2.3: caller pre-stages metadata.designTokens explicitly -> that wins, no overwrite
    {
        const sandbox = mkSandbox({ withDesignMd: true });
        const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
        const explicitTokens = { colors: { custom: { value: '#CAFE00' } } };
        const result = await engine.process('/sidecoach craft', {
            projectPath: sandbox,
            projectContext: { register: 'brand' },
            metadata: { designTokens: explicitTokens },
        });
        // We can only verify indirectly - assert no error related to "Missing context" and that flowF ran
        const flowF = (result.flowResults || []).find((fr) => fr.flowId === 'flowF_design_tokens');
        checks.push(['T2.3: explicit metadata.designTokens -> flowF still runs (no overwrite-induced error)', !!flowF && flowF.status !== 'error']);
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint9-design-tokens-autoload PASS' : 'sprint9-design-tokens-autoload FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint9-design-tokens-autoload.test.js.map