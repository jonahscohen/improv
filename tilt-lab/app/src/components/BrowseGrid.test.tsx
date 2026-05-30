import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowseGrid } from './BrowseGrid';
import type { Manifest } from '../../../runtime/types';

const m = (
  id: string,
  name: string,
  role: Manifest['layerRole'],
): Manifest => ({
  id,
  name,
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

const catalog = [
  m('aurora', 'Aurora', 'background'),
  m('swarm', 'Swarm', 'midground'),
  m('cursor-trail', 'Cursor Trail', 'pointer'),
];

describe('BrowseGrid', () => {
  it('renders a card per catalog entry', () => {
    render(<BrowseGrid catalog={catalog} onPick={() => {}} />);
    expect(screen.getByText('Aurora')).toBeTruthy();
    expect(screen.getByText('Swarm')).toBeTruthy();
    expect(screen.getByText('Cursor Trail')).toBeTruthy();
  });

  it('reports the visible effect count', () => {
    render(<BrowseGrid catalog={catalog} onPick={() => {}} />);
    expect(screen.getByText('3 effects')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Search effects'), {
      target: { value: 'aurora' },
    });
    expect(screen.getByText('1 effect')).toBeTruthy();
  });

  it('filters by search query', () => {
    render(<BrowseGrid catalog={catalog} onPick={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Search effects'), {
      target: { value: 'swarm' },
    });
    expect(screen.queryByText('Aurora')).toBeNull();
    expect(screen.getByText('Swarm')).toBeTruthy();
    expect(screen.queryByText('Cursor Trail')).toBeNull();
  });

  it('calls onPick with the manifest when a card is clicked', () => {
    const onPick = vi.fn();
    render(<BrowseGrid catalog={catalog} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /aurora/i }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aurora' }),
    );
  });

  it('shows an empty state when nothing matches', () => {
    render(<BrowseGrid catalog={catalog} onPick={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Search effects'), {
      target: { value: 'zzzzz' },
    });
    expect(screen.getByText('No effects match.')).toBeTruthy();
  });
});
