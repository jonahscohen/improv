import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult, ChecklistItem } from './flow-handler';

/**
 * Flow 2: Polish/Enhance Interaction
 * Consolidates /make-interfaces-feel-better - adds feeling, animation, microinteractions
 */
export class Flow2PolishHandler extends BaseFlowHandler {
  constructor() {
    super('flow2_polish_enhance');
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: 'Initiating Polish & Enhancement workflow',
      guidance: [
        'Review the 14-point tactile improvement checklist below',
        'Apply each principle to your UI elements',
        'Verify changes with real browser interactions (not synthetic events)',
        'Test on actual devices before considering complete',
      ],
      checklist: this.getPolarishChecklist(),
      nextSteps: [
        'Open your component or page in a browser',
        'For each principle in the checklist, identify which elements need adjustment',
        'Apply the tactical improvements (scale, radius, transitions, etc.)',
        'Test interactions: hover, press, focus states',
        'Screenshot and compare before/after',
      ],
    };
  }

  private getPolarishChecklist(): ChecklistItem[] {
    return [
      {
        id: 'scale-press',
        label: 'Scale on press: scale(0.96) for interactive elements',
        required: true,
        description: 'All clickable elements should scale down slightly on press to indicate interaction',
        completed: false,
      },
      {
        id: 'border-radius',
        label: 'Concentric border radius: outer = inner + padding',
        required: true,
        description: 'Border radius should increase proportionally as you move outward through nested elements',
        completed: false,
      },
      {
        id: 'icon-swap',
        label: 'Icon swaps via opacity+scale+blur',
        required: false,
        description: 'When swapping icons: scale 0.25→1, opacity 0→1, blur 4px→0',
        completed: false,
      },
      {
        id: 'image-outline',
        label: 'Image outlines: rgba(0,0,0,0.1) never tinted',
        required: false,
        description: 'Use neutral dark transparent borders on images, not colored overlays',
        completed: false,
      },
      {
        id: 'hit-area',
        label: 'Hit areas minimum 40x40px',
        required: true,
        description: 'All interactive elements must have at least 40x40px clickable area',
        completed: false,
      },
      {
        id: 'transition-all-banned',
        label: 'Avoid transition: all',
        required: true,
        description: 'Specify individual transitions (e.g., transition: transform 200ms, opacity 150ms)',
        completed: false,
      },
      {
        id: 'tabular-nums',
        label: 'Tabular numbers on dynamic content',
        required: false,
        description: 'Use font-variant-numeric: tabular-nums on numbers that change',
        completed: false,
      },
      {
        id: 'text-wrap-balance',
        label: 'Text-wrap: balance on headings',
        required: false,
        description: 'Prevents awkward line breaks in titles',
        completed: false,
      },
      {
        id: 'optical-alignment',
        label: 'Optical alignment for asymmetric shapes',
        required: false,
        description: 'Visually center elements that are not perfectly symmetric',
        completed: false,
      },
      {
        id: 'shadows-over-borders',
        label: 'Use shadows over borders for depth',
        required: false,
        description: 'Subtle shadows create better elevation than flat borders',
        completed: false,
      },
      {
        id: 'staggered-enters',
        label: 'Staggered entrance animations',
        required: false,
        description: 'Animate list items with slight delays between each',
        completed: false,
      },
      {
        id: 'subtle-exits',
        label: 'Subtle exit animations',
        required: false,
        description: 'Elements should fade/scale out smoothly, not disappear instantly',
        completed: false,
      },
      {
        id: 'animate-presence-initial-false',
        label: 'AnimatePresence with initial={false}',
        required: false,
        description: 'Prevents animation on first render if using Framer Motion',
        completed: false,
      },
      {
        id: 'will-change-sparse',
        label: 'Use will-change sparingly',
        required: false,
        description: 'Only on elements that will definitely animate frequently',
        completed: false,
      },
    ];
  }
}

/**
 * Flow 5: Review/QA Mode
 * Consolidates audit - comprehensive multi-lens check
 */
