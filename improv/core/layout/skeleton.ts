import type { LayoutPlacementData } from '../types.js';
import { isWireframe } from './palette.js';

type ResizeCallback = (id: string, width: number, height: number) => void;

// --- Primitives ---

function bar(w: string, h: number, strong?: boolean): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    width: w,
    height: `${h}px`,
    borderRadius: '2px',
    background: strong ? 'var(--agd-bar-strong)' : 'var(--agd-bar)',
    flexShrink: '0',
  });
  return el;
}

function block(w: string, h: string, rx?: number): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    width: w,
    height: h,
    borderRadius: `${rx ?? 4}px`,
    border: '1px dashed var(--agd-stroke)',
    background: 'var(--agd-fill)',
    flexShrink: '0',
    boxSizing: 'border-box',
  });
  return el;
}

function circle(d: number, filled?: boolean): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    width: `${d}px`,
    height: `${d}px`,
    borderRadius: '50%',
    border: filled ? 'none' : '1px dashed var(--agd-stroke)',
    background: filled ? 'var(--agd-bar-strong)' : 'var(--agd-fill)',
    flexShrink: '0',
    boxSizing: 'border-box',
  });
  return el;
}

function row(...children: HTMLElement[]): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
  });
  for (const child of children) el.appendChild(child);
  return el;
}

function col(...children: HTMLElement[]): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    height: '100%',
  });
  for (const child of children) el.appendChild(child);
  return el;
}

function spacer(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.flex = '1 1 0%';
  return el;
}

// --- Wireframe Builders ---

type WireframeBuilder = (container: HTMLDivElement) => void;

