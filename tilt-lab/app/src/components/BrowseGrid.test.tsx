import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowseGrid } from './BrowseGrid';
import type { Manifest } from '../../../runtime/types';

const m = (id: string, role: Manifest['layerRole']): Manifest => ({
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
});
const catalog = [m('grad', 'background'), m('globe', 'midground')];

describe('BrowseGrid', () => {
  it('renders a card per catalog entry', () => {
    render(<BrowseGrid catalog={catalog} onPick={() => {}} />);
    expect(screen.getByText('grad')).toBeTruthy();
    expect(screen.getByText('globe')).toBeTruthy();
  });

  it('calls onPick with the manifest when a card is clicked', () => {
    const onPick = vi.fn();
    render(<BrowseGrid catalog={catalog} onPick={onPick} />);
    fireEvent.click(screen.getByText('grad'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'grad' }));
  });

  it('filters by search query', () => {
    render(<BrowseGrid catalog={catalog} onPick={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Search effects'), {
      target: { value: 'globe' },
    });
    expect(screen.queryByText('grad')).toBeNull();
    expect(screen.getByText('globe')).toBeTruthy();
  });
});
