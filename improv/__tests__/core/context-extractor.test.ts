import { describe, it, expect } from 'vitest';
import { formatContext } from '../../core/prompt/context-extractor.js';
import type { ContextData } from '../../core/prompt/context-extractor.js';
import type { AdapterEnrichment } from '../../core/types.js';

const baseData: ContextData = {
  tagName: 'button',
  textContent: 'Click me',
  selector: '.btn-primary',
  classes: ['btn', 'btn-primary'],
  computedStyles: {
    backgroundColor: 'rgb(59, 130, 246)',
    fontSize: '14px',
  },
  boundingBox: { x: 100, y: 200, width: 120, height: 36 },
  pageUrl: 'https://example.com/page',
  viewport: { width: 1440, height: 900 },
  adapterData: [],
  nearbyText: 'Cancel | Submit',
  accessibility: { role: 'button', label: 'Primary action' },
};

describe('formatContext - basic data', () => {
  it('contains Element line with tagName and textContent', () => {
    const output = formatContext(baseData);
    expect(output).toContain('Element: <button> "Click me"');
  });

  it('contains Selector line', () => {
    const output = formatContext(baseData);
    expect(output).toContain('Selector: .btn-primary');
  });

  it('contains Classes line', () => {
    const output = formatContext(baseData);
    expect(output).toContain('Classes: btn btn-primary');
  });

  it('contains Computed line with style entries', () => {
    const output = formatContext(baseData);
    expect(output).toContain('Computed:');
    expect(output).toContain('backgroundColor: rgb(59, 130, 246)');
    expect(output).toContain('fontSize: 14px');
  });

  it('contains Nearby elements line', () => {
    const output = formatContext(baseData);
    expect(output).toContain('Nearby elements: Cancel | Submit');
  });

  it('contains Page URL', () => {
    const output = formatContext(baseData);
    expect(output).toContain('Page URL: https://example.com/page');
  });

  it('contains Viewport', () => {
    const output = formatContext(baseData);
    expect(output).toContain('Viewport: 1440x900');
  });

  it('truncates textContent longer than 80 chars', () => {
    const longText = 'a'.repeat(100);
    const data: ContextData = { ...baseData, textContent: longText };
    const output = formatContext(data);
    expect(output).toContain('"' + 'a'.repeat(80) + '...');
  });

  it('omits Classes line when classes array is empty', () => {
    const data: ContextData = { ...baseData, classes: [] };
    const output = formatContext(data);
    expect(output).not.toContain('Classes:');
  });
});

describe('formatContext - with adapter data', () => {
  const enrichment: AdapterEnrichment = {
    frameworkName: 'react',
    componentName: 'Button',
    componentTree: ['App', 'Header', 'Button'],
    sourceFile: 'src/components/Button.tsx',
    sourceLine: 42,
    props: { variant: 'primary', disabled: false },
  };

  const dataWithAdapter: ContextData = {
    ...baseData,
    adapterData: [enrichment],
  };

  it('contains Component line with tree', () => {
    const output = formatContext(dataWithAdapter);
    expect(output).toContain('Component: App > Header > Button');
  });

  it('contains Source line with file and line', () => {
    const output = formatContext(dataWithAdapter);
    expect(output).toContain('Source: src/components/Button.tsx:42');
  });

  it('contains Props line', () => {
    const output = formatContext(dataWithAdapter);
    expect(output).toContain('Props:');
    expect(output).toContain('"variant"');
    expect(output).toContain('"primary"');
  });

  it('omits Source line when sourceFile is absent', () => {
    const noSource: AdapterEnrichment = {
      frameworkName: 'react',
      componentName: 'Button',
      componentTree: ['App', 'Button'],
    };
    const data: ContextData = { ...baseData, adapterData: [noSource] };
    const output = formatContext(data);
    expect(output).not.toContain('Source:');
  });

  it('omits Props line when props is absent', () => {
    const noProps: AdapterEnrichment = {
      frameworkName: 'react',
      componentName: 'Button',
      componentTree: ['App', 'Button'],
      sourceFile: 'src/Button.tsx',
    };
    const data: ContextData = { ...baseData, adapterData: [noProps] };
    const output = formatContext(data);
    expect(output).not.toContain('Props:');
  });
});
