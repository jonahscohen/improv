"use strict";
// Sprint 10 T3: PRODUCT.md parser writes camelCase keys matching consumer contract.
//
// Consumers (flowH and friends) read ctx.product.brandPersonality, antiReferences,
// strategicPrinciples (camelCase). The teach v2 post-pass introduced in Sprint 9 T1
// was writing brandpersonality, antireferences, strategicprinciples (lowercased).
// Mismatch caused canExecute to return false and flows to silently drop.
//
// This test pins the camelCase contract.
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
const project_context_1 = require("../project-context");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function mkSandbox() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint10-parser-camel-'));
}
const TEACH_V2_BRAND = `# PRODUCT.md

## Register

**Brand**

## Primary Users

Digital creative practitioners across roles - PMs, designers, engineers.

## Brand Personality

Professional, technical, restrained, plainspoken.

## Anti-References

What this should NOT look like:

- Generic SaaS marketing patterns
- Hero gradients with floating product mockups
- Screenshot carousels

## Strategic Principles

- Each tool gets equal billing
- Navigation reflects the toolkit structure
`;
async function run() {
    const checks = [];
    const sandbox = mkSandbox();
    fs.writeFileSync(path.join(sandbox, 'PRODUCT.md'), TEACH_V2_BRAND, 'utf-8');
    const loader = new project_context_1.ContextLoader();
    const ctx = loader.load(sandbox);
    // camelCase keys MUST be set
    checks.push([
        'T3.1: ctx.product.brandPersonality is set (camelCase)',
        typeof ctx.product.brandPersonality === 'string' && ctx.product.brandPersonality.length > 0,
    ]);
    checks.push([
        'T3.2: ctx.product.antiReferences is set (camelCase)',
        Array.isArray(ctx.product.antiReferences) && ctx.product.antiReferences.length > 0,
    ]);
    checks.push([
        'T3.3: ctx.product.strategicPrinciples is set (camelCase)',
        Array.isArray(ctx.product.strategicPrinciples) && ctx.product.strategicPrinciples.length > 0,
    ]);
    // lowercased keys MUST NOT be set
    checks.push([
        'T3.4: ctx.product.brandpersonality is NOT set (lowercased)',
        ctx.product.brandpersonality === undefined,
    ]);
    checks.push([
        'T3.5: ctx.product.antireferences is NOT set (lowercased)',
        ctx.product.antireferences === undefined,
    ]);
    checks.push([
        'T3.6: ctx.product.strategicprinciples is NOT set (lowercased)',
        ctx.product.strategicprinciples === undefined,
    ]);
    fs.rmSync(sandbox, { recursive: true, force: true });
    let allPass = true;
    for (const [label, ok] of checks) {
        console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
        if (!ok)
            allPass = false;
    }
    console.log(allPass ? 'sprint10-parser-camelcase-keys PASS' : 'sprint10-parser-camelcase-keys FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=sprint10-parser-camelcase-keys.test.js.map