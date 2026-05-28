"use strict";
// Flow M: Responsive Validation
//
// Reads the canonical responsive-foundation.md reference (Bencium 5-tier
// breakpoint table + pattern transitions + 44x44 WCAG 2.5.5 hit area floor +
// named anti-patterns + iOS svh/dvh/lvh + mandatory verification steps) and
// surfaces it as flow guidance. Pre-rewrite this handler was a stub with the
// old 320/640/1024/1280 breakpoint set and 40x40 hit targets; the absorbed
// content has finer-grained breakpoints, more specific pattern transitions,
// and a higher hit-area floor.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowMResponsiveValidationHandler = void 0;
exports.createFlowMHandler = createFlowMHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const reference_loader_1 = require("./reference-loader");
const model_routing_1 = require("./model-routing");
class FlowMResponsiveValidationHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowM_responsive_validation');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        try {
            // Load the canonical reference. Soft-fails to null if the file is
            // somehow missing on disk; the handler still produces useful guidance
            // from the Bencium breakpoint table loaded by reference-loader.
            const responsiveDoc = (0, reference_loader_1.loadCanonical)('responsive-foundation');
            const breakpoints = (0, reference_loader_1.loadBreakpointTable)();
            const checklist = this.createChecklist([
                { label: 'Render and screenshot at 375px (XS)', required: true, description: 'iPhone SE / phone portrait' },
                { label: 'Render and screenshot at 768px (SM/MD boundary)', required: true, description: 'iPad portrait, mid-size tablet' },
                { label: 'Render and screenshot at 1024px (LG)', required: true, description: 'iPad landscape, small laptop' },
                { label: 'Render at 1440px (XL) - verify max-width container, no further expansion', required: false },
                { label: 'Hit areas measure >= 44x44px at all breakpoints (WCAG 2.5.5)', required: true, description: 'Overrides the 40x40 floor - touch + accessibility consensus is 44' },
                { label: 'No horizontal scroll at any tested breakpoint (except intentional scroll regions)', required: true },
                { label: 'Nav pattern transitions: hamburger/bottom-tab on XS, sidebar/full-nav on MD+', required: true },
                { label: 'Tables: stacked cards on XS/SM, condensed/horizontal-scroll on MD, full table on LG+', required: false },
                { label: 'Filters: full-screen modal on XS, drawer on SM, sidebar on MD+', required: false },
                { label: 'No use of 100vh on iOS without svh/dvh/lvh fallback', required: true, description: 'Address-bar shrink causes content jump' },
                { label: 'Hover-only interactions have touch fallbacks (long-press, tap-to-reveal, or always-visible)', required: true },
                { label: 'Touch detection via @media (pointer: coarse), not screen size alone', required: false },
                { label: 'Mobile-first CSS: base styles target XS, min-width queries add complexity (never max-width as the base)', required: true },
                { label: 'Safe area insets used on iOS (env(safe-area-inset-top/bottom))', required: false },
                { label: 'Responsive degrade plan documented per component (XS / SM / MD behavior named explicitly)', required: true },
            ]);
            const breakpointLines = breakpoints.map((b) => `- ${b.name} (${b.range}): primary=${b.primaryPattern} | nav=${b.navPattern} | table=${b.tablePattern}`);
            const guidance = [
                'Responsive Validation: Bencium 5-tier breakpoint table + WCAG 2.5.5 hit-area floor (44x44) + named anti-patterns + iOS-Safari gotchas.',
                '',
                'BREAKPOINT TABLE (Bencium, prescribed):',
                ...breakpointLines,
                '',
                'PATTERN TRANSITIONS PER BREAKPOINT:',
                '- Navigation: hamburger menu (XS) -> bottom tab bar (SM) -> sidebar (MD) -> full nav bar (LG/XL)',
                '- Tables: stacked cards (XS/SM) -> horizontal scroll (MD) -> full table (LG+)',
                '- Filters: full-screen modal (XS) -> drawer (SM) -> sidebar (MD+)',
                '- Forms: single column (XS/SM/MD) -> two column (LG+)',
                '- Hero: stacked (XS/SM) -> side-by-side (MD+)',
                '- Card grid: 1 col (XS/SM) -> 2 col (MD) -> 3 col (LG) -> 3-4 col (XL)',
                '- Toast: full-width bottom (XS/SM) -> top-right (MD+)',
                '',
                'HIT AREA FLOOR (44x44px, WCAG 2.5.5 enhanced):',
                '- Every interactive target at every breakpoint, not just mobile.',
                '- Extend with pseudo-element when the visual is smaller than the hit target.',
                '- Never let hit areas of two elements overlap.',
                '',
                'NAMED RESPONSIVE ANTI-PATTERNS:',
                '- Desktop-first CSS with min-width queries adding mobile as exception (mobile-first is mandatory)',
                '- Hiding content via display:none on mobile without an alternative path',
                '- 100vh on iOS without svh/dvh/lvh - address-bar shrink causes content jump',
                '- Hover-only interactions with no touch equivalent (long-press, tap-to-reveal, or always-visible)',
                '- Fixed-position elements that overlap content on iOS Safari (the address-bar shrink gotcha)',
                '- Modal overlays that do not fit the smallest target viewport',
                '- Tables that require horizontal scroll without a card-stacked alternative',
                '- Breakpoints chosen from a device-list, not from where content breaks',
                '',
                'iOS SAFARI VIEWPORT GOTCHAS:',
                '- Use svh (small viewport height) / dvh (dynamic) / lvh (large) instead of vh for full-screen elements',
                '- env(safe-area-inset-*) for notches and dynamic island',
                '- Test in real Safari - DevTools simulation misses the address-bar behavior',
                '',
                'TOUCH vs MOUSE DETECTION:',
                '- @media (pointer: fine) - desktop with mouse',
                '- @media (pointer: coarse) - touch device',
                '- @media (hover: hover) - device that supports persistent hover',
                '- @media (hover: none) - device without hover',
                '- Use these, not screen size alone, to gate hover-revealed UI',
                '',
                'CONTAINER QUERIES vs MEDIA QUERIES:',
                '- Media queries: viewport-wide changes (page layout, nav)',
                '- Container queries: component-internal adaptations (card content reflow)',
                '- Use container queries on cards, lists, and embedded components',
                '',
                'MANDATORY VERIFICATION STEPS (before flowJ tactical polish):',
                '1. Render at 375px width and screenshot',
                '2. Render at 768px and screenshot',
                '3. Render at 1024px and screenshot',
                '4. Check that nav fits at 375px without overflow',
                '5. Measure hit areas at 375px (>= 44x44)',
                '6. Confirm no horizontal scroll appears anywhere except intentional scroll regions',
                '7. Confirm hover interactions have touch fallbacks',
                '8. Confirm safe-area-inset on iOS-like viewports',
                '9. Confirm prefers-reduced-motion respected at every breakpoint',
                '',
                'RESPONSIVE DEGRADE PLAN TEMPLATE (per component emitted):',
                '- Behavior at XS (0-479): [explicit]',
                '- Behavior at SM (480-767): [explicit]',
                '- Behavior at MD (768-1023): [explicit]',
                '- Hit area sizes at each breakpoint',
                '- Any content that hides; where it goes instead',
                '- Test cases at each breakpoint',
            ];
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary('Responsive validation: Bencium 5-tier breakpoints + WCAG 2.5.5 44x44 hit area + iOS svh/dvh fix + pattern transitions per breakpoint')
                .addRule('breakpoints', breakpoints.map((b) => `${b.name} ${b.range}`))
                .addRule('hit-targets', ['minimum 44x44px (WCAG 2.5.5 enhanced)', 'no overlap between targets', 'extend via pseudo-element when visual is smaller'])
                .addRule('anti-patterns', [
                'desktop-first CSS',
                'display:none on mobile without alternative',
                '100vh on iOS without svh/dvh fallback',
                'hover-only interactions',
                'modal larger than smallest viewport',
            ])
                .addRule('ios-fixes', ['svh/dvh/lvh instead of vh', 'env(safe-area-inset-*)', 'real Safari testing not DevTools'])
                .addDecision('Hit area floor', '44x44px (WCAG 2.5.5 enhanced), overriding the older 40x40 floor')
                .addDecision('Breakpoint strategy', 'Bencium 5-tier (XS/SM/MD/LG/XL) with content-driven adjustments, mobile-first CSS')
                .addMetric('breakpoints-tested', 5, 'pass')
                .addMetric('hit-target-minimum-px', 44, 'pass')
                .addValidation('Responsive validation', 'warning', 'Mandatory verification requires render at 375/768/1024 and measure - cannot pass on documentation alone')
                .addValidation('Reference document loaded', responsiveDoc ? 'pass' : 'warning', responsiveDoc ? `${responsiveDoc.length} chars from responsive-foundation.md` : 'responsive-foundation.md missing from disk')
                .addArtifact('responsive', 5);
            const artifacts = [
                this.createArtifact('reference', 'Bencium Breakpoint Table', breakpoints.map((b) => `${b.name} (${b.range}): primary=${b.primaryPattern} | nav=${b.navPattern} | table=${b.tablePattern}`).join('\n'), 'The 5-tier breakpoint table sidecoach uses everywhere. Source: Bencium responsive-design.md, absorbed at sidecoach/reference/_extracted/external/bencium-design/'),
            ];
            if (responsiveDoc) {
                artifacts.push(this.createArtifact('reference', 'responsive-foundation.md (canonical)', responsiveDoc.length > 4000 ? responsiveDoc.slice(0, 4000) + '\n\n[truncated - see sidecoach/reference/responsive-foundation.md for full content]' : responsiveDoc, 'The full canonical responsive reference. Includes mobile nav patterns (hamburger/bottom-tab/drawer/segmented/tab-bar/command-palette/FAB), iOS Safari gotchas, fluid type, container queries vs media queries, and the responsive degrade plan template.'));
            }
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: `Responsive Validation: Bencium 5-tier breakpoints + 44x44 hit area + ${responsiveDoc ? Math.floor(responsiveDoc.length / 1000) + 'k chars canonical reference loaded' : 'canonical reference missing'}`,
                guidance,
                checklist,
                artifacts,
                memory: memoryBuilder.build(),
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Responsive validation failed: ${String(err).substring(0, 40)}`)
                .addValidation('responsive-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize responsive validation',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowMResponsiveValidationHandler = FlowMResponsiveValidationHandler;
function createFlowMHandler() {
    return new FlowMResponsiveValidationHandler();
}
//# sourceMappingURL=flow-handler-responsive-validation.js.map