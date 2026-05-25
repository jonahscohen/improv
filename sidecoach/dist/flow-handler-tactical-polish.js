"use strict";
// Flow J: Tactical Polish
// 16-point refinement checklist: radius, optical, shadows, scale, transitions, hit areas, text wrap, smoothing
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowJTacticalPolishHandler = void 0;
exports.createFlowJHandler = createFlowJHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
const polish_standard_validator_1 = require("./polish-standard-validator");
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
        try {
            // Build DomainCheckContext from execution context
            // Extract available data from metadata or use defaults
            const metadata = context.metadata || {};
            const domainCheckContext = {
                designTokens: metadata.designTokens || {},
                componentTree: metadata.componentTree || {},
                cssRules: metadata.cssRules || [],
                accessibility: metadata.accessibility,
                contrast: metadata.contrast,
            };
            // Run both validators: 22-point Polish Standard + 90-rule Extended Domains
            const polishReport = polish_standard_validator_1.PolishStandardValidator.validateAll(domainCheckContext);
            const extendedReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            // Combine results: 22 + 90 = 112 rules
            const totalRules = polishReport.totalRules + extendedReport.totalRules;
            const totalPassed = polishReport.passed + extendedReport.passed;
            const totalViolations = polishReport.violations + extendedReport.violations;
            const combinedPassRate = ((totalPassed / totalRules) * 100).toFixed(1);
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
                `Validation Matrix: 112-Rule Framework (${totalPassed}/${totalRules} rules pass - ${combinedPassRate}%)`,
                '= 22-point Polish Standard (14 baseline + 8 proprietary)',
                '+ 90-rule Extended Domain Validator (10 domains: 7 base + 3 new)',
                '',
                'POLISH STANDARD (22 rules):',
                `- Polish: ${polishReport.passed}/${polishReport.totalRules} pass`,
                '',
                'EXTENDED DOMAINS (90 rules):',
                `- Extended: ${extendedReport.passed}/${extendedReport.totalRules} pass`,
                '- Domains: Typography (16), Color (18), Spatial (14), Motion (20), Interaction (15),',
                '           Responsive (12), UX Writing (11), Performance (9), Data Visualization (10),',
                '           Internationalization (7)',
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
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`112-rule validation matrix applied: ${totalPassed}/${totalRules} rules pass (${combinedPassRate}%)`)
                .addRule('polish', [TACTICAL_RULES.scalePress, TACTICAL_RULES.radius, TACTICAL_RULES.shadows, TACTICAL_RULES.transitions, TACTICAL_RULES.hitAreas, TACTICAL_RULES.optical, TACTICAL_RULES.textWrap, TACTICAL_RULES.smoothing, TACTICAL_RULES.iconSwaps, TACTICAL_RULES.imageOutlines])
                .addDecision('Validation strategy', '112-rule framework: 22-point Polish + 90-rule Extended Domains')
                .addMetric('total-rules', totalRules, 'pass')
                .addMetric('passed-rules', totalPassed, 'pass', totalRules)
                .addMetric('violation-count', totalViolations, 'warning')
                .addMetric('pass-rate-percent', parseFloat(combinedPassRate), 'pass')
                .addValidation('Tactical polish checklist', 'pass', '16 principles documented')
                .addValidation('Extended domain validation', 'pass', `${extendedReport.totalRules} rules across 10 domains`)
                .addArtifact('reference', totalRules);
            const result = {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Tactical Polish workflow initialized - 112-rule validation matrix (${totalPassed}/${totalRules} pass)`,
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Polish Standard Rules', Object.entries(TACTICAL_RULES)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join('\n\n'), '16 tactical principles for premium interface feel'),
                    this.createArtifact('template', 'Validation Report Summary', `Polish Standard: ${polishReport.passed}/${polishReport.totalRules} pass (${polishReport.passRate})\nExtended Domains: ${extendedReport.passed}/${extendedReport.totalRules} pass (${extendedReport.passRate})\nCombined: ${totalPassed}/${totalRules} pass (${combinedPassRate}%)`, 'Complete 112-rule validation matrix results'),
                ],
                memory: memoryBuilder.build(),
            };
            // Sprint 7 T6: push PolishStandard result onto result.validationResults so BuildReport picks it up.
            result.validationResults = result.validationResults || [];
            result.validationResults.push(polish_standard_validator_1.PolishStandardValidator.toValidationResult(polishReport));
            return result;
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Tactical polish failed: ${String(err).substring(0, 40)}`)
                .addValidation('polish-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize tactical polish',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowJTacticalPolishHandler = FlowJTacticalPolishHandler;
function createFlowJHandler() {
    return new FlowJTacticalPolishHandler();
}
//# sourceMappingURL=flow-handler-tactical-polish.js.map