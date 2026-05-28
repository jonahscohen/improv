import { AnnotationMarker } from './markers.js';
import { LassoSelect } from './lasso.js';
import { TextSelect } from './text-select.js';
import { AnnotationStore } from './annotation-store.js';
import { Transport } from '../transport.js';
import { AdapterRegistry } from '../adapter-registry.js';
import { Overlay } from '../overlay.js';
import {
  enableEventIntercept,
  disableEventIntercept,
  getElementAtPoint,
} from '../event-intercept.js';

function isEndowElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  let node: Node | null = el;
  while (node) {
    if (node instanceof HTMLElement && node.hasAttribute('data-endow')) return true;
    node = node.parentNode ?? (node as unknown as ShadowRoot).host ?? null;
  }
  return false;
}

import {
  generateSelector,
  getElementPath,
  getComputedStylesSubset,
  getNearbyText,
  getAccessibilityInfo,
} from '../element-utils.js';
import { freeze, unfreeze } from '../freeze.js';

type Intent = 'fix' | 'change' | 'question' | 'approve';
type Severity = 'blocking' | 'important' | 'suggestion';

function buildElementName(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent ?? '').trim().slice(0, 40);
  return text ? `${tag} - ${text}` : tag;
}

export class AnnotateMode {
  private overlay: Overlay;
  private transport: Transport;
  private adapters: AdapterRegistry;
  private store: AnnotationStore;
  private marker: AnnotationMarker;
  private lasso: LassoSelect;
  private textSelect: TextSelect;
  private active = false;

  // Per-click drag state
  private mousedownX = 0;
  private mousedownY = 0;
  private isDragging = false;

  // Multi-select accumulator
  private multiSelected: HTMLElement[] = [];

  private boundClick: (e: MouseEvent) => void;
  private boundMousedown: (e: MouseEvent) => void;
  private boundMousemove: (e: MouseEvent) => void;
  private boundMouseup: (e: MouseEvent) => void;

  constructor(overlay: Overlay, transport: Transport, adapters: AdapterRegistry) {
    this.overlay = overlay;
    this.transport = transport;
    this.adapters = adapters;
    this.store = new AnnotationStore();
    this.marker = new AnnotationMarker(overlay.getShadowRoot());
    this.lasso = new LassoSelect(overlay.getContainer());
    this.textSelect = new TextSelect();

    this.boundClick = this._onClick.bind(this);
    this.boundMousedown = this._onMousedown.bind(this);
    this.boundMousemove = this._onMousemove.bind(this);
    this.boundMouseup = this._onMouseup.bind(this);
  }

  activate(): void {
    if (this.active) return;
    this.active = true;

    // Freeze animations so elements stay put during annotation
    freeze();
    this.lasso.showFreezeIndicator(() => {
      unfreeze();
      this.lasso.hideFreezeIndicator();
    });

    enableEventIntercept();

    this.lasso.enable((elements) => {
      if (elements.length === 0) return;
      this._handleLassoComplete(elements);
    });

    this.textSelect.enable((text, rect) => {
      this._handleTextSelect(text, rect);
    });

    document.addEventListener('mousedown', this.boundMousedown, { capture: true });
    document.addEventListener('mousemove', this.boundMousemove, { capture: true });
    document.addEventListener('mouseup', this.boundMouseup, { capture: true });
    document.addEventListener('click', this.boundClick, { capture: true });
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;

    unfreeze();
    this.lasso.hideFreezeIndicator();

    disableEventIntercept();
    this.lasso.disable();
    this.textSelect.disable();

    document.removeEventListener('mousedown', this.boundMousedown, { capture: true });
    document.removeEventListener('mousemove', this.boundMousemove, { capture: true });
    document.removeEventListener('mouseup', this.boundMouseup, { capture: true });
    document.removeEventListener('click', this.boundClick, { capture: true });

    this.marker.clear();
    this.multiSelected = [];
    this.isDragging = false;
  }

  isActive(): boolean {
    return this.active;
  }

  private _onMousedown(e: MouseEvent): void {
    this.mousedownX = e.clientX;
    this.mousedownY = e.clientY;
    this.isDragging = false;
  }

