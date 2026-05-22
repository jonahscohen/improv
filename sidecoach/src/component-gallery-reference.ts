// Component Gallery Reference Implementation
// Provides semantic markup, a11y patterns, interaction states using embedded component catalog

import { ComponentGalleryReference, ComponentPattern } from './reference-systems';
import { Register } from './project-context';
import { ReferenceDataService } from './reference-data';

export class ComponentGalleryReferenceImpl implements ComponentGalleryReference {
  private dataService: ReferenceDataService;

  constructor() {
    this.dataService = new ReferenceDataService();
  }

  async getComponentPatterns(
    componentType: string,
    register: Register
  ): Promise<ComponentPattern[]> {
    const patterns: ComponentPattern[] = [];
    const results = this.dataService.searchComponents(componentType);

    for (const result of results) {
      const pattern: ComponentPattern = {
        name: result.name,
        description: result.description,
        semanticMarkup: this.generateSemanticMarkup(result.name),
        ariaRequirements: this.extractAriaRequirements(result.accessibility),
        keyboardInteraction: this.extractKeyboardInteraction(result.variants),
        states: result.variants || ['default', 'hover', 'focus', 'active', 'disabled'],
        wcagRules: this.extractWcagRules(result.accessibility),
        examples: result.constraints || [],
      };

      patterns.push(pattern);
    }

    return patterns.slice(0, 3);
  }

  async getSemanticMarkup(componentType: string): Promise<string> {
    const component = this.dataService.getComponent(componentType);
    if (!component) return `<${componentType} role="region"></${componentType}>`;

    return this.generateSemanticMarkup(component.name);
  }

  async getA11yPatterns(componentType: string): Promise<string[]> {
    const component = this.dataService.getComponent(componentType);
    if (!component) {
      return ['aria-label', 'role', 'tabindex', 'aria-disabled'];
    }

    return this.extractAriaRequirements(component.accessibility);
  }

  async getInteractionStates(componentType: string): Promise<string[]> {
    const component = this.dataService.getComponent(componentType);
    if (!component) {
      return ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
    }

    return component.variants || ['default', 'hover', 'focus', 'active', 'disabled'];
  }

  async validateAgainstWcag(componentType: string): Promise<string[]> {
    return [
      'WCAG 2.1 AA: 4.5:1 contrast on text, 3:1 on UI components',
      'Focus rings visible on keyboard navigation',
      '44x44px minimum touch targets (40x40px minimum)',
      'All interactive elements keyboard accessible',
      'Form inputs have visible labels (not placeholders)',
      'Semantic HTML (button, link, input, not divs with role)',
      'Error messages descriptive and associated with inputs',
      'Color not sole means of conveying information',
    ];
  }

  private generateSemanticMarkup(componentName: string): string {
    const templates: { [key: string]: string } = {
      button: '<button type="button" aria-label="Action">Label</button>',
      link: '<a href="/path" aria-label="Navigate">Link text</a>',
      input_field:
        '<label for="input">Label</label><input type="text" id="input" aria-invalid="false" />',
      checkbox:
        '<label><input type="checkbox" aria-checked="false" /> Label</label>',
      radio_button:
        '<fieldset><legend>Options</legend><label><input type="radio" name="group" /> Option</label></fieldset>',
      toggle_switch: '<button role="switch" aria-checked="false" aria-label="Toggle">Off</button>',
      select_dropdown:
        '<label for="select">Select</label><select id="select"><option>Choose</option></select>',
      card: '<article role="region" aria-label="Card"><h2>Title</h2><p>Content</p></article>',
      modal_dialog:
        '<div role="dialog" aria-modal="true" aria-labelledby="title"><h2 id="title">Title</h2><p>Content</p></div>',
      tabs: '<div role="tablist"><button role="tab" aria-selected="true">Tab 1</button></div><div role="tabpanel">Content</div>',
      accordion:
        '<button aria-expanded="false" aria-controls="panel">Header</button><div id="panel" role="region">Content</div>',
    };

    return (
      templates[componentName.toLowerCase().replace(/\s+/g, '_')] ||
      `<div role="region" aria-label="${componentName}"></div>`
    );
  }

  private extractAriaRequirements(accessibility: string): string[] {
    const requirements = accessibility.split(',').map((s) => s.trim());
    const ariaPatterns = requirements.filter((r) =>
      /aria-|role=|semantic|label|heading|heading/.test(r)
    );

    if (ariaPatterns.length === 0) {
      return ['aria-label', 'role', 'tabindex'];
    }

    return ariaPatterns.slice(0, 4);
  }

  private extractKeyboardInteraction(variants: string[]): string {
    const keyboardTerms = variants.filter((v) =>
      /keyboard|focus|tab|arrow|enter|space|escape/.test(v.toLowerCase())
    );

    if (keyboardTerms.length > 0) {
      return `Keyboard: ${keyboardTerms.join(', ')}`;
    }

    return 'Tab to focus, Enter/Space to activate, Escape to close/dismiss';
  }

  private extractWcagRules(accessibility: string): string[] {
    return [
      'WCAG 2.1 AA: Perceivable - sufficient contrast',
      'WCAG 2.1 AA: Operable - keyboard accessible, no traps',
      'WCAG 2.1 AA: Understandable - semantic markup, clear labels',
      'WCAG 2.1 AA: Robust - compatible with assistive tech',
    ];
  }
}

export function createComponentGalleryReference(): ComponentGalleryReference {
  return new ComponentGalleryReferenceImpl();
}
