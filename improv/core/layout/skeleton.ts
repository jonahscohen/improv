import type { LayoutPlacementData } from '../types.js';
import { PRIMITIVES, getPrimitive } from './primitives.js';
import { isWireframe, getWireframeIcon } from './palette.js';

type ResizeCallback = (id: string, width: number, height: number) => void;

export class SkeletonRenderer {
  private container: HTMLElement;
  private skeletons = new Map<string, HTMLDivElement>();
  private resizeCallback: ResizeCallback | null = null;
  private selectedId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  private getAccentColor(): string {
    return isWireframe() ? '#f97316' : '#3c82f7';
  }

  private getBorderStyle(): string {
    const color = isWireframe()
      ? 'rgba(249,115,22,0.4)'
      : 'rgba(59,130,246,0.4)';
    return `1.5px dashed ${color}`;
  }

  private getFillColor(): string {
    return isWireframe()
      ? 'rgba(249,115,22,0.08)'
      : 'rgba(59,130,246,0.08)';
  }

  create(placement: LayoutPlacementData, categoryColor?: string): HTMLDivElement {
    const el = document.createElement('div');
    el.dataset['skeletonId'] = placement.id;

    Object.assign(el.style, {
      position:      'absolute',
      left:          `${placement.x}px`,
      top:           `${placement.y - placement.scrollY}px`,
      width:         `${placement.width}px`,
      height:        `${placement.height}px`,
      border:        this.getBorderStyle(),
      background:    this.getFillColor(),
      borderRadius:  '6px',
      boxShadow:     '0 1px 4px rgba(0,0,0,0.08)',
      pointerEvents: 'all',
      cursor:        'move',
      userSelect:    'none',
      boxSizing:     'border-box',
      fontFamily:    'system-ui, -apple-system, sans-serif',
    });

    // Label above skeleton
    const label = document.createElement('div');
    label.textContent = placement.componentType;
    Object.assign(label.style, {
      position:      'absolute',
      top:           '-18px',
      left:          '0',
      fontSize:      '10px',
      fontWeight:    '600',
      color:         this.getAccentColor(),
      whiteSpace:    'nowrap',
      pointerEvents: 'none',
    });
    el.appendChild(label);

    // Draw wireframe icon scaled inside the skeleton
    this.drawWireframeIcon(el, placement.componentType, placement.width, placement.height);

    // Resize handles
    this.addResizeHandle(el, placement, 'corner');
    this.addResizeHandle(el, placement, 'right');
    this.addResizeHandle(el, placement, 'bottom');

    this.container.appendChild(el);
    this.skeletons.set(placement.id, el);

    return el;
  }

  private drawWireframeIcon(container: HTMLDivElement, componentType: string, width: number, height: number): void {
    const iconSvg = getWireframeIcon(componentType);
    if (!iconSvg) return;

    const wireContainer = document.createElement('div');
    Object.assign(wireContainer.style, {
      position:       'absolute',
      inset:          '0',
      pointerEvents:  'none',
      overflow:       'hidden',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '16px',
    });

    // Scale the SVG proportionally to fill the skeleton with padding
    // The icon's native viewBox is 20x16
    const padding = 32; // 16px each side
    const availW = Math.max(20, width - padding);
    const availH = Math.max(16, height - padding);

    // Scale to fit while maintaining aspect ratio
    const scaleX = availW / 20;
    const scaleY = availH / 16;
    const scale = Math.min(scaleX, scaleY);

    const svgW = 20 * scale;
    const svgH = 16 * scale;

    iconSvg.setAttribute('width', `${svgW}`);
    iconSvg.setAttribute('height', `${svgH}`);
    // Keep the viewBox so strokes scale properly
    iconSvg.setAttribute('viewBox', '0 0 20 16');

    // Use the wireframe-aware accent color for stroke
    const accentColor = this.getAccentColor();
    iconSvg.style.color = isWireframe()
      ? 'rgba(249,115,22,0.5)'
      : 'rgba(59,130,246,0.5)';
    iconSvg.setAttribute('stroke', 'currentColor');

    wireContainer.appendChild(iconSvg);
    container.appendChild(wireContainer);
  }

  private addResizeHandle(
    el: HTMLDivElement,
    placement: LayoutPlacementData,
    type: 'corner' | 'right' | 'bottom',
  ): void {
    const handle = document.createElement('div');

    Object.assign(handle.style, {
      position:      'absolute',
      width:         '8px',
      height:        '8px',
      background:    this.getAccentColor(),
      borderRadius:  '2px',
      zIndex:        '10',
      pointerEvents: 'all',
    });

    if (type === 'corner') {
      handle.style.bottom = '-4px';
      handle.style.right = '-4px';
      handle.style.cursor = 'nwse-resize';
    } else if (type === 'right') {
      handle.style.top = 'calc(50% - 4px)';
      handle.style.right = '-4px';
      handle.style.cursor = 'ew-resize';
    } else {
      handle.style.bottom = '-4px';
      handle.style.left = 'calc(50% - 4px)';
      handle.style.cursor = 'ns-resize';
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

        placement.width = newW;
        placement.height = newH;
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;

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
    el.style.top = `${y}px`;
    if (width !== undefined) el.style.width = `${width}px`;
    if (height !== undefined) el.style.height = `${height}px`;
  }

  remove(id: string): void {
    const el = this.skeletons.get(id);
    if (!el) return;
    el.remove();
    this.skeletons.delete(id);
    if (this.selectedId === id) this.selectedId = null;
  }

  clear(): void {
    for (const [, el] of this.skeletons) {
      el.remove();
    }
    this.skeletons.clear();
    this.selectedId = null;
  }

  onResize(callback: ResizeCallback): void {
    this.resizeCallback = callback;
  }

  select(id: string): void {
    // Deselect previous
    if (this.selectedId && this.selectedId !== id) {
      this.deselect(this.selectedId);
    }

    const el = this.skeletons.get(id);
    if (!el) return;
    this.selectedId = id;
    const accent = this.getAccentColor();
    el.style.border = `1.5px solid ${accent}`;
    const shadowColor = isWireframe()
      ? 'rgba(249,115,22,0.2)'
      : 'rgba(59,130,246,0.2)';
    el.style.boxShadow = `0 0 0 2px ${shadowColor}, 0 1px 4px rgba(0,0,0,0.08)`;
  }

  deselect(id: string): void {
    const el = this.skeletons.get(id);
    if (!el) return;
    if (this.selectedId === id) this.selectedId = null;
    el.style.border = this.getBorderStyle();
    el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
  }
}
