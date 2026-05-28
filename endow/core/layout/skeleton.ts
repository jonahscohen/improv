import type { LayoutPlacementData } from '../types.js';
import { isWireframe, getAccentRGB } from './palette.js';

type ResizeCallback = (id: string, width: number, height: number) => void;

const SVG_NS = 'http://www.w3.org/2000/svg';

// --- Primitives ---

function bar(w: number | string, h = 3, strong = false): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = typeof w === 'number' ? `${w}px` : w;
  el.style.height = `${h}px`;
  el.style.borderRadius = '2px';
  el.style.background = strong ? 'var(--agd-bar-strong)' : 'var(--agd-bar)';
  el.style.flexShrink = '0';
  return el;
}

function block(w: number | string, h: number | string, radius = 3, extraStyle?: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = typeof w === 'number' ? `${w}px` : w;
  el.style.height = typeof h === 'number' ? `${h}px` : h;
  el.style.borderRadius = `${radius}px`;
  el.style.border = '1px dashed var(--agd-stroke)';
  el.style.background = 'var(--agd-fill)';
  el.style.flexShrink = '0';
  if (extraStyle) Object.assign(el.style, extraStyle);
  return el;
}

function circle(size: number, filled = false): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.border = '1px dashed var(--agd-stroke)';
  el.style.background = filled ? 'var(--agd-bar)' : 'var(--agd-fill)';
  el.style.flexShrink = '0';
  return el;
}

function row(gap = 6, ...children: HTMLElement[]): HTMLDivElement {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.flexDirection = 'row';
  el.style.alignItems = 'center';
  el.style.gap = `${gap}px`;
  el.style.width = '100%';
  for (const child of children) el.appendChild(child);
  return el;
}

function col(gap = 4, ...children: HTMLElement[]): HTMLDivElement {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.gap = `${gap}px`;
  el.style.width = '100%';
  for (const child of children) el.appendChild(child);
  return el;
}

// --- SVG helpers ---

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function makeSvg(w: number | string, h: number | string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  const ws = typeof w === 'number' ? `${w}` : w;
  const hs = typeof h === 'number' ? `${h}` : h;
  svg.setAttribute('width', ws);
  svg.setAttribute('height', hs);
  svg.setAttribute('viewBox', `0 0 ${ws} ${hs}`);
  svg.setAttribute('fill', 'none');
  svg.style.width = typeof w === 'number' ? `${w}px` : w;
  svg.style.height = typeof h === 'number' ? `${h}px` : h;
  svg.style.flexShrink = '0';
  return svg;
}

// --- Wireframe Builders ---
// Each builder: (container: HTMLDivElement, w: number, h: number) => void

type WireframeBuilder = (container: HTMLDivElement, w: number, h: number) => void;

