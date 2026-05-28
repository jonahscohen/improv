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
exports.FlowQMigrationHandler = exports.FlowPConstraintDesignHandler = exports.FlowOCloneMatchHandler = exports.FlowNRapidIterationHandler = exports.FlowMResponsiveValidationHandler = exports.FlowLDesignCritiqueHandler = exports.FlowKMultiLensAuditHandler = exports.FlowJTacticalPolishHandler = void 0;
const flow_handler_1 = require("./flow-handler");
const persona_engine_1 = require("./persona-engine");
const anti_pattern_validator_1 = require("./anti-pattern-validator");
const category_reflex_detector_1 = require("./category-reflex-detector");
const design_laws_1 = require("./design-laws");
const flow_memory_schema_1 = require("./flow-memory-schema");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const model_routing_1 = require("./model-routing");
// TIER 3: POLISH/QA FLOWS
/**
 * Flow J: 16-Point Tactical Polish
 * Apply make-interfaces-feel-better rules for visual refinement
 */
const TACTICAL_RULES = {
    radius: 'Concentric border radius: outer = inner + padding (e.g. button 8px + 4px padding = 12px container)',
    optical: 'Optical alignment: visual center differs from geometric center for circles/icons',
    shadows: 'Shadows use rgba(0,0,0,0.1) or surface tint, never rgb/hsl (preserves theme)',
    scalePress: 'Scale on press: scale(0.96) for tactile feedback',
    transitions: 'Avoid transition: all; specify individual properties',
    hitAreas: 'Minimum 40x40px hit targets (mobile-friendly)',
    textWrap: 'text-wrap: balance on headings (prevents widows)',
    smoothing: 'font-smoothing: antialiased on light text, auto on dark',
    tabulars: 'font-variant-numeric: tabular-nums on dynamic numbers',
    imageOutlines: 'Image borders: rgba(0,0,0,0.1) or subtle tint, never colored',
    iconSwaps: 'Icon state changes via opacity+scale+blur (no visibility toggling)',
    willChange: 'Sparse will-change (max 2-3 per page, not on every hover)',
    nullTransitions: 'null/undefined transitions on AnimatePresence initial prop',
    splitStagger: 'Split animation stagger (entrance vs exit differ)',
    subtleExit: 'Exit animations 2-3x faster than entrance',
};
class FlowJTacticalPolishHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowJ_tactical_polish');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        try {
            const appliedRules = Object.entries(TACTICAL_RULES).map(([key, rule]) => ({
                category: key,
                rule,
            }));
            const checklist = this.createChecklist([
                { label: 'Scale on press: scale(0.96) for all interactive elements', required: true },
                { label: 'Concentric border radius (outer = inner + padding)', required: true },
                { label: 'Icon swaps via opacity+scale+blur, not visibility toggle', required: false },
                { label: 'Image outlines: rgba(0,0,0,0.1) or tint, never colored', required: false },
                { label: 'Shadows use rgba(0,0,0,0.1) or surface tint', required: true },
                { label: 'No transition: all; specify individual properties', required: true },
                { label: 'Hit areas minimum 40x40px', required: true },
                { label: 'text-wrap: balance on all headings', required: false },
                { label: 'font-smoothing: antialiased on light text', required: false },
                { label: 'font-variant-numeric: tabular-nums on dynamic numbers', required: false },
                { label: 'Sparse will-change (max 2-3 per page)', required: false },
                { label: 'Exit animations 2-3x faster than entrance', required: false },
                { label: 'Initial={false} on AnimatePresence children', required: false },
                { label: 'Stagger entrance and exit animations differently', required: false },
                { label: 'Optical alignment verified (icons, circles, text baselines)', required: false },
                { label: 'All interactive elements provide tactile feedback', required: false },
            ]);
            const guidance = [
                'Tactical Polish applies 16 refinement principles to make interfaces feel responsive and premium.',
                '',
                'SCALE & PRESS (Required):',
                '- Add scale(0.96) on active/press state to all buttons, links, interactive components',
                '- Gives tactile, pressable feeling without changing layout',
                '',
                'RADIUS & SPACING (Required):',
                '- Use concentric radius: outer container = inner element radius + padding',
                '- Example: button 8px + 4px padding = 12px container outer radius',
                '',
                'SHADOWS (Required):',
                '- All shadows use rgba(0,0,0,0.1) or surface tint, never rgb/hsl',
                '- Preserves theme colors in light/dark modes',
                '',
                'TRANSITIONS (Required):',
                '- Never use transition: all',
                '- Specify: transition: background-color 200ms, transform 300ms',
                '- Separate timing for different properties (transform faster than color)',
                '',
                'HIT AREAS (Required):',
                '- All interactive targets minimum 40x40px (mobile-friendly)',
                '- Padding around icons to reach 40px, not icon size itself',
                '',
                'TEXT & TYPOGRAPHY (Optional):',
                '- text-wrap: balance on headings (prevents widow lines)',
                '- font-smoothing: antialiased on light text over dark bg',
                '- font-variant-numeric: tabular-nums on any dynamic numbers',
                '',
                'ICONS & IMAGES (Optional):',
                '- Icon state changes via opacity+scale+blur (e.g., opacity 0→1, scale 0.25→1, blur 4px→0)',
                '- Image borders: rgba(0,0,0,0.1) or subtle tint overlay, never bright colors',
                '',
                'ANIMATION OPTIMIZATION (Optional):',
                '- will-change on max 2-3 elements per page (not on every :hover)',
                '- Exit animations 2-3x faster than entrance (feels snappier)',
                '- Initial={false} on AnimatePresence children to prevent layout shift',
                '- Stagger entrance and exit differently (not symmetric)',
                '',
                'OPTICAL ALIGNMENT (Optional):',
                '- Visual center differs from geometric center (especially circles, icons)',
                '- Adjust baseline alignment on text near icons',
            ];
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowJ', 'tactical-polish', '16-point-rules'];
                enhancedContext.flowMetadata.customData = {
                    'polish-principles': 16,
                    'required-items': 6,
                    'optional-items': 10,
                    'domains-covered': ['scale-press', 'radius', 'shadows', 'transitions', 'hit-areas', 'text', 'icons', 'animations'].length,
                };
            }
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary('16-point tactical polish checklist applied - scale, radius, shadows, transitions, hit areas, text, icons, animation')
                .addRule('polish', [TACTICAL_RULES.scalePress, TACTICAL_RULES.radius, TACTICAL_RULES.shadows, TACTICAL_RULES.transitions, TACTICAL_RULES.hitAreas, TACTICAL_RULES.optical, TACTICAL_RULES.textWrap, TACTICAL_RULES.smoothing, TACTICAL_RULES.iconSwaps, TACTICAL_RULES.imageOutlines])
                .addDecision('Tactical polish strategy', '16-point refinement framework from make-interfaces-feel-better')
                .addMetric('principles-applied', 16, 'pass')
                .addMetric('required-items', 6, 'pass', 6)
                .addMetric('optional-items', 10, 'pass', 10)
                .addValidation('Tactical polish checklist', 'pass', '16 principles documented')
                .addArtifact('checklist', 16);
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Tactical Polish workflow initialized - 16-point refinement checklist',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Tactical Polish Rules', Object.entries(TACTICAL_RULES)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n\n'), '16 principles for premium interface feel'),
                ],
                memory: memoryBuilder.build(),
            };
        }
        catch (err) {
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Tactical polish failed: ${String(err).substring(0, 40)}`)
                .addValidation('polish-execution', 'fail', String(err));
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize tactical polish',
                error: String(err),
                memory: memoryBuilder.build(),
            };
        }
    }
}
exports.FlowJTacticalPolishHandler = FlowJTacticalPolishHandler;
/**
 * Flow K: Multi-Lens Audit (5 dimensions)
 * Technical scan - accessibility, performance, theming, responsive, anti-patterns
 */
class FlowKMultiLensAuditHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowK_multi_lens_audit');
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        const guidance = [
            'Dimension 1: Accessibility (WCAG compliance, semantic HTML, keyboard nav)',
            'Dimension 2: Performance (bundle size, Lighthouse scores, Core Web Vitals)',
            'Dimension 3: Theming (color system consistency, CSS variable usage, dark mode)',
            'Dimension 4: Responsive (breakpoints, touch targets, viewport behavior)',
            'Dimension 5: Anti-patterns (hardcoded values, dead code, deprecated APIs)',
            'Address all Critical and High findings; document trade-offs for Medium',
        ];
        // Wire AntiPatternValidator for 27-rule design anti-pattern detection
        const antiPatternValidator = new anti_pattern_validator_1.AntiPatternValidator();
        const artifacts = [];
        if (enhancedContext?.flowMetadata) {
            enhancedContext.flowMetadata.tags = ['flowK', 'multi-lens-audit', '5-dimensions'];
            enhancedContext.flowMetadata.customData = {
                'audit-dimensions': 5,
                'anti-pattern-rules': 27,
            };
        }
        // Try to find and validate code/CSS files in the project
        const projectPath = context.projectPath || process.cwd();
        try {
            const srcDir = path.join(projectPath, 'src');
            if (fs.existsSync(srcDir)) {
                // Collect all CSS and TS files for anti-pattern validation
                const files = fs.readdirSync(srcDir, { recursive: true });
                const relevantFiles = files.filter((f) => {
                    const fname = typeof f === 'string' ? f : f.toString();
                    return fname.endsWith('.css') || fname.endsWith('.scss') || fname.endsWith('.tsx');
                });
                if (relevantFiles.length > 0) {
                    const codeBlocks = {};
                    for (const file of relevantFiles) {
                        const fname = typeof file === 'string' ? file : file.toString();
                        const filePath = path.join(srcDir, fname);
                        try {
                            const content = fs.readFileSync(filePath, 'utf-8');
                            codeBlocks[fname] = content;
                        }
                        catch (e) {
                            // Skip unreadable files
                        }
                    }
                    if (Object.keys(codeBlocks).length > 0) {
                        const batchResults = antiPatternValidator.validateBatch(codeBlocks);
                        const antiPatternFindings = [];
                        for (const [file, result] of Object.entries(batchResults)) {
                            if (result.violations.length > 0) {
                                antiPatternFindings.push(`\n${file}:`);
                                for (const violation of result.violations.slice(0, 3)) {
                                    // Show top 3 violations per file
                                    antiPatternFindings.push(`  [${violation.severity}] ${violation.patternName}: ${violation.fix}`);
                                }
                                if (result.violations.length > 3) {
                                    antiPatternFindings.push(`  ... and ${result.violations.length - 3} more`);
                                }
                            }
                        }
                        if (antiPatternFindings.length > 0) {
                            guidance.push('---');
                            guidance.push('Anti-Pattern Validation (27-rule design law check):');
                            guidance.push(...antiPatternFindings);
                            const avgScore = Object.values(batchResults).reduce((s, r) => s + r.score, 0) / Object.keys(batchResults).length;
                            guidance.push(`Score: ${Math.round(avgScore)}/100`);
                        }
                        // Store result in artifacts for memory
                        const avgScore = Object.values(batchResults).reduce((s, r) => s + r.score, 0) / Object.keys(batchResults).length;
                        artifacts.push(this.createArtifact('reference', 'anti-pattern-validation', JSON.stringify({
                            totalViolations: Object.values(batchResults).reduce((s, r) => s + r.totalViolations, 0),
                            filesValidated: Object.keys(codeBlocks).length,
                            averageScore: Math.round(avgScore),
                        }), 'Anti-pattern validation results'));
                    }
                }
            }
        }
        catch (error) {
            guidance.push(`Note: Could not run anti-pattern validation (${error instanceof Error ? error.message : 'unknown error'})`);
        }
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Running 5-dimension technical audit (28-rule anti-pattern detection included)',
            guidance,
            checklist: this.createChecklist([
                { label: 'Run Lighthouse audit (a11y, performance, best practices)', required: true },
                { label: 'Run axe accessibility audit', required: true },
                { label: 'Check bundle size and code splitting', required: true },
                { label: 'Verify CSS variable usage (no hardcoded colors)', required: true },
                { label: 'Test responsive breakpoints', required: true },
                { label: 'Check for deprecated APIs or console warnings', required: true },
                { label: 'Address all Critical findings from anti-pattern validation', required: true },
                { label: 'Address all High findings from anti-pattern validation', required: true },
                { label: 'Document trade-offs for Medium findings', required: false },
            ]),
            artifacts: artifacts.length > 0 ? artifacts : undefined,
        };
    }
}
exports.FlowKMultiLensAuditHandler = FlowKMultiLensAuditHandler;
/**
 * Flow L: Design Critique (Nielsen heuristics + 12-rule framework)
 * Independent design review - Nielsen heuristics, AI-slop detection, cognitive load, emotional journey, 12-rule critique
 */
class FlowLDesignCritiqueHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowL_design_critique');
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        const guidance = [
            'Nielsen 10 Usability Heuristics: visibility, match with real world, user control, consistency, error prevention, recognition vs recall, flexibility, aesthetic, error recovery, help & documentation',
            'AI-slop detection: generated copy, template language, lack of personality, generic imagery',
            'Cognitive load: information density, task complexity, decision fatigue',
            'Emotional journey: does the design support the brand personality and user emotion targets?',
            'This is an independent review - use fresh eyes and question every design choice',
        ];
        // Wire 12-Rule Critique Framework from CRITIQUE_RULES
        guidance.push('---');
        guidance.push('12-Rule Critique Framework:');
        for (const rule of design_laws_1.CRITIQUE_RULES) {
            guidance.push(`${rule.name} (weight: ${rule.weight}): ${rule.description}`);
        }
        // Wire CategoryReflexDetector for AI slop pattern flagging
        const reflexDetector = new category_reflex_detector_1.CategoryReflexDetector();
        const artifacts = [];
        let slopDetectionReport = '';
        // Wire ProjectPersonaEngine to extract project-specific personas from PRODUCT.md
        const projectPath = context.projectPath || process.cwd();
        const productMdPath = path.join(projectPath, 'PRODUCT.md');
        let personaGuidance = '';
        if (enhancedContext?.flowMetadata) {
            enhancedContext.flowMetadata.tags = ['flowL', 'design-critique', '12-rule-framework'];
            enhancedContext.flowMetadata.customData = {
                'critique-rules': design_laws_1.CRITIQUE_RULES.length,
                'nielsen-heuristics': 10,
                'framework-dimensions': ['usability', 'ai-slop', 'cognitive-load', 'emotional-journey'].length,
                'personas-extracted': fs.existsSync(productMdPath),
            };
        }
        // Try to detect AI slop patterns from design references if available
        try {
            const designRefsPath = path.join(projectPath, '.claude', 'design-references');
            if (fs.existsSync(designRefsPath)) {
                // List design reference categories to check for slop
                const categoryDirs = fs.readdirSync(designRefsPath).filter((f) => !f.startsWith('_'));
                if (categoryDirs.length > 0) {
                    const slopAnalysis = [];
                    for (const category of categoryDirs.slice(0, 3)) {
                        // Analyze first 3 categories for slop
                        const reflexData = reflexDetector.getCategoryReflex(category);
                        if (reflexData.length > 0) {
                            slopAnalysis.push(`${category}: ${reflexData.slice(0, 2).join(', ')}`);
                        }
                    }
                    if (slopAnalysis.length > 0) {
                        slopDetectionReport = `\nCategory-Reflex AI Slop Patterns Detected:\n${slopAnalysis.map((s) => `- ${s}`).join('\n')}`;
                        guidance.push('---');
                        guidance.push(slopDetectionReport);
                    }
                }
            }
        }
        catch (error) {
            // Continue without slop detection if design-references unavailable
        }
        try {
            if (fs.existsSync(productMdPath)) {
                const productMdContent = fs.readFileSync(productMdPath, 'utf-8');
                const engine = new persona_engine_1.ProjectPersonaEngine();
                const personas = await engine.generate(productMdContent);
                personaGuidance = engine.toCritiquePrompt(personas);
                guidance.push('---');
                guidance.push('Project-Specific Personas Extracted from PRODUCT.md:');
                guidance.push(personaGuidance);
            }
            else {
                guidance.push('---');
                guidance.push('Note: PRODUCT.md not found - using generic personas for critique');
            }
        }
        catch (error) {
            guidance.push('---');
            guidance.push(`Note: Could not extract personas from PRODUCT.md (${error instanceof Error ? error.message : 'unknown error'}) - using generic personas`);
        }
        // Calculate critique score from 12 rules
        // Each rule gets a score 0-100 based on design quality; weighted by rule weight
        const critiqueBases = design_laws_1.CRITIQUE_RULES.map((r) => ({
            rule: r.name,
            weight: r.weight,
        }));
        // Generate critique framework artifact for memory
        const critiqueContent = `12-Rule Critique Framework:\n${design_laws_1.CRITIQUE_RULES.map((r) => `${r.name} (weight: ${r.weight})\n  ${r.description}`).join('\n\n')}`;
        artifacts.push(this.createArtifact('reference', 'critique-framework', critiqueContent, 'Weighted 12-rule critique framework'));
        const checklist = this.createChecklist([
            { label: 'Apply Nielsen heuristic #1: visibility of system status', required: true },
            { label: 'Apply Nielsen heuristic #2: match with real world', required: true },
            { label: 'Apply Nielsen heuristic #3: user control and freedom', required: true },
            { label: 'Apply Nielsen heuristic #4: consistency and standards', required: true },
            { label: 'Detect AI-generated copy or template language', required: true },
            { label: 'Assess cognitive load (not over-simplified, not overwhelming)', required: true },
            { label: 'Verify emotional journey aligns with brand and extracted personas', required: true },
            ...design_laws_1.CRITIQUE_RULES.map((rule, idx) => ({
                label: `12-Rule #${idx + 1} - ${rule.name}: ${rule.description}`,
                required: rule.weight >= 1.0, // High-weight rules are required
                description: `Weight: ${rule.weight}`,
            })),
        ]);
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Independent design critique with 12-rule framework and project-specific personas',
            guidance,
            checklist,
            artifacts: artifacts.length > 0 ? artifacts : undefined,
        };
    }
}
exports.FlowLDesignCritiqueHandler = FlowLDesignCritiqueHandler;
/**
 * Flow M: Responsive Design Validation
 * Breakpoint testing (from DESIGN.md), touch target verification (40x40px minimum), viewport behavior
 */
class FlowMResponsiveValidationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowM_responsive_validation');
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        const guidance = [
            'Extract breakpoints from DESIGN.md (canonical source)',
            'Test each breakpoint: desktop, tablet, mobile (and any custom breakpoints)',
            'Verify touch targets: minimum 40x40px for all interactive elements',
            'Check viewport behavior: layout shift, overflow, spacing consistency',
            'Test on real devices (not just browser dev tools) for genuine user experience',
            'Document any breakpoint-specific behaviors or changes',
        ];
        // Wire AntiPatternValidator to check for responsive anti-patterns
        const antiPatternValidator = new anti_pattern_validator_1.AntiPatternValidator();
        const artifacts = [];
        const projectPath = context.projectPath || process.cwd();
        if (enhancedContext?.flowMetadata) {
            enhancedContext.flowMetadata.tags = ['flowM', 'responsive-validation', 'breakpoint-testing'];
            enhancedContext.flowMetadata.customData = {
                'min-touch-target': 40,
                'breakpoints-to-test': ['mobile', 'tablet', 'desktop'].length,
                'validation-dimensions': ['layout-shift', 'overflow', 'spacing-consistency'].length,
                'design-md-required': true,
            };
        }
        try {
            const srcDir = path.join(projectPath, 'src');
            if (fs.existsSync(srcDir)) {
                const files = fs.readdirSync(srcDir, { recursive: true });
                const cssFiles = files.filter((f) => {
                    const fname = typeof f === 'string' ? f : f.toString();
                    return fname.endsWith('.css') || fname.endsWith('.scss');
                });
                if (cssFiles.length > 0) {
                    const cssContent = cssFiles
                        .map((f) => {
                        const fname = typeof f === 'string' ? f : f.toString();
                        try {
                            return fs.readFileSync(path.join(srcDir, fname), 'utf-8');
                        }
                        catch {
                            return '';
                        }
                    })
                        .join('\n');
                    if (cssContent.length > 0) {
                        const result = antiPatternValidator.validateCSS(cssContent);
                        // Filter for responsive-related anti-patterns
                        const responsiveViolations = result.violations.filter((v) => v.patternName.includes('mobile') ||
                            v.patternName.includes('fixed') ||
                            v.patternName.includes('Click targets') ||
                            v.patternName.includes('responsive'));
                        if (responsiveViolations.length > 0) {
                            guidance.push('---');
                            guidance.push(`Anti-Pattern Validation - Responsive Issues (${responsiveViolations.length}):`);
                            for (const violation of responsiveViolations) {
                                guidance.push(`  [${violation.severity}] ${violation.patternName}: ${violation.fix}`);
                            }
                        }
                        artifacts.push(this.createArtifact('reference', 'responsive-validation', JSON.stringify({
                            totalViolations: result.totalViolations,
                            responsiveViolations: responsiveViolations.length,
                            score: result.score,
                        }), 'Responsive anti-pattern validation'));
                    }
                }
            }
        }
        catch (error) {
            guidance.push(`Note: Could not validate responsive anti-patterns (${error instanceof Error ? error.message : 'unknown error'})`);
        }
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Validating responsive design across breakpoints and devices',
            guidance,
            checklist: this.createChecklist([
                { label: 'Extract breakpoints from DESIGN.md', required: true },
                { label: 'Test desktop breakpoint layout', required: true },
                { label: 'Test tablet breakpoint layout', required: true },
                { label: 'Test mobile breakpoint layout', required: true },
                { label: 'Verify all touch targets are 40x40px minimum', required: true },
                { label: 'Check for layout shift between breakpoints', required: true },
                { label: 'Verify no content overflow at any breakpoint', required: true },
                { label: 'Address responsive anti-pattern violations', required: true },
                { label: 'Test on real device (not just browser dev tools)', required: true },
            ]),
            artifacts: artifacts.length > 0 ? artifacts : undefined,
        };
    }
}
exports.FlowMResponsiveValidationHandler = FlowMResponsiveValidationHandler;
/**
 * Flow N: Rapid Iteration (Token-based)
 * Goal-driven refinement with token-based variations, success criteria framework, decision criteria
 */
class FlowNRapidIterationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowN_rapid_iteration_refined');
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        // Check if Endow is available for live browser iteration
        const endowAvailable = process.env.ENDOW_AVAILABLE === 'true' ||
            process.env.ENDOW_SOCKET_PATH !== undefined;
        const guidance = [];
        if (endowAvailable) {
            guidance.push('LIVE BROWSER ITERATION ENABLED via Endow');
            guidance.push('---');
            guidance.push('1. Open the design/component in browser');
            guidance.push('2. Activate Endow overlay (CMD+SHIFT+.)');
            guidance.push('3. Select element to iterate on');
            guidance.push('4. Review proposed changes from Endow');
            guidance.push('5. Accept/reject each iteration (max 10 rounds)');
            guidance.push('6. Visual artifacts captured after each round');
            guidance.push('---');
            guidance.push('Fallback: token-based variations if Endow not connected');
        }
        else {
            guidance.push('Define success criteria upfront: what does a successful design look like?');
            guidance.push('Use DESIGN.md tokens for quick variations (colors, spacing, typography)');
            guidance.push('Generate 3-5 variations per iteration by adjusting tokens');
            guidance.push('Test each variation against success criteria and user feedback');
            guidance.push('Narrow to winner and iterate deeper, or pivot if criteria not met');
            guidance.push('Typical: 2-4 rounds to convergence (diminishing returns)');
        }
        // Wire AntiPatternValidator to check for iteration anti-patterns
        const antiPatternValidator = new anti_pattern_validator_1.AntiPatternValidator();
        const artifacts = [];
        const projectPath = context.projectPath || process.cwd();
        if (enhancedContext?.flowMetadata) {
            enhancedContext.flowMetadata.tags = ['flowN', 'rapid-iteration', 'token-based'];
            enhancedContext.flowMetadata.customData = {
                'iteration-mode': endowAvailable ? 'live-browser' : 'token-based',
                'endow-available': endowAvailable,
                'max-rounds': endowAvailable ? 10 : 4,
                'supported-properties': ['color-adjustments', 'spacing', 'typography', 'opacity', 'border-radius'].length,
            };
        }
        try {
            const srcDir = path.join(projectPath, 'src');
            if (fs.existsSync(srcDir)) {
                const files = fs.readdirSync(srcDir, { recursive: true });
                const codeFiles = files.filter((f) => {
                    const fname = typeof f === 'string' ? f : f.toString();
                    return fname.endsWith('.tsx') || fname.endsWith('.ts');
                });
                if (codeFiles.length > 0) {
                    const codeBlocks = {};
                    for (const file of codeFiles) {
                        const fname = typeof file === 'string' ? file : file.toString();
                        try {
                            const content = fs.readFileSync(path.join(srcDir, fname), 'utf-8');
                            codeBlocks[fname] = content;
                        }
                        catch {
                            // Skip unreadable files
                        }
                    }
                    if (Object.keys(codeBlocks).length > 0) {
                        const batchResults = antiPatternValidator.validateBatch(codeBlocks);
                        // Filter for iteration-related anti-patterns
                        const iterationViolations = [];
                        for (const [file, result] of Object.entries(batchResults)) {
                            const violations = result.violations.filter((v) => v.patternName.includes('Inconsistent') ||
                                v.patternName.includes('spacing') ||
                                v.patternName.includes('rhythm') ||
                                v.patternName.includes('Pure black') ||
                                v.patternName.includes('typography'));
                            if (violations.length > 0) {
                                iterationViolations.push(`\n${file}:`);
                                for (const violation of violations) {
                                    iterationViolations.push(`  [${violation.severity}] ${violation.patternName}`);
                                }
                            }
                        }
                        if (iterationViolations.length > 0) {
                            guidance.push('---');
                            guidance.push('Anti-Pattern Validation - Iteration Issues:');
                            guidance.push(...iterationViolations);
                        }
                        const totalScore = Object.values(batchResults).reduce((s, r) => s + r.score, 0) / Object.keys(batchResults).length;
                        artifacts.push(this.createArtifact('reference', 'iteration-validation', JSON.stringify({
                            filesValidated: Object.keys(codeBlocks).length,
                            averageScore: Math.round(totalScore),
                            status: totalScore >= 80 ? 'Pass: Strong iteration baseline' : 'Review: Address violations before iterating',
                        }), 'Iteration anti-pattern validation'));
                    }
                }
            }
        }
        catch (error) {
            guidance.push(`Note: Could not validate iteration anti-patterns (${error instanceof Error ? error.message : 'unknown error'})`);
        }
        // Add Endow iteration artifact if available
        if (endowAvailable) {
            artifacts.push(this.createArtifact('reference', 'endow-iteration-session', JSON.stringify({
                mode: 'live-browser-iteration',
                improveStatus: 'connected',
                maxRounds: 10,
                supported: ['color-adjustments', 'spacing', 'typography', 'opacity', 'border-radius'],
                captureMode: 'screenshot-per-round',
            }), 'Live Endow iteration session - visual changes captured and compared'));
        }
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: endowAvailable ?
                'Rapid iteration with live browser iteration via Endow' :
                'Rapid iteration with token-based variations',
            guidance,
            checklist: this.createChecklist([
                { label: 'Define success criteria for this element', required: true },
                { label: 'List 2-3 token variations to test', required: true },
                endowAvailable ?
                    { label: 'Activate Endow overlay and select element', required: true } :
                    { label: 'Generate variations by adjusting DESIGN.md tokens', required: true },
                { label: 'Validate iterations against anti-pattern baseline', required: true },
                { label: 'Test variations against success criteria', required: true },
                { label: 'Gather feedback or measure against metrics', required: false },
                { label: 'Decide: iterate deeper, pivot, or converge', required: true },
            ]),
            artifacts: artifacts.length > 0 ? artifacts : undefined,
        };
    }
}
exports.FlowNRapidIterationHandler = FlowNRapidIterationHandler;
// TIER 4: SPECIAL WORKFLOWS
/**
 * Flow O: Clone/Match from Reference (Special)
 * Pixel-perfect 1:1 replication - element tree, typography, interactions, exact spacing
 */
class FlowOCloneMatchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowO_clone_match_special');
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        if (enhancedContext?.flowMetadata) {
            enhancedContext.flowMetadata.tags = ['flowO', 'clone-match', 'pixel-perfect'];
            enhancedContext.flowMetadata.customData = {
                'match-dimensions': ['element-tree', 'typography', 'spacing', 'colors', 'interactions'].length,
                'interaction-states': ['hover', 'press', 'disabled', 'focus'].length,
                'required-precision': 'exact',
            };
        }
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Pixel-perfect 1:1 replication from reference',
            guidance: [
                'Clone means EXACT match - every detail must match the source',
                'Match: element tree structure, nesting hierarchy, naming',
                'Match: typography (font family, size, weight, line height, letter spacing)',
                'Match: spacing (padding, margin, gap), borders, shadows, colors',
                'Match: interactions (hover, press, disabled, focus states)',
                'No approximation or "close enough" - precise measurement required',
            ],
            checklist: this.createChecklist([
                { label: 'Measure element tree structure from reference', required: true },
                { label: 'Replicate nesting hierarchy exactly', required: true },
                { label: 'Match all typography (font, size, weight, line height)', required: true },
                { label: 'Match all spacing values precisely', required: true },
                { label: 'Match colors exactly (hex or token names)', required: true },
                { label: 'Match borders, shadows, and effects', required: true },
                { label: 'Match all interaction states (hover, press, disabled, focus)', required: true },
                { label: 'Side-by-side comparison: pixel-perfect match', required: true },
            ]),
        };
    }
}
exports.FlowOCloneMatchHandler = FlowOCloneMatchHandler;
/**
 * Flow P: Constraint-Based Design (Special)
 * Design under explicit limits - budget, scope, accessibility floor, creative problem-solving
 */
class FlowPConstraintDesignHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowP_constraint_design_special');
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        if (enhancedContext?.flowMetadata) {
            enhancedContext.flowMetadata.tags = ['flowP', 'constraint-design', 'creative-problem-solving'];
            enhancedContext.flowMetadata.customData = {
                'constraint-types': ['budget', 'scope', 'accessibility', 'performance'].length,
                'design-phases': ['define', 'brainstorm', 'implement', 'verify'].length,
                'trade-off-documentation': true,
            };
        }
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Design under explicit constraints and limits',
            guidance: [
                'Constraints inspire creativity - work within explicit boundaries',
                'Define the constraint clearly: budget (KB, components, time), scope, accessibility floor, performance target, etc.',
                'Design within the constraint, not around it - find creative solutions',
                'Document trade-offs and rationale for each design decision',
                'Verify final solution meets all constraints',
                'Constraints prevent over-engineering and keep focus on core goals',
            ],
            checklist: this.createChecklist([
                { label: 'Clearly define the constraint(s)', required: true },
                { label: 'Understand rationale for the constraint', required: true },
                { label: 'Brainstorm solutions that work within constraint', required: true },
                { label: 'Implement chosen solution', required: true },
                { label: 'Verify solution meets all constraints', required: true },
                { label: 'Document trade-offs made due to constraints', required: true },
                { label: 'Verify no hidden violations of constraint', required: true },
            ]),
        };
    }
}
exports.FlowPConstraintDesignHandler = FlowPConstraintDesignHandler;
/**
 * Flow Q: Migration/Refactor (Special)
 * Component API refactoring - dependency mapping, pre/post signoff gates
 */
class FlowQMigrationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowQ_migration_special');
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const enhancedContext = context;
        if (enhancedContext?.flowMetadata) {
            enhancedContext.flowMetadata.tags = ['flowQ', 'migration', 'refactor'];
            enhancedContext.flowMetadata.customData = {
                'pre-migration-gates': 4,
                'post-migration-gates': 3,
                'breaking-changes': true,
                'signoff-required': true,
            };
        }
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Component migration and API refactoring',
            guidance: [
                'Migrations are high-risk: breaking changes affect all consumers',
                'Pre-migration: map all dependencies (grep for component usage)',
                'Define new API clearly before implementation (breaking changes documented)',
                'Implement migration in backward-compatible layer first, then migrate consumers',
                'Post-migration: verify no broken imports, test all consumer code',
                'Signoff gate: both pre and post to catch surprises',
            ],
            checklist: this.createChecklist([
                { label: 'PRE-MIGRATION: Map all component dependencies', required: true },
                { label: 'PRE-MIGRATION: Define new API clearly', required: true },
                { label: 'PRE-MIGRATION: Document all breaking changes', required: true },
                { label: 'PRE-MIGRATION: Signoff from affected teams', required: true },
                { label: 'Implement new API in component', required: true },
                { label: 'Create migration guide for consumers', required: true },
                { label: 'POST-MIGRATION: Test all consumer code', required: true },
                { label: 'POST-MIGRATION: Verify no broken imports', required: true },
                { label: 'POST-MIGRATION: Signoff from affected teams', required: true },
            ]),
        };
    }
}
exports.FlowQMigrationHandler = FlowQMigrationHandler;
//# sourceMappingURL=flow-handlers-tier3-tier4.js.map