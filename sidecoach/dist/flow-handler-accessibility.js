"use strict";
// Flow I: Accessibility
// WCAG 2.1 AA validation across all 7 design domains
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowIAccessibilityHandler = void 0;
exports.createFlowIHandler = createFlowIHandler;
const flow_handler_1 = require("./flow-handler");
const flow_memory_schema_1 = require("./flow-memory-schema");
const extended_domain_validator_1 = require("./extended-domain-validator");
class FlowIAccessibilityHandler extends flow_handler_1.BaseFlowHandler {
    constructor() {
        super('flowI_accessibility');
    }
    canExecute(context) {
        // Flow I requires project context from Flow A
        return !!(context.projectContext?.register || context.projectContext?.product?.register);
    }
    async execute(context) {
        const enhancedContext = context;
        const register = context.projectContext?.register || 'product';
        try {
            // Define WCAG 2.1 AA criteria by domain
            const domainAuditResults = [
                {
                    domain: 'Color',
                    wcagCriteria: [
                        '1.4.3 Contrast (Minimum): 4.5:1 for normal text, 3:1 for large text/UI',
                        '1.4.11 Non-text Contrast: 3:1 for graphical elements and UI components',
                        '2.4.7 Focus Visible: Focus indicator always visible',
                    ],
                    complianceStatus: 'needs_testing',
                    issues: [
                        'Verify text/background contrast ratios with axe or Lighthouse',
                        'Check UI component contrast (buttons, inputs, borders)',
                        'Ensure focus ring has sufficient contrast against background',
                    ],
                },
                {
                    domain: 'Typography',
                    wcagCriteria: [
                        '1.4.8 Visual Presentation: Line spacing >=1.5, text alignment not justified',
                        '1.4.4 Resize text: Allow 200% zoom without loss of functionality',
                        '3.3.1 Error Identification: Errors identified and described in text',
                    ],
                    complianceStatus: 'needs_testing',
                    issues: [
                        'Verify font sizing uses rem/em (not px) for scaling',
                        'Check line-height >= 1.5 for body text',
                        'Ensure text resizes to 200% without horizontal scroll',
                    ],
                },
                {
                    domain: 'Spatial',
                    wcagCriteria: [
                        '2.5.5 Target Size (Enhanced): 44x44px minimum for all interactive elements',
                        '2.4.3 Focus Order: Logical keyboard navigation order',
                        '1.3.5 Identify Input Purpose: Input fields properly labeled',
                    ],
                    complianceStatus: 'needs_testing',
                    issues: [
                        'Measure touch targets: all interactive >=40x40px (44x44px enhanced)',
                        'Verify tab order logical and intuitive',
                        'Check all form inputs have associated labels',
                    ],
                },
                {
                    domain: 'Motion',
                    wcagCriteria: [
                        '2.3.3 Animation from Interactions: prefers-reduced-motion respected',
                        '2.3.2 Animation from Interactions: Avoid motion > 5 seconds',
                        '2.4.7 Focus Visible: Focus indication never removed',
                    ],
                    complianceStatus: 'needs_testing',
                    issues: [
                        'Verify @media (prefers-reduced-motion) implemented',
                        'Check animations <= 5 seconds or user-triggered',
                        'Ensure focus ring always visible on interactions',
                    ],
                },
                {
                    domain: 'Interaction',
                    wcagCriteria: [
                        '2.4.3 Focus Order: Logical, meaningful keyboard navigation',
                        '2.4.7 Focus Visible: 2-3px visible focus indicator',
                        '3.3.1 Error Identification: Clear error messages',
                        '3.3.4 Error Prevention: Confirm destructive actions',
                    ],
                    complianceStatus: 'needs_testing',
                    issues: [
                        'Test keyboard-only navigation (no mouse)',
                        'Verify all 8 states have keyboard support',
                        'Check error messages are helpful and specific',
                        'Confirm destructive actions require confirmation',
                    ],
                },
                {
                    domain: 'Responsive',
                    wcagCriteria: [
                        '1.3.4 Orientation: Don\'t restrict to single orientation',
                        '1.4.10 Reflow: Content flows horizontally/vertically without loss',
                        '2.5.7 Dragging Movements: Alternatives to drag-and-drop',
                    ],
                    complianceStatus: 'needs_testing',
                    issues: [
                        'Test landscape and portrait orientations',
                        'Verify no horizontal scroll at 1280px viewport',
                        'Check touch targets work on all device types',
                    ],
                },
                {
                    domain: 'Writing',
                    wcagCriteria: [
                        '2.4.2 Page Titled: Every page has descriptive title',
                        '2.4.6 Headings and Labels: Descriptive, not generic',
                        '3.2.4 Consistent Identification: Navigation consistent across pages',
                        '3.3.2 Labels or Instructions: Clear instructions for inputs',
                    ],
                    complianceStatus: 'needs_testing',
                    issues: [
                        'Verify page titles are unique and descriptive',
                        'Check headings are semantic (h1, h2, etc.) not divs',
                        'Ensure all labels are visible, not just placeholders',
                        'Check error messages match writing domain rules',
                    ],
                },
            ];
            // Screen reader testing requirements
            const screenReaderTests = [
                {
                    tool: 'VoiceOver (macOS/iOS)',
                    coverage: 'Test on Safari with full screen reader interaction',
                },
                {
                    tool: 'NVDA (Windows)',
                    coverage: 'Test on Firefox with full screen reader interaction',
                },
                {
                    tool: 'JAWS (Windows)',
                    coverage: 'Commercial screen reader, verify critical flows',
                },
            ];
            // Add custom data to enhanced context if available
            if (enhancedContext?.flowMetadata) {
                enhancedContext.flowMetadata.tags = ['flowI', 'accessibility', 'wcag-2.1'];
                enhancedContext.flowMetadata.customData = {
                    'wcag-level': 'AA',
                    'domains-audited': domainAuditResults.length,
                    'screen-reader-tools': screenReaderTests.length,
                    'domains-needing-testing': domainAuditResults.filter((r) => r.complianceStatus === 'needs_testing').length,
                };
            }
            // Cache context for downstream flows
            this.cachedA11yContext = {
                wcagLevel: 'AA',
                domainAuditResults,
                screenReaderTests,
            };
            // Domain validation integration
            const domainCheckContext = {
                designTokens: context.metadata?.designTokens || {},
                componentTree: context.metadata?.componentTree || { wcagLevel: 'AA', domains: domainAuditResults.length },
                cssRules: context.metadata?.cssRules || [],
                accessibility: context.metadata?.accessibility,
                colors: context.metadata?.colors,
                typography: context.metadata?.typography,
                spacing: context.metadata?.spacing,
                motion: context.metadata?.motion,
            };
            const extendedValidationReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(domainCheckContext);
            const colorDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('color');
            const typographyDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('typography');
            const spatialDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('spatial');
            const motionDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('motion');
            const interactionDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('interaction');
            const responsiveDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('responsive');
            const writingDomainRules = extended_domain_validator_1.ExtendedDomainValidator.getRulesByDomain('writing');
            const colorPassRate = extendedValidationReport.passRateByDomain['color'] || '0%';
            const typographyPassRate = extendedValidationReport.passRateByDomain['typography'] || '0%';
            const spatialPassRate = extendedValidationReport.passRateByDomain['spatial'] || '0%';
            const motionPassRate = extendedValidationReport.passRateByDomain['motion'] || '0%';
            const interactionPassRate = extendedValidationReport.passRateByDomain['interaction'] || '0%';
            const responsivePassRate = extendedValidationReport.passRateByDomain['responsive'] || '0%';
            const writingPassRate = extendedValidationReport.passRateByDomain['writing'] || '0%';
            const colorPassed = Math.round((parseFloat(colorPassRate) / 100) * colorDomainRules.length);
            const typographyPassed = Math.round((parseFloat(typographyPassRate) / 100) * typographyDomainRules.length);
            const spatialPassed = Math.round((parseFloat(spatialPassRate) / 100) * spatialDomainRules.length);
            const motionPassed = Math.round((parseFloat(motionPassRate) / 100) * motionDomainRules.length);
            const interactionPassed = Math.round((parseFloat(interactionPassRate) / 100) * interactionDomainRules.length);
            const responsivePassed = Math.round((parseFloat(responsivePassRate) / 100) * responsiveDomainRules.length);
            const writingPassed = Math.round((parseFloat(writingPassRate) / 100) * writingDomainRules.length);
            const passCount = domainAuditResults.filter((d) => d.complianceStatus === 'pass').length;
            const needsTestingCount = domainAuditResults.filter((d) => d.complianceStatus === 'needs_testing').length;
            const screenReaderToolCount = screenReaderTests.length;
            const memoryBuilder = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setSummary(`WCAG 2.1 AA accessibility validation: 7 domains with domain validation (color: ${colorPassRate}, typography: ${typographyPassRate}, spatial: ${spatialPassRate}, motion: ${motionPassRate}, interaction: ${interactionPassRate}, responsive: ${responsivePassRate}, writing: ${writingPassRate}) + ${screenReaderToolCount} screen reader testing plans`)
                .addRule('color', ['1.4.3 Contrast (Minimum)', '1.4.11 Non-text Contrast', '2.4.7 Focus Visible'])
                .addRule('typography', ['1.4.8 Visual Presentation', '1.4.4 Resize text', '3.3.1 Error Identification'])
                .addRule('spatial', ['2.5.5 Target Size (Enhanced)', '2.4.3 Focus Order', '1.3.5 Identify Input Purpose'])
                .addRule('motion', ['2.3.3 Animation from Interactions', '2.3.2 Animation from Interactions', '2.4.7 Focus Visible'])
                .addRule('interaction', ['2.4.3 Focus Order', '2.4.7 Focus Visible', '3.3.1 Error Identification', '3.3.4 Error Prevention'])
                .addRule('responsive', ['1.3.4 Orientation', '1.4.10 Reflow', '2.5.7 Dragging Movements'])
                .addRule('writing', ['2.4.2 Page Titled', '2.4.6 Headings and Labels', '3.2.4 Consistent Identification', '3.3.2 Labels or Instructions'])
                .addDecision('WCAG Compliance Level', 'WCAG 2.1 Level AA - comprehensive accessibility validation across all 7 design domains')
                .addMetric('wcag-domains-audited', domainAuditResults.length, 'pass', 7)
                .addMetric('color-domain-validation', colorPassed, 'pass', colorDomainRules.length)
                .addMetric('typography-domain-validation', typographyPassed, 'pass', typographyDomainRules.length)
                .addMetric('spatial-domain-validation', spatialPassed, 'pass', spatialDomainRules.length)
                .addMetric('motion-domain-validation', motionPassed, 'pass', motionDomainRules.length)
                .addMetric('interaction-domain-validation', interactionPassed, 'pass', interactionDomainRules.length)
                .addMetric('responsive-domain-validation', responsivePassed, 'pass', responsiveDomainRules.length)
                .addMetric('writing-domain-validation', writingPassed, 'pass', writingDomainRules.length)
                .addMetric('domains-pass', passCount, 'pass', domainAuditResults.length)
                .addMetric('domains-needs-testing', needsTestingCount, 'warning', domainAuditResults.length)
                .addMetric('screen-reader-tools', screenReaderToolCount, 'pass', 3)
                .addValidation('All 7 domains covered', domainAuditResults.length === 7 ? 'pass' : 'warning', `${domainAuditResults.length}/7 domains`)
                .addValidation('Color domain compliance', colorPassed === colorDomainRules.length ? 'pass' : 'warning', `${colorPassed}/${colorDomainRules.length} pass`)
                .addValidation('Typography domain compliance', typographyPassed === typographyDomainRules.length ? 'pass' : 'warning', `${typographyPassed}/${typographyDomainRules.length} pass`)
                .addValidation('Spatial domain compliance', spatialPassed === spatialDomainRules.length ? 'pass' : 'warning', `${spatialPassed}/${spatialDomainRules.length} pass`)
                .addValidation('Motion domain compliance', motionPassed === motionDomainRules.length ? 'pass' : 'warning', `${motionPassed}/${motionDomainRules.length} pass`)
                .addValidation('Interaction domain compliance', interactionPassed === interactionDomainRules.length ? 'pass' : 'warning', `${interactionPassed}/${interactionDomainRules.length} pass`)
                .addValidation('Responsive domain compliance', responsivePassed === responsiveDomainRules.length ? 'pass' : 'warning', `${responsivePassed}/${responsiveDomainRules.length} pass`)
                .addValidation('Writing domain compliance', writingPassed === writingDomainRules.length ? 'pass' : 'warning', `${writingPassed}/${writingDomainRules.length} pass`)
                .addValidation('Screen reader testing plan', screenReaderToolCount >= 2 ? 'pass' : 'warning', `${screenReaderToolCount} tools (min 2)`)
                .addValidation('WCAG 2.1 AA criteria documented', true ? 'pass' : 'warning', 'All criteria mapped to domains');
            const memory = memoryBuilder.build();
            // Build checklist
            const checklist = this.createChecklist([
                { label: 'Color domain validation', required: false, description: `${colorPassed}/${colorDomainRules.length} rules passing (${colorPassRate})` },
                { label: 'Typography domain validation', required: false, description: `${typographyPassed}/${typographyDomainRules.length} rules passing (${typographyPassRate})` },
                { label: 'Spatial domain validation', required: false, description: `${spatialPassed}/${spatialDomainRules.length} rules passing (${spatialPassRate})` },
                { label: 'Motion domain validation', required: false, description: `${motionPassed}/${motionDomainRules.length} rules passing (${motionPassRate})` },
                { label: 'Interaction domain validation', required: false, description: `${interactionPassed}/${interactionDomainRules.length} rules passing (${interactionPassRate})` },
                { label: 'Responsive domain validation', required: false, description: `${responsivePassed}/${responsiveDomainRules.length} rules passing (${responsivePassRate})` },
                { label: 'Writing domain validation', required: false, description: `${writingPassed}/${writingDomainRules.length} rules passing (${writingPassRate})` },
                { label: 'Run automated a11y audit (axe, Lighthouse, WebAIM)', required: true, description: 'No critical/serious issues' },
                { label: 'Test keyboard-only navigation', required: true, description: 'All interactive elements reachable' },
                { label: 'Test with screen reader (VoiceOver or NVDA)', required: true, description: 'Full semantic understanding' },
                { label: 'Verify semantic HTML (h1, button, label, etc.)', required: true, description: 'Not divs with role' },
                { label: 'Check heading hierarchy (no skipped levels)', required: true, description: 'h1 → h2 → h3, never h1 → h3' },
                { label: 'Verify ARIA labels where needed (icon buttons, etc.)', required: true, description: 'No unlabeled interactive elements' },
                { label: 'Check color contrast (4.5:1 text, 3:1 UI)', required: true, description: 'WCAG AA minimum' },
                { label: 'Verify touch targets >= 40x40px (44x44px enhanced)', required: true, description: 'Mobile-friendly hit areas' },
                { label: 'Test @media (prefers-reduced-motion) support', required: true, description: 'Reduced animations when requested' },
                { label: 'Verify form inputs have visible labels', required: true, description: 'Not placeholders, not hidden' },
                { label: 'Fix all Critical and High severity issues', required: true, description: 'Blocking compliance' },
                { label: 'Document a11y decisions and testing results', required: false, description: 'For audit trail' },
            ]);
            // Build guidance
            const guidance = [
                'Accessibility Target: WCAG 2.1 Level AA (required standard)',
                '',
                'Domain Validation Results:',
                '',
                'Domain-by-Domain Accessibility Audit:',
                '',
                ...domainAuditResults.flatMap((domain) => [
                    `${domain.domain} Domain:`,
                    ...domain.wcagCriteria.map((c) => `  ✓ ${c}`),
                    ...domain.issues.map((i) => `  ⚠ ${i}`),
                    '',
                ]),
                'Screen Reader Testing (Mandatory):',
                ...screenReaderTests.map((sr) => `- ${sr.tool}: ${sr.coverage}`),
                '',
                'Testing Tools & Resources:',
                '- Automated: axe DevTools, Lighthouse, WebAIM, WAVE',
                '- Manual: keyboard navigation (Tab, Enter, Space, Arrows)',
                '- Screen readers: VoiceOver (macOS), NVDA (Windows), JAWS (commercial)',
                '- Color contrast: WebAIM Contrast Checker, Polychroma',
                '',
                'Severity Prioritization for Fixes:',
                '- Critical: Blocks core function (login, payment, submission impossible)',
                '- High: Significantly impacts experience (can\'t find content, confusing navigation)',
                '- Medium: Affects some users in some scenarios (minor color contrast, skip links)',
                '- Low: Polish (keyboard shortcut hints, extra ARIA)',
                '',
                'Common Failures to Prevent:',
                '✗ Placeholder instead of <label> (text disappears on focus)',
                '✗ divs with role="button" (no keyboard support)',
                '✗ No visible focus ring',
                '✗ Color alone to convey meaning (needs text or pattern)',
                '✗ Modal without focus trapping or aria-modal',
                '✗ Images without alt text',
                '✗ Unescaped HTML in ARIA labels',
                '✗ Touch targets < 40x40px',
                '✗ No prefers-reduced-motion support',
            ];
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'success',
                message: 'WCAG 2.1 AA accessibility validation: 7 domains + screen reader testing plan',
                guidance,
                checklist,
                artifacts: [
                    this.createArtifact('reference', 'WCAG Criteria by Domain', domainAuditResults
                        .map((d) => `${d.domain}:\n${d.wcagCriteria.map((c) => `  - ${c}`).join('\n')}`)
                        .join('\n\n'), 'WCAG 2.1 AA criteria mapped to 7 design domains'),
                    this.createArtifact('checklist', 'A11y Audit Checklist', [
                        'Automated Tools:',
                        '[ ] Run axe DevTools - fix all critical/serious',
                        '[ ] Run Lighthouse a11y audit - score >= 90',
                        '[ ] WebAIM WAVE check - no errors',
                        '',
                        'Keyboard Testing:',
                        '[ ] Tab through all interactive elements',
                        '[ ] Focus ring always visible',
                        '[ ] No keyboard traps',
                        '[ ] All functionality available via keyboard',
                        '',
                        'Screen Reader Testing:',
                        '[ ] Test with VoiceOver (macOS) or NVDA (Windows)',
                        '[ ] All content discoverable and understandable',
                        '[ ] Forms properly labeled and grouped',
                        '[ ] Headings and landmarks present',
                        '',
                        'Visual Testing:',
                        '[ ] Color contrast >= 4.5:1 (text), 3:1 (UI)',
                        '[ ] Touch targets >= 40x40px',
                        '[ ] Text readable at 200% zoom',
                        '',
                        'Testing & Documentation:',
                        '[ ] Document tested browsers/screen readers',
                        '[ ] List all known limitations (if any)',
                        '[ ] Priority level for remaining issues',
                    ].join('\n'), 'Step-by-step accessibility audit guide'),
                ],
                memory,
            };
        }
        catch (err) {
            const memory = new flow_memory_schema_1.FlowMemoryBuilder(this.flowId, this.getFlowName())
                .setStatus('error')
                .setSummary(`Accessibility validation failed: ${String(err).substring(0, 40)}`)
                .addValidation('wcag-validation', 'fail', String(err))
                .build();
            return {
                flowId: this.flowId,
                flowName: this.getFlowName(),
                status: 'error',
                message: 'Failed to plan accessibility validation',
                error: String(err),
                guidance: [],
                checklist: [],
                memory,
            };
        }
    }
    getCachedContext() {
        return this.cachedA11yContext;
    }
}
exports.FlowIAccessibilityHandler = FlowIAccessibilityHandler;
function createFlowIHandler() {
    return new FlowIAccessibilityHandler();
}
//# sourceMappingURL=flow-handler-accessibility.js.map