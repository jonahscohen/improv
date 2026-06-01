import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LayerStack } from './LayerStack';
import type { LayerConfig, Manifest } from '../../../runtime/types';

function layer(effectId: string, role: LayerConfig['layerRole']): LayerConfig {
  return { effectId, layerRole: role, params: {}, blendMode: 'source-over', enabled: true, opacity: 1 };
}

function manifest(id: string, role: Manifest['layerRole']): Manifest {
  return {
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
    tags: [],
  };
}

/** Read the channel names in DISPLAYED order (top of panel first). */
function displayedNames(): string[] {
  const items = Array.from(document.querySelectorAll('.channel'));
  return items.map((li) => within(li as HTMLElement).getByText(
    (_, el) => el?.className === 'channel__name',
  ).textContent ?? '');
}

describe('LayerStack ordering (Photoshop/Figma convention)', () => {
  const catalog = [
    manifest('grad', 'background'),
    manifest('globe', 'midground'),
    manifest('ascii', 'post'),
  ];
  const noop = () => {};

  it('displays the topmost (last paint-order) layer first, reversing the store array', () => {
    // Store/paint order: index 0 = bottommost, last index = topmost.
    const layers = [layer('grad', 'background'), layer('globe', 'midground'), layer('ascii', 'post')];
    render(
      <LayerStack
        layers={layers}
        catalog={catalog}
        lastReason={null}
        onRemove={noop}
        onReorder={noop}
        onParam={noop}
      />,
    );
    // The panel shows the topmost layer (ascii, last in the array) at the TOP.
    expect(displayedNames()).toEqual(['ascii', 'globe', 'grad']);
  });

  it('places a newly added layer at the top of the displayed list', () => {
    // A new layer is appended to the end of the store array (topmost z); the
    // reversed display must therefore show it first.
    const layers = [layer('grad', 'background'), layer('globe', 'midground')];
    const { rerender } = render(
      <LayerStack
        layers={layers}
        catalog={catalog}
        lastReason={null}
        onRemove={noop}
        onReorder={noop}
        onParam={noop}
      />,
    );
    expect(displayedNames()).toEqual(['globe', 'grad']);

    // Simulate the store appending a freshly added layer.
    rerender(
      <LayerStack
        layers={[...layers, layer('ascii', 'post')]}
        catalog={catalog}
        lastReason={null}
        onRemove={noop}
        onReorder={noop}
        onParam={noop}
      />,
    );
    expect(displayedNames()[0]).toBe('ascii');
  });

  it('"Move up" raises a layer toward the top (higher store index)', () => {
    const onReorder = vi.fn();
    const layers = [layer('grad', 'background'), layer('globe', 'midground'), layer('ascii', 'post')];
    render(
      <LayerStack
        layers={layers}
        catalog={catalog}
        lastReason={null}
        onRemove={noop}
        onReorder={onReorder}
        onParam={noop}
      />,
    );
    // The middle card in the panel is 'globe' (store index 1). Moving it up
    // should swap it with 'ascii' (store index 2): reorder(1, 2).
    fireEvent.click(screen.getByRole('button', { name: 'Move globe up' }));
    expect(onReorder).toHaveBeenCalledWith(1, 2);
  });

  it('"Move down" lowers a layer toward the bottom (lower store index)', () => {
    const onReorder = vi.fn();
    const layers = [layer('grad', 'background'), layer('globe', 'midground'), layer('ascii', 'post')];
    render(
      <LayerStack
        layers={layers}
        catalog={catalog}
        lastReason={null}
        onRemove={noop}
        onReorder={onReorder}
        onParam={noop}
      />,
    );
    // 'globe' (store index 1) moved down swaps with 'grad' (store index 0).
    fireEvent.click(screen.getByRole('button', { name: 'Move globe down' }));
    expect(onReorder).toHaveBeenCalledWith(1, 0);
  });

  it('disables "Move up" on the topmost card and "Move down" on the bottommost', () => {
    const layers = [layer('grad', 'background'), layer('ascii', 'post')];
    render(
      <LayerStack
        layers={layers}
        catalog={catalog}
        lastReason={null}
        onRemove={noop}
        onReorder={noop}
        onParam={noop}
      />,
    );
    // ascii is topmost (displayed first): cannot move up.
    expect(screen.getByRole('button', { name: 'Move ascii up' }).hasAttribute('disabled')).toBe(true);
    // grad is bottommost (displayed last): cannot move down.
    expect(screen.getByRole('button', { name: 'Move grad down' }).hasAttribute('disabled')).toBe(true);
  });
});
