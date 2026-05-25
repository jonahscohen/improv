"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowIAccessibilityHandler = exports.FlowHMotionIntegrationHandler = exports.FlowGComponentImplementationHandler = exports.FlowFDesignTokensHandler = exports.FlowEMotionPatternsHandler = exports.FlowDReferenceSearchHandler = exports.FlowCFontResearchHandler = exports.FlowBComponentResearchHandler = exports.FlowABrandVerifyHandler = void 0;
const flow_handler_1 = require("./flow-handler");
const reference_data_1 = require("./reference-data");
// TIER 1: STRATEGY/RESEARCH FLOWS
/**
 * Flow A: Brand/PRODUCT.md Verification
 * Verify project has valid brand register before design work
 */
class FlowABrandVerifyHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowA_brand_verify');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Checking project brand foundation (PRODUCT.md)',
            guidance: [
                'Verify PRODUCT.md exists at project root with real content (not [TODO] placeholders)',
                'PRODUCT.md must include: register (brand vs product), users, brand personality, anti-references, strategic principles',
                'Run /sidecoach teach if PRODUCT.md is missing or incomplete',
                'All design work depends on a solid brand register',
            ],
            checklist: this.createChecklist([
                { label: 'PRODUCT.md exists at project root', required: true },
                { label: 'Contains brand register section', required: true },
                { label: 'Defines target users', required: true },
                { label: 'Brand personality documented', required: true },
                { label: 'Anti-references listed', required: false },
                { label: 'Strategic principles stated', required: true },
            ]),
        };
    }
}
exports.FlowABrandVerifyHandler = FlowABrandVerifyHandler;
/**
 * Flow B: Component Research (component.gallery)
 * Research component patterns and implementations (60 types, 95 systems)
 */
class FlowBComponentResearchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowB_component_research');
        this.refData = (0, reference_data_1.createReferenceDataService)();
    }
    async execute(context) {
        const componentTypes = this.refData.getComponentTypes();
        const categoryCounts = {};
        // Count components by type
        for (const type of componentTypes) {
            const component = this.refData.getComponent(type);
            if (component) {
                const cat = component.type;
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            }
        }
        const categories = Object.entries(categoryCounts)
            .map(([cat, count]) => `${cat} (${count})`)
            .join(', ');
        const sampleComponents = componentTypes.slice(0, 4).map((type) => {
            const component = this.refData.getComponent(type);
            if (!component)
                return null;
            const constraints = component.constraints ? component.constraints.slice(0, 1).join('; ') : '';
            return `${component.name}: ${component.description}${constraints ? ' [' + constraints + ']' : ''}`;
        }).filter(Boolean);
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: `Researching component patterns: ${componentTypes.length} types indexed`,
            guidance: [
                `Component.gallery has ${componentTypes.length} core patterns across 7 categories`,
                `Category distribution: ${categories}`,
                'Search by component name (button, modal, table, etc.) or use case (login form, payment, navigation)',
                'Each component includes: accessibility baseline, implementation guidance, variants, and constraints',
                'Common patterns: action buttons, form inputs, modals, navigation, data tables, tooltips',
                'Sample components: ' + sampleComponents.join('; '),
                'Look for constraints that apply to your brand or product type (hit areas, animation, contrast)',
            ],
            checklist: this.createChecklist([
                { label: 'Identify required component type(s)', required: true },
                { label: 'Check accessibility baseline for each component', required: true },
                { label: 'Review variants and states available', required: true },
                { label: 'Note constraints (hit areas, animation, contrast)', required: false },
                { label: 'Check implementation guidance for your tech stack', required: false },
            ]),
        };
    }
}
exports.FlowBComponentResearchHandler = FlowBComponentResearchHandler;
/**
 * Flow C: Font Research (fontshare.com)
 * Research typefaces and pairing against brand personality
 */
class FlowCFontResearchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowC_font_research');
        this.refData = (0, reference_data_1.createReferenceDataService)();
    }
    async execute(context) {
        const fontNames = this.refData.getFontNames();
        const sampleFonts = fontNames.slice(0, 3).map((name) => {
            const font = this.refData.getFont(name);
            const pairing = this.refData.getFontPairing(name);
            return font ? `${font.name} (${font.personality.join(', ')}) pairs with ${pairing}` : null;
        }).filter(Boolean);
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Researching typefaces and pairings on fontshare.com',
            guidance: [
                `${fontNames.length} curated typefaces available with open licensing`,
                'Available fonts: ' + fontNames.join(', '),
                'Search by personality keywords: friendly, professional, playful, minimal, elegant, technical',
                'Sample pairings: ' + sampleFonts.join('; '),
                'For each candidate, check available weights and licensing for your use case',
                'Test pairing (heading + body) against your brand personality',
                'Verify font licensing supports your project scope (web, print, commercial, etc.)',
            ],
            checklist: this.createChecklist([
                { label: 'Search fontshare by brand personality keywords', required: true },
                { label: 'Shortlist 3+ candidate typefaces', required: true },
                { label: 'Check available weights and variants', required: true },
                { label: 'Test pairing (heading + body combinations)', required: false },
                { label: 'Verify licensing for your project type', required: true },
            ]),
        };
    }
}
exports.FlowCFontResearchHandler = FlowCFontResearchHandler;
/**
 * Flow D: Reference/Inspiration Search (design-references)
 * Search personal design reference catalog for patterns and inspiration
 */
class FlowDReferenceSearchHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowD_reference_inspiration');
        this.refData = (0, reference_data_1.createReferenceDataService)();
    }
    async execute(context) {
        const allReferences = this.refData.getAllDesignReferences();
        const categories = [...new Set(allReferences.map((r) => r.category))];
        const sampleRefs = allReferences.slice(0, 3).map((r) => `${r.title} (${r.category})`);
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Searching design reference catalog for inspiration',
            guidance: [
                `Personal design-references catalog contains ${allReferences.length} curated examples and patterns`,
                allReferences.length > 0
                    ? `Available categories: ${categories.join(', ')}`
                    : 'No design references indexed yet. Add examples to ~/.claude/design-references/',
                'Search by design concept: layout, navigation, forms, cards, etc.',
                'Examine how different design systems solve similar problems',
                'Capture color palettes, typography choices, spacing patterns',
                allReferences.length > 0 ? `Sample references: ${sampleRefs.join('; ')}` : '',
                'Note interaction patterns and animations that resonate',
            ].filter(Boolean),
            checklist: this.createChecklist([
                { label: 'Define design problem or pattern to solve', required: true },
                { label: 'Search reference catalog for examples', required: true },
                { label: 'Analyze 3+ implementations for common patterns', required: true },
                { label: 'Capture inspiration: colors, spacing, typography', required: false },
                { label: 'Note interaction patterns and animations', required: false },
            ]),
        };
    }
}
exports.FlowDReferenceSearchHandler = FlowDReferenceSearchHandler;
/**
 * Flow E: Motion Pattern Library (GSAP/Lenis)
 * Research motion patterns and animation techniques
 */
class FlowEMotionPatternsHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowE_motion_patterns');
        this.refData = (0, reference_data_1.createReferenceDataService)();
    }
    async execute(context) {
        const allPatterns = this.refData.getAllMotionPatterns();
        const entrancePatterns = this.refData.searchMotionPatterns('entrance');
        const scrollPatterns = this.refData.searchMotionPatterns('scroll');
        const samplePatterns = allPatterns.slice(0, 3).map((p) => `${p.name} (${p.category})`);
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: `Researching motion patterns: ${allPatterns.length} patterns indexed (GSAP + Lenis)`,
            guidance: [
                `${allPatterns.length} production-ready motion patterns available`,
                'GSAP is the production animation library; Lenis handles smooth scrolling',
                `Entrance patterns (${entrancePatterns.length}): ${entrancePatterns.map((p) => p.name).join(', ')}`,
                `Scroll patterns (${scrollPatterns.length}): ${scrollPatterns.map((p) => p.name).join(', ')}`,
                'Available techniques: basic tweens, ScrollTrigger (scroll-linked), Flip (spatial animations), SplitText (character/word), DrawSVG (line drawing)',
                'ScrollTrigger patterns: parallax, reveal on scroll, pinning, progress bars',
                'Flip patterns: spatial transitions, element morphing',
                'SplitText: staggered character/word reveals for dramatic effect',
            ],
            checklist: this.createChecklist([
                { label: 'Identify required animation effect', required: true },
                { label: 'Choose GSAP technique (tween, ScrollTrigger, Flip, SplitText, DrawSVG)', required: true },
                { label: 'Research examples of chosen technique', required: true },
                { label: 'Plan easing function and duration', required: false },
                { label: 'Consider performance implications (especially scroll animations)', required: true },
            ]),
        };
    }
}
exports.FlowEMotionPatternsHandler = FlowEMotionPatternsHandler;
// TIER 2: EXECUTION FLOWS
/**
 * Flow F: Design System Tokens (DESIGN.md)
 * Full DESIGN.md workflow - extract, manage, lint tokens (google-labs-code spec)
 */
class FlowFDesignTokensHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowF_design_tokens');
        this.refData = (0, reference_data_1.createReferenceDataService)();
    }
    async execute(context) {
        const tokens = this.refData.getDesignTokens();
        const sections = Object.keys(tokens);
        const hasSections = sections.length > 0;
        const sampleTokens = hasSections
            ? sections.slice(0, 3).map((s) => `${s} (${Object.keys(tokens[s]).length} tokens)`)
            : [];
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: hasSections
                ? `Design tokens loaded: ${sections.length} sections indexed`
                : 'Waiting for DESIGN.md - no tokens loaded yet',
            guidance: [
                'DESIGN.md is the single source of truth for design tokens: colors, typography, spacing, components',
                'Use google-labs-code spec format: YAML frontmatter for tokens, markdown prose body for rationale',
                hasSections
                    ? `Token sections available: ${sections.join(', ')}`
                    : 'Create DESIGN.md at project root with colors, typography, spacing, rounded, shadow, motion',
                'All implementation code must reference tokens via {path.to.token} form, never hardcoded hex values',
                'Run npx @google/design.md lint DESIGN.md and fix all errors/warnings before committing',
                'Update DESIGN.md whenever design system changes; implementation pulls from it',
                hasSections ? `Sample tokens: ${sampleTokens.join('; ')}` : '',
            ].filter(Boolean),
            checklist: this.createChecklist([
                { label: 'Check DESIGN.md exists with real token content', required: true },
                { label: 'Verify YAML frontmatter has colors, typography, spacing, components', required: true },
                { label: 'Run npx @google/design.md lint and resolve all errors', required: true },
                { label: 'Verify implementation uses {token.path} references', required: true },
                { label: 'Update DESIGN.md when design system changes', required: false },
            ]),
        };
    }
}
exports.FlowFDesignTokensHandler = FlowFDesignTokensHandler;
/**
 * Flow G: Component Implementation
 * Map design spec to implementation, wire variants, states, responsive behavior
 */
class FlowGComponentImplementationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowG_component_implementation');
        this.refData = (0, reference_data_1.createReferenceDataService)();
    }
    async execute(context) {
        // Extract component name from context if available
        const componentName = context.metadata?.componentName || 'button';
        const template = this.refData.generateComponentTemplate(componentName);
        const component = this.refData.getComponent(componentName);
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: `Implementing component: ${component?.name || componentName}`,
            guidance: [
                'Start with design source (Figma, sketch, DESIGN.md) and extract all states/variants',
                component
                    ? `Variants to implement: ${component.variants.join(', ')}`
                    : 'Define component variants (primary, secondary, etc.)',
                component ? `Accessibility baseline: ${component.accessibility}` : 'Ensure WCAG 2.1 AA compliance',
                'Build component props to handle each variant and state',
                'Test responsive behavior: desktop, tablet, mobile viewports',
                'Verify side-by-side with design source before moving to next component',
                'Document component API and usage examples',
                template ? 'Use provided HTML/CSS scaffolds as starting point' : '',
            ].filter(Boolean),
            checklist: this.createChecklist([
                { label: `Extract all states/variants from design (${component?.variants.length || '3+'} total)`, required: true },
                { label: 'Create semantic HTML structure with BEM naming', required: true },
                { label: 'Implement component props/API for variants', required: true },
                { label: 'Test responsive behavior: desktop, tablet, mobile', required: true },
                { label: 'Compare side-by-side with design source', required: true },
                { label: `Check accessibility: ${component?.accessibility || 'keyboard nav, ARIA labels'}`, required: true },
                { label: 'Document component API and usage examples', required: false },
            ]),
        };
    }
}
exports.FlowGComponentImplementationHandler = FlowGComponentImplementationHandler;
/**
 * Flow H: Motion Integration (GSAP/Lenis)
 * Implement production-ready motion - tweens, ScrollTrigger, Flip, SplitText, DrawSVG
 */
class FlowHMotionIntegrationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowH_motion_integration');
        this.refData = (0, reference_data_1.createReferenceDataService)();
    }
    async execute(context) {
        // Extract motion pattern from context if available
        const patternName = context.metadata?.motionPattern || 'fade_in';
        const pattern = this.refData.getMotionPattern(patternName);
        const template = pattern ? this.refData.generateMotionTemplate(patternName) : null;
        const allPatterns = this.refData.getAllMotionPatterns();
        const entrancePatterns = this.refData.searchMotionPatterns('entrance').length;
        const scrollPatterns = this.refData.searchMotionPatterns('scroll').length;
        const interactivePatterns = this.refData.searchMotionPatterns('interactive').length;
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: `Motion integration: ${allPatterns.length} patterns available`,
            guidance: [
                'Use GSAP for all animations (tweens, ScrollTrigger, Flip, SplitText, DrawSVG)',
                `Available patterns: ${entrancePatterns} entrance, ${scrollPatterns} scroll, ${interactivePatterns} interactive`,
                pattern
                    ? `Selected pattern: ${pattern.name} (${pattern.category}) - Performance: ${pattern.performance}`
                    : 'Choose from entrance (6), scroll (4), layout (3), text (2), path (2), interactive (2) patterns',
                'For smooth scrolling, integrate Lenis and configure ScrollTrigger.normalizeScroll(true)',
                'Consider performance: use will-change sparingly, avoid animate-all, monitor 60 FPS target',
                'Test on actual devices (not just desktop) for smooth playback',
                'Ensure animations are interruptible (don\'t block user interactions)',
            ].filter(Boolean),
            checklist: this.createChecklist([
                { label: `Choose GSAP technique: ${pattern?.category || 'entrance/scroll/layout/text/path/interactive'}`, required: true },
                { label: 'Implement animation code using provided template', required: true },
                { label: 'If using scroll, integrate Lenis and ScrollTrigger.normalizeScroll(true)', required: false },
                { label: `Test animation smoothness on device (${pattern?.performance || 'minimal'} perf tier)`, required: true },
                { label: 'Verify animations are interruptible (allow user cancellation)', required: true },
                { label: 'Verify performance: 60 FPS target, no jank on low-end devices', required: true },
            ]),
        };
    }
}
exports.FlowHMotionIntegrationHandler = FlowHMotionIntegrationHandler;
/**
 * Flow I: Accessibility Compliance (WCAG 2.1 AA)
 * WCAG 2.1 AA validation, screen reader testing, severity prioritization
 */
class FlowIAccessibilityHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowI_accessibility');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'WCAG 2.1 AA accessibility validation and screen reader testing',
            guidance: [
                'Target: WCAG 2.1 Level AA compliance (required accessibility standard)',
                'Test with screen readers: VoiceOver (macOS), NVDA (Windows)',
                'Check semantic HTML, heading hierarchy, ARIA labels, color contrast, keyboard navigation',
                'Prioritize fixes by severity: Critical (blocks core function) > High (significantly impacts experience) > Medium > Low',
                'Document all a11y test results and fixes',
            ],
            checklist: this.createChecklist([
                { label: 'Run automated a11y audit (axe, Lighthouse)', required: true },
                { label: 'Test with screen reader (VoiceOver/NVDA)', required: true },
                { label: 'Check heading hierarchy and semantic HTML', required: true },
                { label: 'Verify ARIA labels and descriptions where needed', required: true },
                { label: 'Check color contrast ratios (4.5:1 min for text)', required: true },
                { label: 'Verify keyboard navigation (all interactive elements)', required: true },
                { label: 'Fix all Critical and High severity issues', required: true },
            ]),
        };
    }
}
exports.FlowIAccessibilityHandler = FlowIAccessibilityHandler;
//# sourceMappingURL=flow-handlers-new-tiers.js.map