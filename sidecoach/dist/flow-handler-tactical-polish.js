"use strict";
// Flow J: Tactical Polish
// 16-point refinement checklist: radius, optical, shadows, scale, transitions, hit areas, text wrap, smoothing
// Plus linguistic-ban scan: detects slop words + rhetorical templates in project copy.
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
exports.FlowJTacticalPolishHandler = void 0;
exports.createFlowJHandler = createFlowJHandler;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
const polish_standard_validator_1 = require("./polish-standard-validator");
const linguistic_ban_validator_1 = require("./linguistic-ban-validator");
const absolute_ban_detector_1 = require("./absolute-ban-detector");
const model_routing_1 = require("./model-routing");
const retry_control_1 = require("./retry-control");
/**
 * Read CSS files in a project directory and return each rule as a string.
 * Used to feed PolishStandardValidator + ExtendedDomainValidator with real
 * data. Pre-wiring these validators received `cssRules: []` (empty), so 16
 * of 22 polish rules failed for lack of input - not because the project
 * actually missed scale(0.96) or font-smoothing, but because the validator
 * had nothing to check.
 *
 * Walks the project root one level deep (no recursion into node_modules
 * or dot-prefixed dirs). Splits each CSS file on `}` to produce one rule
 * string per declaration block. Simple but adequate for the substring-
 * includes() checks the validators use.
 */
function collectProjectCssRules(projectPath) {
    const rules = [];
    let candidates = [];
    try {
        const entries = fs.readdirSync(projectPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
                    continue;
                try {
                    const subEntries = fs.readdirSync(path.join(projectPath, entry.name), { withFileTypes: true });
                    for (const sub of subEntries) {
                        if (sub.isFile() && /\.(css|scss|sass|less)$/i.test(sub.name)) {
                            candidates.push(path.join(projectPath, entry.name, sub.name));
                        }
                    }
                }
                catch { /* skip */ }
            }
            else if (entry.isFile() && /\.(css|scss|sass|less)$/i.test(entry.name)) {
                candidates.push(path.join(projectPath, entry.name));
            }
        }
    }
    catch {
        return rules;
    }
    for (const file of candidates) {
        try {
            const stat = fs.statSync(file);
            if (stat.size > 2 * 1024 * 1024)
                continue;
            const content = fs.readFileSync(file, 'utf-8');
            // Split into rules at each `}` boundary. Keep each block as the
            // selector + body so validators can substring-match against either.
            const blocks = content.split('}').map((b) => b.trim()).filter(Boolean);
            for (const block of blocks)
                rules.push(block + ' }');
        }
        catch { /* skip unreadable */ }
    }
    // Also scan inline <style> in HTML files for any embedded rules.
    try {
        const htmlEntries = fs.readdirSync(projectPath, { withFileTypes: true });
        for (const entry of htmlEntries) {
            if (entry.isFile() && /\.html?$/i.test(entry.name)) {
                try {
                    const content = fs.readFileSync(path.join(projectPath, entry.name), 'utf-8');
                    const styleBlocks = Array.from(content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi));
                    for (const sb of styleBlocks) {
                        const blocks = sb[1].split('}').map((b) => b.trim()).filter(Boolean);
                        for (const block of blocks)
                            rules.push(block + ' }');
                    }
                }
                catch { /* skip */ }
            }
        }
    }
    catch { /* skip */ }
    return rules;
}
/**
 * Scan all HTML files in a project directory for linguistic bans. Returns
 * a per-file map of reports plus an aggregate.
 *
 * Walks the project root one level deep (no recursion into node_modules or
 * dot-prefixed dirs). Skips files >2MB to avoid pathological inputs.
 */
