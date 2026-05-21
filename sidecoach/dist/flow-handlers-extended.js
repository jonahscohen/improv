"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Flow14MigrationHandler = exports.Flow13IterateHandler = exports.Flow12ResponsiveHandler = exports.Flow11ExtractHandler = exports.Flow9AccessibleHandler = exports.Flow8RefactorHandler = exports.Flow6ConstraintHandler = exports.Flow4ExploreHandler = exports.Flow3AuditHandler = exports.Flow1CloneHandler = void 0;
const flow_handler_1 = require("./flow-handler");
/**
 * Flow 1: Clone/Match from Reference
 * Exact 1:1 replication from design source
 */
class Flow1CloneHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow1_clone_match');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Clone/Match workflow - 1:1 Exact Replication',
            guidance: [
                'This is a pixel-perfect, 1:1 replication task',
                'Every detail from the source must be matched exactly: typography, colors, spacing, icons, animations',
                'No interpretation, approximation, or simplification allowed',
                'Use side-by-side comparison to verify each element',
                'Test all interactive states (hover, press, focus, disabled)',
            ],
            checklist: this.getCloneChecklist(),
            nextSteps: [
                'Extract element from design source (Figma, screenshot, etc.)',
                'List all visual properties: colors, typography, spacing, borders, shadows',
                'List all states: hover, active, focus, disabled, loading, error',
                'Implement each property exactly',
                'Take screenshot of your implementation',
                'Place screenshot alongside source image',
                'Check every pixel: colors match, spacing identical, typography exact',
                'Verify all states match source',
                'Iterate until 100% match achieved',
            ],
        };
    }
    getCloneChecklist() {
        return [
            {
                id: 'source-extract',
                label: 'Extract complete element from source',
                required: true,
                description: 'Get the exact element with all surrounding context from design source',
                completed: false,
            },
            {
                id: 'colors-exact',
                label: 'Colors: exact hex/RGB match',
                required: true,
                description: 'Every color must match source exactly (use color picker to verify)',
                completed: false,
            },
            {
                id: 'typography-exact',
                label: 'Typography: font, weight, size, line-height, letter-spacing',
                required: true,
                description: 'All typography properties must match precisely',
                completed: false,
            },
            {
                id: 'spacing-exact',
                label: 'Spacing: padding, margin, gaps all identical',
                required: true,
                description: 'Measure spacing in source and match exactly',
                completed: false,
            },
            {
                id: 'borders-shadows',
                label: 'Borders, shadows, strokes match source',
                required: true,
                description: 'All effects must be replicated exactly',
                completed: false,
            },
            {
                id: 'icons-exact',
                label: 'Icons sourced verbatim from same library',
                required: true,
                description: 'Use exact same icon library and paths (no approximation)',
                completed: false,
            },
            {
                id: 'state-hover',
                label: 'State: hover (if present in source)',
                required: false,
                description: 'Match hover state exactly',
                completed: false,
            },
            {
                id: 'state-active',
                label: 'State: active/pressed (if present)',
                required: false,
                description: 'Match active state exactly',
                completed: false,
            },
            {
                id: 'state-focus',
                label: 'State: focus indicator (if present)',
                required: false,
                description: 'Match focus state exactly',
                completed: false,
            },
            {
                id: 'state-disabled',
                label: 'State: disabled (if present)',
                required: false,
                description: 'Match disabled state exactly',
                completed: false,
            },
            {
                id: 'screenshot-compare',
                label: 'Side-by-side screenshot comparison',
                required: true,
                description: 'Place implementation screenshot next to source and verify pixel-perfect match',
                completed: false,
            },
            {
                id: 'responsive-test',
                label: 'Test on actual device/viewport',
                required: true,
                description: 'Verify the element looks correct in real browser/device context',
                completed: false,
            },
        ];
    }
}
exports.Flow1CloneHandler = Flow1CloneHandler;
/**
 * Flow 3: Audit Page/Section
 * Identify and report issues without fixing
 */
