import { enableEventIntercept, disableEventIntercept, getElementAtPoint } from '../event-intercept.js';
import { generateSelector, getComputedStylesSubset } from '../selection.js';
import { PreviewEngine } from '../preview-engine.js';
import { ChangeBuffer } from '../change-buffer.js';
import { Overlay } from '../overlay.js';
import { Transport } from '../transport.js';
import { detectControls } from './control-detector.js';
import { PropertyPanel } from './property-panel.js';

function isImprovElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  let node: Node | null = el;
  while (node) {
    if (node instanceof HTMLElement && node.hasAttribute('data-improv')) return true;
    node = node.parentNode ?? (node as ShadowRoot).host ?? null;
  }
  return false;
}

export class ManipulateMode {
  private overlay: Overlay;
  private preview: PreviewEngine;
  private changeBuffer: ChangeBuffer;
  private transport: Transport;

  private active = false;
  private selectedElement: HTMLElement | null = null;
  private selectedSelector: string | null = null;
  private panel: PropertyPanel | null = null;

  private onMouseMove: ((e: MouseEvent) => void) | null = null;
  private onClick: ((e: MouseEvent) => void) | null = null;
  private onScroll: (() => void) | null = null;

  constructor(
    overlay: Overlay,
    preview: PreviewEngine,
    changeBuffer: ChangeBuffer,
    transport: Transport,
  ) {
    this.overlay = overlay;
    this.preview = preview;
    this.changeBuffer = changeBuffer;
    this.transport = transport;
  }

  activate(): void {
    if (this.active) return;
    this.active = true;

    enableEventIntercept();
    this.preview.attach();

    this.onMouseMove = (e: MouseEvent) => {
      if (this.selectedElement) return;
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
      if (el && el !== document.documentElement && el !== document.body) {
        this.selectElement(el);
      }
    };

    this.onScroll = () => {
      if (this.selectedElement) {
        this.overlay.showHighlight(this.selectedElement.getBoundingClientRect());
      }
    };

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('click', this.onClick, true);
    window.addEventListener('scroll', this.onScroll, true);
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;

    disableEventIntercept();
    this.overlay.hideHighlight();

    this.panel?.destroy();
    this.panel = null;

    if (this.onMouseMove) {
      document.removeEventListener('mousemove', this.onMouseMove);
      this.onMouseMove = null;
    }
    if (this.onClick) {
      document.removeEventListener('click', this.onClick, true);
      this.onClick = null;
    }
    if (this.onScroll) {
      window.removeEventListener('scroll', this.onScroll, true);
      this.onScroll = null;
    }

    this.selectedElement = null;
    this.selectedSelector = null;
  }

  selectElement(el: HTMLElement): void {
    this.selectedElement = el;
    this.selectedSelector = generateSelector(el);

    this.overlay.trackElement(el);

    const controls = detectControls(el);
    const computedStyles = getComputedStylesSubset(el);

    if (this.panel) {
      this.panel.destroy();
    }
    this.panel = new PropertyPanel(this.overlay.getShadowRoot());
    this.panel.render(controls, computedStyles);

    this.panel.onPropertyChange((property: string, value: string) => {
      if (!this.selectedSelector) return;

      const oldValue = computedStyles[property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())]
        ?? computedStyles[property]
        ?? '';

      this.preview.applyChange(this.selectedSelector, property, value);
      this.changeBuffer.add(this.selectedSelector, property, oldValue, value);
    });
  }

  async applyChanges(): Promise<void> {
    const changes = this.changeBuffer.flush();
    if (changes.length === 0) return;

    await this.transport.request('push_changes', { changes });
    this.preview.clearAll();
  }

  isActive(): boolean {
    return this.active;
  }
}
