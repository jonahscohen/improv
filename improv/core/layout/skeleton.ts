import type { LayoutPlacementData } from '../types.js';
import { PRIMITIVES, getPrimitive } from './primitives.js';

type ResizeCallback = (id: string, width: number, height: number) => void;

// Wireframe element descriptors
interface WireBar { type: 'bar'; x: number; y: number; width: number; }
interface WireBlock { type: 'block'; x: number; y: number; width: number; height: number; }
interface WireCircle { type: 'circle'; cx: number; cy: number; r: number; }
type WireElement = WireBar | WireBlock | WireCircle;

// Normalized wireframe layouts per component type (0-1 coordinate space)
const WIREFRAMES: Record<string, WireElement[]> = {
  // Layout
  navigation:  [{ type: 'bar', x: 0.05, y: 0.45, width: 0.9 }],
  header:      [{ type: 'bar', x: 0.1, y: 0.3, width: 0.6 }, { type: 'bar', x: 0.1, y: 0.6, width: 0.4 }],
  hero:        [{ type: 'block', x: 0.1, y: 0.15, width: 0.8, height: 0.5 }, { type: 'bar', x: 0.3, y: 0.75, width: 0.4 }],
  section:     [{ type: 'bar', x: 0.1, y: 0.15, width: 0.5 }, { type: 'block', x: 0.1, y: 0.35, width: 0.8, height: 0.5 }],
  sidebar:     [{ type: 'bar', x: 0.1, y: 0.1, width: 0.6 }, { type: 'bar', x: 0.1, y: 0.3, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.5, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.7, width: 0.7 }],
  footer:      [{ type: 'bar', x: 0.1, y: 0.4, width: 0.3 }, { type: 'bar', x: 0.5, y: 0.4, width: 0.4 }],
  modal:       [{ type: 'block', x: 0.1, y: 0.15, width: 0.8, height: 0.6 }, { type: 'bar', x: 0.3, y: 0.82, width: 0.4 }],
  banner:      [{ type: 'bar', x: 0.15, y: 0.45, width: 0.7 }],
  drawer:      [{ type: 'bar', x: 0.1, y: 0.08, width: 0.5 }, { type: 'bar', x: 0.1, y: 0.25, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.4, width: 0.8 }],
  popover:     [{ type: 'bar', x: 0.15, y: 0.3, width: 0.7 }, { type: 'bar', x: 0.15, y: 0.6, width: 0.5 }],
  divider:     [{ type: 'bar', x: 0.05, y: 0.45, width: 0.9 }],

  // Content
  card:        [{ type: 'block', x: 0.1, y: 0.1, width: 0.8, height: 0.45 }, { type: 'bar', x: 0.1, y: 0.65, width: 0.6 }, { type: 'bar', x: 0.1, y: 0.8, width: 0.4 }],
  text:        [{ type: 'bar', x: 0.05, y: 0.25, width: 0.9 }, { type: 'bar', x: 0.05, y: 0.5, width: 0.75 }, { type: 'bar', x: 0.05, y: 0.75, width: 0.6 }],
  image:       [{ type: 'block', x: 0.1, y: 0.1, width: 0.8, height: 0.8 }],
  video:       [{ type: 'block', x: 0.05, y: 0.05, width: 0.9, height: 0.9 }, { type: 'circle', cx: 0.5, cy: 0.5, r: 0.12 }],
  table:       [{ type: 'bar', x: 0.05, y: 0.15, width: 0.9 }, { type: 'bar', x: 0.05, y: 0.35, width: 0.9 }, { type: 'bar', x: 0.05, y: 0.55, width: 0.9 }, { type: 'bar', x: 0.05, y: 0.75, width: 0.9 }],
  grid:        [{ type: 'block', x: 0.05, y: 0.1, width: 0.42, height: 0.35 }, { type: 'block', x: 0.53, y: 0.1, width: 0.42, height: 0.35 }, { type: 'block', x: 0.05, y: 0.55, width: 0.42, height: 0.35 }, { type: 'block', x: 0.53, y: 0.55, width: 0.42, height: 0.35 }],
  list:        [{ type: 'bar', x: 0.1, y: 0.2, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.4, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.6, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.8, width: 0.7 }],
  chart:       [{ type: 'block', x: 0.1, y: 0.1, width: 0.8, height: 0.75 }, { type: 'bar', x: 0.2, y: 0.9, width: 0.6 }],
  codeBlock:   [{ type: 'bar', x: 0.08, y: 0.2, width: 0.7 }, { type: 'bar', x: 0.08, y: 0.4, width: 0.85 }, { type: 'bar', x: 0.08, y: 0.6, width: 0.5 }, { type: 'bar', x: 0.08, y: 0.8, width: 0.65 }],
  map:         [{ type: 'block', x: 0.05, y: 0.05, width: 0.9, height: 0.9 }],
  timeline:    [{ type: 'circle', cx: 0.15, cy: 0.25, r: 0.04 }, { type: 'bar', x: 0.25, y: 0.23, width: 0.6 }, { type: 'circle', cx: 0.15, cy: 0.5, r: 0.04 }, { type: 'bar', x: 0.25, y: 0.48, width: 0.5 }, { type: 'circle', cx: 0.15, cy: 0.75, r: 0.04 }, { type: 'bar', x: 0.25, y: 0.73, width: 0.55 }],
  calendar:    [{ type: 'bar', x: 0.1, y: 0.1, width: 0.8 }, { type: 'block', x: 0.1, y: 0.25, width: 0.8, height: 0.65 }],
  accordion:   [{ type: 'bar', x: 0.1, y: 0.2, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.45, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.7, width: 0.8 }],
  carousel:    [{ type: 'block', x: 0.15, y: 0.15, width: 0.7, height: 0.7 }, { type: 'circle', cx: 0.4, cy: 0.92, r: 0.02 }, { type: 'circle', cx: 0.5, cy: 0.92, r: 0.02 }, { type: 'circle', cx: 0.6, cy: 0.92, r: 0.02 }],
  logo:        [{ type: 'block', x: 0.2, y: 0.2, width: 0.6, height: 0.6 }],
  faq:         [{ type: 'bar', x: 0.05, y: 0.15, width: 0.7 }, { type: 'bar', x: 0.05, y: 0.35, width: 0.9 }, { type: 'bar', x: 0.05, y: 0.55, width: 0.65 }, { type: 'bar', x: 0.05, y: 0.75, width: 0.8 }],
  gallery:     [{ type: 'block', x: 0.05, y: 0.05, width: 0.3, height: 0.42 }, { type: 'block', x: 0.38, y: 0.05, width: 0.3, height: 0.42 }, { type: 'block', x: 0.05, y: 0.53, width: 0.3, height: 0.42 }, { type: 'block', x: 0.38, y: 0.53, width: 0.3, height: 0.42 }],

  // Controls
  button:      [{ type: 'bar', x: 0.2, y: 0.45, width: 0.6 }],
  input:       [{ type: 'block', x: 0.08, y: 0.25, width: 0.84, height: 0.5 }],
  search:      [{ type: 'block', x: 0.08, y: 0.25, width: 0.84, height: 0.5 }, { type: 'circle', cx: 0.85, cy: 0.5, r: 0.08 }],
  form:        [{ type: 'block', x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, { type: 'block', x: 0.1, y: 0.38, width: 0.8, height: 0.2 }, { type: 'bar', x: 0.3, y: 0.75, width: 0.4 }],
  tabs:        [{ type: 'bar', x: 0.05, y: 0.4, width: 0.25 }, { type: 'bar', x: 0.35, y: 0.4, width: 0.25 }, { type: 'bar', x: 0.65, y: 0.4, width: 0.25 }],
  dropdown:    [{ type: 'block', x: 0.1, y: 0.25, width: 0.8, height: 0.5 }],
  toggle:      [{ type: 'block', x: 0.15, y: 0.2, width: 0.7, height: 0.6 }, { type: 'circle', cx: 0.65, cy: 0.5, r: 0.2 }],
  stepper:     [{ type: 'bar', x: 0.15, y: 0.45, width: 0.7 }, { type: 'circle', cx: 0.3, cy: 0.45, r: 0.06 }, { type: 'circle', cx: 0.7, cy: 0.45, r: 0.06 }],
  rating:      [{ type: 'circle', cx: 0.2, cy: 0.5, r: 0.08 }, { type: 'circle', cx: 0.38, cy: 0.5, r: 0.08 }, { type: 'circle', cx: 0.56, cy: 0.5, r: 0.08 }, { type: 'circle', cx: 0.74, cy: 0.5, r: 0.08 }],
  fileUpload:  [{ type: 'block', x: 0.1, y: 0.15, width: 0.8, height: 0.7 }, { type: 'bar', x: 0.3, y: 0.55, width: 0.4 }],
  checkbox:    [{ type: 'block', x: 0.2, y: 0.2, width: 0.6, height: 0.6 }],
  radio:       [{ type: 'circle', cx: 0.5, cy: 0.5, r: 0.3 }],
  slider:      [{ type: 'bar', x: 0.1, y: 0.45, width: 0.8 }, { type: 'circle', cx: 0.6, cy: 0.45, r: 0.12 }],
  datePicker:  [{ type: 'bar', x: 0.1, y: 0.08, width: 0.8 }, { type: 'block', x: 0.1, y: 0.2, width: 0.8, height: 0.7 }],

  // Elements
  avatar:      [{ type: 'circle', cx: 0.5, cy: 0.5, r: 0.38 }],
  badge:       [{ type: 'bar', x: 0.15, y: 0.4, width: 0.7 }],
  tag:         [{ type: 'bar', x: 0.15, y: 0.4, width: 0.7 }],
  breadcrumb:  [{ type: 'bar', x: 0.05, y: 0.45, width: 0.25 }, { type: 'bar', x: 0.38, y: 0.45, width: 0.25 }, { type: 'bar', x: 0.7, y: 0.45, width: 0.25 }],
  pagination:  [{ type: 'block', x: 0.1, y: 0.25, width: 0.15, height: 0.5 }, { type: 'block', x: 0.3, y: 0.25, width: 0.15, height: 0.5 }, { type: 'block', x: 0.5, y: 0.25, width: 0.15, height: 0.5 }, { type: 'block', x: 0.7, y: 0.25, width: 0.15, height: 0.5 }],
  progress:    [{ type: 'bar', x: 0.05, y: 0.4, width: 0.9 }],
  alert:       [{ type: 'block', x: 0.05, y: 0.15, width: 0.9, height: 0.7 }, { type: 'bar', x: 0.15, y: 0.5, width: 0.5 }],
  toast:       [{ type: 'block', x: 0.05, y: 0.15, width: 0.9, height: 0.7 }, { type: 'bar', x: 0.15, y: 0.5, width: 0.6 }],
  notification:[{ type: 'circle', cx: 0.12, cy: 0.5, r: 0.08 }, { type: 'bar', x: 0.25, y: 0.35, width: 0.6 }, { type: 'bar', x: 0.25, y: 0.6, width: 0.4 }],
  tooltip:     [{ type: 'bar', x: 0.15, y: 0.4, width: 0.7 }],
  stat:        [{ type: 'bar', x: 0.1, y: 0.3, width: 0.4 }, { type: 'bar', x: 0.1, y: 0.6, width: 0.7 }],
  skeleton:    [{ type: 'bar', x: 0.05, y: 0.45, width: 0.9 }],
  chip:        [{ type: 'circle', cx: 0.2, cy: 0.5, r: 0.12 }, { type: 'bar', x: 0.35, y: 0.45, width: 0.5 }],
  icon:        [{ type: 'block', x: 0.2, y: 0.2, width: 0.6, height: 0.6 }],
  spinner:     [{ type: 'circle', cx: 0.5, cy: 0.5, r: 0.35 }],

  // Blocks
  pricing:     [{ type: 'bar', x: 0.2, y: 0.1, width: 0.6 }, { type: 'bar', x: 0.1, y: 0.3, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.5, width: 0.8 }, { type: 'bar', x: 0.2, y: 0.8, width: 0.6 }],
  testimonial: [{ type: 'bar', x: 0.1, y: 0.3, width: 0.8 }, { type: 'bar', x: 0.1, y: 0.5, width: 0.6 }, { type: 'circle', cx: 0.15, cy: 0.8, r: 0.06 }, { type: 'bar', x: 0.25, y: 0.78, width: 0.3 }],
  cta:         [{ type: 'bar', x: 0.2, y: 0.3, width: 0.6 }, { type: 'bar', x: 0.3, y: 0.55, width: 0.4 }, { type: 'block', x: 0.35, y: 0.72, width: 0.3, height: 0.15 }],
  productCard: [{ type: 'block', x: 0.1, y: 0.05, width: 0.8, height: 0.45 }, { type: 'bar', x: 0.1, y: 0.58, width: 0.7 }, { type: 'bar', x: 0.1, y: 0.72, width: 0.4 }, { type: 'bar', x: 0.1, y: 0.88, width: 0.5 }],
  profile:     [{ type: 'circle', cx: 0.5, cy: 0.3, r: 0.15 }, { type: 'bar', x: 0.25, y: 0.6, width: 0.5 }, { type: 'bar', x: 0.3, y: 0.75, width: 0.4 }],
  feature:     [{ type: 'block', x: 0.3, y: 0.1, width: 0.4, height: 0.3 }, { type: 'bar', x: 0.15, y: 0.55, width: 0.7 }, { type: 'bar', x: 0.2, y: 0.72, width: 0.6 }],
  team:        [{ type: 'circle', cx: 0.5, cy: 0.25, r: 0.15 }, { type: 'bar', x: 0.2, y: 0.5, width: 0.6 }, { type: 'bar', x: 0.25, y: 0.65, width: 0.5 }, { type: 'bar', x: 0.3, y: 0.8, width: 0.4 }],
  login:       [{ type: 'bar', x: 0.2, y: 0.15, width: 0.6 }, { type: 'block', x: 0.15, y: 0.3, width: 0.7, height: 0.15 }, { type: 'block', x: 0.15, y: 0.52, width: 0.7, height: 0.15 }, { type: 'bar', x: 0.25, y: 0.8, width: 0.5 }],
  contact:     [{ type: 'bar', x: 0.1, y: 0.1, width: 0.5 }, { type: 'block', x: 0.1, y: 0.25, width: 0.8, height: 0.15 }, { type: 'block', x: 0.1, y: 0.45, width: 0.8, height: 0.15 }, { type: 'block', x: 0.1, y: 0.65, width: 0.8, height: 0.2 }, { type: 'bar', x: 0.3, y: 0.9, width: 0.4 }],
};

export class SkeletonRenderer {
  private container: HTMLElement;
  private skeletons = new Map<string, HTMLDivElement>();
  private resizeCallback: ResizeCallback | null = null;
  private selectedId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
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
      border:        '1.5px dashed rgba(59,130,246,0.4)',
      background:    'rgba(59,130,246,0.08)',
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
      color:         '#3c82f7',
      whiteSpace:    'nowrap',
      pointerEvents: 'none',
    });
    el.appendChild(label);

    // Draw wireframe inside
    this.drawWireframe(el, placement.componentType, placement.width, placement.height);

    // Resize handles
    this.addResizeHandle(el, placement, 'corner');
    this.addResizeHandle(el, placement, 'right');
    this.addResizeHandle(el, placement, 'bottom');

    this.container.appendChild(el);
    this.skeletons.set(placement.id, el);

    return el;
  }

  private drawWireframe(container: HTMLDivElement, componentType: string, width: number, height: number): void {
    const elements = WIREFRAMES[componentType];
    if (!elements) return;

    const wireContainer = document.createElement('div');
    Object.assign(wireContainer.style, {
      position:      'absolute',
      inset:         '0',
      pointerEvents: 'none',
      overflow:      'hidden',
    });

    for (const elem of elements) {
      switch (elem.type) {
        case 'bar': {
          const bar = document.createElement('div');
          Object.assign(bar.style, {
            position:     'absolute',
            left:         `${elem.x * 100}%`,
            top:          `${elem.y * 100}%`,
            width:        `${elem.width * 100}%`,
            height:       '3px',
            background:   'rgba(59,130,246,0.18)',
            borderRadius: '2px',
          });
          wireContainer.appendChild(bar);
          break;
        }
        case 'block': {
          const block = document.createElement('div');
          Object.assign(block.style, {
            position:     'absolute',
            left:         `${elem.x * 100}%`,
            top:          `${elem.y * 100}%`,
            width:        `${elem.width * 100}%`,
            height:       `${elem.height * 100}%`,
            border:       '1px dashed rgba(59,130,246,0.35)',
            background:   'rgba(59,130,246,0.06)',
            borderRadius: '4px',
            boxSizing:    'border-box',
          });
          wireContainer.appendChild(block);
          break;
        }
        case 'circle': {
          // Use the smaller dimension to compute radius in px
          const rPx = elem.r * Math.min(width, height);
          const circle = document.createElement('div');
          Object.assign(circle.style, {
            position:     'absolute',
            left:         `calc(${elem.cx * 100}% - ${rPx}px)`,
            top:          `calc(${elem.cy * 100}% - ${rPx}px)`,
            width:        `${rPx * 2}px`,
            height:       `${rPx * 2}px`,
            border:       '1px dashed rgba(59,130,246,0.35)',
            background:   'rgba(59,130,246,0.06)',
            borderRadius: '50%',
            boxSizing:    'border-box',
          });
          wireContainer.appendChild(circle);
          break;
        }
      }
    }

    container.appendChild(wireContainer);
  }

  private addResizeHandle(
    el: HTMLDivElement,
    placement: LayoutPlacementData,
    type: 'corner' | 'right' | 'bottom',
  ): void {
    const handle = document.createElement('div');

    Object.assign(handle.style, {
      position:     'absolute',
      width:        '8px',
      height:       '8px',
      background:   '#3c82f7',
      borderRadius: '2px',
      zIndex:       '10',
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
    el.style.border = '1.5px solid #3c82f7';
    el.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2), 0 1px 4px rgba(0,0,0,0.08)';
  }

  deselect(id: string): void {
    const el = this.skeletons.get(id);
    if (!el) return;
    if (this.selectedId === id) this.selectedId = null;
    el.style.border = '1.5px dashed rgba(59,130,246,0.4)';
    el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
  }
}
