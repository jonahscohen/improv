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
import {
  generateSelector,
  getElementPath,
  getComputedStylesSubset,
  getNearbyText,
  getAccessibilityInfo,
} from '../selection.js';

type Intent = 'fix' | 'change' | 'question' | 'approve';
type Severity = 'blocking' | 'important' | 'suggestion';

export class AnnotateMode {
  private overlay: Overlay;
  private transport: Transport;
  private adapters: AdapterRegistry;
  private store: AnnotationStore;
  private marker: AnnotationMarker;
  private lasso: LassoSelect;
  private textSelect: TextSelect;
  private active = false;

  // Track per-click drag state to distinguish click vs drag
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

    enableEventIntercept();

    // Lasso handles drag-select
    this.lasso.enable((elements) => {
      if (elements.length === 0) return;
      this._handleLassoComplete(elements);
    });

    // Text selection
    this.textSelect.enable((text, rect) => {
      this._handleTextSelect(text, rect);
    });

    // Click tracking for drag detection
    document.addEventListener('mousedown', this.boundMousedown, { capture: true });
    document.addEventListener('mousemove', this.boundMousemove, { capture: true });
    document.addEventListener('mouseup', this.boundMouseup, { capture: true });
    document.addEventListener('click', this.boundClick, { capture: true });
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;

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
    // isDragging state is read in _onClick
  }

  private _onClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // If drag occurred, lasso already handled it
    if (this.isDragging) {
      this.isDragging = false;
      return;
    }

    const el = getElementAtPoint(e.clientX, e.clientY);
    if (!el || el === document.body || el === document.documentElement) return;

    const isShift = e.shiftKey;

    if (isShift) {
      // Shift+click: multi-select accumulate
      this.multiSelected.push(el);
      const rect = el.getBoundingClientRect();
      this.marker.create(rect, this.multiSelected.length);
    } else {
      // Normal click: single element, clear previous multi-select
      this.multiSelected = [el];
      this.marker.clear();
      const rect = el.getBoundingClientRect();
      const pin = this.marker.create(rect, 1);

      this.marker.showCommentInput(pin, (comment, intent, severity) => {
        this._submitAnnotation([el], comment, intent, severity);
      });
    }
  }

  private _handleLassoComplete(elements: HTMLElement[]): void {
    if (elements.length === 0) return;

    // Use the first element's rect as the marker anchor
    const anchorRect = elements[0].getBoundingClientRect();
    this.marker.clear();
    const pin = this.marker.create(anchorRect, this.store.count() + 1);

    this.marker.showCommentInput(pin, (comment, intent, severity) => {
      this._submitAnnotation(elements, comment, intent, severity);
    });
  }

  private _handleTextSelect(text: string, rect: DOMRect): void {
    const pin = this.marker.create(rect, this.store.count() + 1);

    this.marker.showCommentInput(pin, (comment, intent, severity) => {
      // For text selections, no element selector - use the text itself as context
      const fullComment = text ? `[Selected: "${text.slice(0, 120)}"]\n${comment}`.trim() : comment;
      this._submitTextAnnotation(fullComment, rect, intent, severity);
    });
  }

  private _submitAnnotation(
    elements: HTMLElement[],
    comment: string,
    intent: Intent,
    severity: Severity,
  ): void {
    const primary = elements[0];
    const primaryRect = primary.getBoundingClientRect();
    const selector = generateSelector(primary);

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

    this._push(id);
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

    this._push(id);
  }

  private _push(id: string): void {
    const annotation = this.store.get(id);
    if (!annotation) return;

    this.transport.request('push_annotations', {
      annotations: [annotation],
    }).catch(() => {
      // Transport may not be connected; annotation is still stored locally
    });
  }

  getStore(): AnnotationStore {
    return this.store;
  }
}
