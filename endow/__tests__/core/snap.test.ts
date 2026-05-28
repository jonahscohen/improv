import { describe, it, expect } from 'vitest';
import { computeSnap, type SnapTarget } from '../../core/layout/snap.js';

describe('computeSnap', () => {
  const targets: SnapTarget[] = [
    { x: 100, y: 100, width: 200, height: 50 },
    { x: 400, y: 200, width: 150, height: 80 },
  ];

  it('snaps left edge to existing right edge', () => {
    const result = computeSnap({ x: 298, y: 150, width: 100, height: 40 }, targets);
    expect(result.snappedX).toBe(300);
  });

  it('no snap when beyond threshold', () => {
    const result = computeSnap({ x: 250, y: 150, width: 100, height: 40 }, targets);
    expect(result.snappedX).toBe(250);
  });

  it('snaps top edge to existing bottom edge', () => {
    const result = computeSnap({ x: 100, y: 148, width: 100, height: 40 }, targets);
    expect(result.snappedY).toBe(150);
  });

  it('returns guide lines for snapped edges', () => {
    const result = computeSnap({ x: 298, y: 150, width: 100, height: 40 }, targets);
    expect(result.guides.length).toBeGreaterThan(0);
  });
});
