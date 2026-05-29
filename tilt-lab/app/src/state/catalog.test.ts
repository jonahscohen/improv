import { describe, it, expect } from 'vitest';
import { filterCatalog } from './catalog';
import type { Manifest } from '../../../runtime/types';

const m = (id: string, role: Manifest['layerRole'], tags: string[]): Manifest => ({
  id,
  name: id,
  category: role,
  layerRole: role,
  params: [],
  requiredAssets: [],
  origin: 'x',
  license: 'MIT',
  attribution: 'x',
  redistribution: 'ok',
  tags,
});

const catalog = [
  m('grad', 'background', ['gradient']),
  m('globe', 'midground', ['3d']),
  m('ascii', 'post', ['retro']),
];

describe('filterCatalog', () => {
  it('returns all with no filters', () => {
    expect(filterCatalog(catalog, { query: '', role: null }).length).toBe(3);
  });
  it('filters by layer role', () => {
    expect(filterCatalog(catalog, { query: '', role: 'post' }).map((x) => x.id)).toEqual(['ascii']);
  });
  it('filters by case-insensitive query over name + tags', () => {
    expect(filterCatalog(catalog, { query: 'GRAD', role: null }).map((x) => x.id)).toEqual(['grad']);
    expect(filterCatalog(catalog, { query: '3d', role: null }).map((x) => x.id)).toEqual(['globe']);
  });
});
