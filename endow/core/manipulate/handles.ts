type HandleChangeCallback = (property: string, value: string) => void;

type EdgeSide = 'top' | 'right' | 'bottom' | 'left';
type CornerSide = 'tl' | 'tr' | 'br' | 'bl';

interface EdgeHandle {
  el: HTMLDivElement;
  side: EdgeSide;
  kind: 'padding' | 'margin';
  property: string;
  currentValue: number;
}

interface CornerHandle {
  el: HTMLDivElement;
  corner: CornerSide;
  property: string;
  currentValue: number;
}

const PADDING_COLOR = 'rgba(34, 197, 94, 0.30)';
const MARGIN_COLOR = 'rgba(249, 115, 22, 0.30)';
const RADIUS_COLOR = 'rgba(59, 130, 246, 0.50)';

const HANDLE_WIDTH = 4;
const CORNER_SIZE = 8;
const MARGIN_OFFSET = 4 + HANDLE_WIDTH;

function parsePx(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function edgeCursor(side: EdgeSide): string {
  return side === 'left' || side === 'right' ? 'ew-resize' : 'ns-resize';
}

function cornerCursor(corner: CornerSide): string {
  return corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize';
}

export class Handles {
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private edgeHandles: EdgeHandle[] = [];
  private cornerHandles: CornerHandle[] = [];
  private changeCallback: HandleChangeCallback | null = null;
  private lastRect: DOMRect | null = null;
  private computedStyles: Record<string, string> = {};

  constructor(shadow: ShadowRoot) {
    this.shadow = shadow;
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:2147483646;';
    this.shadow.appendChild(this.container);
  }

  private buildEdge(side: EdgeSide, kind: 'padding' | 'margin', property: string): EdgeHandle {
    const el = document.createElement('div');
    el.style.cssText = [
      'position: fixed',
      `background: ${kind === 'padding' ? PADDING_COLOR : MARGIN_COLOR}`,
      `cursor: ${edgeCursor(side)}`,
      'pointer-events: auto',
      'border-radius: 2px',
    ].join(';');

    let dragging = false;
    let startCoord = 0;
    let startValue = 0;

    const onMouseDown = (e: MouseEvent) => {
      dragging = true;
      startCoord = side === 'left' || side === 'right' ? e.clientX : e.clientY;
      startValue = handle.currentValue;
      e.preventDefault();
      e.stopPropagation();

      const onMove = (me: MouseEvent) => {
        if (!dragging) return;
        const coord = side === 'left' || side === 'right' ? me.clientX : me.clientY;
        let delta = coord - startCoord;
        if (side === 'top' || side === 'left') delta = -delta;

        let step = 1;
        if (me.shiftKey) step = 10;
        else if (me.altKey) step = 0.1;

        const newVal = Math.max(0, Math.round((startValue + (delta / 2) * step) * 10) / 10);
        handle.currentValue = newVal;
        this.changeCallback?.(property, `${newVal}px`);
        this.repositionHandle(handle, this.lastRect!);
      };

      const onUp = (me: MouseEvent) => {
        if (!dragging) return;
        dragging = false;
        const coord = side === 'left' || side === 'right' ? me.clientX : me.clientY;
        let delta = coord - startCoord;
        if (side === 'top' || side === 'left') delta = -delta;

        let step = 1;
        if (me.shiftKey) step = 10;
        else if (me.altKey) step = 0.1;

        const newVal = Math.max(0, Math.round((startValue + (delta / 2) * step) * 10) / 10);
        handle.currentValue = newVal;
        this.changeCallback?.(property, `${newVal}px`);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    el.addEventListener('mousedown', onMouseDown);

    const handle: EdgeHandle = { el, side, kind, property, currentValue: 0 };
    return handle;
  }

  private buildCorner(corner: CornerSide, property: string): CornerHandle {
    const el = document.createElement('div');
    el.style.cssText = [
      'position: fixed',
      `background: ${RADIUS_COLOR}`,
      `cursor: ${cornerCursor(corner)}`,
      'pointer-events: auto',
      `width: ${CORNER_SIZE}px`,
      `height: ${CORNER_SIZE}px`,
      'border-radius: 50%',
    ].join(';');

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startValue = 0;

    const onMouseDown = (e: MouseEvent) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startValue = handle.currentValue;
      e.preventDefault();
      e.stopPropagation();

      const onMove = (me: MouseEvent) => {
        if (!dragging) return;
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        let magnitude = Math.sqrt(dx * dx + dy * dy);

        let dirSign = 1;
        if (corner === 'tl') dirSign = dx < 0 || dy < 0 ? -1 : 1;
        else if (corner === 'tr') dirSign = dx > 0 || dy < 0 ? 1 : -1;
        else if (corner === 'br') dirSign = dx > 0 || dy > 0 ? 1 : -1;
        else if (corner === 'bl') dirSign = dx < 0 || dy > 0 ? -1 : 1;

        let step = 1;
        if (me.shiftKey) step = 10;
        else if (me.altKey) step = 0.1;

        const newVal = Math.max(0, Math.round((startValue + dirSign * (magnitude / 2) * step) * 10) / 10);
        handle.currentValue = newVal;
        this.changeCallback?.(property, `${newVal}px`);
      };

      const onUp = (me: MouseEvent) => {
        if (!dragging) return;
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    el.addEventListener('mousedown', onMouseDown);

    const handle: CornerHandle = { el, corner, property, currentValue: 0 };
    return handle;
  }

  private repositionHandle(handle: EdgeHandle, rect: DOMRect): void {
    const { el, side, kind } = handle;
    const offset = kind === 'margin' ? MARGIN_OFFSET : 0;

    if (side === 'top') {
      const y = kind === 'margin' ? rect.top - MARGIN_OFFSET : rect.top;
      el.style.left = `${rect.left - offset}px`;
      el.style.top = `${y}px`;
      el.style.width = `${rect.width + offset * 2}px`;
      el.style.height = `${HANDLE_WIDTH}px`;
    } else if (side === 'bottom') {
      const y = kind === 'margin' ? rect.bottom : rect.bottom - HANDLE_WIDTH;
      el.style.left = `${rect.left - offset}px`;
      el.style.top = `${y}px`;
      el.style.width = `${rect.width + offset * 2}px`;
      el.style.height = `${HANDLE_WIDTH}px`;
    } else if (side === 'left') {
      const x = kind === 'margin' ? rect.left - MARGIN_OFFSET : rect.left;
      el.style.left = `${x}px`;
      el.style.top = `${rect.top - offset}px`;
      el.style.width = `${HANDLE_WIDTH}px`;
      el.style.height = `${rect.height + offset * 2}px`;
    } else if (side === 'right') {
      const x = kind === 'margin' ? rect.right : rect.right - HANDLE_WIDTH;
      el.style.left = `${x}px`;
      el.style.top = `${rect.top - offset}px`;
      el.style.width = `${HANDLE_WIDTH}px`;
      el.style.height = `${rect.height + offset * 2}px`;
    }
  }

  private repositionCorner(handle: CornerHandle, rect: DOMRect): void {
    const half = CORNER_SIZE / 2;
    const { el, corner } = handle;

    if (corner === 'tl') {
      el.style.left = `${rect.left - half}px`;
      el.style.top = `${rect.top - half}px`;
    } else if (corner === 'tr') {
      el.style.left = `${rect.right - half}px`;
      el.style.top = `${rect.top - half}px`;
    } else if (corner === 'br') {
      el.style.left = `${rect.right - half}px`;
      el.style.top = `${rect.bottom - half}px`;
    } else if (corner === 'bl') {
      el.style.left = `${rect.left - half}px`;
      el.style.top = `${rect.bottom - half}px`;
    }
  }

  attach(rect: DOMRect, computedStyles: Record<string, string>): void {
    this.destroy();
    this.lastRect = rect;
    this.computedStyles = computedStyles;

    const paddingSides: EdgeSide[] = ['top', 'right', 'bottom', 'left'];
    for (const side of paddingSides) {
      const prop = `padding-${side}`;
      const handle = this.buildEdge(side, 'padding', prop);
      handle.currentValue = parsePx(computedStyles[prop] ?? '0');
      this.repositionHandle(handle, rect);
      this.edgeHandles.push(handle);
      this.container.appendChild(handle.el);
    }

    const marginSides: EdgeSide[] = ['top', 'right', 'bottom', 'left'];
    for (const side of marginSides) {
      const prop = `margin-${side}`;
      const handle = this.buildEdge(side, 'margin', prop);
      handle.currentValue = parsePx(computedStyles[prop] ?? '0');
      this.repositionHandle(handle, rect);
      this.edgeHandles.push(handle);
      this.container.appendChild(handle.el);
    }

    const corners: { corner: CornerSide; prop: string }[] = [
      { corner: 'tl', prop: 'border-top-left-radius' },
      { corner: 'tr', prop: 'border-top-right-radius' },
      { corner: 'br', prop: 'border-bottom-right-radius' },
      { corner: 'bl', prop: 'border-bottom-left-radius' },
    ];

    for (const { corner, prop } of corners) {
      const handle = this.buildCorner(corner, prop);
      handle.currentValue = parsePx(computedStyles[prop] ?? '0');
      this.repositionCorner(handle, rect);
      this.cornerHandles.push(handle);
      this.container.appendChild(handle.el);
    }
  }

  update(rect: DOMRect): void {
    this.lastRect = rect;
    for (const h of this.edgeHandles) {
      this.repositionHandle(h, rect);
    }
    for (const h of this.cornerHandles) {
      this.repositionCorner(h, rect);
    }
  }

  onChange(callback: HandleChangeCallback): void {
    this.changeCallback = callback;
  }

  show(): void {
    this.container.style.display = '';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  destroy(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.edgeHandles = [];
    this.cornerHandles = [];
    this.changeCallback = null;
    this.lastRect = null;
  }

  remove(): void {
    this.destroy();
    if (this.shadow.contains(this.container)) {
      this.shadow.removeChild(this.container);
    }
  }
}
