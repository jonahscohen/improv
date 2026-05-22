// Design References System Implementation
// Provides visual inspiration, patterns from catalog using embedded design references

import { DesignReferencesSystem, DesignReference } from './reference-systems';
import { Register } from './project-context';
import { ReferenceDataService } from './reference-data';

export class DesignReferencesSystemImpl implements DesignReferencesSystem {
  private dataService: ReferenceDataService;
  private categoryReflex: Map<string, string[]> = new Map([
    ['button', ['gradient fills', 'neon glows', 'glassmorphism', 'neumorphism']],
    ['card', ['shadow stacks', 'border gradients', 'background patterns']],
    ['form', ['label overlays', 'inline validation', 'floating labels']],
    ['modal', ['blur backdrops', 'scale-in animations', 'side slides']],
    ['color', ['monochrome', 'analogous pairs', 'gradient meshes']],
  ]);

  constructor() {
    this.dataService = new ReferenceDataService();
  }

  async searchReferences(
    query: string,
    register: Register,
    limit?: number
  ): Promise<DesignReference[]> {
    const references = this.dataService.searchDesignReferences(query);

    // Filter by register personality if available
    if (register && references.length > 0) {
      // Prefer references that match register tone
      const filtered = references.filter((ref) => {
        const refFeel = (ref.feel || []).join(' ').toLowerCase();
        const productFeels = ['minimal', 'clean', 'restrained'];
        const brandFeels = ['playful', 'bold', 'energetic'];

        if (register === 'product') {
          return productFeels.some((f) => refFeel.includes(f));
        } else if (register === 'brand') {
          return brandFeels.some((f) => refFeel.includes(f));
        }
        return true;
      });

      return filtered.slice(0, limit || 5);
    }

    return references.slice(0, limit || 5);
  }

  async getPatternsByCategory(category: string, register: Register): Promise<DesignReference[]> {
    return this.dataService.getDesignReferencesByCategory(category);
  }

  async getCategoryReflex(category: string): Promise<string[]> {
    // Returns oversaturated patterns to avoid in this category
    return this.categoryReflex.get(category.toLowerCase()) || [];
  }

  async addReference(reference: DesignReference): Promise<void> {
    // In production would persist to ~/.claude/design-references/
    // For now this is a no-op as data is embedded
  }
}

export function createDesignReferencesSystem(): DesignReferencesSystem {
  return new DesignReferencesSystemImpl();
}