class Flow3AuditHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow3_audit_page');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Technical Audit - Issue Discovery Only',
            guidance: [
                'This flow audits for issues WITHOUT suggesting fixes',
                'Report what you find: severity, location, description',
                'Do NOT propose solutions - just identify problems',
                'Focus on technical issues: accessibility, performance, structure',
                'Be thorough but concise in reporting',
            ],
            checklist: this.getAuditChecklist(),
            nextSteps: [
                'Load the page/section in browser',
                'Review accessibility: missing alt text, poor contrast, no keyboard nav',
                'Check performance: large images, slow rendering, network waterfalls',
                'Scan structure: missing hierarchy, unclear sections, poor organization',
                'Look for anti-patterns: hardcoded values, missing states, broken responsive',
                'Report each issue with severity (Critical, High, Medium, Low)',
                'List issues in priority order',
                'Do not implement fixes - report only',
            ],
        };
    }
    getAuditChecklist() {
        return [
            {
                id: 'a11y-issues',
                label: 'Scan for accessibility issues',
                required: true,
                description: 'Missing alt text, color contrast, keyboard navigation, ARIA attributes',
                completed: false,
            },
            {
                id: 'perf-issues',
                label: 'Identify performance bottlenecks',
                required: true,
                description: 'Large assets, render blocking, inefficient layouts, unoptimized images',
                completed: false,
            },
            {
                id: 'structure-issues',
                label: 'Review semantic structure',
                required: true,
                description: 'Hierarchy clarity, section organization, navigation structure',
                completed: false,
            },
            {
                id: 'responsive-issues',
                label: 'Test responsive behavior',
                required: true,
                description: 'Layout issues at different breakpoints, overflow, touch targets',
                completed: false,
            },
            {
                id: 'visual-issues',
                label: 'Look for visual inconsistencies',
                required: false,
                description: 'Typography, spacing, color usage, alignment problems',
                completed: false,
            },
            {
                id: 'issue-report',
                label: 'Create comprehensive issue list',
                required: true,
                description: 'Format: [Severity] [Location] [Issue description]',
                completed: false,
            },
        ];
    }
}
exports.Flow3AuditHandler = Flow3AuditHandler;
/**
 * Flow 4: Exploration/Discovery Mode
 * Open-ended exploration without success criteria
 */
class Flow4ExploreHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow4_explore_discovery');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Entering Exploration/Discovery Mode - Open-Ended Brainstorming',
            guidance: [
                'This is an open-ended exploration with no success criteria',
                'Goal: generate ideas and variations without judgment',
                'Try multiple directions, not just one "best" answer',
                'Document what you learn, not just what works',
                'Keep experiments and dead ends - learning is the goal',
            ],
            checklist: this.getExploreChecklist(),
            nextSteps: [
                'Define the aspect being explored (e.g., color palette, layout approach, interaction pattern)',
                'Generate 3-5 distinct variations or approaches',
                'For each variation: screenshot, describe thinking, note tradeoffs',
                'Explore different directions: contrast vs harmony, minimalist vs rich, etc.',
                'Document learnings: what surprised you, what feels right, what doesn\'t',
                'No need to pick a "winner" - the exploration itself is the goal',
                'Review findings and reflect on what you discovered',
            ],
        };
    }
    getExploreChecklist() {
        return [
            {
                id: 'aspect-defined',
                label: 'Define what aspect is being explored',
                required: true,
                description: 'What are you trying to understand or generate ideas about?',
                completed: false,
            },
            {
                id: 'variation-1',
                label: 'Direction 1: First variation/approach',
                required: true,
                description: 'Create and document first exploration direction',
                completed: false,
            },
            {
                id: 'variation-2',
                label: 'Direction 2: Contrasting variation',
                required: true,
                description: 'Try a different direction to expand the solution space',
                completed: false,
            },
            {
                id: 'variation-3',
                label: 'Direction 3: Third variation',
                required: true,
                description: 'Push further into the exploration space',
                completed: false,
            },
            {
                id: 'each-documented',
                label: 'Each variation documented with screenshot and rationale',
                required: true,
                description: 'Take screenshots and note thinking for each direction',
                completed: false,
            },
            {
                id: 'tradeoffs-noted',
                label: 'Note tradeoffs and constraints for each approach',
                required: false,
                description: 'What works well, what\'s limited, what surprised you',
                completed: false,
            },
            {
                id: 'learnings-captured',
                label: 'Capture learnings and insights',
                required: true,
                description: 'What did you discover? What changed your thinking?',
                completed: false,
            },
        ];
    }
}
exports.Flow4ExploreHandler = Flow4ExploreHandler;
/**
 * Flow 6: Constraint-Based Design
 * Design under explicit constraints or limits
 */