const WIREFRAME_BUILDERS: Record<string, WireframeBuilder> = {

  // ── LAYOUT ──

  navigation(c, w, h) {
    const logo = block(Math.max(20, h * 0.5), Math.max(12, h * 0.4), 2);
    const spacer = document.createElement('div');
    spacer.style.flex = '1 1 0%';
    const n1 = bar(w * 0.06);
    const n2 = bar(w * 0.07);
    const n3 = bar(w * 0.05);
    const n4 = bar(w * 0.06);
    const navLinks = row(8, n1, n2, n3, n4);
    navLinks.style.width = 'auto';
    const cta = block(w * 0.1, Math.min(28, h * 0.5), 4);
    c.appendChild(row(8, logo, spacer, navLinks, cta));
  },

  hero(c, w, h) {
    const wrapper = col(6);
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.height = '100%';
    wrapper.appendChild(bar(w * 0.5, Math.max(6, h * 0.04), true));
    wrapper.appendChild(bar(w * 0.6));
    wrapper.appendChild(bar(w * 0.4));
    const btn = block(Math.min(140, w * 0.2), Math.min(36, h * 0.12), 6);
    btn.style.marginTop = `${h * 0.06}px`;
    wrapper.appendChild(btn);
    c.appendChild(wrapper);
  },

  header(c, w, h) {
    const wrapper = col(4);
    wrapper.style.alignItems = 'center';
    wrapper.appendChild(bar(w * 0.5, Math.max(5, h * 0.06), true));
    wrapper.appendChild(bar(w * 0.35));
    c.appendChild(wrapper);
  },

  section(c, w, _h) {
    const wrapper = col(6);
    wrapper.appendChild(bar(w * 0.3, 4, true));
    wrapper.appendChild(bar(w * 0.7));
    wrapper.appendChild(bar(w * 0.5));
    const blocks = row(6);
    blocks.style.flex = '1';
    blocks.style.alignItems = 'stretch';
    for (let i = 0; i < 3; i++) {
      const b = block('33%', '100%', 4);
      b.style.flex = '1';
      blocks.appendChild(b);
    }
    wrapper.appendChild(blocks);
    c.appendChild(wrapper);
  },

  sidebar(c, w, h) {
    const wrapper = col(6);
    wrapper.style.padding = `0 ${w * 0.08}px`;
    wrapper.appendChild(bar(w * 0.6, 4, true));
    const count = Math.max(3, Math.floor(h / 36));
    for (let i = 0; i < count; i++) {
      const r = row(6, block(10, 10, 2), bar(w * (0.4 + Math.random() * 0.3)));
      wrapper.appendChild(r);
    }
    c.appendChild(wrapper);
  },

  footer(c, w, _h) {
    const wrapper = row(12);
    wrapper.style.alignItems = 'flex-start';
    const colCount = Math.max(2, Math.min(4, Math.floor(w / 160)));
    for (let i = 0; i < colCount; i++) {
      const column = col(4);
      column.style.flex = '1';
      column.appendChild(bar('60%', 3, true));
      column.appendChild(bar('80%', 2));
      column.appendChild(bar('70%', 2));
      column.appendChild(bar('60%', 2));
      wrapper.appendChild(column);
    }
    c.appendChild(wrapper);
  },

  modal(c, w, _h) {
    // Header: title bar + close box
    const titleBar = bar('50%', 4, true);
    titleBar.style.flex = '1';
    const closeBox = block(14, 14, 2);
    const headerRow = row(6, titleBar, closeBox);

    // Body
    const body = col(4);
    body.style.flex = '1';
    body.appendChild(bar(w * 0.8));
    body.appendChild(bar(w * 0.6));
    body.appendChild(bar(w * 0.7));

    // Footer: two blocks
    const spacer = document.createElement('div');
    spacer.style.flex = '1 1 0%';
    const cancelBtn = block(60, 28, 4);
    const confirmBtn = block(60, 28, 4, { background: 'var(--agd-bar)' });
    const footerRow = row(6, spacer, cancelBtn, confirmBtn);

    c.appendChild(headerRow);
    c.appendChild(body);
    c.appendChild(footerRow);
  },

  card(c, _w, _h) {
    // Top 40% image area
    const imgArea = document.createElement('div');
    Object.assign(imgArea.style, {
      width: '100%',
      flex: '0 0 40%',
      background: 'var(--agd-fill)',
      borderBottom: '1px dashed var(--agd-stroke)',
      borderRadius: '3px 3px 0 0',
    });

    // Content area
    const content = col(4);
    content.style.flex = '1';
    content.appendChild(bar('70%', 4, true));
    content.appendChild(bar('90%', 2));
    content.appendChild(bar('60%', 2));
    content.appendChild(bar('80%', 2));

    c.appendChild(imgArea);
    c.appendChild(content);
  },

  text(c, w, h) {
    c.appendChild(bar(w * 0.6, 5, true));
    const count = Math.max(2, Math.floor(h / 18));
    const widths = [0.95, 0.85, 0.75, 0.9, 0.6, 0.8, 0.7, 0.65];
    for (let i = 0; i < count; i++) {
      c.appendChild(bar(`${(widths[i % widths.length]) * 100}%`, 2));
    }
  },

  image(c, _w, _h) {
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.flex = '1';
    svg.setAttribute('preserveAspectRatio', 'none');

    // X diagonal lines
    const line1 = svgEl('line', { x1: '0%', y1: '0%', x2: '100%', y2: '100%', stroke: 'var(--agd-stroke)', 'stroke-width': '1' });
    const line2 = svgEl('line', { x1: '100%', y1: '0%', x2: '0%', y2: '100%', stroke: 'var(--agd-stroke)', 'stroke-width': '1' });
    svg.appendChild(line1);
    svg.appendChild(line2);

    // Small circle at 30%, 30%
    const circ = svgEl('circle', { cx: '30%', cy: '30%', r: '8', fill: 'var(--agd-bar)', stroke: 'var(--agd-stroke)', 'stroke-width': '1' });
    svg.appendChild(circ);

    c.appendChild(svg);
  },

  video(c, _w, _h) {
    const wrapper = block('100%', '100%', 4, {
      flex: '1 1 0%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    // Play button: circle with CSS triangle inside
    const playCircle = circle(40);
    playCircle.style.display = 'flex';
    playCircle.style.alignItems = 'center';
    playCircle.style.justifyContent = 'center';

    const tri = document.createElement('div');
    tri.style.width = '0';
    tri.style.height = '0';
    tri.style.borderTop = '8px solid transparent';
    tri.style.borderBottom = '8px solid transparent';
    tri.style.borderLeft = '14px solid var(--agd-bar-strong)';
    tri.style.marginLeft = '3px';
    playCircle.appendChild(tri);

    wrapper.appendChild(playCircle);
    c.appendChild(wrapper);
  },

  table(c, w, h) {
    const cols = Math.max(2, Math.min(5, Math.floor(w / 80)));
    const rows = Math.max(2, Math.min(8, Math.floor(h / 28)));

    const wrapper = col(0);
    wrapper.style.height = '100%';

    // Header row
    const headerRow = row(8);
    headerRow.style.paddingBottom = '4px';
    headerRow.style.borderBottom = '1px solid var(--agd-stroke)';
    for (let j = 0; j < cols; j++) {
      const b = bar(`${100 / cols}%`, 3, true);
      b.style.flex = '1';
      headerRow.appendChild(b);
    }
    wrapper.appendChild(headerRow);

    // Data rows
    const widths = [0.7, 0.5, 0.8, 0.6, 0.9];
    for (let i = 0; i < rows; i++) {
      const dataRow = row(8);
      dataRow.style.paddingTop = '4px';
      dataRow.style.paddingBottom = '4px';
      if (i < rows - 1) dataRow.style.borderBottom = '1px solid var(--agd-fill)';
      for (let j = 0; j < cols; j++) {
        const b = bar(`${(widths[(i + j) % widths.length]) * (100 / cols)}%`, 2);
        b.style.flex = '1';
        dataRow.appendChild(b);
      }
      wrapper.appendChild(dataRow);
    }
    c.appendChild(wrapper);
  },

  list(c, _w, h) {
    const count = Math.max(2, Math.floor(h / 28));
    const widths = [0.7, 0.6, 0.75, 0.5, 0.65, 0.8];
    for (let i = 0; i < count; i++) {
      c.appendChild(row(8, circle(8), bar(`${widths[i % widths.length] * 100}%`, 2)));
    }
  },

  button(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });
    const btn = block('80%', '70%', 99, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    btn.appendChild(bar('50%', 3));
    wrapper.appendChild(btn);
    c.appendChild(wrapper);
  },

  input(c, _w, _h) {
    const label = bar('30%', 2, true);
    const field = block('100%', 32, 4, {
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      boxSizing: 'border-box',
    });
    field.appendChild(bar('40%', 2));
    c.appendChild(label);
    c.appendChild(field);
  },

  form(c, _w, h) {
    const fieldCount = Math.max(2, Math.min(5, Math.floor(h / 56)));
    for (let i = 0; i < fieldCount; i++) {
      c.appendChild(bar('25%', 2, true));
      c.appendChild(block('100%', 28, 4));
    }
    const submitRow = document.createElement('div');
    submitRow.style.display = 'flex';
    submitRow.style.justifyContent = 'flex-end';
    submitRow.style.width = '100%';
    submitRow.appendChild(block(80, 28, 6, { background: 'var(--agd-bar)' }));
    c.appendChild(submitRow);
  },

  tabs(c, _w, h) {
    const tabCount = Math.max(2, Math.min(4, Math.floor(h / 80) + 2));
    const tabRow = row(0);
    for (let i = 0; i < tabCount; i++) {
      const tab = document.createElement('div');
      Object.assign(tab.style, {
        flex: '1',
        textAlign: 'center',
        padding: '6px 0',
        borderBottom: i === 0 ? '2px solid var(--agd-bar-strong)' : '1px solid var(--agd-stroke)',
      });
      tab.appendChild(bar('60%', 2, i === 0));
      tab.style.display = 'flex';
      tab.style.justifyContent = 'center';
      tabRow.appendChild(tab);
    }
    c.appendChild(tabRow);

    const content = col(4);
    content.style.flex = '1';
    content.style.padding = '8px 0';
    content.appendChild(bar('80%', 2));
    content.appendChild(bar('60%', 2));
    content.appendChild(bar('70%', 2));
    c.appendChild(content);
  },

  avatar(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });

    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '48');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('fill', 'none');

    // Head circle
    const head = svgEl('circle', { cx: '24', cy: '18', r: '10', stroke: 'var(--agd-stroke)', 'stroke-width': '1.5', 'stroke-dasharray': '3,2', fill: 'var(--agd-fill)' });
    svg.appendChild(head);

    // Body arc
    const body = svgEl('path', { d: 'M8,44 Q8,32 24,30 Q40,32 40,44', stroke: 'var(--agd-stroke)', 'stroke-width': '1.5', 'stroke-dasharray': '3,2', fill: 'var(--agd-fill)' });
    svg.appendChild(body);

    wrapper.appendChild(svg);
    c.appendChild(wrapper);
  },

  badge(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });
    const pill = block(64, 24, 12, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    pill.appendChild(bar(32, 2));
    wrapper.appendChild(pill);
    c.appendChild(wrapper);
  },

  grid(c, w, h) {
    const cols = Math.max(2, Math.min(4, Math.floor(w / 80)));
    const rows = Math.max(2, Math.min(4, Math.floor(h / 60)));
    const g = document.createElement('div');
    Object.assign(g.style, {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap: '6px',
      width: '100%',
      height: '100%',
    });
    for (let i = 0; i < cols * rows; i++) {
      g.appendChild(block('100%', '100%', 3));
    }
    c.appendChild(g);
  },

  dropdown(c, _w, _h) {
    // Header bar
    const header = block('100%', 28, 4, {
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      boxSizing: 'border-box',
    });
    header.appendChild(bar('50%', 2, true));
    c.appendChild(header);

    // Dropdown items
    const items = col(0);
    items.style.flex = '1';
    items.style.border = '1px dashed var(--agd-stroke)';
    items.style.borderRadius = '4px';
    items.style.overflow = 'hidden';
    const labels = ['60%', '50%', '70%', '45%'];
    for (let i = 0; i < labels.length; i++) {
      const item = document.createElement('div');
      Object.assign(item.style, {
        padding: '6px 8px',
        background: i === 0 ? 'var(--agd-bar)' : 'transparent',
      });
      item.appendChild(bar(labels[i], 2));
      items.appendChild(item);
    }
    c.appendChild(items);
  },

  toggle(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });

    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '44');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 44 24');
    svg.setAttribute('fill', 'none');

    // Pill track
    const track = svgEl('rect', { x: '1', y: '1', width: '42', height: '22', rx: '11', stroke: 'var(--agd-stroke)', 'stroke-width': '1.5', 'stroke-dasharray': '3,2', fill: 'var(--agd-fill)' });
    svg.appendChild(track);

    // Circle thumb
    const thumb = svgEl('circle', { cx: '33', cy: '12', r: '8', fill: 'var(--agd-bar)', stroke: 'var(--agd-stroke)', 'stroke-width': '1' });
    svg.appendChild(thumb);

    wrapper.appendChild(svg);
    c.appendChild(wrapper);
  },

  search(c, _w, _h) {
    const wrapper = block('100%', 32, 16, {
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      gap: '8px',
      boxSizing: 'border-box',
    });
    // Magnifier circle
    wrapper.appendChild(circle(14));
    wrapper.appendChild(bar('50%', 2));
    c.appendChild(wrapper);
  },

  toast(c, _w, _h) {
    const iconCircle = circle(20);
    const textCol = col(2);
    textCol.style.flex = '1';
    textCol.appendChild(bar('60%', 3, true));
    textCol.appendChild(bar('80%', 2));
    const closeBox = block(12, 12, 2);
    c.appendChild(row(8, iconCircle, textCol, closeBox));
  },

  progress(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });

    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '8');
    svg.setAttribute('viewBox', '0 0 200 8');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = '100%';
    svg.style.height = '8px';

    // Track rect
    const trackRect = svgEl('rect', { x: '0', y: '0', width: '200', height: '8', rx: '4', fill: 'var(--agd-bar)' });
    svg.appendChild(trackRect);

    // Fill rect at 65%
    const fillRect = svgEl('rect', { x: '0', y: '0', width: '130', height: '8', rx: '4', fill: 'var(--agd-bar-strong)' });
    svg.appendChild(fillRect);

    wrapper.appendChild(svg);
    c.appendChild(wrapper);
  },

  chart(c, w, h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: '6px',
      width: '100%',
      height: '100%',
    });
    const barCount = Math.max(3, Math.min(8, Math.floor(w / 30)));
    const heights = [0.4, 0.65, 0.8, 0.5, 0.7, 0.35, 0.9, 0.55];
    for (let i = 0; i < barCount; i++) {
      const bh = heights[i % heights.length];
      const b = block(0, `${bh * 100}%`, 2);
      b.style.flex = '1';
      wrapper.appendChild(b);
    }
    c.appendChild(wrapper);
  },

  tooltip(c, _w, _h) {
    const body = block('100%', '100%', 4, {
      flex: '1 1 0%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    body.appendChild(bar('60%', 2));

    // Arrow triangle below
    const tri = document.createElement('div');
    Object.assign(tri.style, {
      width: '0',
      height: '0',
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
      borderTop: '6px solid var(--agd-stroke)',
      alignSelf: 'center',
      flexShrink: '0',
    });
    c.appendChild(body);
    c.appendChild(tri);
  },

  breadcrumb(c, _w, _h) {
    const r = row(6);
    const segments = [40, 50, 35];
    for (let i = 0; i < segments.length; i++) {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.textContent = '/';
        Object.assign(sep.style, {
          color: 'var(--agd-text-3)',
          fontSize: '10px',
          flexShrink: '0',
        });
        r.appendChild(sep);
      }
      r.appendChild(bar(segments[i], 2));
    }
    c.appendChild(r);
  },

  pagination(c, _w, _h) {
    const r = row(4);
    r.style.justifyContent = 'center';
    for (let i = 0; i < 5; i++) {
      const b = block(24, 24, 3);
      if (i === 2) b.style.background = 'var(--agd-bar-strong)';
      r.appendChild(b);
    }
    c.appendChild(r);
  },

  divider(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });
    const line = document.createElement('div');
    Object.assign(line.style, {
      width: '100%',
      height: '1px',
      background: 'var(--agd-stroke)',
    });
    wrapper.appendChild(line);
    c.appendChild(wrapper);
  },

  accordion(c, _w, h) {
    const count = Math.max(2, Math.min(5, Math.floor(h / 36)));
    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      Object.assign(item.style, {
        border: '1px dashed var(--agd-stroke)',
        borderRadius: '3px',
        padding: '8px',
        flex: i === 0 ? '2' : '1',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      });
      const headerRow = row(6);
      headerRow.style.justifyContent = 'space-between';
      const titleBar = bar('60%', 3, true);
      // Chevron
      const chevron = document.createElement('div');
      Object.assign(chevron.style, {
        width: '0',
        height: '0',
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: i === 0 ? '5px solid var(--agd-bar-strong)' : '5px solid var(--agd-bar)',
        flexShrink: '0',
        transform: i === 0 ? 'rotate(0deg)' : 'rotate(-90deg)',
      });
      headerRow.appendChild(titleBar);
      headerRow.appendChild(chevron);
      item.appendChild(headerRow);

      if (i === 0) {
        item.appendChild(bar('80%', 2));
        item.appendChild(bar('60%', 2));
      }
      c.appendChild(item);
    }
  },

  carousel(c, _w, _h) {
    // Slide area with arrows
    const arrowL = document.createElement('div');
    Object.assign(arrowL.style, {
      width: '0',
      height: '0',
      borderTop: '6px solid transparent',
      borderBottom: '6px solid transparent',
      borderRight: '8px solid var(--agd-bar-strong)',
      flexShrink: '0',
    });
    const slideArea = block('100%', '100%', 4);
    slideArea.style.flex = '1 1 0%';
    const arrowR = document.createElement('div');
    Object.assign(arrowR.style, {
      width: '0',
      height: '0',
      borderTop: '6px solid transparent',
      borderBottom: '6px solid transparent',
      borderLeft: '8px solid var(--agd-bar-strong)',
      flexShrink: '0',
    });
    const main = row(8, arrowL, slideArea, arrowR);
    main.style.flex = '1';

    // Dot indicators
    const dots = row(4);
    dots.style.justifyContent = 'center';
    dots.style.width = '100%';
    dots.appendChild(circle(6, true));
    dots.appendChild(circle(6));
    dots.appendChild(circle(6));
    c.appendChild(main);
    c.appendChild(dots);
  },

  pricing(c, w, _h) {
    const wrapper = col(6);
    wrapper.style.alignItems = 'center';
    wrapper.appendChild(bar(w * 0.4, 3, true));
    wrapper.appendChild(bar(w * 0.3, 5, true));

    // Feature rows
    for (let i = 0; i < 3; i++) {
      const featureRow = row(6);
      featureRow.style.width = '80%';
      featureRow.appendChild(circle(8, true));
      featureRow.appendChild(bar('70%', 2));
      wrapper.appendChild(featureRow);
    }

    // CTA button
    const cta = block(Math.min(120, w * 0.5), 28, 6, { background: 'var(--agd-bar)' });
    wrapper.appendChild(cta);
    c.appendChild(wrapper);
  },

  testimonial(c, _w, _h) {
    // Quote mark
    const quote = document.createElement('span');
    quote.textContent = '“';
    Object.assign(quote.style, {
      fontSize: '24px',
      lineHeight: '1',
      color: 'var(--agd-bar-strong)',
      flexShrink: '0',
    });
    c.appendChild(quote);

    // Body bars
    c.appendChild(bar('90%', 2));
    c.appendChild(bar('75%', 2));
    c.appendChild(bar('60%', 2));

    // Attribution row
    const attrRow = row(8, circle(16), col(2, bar(60, 3, true), bar(40, 2)));
    c.appendChild(attrRow);
  },

  cta(c, w, _h) {
    const wrapper = col(6);
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.height = '100%';
    wrapper.appendChild(bar(w * 0.5, 4, true));
    wrapper.appendChild(bar(w * 0.6, 2));
    const btn = block(Math.min(120, w * 0.3), 32, 6, { background: 'var(--agd-bar)' });
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.appendChild(bar(50, 2));
    wrapper.appendChild(btn);
    c.appendChild(wrapper);
  },

  alert(c, _w, _h) {
    // Icon circle with inner bar
    const iconCircle = circle(24);
    iconCircle.style.display = 'flex';
    iconCircle.style.alignItems = 'center';
    iconCircle.style.justifyContent = 'center';
    iconCircle.appendChild(bar(8, 8, true));

    const textCol = col(2);
    textCol.style.flex = '1';
    textCol.appendChild(bar('50%', 3, true));
    textCol.appendChild(bar('80%', 2));
    c.appendChild(row(8, iconCircle, textCol));
  },

  banner(c, w, h) {
    const textBar = bar('100%', 3);
    textBar.style.flex = '1';
    const actionBlock = block(60, Math.min(24, h * 0.6), 4);
    c.appendChild(row(8, textBar, actionBlock));
  },

  stat(c, _w, _h) {
    const wrapper = col(4);
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.height = '100%';
    wrapper.appendChild(bar('40%', 2));
    wrapper.appendChild(bar('60%', 6, true));
    wrapper.appendChild(bar('30%', 2));
    c.appendChild(wrapper);
  },

  stepper(c, _w, _h) {
    const r = row(0);
    r.style.justifyContent = 'center';
    r.style.alignItems = 'center';
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      r.appendChild(circle(20, i === 0));
      if (i < steps - 1) {
        const connector = document.createElement('div');
        Object.assign(connector.style, {
          flex: '1',
          height: '2px',
          background: i === 0 ? 'var(--agd-bar-strong)' : 'var(--agd-bar)',
        });
        r.appendChild(connector);
      }
    }
    c.appendChild(r);
  },

  tag(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });
    const pill = row(4);
    pill.style.width = 'auto';
    Object.assign(pill.style, {
      padding: '4px 8px',
      borderRadius: '12px',
      border: '1px dashed var(--agd-stroke)',
      background: 'var(--agd-fill)',
    });
    pill.appendChild(bar(32, 2));
    const closeCircle = circle(10);
    pill.appendChild(closeCircle);
    wrapper.appendChild(pill);
    c.appendChild(wrapper);
  },

  rating(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      gap: '4px',
    });
    for (let i = 0; i < 5; i++) {
      const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.style.flexShrink = '0';

      const star = svgEl('path', {
        d: 'M12,2 L14.9,8.6 L22,9.3 L16.8,14 L18.2,21 L12,17.3 L5.8,21 L7.2,14 L2,9.3 L9.1,8.6 Z',
        stroke: 'var(--agd-stroke)',
        'stroke-width': '1.5',
        fill: i < 3 ? 'var(--agd-bar-strong)' : 'var(--agd-fill)',
      });
      svg.appendChild(star);
      wrapper.appendChild(svg);
    }
    c.appendChild(wrapper);
  },

  map(c, _w, _h) {
    const wrapper = block('100%', '100%', 4, {
      flex: '1 1 0%',
      position: 'relative',
      overflow: 'hidden',
    });

    // SVG background lines + pin marker
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.setAttribute('preserveAspectRatio', 'none');

    // Background lines
    const l1 = svgEl('line', { x1: '0%', y1: '30%', x2: '100%', y2: '70%', stroke: 'var(--agd-stroke)', 'stroke-width': '1', 'stroke-dasharray': '4,3' });
    const l2 = svgEl('line', { x1: '20%', y1: '0%', x2: '80%', y2: '100%', stroke: 'var(--agd-stroke)', 'stroke-width': '1', 'stroke-dasharray': '4,3' });
    svg.appendChild(l1);
    svg.appendChild(l2);

    // Pin marker
    const pin = svgEl('path', {
      d: 'M 50%,35% m -8,0 a 8,8 0 1,1 16,0 a 8,8 0 1,1 -16,0',
      stroke: 'var(--agd-bar-strong)',
      'stroke-width': '1.5',
      fill: 'var(--agd-bar)',
    });
    // Use a group for the pin since % doesn't work in path d attribute
    const pinG = svgEl('g', { transform: 'translate(0,0)' });
    // Instead use circle + triangle for the pin
    const pinCircle = svgEl('circle', { cx: '50%', cy: '40%', r: '6', fill: 'var(--agd-bar)', stroke: 'var(--agd-bar-strong)', 'stroke-width': '1.5' });
    svg.appendChild(pinCircle);

    wrapper.appendChild(svg);
    c.appendChild(wrapper);
  },

  timeline(c, _w, h) {
    const count = Math.max(2, Math.min(5, Math.floor(h / 40)));
    const widths = [0.6, 0.5, 0.7, 0.55, 0.65];
    for (let i = 0; i < count; i++) {
      const itemRow = row(8);
      itemRow.style.position = 'relative';

      const dotCircle = circle(12, i === 0);
      // Connector line below (except last)
      if (i < count - 1) {
        const connector = document.createElement('div');
        Object.assign(connector.style, {
          position: 'absolute',
          left: '5px',
          top: '16px',
          width: '2px',
          height: 'calc(100% + 10px)',
          background: 'var(--agd-bar)',
        });
        itemRow.appendChild(connector);
      }
      itemRow.appendChild(dotCircle);
      itemRow.appendChild(bar(`${widths[i % widths.length] * 100}%`, 2));
      c.appendChild(itemRow);
    }
  },

  fileUpload(c, _w, _h) {
    const wrapper = block('100%', '100%', 4, {
      flex: '1 1 0%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
    });
    wrapper.style.borderStyle = 'dashed';

    // Upload arrow SVG
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.style.flexShrink = '0';

    const arrowLine = svgEl('line', { x1: '12', y1: '16', x2: '12', y2: '4', stroke: 'var(--agd-bar-strong)', 'stroke-width': '2', 'stroke-linecap': 'round' });
    const arrowHead = svgEl('path', { d: 'M8,8 L12,4 L16,8', stroke: 'var(--agd-bar-strong)', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(arrowLine);
    svg.appendChild(arrowHead);

    wrapper.appendChild(svg);
    wrapper.appendChild(bar('50%', 2));
    wrapper.appendChild(bar('30%', 2));
    c.appendChild(wrapper);
  },

  codeBlock(c, _w, h) {
    // Window chrome dots
    const dotsRow = row(4);
    dotsRow.appendChild(circle(6, true));
    dotsRow.appendChild(circle(6, true));
    dotsRow.appendChild(circle(6, true));
    c.appendChild(dotsRow);

    // Code lines with indentation
    const lineCount = Math.max(3, Math.min(8, Math.floor(h / 16)));
    const indents = [0, 12, 12, 24, 24, 12, 0, 12];
    const widths = ['70%', '50%', '60%', '40%', '55%', '65%', '45%', '50%'];
    for (let i = 0; i < lineCount; i++) {
      const codeLine = bar(widths[i % widths.length], 2);
      codeLine.style.marginLeft = `${indents[i % indents.length]}px`;
      c.appendChild(codeLine);
    }
  },

  calendar(c, _w, _h) {
    // Header with arrows + month bar
    const arrowL = document.createElement('div');
    Object.assign(arrowL.style, {
      width: '0',
      height: '0',
      borderTop: '4px solid transparent',
      borderBottom: '4px solid transparent',
      borderRight: '5px solid var(--agd-bar)',
      flexShrink: '0',
    });
    const monthBar = bar('40%', 3, true);
    monthBar.style.flex = '0 0 auto';
    const arrowR = document.createElement('div');
    Object.assign(arrowR.style, {
      width: '0',
      height: '0',
      borderTop: '4px solid transparent',
      borderBottom: '4px solid transparent',
      borderLeft: '5px solid var(--agd-bar)',
      flexShrink: '0',
    });
    const headerRow = row(6, arrowL, monthBar, arrowR);
    headerRow.style.justifyContent = 'space-between';
    c.appendChild(headerRow);

    // 7-col day grid
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '3px',
      width: '100%',
      flex: '1',
      alignContent: 'start',
    });
    // Day labels
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (const d of days) {
      const dayLabel = document.createElement('div');
      dayLabel.textContent = d;
      Object.assign(dayLabel.style, {
        fontSize: '7px',
        color: 'var(--agd-text-3)',
        textAlign: 'center',
      });
      grid.appendChild(dayLabel);
    }
    // Date cells (28 cells)
    for (let i = 0; i < 28; i++) {
      const cell = document.createElement('div');
      Object.assign(cell.style, {
        width: '100%',
        aspectRatio: '1',
        borderRadius: '2px',
        background: i === 14 ? 'var(--agd-bar-strong)' : 'transparent',
        border: i === 14 ? 'none' : '1px solid var(--agd-fill)',
      });
      grid.appendChild(cell);
    }
    c.appendChild(grid);
  },

  notification(c, _w, _h) {
    const iconCircle = circle(20);
    const textCol = col(2);
    textCol.style.flex = '1';
    textCol.appendChild(bar('50%', 3, true));
    textCol.appendChild(bar('80%', 2));
    const timestamp = bar(30, 2);
    c.appendChild(row(8, iconCircle, textCol, timestamp));
  },

  productCard(c, _w, _h) {
    // Image area 50%
    const imgArea = document.createElement('div');
    Object.assign(imgArea.style, {
      width: '100%',
      flex: '0 0 50%',
      background: 'var(--agd-fill)',
      border: '1px dashed var(--agd-stroke)',
      borderRadius: '3px',
    });
    c.appendChild(imgArea);

    // Title
    c.appendChild(bar('70%', 3, true));
    // Price
    c.appendChild(bar('40%', 3, true));
    // Buy button
    const buyBtn = block('100%', 28, 6, { background: 'var(--agd-bar)' });
    buyBtn.style.display = 'flex';
    buyBtn.style.alignItems = 'center';
    buyBtn.style.justifyContent = 'center';
    buyBtn.appendChild(bar(40, 2));
    c.appendChild(buyBtn);
  },

  profile(c, _w, _h) {
    const wrapper = col(6);
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.height = '100%';

    // Circle avatar
    wrapper.appendChild(circle(40));
    // Name
    wrapper.appendChild(bar('50%', 4, true));
    // Subtitle
    wrapper.appendChild(bar('35%', 2));

    // 3 stat columns
    const statsRow = row(12);
    statsRow.style.justifyContent = 'center';
    for (let i = 0; i < 3; i++) {
      const statCol = col(2);
      statCol.style.alignItems = 'center';
      statCol.style.width = 'auto';
      statCol.appendChild(bar(20, 4, true));
      statCol.appendChild(bar(24, 2));
      statsRow.appendChild(statCol);
    }
    wrapper.appendChild(statsRow);
    c.appendChild(wrapper);
  },

  drawer(c, _w, _h) {
    const wrapper = row(0);
    wrapper.style.height = '100%';
    wrapper.style.alignItems = 'stretch';

    // Left overlay panel
    const leftPanel = document.createElement('div');
    Object.assign(leftPanel.style, {
      flex: '0.4',
      height: '100%',
      opacity: '0.3',
      background: 'var(--agd-fill)',
      borderRadius: '4px',
    });

    // Right solid panel with items
    const rightPanel = col(6);
    Object.assign(rightPanel.style, {
      flex: '0.6',
      height: '100%',
      background: 'var(--agd-fill)',
      border: '1px dashed var(--agd-stroke)',
      borderRadius: '4px',
      padding: '12px',
      boxSizing: 'border-box',
    });
    rightPanel.appendChild(bar('70%', 3, true));
    rightPanel.appendChild(bar('50%', 2));
    rightPanel.appendChild(bar('60%', 2));
    rightPanel.appendChild(bar('45%', 2));

    wrapper.appendChild(leftPanel);
    wrapper.appendChild(rightPanel);
    c.appendChild(wrapper);
  },

  popover(c, _w, _h) {
    const body = block('100%', '100%', 4, {
      flex: '1 1 0%',
      display: 'flex',
      flexDirection: 'column',
      padding: '8px',
      gap: '4px',
      boxSizing: 'border-box',
      justifyContent: 'center',
    });
    body.appendChild(bar('70%', 2));
    body.appendChild(bar('50%', 2));

    // Arrow triangle
    const tri = document.createElement('div');
    Object.assign(tri.style, {
      width: '0',
      height: '0',
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
      borderTop: '6px solid var(--agd-stroke)',
      alignSelf: 'center',
      flexShrink: '0',
    });
    c.appendChild(body);
    c.appendChild(tri);
  },

  logo(c, _w, _h) {
    const iconBlock = block(28, 28, 4);
    const titleBar = bar(60, 4, true);
    c.appendChild(row(8, iconBlock, titleBar));
  },

  faq(c, _w, h) {
    const count = Math.max(2, Math.min(5, Math.floor(h / 40)));
    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      Object.assign(item.style, {
        border: '1px dashed var(--agd-stroke)',
        borderRadius: '3px',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      });

      const qRow = row(6);
      const qLabel = document.createElement('span');
      qLabel.textContent = 'Q';
      Object.assign(qLabel.style, {
        fontSize: '9px',
        fontWeight: '600',
        color: 'var(--agd-bar-strong)',
        flexShrink: '0',
      });
      qRow.appendChild(qLabel);
      qRow.appendChild(bar('70%', 2, true));
      item.appendChild(qRow);

      // First item expanded
      if (i === 0) {
        item.appendChild(bar('90%', 2));
        item.appendChild(bar('75%', 2));
      }
      c.appendChild(item);
    }
  },

  gallery(c, w, h) {
    const cols = Math.max(2, Math.min(4, Math.floor(w / 60)));
    const rows = Math.max(2, Math.min(3, Math.floor(h / 60)));
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gap: '4px',
      width: '100%',
      height: '100%',
    });

    for (let i = 0; i < cols * rows; i++) {
      const cell = block('100%', '100%', 2, {
        position: 'relative',
        overflow: 'hidden',
      });
      // X-pattern SVG
      const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.setAttribute('preserveAspectRatio', 'none');
      const d1 = svgEl('line', { x1: '0', y1: '0', x2: '100%', y2: '100%', stroke: 'var(--agd-stroke)', 'stroke-width': '0.5' });
      const d2 = svgEl('line', { x1: '100%', y1: '0', x2: '0', y2: '100%', stroke: 'var(--agd-stroke)', 'stroke-width': '0.5' });
      svg.appendChild(d1);
      svg.appendChild(d2);
      cell.appendChild(svg);
      grid.appendChild(cell);
    }
    c.appendChild(grid);
  },

  checkbox(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });

    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');

    // Square
    const rect = svgEl('rect', { x: '3', y: '3', width: '18', height: '18', rx: '3', stroke: 'var(--agd-stroke)', 'stroke-width': '1.5', 'stroke-dasharray': '3,2', fill: 'var(--agd-fill)' });
    svg.appendChild(rect);

    // Checkmark path
    const check = svgEl('path', { d: 'M7,12 L10,15 L17,8', stroke: 'var(--agd-bar-strong)', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' });
    svg.appendChild(check);

    wrapper.appendChild(svg);
    c.appendChild(wrapper);
  },

  radio(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });

    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');

    // Outer circle
    const outer = svgEl('circle', { cx: '12', cy: '12', r: '10', stroke: 'var(--agd-stroke)', 'stroke-width': '1.5', 'stroke-dasharray': '3,2', fill: 'var(--agd-fill)' });
    svg.appendChild(outer);

    // Inner filled dot
    const inner = svgEl('circle', { cx: '12', cy: '12', r: '5', fill: 'var(--agd-bar-strong)' });
    svg.appendChild(inner);

    wrapper.appendChild(svg);
    c.appendChild(wrapper);
  },

  slider(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      position: 'relative',
    });

    // Track line
    const track = document.createElement('div');
    Object.assign(track.style, {
      position: 'absolute',
      left: '0',
      width: '100%',
      height: '2px',
      borderRadius: '1px',
      background: 'var(--agd-bar)',
    });

    // Fill portion (60%)
    const fill = document.createElement('div');
    Object.assign(fill.style, {
      position: 'absolute',
      left: '0',
      width: '60%',
      height: '2px',
      borderRadius: '1px',
      background: 'var(--agd-bar-strong)',
    });

    // Circle thumb
    const thumb = circle(14, true);
    Object.assign(thumb.style, {
      position: 'absolute',
      left: 'calc(60% - 7px)',
    });

    wrapper.appendChild(track);
    wrapper.appendChild(fill);
    wrapper.appendChild(thumb);
    c.appendChild(wrapper);
  },

  datePicker(c, _w, _h) {
    // Input field with calendar icon
    const inputField = block('100%', 28, 4, {
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      gap: '6px',
      boxSizing: 'border-box',
    });
    inputField.appendChild(bar('50%', 2));
    const spacer = document.createElement('div');
    spacer.style.flex = '1 1 0%';
    inputField.appendChild(spacer);
    inputField.appendChild(block(14, 14, 2));
    c.appendChild(inputField);

    // Dropdown calendar grid
    const calGrid = document.createElement('div');
    Object.assign(calGrid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '2px',
      width: '100%',
      flex: '1',
      alignContent: 'start',
      border: '1px dashed var(--agd-stroke)',
      borderRadius: '4px',
      padding: '6px',
      boxSizing: 'border-box',
    });
    for (let i = 0; i < 21; i++) {
      const cell = document.createElement('div');
      Object.assign(cell.style, {
        width: '100%',
        aspectRatio: '1',
        borderRadius: '2px',
        background: i === 10 ? 'var(--agd-bar-strong)' : 'transparent',
      });
      calGrid.appendChild(cell);
    }
    c.appendChild(calGrid);
  },

  skeleton(c, _w, _h) {
    const widths = ['80%', '60%', '70%', '50%'];
    for (const w of widths) {
      const rect = document.createElement('div');
      Object.assign(rect.style, {
        width: w,
        height: '8px',
        borderRadius: '3px',
        background: 'var(--agd-bar)',
      });
      c.appendChild(rect);
    }
  },

  chip(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });
    const pill = row(4);
    pill.style.width = 'auto';
    Object.assign(pill.style, {
      padding: '4px 8px',
      borderRadius: '12px',
      border: '1px dashed var(--agd-stroke)',
      background: 'var(--agd-fill)',
    });
    pill.appendChild(bar(32, 2));
    pill.appendChild(circle(10));
    wrapper.appendChild(pill);
    c.appendChild(wrapper);
  },

  icon(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });

    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');

    // Star outline
    const star = svgEl('path', {
      d: 'M12,2 L14.9,8.6 L22,9.3 L16.8,14 L18.2,21 L12,17.3 L5.8,21 L7.2,14 L2,9.3 L9.1,8.6 Z',
      stroke: 'var(--agd-stroke)',
      'stroke-width': '1.5',
      fill: 'none',
    });
    svg.appendChild(star);

    wrapper.appendChild(svg);
    c.appendChild(wrapper);
  },

  spinner(c, _w, _h) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    });

    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('fill', 'none');

    // Background circle
    const bg = svgEl('circle', { cx: '16', cy: '16', r: '12', stroke: 'var(--agd-bar)', 'stroke-width': '2.5' });
    svg.appendChild(bg);

    // Quarter arc
    const arc = svgEl('path', {
      d: 'M16,4 A12,12 0 0,1 28,16',
      stroke: 'var(--agd-bar-strong)',
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      fill: 'none',
    });
    svg.appendChild(arc);

    wrapper.appendChild(svg);
    c.appendChild(wrapper);
  },

  feature(c, _w, h) {
    const count = Math.max(2, Math.min(4, Math.floor(h / 48)));
    for (let i = 0; i < count; i++) {
      const iconBlock = block(28, 28, 4);
      const textCol = col(2);
      textCol.style.flex = '1';
      textCol.appendChild(bar('50%', 3, true));
      textCol.appendChild(bar('80%', 2));
      c.appendChild(row(8, iconBlock, textCol));
    }
  },

  team(c, _w, _h) {
    c.appendChild(bar('40%', 4, true));

    const avatarRow = row(12);
    avatarRow.style.justifyContent = 'center';
    for (let i = 0; i < 3; i++) {
      const member = col(4);
      member.style.alignItems = 'center';
      member.style.width = 'auto';
      member.appendChild(circle(28));
      member.appendChild(bar(40, 2, true));
      member.appendChild(bar(30, 2));
      avatarRow.appendChild(member);
    }
    c.appendChild(avatarRow);
  },

  login(c, _w, _h) {
    const wrapper = col(6);
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.height = '100%';

    wrapper.appendChild(bar('50%', 4, true));
    wrapper.appendChild(bar('35%', 2));
    wrapper.appendChild(block('90%', 28, 4));
    wrapper.appendChild(block('90%', 28, 4));
    const submitBtn = block('90%', 28, 6, { background: 'var(--agd-bar)' });
    wrapper.appendChild(submitBtn);

    // Footer link
    const footerLink = bar('40%', 2);
    footerLink.style.marginTop = '4px';
    wrapper.appendChild(footerLink);
    c.appendChild(wrapper);
  },

  contact(c, _w, _h) {
    const wrapper = col(6);
    wrapper.style.height = '100%';

    wrapper.appendChild(bar('40%', 4, true));
    wrapper.appendChild(bar('60%', 2));

    // Name row (2 fields side by side)
    const nameRow = row(6);
    nameRow.appendChild(block('100%', 28, 4, { flex: '1' }));
    nameRow.appendChild(block('100%', 28, 4, { flex: '1' }));
    wrapper.appendChild(nameRow);

    // Email field
    wrapper.appendChild(block('100%', 28, 4));

    // Message textarea
    const textarea = block('100%', '100%', 4);
    textarea.style.flex = '1 1 0%';
    wrapper.appendChild(textarea);

    // Submit block
    const submitRow = document.createElement('div');
    submitRow.style.display = 'flex';
    submitRow.style.justifyContent = 'flex-end';
    submitRow.style.width = '100%';
    submitRow.appendChild(block(80, 28, 6, { background: 'var(--agd-bar)' }));
    wrapper.appendChild(submitRow);
    c.appendChild(wrapper);
  },
};

