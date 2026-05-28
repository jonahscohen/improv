import type { EndowAdapter, AdapterEnrichment } from '../types';

declare global {
  interface Window {
    __endow?: { registerAdapter(adapter: EndowAdapter): void };
  }
}

// Vue 2 instance shape (subset)
interface Vue2Instance {
  $options?: { name?: string };
  $parent?: Vue2Instance | null;
  $props?: Record<string, unknown>;
}

// Vue 3 component internal shape (subset)
interface Vue3Component {
  type?: { name?: string; __name?: string };
  parent?: Vue3Component | null;
  props?: Record<string, unknown>;
}

interface Vue2Element extends HTMLElement {
  __vue__?: Vue2Instance;
}

interface Vue3Element extends HTMLElement {
  __vueParentComponent?: Vue3Component;
}

function getVue2Instance(el: HTMLElement): Vue2Instance | null {
  return (el as Vue2Element).__vue__ ?? null;
}

function getVue3Component(el: HTMLElement): Vue3Component | null {
  return (el as Vue3Element).__vueParentComponent ?? null;
}

function componentNameFromVue2(instance: Vue2Instance): string | null {
  return instance.$options?.name ?? null;
}

function componentNameFromVue3(component: Vue3Component): string | null {
  return component.type?.name ?? component.type?.__name ?? null;
}

const vueAdapter: EndowAdapter = {
  name: 'vue',

  enrichElement(domNode: HTMLElement): AdapterEnrichment | null {
    const vue2 = getVue2Instance(domNode);
    if (vue2) {
      const componentName = componentNameFromVue2(vue2);
      if (!componentName) return null;

      const props = vue2.$props ? { ...vue2.$props } : undefined;

      return {
        frameworkName: 'vue',
        componentName,
        componentTree: this.getComponentTree(domNode),
        props,
      };
    }

    const vue3 = getVue3Component(domNode);
    if (vue3) {
      const componentName = componentNameFromVue3(vue3);
      if (!componentName) return null;

      const props = vue3.props ? { ...vue3.props } : undefined;

      return {
        frameworkName: 'vue',
        componentName,
        componentTree: this.getComponentTree(domNode),
        props,
      };
    }

    return null;
  },

  getComponentTree(domNode: HTMLElement): string[] {
    const tree: string[] = [];

    const vue2 = getVue2Instance(domNode);
    if (vue2) {
      let cursor: Vue2Instance | null | undefined = vue2;
      while (cursor) {
        const name = componentNameFromVue2(cursor);
        if (name) tree.push(name);
        cursor = cursor.$parent;
      }
      return tree;
    }

    const vue3 = getVue3Component(domNode);
    if (vue3) {
      let cursor: Vue3Component | null | undefined = vue3;
      while (cursor) {
        const name = componentNameFromVue3(cursor);
        if (name) tree.push(name);
        cursor = cursor.parent;
      }
      return tree;
    }

    return tree;
  },
};

if (typeof window !== 'undefined' && window.__endow) {
  window.__endow.registerAdapter(vueAdapter);
}

export default vueAdapter;
