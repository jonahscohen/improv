import { enableEventIntercept, disableEventIntercept, getElementAtPoint } from '../event-intercept.js';
import { generateSelector, getComputedStylesSubset, getNearbyText, getAccessibilityInfo } from '../selection.js';
import { Overlay } from '../overlay.js';
import { Transport } from '../transport.js';
import { AdapterRegistry } from '../adapter-registry.js';
import type { SelectedElement } from '../types.js';
import { InlinePrompt } from './inline-prompt.js';
import { MultiSelect } from './multi-select.js';
import { buildContextFromElement, formatContext } from './context-extractor.js';
import { copyToClipboard } from './clipboard.js';

function isImprovElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  let node: Node | null = el;
  while (node) {
    if (node instanceof HTMLElement && node.hasAttribute('data-improv')) return true;
    node = node.parentNode ?? (node as unknown as ShadowRoot).host ?? null;
  }
  return false;
}

export class PromptMode {
  private overlay: Overlay;
  private transport: Transport;
  private adapters: AdapterRegistry;

  private active = false;
  private prompt: InlinePrompt | null = null;
  private multiSelect: MultiSelect = new MultiSelect();

  private onMouseMove: ((e: MouseEvent) => void) | null = null;
  private onClick: ((e: MouseEvent) => void) | null = null;
  private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(overlay: Overlay, transport: Transport, adapters: AdapterRegistry) {
    this.overlay = overlay;
    this.transport = transport;
    this.adapters = adapters;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;

    enableEventIntercept();
    this.prompt = new InlinePrompt(this.overlay.getShadowRoot());

    this.onMouseMove = (e: MouseEvent) => {
      if (this.prompt?.isVisible()) return;
      if (isImprovElement(e.target as HTMLElement)) return;
      const el = getElementAtPoint(e.clientX, e.clientY);
      if (el && el !== document.documentElement && el !== document.body) {
        this.overlay.showHighlight(el.getBoundingClientRect());
      } else {
        this.overlay.hideHighlight();
      }
    };

    this.onClick = (e: MouseEvent) => {
      if (isImprovElement(e.target as HTMLElement)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = getElementAtPoint(e.clientX, e.clientY);
      if (!el || el === document.documentElement || el === document.body) return;

      const selected = this.buildSelectedElement(el);

      if (e.shiftKey) {
        this.multiSelect.toggle(selected);
      } else {
        this.multiSelect.clear();
        this.multiSelect.add(selected);
      }

      this.overlay.trackElement(el);

      const rect = el.getBoundingClientRect();
      const promptX = rect.left;
      const promptY = rect.bottom + 8;
      this.prompt?.show(promptX, promptY);

      this.prompt?.onPromptSubmit((text: string) => {
        this.submitPrompt(text);
      });
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        this.copyContext();
      }
    };

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('keydown', this.onKeyDown, true);
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;

    disableEventIntercept();
    this.overlay.hideHighlight();

    this.prompt?.destroy();
    this.prompt = null;

    this.multiSelect.clear();

    if (this.onMouseMove) {
      document.removeEventListener('mousemove', this.onMouseMove);
      this.onMouseMove = null;
    }
    if (this.onClick) {
      document.removeEventListener('click', this.onClick, true);
      this.onClick = null;
    }
    if (this.onKeyDown) {
      document.removeEventListener('keydown', this.onKeyDown, true);
      this.onKeyDown = null;
    }
  }

  private buildSelectedElement(el: HTMLElement): SelectedElement {
    const selector = generateSelector(el);
    const computedStyles = getComputedStylesSubset(el);
    const adapterData = this.adapters.enrichElement(el);

    return {
      domNode: el,
      selector,
      tagName: el.tagName.toLowerCase(),
      textContent: (el.textContent ?? '').trim(),
      classes: Array.from(el.classList),
      computedStyles,
      boundingBox: el.getBoundingClientRect(),
      adapterData,
    };
  }

  private submitPrompt(text: string): void {
    const selected = this.multiSelect.getAll();
    if (selected.length === 0) return;

    const contextParts = selected.map((sel) => {
      const nearbyText = getNearbyText(sel.domNode);
      const accessibility = getAccessibilityInfo(sel.domNode);
      const contextData = buildContextFromElement(
        sel.domNode,
        sel.selector,
        sel.adapterData,
        sel.computedStyles,
        nearbyText,
        accessibility,
      );
      return formatContext(contextData);
    });

    const context = contextParts.join('\n\n---\n\n');

    this.transport.request('push_prompt', {
      context,
      prompt: text,
      elementCount: selected.length,
    }).then(() => {
      this.notifyPromptSent(text, selected.length);
    }).catch(() => {
      this.notifyPromptSent(text, selected.length);
    });
  }

  private promptSentCallbacks: Array<(text: string, count: number) => void> = [];

  onPromptSent(callback: (text: string, count: number) => void): void {
    this.promptSentCallbacks.push(callback);
  }

  private notifyPromptSent(text: string, count: number): void {
    for (const cb of this.promptSentCallbacks) cb(text, count);
  }

  private copyContext(): void {
    const selected = this.multiSelect.getAll();
    if (selected.length === 0) return;

    const entries: Record<string, unknown>[] = [];
    const plainParts: string[] = [];

    for (const sel of selected) {
      const nearbyText = getNearbyText(sel.domNode);
      const accessibility = getAccessibilityInfo(sel.domNode);
      const contextData = buildContextFromElement(
        sel.domNode,
        sel.selector,
        sel.adapterData,
        sel.computedStyles,
        nearbyText,
        accessibility,
      );
      plainParts.push(formatContext(contextData));
      entries.push(contextData as unknown as Record<string, unknown>);
    }

    const plainText = plainParts.join('\n\n---\n\n');
    copyToClipboard(plainText, { elements: entries });
  }

  isActive(): boolean {
    return this.active;
  }
}