// --- Renderer ---

export class SkeletonRenderer {
  private container: HTMLElement;
  private skeletons = new Map<string, HTMLDivElement>();
  private resizeCallback: ResizeCallback | null = null;
  private selectedId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  private getCSSVars(): Record<string, string> {
    if (isWireframe()) {
      return {
        '--agd-stroke': 'rgba(249, 115, 22, 0.35)',
        '--agd-fill': 'rgba(249, 115, 22, 0.06)',
        '--agd-bar': 'rgba(249, 115, 22, 0.18)',
        '--agd-bar-strong': 'rgba(249, 115, 22, 0.28)',
        '--agd-text-3': 'rgba(255,255,255,0.35)',
      };
    }
    const [r, g, b] = getAccentRGB();
    return {
      '--agd-stroke': `rgba(${r}, ${g}, ${b}, 0.35)`,
      '--agd-fill': `rgba(${r}, ${g}, ${b}, 0.06)`,
      '--agd-bar': `rgba(${r}, ${g}, ${b}, 0.18)`,
      '--agd-bar-strong': `rgba(${r}, ${g}, ${b}, 0.28)`,
      '--agd-text-3': 'rgba(255,255,255,0.35)',
    };
  }

  private getAccentColor(): string {
    if (isWireframe()) return '#f97316';
    const [r, g, b] = getAccentRGB();
    return `rgb(${r},${g},${b})`;
  }