export class Flow5ReviewHandler extends BaseFlowHandler {
  constructor() {
    super('flow5_review_qa');
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: 'Initiating 5-Lens Review & QA workflow',
      guidance: [
        'Run through each lens systematically',
        'Document findings for each area',
        'Prioritize Critical and High issues before continuing',
        'Use the checklist to track completion',
      ],
      checklist: this.getReviewChecklist(),
      nextSteps: [
        'Lens 1: Accessibility - test with screen reader, keyboard navigation',
        'Lens 2: Performance - check bundle size, Core Web Vitals, render performance',
        'Lens 3: Theming - verify colors meet contrast ratios, work in light/dark modes',
        'Lens 4: Responsive - test at 3+ breakpoints, verify layout adapts',
        'Lens 5: Anti-patterns - check for common pitfalls (hardcoded values, missing states, etc.)',
        'Compile findings and severity levels',
        'Create issues for Critical and High priority items',
      ],
    };
  }

  private getReviewChecklist(): ChecklistItem[] {
    return [
      {
        id: 'a11y-sr',
        label: 'Lens 1 - Accessibility: Screen reader testing',
        required: true,
        description: 'Test with VoiceOver (Mac), NVDA (Windows), or JAWS',
        completed: false,
      },
      {
        id: 'a11y-keyboard',
        label: 'Lens 1 - Accessibility: Keyboard navigation',
        required: true,
        description: 'Tab/Shift+Tab through all interactive elements, check focus indicators',
        completed: false,
      },
      {
        id: 'a11y-contrast',
        label: 'Lens 1 - Accessibility: Color contrast WCAG AA',
        required: true,
        description: 'All text must have 4.5:1 contrast (or 3:1 for large text)',
        completed: false,
      },
      {
        id: 'perf-bundle',
        label: 'Lens 2 - Performance: Bundle size and load time',
        required: true,
        description: 'Check gzip size, Core Web Vitals (LCP, FID, CLS)',
        completed: false,
      },
      {
        id: 'perf-render',
        label: 'Lens 2 - Performance: Render performance',
        required: true,
        description: 'Monitor frame rates, no janky animations, smooth scrolling',
        completed: false,
      },
      {
        id: 'theme-light',
        label: 'Lens 3 - Theming: Light mode verification',
        required: true,
        description: 'Check all colors and contrasts work in light mode',
        completed: false,
      },
      {
        id: 'theme-dark',
        label: 'Lens 3 - Theming: Dark mode verification',
        required: true,
        description: 'Check all colors and contrasts work in dark mode',
        completed: false,
      },
      {
        id: 'responsive-mobile',
        label: 'Lens 4 - Responsive: Mobile (375px)',
        required: true,
        description: 'Test layout at mobile viewport',
        completed: false,
      },
      {
        id: 'responsive-tablet',
        label: 'Lens 4 - Responsive: Tablet (768px)',
        required: true,
        description: 'Test layout at tablet viewport',
        completed: false,
      },
      {
        id: 'responsive-desktop',
        label: 'Lens 4 - Responsive: Desktop (1440px+)',
        required: true,
        description: 'Test layout at desktop viewport',
        completed: false,
      },
      {
        id: 'antipattern-hardcoded',
        label: 'Lens 5 - Anti-patterns: No hardcoded values',
        required: true,
        description: 'All spacing, colors, sizes should use design tokens',
        completed: false,
      },
      {
        id: 'antipattern-states',
        label: 'Lens 5 - Anti-patterns: All states implemented',
        required: true,
        description: 'Hover, active, focus, disabled, loading, error states',
        completed: false,
      },
    ];
  }
}

/**
 * Flow 7: Design a New Component
 * Consolidates /sidecoach craft + QA triad (audit → critique → polish)
 */
export class Flow7DesignHandler extends BaseFlowHandler {
  constructor() {
    super('flow7_design_component');
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: 'Initiating Design Component workflow with QA Triad',
      guidance: [
        'This flow executes a 3-step QA triad after design:',
        '1. Audit: Technical scan (a11y, perf, responsive, etc.)',
        '2. Critique: Design review via independent agents (Nielsen heuristics, cognitive load)',
        '3. Polish: Final visual alignment against design system',
        'Each step must complete before moving to the next',
      ],
      checklist: this.getDesignComponentChecklist(),
      nextSteps: [
        'Extract the new component from your design file',
        'Implement in code with all required states',
        'Run Audit: /sidecoach audit <component>',
        'Address all Critical and High findings',
        'Run Critique: /sidecoach critique <component>',
        'Refine design based on feedback',
        'Run Polish: /sidecoach polish <component>',
        'Verify final visual correctness against design system',
      ],
    };
  }

  private getDesignComponentChecklist(): ChecklistItem[] {
    return [
      {
        id: 'extract-design',
        label: 'Extract component from design source',
        required: true,
        description: 'Get exact specs: colors, typography, spacing, states',
        completed: false,
      },
      {
        id: 'implement-all-states',
        label: 'Implement all component states',
        required: true,
        description: 'Default, hover, active, focus, disabled, loading, error',
        completed: false,
      },
      {
        id: 'audit-technical',
        label: 'QA Triad - Audit: Technical scan',
        required: true,
        description: 'Run /sidecoach audit to check a11y, perf, responsive, anti-patterns',
        completed: false,
      },
      {
        id: 'audit-fixes',
        label: 'Fix all Audit Critical/High findings',
        required: true,
        description: 'Address accessibility, performance, and responsive issues',
        completed: false,
      },
      {
        id: 'critique-design',
        label: 'QA Triad - Critique: Design review',
        required: true,
        description: 'Run /sidecoach critique for Nielsen heuristics and UX feedback',
        completed: false,
      },
      {
        id: 'critique-refinement',
        label: 'Refine based on Critique feedback',
        required: true,
        description: 'Address design concerns and usability issues',
        completed: false,
      },
      {
        id: 'polish-alignment',
        label: 'QA Triad - Polish: Design system alignment',
        required: true,
        description: 'Run /sidecoach polish to verify design token usage and visual correctness',
        completed: false,
      },
      {
        id: 'design-vs-code',
        label: 'Compare: Design vs Implementation side-by-side',
        required: true,
        description: 'Verify all details match (colors, spacing, typography, radius, shadows)',
        completed: false,
      },
    ];
  }
}

