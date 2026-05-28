import { describe, it, expect } from 'vitest';
import { isDynamicClassName, filterClasses } from '../../core/selection.js';

describe('isDynamicClassName', () => {
  it('detects CSS module hashes', () => {
    expect(isDynamicClassName('_header_abc12')).toBe(true);
    expect(isDynamicClassName('styles_button_xY9k2')).toBe(false); // doesn't start with _
  });

  it('detects styled-components hashes', () => {
    expect(isDynamicClassName('css-1a2b3c')).toBe(true);
    expect(isDynamicClassName('sc-bdnxRM')).toBe(true);
  });

  it('preserves semantic class names', () => {
    expect(isDynamicClassName('btn')).toBe(false);
    expect(isDynamicClassName('btn-primary')).toBe(false);
    expect(isDynamicClassName('hero-section')).toBe(false);
    expect(isDynamicClassName('container')).toBe(false);
  });

  it('preserves Tailwind utility classes', () => {
    expect(isDynamicClassName('px-4')).toBe(false);
    expect(isDynamicClassName('bg-blue-500')).toBe(false);
    expect(isDynamicClassName('flex')).toBe(false);
    expect(isDynamicClassName('text-lg')).toBe(false);
  });
});

describe('filterClasses', () => {
  it('removes dynamic classes, keeps semantic and utility', () => {
    const result = filterClasses(['btn', 'btn-primary', '_header_abc12', 'css-1a2b3c', 'px-4']);
    expect(result).toEqual(['btn', 'btn-primary', 'px-4']);
  });

  it('returns empty array for all-dynamic input', () => {
    const result = filterClasses(['_x_abc12', 'css-xyz']);
    expect(result).toEqual([]);
  });
});
