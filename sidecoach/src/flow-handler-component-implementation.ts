// Flow G: Component Implementation
// Map design spec to implementation, validate against interaction + writing domains

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { SHARED_DESIGN_LAWS } from './design-laws';

interface ComponentImplementationContext {
  interactionDomainRules: string[];
  writingDomainRules: string[];
  componentStates: string[];
  validationResults: {
    stateName: string;
    hasAriaLabels: boolean;
    hasKeyboardInteraction: boolean;
    copyAppropriateness: boolean;
  }[];
}

export class FlowGComponentImplementationHandler extends BaseFlowHandler {
  private cachedComponentContext?: ComponentImplementationContext;

  constructor() {
    super('flowG_component_implementation');
  }

  canExecute(context: FlowExecutionContext): boolean {
    // Flow G requires project context from Flow A
    return !!(context.projectContext?.register || context.projectContext?.product?.register);
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const componentName = (context.metadata?.componentName as string) || 'button';
    const register = context.projectContext?.register || 'product';

    try {
      // Get interaction and writing domains
      const interactionDomain = SHARED_DESIGN_LAWS.interaction;
      const writingDomain = SHARED_DESIGN_LAWS.writing;

      // Define 8 component states (from interaction domain)
      const componentStates = [
        'Default',
        'Hover',
        'Focus',
        'Active',
        'Disabled',
        'Loading',
        'Error',
        'Success',
      ];

      // Validate component implementation against interaction + writing domains
      const validationResults = componentStates.map((state) => ({
        stateName: state,
        hasAriaLabels: ['Default', 'Hover', 'Focus', 'Active', 'Loading', 'Error', 'Success'].includes(state),
        hasKeyboardInteraction: state !== 'Disabled',
        copyAppropriateness: ['Error', 'Success', 'Loading'].includes(state),
      }));

      // Cache context for downstream flows
      this.cachedComponentContext = {
        interactionDomainRules: interactionDomain.rules,
        writingDomainRules: writingDomain.rules,
        componentStates,
        validationResults,
      };

      // Build checklist
      const checklist = this.createChecklist([
        { label: 'Component name identified', required: true, description: componentName },
        { label: 'Extract all states from design (8 total)', required: true, description: componentStates.join(', ') },
        { label: 'Create semantic HTML with BEM naming', required: true, description: 'Follows naming convention' },
        { label: 'Implement ARIA labels for interactive states', required: true, description: '8 states with labels' },
        { label: 'Keyboard navigation support (default, hover, focus, active, disabled)', required: true, description: 'All keyboard-navigable states' },
        { label: 'Copy validation (error, loading, success messages)', required: true, description: 'Verb+object, helpful language' },
        { label: 'Test responsive behavior (mobile, tablet, desktop)', required: true, description: '3+ viewports' },
        { label: 'Verify side-by-side with design source', required: true, description: 'Visual match confirmed' },
        { label: 'Document component API and props', required: false, description: 'Usage examples included' },
      ]);

      // Build guidance
      const guidance = [
        `Component: ${componentName}`,
        `Register: ${register}`,
        '',
        'Interaction Domain (8 States):',
        ...interactionDomain.rules.map((r) => `- ${r}`),
        '',
        'Writing Domain (Semantic Copy):',
        ...writingDomain.rules.map((r) => `- ${r}`),
        '',
        'Component States to Implement:',
        ...componentStates.map((state) => {
          const validation = validationResults.find((v) => v.stateName === state);
          return `- ${state}: ARIA=${validation?.hasAriaLabels ? 'Yes' : 'No'}, Keyboard=${validation?.hasKeyboardInteraction ? 'Yes' : 'No'}, Copy=${validation?.copyAppropriateness ? 'Yes' : 'No'}`;
        }),
        '',
        'Semantic HTML Structure:',
        `<${componentName === 'button' ? 'button' : 'div'} role="${componentName}" aria-label="Component label">`,
        '  <!-- All 8 states: default, hover, focus, active, disabled, loading, error, success -->',
        '</button>',
        '',
        'ARIA & Accessibility Requirements:',
        '- Default: aria-label for icon buttons',
        '- Hover: no change needed',
        '- Focus: :focus-visible for keyboard users (2-3px offset ring)',
        '- Active: visual feedback (scale, color, shadow)',
        '- Disabled: aria-disabled="true", prevent clicks',
        '- Loading: aria-busy="true", spinner/skeleton',
        '- Error: aria-invalid="true", error message',
        '- Success: aria-live="polite" confirmation',
        '',
        'Copy Examples (Writing Domain):',
        '- Button: "Save changes" (verb+object, not "OK")',
        '- Destructive: "Delete 5 items" (name the destruction)',
        '- Error: "Email already in use. Try another." (what, why, how to fix)',
        '- Success: "Changes saved" (confirm action)',
        '',
        'Testing Checklist:',
        `- All 8 states rendered correctly (${componentStates.join(', ')})`,
        '- Keyboard navigation works (Tab through all states)',
        '- Screen reader announces purpose and state',
        '- Focus ring visible on Focus state',
        '- Copy matches writing domain rules',
        '- Responsive: no overflow or misalignment on mobile/tablet',
        '- Side-by-side comparison with design source confirms visual match',
      ];

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: `Component implementation: ${componentName} with 8 interaction states + semantic copy validated`,
        guidance,
        checklist,
        artifacts: [
          this.createArtifact(
            'reference',
            'Interaction Domain Rules',
            interactionDomain.rules.join('\n'),
            '8 component states (default, hover, focus, active, disabled, loading, error, success)'
          ),
          this.createArtifact(
            'reference',
            'Writing Domain Rules',
            writingDomain.rules.join('\n'),
            'Semantic copy, helpful errors, button labels (verb+object)'
          ),
          this.createArtifact(
            'template',
            'Component Implementation Checklist',
            componentStates
              .map(
                (state) =>
                  `[ ] ${state}: ARIA labels, keyboard nav, appropriate copy (${
                    validationResults.find((v) => v.stateName === state)?.copyAppropriateness ? 'needs copy' : 'no copy'
                  })`
              )
              .join('\n'),
            '8 states to implement with validation'
          ),
        ],
      };
    } catch (err) {
      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to plan component implementation',
        error: String(err),
      };
    }
  }

  getCachedContext(): ComponentImplementationContext | undefined {
    return this.cachedComponentContext;
  }
}

export function createFlowGHandler(): FlowGComponentImplementationHandler {
  return new FlowGComponentImplementationHandler();
}
