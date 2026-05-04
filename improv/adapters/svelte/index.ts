import type { ImprovAdapter, AdapterEnrichment } from '../types';

declare global {
  interface Window {
    __improv?: { registerAdapter(adapter: ImprovAdapter): void };
  }
}

interface SvelteMeta {
  loc?: {
    file?: string;
    line?: number;
    char?: number;
  };
  ctx?: SvelteContext;
}

interface SvelteContext {
  $$?: {
    ctx?: unknown[];
    bound?: Record<string, unknown>;
  };
  $parent?: SvelteContext;
}

interface SvelteElement extends HTMLElement {
  __svelte_meta?: SvelteMeta;
}

function getSvelteMeta(el: HTMLElement): SvelteMeta | null {
  return (el as SvelteElement).__svelte_meta ?? null;
}

function basenameWithoutExt(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const filename = parts[parts.length - 1] ?? filePath;
  return filename.replace(/\.[^.]+$/, '');
}

function getParentContext(ctx: SvelteContext | undefined): SvelteContext[] {
  const chain: SvelteContext[] = [];
  let cursor: SvelteContext | undefined = ctx;
  while (cursor) {
    chain.push(cursor);
    cursor = cursor.$parent;
  }
  return chain;
}

const svelteAdapter: ImprovAdapter = {
  name: 'svelte',

  enrichElement(domNode: HTMLElement): AdapterEnrichment | null {
    const meta = getSvelteMeta(domNode);
    if (!meta) return null;

    const sourceFile = meta.loc?.file;
    const sourceLine = meta.loc?.line;
    const componentName = sourceFile ? basenameWithoutExt(sourceFile) : null;

    if (!componentName) return null;

    return {
      frameworkName: 'svelte',
      componentName,
      componentTree: this.getComponentTree(domNode),
      ...(sourceFile ? { sourceFile } : {}),
      ...(sourceLine !== undefined ? { sourceLine } : {}),
    };
  },

  getComponentTree(domNode: HTMLElement): string[] {
    const meta = getSvelteMeta(domNode);
    if (!meta) return [];

    const tree: string[] = [];

    if (meta.loc?.file) {
      tree.push(basenameWithoutExt(meta.loc.file));
    }

    if (meta.ctx) {
      const parents = getParentContext(meta.ctx.$parent);
      for (const parentCtx of parents) {
        const internalFile = (parentCtx as unknown as { __svelte_meta?: SvelteMeta }).__svelte_meta?.loc?.file;
        if (internalFile) {
          const name = basenameWithoutExt(internalFile);
          if (!tree.includes(name)) tree.push(name);
        }
      }
    }

    return tree;
  },
};

if (typeof window !== 'undefined' && window.__improv) {
  window.__improv.registerAdapter(svelteAdapter);
}

export default svelteAdapter;
