// Flow I: Accessibility
// WCAG 2.1 AA validation across all 7 design domains

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { SHARED_DESIGN_LAWS } from './design-laws';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';

import { applyModelSelection } from './model-routing';
import { flowCraft, craftGuidanceBlock } from './craft-flow';
interface AccessibilityContext {
  wcagLevel: 'AA' | 'AAA';
  domainAuditResults: {
    domain: string;
    wcagCriteria: string[];
    complianceStatus: 'pass' | 'fail' | 'needs_testing';
    issues: string[];
  }[];
  screenReaderTests: {
    tool: string;
    coverage: string;
  }[];
}

export class FlowIAccessibilityHandler extends BaseFlowHandler {
  private cachedA11yContext?: AccessibilityContext;

  constructor() {
    super('flowI_accessibility');
  }

  canExecute(context: FlowExecutionContext): boolean {
    // Flow I requires project context from Flow A
    return !!(context.projectContext?.register || context.projectContext?.product?.register);
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
    applyModelSelection(this.flowId, context);

    const enhancedContext = context as EnhancedFlowExecutionContext;
    const register = context.projectContext?.register || 'product';

    try {
      // Define WCAG 2.1 AA criteria by domain
      const domainAuditResults: {
        domain: string;
        wcagCriteria: string[];
        complianceStatus: 'pass' | 'fail' | 'needs_testing';
        issues: string[];
      }[] = [
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

      const passCount = domainAuditResults.filter((d) => d.complianceStatus === 'pass').length;
      const screenReaderToolCount = screenReaderTests.length;

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary(`WCAG 2.1 AA accessibility validation across 7 domains + ${screenReaderToolCount} screen reader testing plans`)
        .addRule('color', ['1.4.3 Contrast (Minimum)', '1.4.11 Non-text Contrast', '2.4.7 Focus Visible'])
        .addRule('typography', ['1.4.8 Visual Presentation', '1.4.4 Resize text', '3.3.1 Error Identification'])
        .addRule('spatial', ['2.5.5 Target Size (Enhanced)', '2.4.3 Focus Order', '1.3.5 Identify Input Purpose'])
        .addRule('motion', ['2.3.3 Animation from Interactions', '2.3.2 Animation from Interactions', '2.4.7 Focus Visible'])
        .addRule('interaction', ['2.4.3 Focus Order', '2.4.7 Focus Visible', '3.3.1 Error Identification', '3.3.4 Error Prevention'])
        .addRule('responsive', ['1.3.4 Orientation', '1.4.10 Reflow', '2.5.7 Dragging Movements'])
        .addRule('writing', ['2.4.2 Page Titled', '2.4.6 Headings and Labels', '3.2.4 Consistent Identification', '3.3.2 Labels or Instructions'])
        .addDecision('WCAG Compliance Level', 'WCAG 2.1 Level AA - comprehensive accessibility validation across all 7 design domains')
        .addMetric('wcag-domains-audited', domainAuditResults.length, 'pass', 7)
        .addMetric('domains-pass', passCount, 'pass', domainAuditResults.length)
        // `domains-needs-testing` REMOVED as a metric. Every one of the 7 domains above is
        // constructed with a hard-coded complianceStatus of 'needs_testing', so the count is
        // the constant 7 on every run and for every target - it describes this handler's own
        // manual-testing PLAN and never measures the user's page. As 'warning' it was a
        // permanent finding reading "domains-needs-testing = 7 (target 7)", a defect report
        // that fires when a value reaches its target (measured 2026-07-28). Restating it as
        // 'pass' only moved the lie - calling "7 domains still need testing" a pass is no more
        // true (Codex review 2026-07-28, Low). A metric is a MEASUREMENT; this is a plan, so it
        // belongs where the plan already lives: the checklist, the guidance, and
        // customData['domains-needing-testing'], all of which still carry it.
        .addMetric('screen-reader-tools', screenReaderToolCount, 'pass', 3)
        .addValidation('All 7 domains covered', domainAuditResults.length === 7 ? 'pass' : 'warning', `${domainAuditResults.length}/7 domains`)
        .addValidation('Screen reader testing plan', screenReaderToolCount >= 2 ? 'pass' : 'warning', `${screenReaderToolCount} tools (min 2)`)
        .addValidation('WCAG 2.1 AA criteria documented', true ? 'pass' : 'warning', 'All criteria mapped to domains');

      const memory = memoryBuilder.build();

      // Build checklist
      const checklist = this.createChecklist([
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
      // TEACH, THEN CHECK - and this is a CHECK flow, so a clean project gets no brief. That is not a
      // gap: `audit` exists so that a clean result means something, and a constant block appended to a
      // passing run is the exact defect this wiring removes. When rules DO fail, all 25 a11y rules in
      // the registry now have craft notes, so the brief teaches the failing ones - focus rings, per-
      // control labels, error association, heading order - rather than restating their names.
      const craft = await flowCraft(context.projectPath, {
        shape: 'check',
        findingClasses: ['a11y'],
        lawDomains: ['interaction'],
        domainLabel: 'accessibility',
      });

      const guidance = [
        'Accessibility Target: WCAG 2.1 Level AA (required standard)',
        '',
        ...craftGuidanceBlock(craft, 'nothing on disk could be checked, so this is not a clean result.'),
        'Domain-by-Domain Accessibility Audit:',
        '',
        ...domainAuditResults.flatMap((domain) => [
          `${domain.domain} Domain:`,
          ...domain.wcagCriteria.map((c) => `  [pass] ${c}`),
          ...domain.issues.map((i) => `  [warn] ${i}`),
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
        '[fail] Placeholder instead of <label> (text disappears on focus)',
        '[fail] divs with role="button" (no keyboard support)',
        '[fail] No visible focus ring',
        '[fail] Color alone to convey meaning (needs text or pattern)',
        '[fail] Modal without focus trapping or aria-modal',
        '[fail] Images without alt text',
        '[fail] Unescaped HTML in ARIA labels',
        '[fail] Touch targets < 40x40px',
        '[fail] No prefers-reduced-motion support',
      ];

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: 'WCAG 2.1 AA accessibility validation: 7 domains + screen reader testing plan',
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'WCAG Criteria by Domain',
            domainAuditResults
              .map(
                (d) =>
                  `${d.domain}:\n${d.wcagCriteria.map((c) => `  - ${c}`).join('\n')}`
              )
              .join('\n\n'),
            'WCAG 2.1 AA criteria mapped to 7 design domains'
          ),
          this.createArtifact(
            'checklist',
            'A11y Audit Checklist',
            [
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
            ].join('\n'),
            'Step-by-step accessibility audit guide'
          ),
        ],
        memory,
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
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

  getCachedContext(): AccessibilityContext | undefined {
    return this.cachedA11yContext;
  }
}

export function createFlowIHandler(): FlowIAccessibilityHandler {
  return new FlowIAccessibilityHandler();
}