  private getBorderStyle(): string {
    return '1.5px dashed var(--agd-stroke)';
  }

  create(placement: LayoutPlacementData, _categoryColor?: string): HTMLDivElement {
    const el = document.createElement('div');
    el.dataset['skeletonId'] = placement.id;

    // Set CSS custom properties
    const vars = this.getCSSVars();
    for (const [key, val] of Object.entries(vars)) {
      el.style.setProperty(key, val);
    }

    Object.assign(el.style, {
      position: 'absolute',
      left: `${placement.x}px`,
      top: `${placement.y}px`,
      width: `${placement.width}px`,
      height: `${placement.height}px`,
      border: this.getBorderStyle(),
      background: 'var(--agd-fill)',
      borderRadius: '6px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      pointerEvents: 'all',
      cursor: 'move',
      userSelect: 'none',
      boxSizing: 'border-box',
      fontFamily: "'EndowSans', system-ui, sans-serif",
      zIndex: '2147483610',
    });

    // Label above skeleton
    const label = document.createElement('span');
    label.textContent = placement.componentType;
    Object.assign(label.style, {
      position: 'absolute',
      top: '-18px',
      left: '0',
      fontSize: '10px',
      fontWeight: '600',
      color: this.getAccentColor(),
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    });
    el.appendChild(label);

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'content';
    Object.assign(content.style, {
      width: '100%',
      height: '100%',
      padding: '8px',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      overflow: 'hidden',
    });

    // Inner flex container
    const inner = document.createElement('div');
    Object.assign(inner.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      gap: '9.6px',
      boxSizing: 'border-box',
    });