class Flow6ConstraintHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow6_constraint_design');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Constraint-Based Design Workflow',
            guidance: [
                'Design with explicit constraints or limits',
                'Constraints drive creative solutions - embrace them',
                'Verify the solution works within all stated constraints',
                'Test edge cases and boundary conditions',
                'Document how the solution respects each constraint',
            ],
            checklist: this.getConstraintChecklist(),
            nextSteps: [
                'List all constraints clearly (e.g., color palette, character limit, max width)',
                'Understand WHY each constraint exists',
                'Generate design solution respecting all constraints',
                'Test against each constraint: does it still fit?',
                'Try variations that push the limits creatively',
                'Verify final solution meets all constraints',
                'Document tradeoffs made due to constraints',
            ],
        };
    }
    getConstraintChecklist() {
        return [
            {
                id: 'constraints-listed',
                label: 'All constraints documented clearly',
                required: true,
                description: 'List every constraint: technical, design, business, scope',
                completed: false,
            },
            {
                id: 'constraint-rationale',
                label: 'Understand rationale for each constraint',
                required: true,
                description: 'Why does this constraint exist? What does it protect?',
                completed: false,
            },
            {
                id: 'design-created',
                label: 'Create design solution respecting constraints',
                required: true,
                description: 'Design that works within all stated limits',
                completed: false,
            },
            {
                id: 'constraint-test-1',
                label: 'Test solution against constraint 1',
                required: true,
                description: 'Verify design meets this constraint',
                completed: false,
            },
            {
                id: 'constraint-test-2',
                label: 'Test solution against constraint 2',
                required: true,
                description: 'Verify design meets this constraint',
                completed: false,
            },
            {
                id: 'constraint-edge-cases',
                label: 'Test edge cases and boundary conditions',
                required: true,
                description: 'What happens at the limits? Does solution still work?',
                completed: false,
            },
            {
                id: 'creative-variations',
                label: 'Explore creative uses of constraints',
                required: false,
                description: 'Can constraints become design features rather than limitations?',
                completed: false,
            },
            {
                id: 'tradeoffs-documented',
                label: 'Document tradeoffs made due to constraints',
                required: true,
                description: 'What did you give up? What did you gain?',
                completed: false,
            },
        ];
    }
}
exports.Flow6ConstraintHandler = Flow6ConstraintHandler;
/**
 * Flow 8: Refactor/Improve Section
 * Improve structure, hierarchy, and whitespace
 */
