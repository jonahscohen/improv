import { describe, it, expect } from 'vitest';
import { createStackStore } from './stackStore';
import type { Manifest } from '../../../runtime/types';

const m = (id: string, role: Manifest['layerRole']): Manifest => ({
  id,
  name: id,
  category: role,
  layerRole: role,
  params: [{ name: 'speed', type: 'range', default: 1, min: 0, max: 5 }],
  requiredAssets: [],
  origin: 'x',
  license: 'MIT',
  attribution: 'x',
  redistribution: 'ok',
  tags: [],
});

describe('createStackStore', () => {
  it('adds a layer and exposes it', () => {
    const s = createStackStore();
    const res = s.add(m('grad', 'background'));
    expect(res.ok).toBe(true);
    expect(s.layers().map((l) => l.effectId)).toEqual(['grad']);
  });

  it('seeds default params on add', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    expect(s.layers()[0].params.speed).toBe(1);
  });

  it('rejects a second background with a reason', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    const res = s.add(m('aurora', 'background'));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/background/);
    expect(s.layers().length).toBe(1);
  });

  it('removes a layer by index', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    s.add(m('globe', 'midground'));
    s.remove(0);
    expect(s.layers().map((l) => l.effectId)).toEqual(['globe']);
  });

  it('setParam updates a layer param', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    s.setParam(0, 'speed', 3);
    expect(s.layers()[0].params.speed).toBe(3);
  });

  it('setParam expands a preset selector into its full value-set', () => {
    // Real registered effect id so the preset registry kicks in.
    const ag: Manifest = {
      id: 'animated-gradient',
      name: 'animated-gradient',
      category: 'gradient',
      layerRole: 'background',
      params: [
        { name: 'preset', type: 'select', default: 'custom', options: ['custom', 'Lava'] },
        { name: 'color1', type: 'color', default: '#050505' },
        { name: 'swirl', type: 'range', default: 80, min: 0, max: 100 },
      ],
      requiredAssets: [],
      origin: 'x',
      license: 'MIT',
      attribution: 'x',
      redistribution: 'ok',
      tags: [],
    };
    const s = createStackStore();
    s.add(ag);
    expect(s.layers()[0].params.color1).toBe('#050505');
    s.setParam(0, 'preset', 'Lava');
    const params = s.layers()[0].params;
    expect(params.preset).toBe('Lava');
    expect(params.color1).toBe('#FF9F21'); // Lava's color, written by the expansion
    expect(params.swirl).toBe(18);
  });

  it('reorder moves a layer', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    s.add(m('globe', 'midground'));
    s.reorder(1, 0);
    expect(s.layers().map((l) => l.effectId)).toEqual(['globe', 'grad']);
  });

  it('notifies subscribers on change', () => {
    const s = createStackStore();
    let calls = 0;
    s.subscribe(() => {
      calls += 1;
    });
    s.add(m('grad', 'background'));
    expect(calls).toBe(1);
  });
});
