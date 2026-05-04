import { describe, it, expect } from 'vitest';
import { formatAnnotations } from '../../core/annotate/output-formatter.js';
import { AnnotationData } from '../../core/types.js';

function makeAnnotation(overrides: Partial<AnnotationData> = {}): AnnotationData {
  return {
    id: 'ann-1',
    elementSelector: '.my-button',
    elementPath: 'body > div.container > button.my-button',
    computedStyles: {
      'font-size': '16px',
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
    },
    boundingBox: { x: 100, y: 200, width: 120, height: 40 },
    nearbyText: 'Submit form',
    accessibility: { role: 'button', label: 'Submit' },
    comment: 'Button padding is too small',
    intent: 'fix',
    severity: 'important',
    isMultiSelect: false,
    timestamp: new Date('2026-05-03T12:00:00.000Z').getTime(),
    ...overrides,
  };
}

describe('formatAnnotations', () => {
  it('compact: one-liner per annotation', () => {
    const result = formatAnnotations([makeAnnotation()], 'compact');
    const lines = result.split('\n').filter(l => l.trim() !== '');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('.my-button');
    expect(lines[0]).toContain('Button padding is too small');
  });

  it('standard: includes selector, source, and comment', () => {
    const result = formatAnnotations([makeAnnotation()], 'standard');
    expect(result).toContain('### 1. .my-button');
    expect(result).toContain('.my-button');
    expect(result).toContain('Button padding is too small');
    expect(result).toContain('fix');
  });

  it('detailed: includes position and classes', () => {
    const result = formatAnnotations([makeAnnotation()], 'detailed');
    expect(result).toContain('100');
    expect(result).toContain('200');
    expect(result).toContain('120x40');
  });

  it('forensic: includes full computed styles', () => {
    const result = formatAnnotations([makeAnnotation()], 'forensic');
    expect(result).toContain('font-size: 16px');
    expect(result).toContain('color: rgb(0, 0, 0)');
    expect(result).toContain('background-color: rgb(255, 255, 255)');
  });
});
