import { PRIMITIVES, getPrimitivesByCategory } from './primitives.js';
import type { PrimitiveType } from './primitives.js';

type DropCallback = (type: string, category: string, x: number, y: number) => void;
type ClearCallback = () => void;

const CATEGORIES: Array<PrimitiveType['category']> = [
  'layout',
  'content',
  'controls',
  'elements',
  'blocks',
];

const CATEGORY_LABELS: Record<string, string> = {
  layout:   'Layout',
  content:  'Content',
  controls: 'Controls',
  elements: 'Elements',
  blocks:   'Blocks',
};

export class ComponentPalette {
  private shadow: ShadowRoot;
  private panel: HTMLDivElement | null = null;
  private dropCallback: DropCallback | null = null;
  private clearCallback: ClearCallback | null = null;
  private placedCount = 0;
  private countLabel: HTMLSpanElement | null = null;
  private activeDragItem: HTMLDivElement | null = null;

  constructor(shadowRoot: ShadowRoot) {
    this.shadow = shadowRoot;
    this.build();
  }

  private build(): void {
    // Inject scrollbar and animation styles
    const style = document.createElement('style');
    style.textContent = [
      '@keyframes improv-palette-in {',
      '  from { opacity: 0; filter: blur(5px); }',
      '  to { opacity: 1; filter: blur(0); }',
      '}',
      '.improv-palette-scroll::-webkit-scrollbar { width: 3px; }',
      '.improv-palette-scroll::-webkit-scrollbar-track { background: transparent; }',
      '.improv-palette-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }',
    ].join('\n');
    this.shadow.appendChild(style);

    this.panel = document.createElement('div');
    Object.assign(this.panel.style, {
      position:      'fixed',
      bottom:        'calc(20px + 44px + 8px)',
      right:         '20px',
      width:         '256px',
      background:    '#1c1c1c',
      borderRadius:  '16px',
      boxShadow:     '0 1px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.04)',
      padding:       '13px 0 16px',
      zIndex:        '2147483646',
      pointerEvents: 'all',
      fontFamily:    'system-ui, -apple-system, sans-serif',
      display:       'flex',
      flexDirection: 'column',
      userSelect:    'none',
      animation:     'improv-palette-in 0.2s ease',
    });

    // Scrollable area
    const scrollWrap = document.createElement('div');
    Object.assign(scrollWrap.style, {
      position:  'relative',
      flex:      '1',
      minHeight: '0',
    });

    const scrollArea = document.createElement('div');
    scrollArea.className = 'improv-palette-scroll';
    Object.assign(scrollArea.style, {
      maxHeight: '240px',
      overflowY: 'auto',
      overflowX: 'hidden',
    });

    // Top edge fade
    const fadeTop = document.createElement('div');
    Object.assign(fadeTop.style, {
      position:       'absolute',
      top:            '0',
      left:           '0',
      right:          '0',
      height:         '32px',
      background:     'linear-gradient(to bottom, #1c1c1c, transparent)',
      pointerEvents:  'none',
      zIndex:         '1',
    });

    // Bottom edge fade
    const fadeBottom = document.createElement('div');
    Object.assign(fadeBottom.style, {
      position:       'absolute',
      bottom:         '0',
      left:           '0',
      right:          '0',
      height:         '32px',
      background:     'linear-gradient(to top, #1c1c1c, transparent)',
      pointerEvents:  'none',
      zIndex:         '1',
    });

    // Build sections
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const section = this.buildSection(cat, i === 0);
      scrollArea.appendChild(section);
    }

    scrollWrap.appendChild(fadeTop);
    scrollWrap.appendChild(scrollArea);
    scrollWrap.appendChild(fadeBottom);
    this.panel.appendChild(scrollWrap);

    // Footer
    this.panel.appendChild(this.buildFooter());

    this.shadow.appendChild(this.panel);

