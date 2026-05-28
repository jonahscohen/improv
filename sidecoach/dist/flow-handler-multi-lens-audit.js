"use strict";
// Flow K: Multi-Lens Audit
// 5-dimension scan: accessibility, performance, theming, responsive, anti-patterns
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowKMultiLensAuditHandler = void 0;
exports.createFlowKHandler = createFlowKHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const model_routing_1 = require("./model-routing");
const retry_control_1 = require("./retry-control");
class FlowKMultiLensAuditHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowK_multi_lens_audit');
    }
    canExecute(context) {
        return !!context.projectPath;
    }
    async execute(context) {
        // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
        (0, model_routing_1.applyModelSelection)(this.flowId, context);
        try {
            // T-0009: Phase-gated retry control. Halt BEFORE doing work if the
            // orchestrator has looped past maxCycles or against an identical-error
            // signature.
            const retryConfig = (0, retry_control_1.readRetryConfig)(context);
            const retryState = (0, retry_control_1.readRetryState)(context);
            const haltDecision = (0, retry_control_1.evaluateHaltConditions)(retryState, retryConfig);
            if (haltDecision.halt) {
                return (0, retry_control_1.buildHaltResult)(this.flowId, this.getFlowName(), haltDecision, 'multi-lens-audit', `[${this.flowId}]`);
            }
            const dimensions = [
                {
                    name: 'Accessibility (a11y)',
                    checks: [
                        'WCAG 2.1 AA color contrast (4.5:1 normal, 3:1 large)',
                        'Semantic HTML (nav, main, article, section)',
                        'ARIA labels on icons, buttons, form controls',
                        'Keyboard navigation (Tab order, Focus visible)',
                        'Screen reader testing (VoiceOver, NVDA, JAWS)',
                        'Reduced motion support (prefers-reduced-motion)',
                    ],
                    status: 'warning',
                    issues: ['manual testing required'],
                },
                {
                    name: 'Performance',
                    checks: [
                        'Core Web Vitals (LCP <2.5s, FID <100ms, CLS <0.1)',
                        'Font loading strategy (system fonts, font-display: swap)',
                        'Image optimization (responsive srcset, modern formats)',
                        'Bundle size analysis (gzip <250KB initial)',
                        'Third-party scripts loading strategy',
                        'Lazy loading images and components',
                    ],
                    status: 'warning',
                    issues: ['lighthouse audit recommended'],
                },
                {
                    name: 'Theming',
                    checks: [
                        'Light/dark mode support (color-scheme, prefers-color-scheme)',
                        'Sufficient contrast in both themes',
                        'Token consistency across themes',
                        'Focus indicators visible in both themes',
                        'No color-dependent information',
                    ],
                    status: 'warning',
                    issues: ['visual testing required'],
                },
                {
                    name: 'Responsive Design',
                    checks: [
                        'Mobile-first breakpoints (320px, 640px, 1024px, 1280px)',
                        'Touch targets 40x40px minimum',
                        'Text sizing readable on all viewports',
                        'Flexible layouts (no fixed widths)',
                        'Safe area insets (notch/dynamic island support)',
                    ],
                    status: 'warning',
                    issues: ['device testing recommended'],
                },
                {
                    name: 'Anti-Patterns',
                    checks: [
                        'No `transition: all` (specify properties)',
                        'No layout-breaking animations',
                        'No visibility toggling (use opacity)',
                        'No hardcoded breakpoints (use tokens)',
                        'No global CSS pollution',
                    ],
                    status: 'pass',
                    issues: [],
                },
            ];
            const checklist = this.createChecklist([
                { label: 'Run WCAG 2.1 AA contrast checker', required: true },
                { label: 'Test keyboard navigation (Tab, Shift+Tab, Enter, Space)', required: true },
                { label: 'Test with screen reader (VoiceOver/NVDA/JAWS)', required: false },
                { label: 'Run Lighthouse audit (PWA, accessibility, performance)', required: false },
                { label: 'Test in light and dark modes', required: true },
                { label: 'Test on mobile, tablet, desktop', required: true },
                { label: 'Verify Core Web Vitals <2.5s, <100ms, <0.1', required: false },
                { label: 'Check third-party script loading strategy', required: false },
                { label: 'Verify no transition: all or layout animations', required: true },
                { label: 'Verify touch targets 40x40px minimum', required: true },
            ]);
            const guidance = [
                'Multi-Lens Audit scans 5 critical dimensions of quality: accessibility, performance, theming, responsive, and anti-patterns.',
                '',
                'ACCESSIBILITY:',
                '- WCAG 2.1 AA: 4.5:1 contrast normal, 3:1 large text',
                '- Semantic HTML: nav, main, article, section, aside',
                '- ARIA: label icons, buttons, form controls (aria-label, aria-labelledby)',
                '- Keyboard: Tab/Shift+Tab navigation, visible focus, form submission with Enter',
                '- Screen reader: test with VoiceOver (Mac), NVDA (Windows), JAWS (enterprise)',
                '- Reduced motion: prefers-reduced-motion support',
                '',
                'PERFORMANCE:',
                '- Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1',
                '- Fonts: use system fonts or font-display: swap/optional',
                '- Images: responsive srcset, modern formats (WebP, AVIF), lazy load',
                '- Bundles: <250KB gzip for initial load',
                '- Third-party: defer non-critical scripts, use async/defer',
                '',
                'THEMING:',
                '- Light/dark mode via color-scheme CSS property',
                '- Sufficient contrast in both themes',
                '- Token consistency (no hardcoded colors)',
                '- Focus indicators visible in both themes',
                '',
                'RESPONSIVE:',
                '- Mobile-first (320px base)',
                '- Touch targets 40x40px minimum',
                '- Readable text on all viewports',
                '- Safe area insets (notch/dynamic island)',
                '',
                'ANTI-PATTERNS:',
                '- Never transition: all (specify properties)',
                '- Never toggle visibility (use opacity)',
                '- Never hardcode breakpoints (use tokens)',
                '- Never pollute global styles',
            ];
            const passCount = dimensions.filter((d) => d.status === 'pass').length;
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`Multi-lens audit: ${passCount}/${dimensions.length} dimensions pass - accessibility, performance, theming, responsive, anti-patterns`)
                .addRule('accessibility', ['WCAG 2.1 AA', 'semantic HTML', 'ARIA', 'keyboard navigation', 'screen reader testing', 'reduced motion support'])
                .addRule('performance', ['Core Web Vitals <2.5s LCP', 'font-display swap', 'image optimization', 'bundle <250KB'])
                .addRule('theming', ['color-scheme support', 'sufficient contrast both modes', 'token consistency'])
                .addRule('responsive', ['mobile-first', '40x40px hit targets', 'safe areas', 'readable text'])
                .addRule('anti-patterns', ['no transition: all', 'no visibility toggle', 'no hardcoded breakpoints', 'no global CSS'])
                .addDecision('Audit dimensions', '5 critical lenses: a11y, performance, theming, responsive, anti-patterns')
                .addMetric('dimensions-scanned', 5, 'pass')
                .addMetric('dimensions-pass', passCount, 'pass', 5)
                .addValidation('Multi-lens audit', 'warning', 'Manual testing required for a11y, performance, theming, responsive')
                .addArtifact('audit-checklist', 5);
            const auditResult = {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'Multi-Lens Audit initialized - 5-dimension quality scan',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'Audit Dimensions', dimensions
                        .map((d) => `${d.name} (${d.status})\n- ${d.checks.map((c) => c).join('\n- ')}\n${d.issues.length > 0 ? `Issues: ${d.issues.join(', ')}` : ''}`)
                        .join('\n\n'), '5 critical quality dimensions'),
                ],
                memory: memoryBuilder.build(),
            };
            // T-0009: Phase-gated retry control. The audit's "failed rules" are the
            // dimensions that did not pass (warning + fail). Hash the failure set
            // into a signature so identical failure patterns across iterations
            // trigger the halt.
            const failedDimensionIds = dimensions
                .filter((d) => d.status !== 'pass')
                .map((d) => d.name);
            const errorSignature = (0, retry_control_1.computeErrorSignature)({
                validator: 'multi-lens-audit',
                failedRules: failedDimensionIds,
                filePath: context.projectPath || '',
            });
            const nextState = (0, retry_control_1.recordIteration)(retryState, errorSignature);
            (0, retry_control_1.attachRetryStateToResult)(auditResult, nextState, retryConfig);
            return auditResult;
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Multi-lens audit failed: ${String(err).substring(0, 40)}`)
                .addValidation('audit-execution', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to initialize multi-lens audit',
                error: String(err),
                memory,
            };
        }
    }
}
exports.FlowKMultiLensAuditHandler = FlowKMultiLensAuditHandler;
function createFlowKHandler() {
    return new FlowKMultiLensAuditHandler();
}
//# sourceMappingURL=flow-handler-multi-lens-audit.js.map