/**
 * Flow 10: Implement from Design
 * Design-to-code workflow with state matrix and responsive validation
 */
export class Flow10ImplementHandler extends BaseFlowHandler {
  constructor() {
    super('flow10_implement_design');
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: 'Initiating Implementation from Design workflow',
      guidance: [
        'Follow the 7-state matrix to ensure all variations are implemented',
        'Compare your code against the design at each viewport',
        'Verify responsive behavior with real browser resizing (not synthetic)',
        'Test all interactive states before considering complete',
      ],
      checklist: this.getImplementChecklist(),
      nextSteps: [
        'Review design file and identify all component states',
        'Extract design tokens (colors, spacing, typography)',
        'Implement component with all states from the matrix',
        'Test at 3+ breakpoints: mobile (375px), tablet (768px), desktop (1440px)',
        'Verify touch targets are at least 40x40px on mobile',
        'Compare side-by-side with design at each viewport',
        'Test all interactive elements: hover, press, focus, disabled',
      ],
    };
  }

  private getImplementChecklist(): ChecklistItem[] {
    return [
      {
        id: 'state-default',
        label: 'State Matrix - Default state',
        required: true,
        description: 'Implement the default/resting state',
        completed: false,
      },
      {
        id: 'state-hover',
        label: 'State Matrix - Hover state',
        required: true,
        description: 'Visual feedback on hover (color change, subtle scale)',
        completed: false,
      },
      {
        id: 'state-press',
        label: 'State Matrix - Press/Active state',
        required: true,
        description: 'Clear visual feedback when pressed (scale(0.96), darker color)',
        completed: false,
      },
      {
        id: 'state-focus',
        label: 'State Matrix - Focus state',
        required: true,
        description: 'Keyboard focus indicator (outline or box-shadow)',
        completed: false,
      },
      {
        id: 'state-disabled',
        label: 'State Matrix - Disabled state',
        required: true,
        description: 'Grayed out, no pointer events, clear visual distinction',
        completed: false,
      },
      {
        id: 'state-loading',
        label: 'State Matrix - Loading state',
        required: false,
        description: 'Spinner or loading indicator if applicable',
        completed: false,
      },
      {
        id: 'state-error',
        label: 'State Matrix - Error state',
        required: false,
        description: 'Error styling if applicable (red text, warning icon)',
        completed: false,
      },
      {
        id: 'responsive-mobile',
        label: 'Responsive - Mobile (375px)',
        required: true,
        description: 'Layout adapts correctly at mobile viewport',
        completed: false,
      },
      {
        id: 'responsive-tablet',
        label: 'Responsive - Tablet (768px)',
        required: true,
        description: 'Layout adapts correctly at tablet viewport',
        completed: false,
      },
      {
        id: 'responsive-desktop',
        label: 'Responsive - Desktop (1440px)',
        required: true,
        description: 'Layout is correct at desktop viewport',
        completed: false,
      },
      {
        id: 'touch-targets',
        label: 'Touch Targets - 40x40px minimum',
        required: true,
        description: 'All interactive elements have at least 40x40px hit area on mobile',
        completed: false,
      },
      {
        id: 'design-vs-code',
        label: 'Side-by-side comparison',
        required: true,
        description: 'Compare implementation against design at each viewport',
        completed: false,
      },
    ];
  }
}
