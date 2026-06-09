"use strict";
/**
 * Sprint 8 T6: Parameterized parity test across all 22 verbs.
 *
 * For every entry in VERB_REGISTRY:
 *   - invoke FlowExecutionEngine.process('/sidecoach <verb>') inside a sandbox
 *     project that has a real PRODUCT.md (so brand-verify does not gate-fail)
 *   - flatten the orchestrator's response (message + flowResults' guidance,
 *     checklist labels, artifact content, nextSteps + top-level guidance)
 *   - assert every parityChecklist substring appears in the flattened output
 *   - assert every parityPlus substring appears in the flattened output
 *
 * This test is expected to have MANY FAILs before T7 lands; T7 wires the
 * orchestrator to append the registry's guidanceAppend + parityPlus to the
 * result after the flow chain runs. The failure list this test prints is
 * the concrete target list T7 must satisfy.
 *
 * Do NOT weaken assertions to make this pass. Do NOT edit the registry to
 * match current orchestrator output. The assertions are the acceptance
 * criteria; T7 closes the gap.
 */
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
const verb_command_registry_1 = require("../verb-command-registry");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function setupSandbox() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-parity-'));
    // Plant a real PRODUCT.md so brand-verify does not gate-fail. Content must
    // exceed 200 chars and avoid [TODO] markers so context-loader treats it as
    // a real product brief.
    fs.writeFileSync(path.join(dir, 'PRODUCT.md'), `# PRODUCT.md

## Register

**Brand**

## Primary Users

developers using the test sandbox

## Brand Personality

professional, technical, restrained

## Anti-References

- generic SaaS marketing
- screenshot-heavy product tours
- corporate boilerplate

## Strategic Principles

- every page gives something concrete
- real screenshots not mockups
`, 'utf-8');
    // Copy the dotfiles' own DESIGN.md if present so design-token-aware flows
    // have a real surface to read.
    const designSource = '/Users/spare3/Documents/Github/improv/reference/DESIGN.md';
    if (fs.existsSync(designSource)) {
        fs.copyFileSync(designSource, path.join(dir, 'DESIGN.md'));
    }
    return dir;
}
function flattenOutput(result) {
    if (!result)
        return '';
    const parts = [];
    if (result.message)
        parts.push(String(result.message));
    if (Array.isArray(result.guidance)) {
        for (const g of result.guidance)
            parts.push(String(g));
    }
    if (Array.isArray(result.flowResults)) {
        for (const fr of result.flowResults) {
            if (!fr)
                continue;
            if (fr.message)
                parts.push(String(fr.message));
            if (Array.isArray(fr.guidance)) {
                for (const g of fr.guidance)
                    parts.push(String(g));
            }
            if (Array.isArray(fr.nextSteps)) {
                for (const ns of fr.nextSteps)
                    parts.push(String(ns));
            }
            if (Array.isArray(fr.checklist)) {
                for (const c of fr.checklist) {
                    if (typeof c === 'string')
                        parts.push(c);
                    else if (c && typeof c === 'object') {
                        if (c.label)
                            parts.push(String(c.label));
                        if (c.description)
                            parts.push(String(c.description));
                    }
                }
            }
            if (Array.isArray(fr.artifacts)) {
                for (const a of fr.artifacts) {
                    if (!a)
                        continue;
                    if (a.name)
                        parts.push(String(a.name));
                    if (a.content)
                        parts.push(String(a.content));
                    if (a.description)
                        parts.push(String(a.description));
                }
            }
        }
    }
    return parts.join('\n');
}
async function run() {
    const checks = [];
    const perVerbFailCount = {};
    const perVerbPassCount = {};
    for (const [verb, entry] of Object.entries(verb_command_registry_1.VERB_REGISTRY)) {
        perVerbFailCount[verb] = 0;
        perVerbPassCount[verb] = 0;
        const sandbox = setupSandbox();
        const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
        let result;
        let threw = false;
        try {
            result = await engine.process(`/sidecoach ${verb}`, {
                projectPath: sandbox,
                metadata: { register: 'brand' },
            });
        }
        catch (e) {
            threw = true;
            checks.push([`${verb}: process() threw - ${e.message}`, false]);
            perVerbFailCount[verb]++;
        }
        if (!threw) {
            const returned = result !== undefined && result !== null;
            checks.push([`${verb}: result returned`, returned]);
            if (returned)
                perVerbPassCount[verb]++;
            else
                perVerbFailCount[verb]++;
            const allOutput = flattenOutput(result);
            for (const required of entry.parityChecklist) {
                const ok = allOutput.includes(required);
                const label = `${verb}: parity '${required.slice(0, 40)}'`;
                checks.push([label, ok]);
                if (ok)
                    perVerbPassCount[verb]++;
                else
                    perVerbFailCount[verb]++;
            }
            for (const plus of entry.parityPlus) {
                const ok = allOutput.includes(plus);
                const label = `${verb}: plus '${plus.slice(0, 40)}'`;
                checks.push([label, ok]);
                if (ok)
                    perVerbPassCount[verb]++;
                else
                    perVerbFailCount[verb]++;
            }
        }
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
    let allPass = true;
    const failures = [];
    for (const [label, ok] of checks) {
        if (ok)
            console.log(`PASS ${label}`);
        else {
            console.log(`FAIL ${label}`);
            allPass = false;
            failures.push(label);
        }
    }
    console.log(`\n--- Per-verb breakdown ---`);
    const verbs = Object.keys(verb_command_registry_1.VERB_REGISTRY);
    for (const verb of verbs) {
        const pass = perVerbPassCount[verb] || 0;
        const fail = perVerbFailCount[verb] || 0;
        console.log(`  ${verb}: ${pass} pass / ${fail} fail`);
    }
    console.log(`\n--- Summary ---`);
    console.log(`Total: ${checks.length}`);
    console.log(`Passed: ${checks.length - failures.length}`);
    console.log(`Failed: ${failures.length}`);
    console.log(allPass ? 'sprint8-verb-parity PASS' : 'sprint8-verb-parity FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=sprint8-verb-parity.test.js.map