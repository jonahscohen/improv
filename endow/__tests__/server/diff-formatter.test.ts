import { describe, it, expect } from 'vitest';
import { formatDiffOutput } from '../../server/diff-formatter.js';
import type { ResolvedChange } from '../../server/types.js';

describe('formatDiffOutput', () => {
  it('formats changes grouped by file for plain CSS', () => {
    const changes: ResolvedChange[] = [
      {
        source: { filePath: 'src/styles.css', line: 12, ruleSelector: '.button' },
        property: 'color',
        oldValue: 'red',
        newValue: 'blue',
        stylingApproach: 'plain-css',
      },
      {
        source: { filePath: 'src/styles.css', line: 12, ruleSelector: '.button' },
        property: 'font-size',
        oldValue: '14px',
        newValue: '16px',
        stylingApproach: 'plain-css',
      },
    ];

    const output = formatDiffOutput(changes, 'plain-css');

    expect(output).toContain('File: src/styles.css');
    expect(output).toContain('Line: 12');
    expect(output).toContain('Rule: .button');
    expect(output).toContain('color: red -> blue');
    expect(output).toContain('font-size: 14px -> 16px');
    expect(output).toContain('Styling approach: Plain CSS detected.');
  });

  it('formats Tailwind class swaps using remove/add class notation', () => {
    const changes: ResolvedChange[] = [
      {
        source: { filePath: 'src/App.tsx', line: 42 },
        property: 'className',
        oldValue: 'text-red-500',
        newValue: 'text-blue-500',
        stylingApproach: 'tailwind',
        guidance: 'swap class',
      },
    ];

    const output = formatDiffOutput(changes, 'tailwind');

    expect(output).toContain('File: src/App.tsx');
    expect(output).toContain('Line: 42');
    expect(output).toContain('remove class: text-red-500 / add class: text-blue-500');
    expect(output).toContain('Styling approach: Tailwind CSS detected.');
    expect(output).not.toContain('Rule:');
  });
});
