"use strict";
// Flow D: Design References
// Search visual inspiration and design patterns against color + spatial domain rules
// Applies color domain (OKLCH, contrast, semantics) + spatial domain (grid, spacing)
// Includes category-reflex AI slop detection
// Includes the CONCEPT SKETCH lens: a generated-and-verified reference plate for the brief (see below)
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
exports.FlowDReferenceSearchHandler = void 0;
exports.buildSketchPrompt = buildSketchPrompt;
exports.runConceptSketchLens = runConceptSketchLens;
exports.isOfferableSketch = isOfferableSketch;
exports.sketchGuidance = sketchGuidance;
exports.createFlowDHandler = createFlowDHandler;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const flow_handler_1 = require("./flow-handler");
const design_references_reference_1 = require("./design-references-reference");
const design_laws_1 = require("./design-laws");
const flow_memory_schema_1 = require("./flow-memory-schema");
const model_routing_1 = require("./model-routing");
/**
 * Build the sketch prompt from the brief. Deterministic: the same register, approach and utterance always
 * produce the same prompt, so the same brief always produces the same plate (and the same cache key).
 */
function buildSketchPrompt(register, approach, utterance) {
    const subject = utterance.trim().replace(/\s+/g, ' ').slice(0, 220) || 'the surface described in the brief';
    return [
        `A reference plate for a ${register} interface in a ${approach} visual direction.`,
        `Brief: ${subject}.`,
        'Flat even lighting, generous negative space, no text, no lettering, no logos, no user-interface chrome.',
    ].join(' ');
}
/**
 * Invoke bin/sidecoach-image.js in offline mode for the brief and map its exit code onto a four-valued outcome.
 * Exit codes are the contract: 0 verified, 1 a check failed, 3 a check could not run, anything else means no
 * plate was produced.
 */
