// Flow I: Accessibility
// WCAG 2.1 AA validation across all 7 design domains

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { SHARED_DESIGN_LAWS } from './design-laws';

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

      // Cache context for downstream flows
      this.cachedA11yContext = {
        wcagLevel: 'AA',
        domainAuditResults,
        screenReaderTests,
      };

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
      const guidance = [
        'Accessibility Target: WCAG 2.1 Level AA (required standard)',
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
      };
    } catch (err) {
      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to plan accessibility validation',
        error: String(err),
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
