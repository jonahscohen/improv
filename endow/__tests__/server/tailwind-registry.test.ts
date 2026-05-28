import { describe, it, expect } from 'vitest';
import {
  resolveUtilityClass,
  findClassForValue,
  isTailwindClass,
} from '../../server/tailwind-registry.js';

describe('resolveUtilityClass', () => {
  it('resolves p-4 to padding 1rem', () => {
    const result = resolveUtilityClass('p-4');
    expect(result).toEqual({ property: 'padding', value: '1rem' });
  });

  it('resolves px-6 to padding-left 1.5rem', () => {
    const result = resolveUtilityClass('px-6');
    expect(result).toEqual({ property: 'padding-left', value: '1.5rem' });
  });

  it('resolves py-2 to padding-top 0.5rem', () => {
    const result = resolveUtilityClass('py-2');
    expect(result).toEqual({ property: 'padding-top', value: '0.5rem' });
  });

  it('resolves m-auto to margin auto', () => {
    const result = resolveUtilityClass('m-auto');
    expect(result).toEqual({ property: 'margin', value: 'auto' });
  });

  it('resolves mt-4 to margin-top 1rem', () => {
    const result = resolveUtilityClass('mt-4');
    expect(result).toEqual({ property: 'margin-top', value: '1rem' });
  });

  it('resolves rounded-lg to border-radius 0.5rem', () => {
    const result = resolveUtilityClass('rounded-lg');
    expect(result).toEqual({ property: 'border-radius', value: '0.5rem' });
  });

  it('resolves rounded-full to border-radius 9999px', () => {
    const result = resolveUtilityClass('rounded-full');
    expect(result).toEqual({ property: 'border-radius', value: '9999px' });
  });

  it('returns null for unknown class', () => {
    const result = resolveUtilityClass('text-red-500');
    expect(result).toBeNull();
  });

  it('returns null for completely unknown class', () => {
    const result = resolveUtilityClass('not-a-class');
    expect(result).toBeNull();
  });
});

describe('findClassForValue', () => {
  it('finds p-4 for padding 1rem', () => {
    const result = findClassForValue('padding', '1rem');
    expect(result).toBe('p-4');
  });

  it('finds rounded-lg for border-radius 0.5rem', () => {
    const result = findClassForValue('border-radius', '0.5rem');
    expect(result).toBe('rounded-lg');
  });

  it('returns null for unmapped value', () => {
    const result = findClassForValue('padding', '999rem');
    expect(result).toBeNull();
  });

  it('returns null for unmapped property', () => {
    const result = findClassForValue('color', 'red');
    expect(result).toBeNull();
  });
});

describe('isTailwindClass', () => {
  it('returns true for valid spacing class', () => {
    expect(isTailwindClass('p-4')).toBe(true);
  });

  it('returns true for valid radius class', () => {
    expect(isTailwindClass('rounded-lg')).toBe(true);
  });

  it('returns false for unknown class', () => {
    expect(isTailwindClass('text-red-500')).toBe(false);
  });
});
