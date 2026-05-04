import type { LayoutPlacementData } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  layout:   '#3b82f6',
  content:  '#8b5cf6',
  controls: '#22c55e',
  elements: '#f97316',
  blocks:   '#ec4899',
};

type ResizeCallback = (id: string, width: number, height: number) => void;

export class SkeletonRenderer {
  private container: HTMLElement;
  private skeletons = new Map<string, HTMLDivElement>();
  private resizeCallback: ResizeCallback | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  create(placement: LayoutPlacementData, categoryColor?: string): HTMLDivElement {
    const color = categoryColor ?? CATEGORY_COLORS[placement.category] ?? '#3b82f6';

    // Parse hex -> RGB for opacity variants
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const bg     = `rgba(${r},${g},${b},0.08)`;
    const border = `rgba(${r},${g},${b},0.30)`;

    const el = document.createElement('div');
    el.dataset['skeletonId'] = placement.id;

    Object.assign(el.style, {
      position:        'absolute',
      left:            `${placement.x}px`,
      top:             `${placement.y - placement.scrollY}px`,
      width:           `${placement.width}px`,
      height:          `${placement.height}px`,
      borderRadius:    '10px',
      background:      bg,
      border:          `2px solid ${border}`,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      pointerEvents:   'all',
      cursor:          'move',
      userSelect:      'none',
      boxSizing:       'border-box',
      fontFamily:      'system-ui, -apple-system, sans-serif',
    });

    // Category badge (top-left pill)
    const badge = document.createElement('div');
    badge.textContent = placement.category;
    Object.assign(badge.style, {
      position:        'absolute',
      top:             '8px',
      left:            '10px',
      background:      `rgba(${r},${g},${b},0.18)`,
      color:           color,
      fontSize:        '10px',
      fontWeight:      '600',
      letterSpacing:   '0.04em',
      textTransform:   'uppercase',
      padding:         '2px 7px',
      borderRadius:    '20px',
      pointerEvents:   'none',
      lineHeight:      '1.4',
    });
    el.appendChild(badge);

    // Centered component name
    const label = document.createElement('div');
    label.textContent = placement.componentType;
    Object.assign(label.style, {
      color:          color,
      fontSize:       '13px',
      fontWeight:     '600',
      textAlign:      'center',
      pointerEvents:  'none',
      letterSpacing:  '0.02em',
    });
    el.appendChild(label);

    // Resize handles
    this.addResizeHandle(el, placement, 'corner');
    this.addResizeHandle(el, placement, 'right');
    this.addResizeHandle(el, placement, 'bottom');

    this.container.appendChild(el);
    this.skeletons.set(placement.id, el);

    return el;
  }

  private addResizeHandle(
    el: HTMLDivElement,
    placement: LayoutPlacementData,
    type: 'corner' | 'right' | 'bottom',
  ): void {
    const handle = document.createElement('div');

    const baseStyle: Partial<CSSStyleDeclaration> = {
      position:        'absolute',
      width:           '8px',
      height:          '8px',
      background:      '#ffffff',
      border:          '1.5px solid #888',
      borderRadius:    '2px',
      zIndex:          '10',
      pointerEvents:   'all',
    };

    Object.assign(handle.style, baseStyle);

    if (type === 'corner') {
      handle.style.bottom        = '-4px';
      handle.style.right         = '-4px';
      handle.style.cursor        = 'se-resize';
    } else if (type === 'right') {
      handle.style.top           = 'calc(50% - 4px)';
      handle.style.right         = '-4px';
      handle.style.cursor        = 'e-resize';
    } else {
      handle.style.bottom        = '-4px';
      handle.style.left          = 'calc(50% - 4px)';
      handle.style.cursor        = 's-resize';
    }

    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    const onMouseDown = (e: MouseEvent): void => {
      e.stopPropagation();
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startW = placement.width;
      startH = placement.height;

      const onMove = (me: MouseEvent): void => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        let newW = startW;
        let newH = startH;

        if (type === 'corner') {
          newW = Math.max(40, startW + dx);
          newH = Math.max(20, startH + dy);
        } else if (type === 'right') {
          newW = Math.max(40, startW + dx);
        } else {
          newH = Math.max(20, startH + dy);
        }

        placement.width  = newW;
        placement.height = newH;
        el.style.width   = `${newW}px`;
        el.style.height  = `${newH}px`;

        this.resizeCallback?.(placement.id, newW, newH);
      };

      const onUp = (): void => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
    el.appendChild(handle);
  }

  update(id: string, x: number, y: number, width?: number, height?: number): void {
    const el = this.skeletons.get(id);
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    if (width  !== undefined) el.style.width  = `${width}px`;
    if (height !== undefined) el.style.height = `${height}px`;
  }

  remove(id: string): void {
    const el = this.skeletons.get(id);
    if (!el) return;
    el.remove();
    this.skeletons.delete(id);
  }

  clear(): void {
    for (const [id] of this.skeletons) {
      this.remove(id);
    }
  }

  onResize(callback: ResizeCallback): void {
    this.resizeCallback = callback;
  }

  getAll(): Map<string, HTMLDivElement> {
    return this.skeletons;
  }
}