  private _onMousemove(e: MouseEvent): void {
    const dx = e.clientX - this.mousedownX;
    const dy = e.clientY - this.mousedownY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      this.isDragging = true;
    }
  }

  private _onMouseup(_e: MouseEvent): void {
    // isDragging state is consumed in _onClick
  }

  private _onClick(e: MouseEvent): void {
    if (isEndowElement(e.target as HTMLElement)) return;
    e.preventDefault();
    e.stopPropagation();

    if (this.isDragging) {
      this.isDragging = false;
      return;
    }

    const el = getElementAtPoint(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement) return;

    const rect = el.getBoundingClientRect();
    const elementName = buildElementName(el);
    const elementPath = getElementPath(el);

    if (e.shiftKey) {
      // Shift+click: accumulate multi-select, show overlay
      this.multiSelected.push(el);
      this.lasso.showSelectionOverlays(this.multiSelected);
      this.marker.create(rect, this.multiSelected.length, 'change');
    } else {
      // Normal click: clear previous, show rich popup
      this.multiSelected = [el];
      this.marker.clear();
      this.lasso.clearOverlays();
      this.lasso.showSelectionOverlays([el]);

      this.marker.showPopup(rect, elementName, elementPath, (comment, intent, severity) => {
        this.lasso.clearOverlays();
        this._submitAnnotation([el], comment, intent as Intent, severity as Severity, intent);
      });
    }
  }

  private _handleLassoComplete(elements: HTMLElement[]): void {
    if (elements.length === 0) return;

    this.lasso.showSelectionOverlays(elements);

    const anchor = elements[0];
    const anchorRect = anchor.getBoundingClientRect();
    const elementName = `${elements.length} elements selected`;
    const elementPath = getElementPath(anchor);

    this.marker.clear();
    this.marker.showPopup(anchorRect, elementName, elementPath, (comment, intent, severity) => {
      this.lasso.clearOverlays();
      const markerIndex = this.store.count() + 1;
      const pin = this.marker.create(anchorRect, markerIndex, intent);
      void pin;
      this._submitAnnotation(elements, comment, intent as Intent, severity as Severity, intent);
    });
  }

  private _handleTextSelect(text: string, rect: DOMRect): void {
    this.marker.showPopup(rect, 'Text selection', text.slice(0, 80), (comment, intent, severity) => {
      const fullComment = text ? `[Selected: "${text.slice(0, 120)}"]\n${comment}`.trim() : comment;
      this._submitTextAnnotation(fullComment, rect, intent as Intent, severity as Severity);
    });
  }

  private _submitAnnotation(
    elements: HTMLElement[],
    comment: string,
    intent: Intent,
    severity: Severity,
    markerIntent: string,
  ): void {
    const primary = elements[0];
    const primaryRect = primary.getBoundingClientRect();
    const selector = generateSelector(primary);
    const markerIndex = this.store.count() + 1;

    const id = this.store.add({
      elementSelector: selector,
      comment,
      intent,
      severity,
      elementPath: getElementPath(primary),
      computedStyles: getComputedStylesSubset(primary),
      boundingBox: {
        x: primaryRect.x,
        y: primaryRect.y,
        width: primaryRect.width,
        height: primaryRect.height,
      },
      nearbyText: getNearbyText(primary),
      accessibility: getAccessibilityInfo(primary),
      isMultiSelect: elements.length > 1,
      elementBoundingBoxes: elements.length > 1
        ? elements.map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          })
        : undefined,
    });

    // Place colored marker after submission
    const pin = this.marker.create(primaryRect, markerIndex, markerIntent);

    // Allow re-click on the marker to show popup again
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      const annotation = this.store.get(id);
      if (!annotation) return;
      const rect = primaryRect;
      this.marker.showPopup(rect, buildElementName(primary), getElementPath(primary), (newComment, newIntent, newSeverity) => {
        void newComment; void newIntent; void newSeverity;
        // Future: update annotation
      });
    });

    this._push(id);
    this.notifyChange();
  }

  private _submitTextAnnotation(
    comment: string,
    rect: DOMRect,
    intent: Intent,
    severity: Severity,
  ): void {
    const id = this.store.add({
      elementSelector: 'text-selection',
      comment,
      intent,
      severity,
      boundingBox: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
    });

    this.marker.create(rect, this.store.count(), intent);
    this._push(id);
    this.notifyChange();
  }

  private _push(id: string): void {
    const annotation = this.store.get(id);
    if (!annotation) return;

    this.transport.request('push_annotations', {
      annotations: [annotation],
    }).catch(() => {
      // Transport may not be connected; annotation stored locally
    });
  }

  getStore(): AnnotationStore {
    return this.store;
  }

  onAnnotationChange(callback: () => void): void {
    this.changeCallbacks.push(callback);
  }

  private changeCallbacks: Array<() => void> = [];

  private notifyChange(): void {
    for (const cb of this.changeCallbacks) cb();
  }
}