class Flow8RefactorHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow8_refactor_layout');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Layout Refactor/Improve Workflow',
            guidance: [
                'Focus on structure, hierarchy, and whitespace',
                'Improve clarity: what is this section about? What are the key actions?',
                'Better hierarchy: guide attention to important elements',
                'Better whitespace: group related items, create visual breathing room',
                'Keep content, improve organization and presentation',
            ],
            checklist: this.getRefactorChecklist(),
            nextSteps: [
                'Analyze current layout: What feels cluttered or unclear?',
                'Identify key content and actions in the section',
                'Sketch improved hierarchy: primary, secondary, tertiary content',
                'Plan whitespace: where should things be grouped or separated?',
                'Implement structural changes (grouping, ordering, nesting)',
                'Add appropriate whitespace and breathing room',
                'Verify hierarchy now guides attention correctly',
                'Test responsive behavior of new structure',
            ],
        };
    }
    getRefactorChecklist() {
        return [
            {
                id: 'current-analyze',
                label: 'Analyze current layout and identify pain points',
                required: true,
                description: 'What feels cluttered? What\'s unclear? What\'s hard to scan?',
                completed: false,
            },
            {
                id: 'content-inventory',
                label: 'Inventory content and prioritize',
                required: true,
                description: 'What\'s primary content? Secondary? Nice-to-have?',
                completed: false,
            },
            {
                id: 'hierarchy-sketch',
                label: 'Sketch improved information hierarchy',
                required: true,
                description: 'Draw or describe the improved structure',
                completed: false,
            },
            {
                id: 'grouping-plan',
                label: 'Plan grouping and whitespace',
                required: true,
                description: 'How should related items be grouped? Where should there be breathing room?',
                completed: false,
            },
            {
                id: 'impl-structure',
                label: 'Implement structural changes',
                required: true,
                description: 'Reorganize elements, change nesting, improve ordering',
                completed: false,
            },
            {
                id: 'impl-spacing',
                label: 'Add whitespace and improve breathing',
                required: true,
                description: 'Adjust margins, padding, gaps between sections',
                completed: false,
            },
            {
                id: 'hierarchy-verify',
                label: 'Verify new hierarchy guides attention correctly',
                required: true,
                description: 'Does the eye go where you want it to?',
                completed: false,
            },
            {
                id: 'responsive-test',
                label: 'Test improved structure at multiple breakpoints',
                required: true,
                description: 'Does new layout work on mobile, tablet, desktop?',
                completed: false,
            },
        ];
    }
}
exports.Flow8RefactorHandler = Flow8RefactorHandler;
/**
 * Flow 9: Make Accessible
 * Ensure WCAG compliance and accessibility standards
 */
class Flow9AccessibleHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow9_accessible');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Accessibility/WCAG Compliance Workflow',
            guidance: [
                'Target: WCAG 2.1 AA compliance as minimum',
                'Test with real assistive technology: VoiceOver, NVDA, screen readers',
                'Keyboard navigation must be complete and intuitive',
                'Color contrast must meet 4.5:1 for normal text',
                'All interactive elements need proper ARIA and semantic HTML',
            ],
            checklist: this.getAccessibilityChecklist(),
            nextSteps: [
                'Test with VoiceOver (Mac) or NVDA (Windows)',
                'Navigate entire page using only keyboard (Tab, Enter, Arrow keys)',
                'Check color contrast: 4.5:1 for text, 3:1 for graphics',
                'Verify all images have alt text',
                'Check form labels and error messages',
                'Verify focus indicators are visible',
                'Test with browser zoom at 200%',
                'Run automated WCAG checker (WebAIM, Axe DevTools)',
                'Address all Critical and High priority findings',
            ],
        };
    }
    getAccessibilityChecklist() {
        return [
            {
                id: 'sr-test',
                label: 'Screen reader testing (VoiceOver/NVDA)',
                required: true,
                description: 'Test with real screen reader, navigate entire page',
                completed: false,
            },
            {
                id: 'keyboard-nav',
                label: 'Keyboard navigation complete',
                required: true,
                description: 'Tab through all interactive elements, can reach everything',
                completed: false,
            },
            {
                id: 'focus-visible',
                label: 'Focus indicators always visible',
                required: true,
                description: 'Clear visual indicator of keyboard focus',
                completed: false,
            },
            {
                id: 'color-contrast',
                label: 'Color contrast WCAG AA (4.5:1)',
                required: true,
                description: 'All text meets 4.5:1 contrast or 3:1 for large text',
                completed: false,
            },
            {
                id: 'alt-text',
                label: 'All images have alt text',
                required: true,
                description: 'Meaningful, descriptive alt text for content images',
                completed: false,
            },
            {
                id: 'form-labels',
                label: 'Form labels and error messages',
                required: true,
                description: 'All inputs labeled, error messages associated with fields',
                completed: false,
            },
            {
                id: 'semantic-html',
                label: 'Semantic HTML structure',
                required: true,
                description: 'Use proper heading hierarchy, landmark regions, etc.',
                completed: false,
            },
            {
                id: 'zoom-200',
                label: 'Test at 200% zoom',
                required: true,
                description: 'Page reflows and remains usable at large zoom levels',
                completed: false,
            },
            {
                id: 'aria-roles',
                label: 'ARIA roles and properties correct',
                required: false,
                description: 'Custom components have proper ARIA roles and attributes',
                completed: false,
            },
            {
                id: 'wcag-check',
                label: 'Run automated WCAG checker',
                required: true,
                description: 'Use Axe DevTools, WebAIM, or similar',
                completed: false,
            },
        ];
    }
}
exports.Flow9AccessibleHandler = Flow9AccessibleHandler;
/**
 * Flow 11: Extract Tokens/Create Variant
 * Extract repeated patterns into reusable tokens
 */
