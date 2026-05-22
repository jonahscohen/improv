// Flow B: Component Research
// Research component patterns and interaction states against design system
// Applies interaction domain (8 states) + writing domain (labels, microcopy)

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult, ChecklistItem } from './flow-handler';
import { ComponentGalleryReference } from './reference-systems';
import { ComponentGalleryReferenceImpl } from './component-gallery-reference';
import { SHARED_DESIGN_LAWS } from './design-laws';

export interface ComponentResearchContext {
  componentPatterns: string[];
  interactionRules: string[];
  writingRules: string[];
  semanticMarkup: Record<string, string>;
  a11yPatterns: Record<string, string>;
  validationResults: {
    componentName: string;
    wcagStatus: 'pass' | 'fail' | 'warning';
    issues: string[];
  }[];
}

export class FlowBComponentResearchHandler extends BaseFlowHandler {
  private componentGalleryRef: ComponentGalleryReference;
  private cachedComponentContext?: ComponentResearchContext;

  constructor() {
    super('flowB_component_research');
    this.componentGalleryRef = new ComponentGalleryReferenceImpl();
  }

  canExecute(context: FlowExecutionContext): boolean {
    // Flow B requires project context with brand personality and design system
    return !!(
      context.projectContext?.product?.brandPersonality ||
      context.projectContext?.product?.brand_personality
    );
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const brandPersonality = context.projectContext?.product?.brandPersonality || context.projectContext?.product?.brand_personality;
    const designApproach = context.projectContext?.design?.components?.approach || 'undefined';

    try {
      // Get interaction domain rules (8 component states)
      const interactionDomain = SHARED_DESIGN_LAWS.interaction;
      const interactionRules = interactionDomain.rules.map((rule) => `- ${rule}`);

      // Get writing domain rules (labels, microcopy, copy consistency)
      const writingDomain = SHARED_DESIGN_LAWS.writing;
      const writingRules = writingDomain.rules.map((rule) => `- ${rule}`);

      // Get component patterns from gallery
      const componentPatterns = await this.componentGalleryRef.getComponentPatterns(
        designApproach || 'standard',
        context.projectContext?.register || 'product'
      );

      // Get semantic markup for key components
      const semanticMarkup: Record<string, string> = {};
      for (const component of componentPatterns.slice(0, 5)) {
        semanticMarkup[component.name] = await this.componentGalleryRef.getSemanticMarkup(component.name);
      }

      // Get a11y patterns for interaction validation
      const a11yPatterns: Record<string, string> = {};
      for (const component of componentPatterns.slice(0, 5)) {
        const patterns = await this.componentGalleryRef.getA11yPatterns(component.name);
        a11yPatterns[component.name] = patterns.join(', ');
      }

      // Get interaction states (8 component states: default, hover, focus, active, disabled, loading, error, success)
      const interactionStates: Record<string, string[]> = {};
      for (const component of componentPatterns.slice(0, 5)) {
        const states = await this.componentGalleryRef.getInteractionStates(component.name);
        interactionStates[component.name] = states;
      }

      // Validate component patterns against WCAG
      const validationResults: { componentName: string; wcagStatus: 'pass' | 'fail' | 'warning'; issues: string[] }[] = [];
      for (const component of componentPatterns) {
        const wcagIssues = await this.componentGalleryRef.validateAgainstWcag(component.name);
        const status: 'pass' | 'fail' | 'warning' = wcagIssues.length === 0 ? 'pass' : 'warning';
        validationResults.push({
          componentName: component.name,
          wcagStatus: status,
          issues: wcagIssues,
        });
      }

      // Cache context for downstream flows
      this.cachedComponentContext = {
        componentPatterns: componentPatterns.map((c) => c.name),
        interactionRules: interactionDomain.rules,
        writingRules: writingDomain.rules,
        semanticMarkup,
        a11yPatterns,
        validationResults,
      };

      // Build checklist
      const checklist = this.createChecklist([
        { label: 'Brand personality defined', required: true, description: brandPersonality || 'Not specified' },
        { label: 'Design approach specified', required: true, description: designApproach || 'Not specified' },
        { label: 'Interaction domain rules reviewed (8 states)', required: true, description: `${interactionRules.length} rules loaded` },
        { label: 'Writing domain rules reviewed', required: true, description: `${writingRules.length} rules loaded` },
        { label: 'Component patterns identified', required: false, description: `${componentPatterns.length} patterns available` },
        { label: 'Semantic markup documented', required: false, description: `${Object.keys(semanticMarkup).length} components` },
        { label: 'WCAG validation complete', required: false, description: `${validationResults.length} components validated` },
      ]);

      // Build guidance
      const guidance = [
        `Brand personality: ${brandPersonality || 'Not defined'}`,
        `Design approach: ${designApproach}`,
        '',
        'Interaction Domain Rules (8 Component States):',
        ...interactionRules,
        '',
        'Default, Hover, Focus, Active, Disabled, Loading, Error, Success',
        '',
        'Writing Domain Rules (Labels & Microcopy):',
        ...writingRules,
        '',
        'Semantic Markup Requirements:',
        ...Object.entries(semanticMarkup).map(([name, markup]) => `- ${name}: use semantic ${markup}`),
        '',
        'Accessibility Patterns:',
        ...Object.entries(a11yPatterns).map(([name, pattern]) => `- ${name}: ${pattern}`),
        '',
        'Interaction States Matrix:',
        ...Object.entries(interactionStates).map(([name, states]) => `- ${name}: ${states.join(', ')}`),
        '',
        'Component Validation Results:',
        ...validationResults.map((r) => `- ${r.componentName}: ${r.wcagStatus}${r.issues.length > 0 ? ` (${r.issues.length} issues)` : ''}`),
        '',
        `${componentPatterns.length} component patterns identified. Run Flow G to implement patterns with interaction states and writing guidelines.`,
      ];

      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'success',
        message: `Component research: ${componentPatterns.length} patterns analyzed with ${interactionRules.length} interaction rules + ${writingRules.length} writing rules`,
        guidance,
        checklist,
        artifacts: componentPatterns.length > 0
          ? [
              this.createArtifact(
                'reference',
                'Component Patterns',
                componentPatterns.map((p) => `${p.name}: ${p.description}`).join('\n'),
                `${componentPatterns.length} components with semantic markup, a11y patterns, and WCAG validation`
              ),
              this.createArtifact(
                'reference',
                'Interaction States Checklist',
                ['Default', 'Hover', 'Focus', 'Active', 'Disabled', 'Loading', 'Error', 'Success'].join('\n'),
                '8 required component states for complete interaction design'
              ),
              this.createArtifact(
                'reference',
                'Writing Guidelines',
                writingRules.join('\n'),
                `${writingRules.length} rules for labels, microcopy, and copy consistency`
              ),
            ]
          : [],
      };
    } catch (err) {
      return {
        flowId: this.flowId,
        flowName: this.getFlowName(),
        status: 'error',
        message: 'Failed to research component patterns',
        error: String(err),
      };
    }
  }

  getCachedContext(): ComponentResearchContext | undefined {
    return this.cachedComponentContext;
  }
}

export function createFlowBHandler(): FlowBComponentResearchHandler {
  return new FlowBComponentResearchHandler();
}
