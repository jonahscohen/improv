"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentDetector = void 0;
exports.createDetector = createDetector;
const flows_1 = require("./flows");
const orchestrator_1 = require("./orchestrator");
const flow_history_1 = require("./flow-history");
class IntentDetector {
    constructor(orchestrator, history) {
        // Use injected dependencies or fall back to creating new instances
        this.history = history || (0, flow_history_1.getFlowHistory)();
        this.orchestrator = orchestrator || new orchestrator_1.SidecoachOrchestrator(this.history);
        this.detectors = [
            // Tier 1: Strategy/Research
            this.createFlowADetector(),
            this.createFlowBDetector(),
            this.createFlowCDetector(),
            this.createFlowDDetector(),
            this.createFlowEDetector(),
            // Tier 2: Execution
            this.createFlowFDetector(),
            this.createFlowGDetector(),
            this.createFlowHDetector(),
            this.createFlowIDetector(),
            // Tier 3: Polish/QA
            this.createFlowJDetector(),
            this.createFlowKDetector(),
            this.createFlowLDetector(),
            this.createFlowMDetector(),
            this.createFlowNDetector(),
            // Tier 4: Special
            this.createFlowODetector(),
            this.createFlowPDetector(),
            this.createFlowQDetector(),
            // Tier 5: Specialized Refinement (NEW - v2.1.9)
            this.createFlowRDetector(),
            this.createFlowSDetector(),
            this.createFlowTDetector(),
            // Special: Curate & QA
            this.createFlowUDetector(),
            this.createFlowVDetector(),
            // New: Landing & Copy
            this.createFlowWDetector(),
            this.createFlowXDetector(),
            // Tier 7: Renamed legacy (T-0015) - unique flows preserved with letter prefix
            this.createFlowYDetector(),
            this.createFlowZDetector(),
        ];
    }
    detect(utterance) {
        const normalized = utterance.toLowerCase();
        const matches = [];
        for (const detector of this.detectors) {
            const score = detector.score(normalized);
            if (score > 0) {
                const flow = (0, flows_1.getFlow)(detector.flowId);
                if (flow) {
                    matches.push({
                        flowId: detector.flowId,
                        flowName: flow.name,
                        confidence: score,
                        matchedTokens: [],
                        reason: `Rule-based match (confidence: ${(score * 100).toFixed(0)}%)`,
                    });
                }
            }
        }
        if (matches.length === 0) {
            return {
                candidates: [],
                isAmbiguous: true,
                clarificationNeeded: 'No matching flows found. Please rephrase your request.',
            };
        }
        // Sort by confidence
        matches.sort((a, b) => b.confidence - a.confidence);
        if (matches.length === 1) {
            return matches[0];
        }
        // Return top match with others as candidates
        const disambig = {
            candidates: matches.slice(0, 3),
            isAmbiguous: matches[0].confidence < 0.9 || matches.length > 1,
            recommendation: matches[0],
            clarificationNeeded: matches.length > 1 ? `Did you mean ${matches[0].flowName}?` : undefined,
        };
        // Tie-break: when top candidates have equal confidence, use the recommendation field
        // or fall back to a deterministic heuristic (alphabetical by flowId)
        if (disambig.isAmbiguous && disambig.candidates.length > 1) {
            const topConf = disambig.candidates[0].confidence;
            const tied = disambig.candidates.filter((c) => c.confidence === topConf);
            if (tied.length > 1) {
                const rec = disambig.recommendation;
                let chosenFlowId;
                let reason;
                if (rec && tied.some((c) => c.flowId === rec.flowId)) {
                    chosenFlowId = rec.flowId;
                    reason = `Used recommendation field as tiebreaker among ${tied.length} equal-confidence matches`;
                }
                else {
                    const sorted = [...tied].sort((a, b) => String(a.flowId).localeCompare(String(b.flowId)));
                    chosenFlowId = sorted[0].flowId;
                    reason = `Alphabetical tiebreak among ${tied.length} equal-confidence matches (no recommendation set)`;
                }
                disambig.tieBreak = { chosenFlowId, reason };
            }
        }
        return disambig;
    }
    // Orchestrator Integration: Prerequisite validation and flow chaining
    validateFlowPrerequisites(flowId, context) {
        const validation = this.orchestrator.validatePrerequisites(flowId);
        // If prerequisites are met, user can run this flow
        if (validation.valid) {
            return {
                canRun: true,
                missingPrerequisites: [],
                message: validation.message,
            };
        }
        // Prerequisites not met - recommend the first missing prerequisite instead
        const missingFlows = validation.missingArtifacts.filter((item) => this.detectors.some((d) => d.flowId === item));
        if (missingFlows.length > 0) {
            return {
                canRun: false,
                missingPrerequisites: missingFlows,
                recommendedFlow: missingFlows[0],
                message: `Prerequisites not met. ${validation.message}`,
            };
        }
        return {
            canRun: false,
            missingPrerequisites: [],
            message: validation.message,
        };
    }
    getNextRecommendedFlow(currentFlowId, result) {
        // Record the flow execution in history
        this.orchestrator.recordFlowExecution(result);
        // Get next recommended flow
        return this.orchestrator.getNextRecommendedFlow(currentFlowId, result);
    }
    getCurrentPhase(context) {
        return this.orchestrator.detectPhase(context);
    }
    getRecommendedFlowSequence(context) {
        const phase = this.orchestrator.detectPhase(context);
        return this.orchestrator.recommendFlowSequence(phase);
    }
    getWorkflowProgress(context) {
        return this.orchestrator.getWorkflowRecommendation(context);
    }
    has(u, ...keywords) {
        return keywords.some((k) => u.includes(k));
    }
    hasAny(u, keywords) {
        return keywords.some((k) => u.includes(k));
    }
    hasNone(u, keywords) {
        return !keywords.some((k) => u.includes(k));
    }
    // TIER 1: STRATEGY/RESEARCH DETECTORS
    createFlowADetector() {
        return {
            flowId: 'flowA_brand_verify',
            score: (u) => {
                if (this.hasAny(u, ['brand', 'product.md', 'register', 'setup', 'verify', 'foundation', 'initialize'])) {
                    if (this.hasNone(u, ['design', 'component', 'implement'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlowBDetector() {
        return {
            flowId: 'flowB_component_research',
            score: (u) => {
                if (this.hasAny(u, ['component', 'gallery', 'research', 'patterns', 'examples', 'types', 'systems'])) {
                    if (this.hasNone(u, ['implement', 'build', 'design', 'code'])) {
                        return 0.8;
                    }
                }
                return 0;
            },
        };
    }
    createFlowCDetector() {
        return {
            flowId: 'flowC_font_research',
            score: (u) => {
                if (this.hasAny(u, ['font', 'typeface', 'fontshare', 'pairing', 'typography', 'weights'])) {
                    if (this.hasNone(u, ['design', 'implement', 'set font'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlowDDetector() {
        return {
            flowId: 'flowD_reference_inspiration',
            score: (u) => {
                if (this.hasAny(u, ['reference', 'inspiration', 'catalog', 'examples', 'curate', 'search'])) {
                    if (this.hasNone(u, ['implement', 'design', 'build'])) {
                        return 0.8;
                    }
                }
                return 0;
            },
        };
    }
    createFlowEDetector() {
        return {
            flowId: 'flowE_motion_patterns',
            score: (u) => {
                if (this.hasAny(u, ['motion', 'gsap', 'animation', 'scroll', 'lenis', 'scrolltrigger', 'flip', 'splittest', 'drawsvg'])) {
                    if (this.hasNone(u, ['implement', 'build', 'code'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    // TIER 2: EXECUTION DETECTORS
    createFlowFDetector() {
        return {
            flowId: 'flowF_design_tokens',
            score: (u) => {
                if (this.hasAny(u, ['token', 'design.md', 'extract', 'manage', 'lint', 'consistency'])) {
                    return 0.85;
                }
                return 0;
            },
        };
    }
    createFlowGDetector() {
        return {
            flowId: 'flowG_component_implementation',
            score: (u) => {
                // Direct implement/code keywords: high confidence
                if (this.hasAny(u, ['implement', 'code'])) {
                    if (this.hasNone(u, ['clone', 'exact'])) {
                        return 0.9;
                    }
                }
                // Build from source (mockup/figma/design/reference): T-0015 absorbed from flow10
                if (this.has(u, 'build') && this.hasAny(u, ['from', 'based on', 'mockup', 'figma', 'reference'])) {
                    return 0.85;
                }
                if (this.hasAny(u, ['component', 'variants', 'states', 'wire'])) {
                    if (this.hasNone(u, ['design', 'clone', 'exact'])) {
                        return 0.8;
                    }
                }
                return 0;
            },
        };
    }
    createFlowHDetector() {
        return {
            flowId: 'flowH_motion_integration',
            score: (u) => {
                if (this.hasAny(u, ['motion', 'animation', 'gsap', 'scrolltrigger', 'implement'])) {
                    if (this.hasAny(u, ['implement', 'code', 'integrate'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlowIDetector() {
        return {
            flowId: 'flowI_accessibility',
            score: (u) => {
                if (this.hasAny(u, ['accessible', 'a11y', 'wcag', 'screen reader', 'keyboard', 'aria'])) {
                    return 0.9;
                }
                return 0;
            },
        };
    }
    // TIER 3: POLISH/QA DETECTORS
    createFlowJDetector() {
        return {
            flowId: 'flowJ_tactical_polish',
            score: (u) => {
                // T-0015: absorbed flow2_polish_enhance matching (feel/animation/microinteraction/janky/life).
                // Excludes layout/hierarchy/cluttered which route to flowR.
                if (this.hasAny(u, ['polish', 'feel better', 'tactical', 'refinement', 'micro-interaction',
                    'feel', 'animation', 'microinteraction', 'janky', 'life'])) {
                    if (this.hasNone(u, ['audit', 'design', 'implement', 'layout', 'hierarchy',
                        'accessible', 'cluttered', 'reorganize', 'restructure'])) {
                        // Higher confidence for direct 'feel' keyword (specific to polish/enhance)
                        if (this.has(u, 'feel')) {
                            return 0.9;
                        }
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlowKDetector() {
        return {
            flowId: 'flowK_multi_lens_audit',
            score: (u) => {
                if (this.hasAny(u, ['audit', 'multi-lens', '5-dimension', 'technical', 'comprehensive', 'anti-pattern'])) {
                    return 0.85;
                }
                return 0;
            },
        };
    }
    createFlowLDetector() {
        return {
            flowId: 'flowL_design_critique',
            score: (u) => {
                if (this.hasAny(u, ['critique', 'review', 'heuristics', 'cognitive', 'emotional', 'quality'])) {
                    if (this.hasNone(u, ['implement', 'code'])) {
                        return 0.8;
                    }
                }
                return 0;
            },
        };
    }
    createFlowMDetector() {
        return {
            flowId: 'flowM_responsive_validation',
            score: (u) => {
                if (this.hasAny(u, ['responsive', 'breakpoint', 'touch target', 'viewport', 'validation'])) {
                    return 0.85;
                }
                return 0;
            },
        };
    }
    createFlowNDetector() {
        return {
            flowId: 'flowN_rapid_iteration_refined',
            score: (u) => {
                if (this.hasAny(u, ['iterate', 'rapid', 'round', 'variations', 'token', 'success', 'criteria'])) {
                    if (this.hasNone(u, ['explore', 'open-ended', 'discovery'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    // TIER 4: SPECIAL WORKFLOW DETECTORS
    createFlowODetector() {
        return {
            flowId: 'flowO_clone_match_special',
            score: (u) => {
                if (this.hasAny(u, ['pixel perfect', 'clone', 'steal', '1:1', 'exact', 'identical', 'byte-for-byte'])) {
                    return 0.9;
                }
                return 0;
            },
        };
    }
    createFlowPDetector() {
        return {
            flowId: 'flowP_constraint_design_special',
            score: (u) => {
                if (this.hasAny(u, ['constraint', 'under', 'limit', 'budget', 'scope', 'creative', 'given'])) {
                    if (this.hasNone(u, ['improve', 'refactor', 'layout'])) {
                        return 0.8;
                    }
                }
                return 0;
            },
        };
    }
    createFlowQDetector() {
        return {
            flowId: 'flowQ_migration_special',
            score: (u) => {
                // T-0015: absorbed flow14_migration matching. "refactor + api" routes here (the
                // strongest delta: API-breaking changes vs cosmetic layout refactors).
                if (this.has(u, 'refactor') && this.hasAny(u, ['api', 'breaking change'])) {
                    return 0.95;
                }
                if (this.hasAny(u, ['migrate', 'breaking', 'replace', 'upgrade', 'api', 'migration', 'dependencies'])) {
                    if (this.hasAny(u, ['breaking', 'migrate', 'api'])) {
                        return 0.9;
                    }
                }
                return 0;
            },
        };
    }
    // Tier 5: Specialized Refinement (NEW - v2.1.9 coverage)
    createFlowRDetector() {
        return {
            flowId: 'flowR_layout_optimization',
            score: (u) => {
                // T-0015: absorbed flow8_refactor_layout matching (cluttered/hierarchy/restructure/reorganize/refactor-without-api).
                if (this.hasAny(u, ['cluttered', 'restructure', 'reorganize', 'whitespace'])) {
                    if (this.hasNone(u, ['migrate', 'accessible'])) {
                        return 0.85;
                    }
                }
                // "refactor" without "api" routes here (api goes to flowQ).
                if (this.has(u, 'refactor') && this.hasNone(u, ['api', 'breaking'])) {
                    return 0.85;
                }
                if (this.hasAny(u, ['layout', 'spacing', 'rhythm', 'optimize', 'grid', 'hierarchy', 'refinement'])) {
                    if (this.hasAny(u, ['layout', 'spacing', 'grid']) && this.hasNone(u, ['design', 'implement'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlowSDetector() {
        return {
            flowId: 'flowS_typography_excellence',
            score: (u) => {
                if (this.hasAny(u, ['typography', 'typeset', 'font', 'hierarchy', 'readability', 'weight', 'sizing'])) {
                    if (this.hasAny(u, ['typography', 'typeset', 'font', 'hierarchy']) && this.hasNone(u, ['design', 'research'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlowTDetector() {
        return {
            flowId: 'flowT_ambitious_motion',
            score: (u) => {
                if (this.hasAny(u, ['overdrive', 'ambitious', 'physics', 'spring', 'scroll-driven', 'cinematic', 'shader'])) {
                    if (this.hasAny(u, ['overdrive', 'ambitious', 'physics', 'spring']) && this.hasNone(u, ['research', 'basic'])) {
                        return 0.9;
                    }
                }
                return 0;
            },
        };
    }
    // T-0015 (2026-05-28): legacy flow1..flow14 detectors removed as duplicates.
    // Their match conditions were folded into the canonical lettered detectors
    // (flowO/flowJ/flowK/flowP/flowR/flowI/flowG/flowF/flowM/flowN/flowQ).
    // The two unique flows (flow4 exploration, flow7 design-from-scratch) live on
    // as flowY and flowZ below.
    createFlowYDetector() {
        return {
            flowId: 'flowY_explore_discovery',
            score: (u) => {
                if (this.hasAny(u, ['explore', 'what if', 'experiment', 'discovery', 'brainstorm', 'try variations'])) {
                    if (this.hasNone(u, ['iterate', 'round', 'feedback', 'criteria'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlowZDetector() {
        return {
            flowId: 'flowZ_design_component',
            score: (u) => {
                const hasDesignKeyword = this.hasAny(u, ['design', 'create', 'build', 'new']);
                const hasComponentContext = this.hasAny(u, ['component', 'button', 'picker', 'modal', 'card', 'form', 'widget', 'banner', 'tooltip', 'sidebar', 'nav']);
                if (hasDesignKeyword && hasComponentContext) {
                    // Make sure it's not "from" a reference
                    if (this.hasNone(u, ['from', 'based on', 'implement', 'mockup', 'figma'])) {
                        return 0.9;
                    }
                }
                return 0;
            },
        };
    }
    // SPECIAL: CURATE & QA
    createFlowUDetector() {
        return {
            flowId: 'flowU_curate',
            score: (u) => {
                if (this.hasAny(u, ['curate', 'add reference', 'capture component', 'design reference', 'add to catalog'])) {
                    return 0.85;
                }
                return 0;
            },
        };
    }
    createFlowVDetector() {
        return {
            flowId: 'flowV_all_seven_qa',
            score: (u) => {
                if (this.hasAny(u, ['all-seven', 'all seven', 'comprehensive qa', 'full pipeline', 'end-to-end', 'qa pipeline', 'all tiers'])) {
                    return 0.9;
                }
                if (this.hasAny(u, ['qa', 'pipeline', 'full'])) {
                    if (this.hasAny(u, ['chain', 'all flows', 'tiers', 'comprehensive'])) {
                        return 0.8;
                    }
                }
                return 0;
            },
        };
    }
    createFlowWDetector() {
        return {
            flowId: 'flowW_landing_composition',
            score: (u) => {
                if (this.hasAny(u, ['landing', 'composition', 'compose'])) {
                    if (this.hasNone(u, ['research', 'reference', 'inspiration', 'component'])) {
                        return 0.8;
                    }
                }
                return 0;
            },
        };
    }
    createFlowXDetector() {
        return {
            flowId: 'flowX_copywriting',
            score: (u) => {
                if (this.hasAny(u, ['copywriting', 'copy', 'draft copy', 'headline', 'hero copy', 'section copy', 'marketing copy', 'tagline'])) {
                    if (this.hasNone(u, ['code', 'function', 'component'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
}
exports.IntentDetector = IntentDetector;
function createDetector() {
    return new IntentDetector();
}
//# sourceMappingURL=intent-detector.js.map