import { builtinManifests } from '../../../runtime/index';
import type { Manifest, LayerRole } from '../../../runtime/types';

export interface CatalogFilter {
  query: string;
  role: LayerRole | null;
}

/** The full effect catalog: every registered built-in manifest (already validated). */
export function loadCatalog(): Manifest[] {
  return builtinManifests;
}

export function filterCatalog(catalog: Manifest[], filter: CatalogFilter): Manifest[] {
  const q = filter.query.trim().toLowerCase();
  return catalog.filter((m) => {
    if (filter.role && m.layerRole !== filter.role) return false;
    if (!q) return true;
    const haystack = [m.name, m.id, ...m.tags].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
