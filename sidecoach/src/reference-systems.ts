// Reference Systems
// Interfaces for 4 lean reference systems that access live sources

import { Register } from './project-context';
import { FontshareReferenceImpl } from './fontshare-reference';
import { ComponentGalleryReferenceImpl } from './component-gallery-reference';
import { DesignReferencesSystemImpl } from './design-references-reference';
import { MotionReferenceImpl } from './motion-reference';

// Component Gallery Reference - semantic markup, a11y patterns, interaction states
export interface ComponentPattern {
  name: string;
  description: string;
  semanticMarkup: string;
  ariaRequirements: string[];
  keyboardInteraction: string;
  states: string[]; // hover, focus, active, disabled, loading, error, success
  wcagRules: string[];
  examples?: string[];
}

export interface ComponentGalleryReference {
  getComponentPatterns(componentType: string, register: Register): Promise<ComponentPattern[]>;
  getSemanticMarkup(componentType: string): Promise<string>;
  getA11yPatterns(componentType: string): Promise<string[]>;
  getInteractionStates(componentType: string): Promise<string[]>;
  validateAgainstWcag(componentType: string): Promise<string[]>;
}

// Fontshare Reference - font candidates, pairing rules, OpenType features
export interface FontCandidate {
  name: string;
  family: string;
  weights: number[];
  category: 'sans-serif' | 'serif' | 'display' | 'monospace';
  pairingStrategy?: string;
  opentypeFeatures?: string[];
  webFontUrl?: string;
  fallback: string;
}

export interface FontshareReference {
  getFontCandidates(typography: string, register: Register): Promise<FontCandidate[]>;
  getPairingRules(brandPersonality: string): Promise<string[]>;
  getOpenTypeFeatures(fontName: string): Promise<string[]>;
  validateFontMetrics(fontName: string): Promise<{ lineHeight: number; descent: number; ascent: number }>;
}

// Design References - visual inspiration, patterns from catalog
export interface DesignReference {
  title: string;
  category: string;
  description: string;
  colorPalette?: string[];
  spacingPattern?: string;
  typographyApproach?: string;
  interactionPattern?: string;
  imageUrl?: string;
  sourceUrl?: string;
}

export interface DesignReferencesSystem {
  searchReferences(
    query: string,
    register: Register,
    limit?: number
  ): Promise<DesignReference[]>;
  getPatternsByCategory(
    category: string,
    register: Register
  ): Promise<DesignReference[]>;
  getCategoryReflex(category: string): Promise<string[]>; // oversaturated patterns
  addReference(reference: DesignReference): Promise<void>;
}

// Motion Reference - easing curves, timing, stagger patterns
export interface MotionPattern {
  name: string;
  description: string;
  easing: string; // CSS easing function
  duration: number; // milliseconds
  useCase: string; // 'entrance', 'exit', 'state-change', 'feedback'
  staggerBase?: number; // ms between items
  reducedMotionFallback: string;
  examples?: string[];
}

export interface MotionReference {
  getEasingCurves(intensity: 'restrained' | 'playful' | 'ambitious'): Promise<MotionPattern[]>;
  getMotionPalette(register: Register): Promise<MotionPattern[]>;
  validateMotionLaws(code: string): Promise<string[]>; // violations
  getReducedMotionAlternative(pattern: MotionPattern): Promise<MotionPattern>;
}

// Factory for creating reference systems
export interface ReferenceSystemsFactory {
  createComponentGallery(): Promise<ComponentGalleryReference>;
  createFontshare(): Promise<FontshareReference>;
  createDesignReferences(): Promise<DesignReferencesSystem>;
  createMotionReference(): Promise<MotionReference>;
}

// Stub implementations for Phase 1 (will be enhanced in Phase 2)
export class StubComponentGalleryReference implements ComponentGalleryReference {
  async getComponentPatterns(componentType: string, register: Register): Promise<ComponentPattern[]> {
    // Will be populated from component.gallery in Phase 2
    return [];
  }

  async getSemanticMarkup(componentType: string): Promise<string> {
    return `<${componentType} aria-label="Description"></${componentType}>`;
  }

  async getA11yPatterns(componentType: string): Promise<string[]> {
    return ['aria-label', 'role', 'tabindex', 'aria-disabled'];
  }

  async getInteractionStates(componentType: string): Promise<string[]> {
    return ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
  }

  async validateAgainstWcag(componentType: string): Promise<string[]> {
    return ['WCAG 2.1 AA: 4.5:1 contrast on text', 'Focus rings visible on keyboard', '44x44px touch targets'];
  }
}