const WIREFRAME_BUILDERS: Record<string, WireframeBuilder> = {
  // LAYOUT
  navigation(c) {
    const logo = bar('40px', 4, true);
    const s = spacer();
    const n1 = bar('30px', 2);
    const n2 = bar('30px', 2);
    const n3 = bar('30px', 2);
    c.appendChild(row(logo, s, n1, n2, n3));
  },
  header(c) {
    c.appendChild(col(bar('60%', 4, true), bar('40%', 2)));
  },
  hero(c) {
    const wrapper = col(bar('50%', 4, true), bar('70%', 2), block('80px', '28px', 6));
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  section(c) {
    c.appendChild(col(bar('40%', 4, true), bar('80%', 2), bar('60%', 2)));
  },
  sidebar(c) {
    c.appendChild(col(bar('70%', 2), bar('50%', 2), bar('60%', 2)));
  },
  footer(c) {
    const r = row(bar('30%', 2), bar('30%', 2), bar('30%', 2));
    c.appendChild(col(r));
  },
  modal(c) {
    const btnRow = row(spacer(), block('60px', '24px', 4));
    c.appendChild(col(bar('50%', 4, true), bar('80%', 2), btnRow));
  },
  banner(c) {
    const txt = bar('100%', 2);
    txt.style.flex = '1';
    c.appendChild(row(txt, block('80px', '24px', 4)));
  },
  drawer(c) {
    const left = document.createElement('div');
    Object.assign(left.style, { flex: '0.4', height: '100%', opacity: '0.3', background: 'var(--agd-fill)', borderRadius: '4px' });
    const right = document.createElement('div');
    Object.assign(right.style, { flex: '0.6', height: '100%', background: 'var(--agd-fill)', border: '1px dashed var(--agd-stroke)', borderRadius: '4px' });
    const r = row(left, right);
    r.style.height = '100%';
    r.style.alignItems = 'stretch';
    c.appendChild(r);
  },
  popover(c) {
    const tri = document.createElement('div');
    Object.assign(tri.style, { width: '0', height: '0', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--agd-bar)', alignSelf: 'center', flexShrink: '0' });
    c.appendChild(col(bar('70%', 2), bar('50%', 2), tri));
  },
  divider(c) {
    const line = document.createElement('div');
    Object.assign(line.style, { width: '100%', height: '1px', background: 'var(--agd-bar)', opacity: '0.3' });
    const wrapper = col(spacer(), line, spacer());
    c.appendChild(wrapper);
  },

  // CONTENT
  card(c) {
    const img = block('100%', '40%');
    img.style.flex = '0 0 40%';
    c.appendChild(col(img, bar('60%', 4, true), bar('80%', 2)));
  },
  text(c) {
    c.appendChild(col(bar('100%', 2), bar('85%', 2), bar('70%', 2), bar('50%', 2)));
  },
  image(c) {
    const b = block('100%', '100%');
    b.style.flex = '1 1 0%';
    b.style.position = 'relative';
    b.style.overflow = 'hidden';
    // X lines via two rotated bars
    const line1 = document.createElement('div');
    Object.assign(line1.style, { position: 'absolute', top: '0', left: '0', width: '141%', height: '1px', background: 'var(--agd-stroke)', transformOrigin: '0 0', transform: 'rotate(35deg)' });
    const line2 = document.createElement('div');
    Object.assign(line2.style, { position: 'absolute', bottom: '0', left: '0', width: '141%', height: '1px', background: 'var(--agd-stroke)', transformOrigin: '0 100%', transform: 'rotate(-35deg)' });
    b.appendChild(line1);
    b.appendChild(line2);
    c.appendChild(b);
  },
  video(c) {
    const b = block('100%', '100%');
    b.style.flex = '1 1 0%';
    b.style.position = 'relative';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    // play triangle
    const tri = document.createElement('div');
    Object.assign(tri.style, { width: '0', height: '0', borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '14px solid var(--agd-bar-strong)', flexShrink: '0' });
    b.appendChild(tri);
    c.appendChild(b);
  },
  table(c) {
    const b = block('100%', '100%');
    b.style.flex = '1 1 0%';
    b.style.position = 'relative';
    // horizontal lines
    const h1 = document.createElement('div');
    Object.assign(h1.style, { position: 'absolute', top: '33%', left: '8px', right: '8px', height: '1px', background: 'var(--agd-bar)' });
    const h2 = document.createElement('div');
    Object.assign(h2.style, { position: 'absolute', top: '66%', left: '8px', right: '8px', height: '1px', background: 'var(--agd-bar)' });
    // vertical lines
    const v1 = document.createElement('div');
    Object.assign(v1.style, { position: 'absolute', left: '33%', top: '8px', bottom: '8px', width: '1px', background: 'var(--agd-bar)' });
    const v2 = document.createElement('div');
    Object.assign(v2.style, { position: 'absolute', left: '66%', top: '8px', bottom: '8px', width: '1px', background: 'var(--agd-bar)' });
    b.appendChild(h1);
    b.appendChild(h2);
    b.appendChild(v1);
    b.appendChild(v2);
    c.appendChild(b);
  },
  grid(c) {
    const g = document.createElement('div');
    Object.assign(g.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '6px', width: '100%', height: '100%' });
    for (let i = 0; i < 4; i++) {
      const b = block('100%', '100%');
      b.style.flex = '1 1 0%';
      g.appendChild(b);
    }
    c.appendChild(g);
  },
  list(c) {
    const wrapper = col(
      row(circle(8), bar('70%', 2)),
      row(circle(8), bar('60%', 2)),
      row(circle(8), bar('75%', 2)),
    );
    c.appendChild(wrapper);
  },
  chart(c) {
    const r = document.createElement('div');
    Object.assign(r.style, { display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '8px', width: '100%', height: '100%' });
    const heights = ['40%', '60%', '80%', '50%'];
    for (const h of heights) {
      const b = document.createElement('div');
      Object.assign(b.style, { flex: '1', height: h, borderRadius: '2px', background: 'var(--agd-bar)' });
      r.appendChild(b);
    }
    c.appendChild(r);
  },
  codeBlock(c) {
    const dots = row(circle(6, true), circle(6, true), circle(6, true));
    dots.style.gap = '4px';
    const l1 = bar('80%', 2);
    l1.style.marginLeft = '12px';
    const l2 = bar('60%', 2);
    l2.style.marginLeft = '12px';
    const l3 = bar('70%', 2);
    l3.style.marginLeft = '24px';
    c.appendChild(col(dots, l1, l2, l3));
  },
  map(c) {
    const b = block('100%', '100%');
    b.style.flex = '1 1 0%';
    b.style.position = 'relative';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    const pin = circle(12);
    b.appendChild(pin);
    c.appendChild(b);
  },
  timeline(c) {
    const line = document.createElement('div');
    Object.assign(line.style, { width: '2px', height: '100%', background: 'var(--agd-bar)', flexShrink: '0' });
    const items = col(
      row(circle(8, true), bar('60%', 2)),
      row(circle(8, true), bar('50%', 2)),
      row(circle(8, true), bar('70%', 2)),
    );
    items.style.justifyContent = 'space-around';
    const r = row(line, items);
    r.style.height = '100%';
    r.style.alignItems = 'stretch';
    c.appendChild(r);
  },
  calendar(c) {
    const header = bar('60%', 3, true);
    const g = document.createElement('div');
    Object.assign(g.style, { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', width: '100%', flex: '1' });
    for (let i = 0; i < 6; i++) g.appendChild(circle(8));
    c.appendChild(col(header, g));
  },
  accordion(c) {
    const b1 = block('100%', '40%');
    b1.style.flex = '2';
    const b2 = block('100%', '30%');
    b2.style.flex = '1';
    const b3 = block('100%', '30%');
    b3.style.flex = '1';
    c.appendChild(col(b1, b2, b3));
  },
  carousel(c) {
    const chevL = bar('4px', 16, true);
    const center = block('100%', '100%');
    center.style.flex = '1 1 0%';
    const chevR = bar('4px', 16, true);
    const main = row(chevL, center, chevR);
    main.style.flex = '1';
    main.style.alignItems = 'center';
    const dots = row(circle(4, true), circle(4), circle(4));
    dots.style.justifyContent = 'center';
    dots.style.gap = '4px';
    c.appendChild(col(main, dots));
  },
  logo(c) {
    const sq = block('24px', '24px', 4);
    const texts = col(bar('50px', 3, true), bar('30px', 2));
    texts.style.height = 'auto';
    c.appendChild(row(sq, texts));
  },
  faq(c) {
    c.appendChild(col(
      bar('70%', 3, true), bar('90%', 2),
      spacer(),
      bar('60%', 3, true), bar('85%', 2),
    ));
  },
  gallery(c) {
    const g = document.createElement('div');
    Object.assign(g.style, { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px', width: '100%', height: '100%' });
    for (let i = 0; i < 6; i++) {
      const b = block('100%', '100%');
      g.appendChild(b);
    }
    c.appendChild(g);
  },

  // CONTROLS
  button(c) {
    const wrapper = col();
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.appendChild(block('60%', '28px', 6));
    c.appendChild(wrapper);
  },
  input(c) {
    c.appendChild(col(bar('30%', 2), block('100%', '28px', 4)));
  },
  search(c) {
    const mag = circle(14);
    const inp = block('100%', '28px', 14);
    inp.style.flex = '1';
    c.appendChild(row(mag, inp));
  },
  form(c) {
    c.appendChild(col(
      bar('25%', 2), block('100%', '28px', 4),
      bar('25%', 2), block('100%', '28px', 4),
      block('80px', '28px', 6),
    ));
  },
  tabs(c) {
    const tabRow = row(block('50%', '24px', 4), block('50%', '24px', 4));
    const content = block('100%', '100%', 4);
    content.style.flex = '1 1 0%';
    c.appendChild(col(tabRow, content));
  },
  dropdown(c) {
    const trigger = block('100%', '28px', 4);
    const options = block('100%', '48px', 4);
    options.style.flex = '1 1 0%';
    c.appendChild(col(trigger, options));
  },
  toggle(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' });
    const track = document.createElement('div');
    Object.assign(track.style, { width: '40px', height: '20px', borderRadius: '10px', border: '1px dashed var(--agd-stroke)', background: 'var(--agd-fill)', position: 'relative', flexShrink: '0' });
    const knob = circle(14, true);
    Object.assign(knob.style, { position: 'absolute', top: '2px', left: '2px' });
    track.appendChild(knob);
    wrapper.appendChild(track);
    c.appendChild(wrapper);
  },
  stepper(c) {
    const wrapper = row(circle(16), bar('100%', 2), circle(16), bar('100%', 2), circle(16));
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  rating(c) {
    const wrapper = row(block('16px', '16px', 2), block('16px', '16px', 2), block('16px', '16px', 2));
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  fileUpload(c) {
    const b = block('100%', '100%', 4);
    b.style.flex = '1 1 0%';
    b.style.display = 'flex';
    b.style.flexDirection = 'column';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    b.style.gap = '6px';
    const arrow = bar('2px', 16, true);
    const fname = bar('50%', 2);
    b.appendChild(arrow);
    b.appendChild(fname);
    c.appendChild(b);
  },
  checkbox(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' });
    wrapper.appendChild(block('20px', '20px', 3));
    c.appendChild(wrapper);
  },
  radio(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' });
    const outer = circle(20);
    outer.style.position = 'relative';
    outer.style.display = 'flex';
    outer.style.alignItems = 'center';
    outer.style.justifyContent = 'center';
    const inner = circle(10, true);
    outer.appendChild(inner);
    wrapper.appendChild(outer);
    c.appendChild(wrapper);
  },
  slider(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', width: '100%', height: '100%', position: 'relative' });
    const track = bar('100%', 2);
    track.style.position = 'absolute';
    const filled = document.createElement('div');
    Object.assign(filled.style, { position: 'absolute', left: '0', width: '60%', height: '2px', borderRadius: '2px', background: 'var(--agd-bar-strong)' });
    const handle = circle(12, true);
    Object.assign(handle.style, { position: 'absolute', left: 'calc(60% - 6px)' });
    wrapper.appendChild(track);
    wrapper.appendChild(filled);
    wrapper.appendChild(handle);
    c.appendChild(wrapper);
  },
  datePicker(c) {
    const inp = block('100%', '28px', 4);
    const grid = block('100%', '100%', 4);
    grid.style.flex = '1 1 0%';
    c.appendChild(col(inp, grid));
  },

  // ELEMENTS
  avatar(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' });
    wrapper.appendChild(circle(32));
    c.appendChild(wrapper);
  },
  badge(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' });
    wrapper.appendChild(block('48px', '20px', 10));
    c.appendChild(wrapper);
  },
  tag(c) {
    const pill = block('48px', '20px', 10);
    const x = bar('6px', 6, true);
    const wrapper = row(pill, x);
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  breadcrumb(c) {
    const chev = bar('4px', 8);
    const wrapper = row(bar('30px', 2), chev, bar('30px', 2), bar('4px', 8), bar('30px', 2));
    wrapper.style.justifyContent = 'flex-start';
    c.appendChild(wrapper);
  },
  pagination(c) {
    const b1 = block('20px', '20px', 3);
    const b2 = block('20px', '20px', 3);
    b2.style.background = 'var(--agd-bar-strong)';
    const b3 = block('20px', '20px', 3);
    const b4 = block('20px', '20px', 3);
    const wrapper = row(b1, b2, b3, b4);
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  progress(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', width: '100%', height: '100%', position: 'relative' });
    const track = bar('100%', 4);
    track.style.position = 'absolute';
    const fill = document.createElement('div');
    Object.assign(fill.style, { position: 'absolute', left: '0', width: '60%', height: '4px', borderRadius: '2px', background: 'var(--agd-bar-strong)' });
    wrapper.appendChild(track);
    wrapper.appendChild(fill);
    c.appendChild(wrapper);
  },
  alert(c) {
    const texts = col(bar('60%', 3, true), bar('80%', 2));
    texts.style.height = 'auto';
    c.appendChild(row(circle(14), texts));
  },
  toast(c) {
    const texts = col(bar('50%', 3, true), bar('70%', 2));
    texts.style.height = 'auto';
    c.appendChild(row(circle(14), texts));
  },
  notification(c) {
    const texts = col(bar('50%', 3, true), bar('70%', 2));
    texts.style.height = 'auto';
    const r = row(circle(14), texts);
    r.style.position = 'relative';
    const dot = circle(6, true);
    Object.assign(dot.style, { position: 'absolute', top: '-3px', right: '-3px' });
    r.appendChild(dot);
    c.appendChild(r);
  },
  tooltip(c) {
    const b = block('100%', '100%', 4);
    b.style.flex = '1 1 0%';
    b.style.display = 'flex';
    b.style.alignItems = 'center';
    b.style.justifyContent = 'center';
    b.appendChild(bar('60%', 2));
    const tri = document.createElement('div');
    Object.assign(tri.style, { width: '0', height: '0', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--agd-stroke)', alignSelf: 'center', flexShrink: '0' });
    c.appendChild(col(b, tri));
  },
  stat(c) {
    const wrapper = col(bar('30%', 2), bar('50%', 6, true), bar('40%', 2));
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  skeleton(c) {
    c.appendChild(col(bar('80%', 3), bar('60%', 3), bar('70%', 3)));
  },
  chip(c) {
    const p1 = block('48px', '20px', 10);
    const p2 = block('48px', '20px', 10);
    const x = bar('6px', 6, true);
    const wrapper = row(p1, p2, x);
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  icon(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' });
    wrapper.appendChild(block('20px', '20px', 4));
    c.appendChild(wrapper);
  },
  spinner(c) {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' });
    const ring = circle(24);
    ring.style.borderTop = '2px solid var(--agd-bar-strong)';
    wrapper.appendChild(ring);
    c.appendChild(wrapper);
  },

  // BLOCKS
  pricing(c) {
    const wrapper = col(bar('50%', 3, true), bar('30%', 5, true), bar('70%', 2), bar('70%', 2), block('60%', '28px', 6));
    wrapper.style.alignItems = 'center';
    c.appendChild(wrapper);
  },
  testimonial(c) {
    const quote = bar('20px', 4, true);
    const attribution = row(circle(12), bar('40%', 2));
    c.appendChild(col(quote, bar('80%', 2), bar('60%', 2), attribution));
  },
  cta(c) {
    const wrapper = col(bar('50%', 4, true), bar('70%', 2), block('80px', '28px', 6));
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  productCard(c) {
    const img = block('100%', '40%');
    img.style.flex = '0 0 40%';
    c.appendChild(col(img, bar('60%', 3, true), bar('30%', 3, true), block('60%', '28px', 6)));
  },
  profile(c) {
    const wrapper = col(circle(28), bar('40%', 3, true), bar('50%', 2));
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    c.appendChild(wrapper);
  },
  feature(c) {
    const row1 = row(block('24px', '24px', 4), col(bar('50%', 3, true), bar('70%', 2)));
    const row2 = row(block('24px', '24px', 4), col(bar('50%', 3, true), bar('70%', 2)));
    c.appendChild(col(row1, row2));
  },
  team(c) {
    const circles = row(circle(20), circle(20), circle(20));
    circles.style.justifyContent = 'center';
    const wrapper = col(circles, bar('40%', 3, true), bar('50%', 2));
    wrapper.style.alignItems = 'center';
    c.appendChild(wrapper);
  },
  login(c) {
    const submit = block('100%', '28px', 6);
    submit.style.background = 'var(--agd-bar-strong)';
    c.appendChild(col(bar('40%', 4, true), block('100%', '28px', 4), block('100%', '28px', 4), submit));
  },
  contact(c) {
    const textarea = block('100%', '100%', 4);
    textarea.style.flex = '1 1 0%';
    const submit = block('80px', '28px', 6);
    const submitRow = document.createElement('div');
    Object.assign(submitRow.style, { display: 'flex', justifyContent: 'flex-end', width: '100%' });
    submitRow.appendChild(submit);
    c.appendChild(col(bar('25%', 2), block('100%', '28px', 4), bar('25%', 2), textarea, submitRow));
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
      };
    }
    return {
      '--agd-stroke': 'rgba(59, 130, 246, 0.35)',
      '--agd-fill': 'rgba(59, 130, 246, 0.06)',
      '--agd-bar': 'rgba(59, 130, 246, 0.18)',
      '--agd-bar-strong': 'rgba(59, 130, 246, 0.28)',
    };
  }

  private getAccentColor(): string {
    return isWireframe() ? '#f97316' : '#3c82f7';
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
      top: `${placement.y - placement.scrollY}px`,
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
      fontFamily: 'system-ui, -apple-system, sans-serif',
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
      builder(inner);
    } else {
      // Fallback: generic block
      const fb = block('100%', '100%');
      fb.style.flex = '1 1 0%';
      inner.appendChild(fb);
    }

    content.appendChild(inner);
    el.appendChild(content);

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

    Object.assign(handle.style, {
      position: 'absolute',
      width: '8px',
      height: '8px',
      background: this.getAccentColor(),
      borderRadius: '2px',
      zIndex: '10',
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