    document.addEventListener('dragover', this.handleDragOver);
    document.addEventListener('drop', this.handleDrop);
  }

  private buildSection(cat: PrimitiveType['category'], isFirst: boolean): HTMLDivElement {
    const section = document.createElement('div');

    if (!isFirst) {
      section.style.marginTop = '4px';
    }

    // Separator line
    const sep = document.createElement('div');
    Object.assign(sep.style, {
      height:     '1px',
      background: 'rgba(255,255,255,0.07)',
      margin:     '0',
    });
    if (!isFirst) {
      section.appendChild(sep);
    }

    // Section title
    const title = document.createElement('div');
    title.textContent = CATEGORY_LABELS[cat] ?? cat;
    Object.assign(title.style, {
      fontSize:      '0.6875rem',
      fontWeight:    '500',
      color:         'rgba(255,255,255,0.5)',
      textTransform: 'uppercase',
      padding:       '8px 12px',
      lineHeight:    '1',
    });
    section.appendChild(title);

    // Items
    const items = getPrimitivesByCategory(cat);
    for (const prim of items) {
      const row = this.buildItem(prim.name, cat);
      section.appendChild(row);
    }

    return section;
  }

  private buildItem(name: string, category: string): HTMLDivElement {
    const item = document.createElement('div');
    item.draggable = true;
    item.dataset['primitiveType'] = name;
    item.dataset['primitiveCategory'] = category;

    Object.assign(item.style, {
      display:      'flex',
      alignItems:   'center',
      minHeight:    '28px',
      padding:      '4px 12px',
      borderRadius: '6px',
      cursor:       'grab',
      gap:          '6px',
      border:       '1px solid transparent',
    });

    // Mini icon box
    const iconBox = document.createElement('div');
    Object.assign(iconBox.style, {
      width:        '20px',
      height:       '16px',
      border:       '1px dashed rgba(255,255,255,0.15)',
      background:   'rgba(255,255,255,0.04)',
      borderRadius: '3px',
      flexShrink:   '0',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
    });

    // Tiny SVG sketch per category
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '10');
    svg.setAttribute('viewBox', '0 0 14 10');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'rgba(255,255,255,0.35)');
    svg.setAttribute('stroke-width', '1');

    this.drawMiniIcon(svg, category);
    iconBox.appendChild(svg);
    item.appendChild(iconBox);

    // Label
    const label = document.createElement('span');
    label.textContent = name;
    Object.assign(label.style, {
      fontSize:     '0.8125rem',
      fontWeight:   '500',
      color:        'rgba(255,255,255,0.85)',
      overflow:     'hidden',
      whiteSpace:   'nowrap',
      textOverflow: 'ellipsis',
    });
    item.appendChild(label);

    // Hover
    item.addEventListener('mouseenter', () => {
      if (this.activeDragItem !== item) {
        item.style.background = 'rgba(255,255,255,0.06)';
      }
    });
    item.addEventListener('mouseleave', () => {
      if (this.activeDragItem !== item) {
        item.style.background = '';
        item.style.border = '1px solid transparent';
      }
    });

    // Drag
    item.addEventListener('dragstart', (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('improv/type', name);
      e.dataTransfer.setData('improv/category', category);
      this.activeDragItem = item;
      item.style.background = 'rgba(59,130,246,0.15)';
      item.style.border = '1px solid rgba(59,130,246,0.3)';
    });

    item.addEventListener('dragend', () => {
      this.activeDragItem = null;
      item.style.background = '';
      item.style.border = '1px solid transparent';
    });

    return item;
  }

  private drawMiniIcon(svg: SVGSVGElement, category: string): void {
    switch (category) {
      case 'layout': {
        // Horizontal lines (nav/header shape)
        const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l1.setAttribute('x1', '2'); l1.setAttribute('y1', '3');
        l1.setAttribute('x2', '12'); l1.setAttribute('y2', '3');
        const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l2.setAttribute('x1', '2'); l2.setAttribute('y1', '7');
        l2.setAttribute('x2', '9'); l2.setAttribute('y2', '7');
        svg.appendChild(l1);
        svg.appendChild(l2);
        break;
      }
      case 'content': {
        // Small rect (card)
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', '3'); r.setAttribute('y', '2');
        r.setAttribute('width', '8'); r.setAttribute('height', '6');
        r.setAttribute('rx', '1');
        svg.appendChild(r);
        break;
      }
      case 'controls': {
        // Small rounded rect (button)
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r.setAttribute('x', '2'); r.setAttribute('y', '3');
        r.setAttribute('width', '10'); r.setAttribute('height', '4');
        r.setAttribute('rx', '2');
        svg.appendChild(r);
        break;
      }
      case 'elements': {
        // Small circle (avatar)
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', '7'); c.setAttribute('cy', '5');
        c.setAttribute('r', '3');
        svg.appendChild(c);
        break;
      }
      case 'blocks': {
        // Stacked rects (pricing card)
        const r1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r1.setAttribute('x', '3'); r1.setAttribute('y', '1');
        r1.setAttribute('width', '8'); r1.setAttribute('height', '3');
        r1.setAttribute('rx', '0.5');
        const r2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        r2.setAttribute('x', '3'); r2.setAttribute('y', '5.5');
        r2.setAttribute('width', '8'); r2.setAttribute('height', '3');
        r2.setAttribute('rx', '0.5');
        svg.appendChild(r1);
        svg.appendChild(r2);
        break;
      }
    }
  }

  private buildFooter(): HTMLDivElement {
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display:     'flex',
      alignItems:  'center',
      justifyContent: 'space-between',
      padding:     '8px 12px',
      borderTop:   '1px solid rgba(255,255,255,0.07)',
    });

    // Count label
    this.countLabel = document.createElement('span');
    this.countLabel.textContent = '0 placed';
    Object.assign(this.countLabel.style, {
      fontSize:   '11px',
      fontWeight: '500',
      color:      'rgba(255,255,255,0.5)',
    });
    footer.appendChild(this.countLabel);

    // Clear button
    const clearBtn = document.createElement('span');
    clearBtn.textContent = 'Clear';
    Object.assign(clearBtn.style, {
      fontSize:   '11px',
      fontWeight: '500',
      color:      'rgba(255,255,255,0.5)',
      cursor:     'pointer',
    });
    clearBtn.addEventListener('mouseenter', () => {
      clearBtn.style.color = 'rgba(255,255,255,0.85)';
    });
    clearBtn.addEventListener('mouseleave', () => {
      clearBtn.style.color = 'rgba(255,255,255,0.5)';
    });
    clearBtn.addEventListener('click', () => {
      this.placedCount = 0;
      this.updateCountLabel();
      this.clearCallback?.();
    });
    footer.appendChild(clearBtn);

    return footer;
  }

  private updateCountLabel(): void {
    if (this.countLabel) {
      this.countLabel.textContent = `${this.placedCount} placed`;
    }
  }

  private handleDragOver = (e: DragEvent): void => {
    if (!e.dataTransfer?.types.includes('improv/type')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  private handleDrop = (e: DragEvent): void => {
    if (!e.dataTransfer?.types.includes('improv/type')) return;
    e.preventDefault();

    const type = e.dataTransfer.getData('improv/type');
    const category = e.dataTransfer.getData('improv/category');
    if (!type || !this.dropCallback) return;

    this.placedCount++;
    this.updateCountLabel();
    this.dropCallback(type, category, e.clientX, e.clientY);
  };

  show(): void {
    if (this.panel) this.panel.style.display = '';
  }

  hide(): void {
    if (this.panel) this.panel.style.display = 'none';
  }

  destroy(): void {
    document.removeEventListener('dragover', this.handleDragOver);
    document.removeEventListener('drop', this.handleDrop);
    this.panel?.remove();
    this.panel = null;
    this.countLabel = null;
  }

  onDrop(callback: DropCallback): void {
    this.dropCallback = callback;
  }

  getPlacedCount(): number {
    return this.placedCount;
  }

  onClear(callback: ClearCallback): void {
    this.clearCallback = callback;
  }
}
