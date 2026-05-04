import { getPrimitivesByCategory } from './primitives';
import type { PrimitiveType } from './primitives';

type DropCallback = (type: string, category: string, x: number, y: number) => void;

const CATEGORIES: Array<PrimitiveType['category']> = [
  'layout',
  'content',
  'controls',
  'elements',
  'blocks',
];

const CATEGORY_COLORS: Record<string, string> = {
  layout:   '#3b82f6',
  content:  '#8b5cf6',
  controls: '#22c55e',
  elements: '#f97316',
  blocks:   '#ec4899',
};

const CATEGORY_LABELS: Record<string, string> = {
  layout:   'Layout',
  content:  'Content',
  controls: 'Controls',
  elements: 'Elements',
  blocks:   'Blocks',
};

export class ComponentPalette {
  private shadow: ShadowRoot;
  private components: Array<{ name: string; category: string }>;
  private sidebar: HTMLDivElement | null = null;
  private dropCallback: DropCallback | null = null;
  private searchInput: HTMLInputElement | null = null;
  private categoryContainers = new Map<string, HTMLDivElement>();
  private activeDragItem: HTMLDivElement | null = null;

  constructor(
    shadow: ShadowRoot,
    components: Array<{ name: string; category: string }>,
  ) {
    this.shadow     = shadow;
    this.components = components;
    this.build();
  }

  private build(): void {
    this.sidebar = document.createElement('div');

    Object.assign(this.sidebar.style, {
      position:        'fixed',
      left:            '0',
      top:             '40px',
      bottom:          '40px',
      width:           '220px',
      background:      '#1a1a2e',
      border:          '1px solid #333',
      borderRadius:    '14px',
      boxShadow:       '0 8px 40px rgba(0,0,0,0.6)',
      backdropFilter:  'blur(12px)',
      zIndex:          '2147483646',
      pointerEvents:   'all',
      fontFamily:      'system-ui, -apple-system, sans-serif',
      display:         'flex',
      flexDirection:   'column',
      overflow:        'hidden',
      userSelect:      'none',
    });

    this.sidebar.appendChild(this.buildHeader());

    const scrollArea = document.createElement('div');
    Object.assign(scrollArea.style, {
      flex:      '1',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding:   '8px 0 12px',
    });

    // Scrollbar styling via a CSSStyleSheet on the shadow root
    this.injectScrollbarStyles();

    for (const cat of CATEGORIES) {
      const section = this.buildSection(cat as PrimitiveType['category']);
      scrollArea.appendChild(section);
    }

    this.sidebar.appendChild(scrollArea);
    this.shadow.appendChild(this.sidebar);

    document.addEventListener('dragover', this.handleDragOver);
    document.addEventListener('drop', this.handleDrop);
  }

