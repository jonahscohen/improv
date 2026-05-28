import { describe, it, expect } from 'vitest';
import { detectStylingApproach, getGuidance } from '../../server/styling-detector.js';

describe('detectStylingApproach', () => {
  it('detects Tailwind from config file', () => {
    const result = detectStylingApproach(['tailwind.config.js', 'src/index.ts']);
    expect(result).toBe('tailwind');
  });

  it('detects CSS Modules from file extensions', () => {
    const result = detectStylingApproach(['src/Button.module.css', 'src/index.ts']);
    expect(result).toBe('css-modules');
  });

  it('detects styled-components from dependencies', () => {
    const result = detectStylingApproach([], ['react', 'styled-components']);
    expect(result).toBe('styled-components');
  });

  it('detects Sass from file extensions', () => {
    const result = detectStylingApproach(['src/styles.scss', 'src/index.ts']);
    expect(result).toBe('sass');
  });

  it('falls back to plain-css when only .css files present', () => {
    const result = detectStylingApproach(['src/global.css', 'src/index.ts']);
    expect(result).toBe('plain-css');
  });
});

describe('getGuidance', () => {
  it('returns a non-empty guidance string for each approach', () => {
    const approaches = [
      'tailwind',
      'css-modules',
      'styled-components',
      'sass',
      'plain-css',
      'unknown',
    ] as const;
    for (const approach of approaches) {
      expect(getGuidance(approach).length).toBeGreaterThan(0);
    }
  });
});
