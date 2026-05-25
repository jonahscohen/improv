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
const project_drift_detector_1 = require("../project-drift-detector");
const design_md_parser_1 = require("../design-md-parser");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: condition was falsy: ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(async () => {
    const refRoot = path.resolve(__dirname, '../../../reference');
    process.env.SIDECOACH_PROJECT_PATH = refRoot;
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    const ctx = {
        utterance: 'craft a button',
        metadata: { componentName: 'button' },
        projectContext: { register: 'brand' },
        projectPath: refRoot,
    };
    const enriched = engine.enrichContextForHandler(ctx, 'flowG_component_implementation');
    assertTrue(enriched.metadata.designTokens, 'designTokens injected from DESIGN.md');
    assertTrue(enriched.metadata.designTokens.colors?.brand?.red === '#DC2618', 'specific token value');
    assertTrue(enriched.metadata.techStack, 'techStack injected');
    assertTrue(enriched.projectContext.product, 'PRODUCT.md content surfaced');
    console.log('sprint1 orchestrator injection test PASS');
    // Drift detector e2e coverage against the real landing page CSS
    const designMd = fs.readFileSync(path.resolve(__dirname, '../../../reference/DESIGN.md'), 'utf8');
    const tokens = (0, design_md_parser_1.parseDesignMd)(designMd);
    const landingCss = fs.readFileSync(path.resolve(__dirname, '../../../test-site-1/landing.css'), 'utf8');
    const drift = (0, project_drift_detector_1.detectTokenDrift)(landingCss, tokens);
    console.log('drift summary:', drift.summary);
    console.log('  new color tokens:', drift.newColorTokens.length);
    console.log('  new radius tokens:', drift.newRadiusTokens.length);
    console.log('  new spacing tokens:', drift.newSpacingTokens.length);
    console.log('  new easing tokens:', drift.newEasingTokens.length);
    console.log('  new duration tokens:', drift.newDurationTokens.length);
    assertTrue(drift.newColorTokens.includes('--c-brand-red-hover'), 'detects --c-brand-red-hover drift');
    // --ease-out has the same value as DESIGN.md ease.out, so the value-based detector correctly does not flag it.
    // Instead verify a spacing drift that landing.css introduces (--s-10, --s-14, --s-24, --s-32 are not in DESIGN.md).
    assertTrue(drift.newSpacingTokens.length > 0, 'detects spacing drift tokens');
    assertTrue(drift.newSpacingTokens.includes('--s-10'), 'detects --s-10 spacing drift');
    console.log('sprint1 e2e drift test PASS');
})();
//# sourceMappingURL=sprint1-integration.test.js.map