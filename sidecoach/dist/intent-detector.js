"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentDetector = void 0;
exports.createDetector = createDetector;
const flows_1 = require("./flows");
class IntentDetector {
    constructor() {
        this.detectors = [
            this.createFlow1Detector(),
            this.createFlow2Detector(),
            this.createFlow3Detector(),
            this.createFlow4Detector(),
            this.createFlow5Detector(),
            this.createFlow6Detector(),
            this.createFlow7Detector(),
            this.createFlow8Detector(),
            this.createFlow9Detector(),
            this.createFlow10Detector(),
            this.createFlow11Detector(),
            this.createFlow12Detector(),
            this.createFlow13Detector(),
            this.createFlow14Detector(),
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
        return {
            candidates: matches.slice(0, 3),
            isAmbiguous: matches[0].confidence < 0.9 || matches.length > 1,
            recommendation: matches[0],
            clarificationNeeded: matches.length > 1 ? `Did you mean ${matches[0].flowName}?` : undefined,
        };
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
    createFlow1Detector() {
        return {
            flowId: 'flow1_clone_match',
            score: (u) => {
                if (this.hasAny(u, ['match', 'steal', 'clone', '1:1', 'exact', 'identical', 'copy precisely'])) {
                    if (this.hasNone(u, ['implement', 'build from', 'design'])) {
                        return 0.9;
                    }
                }
                return 0;
            },
        };
    }
    createFlow2Detector() {
        return {
            flowId: 'flow2_polish_enhance',
            score: (u) => {
                if (this.hasAny(u, ['feel', 'polish', 'animation', 'microinteraction', 'janky', 'life', 'experience'])) {
                    if (this.hasNone(u, ['layout', 'hierarchy', 'accessible', 'cluttered', 'reorganize', 'restructure'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlow3Detector() {
        return {
            flowId: 'flow3_audit_page',
            score: (u) => {
                if (this.hasAny(u, ['audit', 'find issues', 'scan', 'what\'s wrong'])) {
                    if (this.hasNone(u, ['accessible', 'a11y', 'wcag'])) {
                        return 0.85;
                    }
                }
                return 0;
            },
        };
    }
    createFlow4Detector() {
        return {
            flowId: 'flow4_explore_discovery',
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
    createFlow5Detector() {
        return {
            flowId: 'flow5_review_qa',
            score: (u) => {
                if (this.hasAny(u, ['review', 'code review', 'comprehensive', 'QA'])) {
                    return 0.8;
                }
                return 0;
            },
        };
    }
    createFlow6Detector() {
        return {
            flowId: 'flow6_constraint_design',
            score: (u) => {
                if (this.hasAny(u, ['design for', 'design with', 'optimize given', 'under', 'respecting', 'constraint'])) {
                    // Make sure it's actually a constraint context
                    if (this.hasAny(u, ['mobile', 'performance', 'wcag', 'keyboard', 'limit', 'budget'])) {
                        return 0.8;
                    }
                }
                return 0;
            },
        };
    }
    createFlow7Detector() {
        return {
            flowId: 'flow7_design_component',
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
    createFlow8Detector() {
        return {
            flowId: 'flow8_refactor_layout',
            score: (u) => {
                if (this.hasAny(u, ['refactor', 'cluttered', 'hierarchy', 'layout', 'restructure', 'reorganize', 'clearer', 'whitespace'])) {
                    if (this.hasNone(u, ['migrate', 'accessible', 'responsive'])) {
                        // "refactor" without "api" keyword -> assume layout refactor
                        if (this.has(u, 'refactor') && this.hasNone(u, ['api'])) {
                            return 0.75;
                        }
                        // Other layout keywords
                        if (this.hasAny(u, ['cluttered', 'hierarchy', 'layout', 'restructure', 'reorganize', 'clearer'])) {
                            return 0.85;
                        }
                    }
                }
                return 0;
            },
        };
    }
    createFlow9Detector() {
        return {
            flowId: 'flow9_accessible',
            score: (u) => {
                if (this.hasAny(u, ['accessible', 'a11y', 'wcag', 'screen reader', 'keyboard', 'aria'])) {
                    return 0.9;
                }
                return 0;
            },
        };
    }
    createFlow10Detector() {
        return {
            flowId: 'flow10_implement_design',
            score: (u) => {
                const hasImplementKeyword = this.hasAny(u, ['implement', 'code', 'build']);
                const hasSource = this.hasAny(u, ['from', 'based on', 'mockup', 'figma', 'design', 'reference']);
                if (this.has(u, 'implement') || this.has(u, 'code')) {
                    return 0.9;
                }
                if (hasImplementKeyword && hasSource) {
                    return 0.85;
                }
                return 0;
            },
        };
    }
    createFlow11Detector() {
        return {
            flowId: 'flow11_extract_tokens',
            score: (u) => {
                if (this.hasAny(u, ['extract', 'token', 'reusable', 'standardize', 'repeating'])) {
                    return 0.8;
                }
                return 0;
            },
        };
    }
    createFlow12Detector() {
        return {
            flowId: 'flow12_responsive_review',
            score: (u) => {
                if (this.hasAny(u, ['responsive', 'breakpoint', 'mobile', 'tablet', 'desktop', 'screen sizes'])) {
                    return 0.85;
                }
                return 0;
            },
        };
    }
    createFlow13Detector() {
        return {
            flowId: 'flow13_rapid_iteration',
            score: (u) => {
                if (this.hasAny(u, ['iterate', 'refine', 'round', 'cycle', 'try variations'])) {
                    if (this.hasAny(u, ['feedback', 'criteria', 'round'])) {
                        return 0.9;
                    }
                    return 0.7;
                }
                return 0;
            },
        };
    }
    createFlow14Detector() {
        return {
            flowId: 'flow14_migration',
            score: (u) => {
                // High confidence if has strong migration keywords
                if (this.hasAny(u, ['migrate', 'api', 'breaking change', 'replace', 'upgrade'])) {
                    if (this.hasAny(u, ['api', 'breaking change', 'migrate'])) {
                        return 0.9;
                    }
                }
                // "refactor" alone is ambiguous - need API context
                if (this.has(u, 'refactor') && this.hasAny(u, ['api', 'breaking change'])) {
                    return 0.8;
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