class Flow11ExtractHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow11_extract_tokens');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Token Extraction/Variant Definition Workflow',
            guidance: [
                'Find patterns that repeat 3+ times',
                'Extract pattern into reusable token or variant',
                'Update all instances to use the new token',
                'Document the token: what is it, when to use it, what variations exist',
                'Verify consistency across all uses of the token',
            ],
            checklist: this.getExtractChecklist(),
            nextSteps: [
                'Scan codebase for repeating patterns (values, styles, components)',
                'Identify patterns that appear 3+ times (threshold for extraction)',
                'For each pattern: define the token name and purpose',
                'Create the token in DESIGN.md or design system file',
                'Update all instances to use the token',
                'Test that all uses render identically',
                'Document the token: what values does it have, when to use it',
                'Verify no hardcoded values remain for this pattern',
            ],
        };
    }
    getExtractChecklist() {
        return [
            {
                id: 'patterns-identified',
                label: 'Identify repeating patterns (3+ instances)',
                required: true,
                description: 'Scan code for values/styles that repeat',
                completed: false,
            },
            {
                id: 'token-defined',
                label: 'Define token name and structure',
                required: true,
                description: 'What will this token be called? What values does it have?',
                completed: false,
            },
            {
                id: 'token-added',
                label: 'Add token to DESIGN.md or design system',
                required: true,
                description: 'Register the new token in the design system',
                completed: false,
            },
            {
                id: 'instances-updated',
                label: 'Update all instances to use new token',
                required: true,
                description: 'Replace hardcoded values with token references',
                completed: false,
            },
            {
                id: 'consistency-verified',
                label: 'Verify all uses render identically',
                required: true,
                description: 'Screenshot before and after, compare visually',
                completed: false,
            },
            {
                id: 'documentation',
                label: 'Document the token in design system',
                required: true,
                description: 'What is this token for? When should it be used?',
                completed: false,
            },
            {
                id: 'no-hardcoded',
                label: 'Verify no hardcoded values remain',
                required: true,
                description: 'Grep for old pattern values, ensure all use token',
                completed: false,
            },
        ];
    }
}
exports.Flow11ExtractHandler = Flow11ExtractHandler;
/**
 * Flow 12: Responsive Design Review
 * Test across screen sizes and breakpoints
 */
