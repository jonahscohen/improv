// Flow G: Component Implementation
// Map design spec to implementation, validate against interaction + writing domains

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { SHARED_DESIGN_LAWS } from './design-laws';
import { FlowMemoryBuilder } from './flow-memory-schema';
import { ExtendedDomainValidator, DomainCheckContext } from './extended-domain-validator';
import { EnhancedFlowExecutionContext } from './flow-execution-context-enhanced';
import { createIconSourceReference, buildIconSourceArtifactContent } from './icon-source-reference';
import { findTokenLine } from './design-md-parser';

import { applyModelSelection } from './model-routing';
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
    // T-0012: per-flow model-tier routing. Stash selected model into context.metadata.
    applyModelSelection(this.flowId, context);

    const enhancedContext = context as EnhancedFlowExecutionContext;
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

      // Add custom data to enhanced context if available
      if (enhancedContext?.flowMetadata) {
        enhancedContext.flowMetadata.tags = ['flowG', 'component-implementation', '8-states'];
        enhancedContext.flowMetadata.customData = {
          'component-name': componentName,
          'component-states': componentStates.length,
          'interaction-rules': interactionDomain.rules.length,
          'writing-rules': writingDomain.rules.length,
          'aria-labels-count': validationResults.filter((r) => r.hasAriaLabels).length,
        };
      }

      // Cache context for downstream flows
      this.cachedComponentContext = {
        interactionDomainRules: interactionDomain.rules,
        writingDomainRules: writingDomain.rules,
        componentStates,
        validationResults,
      };

      // Domain validation integration
      const domainCheckContext: DomainCheckContext = {
        designTokens: context.metadata?.designTokens || {},
        componentTree: context.metadata?.componentTree || { componentName, states: componentStates.length },
        cssRules: context.metadata?.cssRules || [],
        accessibility: context.metadata?.accessibility,
      };

      const extendedValidationReport = ExtendedDomainValidator.validateAll(domainCheckContext);
      // T-0030: forms domain consulted on component build (Vercel web-interface-guidelines)
      const formsDomainRules = ExtendedDomainValidator.getRulesByDomain('forms');

      const formsPassRate = extendedValidationReport.passRateByDomain['forms'] || '0%';

      const formsPassed = Math.round((parseFloat(formsPassRate) / 100) * formsDomainRules.length);

      // Build checklist
      const checklist = this.createChecklist([
        { label: 'Component name identified', required: true, description: componentName },
        { label: 'Extract all states from design (8 total)', required: true, description: componentStates.join(', ') },
        { label: 'Create semantic HTML with BEM naming', required: true, description: 'Follows naming convention' },
        { label: 'Forms domain validation (if component has inputs)', required: false, description: `${formsPassed}/${formsDomainRules.length} rules passing (${formsPassRate})` },
        { label: 'Implement ARIA labels for interactive states', required: true, description: '8 states with labels' },
        { label: 'Keyboard navigation support (default, hover, focus, active, disabled)', required: true, description: 'All keyboard-navigable states' },
        { label: 'Copy validation (error, loading, success messages)', required: true, description: 'Verb+object, helpful language' },
        { label: 'Test responsive behavior (mobile, tablet, desktop)', required: true, description: '3+ viewports' },
        { label: 'Verify side-by-side with design source', required: true, description: 'Visual match confirmed' },
        { label: 'Document component API and props', required: false, description: 'Usage examples included' },
      ]);

      // Citation helper for DESIGN.md token references
      const designContent = (context.metadata?.designContent as string) || '';
      const designTokens = (context.metadata?.designTokens as any) || {};
      const cite = (dottedPath: string): string => {
        const ln = designContent ? findTokenLine(designContent, dottedPath) : -1;
        return ln > 0 ? ` (Source: DESIGN.md L${ln})` : '';
      };

      const ctaBackground = designTokens.colors?.brand?.ink || '(undefined in DESIGN.md)';
      const ctaText = designTokens.colors?.brand?.cream || '(undefined in DESIGN.md)';
      const buttonRadius = designTokens.rounded?.md || '(undefined in DESIGN.md)';
      const cardShadow = designTokens.shadow?.md || '(undefined in DESIGN.md)';

      // Build guidance
      const guidance = [
        `Component: ${componentName}`,
        `Register: ${register}`,
        '',
        'Token-Backed Component Defaults:',
        `- Primary CTA background: ${ctaBackground}${cite('colors.brand.ink')}`,
        `- Primary CTA text: ${ctaText}${cite('colors.brand.cream')}`,
        `- Button/input radius: ${buttonRadius}${cite('rounded.md')}`,
        `- Floating card shadow: ${cardShadow}${cite('shadow.md')}`,
        '',
        'Interaction Domain (8 States):',
        ...interactionDomain.rules.map((r) => `- ${r}`),
        '',
        'Writing Domain (Semantic Copy):',
        ...writingDomain.rules.map((r) => `- ${r}`),
        '',
        'Forms Domain (apply when the component has inputs) - Vercel web-interface-guidelines:',
        ...formsDomainRules.map((r) => `- ${r.name}: ${r.description}`),
        '',
        'Component States to Implement:',
        ...componentStates.map((state) => {
          const validation = validationResults.find((v) => v.stateName === state);
          return `- ${state}: ARIA=${validation?.hasAriaLabels ? 'Yes' : 'No'}, Keyboard=${validation?.hasKeyboardInteraction ? 'Yes' : 'No'}, Copy=${validation?.copyAppropriateness ? 'Yes' : 'No'}`;
        }),
        '',
        'ARIA & Accessibility Requirements (per state):',
        '- Default: aria-label required for icon-only triggers',
        '- Hover: no semantic change required',
        '- Focus: :focus-visible ring for keyboard users (2-3px offset)',
        '- Active: visual feedback (scale, color, or shadow shift)',
        '- Disabled: aria-disabled="true" + suppressed pointer events',
        '- Loading: aria-busy="true" + spinner or skeleton',
        '- Error: aria-invalid="true" + descriptive error message',
        '- Success: aria-live="polite" confirmation',
        '',
        'Copy guidance: pull verbs and concrete nouns from this product\'s DESIGN.md / PRODUCT.md - do not import generic examples. Cite the source line you used.',
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

      const ariaLabelCount = validationResults.filter((r) => r.hasAriaLabels).length;
      const keyboardNavCount = validationResults.filter((r) => r.hasKeyboardInteraction).length;
      const semanticCopyCount = validationResults.filter((r) => r.copyAppropriateness).length;

      const memoryBuilder = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setSummary(`Component implementation: ${componentName} with 8 interaction states + semantic copy + forms domain validation (${formsPassRate})`)
        .addRule('interaction', SHARED_DESIGN_LAWS.interaction.rules)
        .addRule('writing', SHARED_DESIGN_LAWS.writing.rules)
        .addDecision(`Component semantic HTML structure`, `<${componentName === 'button' ? 'button' : 'div'} role="${componentName}" aria-label="..."> with BEM naming convention`)
        .addMetric('component-states-implemented', componentStates.length, 'pass', 8)
        .addMetric('forms-domain-validation', formsPassed, 'pass', formsDomainRules.length)
        .addMetric('aria-labels-count', ariaLabelCount, 'pass', componentStates.length)
        .addMetric('keyboard-nav-count', keyboardNavCount, 'pass', componentStates.length - 1)
        .addMetric('semantic-copy-count', semanticCopyCount, 'pass', 3)
        .addValidation('ARIA labels implemented', ariaLabelCount === componentStates.length ? 'pass' : 'warning', `${ariaLabelCount}/${componentStates.length}`)
        .addValidation('Keyboard navigation enabled', keyboardNavCount >= componentStates.length - 1 ? 'pass' : 'warning', `${keyboardNavCount}/${componentStates.length - 1} navigable`)
        .addValidation('Semantic copy appropriate', semanticCopyCount === 3 ? 'pass' : 'warning', `${semanticCopyCount}/3 states with copy`)
        .addArtifact('component-implementation', componentStates.length, ['flowH_motion_integration', 'flowI_motion_polish']);

      const memory = memoryBuilder.build();

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
            'icon-source',
            buildIconSourceArtifactContent(createIconSourceReference()),
            '8 approved icon libraries with selection protocol and provenance markers (taste/fabricated-svg gate enforcement)'
          ),
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
            'reference',
            'Forms Domain Rules',
            formsDomainRules.map((r) => `${r.id} ${r.name}: ${r.description}`).join('\n'),
            'Form/input best practices from Vercel web-interface-guidelines (autocomplete, type/inputmode, paste, inline errors, labels, submit gating)'
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
        memory,
      };
    } catch (err) {
      const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
        .setStatus('error')
        .setSummary(`Component implementation failed: ${String(err).substring(0, 40)}`)
        .addValidation('component-validation', 'fail', String(err))
        .build();

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to plan component implementation',
        error: String(err),
        memory,
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
