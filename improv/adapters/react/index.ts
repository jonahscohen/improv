import type { ImprovAdapter, AdapterEnrichment } from '../types';

declare global {
  interface Window {
    __improv?: { registerAdapter(adapter: ImprovAdapter): void };
  }
}

// Internal fiber node shape (subset of what we need)
interface Fiber {
  type?: { displayName?: string; name?: string } | string;
  return?: Fiber | null;
  memoizedProps?: Record<string, unknown>;
  _debugSource?: { fileName: string; lineNumber: number } | null;
}

const BLOCKED_NAMES = new Set([
  'Fragment',
  'StrictMode',
  'Suspense',
  'Profiler',
  'InnerLayoutRouter',
  'RedirectErrorBoundary',
  'OuterLayoutRouter',
  'RenderFromTemplateContext',
]);

function getFiberFromElement(el: HTMLElement): Fiber | null {
  const keys = Object.keys(el);
  for (const key of keys) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
      return (el as unknown as Record<string, Fiber>)[key] ?? null;
    }
  }
  return null;
}

function getDisplayName(fiber: Fiber): string | null {
  const type = fiber.type;
  if (!type || typeof type === 'string') return null;

  const name: string | undefined = type.displayName || type.name;
  if (!name) return null;
  if (name.length <= 2) return null;
  if (name.length <= 3 && name === name.toLowerCase()) return null;
  if (BLOCKED_NAMES.has(name)) return null;
  if (/Provider$|Consumer$|Router$|^With[A-Z]/.test(name)) return null;

  return name;
}

function getDebugSource(fiber: Fiber): { sourceFile?: string; sourceLine?: number } {
  const src = fiber._debugSource;
  if (!src) return {};
  return { sourceFile: src.fileName, sourceLine: src.lineNumber };
}

function getProps(fiber: Fiber): Record<string, unknown> | undefined {
  if (!fiber.memoizedProps) return undefined;
  const raw = fiber.memoizedProps;
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'children') continue;
    if (typeof v === 'function') {
      safe[k] = '[function]';
    } else if (v !== null && typeof v === 'object') {
      safe[k] = '[object]';
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

const reactAdapter: ImprovAdapter = {
  name: 'react',

  enrichElement(domNode: HTMLElement): AdapterEnrichment | null {
    const fiber = getFiberFromElement(domNode);
    if (!fiber) return null;

    let cursor: Fiber | null | undefined = fiber;
    let componentName: string | null = null;
    let sourceInfo: { sourceFile?: string; sourceLine?: number } = {};
    let props: Record<string, unknown> | undefined;
    let depth = 0;

    while (cursor && depth < 30) {
      const name = getDisplayName(cursor);
      if (name && !componentName) {
        componentName = name;
        sourceInfo = getDebugSource(cursor);
        props = getProps(cursor);
      }
      cursor = cursor.return;
      depth++;
    }

    if (!componentName) return null;

    return {
      frameworkName: 'react',
      componentName,
      componentTree: this.getComponentTree(domNode),
      ...sourceInfo,
      props,
    };
  },

  getComponentTree(domNode: HTMLElement): string[] {
    const fiber = getFiberFromElement(domNode);
    if (!fiber) return [];

    const tree: string[] = [];
    let cursor: Fiber | null | undefined = fiber;
    let depth = 0;

    while (cursor && depth < 30) {
      const name = getDisplayName(cursor);
      if (name) tree.push(name);
      cursor = cursor.return;
      depth++;
    }

    return tree;
  },
};

if (typeof window !== 'undefined' && window.__improv) {
  window.__improv.registerAdapter(reactAdapter);
}

export default reactAdapter;