  private injectScrollbarStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      div::-webkit-scrollbar { width: 4px; }
      div::-webkit-scrollbar-track { background: transparent; }
      div::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      div::-webkit-scrollbar-thumb:hover { background: #555; }
    `;
    this.shadow.appendChild(style);
  }

  private buildHeader(): HTMLDivElement {
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding:      '14px 14px 10px',
      borderBottom: '1px solid #2a2a3e',
      flexShrink:   '0',
    });

    const label = document.createElement('div');
    label.textContent = 'Components';
    Object.assign(label.style, {
      color:          '#999',
      fontSize:       '12px',
      fontWeight:     '600',
      textTransform:  'uppercase',
      letterSpacing:  '0.08em',
      marginBottom:   '10px',
    });
    header.appendChild(label);

    const searchWrap = document.createElement('div');
    Object.assign(searchWrap.style, {
      position:     'relative',
      display:      'flex',
      alignItems:   'center',
    });

    const searchIcon = document.createElement('div');
    Object.assign(searchIcon.style, {
      position:    'absolute',
      left:        '8px',
      color:       '#666',
      fontSize:    '12px',
      pointerEvents: 'none',
      lineHeight:  '1',
    });
    // Search icon via SVG (Heroicons magnifying-glass, verbatim)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '13');
    svg.setAttribute('height', '13');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '11');
    circle.setAttribute('cy', '11');
    circle.setAttribute('r', '8');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '21');
    line.setAttribute('y1', '21');
    line.setAttribute('x2', '16.65');
    line.setAttribute('y2', '16.65');
    svg.appendChild(circle);
    svg.appendChild(line);
    searchIcon.appendChild(svg);
    searchWrap.appendChild(searchIcon);

    const input = document.createElement('input');
    input.type        = 'text';
    input.placeholder = 'Filter...';
    Object.assign(input.style, {
      width:           '100%',
      background:      '#0f0f1a',
      border:          '1px solid #2a2a3e',
      borderRadius:    '8px',
      color:           '#d4d4d8',
      fontSize:        '12px',
      padding:         '6px 8px 6px 28px',
      outline:         'none',
      fontFamily:      'system-ui, sans-serif',
      transition:      'border-color 120ms ease',
    });
    input.addEventListener('focus', () => {
      input.style.borderColor = '#3b82f6';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#2a2a3e';
    });
    input.addEventListener('input', () => {
      this.applyFilter(input.value.toLowerCase().trim());
    });
    searchWrap.appendChild(input);
    header.appendChild(searchWrap);

    this.searchInput = input;
    return header;
  }

  private buildSection(cat: PrimitiveType['category']): HTMLDivElement {
    const color  = CATEGORY_COLORS[cat] ?? '#6366f1';
    const label  = CATEGORY_LABELS[cat] ?? cat;
    const items  = this.components.filter((c) => c.category === cat);
    const prims  = getPrimitivesByCategory(cat);

    const section = document.createElement('div');
    section.dataset['category'] = cat;
    Object.assign(section.style, { marginBottom: '2px' });

    // Section header row
    const headRow = document.createElement('div');
    Object.assign(headRow.style, {
      display:     'flex',
      alignItems:  'center',
      justifyContent: 'space-between',
      padding:     '7px 14px',
      cursor:      'pointer',
      transition:  'background 100ms ease',
    });
    headRow.addEventListener('mouseenter', () => {
      headRow.style.background = 'rgba(255,255,255,0.03)';
    });
    headRow.addEventListener('mouseleave', () => {
      headRow.style.background = '';
    });

    const headLeft = document.createElement('div');
    Object.assign(headLeft.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '7px',
    });

    const dot = document.createElement('div');
    Object.assign(dot.style, {
      width:        '7px',
      height:       '7px',
      borderRadius: '50%',
      background:   color,
      flexShrink:   '0',
    });

    const catLabel = document.createElement('span');
    catLabel.textContent = label;
    Object.assign(catLabel.style, {
      color:         '#c4c4cc',
      fontSize:      '11px',
      fontWeight:    '600',
      letterSpacing: '0.04em',
    });

    const countBadge = document.createElement('span');
    countBadge.textContent = String(items.length || prims.length);
    Object.assign(countBadge.style, {
      color:          '#555',
      fontSize:       '10px',
      fontWeight:     '500',
    });

    headLeft.appendChild(dot);
    headLeft.appendChild(catLabel);
    headLeft.appendChild(countBadge);

    // Chevron
    const chevron = document.createElement('div');
    Object.assign(chevron.style, {
      color:       '#555',
      fontSize:    '10px',
      transition:  'transform 180ms ease',
      lineHeight:  '1',
    });
    const chevSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevSvg.setAttribute('width', '10');
    chevSvg.setAttribute('height', '10');
    chevSvg.setAttribute('viewBox', '0 0 24 24');
    chevSvg.setAttribute('fill', 'none');
    chevSvg.setAttribute('stroke', 'currentColor');
    chevSvg.setAttribute('stroke-width', '2.5');
    chevSvg.setAttribute('stroke-linecap', 'round');
    chevSvg.setAttribute('stroke-linejoin', 'round');
    const chevPath = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    chevPath.setAttribute('points', '6 9 12 15 18 9');
    chevSvg.appendChild(chevPath);
    chevron.appendChild(chevSvg);

    headRow.appendChild(headLeft);
    headRow.appendChild(chevron);
    section.appendChild(headRow);

    // Item container
    const itemsContainer = document.createElement('div');
    Object.assign(itemsContainer.style, {
      overflow: 'hidden',
      transition: 'height 180ms ease',
    });

    const allItems = items.length ? items : prims;
    for (const comp of allItems) {
      const item = this.buildItem(comp.name, cat, color);
      itemsContainer.appendChild(item);
    }

    section.appendChild(itemsContainer);
    this.categoryContainers.set(cat, itemsContainer);

    // Measure natural height and set it
    let collapsed = false;
    const syncHeight = (): void => {
      if (!collapsed) {
        itemsContainer.style.height = 'auto';
      } else {
        itemsContainer.style.height = '0';
      }
    };

    headRow.addEventListener('click', () => {
      collapsed = !collapsed;
      chevron.style.transform = collapsed ? 'rotate(-90deg)' : '';
      syncHeight();
    });

    return section;
  }

  private buildItem(name: string, category: string, color: string): HTMLDivElement {
    const item = document.createElement('div');
    item.draggable                    = true;
    item.dataset['primitiveType']     = name;
    item.dataset['primitiveCategory'] = category;
    item.dataset['searchLabel']       = name.toLowerCase();

    Object.assign(item.style, {
      display:      'flex',
      alignItems:   'center',
      height:       '32px',
      padding:      '0 14px',
      gap:          '9px',
      cursor:       'grab',
      transition:   'background 100ms ease',
      borderRadius: '0',
    });

    const dot = document.createElement('div');
    Object.assign(dot.style, {
      width:        '6px',
      height:       '6px',
      borderRadius: '50%',
      background:   color,
      flexShrink:   '0',
      opacity:      '0.7',
    });

    const label = document.createElement('span');
    label.textContent = name;
    Object.assign(label.style, {
      color:     '#a0a0b0',
      fontSize:  '12px',
      fontWeight: '500',
      overflow:   'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    });

    item.appendChild(dot);
    item.appendChild(label);

    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255,255,255,0.05)';
      label.style.color     = '#e0e0ee';
    });
    item.addEventListener('mouseleave', () => {
      if (this.activeDragItem !== item) {
        item.style.background = '';
        label.style.color     = '#a0a0b0';
      }
    });

    item.addEventListener('dragstart', (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('improv/type',     name);
      e.dataTransfer.setData('improv/category', category);
      this.activeDragItem           = item;
      item.style.outline            = '2px solid #3b82f6';
      item.style.outlineOffset      = '-2px';
      item.style.borderRadius       = '4px';
    });

    item.addEventListener('dragend', () => {
      this.activeDragItem      = null;
      item.style.outline       = '';
      item.style.outlineOffset = '';
      item.style.borderRadius  = '';
      item.style.background    = '';
      label.style.color        = '#a0a0b0';
    });

    return item;
  }

  private applyFilter(query: string): void {
    if (!this.sidebar) return;

    const sections = this.sidebar.querySelectorAll<HTMLDivElement>('[data-category]');
    for (const section of sections) {
      const container = this.categoryContainers.get(
        section.dataset['category'] ?? '',
      );
      if (!container) continue;

      const allItems = container.querySelectorAll<HTMLDivElement>('[data-search-label]');
      let visibleCount = 0;

      for (const item of allItems) {
        const lbl = item.dataset['searchLabel'] ?? '';
        const matches = !query || lbl.includes(query);
        item.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
      }

      // Show/hide entire section
      section.style.display = visibleCount === 0 && query ? 'none' : '';

      // When filtering, auto-expand
      if (query && container.style.height === '0px') {
        container.style.height = 'auto';
      }
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

    const type     = e.dataTransfer.getData('improv/type');
    const category = e.dataTransfer.getData('improv/category');
    if (!type || !this.dropCallback) return;

    this.dropCallback(type, category, e.clientX, e.clientY);
  };

  show(): void {
    if (this.sidebar) this.sidebar.style.display = '';
  }

  hide(): void {
    if (this.sidebar) this.sidebar.style.display = 'none';
  }

  onDrop(callback: DropCallback): void {
    this.dropCallback = callback;
  }

  destroy(): void {
    document.removeEventListener('dragover', this.handleDragOver);
    document.removeEventListener('drop', this.handleDrop);
    this.sidebar?.remove();
    this.sidebar      = null;
    this.searchInput  = null;
    this.categoryContainers.clear();
  }
}
