import { enableEventIntercept, disableEventIntercept, getElementAtPoint } from '../event-intercept.js';
import { generateSelector, getComputedStylesSubset } from '../element-utils.js';
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

  _hLabel: HTMLDivElement | null = null;
  _showHints: boolean = true;

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
        if (this._hLabel && this._showHints !== false) {
          while (this._hLabel.firstChild) this._hLabel.removeChild(this._hLabel.firstChild);
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute?.('role') || '';
          const cs = getComputedStyle(el);
          const disp = cs.display || '';
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '14');
          svg.setAttribute('height', '14');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('stroke-width', '2');
          svg.setAttribute('stroke-linecap', 'round');
          svg.setAttribute('stroke-linejoin', 'round');
          let d = '';
          if (tag === 'img' || tag === 'picture' || tag === 'video' || tag === 'svg') d = 'M21 3H3v18h18V3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21';
          else if (tag === 'a') d = 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71';
          else if (tag === 'button' || role === 'button') d = 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z';
          else if (tag === 'input' || tag === 'textarea' || tag === 'select') d = 'M4 7h16M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M8 12h4';
          else if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') d = 'M4 12h8M4 18V6M12 18V6M20 18v-6a2 2 0 1 0-4 0v6';
          else if (tag === 'p' || tag === 'span' || tag === 'label' || tag === 'em' || tag === 'strong' || tag === 'blockquote') d = 'M4 7h16M4 12h16M4 17h10';
          else if (tag === 'ul' || tag === 'ol') d = 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01';
          else if (tag === 'li') d = 'M9 12h12M9 6h12M9 18h12M5 12h.01M5 6h.01M5 18h.01';
          else if (tag === 'nav') d = 'M3 12h18M3 6h18M3 18h18';
          else if (tag === 'header') d = 'M3 3h18v6H3zM3 12h18v9H3z';
          else if (tag === 'footer') d = 'M3 3h18v9H3zM3 15h18v6H3z';
          else if (tag === 'section' || tag === 'article' || tag === 'main' || tag === 'aside') d = 'M3 3h18v18H3zM3 9h18M9 21V9';
          else if (tag === 'form') d = 'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5zM15 3v5h5M10 12l2 2 4-4';
          else if (tag === 'table' || tag === 'tr' || tag === 'td' || tag === 'th') d = 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18';
          else if (disp.includes('flex')) d = 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z';
          else if (disp.includes('grid')) d = 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18';
          else d = 'M21 3H3v18h18V3z';
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('d', d);
          svg.appendChild(p);
          this._hLabel.appendChild(svg);
          let lbl = tag;
          const cn = el.className && typeof el.className === 'string' ? el.className.split(/\s+/)[0] : '';
          if (cn && cn.length < 25) lbl = tag + ' .' + cn;
          else if (el.id) lbl = tag + ' #' + el.id;
          else if (role) lbl = tag + ' (' + role + ')';
          const sp = document.createElement('span');
          sp.textContent = lbl;
          this._hLabel.appendChild(sp);
          this._hLabel.style.left = (e.clientX + 12) + 'px';
          this._hLabel.style.top = (e.clientY - 30) + 'px';
          this._hLabel.style.opacity = '1';
        }
      } else {
        this.overlay.hideHighlight();
        if (this._hLabel) this._hLabel.style.opacity = '0';
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
