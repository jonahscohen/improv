import type { AdapterEnrichment } from '../types.js';

export interface ContextData {
  tagName: string;
  textContent: string;
  selector: string;
  classes: string[];
  computedStyles: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number };
  pageUrl: string;
  viewport: { width: number; height: number };
  adapterData: AdapterEnrichment[];
  nearbyText: string;
  accessibility: { role: string; label: string };
  tokens?: Record<string, string>;
}

export function formatContext(data: ContextData): string {
  const lines: string[] = [];

  const truncatedText = data.textContent.length > 80
    ? data.textContent.slice(0, 80) + '...'
    : data.textContent;

  lines.push(`Element: <${data.tagName}> "${truncatedText}"`);
  lines.push(`Selector: ${data.selector}`);

  if (data.classes.length > 0) {
    lines.push(`Classes: ${data.classes.join(' ')}`);
  }

  const computedEntries = Object.entries(data.computedStyles);
  if (computedEntries.length > 0) {
    const computedStr = computedEntries.map(([k, v]) => `${k}: ${v}`).join('; ');
    lines.push(`Computed: ${computedStr}`);
  }

  for (const adapter of data.adapterData) {
    const tree = adapter.componentTree.join(' > ');
    lines.push(`Component: ${tree}`);

    if (adapter.sourceFile) {
      const source = adapter.sourceLine
        ? `${adapter.sourceFile}:${adapter.sourceLine}`
        : adapter.sourceFile;
      lines.push(`Source: ${source}`);
    }

    if (adapter.props && Object.keys(adapter.props).length > 0) {
      lines.push(`Props: ${JSON.stringify(adapter.props)}`);
    }
  }

  if (data.tokens && Object.keys(data.tokens).length > 0) {
    const tokenEntries = Object.entries(data.tokens)
      .map(([prop, token]) => `${prop} maps to ${token}`)
      .join('; ');
    lines.push(`Tokens: ${tokenEntries}`);
  }

  if (data.nearbyText) {
    lines.push(`Nearby elements: ${data.nearbyText}`);
  }

  lines.push(`Page URL: ${data.pageUrl}`);
  lines.push(`Viewport: ${data.viewport.width}x${data.viewport.height}`);

  return lines.join('\n');
}

export function buildContextFromElement(
  element: HTMLElement,
  selector: string,
  adapterData: AdapterEnrichment[],
  computedStyles: Record<string, string>,
  nearbyText: string,
  accessibility: { role: string; label: string },
): ContextData {
  const rect = element.getBoundingClientRect();

  return {
    tagName: element.tagName.toLowerCase(),
    textContent: (element.textContent ?? '').trim(),
    selector,
    classes: Array.from(element.classList),
    computedStyles,
    boundingBox: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    pageUrl: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    adapterData,
    nearbyText,
    accessibility,
  };
}
