import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeBuffer } from '../../core/change-buffer.js';

describe('ChangeBuffer', () => {
  let buffer: ChangeBuffer;

  beforeEach(() => {
    buffer = new ChangeBuffer();
  });

  it('adds changes with auto-incrementing IDs', () => {
    buffer.add('.btn', 'padding', '12px', '16px');
    buffer.add('.card', 'margin', '0', '8px');
    expect(buffer.getAll()).toHaveLength(2);
    expect(buffer.getAll()[0].id).toBeDefined();
  });

  it('updates existing change for same selector + property', () => {
    buffer.add('.btn', 'padding', '12px', '16px');
    buffer.add('.btn', 'padding', '12px', '24px');
    expect(buffer.getAll()).toHaveLength(1);
    expect(buffer.getAll()[0].newValue).toBe('24px');
  });

  it('removes a change by ID', () => {
    buffer.add('.btn', 'padding', '12px', '16px');
    const id = buffer.getAll()[0].id;
    buffer.remove(id);
    expect(buffer.getAll()).toHaveLength(0);
  });

  it('clears all changes and returns them', () => {
    buffer.add('.btn', 'padding', '12px', '16px');
    buffer.add('.card', 'margin', '0', '8px');
    const flushed = buffer.flush();
    expect(flushed).toHaveLength(2);
    expect(buffer.getAll()).toHaveLength(0);
  });

  it('reports correct count', () => {
    expect(buffer.count()).toBe(0);
    buffer.add('.btn', 'padding', '12px', '16px');
    expect(buffer.count()).toBe(1);
  });
});