function scanProjectCopy(projectPath) {
    const perFile = new Map();
    const totalFindings = [];
    let candidates = [];
    try {
        const entries = fs.readdirSync(projectPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
                    continue;
                try {
                    const subEntries = fs.readdirSync(path.join(projectPath, entry.name), { withFileTypes: true });
                    for (const sub of subEntries) {
                        if (sub.isFile() && /\.(html?|md)$/i.test(sub.name)) {
                            candidates.push(path.join(projectPath, entry.name, sub.name));
                        }
                    }
                }
                catch {
                    // skip unreadable subdirs
                }
            }
            else if (entry.isFile() && /\.(html?|md)$/i.test(entry.name)) {
                candidates.push(path.join(projectPath, entry.name));
            }
        }
    }
    catch {
        return { perFile, totalFindings };
    }
    for (const file of candidates) {
        try {
            const stat = fs.statSync(file);
            if (stat.size > 2 * 1024 * 1024)
                continue;
            const content = fs.readFileSync(file, 'utf-8');
            const report = (0, linguistic_ban_validator_1.scanForLinguisticBans)(content, path.relative(projectPath, file));
            if (report.findings.length > 0) {
                perFile.set(file, report);
                totalFindings.push(...report.findings);
            }
        }
        catch {
            // skip unreadable file
        }
    }
    return { perFile, totalFindings };
}
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
        try {
            // T-0009: Phase-gated retry control. Check halt conditions BEFORE
            // running validators. If the orchestrator has been hammering this
            // handler past maxCycles or against an identical-error signature,
            // bail out with a structured halt result.
            const retryConfig = (0, retry_control_1.readRetryConfig)(context);
            const retryState = (0, retry_control_1.readRetryState)(context);
            const haltDecision = (0, retry_control_1.evaluateHaltConditions)(retryState, retryConfig);
            if (haltDecision.halt) {
                return (0, retry_control_1.buildHaltResult)(this.flowId, this.getFlowName(), haltDecision, 'polish-standard', `[${this.flowId}]`);
            }
            // Build DomainCheckContext from execution context
            // Extract available data from metadata or use defaults.
            // Round 2 (R4): if metadata.cssRules is not provided, read the
            // project's actual CSS files. Pre-wiring this defaulted to [] which
            // caused 16 of 22 polish rules to fail purely for lack of input,
            // making polish-standard grade always 0% regardless of project state.
            const metadata = context.metadata || {};
            const projectCssRules = (metadata.cssRules && metadata.cssRules.length > 0)
                ? metadata.cssRules
                : collectProjectCssRules(context.projectPath || process.cwd());
            const domainCheckContext = {
                designTokens: metadata.designTokens || {},
                componentTree: metadata.componentTree || {},
                cssRules: projectCssRules,
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
            // Linguistic-ban scan: walk the project's HTML/markdown copy and look
            // for slop words + rhetorical templates. Closes the largest forensic
            // gap: previously this validator had zero coverage of generated copy,
            // so things like "Memory in layers. Not a feature, a discipline." and
            // "Not a platform / Not a framework / Not for everyone" shipped without
            // a finding. The scan is additive - file-system errors degrade
            // gracefully and never break the chain.
            const linguisticScan = scanProjectCopy(context.projectPath || process.cwd());
            const linguisticP0 = linguisticScan.totalFindings.filter((f) => f.severity === 'P0').length;
            const linguisticP1 = linguisticScan.totalFindings.filter((f) => f.severity === 'P1').length;
            // Round 2 wiring (C2): scan project for the 6 named absolute bans.
            // CSS scans for side-stripe borders, gradient text, glassmorphism
            // default. HTML scans for identical card grids, hero-metric template,
            // modal-as-first-thought. The detection-hint regexes from
            // reference-loader.loadAbsoluteBans() are inlined into the detector.
            const absoluteBanScan = (0, absolute_ban_detector_1.scanForAbsoluteBans)(context.projectPath || process.cwd());
            const banP0 = absoluteBanScan.findings.filter((f) => f.severity === 'P0').length;
            const banP1 = absoluteBanScan.findings.filter((f) => f.severity === 'P1').length;
            const appliedRules = Object.entries(TACTICAL_RULES).map(([key, rule]) => ({
                category: key,
                rule,
            }));
            const checklist = this.createChecklist([
                { label: `Absolute ban scan: 0 P0 findings (named anti-patterns)${banP0 === 0 ? ' - PASS' : ` - ${banP0} P0 found`}`, required: true },
                { label: `Absolute ban scan: 0 P1 findings${banP1 === 0 ? ' - PASS' : ` - ${banP1} P1 found (review each)`}`, required: false },
                { label: `Linguistic ban scan: 0 P0 findings (rhetorical templates)${linguisticP0 === 0 ? ' - PASS' : ` - ${linguisticP0} P0 found`}`, required: true },
                { label: `Linguistic ban scan: <= 2 P1 findings (slop words)${linguisticP1 <= 2 ? ' - PASS' : ` - ${linguisticP1} P1 found`}`, required: false },
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
            // Build absolute-ban guidance lines
            const absoluteBanGuidance = [];
            if (absoluteBanScan.findings.length === 0) {
                absoluteBanGuidance.push('ABSOLUTE BAN SCAN: 0 findings. The 6 named bans (side-stripe borders, gradient text, glassmorphism default, identical card grids, hero-metric template, modal-as-first-thought) are clean.');
            }
            else {
                for (const line of (0, absolute_ban_detector_1.banFindingsToGuidance)(absoluteBanScan))
                    absoluteBanGuidance.push(line);
            }
            // Build linguistic-ban guidance lines from per-file reports
            const linguisticGuidance = [];
            if (linguisticScan.totalFindings.length === 0) {
                linguisticGuidance.push('LINGUISTIC BAN SCAN: 0 findings. Project copy passes slop-word + rhetorical-template checks.');
            }
            else {
                linguisticGuidance.push(`LINGUISTIC BAN SCAN: ${linguisticScan.totalFindings.length} findings across ${linguisticScan.perFile.size} files (P0: ${linguisticP0} rhetorical templates, P1: ${linguisticP1} slop words).`);
                linguisticGuidance.push('P0 templates must be rewritten before sign-off. P1 slop words are strong recommendations to revise.');
                linguisticGuidance.push('');
                for (const [, report] of linguisticScan.perFile) {
                    for (const line of (0, linguistic_ban_validator_1.findingsToGuidance)(report)) {
                        linguisticGuidance.push(line);
                    }
                }
            }
            const guidance = [
                `Validation Matrix: 112-Rule Framework (${totalPassed}/${totalRules} rules pass - ${combinedPassRate}%)`,
                '= 22-point Polish Standard (14 baseline + 8 proprietary)',
                '+ 90-rule Extended Domain Validator (10 domains: 7 base + 3 new)',
                '+ Linguistic Ban Scan (slop words + rhetorical templates)',
                '+ Absolute Ban Detector (6 named anti-patterns)',
                '',
                ...absoluteBanGuidance,
                '',
                ...linguisticGuidance,
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
                .addMetric('linguistic-p0-templates', linguisticP0, linguisticP0 === 0 ? 'pass' : 'fail')
                .addMetric('linguistic-p1-slop-words', linguisticP1, linguisticP1 <= 2 ? 'pass' : 'warning')
                .addMetric('absolute-ban-p0', banP0, banP0 === 0 ? 'pass' : 'fail')
                .addMetric('absolute-ban-p1', banP1, banP1 === 0 ? 'pass' : 'warning')
                .addValidation('Tactical polish checklist', 'pass', '16 principles documented')
                .addValidation('Extended domain validation', 'pass', `${extendedReport.totalRules} rules across 10 domains`)
                .addValidation('Linguistic ban scan', linguisticP0 === 0 ? 'pass' : 'fail', `${linguisticScan.totalFindings.length} findings across ${linguisticScan.perFile.size} files`)
                .addArtifact('reference', totalRules);
            const result = {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Tactical Polish: 112-rule matrix ${totalPassed}/${totalRules} pass. Linguistic ban: ${linguisticP0} P0 + ${linguisticP1} P1. Absolute ban: ${banP0} P0 + ${banP1} P1 across ${absoluteBanScan.scannedFiles} files.`,
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
            // Round 2 (C4): also push linguistic-ban (Copy domain) and absolute-ban
            // (Anti-Patterns domain) so BuildReport produces letter grades for both.
            // Pre-wiring these results lived only in result.message; the aggregator
            // never saw them, so BuildReport verdict came back as `(none)`.
            result.validationResults = result.validationResults || [];
            result.validationResults.push(polish_standard_validator_1.PolishStandardValidator.toValidationResult(polishReport));
            result.validationResults.push((0, linguistic_ban_validator_1.linguisticBanToValidationResult)({
                scanned: 0,
                findings: linguisticScan.totalFindings,
                summary: `Copy across ${linguisticScan.perFile.size} files: ${linguisticP0} P0 templates, ${linguisticP1} P1 slop words`,
            }));
            result.validationResults.push((0, absolute_ban_detector_1.absoluteBanToValidationResult)(absoluteBanScan));
            // T-0009: Phase-gated retry control. Compute the error signature from
            // the validator that drives this handler (Polish Standard is the
            // primary signal; failed rule IDs identify the specific failure set).
            // Append to retry state and ship it back via executionMetadata so the
            // next invocation can decide whether to halt.
            const failedRuleIds = polishReport.results
                .filter((r) => !r.passed)
                .map((r) => String(r.ruleId));
            const errorSignature = (0, retry_control_1.computeErrorSignature)({
                validator: 'polish-standard',
                failedRules: failedRuleIds,
                filePath: context.projectPath || '',
            });
            const nextState = (0, retry_control_1.recordIteration)(retryState, errorSignature);
            (0, retry_control_1.attachRetryStateToResult)(result, nextState, retryConfig);
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