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
const design_md_parser_1 = require("../design-md-parser");
const project_context_1 = require("../project-context");
const context_loader_1 = require("../context-loader");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FIXTURE_PATH = path.resolve(__dirname, '../../../reference/DESIGN.md');
function assertEqual(actual, expected, label) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        process.exit(1);
    }
}
const src = fs.readFileSync(FIXTURE_PATH, 'utf8');
const parsed = (0, design_md_parser_1.parseDesignMd)(src);
assertEqual(parsed.colors.brand.red, '#DC2618', 'brand red');
assertEqual(parsed.colors.brand.ink, '#1A1F1B', 'brand ink');
assertEqual(parsed.typography.display.family.includes('Source Serif 4'), true, 'display family');
assertEqual(parsed.rounded.sm, '4px', 'radius sm');
assertEqual(parsed.motion.ease.out, 'cubic-bezier(0.2, 0, 0, 1)', 'easing out');
assertEqual(typeof parsed.bodyLineNumbers.bodyStart === 'number', true, 'body line numbers');
console.log('design-md-parser test PASS');
// Regression: bodyLineNumbers
const synth = `---\ncolors:\n  red: "#FF0000"\n---\n\nLine 6`;
const parsedSynth = (0, design_md_parser_1.parseDesignMd)(synth);
assertEqual(parsedSynth.bodyLineNumbers.frontmatterStart, 1, 'frontmatterStart for synth');
assertEqual(parsedSynth.bodyLineNumbers.frontmatterEnd, 4, 'frontmatterEnd for synth');
assertEqual(parsedSynth.bodyLineNumbers.bodyStart, 5, 'bodyStart for synth');
// Regression: findTokenLine path traversal (no leaf collision)
const collisionYaml = [
    '---',
    'colors:',
    '  brand:',
    '    red: "#FF0000"',
    '  text:',
    '    red: "#00FF00"',
    '---',
].join('\n');
assertEqual((0, design_md_parser_1.findTokenLine)(collisionYaml, 'colors.brand.red'), 4, 'finds nested brand.red');
assertEqual((0, design_md_parser_1.findTokenLine)(collisionYaml, 'colors.text.red'), 6, 'finds nested text.red, not brand.red');
console.log('design-md-parser regression test PASS');
const dotfilesRoot = path.resolve(__dirname, '../../..');
const stack = (0, project_context_1.detectTechStack)(dotfilesRoot);
assertEqual(typeof stack.framework, 'string', 'framework string');
assertEqual('hasAnimationLib' in stack, true, 'hasAnimationLib field');
console.log('detectTechStack test PASS');
const refRoot = path.resolve(__dirname, '../../../reference');
const ctx = (0, context_loader_1.buildProjectContext)(refRoot);
assertEqual(ctx.designContent && ctx.designContent.length > 0, true, 'designContent loaded');
assertEqual(ctx.parsedDesignTokens?.colors?.brand?.red, '#DC2618', 'parsed token surfaced via context-loader');
assertEqual(typeof ctx.techStack?.framework, 'string', 'techStack on context');
console.log('context-loader integration test PASS');
//# sourceMappingURL=design-md-parser.test.js.map