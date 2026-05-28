import type { EndowAdapter, AdapterEnrichment } from './types';

export class AdapterRegistry {
  private adapters = new Map<string, EndowAdapter>();

  register(adapter: EndowAdapter): void {
    if (this.adapters.has(adapter.name)) return;
    this.adapters.set(adapter.name, adapter);
  }

  enrichElement(domNode: HTMLElement): AdapterEnrichment[] {
    const results: AdapterEnrichment[] = [];
    for (const adapter of this.adapters.values()) {
      const enrichment = adapter.enrichElement(domNode);
      if (enrichment !== null) {
        results.push(enrichment);
      }
    }
    return results;
  }

  getComponentTree(domNode: HTMLElement): string[] {
    for (const adapter of this.adapters.values()) {
      const tree = adapter.getComponentTree(domNode);
      if (tree.length > 0) return tree;
    }
    return [];
  }

  freeze(): void {
    for (const adapter of this.adapters.values()) {
      adapter.freeze?.();
    }
  }

  unfreeze(): void {
    for (const adapter of this.adapters.values()) {
      adapter.unfreeze?.();
    }
  }

  getAdapterNames(): string[] {
    return Array.from(this.adapters.keys());
  }
}