    // Build wireframe content
    const builder = WIREFRAME_BUILDERS[placement.componentType];
    if (builder) {
      builder(inner, placement.width, placement.height);
    } else {
      // Fallback: generic block
      const fb = block('100%', '100%');
      fb.style.flex = '1 1 0%';
      inner.appendChild(fb);
    }

    content.appendChild(inner);
    el.appendChild(content);

    // Resize handles (4 corners + 4 edges)
    this.addResizeHandle(el, placement, 'nw');
    this.addResizeHandle(el, placement, 'ne');
    this.addResizeHandle(el, placement, 'sw');
    this.addResizeHandle(el, placement, 'se');
    this.addResizeHandle(el, placement, 'n');
    this.addResizeHandle(el, placement, 'e');
    this.addResizeHandle(el, placement, 's');
    this.addResizeHandle(el, placement, 'w');

    this.container.appendChild(el);
    this.skeletons.set(placement.id, el);

    return el;
  }

  private addResizeHandle(
    el: HTMLDivElement,
    placement: LayoutPlacementData,
    direction: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w',
  ): void {
    const handle = document.createElement('div');
    const isCorner = direction.length === 2;

    Object.assign(handle.style, {
      position: 'absolute',
      background: this.getAccentColor(),
      borderRadius: '2px',
      zIndex: '2147483610',
      pointerEvents: 'all',
    });

    if (isCorner) {
      handle.style.width = '8px';
      handle.style.height = '8px';
    } else {
      if (direction === 'n' || direction === 's') {
        handle.style.width = '16px';
        handle.style.height = '4px';
      } else {
        handle.style.width = '4px';
        handle.style.height = '16px';
      }
    }

    // Position
    switch (direction) {
      case 'nw':
        handle.style.top = '-4px';
        handle.style.left = '-4px';
        handle.style.cursor = 'nwse-resize';
        break;
      case 'ne':
        handle.style.top = '-4px';
        handle.style.right = '-4px';
        handle.style.cursor = 'nesw-resize';
        break;
      case 'sw':
        handle.style.bottom = '-4px';
        handle.style.left = '-4px';
        handle.style.cursor = 'nesw-resize';
        break;
      case 'se':
        handle.style.bottom = '-4px';
        handle.style.right = '-4px';
        handle.style.cursor = 'nwse-resize';
        break;
      case 'n':
        handle.style.top = '-2px';
        handle.style.left = 'calc(50% - 8px)';
        handle.style.cursor = 'ns-resize';
        break;
      case 's':
        handle.style.bottom = '-2px';
        handle.style.left = 'calc(50% - 8px)';
        handle.style.cursor = 'ns-resize';
        break;
      case 'e':
        handle.style.right = '-2px';
        handle.style.top = 'calc(50% - 8px)';
        handle.style.cursor = 'ew-resize';
        break;
      case 'w':
        handle.style.left = '-2px';
        handle.style.top = 'calc(50% - 8px)';
        handle.style.cursor = 'ew-resize';
        break;
    }

    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e: MouseEvent): void => {
      e.stopPropagation();
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startW = placement.width;
      startH = placement.height;
      startLeft = placement.x;
      startTop = placement.y;

      const onMove = (me: MouseEvent): void => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        let newW = startW;
        let newH = startH;
        let newX = startLeft;
        let newY = startTop;

        switch (direction) {
          case 'se':
            newW = Math.max(40, startW + dx);
            newH = Math.max(20, startH + dy);
            break;
          case 'sw':
            newW = Math.max(40, startW - dx);
            newH = Math.max(20, startH + dy);
            newX = startLeft + (startW - newW);
            break;
          case 'ne':
            newW = Math.max(40, startW + dx);
            newH = Math.max(20, startH - dy);
            newY = startTop + (startH - newH);
            break;
          case 'nw':
            newW = Math.max(40, startW - dx);
            newH = Math.max(20, startH - dy);
            newX = startLeft + (startW - newW);
            newY = startTop + (startH - newH);
            break;
          case 'e':
            newW = Math.max(40, startW + dx);
            break;
          case 'w':
            newW = Math.max(40, startW - dx);
            newX = startLeft + (startW - newW);
            break;
          case 's':
            newH = Math.max(20, startH + dy);
            break;
          case 'n':
            newH = Math.max(20, startH - dy);
            newY = startTop + (startH - newH);
            break;
        }

        placement.width = newW;
        placement.height = newH;
        placement.x = newX;
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;

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

  refreshColors(): void {
    const vars = this.getCSSVars();
    const accent = this.getAccentColor();
    for (const [, el] of this.skeletons) {
      // Re-apply CSS custom properties
      for (const [key, val] of Object.entries(vars)) {
        el.style.setProperty(key, val);
      }
      // Update label color
      const label = el.querySelector('span') as HTMLSpanElement | null;
      if (label) {
        label.style.color = accent;
      }
      // Update resize handles
      const handles = el.querySelectorAll('div');
      handles.forEach((handle) => {
        const cursor = (handle as HTMLDivElement).style.cursor;
        if (cursor && cursor.includes('resize')) {
          (handle as HTMLDivElement).style.background = accent;
        }
      });
      // Update border for selected
      if (el.dataset['skeletonId'] === this.selectedId) {
        el.style.border = `1.5px solid ${accent}`;
        const shadowColor = isWireframe()
          ? 'rgba(249,115,22,0.2)'
          : 'rgba(59,130,246,0.2)';
        el.style.boxShadow = `0 0 0 2px ${shadowColor}, 0 1px 4px rgba(0,0,0,0.08)`;
      } else {
        el.style.border = this.getBorderStyle();
      }
    }
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

  updateScroll(placements: Array<{ id: string; y: number; scrollY: number }>): void {
    const currentScroll = window.scrollY;
    for (const p of placements) {
      const el = this.skeletons.get(p.id);
      if (!el) continue;
      // Document-relative Y is (p.y + p.scrollY), viewport top is that minus currentScroll
      el.style.top = `${p.y + p.scrollY - currentScroll}px`;
    }
  }

  onResize(callback: ResizeCallback): void {
    this.resizeCallback = callback;
  }

  select(id: string): void {
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