class Flow12ResponsiveHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow12_responsive_review');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Responsive Design Review Workflow',
            guidance: [
                'Test at standard breakpoints: 375px (mobile), 768px (tablet), 1440px (desktop)',
                'Verify layout adapts appropriately at each size',
                'Check touch targets: minimum 40x40px on mobile',
                'Test with real devices when possible, not just browser zoom',
                'Document breakpoint strategy and how layout adapts',
            ],
            checklist: this.getResponsiveChecklist(),
            nextSteps: [
                'Identify breakpoints from DESIGN.md or current implementation',
                'Test at 375px (mobile): layout, text readability, touch targets',
                'Test at 768px (tablet): transitional state, element visibility',
                'Test at 1440px (desktop): full feature set, spacing',
                'Test in-between sizes: 600px, 900px, 1200px',
                'Verify touch targets are 40x40px minimum on mobile',
                'Check text is readable at all sizes',
                'Test with real mobile device if possible',
                'Document breakpoint decisions and rationale',
            ],
        };
    }
    getResponsiveChecklist() {
        return [
            {
                id: 'breakpoints-defined',
                label: 'Identify target breakpoints',
                required: true,
                description: 'Mobile (375px), Tablet (768px), Desktop (1440px+)',
                completed: false,
            },
            {
                id: 'mobile-test',
                label: 'Test at 375px (mobile)',
                required: true,
                description: 'Layout, typography, element visibility, touch targets',
                completed: false,
            },
            {
                id: 'tablet-test',
                label: 'Test at 768px (tablet)',
                required: true,
                description: 'Transitional state, element sizing, spacing',
                completed: false,
            },
            {
                id: 'desktop-test',
                label: 'Test at 1440px+ (desktop)',
                required: true,
                description: 'Full feature set, maximum usable width, spacing',
                completed: false,
            },
            {
                id: 'inbetween-test',
                label: 'Test intermediate breakpoints (600px, 900px, 1200px)',
                required: true,
                description: 'Smooth transition between breakpoints',
                completed: false,
            },
            {
                id: 'touch-targets',
                label: 'Verify touch targets minimum 40x40px on mobile',
                required: true,
                description: 'All interactive elements large enough to tap',
                completed: false,
            },
            {
                id: 'text-readability',
                label: 'Text readable at all sizes',
                required: true,
                description: 'Font sizes scale appropriately, line lengths manageable',
                completed: false,
            },
            {
                id: 'device-test',
                label: 'Test on real mobile device if possible',
                required: false,
                description: 'Real-world testing beyond browser emulation',
                completed: false,
            },
            {
                id: 'docum breakpoints',
                label: 'Document responsive strategy',
                required: true,
                description: 'How does layout adapt? What changes at each breakpoint?',
                completed: false,
            },
        ];
    }
}
exports.Flow12ResponsiveHandler = Flow12ResponsiveHandler;
/**
 * Flow 13: Rapid Iteration Cycle
 * Goal-driven refinement with success criteria
 */
class Flow13IterateHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow13_rapid_iteration');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Entering Rapid Iteration Cycle - Goal-Driven Refinement',
            guidance: [
                'Start with clear success criteria: what does "done" mean?',
                'Each iteration: measure against criteria, identify gaps, refine',
                'Make small, focused changes - test after each change',
                'Keep iterations tight and quick (15-30 min per iteration)',
                'Stop when success criteria are met',
            ],
            checklist: this.getIterateChecklist(),
            nextSteps: [
                'Define success criteria: what makes this good?',
                'Establish baseline: screenshot current state',
                'Iteration 1: Make focused improvement, screenshot result',
                'Evaluate: does it meet success criteria? What\'s still needed?',
                'Iteration 2: Refine based on learnings',
                'Continue iterations until success criteria met',
                'Document what changed in each iteration',
                'Final verification against all success criteria',
            ],
        };
    }
    getIterateChecklist() {
        return [
            {
                id: 'criteria-defined',
                label: 'Success criteria clearly defined',
                required: true,
                description: 'What does "done" look like? How will you measure success?',
                completed: false,
            },
            {
                id: 'baseline-captured',
                label: 'Baseline screenshot captured',
                required: true,
                description: 'Screenshot of current state before iterations begin',
                completed: false,
            },
            {
                id: 'iter1-change',
                label: 'Iteration 1: Make focused change',
                required: true,
                description: 'Single improvement targeting success criteria',
                completed: false,
            },
            {
                id: 'iter1-eval',
                label: 'Iteration 1: Evaluate result',
                required: true,
                description: 'Screenshot and compare to baseline and success criteria',
                completed: false,
            },
            {
                id: 'iter2-refine',
                label: 'Iteration 2: Refine based on findings',
                required: true,
                description: 'Adjust based on what iteration 1 revealed',
                completed: false,
            },
            {
                id: 'iter3-more',
                label: 'Iteration 3+: Continue refining',
                required: false,
                description: 'As many iterations as needed to meet criteria',
                completed: false,
            },
            {
                id: 'final-verify',
                label: 'Final verification against all success criteria',
                required: true,
                description: 'Does the final result meet all stated criteria?',
                completed: false,
            },
            {
                id: 'changes-documented',
                label: 'Document what changed in each iteration',
                required: true,
                description: 'Iteration log: changes made, findings, adjustments',
                completed: false,
            },
        ];
    }
}
exports.Flow13IterateHandler = Flow13IterateHandler;
/**
 * Flow 14: Migration/Refactor Existing Component
 * API change or component replacement with dependencies
 */