function runConceptSketchLens(context) {
    const projectPath = context.projectPath;
    if (!projectPath)
        return null;
    try {
        if (!fs.statSync(projectPath).isDirectory())
            return null;
    }
    catch {
        return null;
    }
    const bin = path.resolve(__dirname, '..', 'bin', 'sidecoach-image.js');
    if (!fs.existsSync(bin))
        return null;
    const register = context.projectContext?.register || 'product';
    const approach = context.projectContext?.design?.visual?.approach || 'modern';
    const prompt = buildSketchPrompt(register, approach, context.utterance || '');
    const slug = (0, crypto_1.createHash)('sha256').update(prompt).digest('hex').slice(0, 12);
    const outDir = path.join(projectPath, '.sidecoach-cache', 'sketches');
    const out = path.join(outDir, `concept-${slug}.png`);
    let stdout = '';
    let code = 0;
    try {
        fs.mkdirSync(outDir, { recursive: true });
        stdout = (0, child_process_1.execFileSync)(process.execPath, [
            bin,
            'generate',
            '--prompt',
            prompt,
            '--out',
            out,
            '--size',
            '1024x1024',
            '--provider',
            'offline',
            '--cache-dir',
            path.join(projectPath, '.sidecoach-cache', 'images'),
            '--quiet',
        ], { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    }
    catch (err) {
        const e = err;
        code = typeof e.status === 'number' ? e.status : -1;
        stdout = typeof e.stdout === 'string' ? e.stdout : '';
        if (code === -1)
            return null;
    }
    let parsed = {};
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        // A nonzero exit with no JSON means the step never got far enough to produce a verdict.
        return code === 0 ? null : { status: 'unavailable', provider: 'offline', detail: `the sketch step exited ${code} without a verdict` };
    }
    const provider = parsed.provider || 'offline';
    const model = parsed.model;
    const failed = (parsed.verification?.checks || []).filter((c) => c.status === 'fail');
    const unver = (parsed.verification?.checks || []).filter((c) => c.status === 'unverified');
    if (code === 0 && parsed.verdict === 'verified') {
        return { status: 'verified', path: out, provider, model, detail: 'geometry, format and rendered content all checked against the bytes' };
    }
    if (parsed.verdict === 'failed') {
        return { status: 'failed', provider, model, detail: `the plate failed verification: ${failed.map((c) => `${c.id} (${c.detail})`).join('; ') || 'unspecified check'}` };
    }
    if (parsed.verdict === 'unverified') {
        return { status: 'unverified', provider, model, detail: `the plate could not be fully checked: ${unver.map((c) => c.id).join(', ') || 'unspecified check'}` };
    }
    return { status: 'unavailable', provider, detail: `the sketch step exited ${code} with verdict ${String(parsed.verdict)}` };
}
/**
 * Whether a sketch outcome may be handed downstream as a usable reference.
 *
 * VERIFIED and nothing else. A failed plate, an unverifiable plate, a step that produced nothing, and a lens
 * that never ran are all withheld. It is a separate exported predicate rather than an inline condition so the
 * rule is testable on all four states, including the two the flow cannot easily be driven into.
 */
function isOfferableSketch(outcome) {
    return outcome !== null && outcome.status === 'verified' && typeof outcome.path === 'string' && outcome.path.length > 0;
}
/** The guidance lines flow D emits for the sketch step, in every outcome including "it did not run". */
function sketchGuidance(outcome) {
    if (!outcome) {
        return [
            'Concept sketch: not run (no project path in this context).',
            'Run one explicitly with: node bin/sidecoach-image.js generate --prompt "<brief>" --out <file.png>',
        ];
    }
    switch (outcome.status) {
        case 'verified':
            return [
                `Concept sketch: VERIFIED and available at ${outcome.path}`,
                `Generated by ${outcome.provider}${outcome.model ? ` (${outcome.model})` : ''}; ${outcome.detail}.`,
                'This plate is a deterministic offline placeholder, marked as such in its own bytes. For a real asset, re-run bin/sidecoach-image.js with a live provider and an explicit spend signal.',
            ];
        case 'failed':
            return [
                'Concept sketch: FAILED verification and is NOT offered as a reference.',
                outcome.detail,
            ];
        case 'unverified':
            return [
                'Concept sketch: UNVERIFIED. A plate was produced but the checks could not run, so it is not offered as a reference.',
                outcome.detail,
            ];
        default:
            return [
                'Concept sketch: no plate was produced.',
                outcome.detail,
            ];
    }
}
class FlowDReferenceSearchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowD_reference_inspiration');
        this.designReferencesRef = new design_references_reference_1.DesignReferencesSystemImpl();
    }
    canExecute(context) {
        // Flow D requires project context with register (to get design approach)
        return !!(context.projectContext?.register);
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        const register = context.projectContext?.register || 'product';
        const designApproach = context.projectContext?.design?.visual?.approach || 'modern';
        try {
            // Get color domain rules (OKLCH, contrast, semantics, saturation, dark mode)
            const colorDomain = design_laws_1.SHARED_DESIGN_LAWS.color;
            const colorRules = colorDomain.rules.map((rule) => `- ${rule}`);
            // Get spatial domain rules (4pt grid, gap/margin, touch targets, white space)
            const spatialDomain = design_laws_1.SHARED_DESIGN_LAWS.spatial;
            const spatialRules = spatialDomain.rules.map((rule) => `- ${rule}`);
            // Search for design references by approach
            const references = await this.designReferencesRef.searchReferences(designApproach, register, 10);
            // Get category-reflex patterns for slop detection
            const categoryReflex = design_laws_1.CATEGORY_REFLEX;
            // Analyze each reference for AI slop
            const referenceAnalysis = await Promise.all(references.map(async (ref) => {
                const reflexIssues = await this.designReferencesRef.getCategoryReflex(ref.category);
                const oversaturated = reflexIssues.includes('oversaturated') ||
                    reflexIssues.length > 0;
                // Genericidad score: 0-1 where 0 is unique/specific, 1 is generic AI slop
                const isOversaturatedCategory = categoryReflex.oversaturated_families?.includes(ref.category) || false;
                const genericityScore = isOversaturatedCategory ? 0.8 : oversaturated ? 0.5 : 0.2;
                return {
                    title: ref.title,
                    category: ref.category,
                    hasColorPalette: !!ref.colorPalette,
                    hasSpacingPattern: !!ref.spacingPattern,
                    slopDetectionResults: {
                        categoryReflex: oversaturated,
                        oversaturated: isOversaturatedCategory,
                        genericityScore,
                    },
                };
            }));
            // Filter high-genericity (AI slop) references
            const lowSlopReferences = referenceAnalysis.filter((r) => r.slopDetectionResults.genericityScore < 0.6);
            const oversaturatedCount = referenceAnalysis.filter((r) => r.slopDetectionResults.oversaturated).length;
            // Cache context for downstream flows
            this.cachedReferenceContext = {
                referencesFound: references.length,
                colorDomainRules: colorDomain.rules,
                spatialDomainRules: spatialDomain.rules,
                references: referenceAnalysis,
            };
            // Concept sketch lens: generate a reference plate from the brief and verify it before offering it.
            // Contained: null means the lens did not run, which flow D reports rather than hides.
            const sketch = runConceptSketchLens(context);
            // Build checklist
            const checklist = this.createChecklist([
                { label: 'Register defined', required: true, description: register },
                { label: 'Design approach specified', required: true, description: designApproach },
                { label: 'Color domain rules reviewed (OKLCH, contrast)', required: true, description: `${colorRules.length} rules loaded` },
                { label: 'Spatial domain rules reviewed (grid, spacing)', required: true, description: `${spatialRules.length} rules loaded` },
                { label: 'Design references found', required: false, description: `${references.length} references available` },
                { label: 'Category-reflex AI slop detection applied', required: false, description: `${referenceAnalysis.length - lowSlopReferences.length} high-slop filtered` },
                {
                    label: 'Concept sketch generated AND verified',
                    required: false,
                    description: sketch ? `${sketch.status}: ${sketch.detail}` : 'not run (no project path in this context)',
                },
            ]);
            // Build guidance
            const guidance = [
                `Register: ${register}`,
                `Design approach: ${designApproach}`,
                '',
                'Color Domain Rules (OKLCH Commitment):',
                ...colorRules,
                '',
                'Semantic Colors: ensure meaning is consistent across light/dark modes',
                'Contrast Validation: WCAG AA minimum 4.5:1 for text, 3:1 for UI',
                'Saturation & Vibrancy: appropriate for register (product vs brand)',
                '',
                'Spatial Domain Rules (4pt Grid System):',
                ...spatialRules,
                '',
                'Touch Targets: minimum 40x40px for interactive elements',
                'White Space: balance density with breathing room',
                'Container Queries: responsive without media queries',
                '',
                'Design References Analysis:',
                `- Total found: ${references.length}`,
                `- High quality (low AI slop): ${lowSlopReferences.length}`,
                `- Flagged as oversaturated: ${oversaturatedCount}`,
                '',
                'High-Quality References (genericityScore < 0.6):',
                ...lowSlopReferences.map((r) => `- ${r.title} (${r.category}${r.hasColorPalette ? ' + color' : ''}${r.hasSpacingPattern ? ' + spacing' : ''})`),
                '',
                'Concept Sketch (generated reference plate, verified before it is offered):',
                ...sketchGuidance(sketch),
                '',
                `Proceed to Flow E (Motion Patterns) for animation design validation.`,
            ];
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`Design references: ${references.length} patterns + AI slop detection`)
                .addRule('color', colorRules)
                .addRule('spatial', spatialRules)
                .addDecision(`Selected ${lowSlopReferences.length} high-quality references`, `Filtered oversaturated/AI-slop references (genericityScore < 0.6)`)
                .addMetric('references-analyzed', references.length, 'pass')
                .addMetric('high-quality-references', lowSlopReferences.length, 'pass', references.length)
                .addMetric('ai-slop-filtered', oversaturatedCount, 'pass')
                .addValidation('Category-reflex AI slop detection', oversaturatedCount === 0 ? 'pass' : 'warning', `${oversaturatedCount} oversaturated categories`)
                // Fail-closed: only a verified plate is a pass. A plate that failed or could not be checked is a fail,
                // and a lens that did not run is a warning - never a silent pass.
                .addValidation('Concept sketch verification', !sketch ? 'warning' : sketch.status === 'verified' ? 'pass' : sketch.status === 'unavailable' ? 'warning' : 'fail', sketch ? `${sketch.status}: ${sketch.detail}` : 'sketch lens did not run (no project path)')
                .addReference('design-references', lowSlopReferences.length, 'design inspiration patterns')
                .addArtifact('reference-patterns', lowSlopReferences.length, ['flowE_motion_patterns', 'flowG_component_implementation', 'flowN_design_refine']);
            const memory = memoryBuilder.build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Design references: ${references.length} patterns researched with color + spatial rules + category-reflex AI slop detection`,
                guidance,
                checklist,
                artifacts: [
                    // Only a VERIFIED plate becomes an artifact. A failed or unverifiable one is named in the guidance and
                    // the checklist but is never handed downstream as a usable reference.
                    //
                    // This sits OUTSIDE the lowSlopReferences guard on purpose: the plate is authored from the brief and
                    // does not depend on how many external references cleared the slop filter. Nesting it inside that
                    // guard silently dropped a verified plate whenever the filter returned nothing, which is exactly the
                    // shape of defect this whole unit exists to prevent.
                    ...(isOfferableSketch(sketch)
                        ? [
                            this.createArtifact('reference', 'Concept Sketch (verified)', sketch.path, `Generated reference plate, verified against its own bytes: ${sketch.detail}`),
                        ]
                        : []),
                    ...(lowSlopReferences.length > 0
                        ? [
                            this.createArtifact('reference', 'Design References (Filtered)', lowSlopReferences.map((r) => `${r.title} (${r.category})`).join('\n'), `${lowSlopReferences.length} high-quality references matching color & spatial domain rules`),
                            this.createArtifact('reference', 'Color Domain Rules', colorRules.join('\n'), 'OKLCH color space, contrast validation, semantic meaning, dark mode strategies'),
                            this.createArtifact('reference', 'Spatial Domain Rules', spatialRules.join('\n'), '4pt grid foundation, gap vs margin, touch targets, white space balance'),
                        ]
                        : []),
                ],
                memory,
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Design reference search failed: ${String(err).substring(0, 40)}`)
                .addValidation('design-references-query', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to search design references',
                error: String(err),
                guidance: [],
                checklist: [],
                memory,
            };
        }
    }
    getCachedContext() {
        return this.cachedReferenceContext;
    }
}
exports.FlowDReferenceSearchHandler = FlowDReferenceSearchHandler;
function createFlowDHandler() {
    return new FlowDReferenceSearchHandler();
}
//# sourceMappingURL=flow-handler-design-references.js.map