export class StubFontshareReference implements FontshareReference {
  async getFontCandidates(typography: string, register: Register): Promise<FontCandidate[]> {
    // Will be populated from fontshare.com in Phase 2
    return [];
  }

  async getPairingRules(brandPersonality: string): Promise<string[]> {
    return [
      'Pair serif heading with sans-serif body',
      'Stick to 1-2 font families max',
      'Ensure 1.25+ size ratio between hierarchy levels',
    ];
  }

  async getOpenTypeFeatures(fontName: string): Promise<string[]> {
    return ['kern', 'liga', 'dlig', 'ss01', 'tabular-nums'];
  }

  async validateFontMetrics(fontName: string): Promise<{ lineHeight: number; descent: number; ascent: number }> {
    return { lineHeight: 1.5, descent: -0.2, ascent: 0.8 };
  }
}

export class StubDesignReferencesSystem implements DesignReferencesSystem {
  async searchReferences(
    query: string,
    register: Register,
    limit?: number
  ): Promise<DesignReference[]> {
    // Will be populated from project design-references catalog in Phase 2
    return [];
  }

  async getPatternsByCategory(category: string, register: Register): Promise<DesignReference[]> {
    return [];
  }

  async getCategoryReflex(category: string): Promise<string[]> {
    // Returns oversaturated patterns for this category from CATEGORY_REFLEX
    return [];
  }

  async addReference(reference: DesignReference): Promise<void> {
    // Will persist to project design-references catalog
  }
}

export class StubMotionReference implements MotionReference {
  async getEasingCurves(intensity: 'restrained' | 'playful' | 'ambitious'): Promise<MotionPattern[]> {
    const curves: Record<string, MotionPattern[]> = {
      restrained: [
        {
          name: 'ease-out-quad',
          description: 'Subtle entrance feedback',
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          duration: 150,
          useCase: 'feedback',
          reducedMotionFallback: 'none',
        },
      ],
      playful: [
        {
          name: 'ease-out-quart',
          description: 'Medium entrance with presence',
          easing: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
          duration: 300,
          useCase: 'entrance',
          reducedMotionFallback: 'opacity-fade',
        },
      ],
      ambitious: [
        {
          name: 'ease-out-quint',
          description: 'Strong entrance with momentum',
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          duration: 500,
          useCase: 'entrance',
          reducedMotionFallback: 'opacity-fade',
        },
      ],
    };
    return curves[intensity] || [];
  }

  async getMotionPalette(register: Register): Promise<MotionPattern[]> {
    // Returns motion patterns for register (restrained for product, playful/ambitious for brand)
    return [];
  }

  async validateMotionLaws(code: string): Promise<string[]> {
    const violations: string[] = [];
    if (/width|height|top|left|margin/.test(code) && /animation|transition/.test(code)) {
      violations.push('Motion anti-pattern: animating layout properties');
    }
    if (/bounce|elastic|cubic-bezier.*1\.\d/.test(code)) {
      violations.push('Motion anti-pattern: bounce or elastic easing detected');
    }
    return violations;
  }

  async getReducedMotionAlternative(pattern: MotionPattern): Promise<MotionPattern> {
    return {
      ...pattern,
      easing: 'none',
      duration: 0,
      reducedMotionFallback: 'instant',
    };
  }
}

// Production factory (Phase 3)
export class ReferenceSystemsFactoryImpl implements ReferenceSystemsFactory {
  async createComponentGallery(): Promise<ComponentGalleryReference> {
    return new ComponentGalleryReferenceImpl();
  }

  async createFontshare(): Promise<FontshareReference> {
    return new FontshareReferenceImpl();
  }

  async createDesignReferences(): Promise<DesignReferencesSystem> {
    return new DesignReferencesSystemImpl();
  }

  async createMotionReference(): Promise<MotionReference> {
    return new MotionReferenceImpl();
  }
}

// Legacy stub for backward compatibility (Phase 1)
export class StubReferenceSystemsFactory implements ReferenceSystemsFactory {
  async createComponentGallery(): Promise<ComponentGalleryReference> {
    return new StubComponentGalleryReference();
  }

  async createFontshare(): Promise<FontshareReference> {
    return new StubFontshareReference();
  }

  async createDesignReferences(): Promise<DesignReferencesSystem> {
    return new StubDesignReferencesSystem();
  }

  async createMotionReference(): Promise<MotionReference> {
    return new StubMotionReference();
  }
}