class Flow14MigrationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flow14_migration');
    }
    async execute(context) {
        return {
            flowId: this.flowId,
            flowName: this.getFlowName(),
            status: 'success',
            message: 'Initiating Component Migration/Refactor Workflow',
            guidance: [
                'This is a breaking change - plan for dependencies',
                'Identify all places using the old component/API',
                'Create a migration strategy: parallel, phased, or big-bang',
                'Test thoroughly: old API continues working, new API works, migration is safe',
                'Deprecate old API gradually, don\'t kill it immediately',
            ],
            checklist: this.getMigrationChecklist(),
            nextSteps: [
                'Document old API: all properties, behaviors, edge cases',
                'Design new API: what changes, what stays, what\'s deprecated',
                'Find all usages: grep codebase for component/function name',
                'Create migration guide: step-by-step how to migrate',
                'Implement new component/API alongside old one (parallel)',
                'Update one usage at a time, test each migration',
                'Run full test suite after each migration',
                'Mark old API as deprecated with migration instructions',
                'Remove old API only after all usages migrated',
            ],
        };
    }
    getMigrationChecklist() {
        return [
            {
                id: 'old-api-documented',
                label: 'Document old API thoroughly',
                required: true,
                description: 'Properties, behaviors, edge cases, usage patterns',
                completed: false,
            },
            {
                id: 'new-api-designed',
                label: 'Design new API',
                required: true,
                description: 'What changes, what stays, deprecation path',
                completed: false,
            },
            {
                id: 'usages-found',
                label: 'Find all usages of old API',
                required: true,
                description: 'Grep codebase, list every location',
                completed: false,
            },
            {
                id: 'migration-guide',
                label: 'Create migration guide',
                required: true,
                description: 'Step-by-step how to migrate from old to new',
                completed: false,
            },
            {
                id: 'new-impl',
                label: 'Implement new component/API',
                required: true,
                description: 'New implementation, keep old one for now',
                completed: false,
            },
            {
                id: 'parallel-test',
                label: 'Test both old and new APIs work in parallel',
                required: true,
                description: 'Verify no conflicts, both functional',
                completed: false,
            },
            {
                id: 'migrate-one-by-one',
                label: 'Migrate one usage at a time',
                required: true,
                description: 'Update single location, test, move to next',
                completed: false,
            },
            {
                id: 'tests-pass',
                label: 'Full test suite passes after each migration',
                required: true,
                description: 'No regressions, all tests green',
                completed: false,
            },
            {
                id: 'deprecation-marked',
                label: 'Mark old API as deprecated',
                required: true,
                description: 'Add deprecation warnings with migration instructions',
                completed: false,
            },
            {
                id: 'old-removed',
                label: 'Remove old API after all migrations complete',
                required: true,
                description: 'Final cleanup once new API fully adopted',
                completed: false,
            },
        ];
    }
}
exports.Flow14MigrationHandler = Flow14MigrationHandler;
//# sourceMappingURL=flow-handlers-extended.js.map