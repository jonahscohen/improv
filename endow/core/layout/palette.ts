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

// Wireframe mode state
let _wireframeMode = false;
let _wireframeListeners: Array<() => void> = [];
let _accentR = 59, _accentG = 130, _accentB = 246;
let _accentListeners: Array<() => void> = [];

// Wireframe theme state
type WireframeTheme = 'system' | 'dark' | 'light';
let _wireframeTheme: WireframeTheme = 'light';

export function getWireframeTheme(): WireframeTheme {
  return _wireframeTheme;
}

function resolveTheme(): 'light' | 'dark' {
  if (_wireframeTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return _wireframeTheme;
}

// Grid active state (darkens dots during drag)
let _gridDotGridEl: HTMLDivElement | null = null;

export function setGridActive(active: boolean): void {
  if (!_gridDotGridEl) return;
  const theme = resolveTheme();
  const dotAlpha = active ? 0.22 : 0.08;
  if (theme === 'dark') {
    const lightAlpha = active ? 0.14 : 0.06;
    _gridDotGridEl.style.backgroundImage = `radial-gradient(circle, rgba(255,255,255,${lightAlpha}) 1px, transparent 1px)`;
  } else {
    _gridDotGridEl.style.backgroundImage = `radial-gradient(circle, rgba(0,0,0,${dotAlpha}) 1px, transparent 1px)`;
  }
}

export function getAccentRGB(): [number, number, number] {
  return [_accentR, _accentG, _accentB];
}

export function setAccentColor(r: number, g: number, b: number): void {
  _accentR = r; _accentG = g; _accentB = b;
  for (const fn of _accentListeners) fn();
}

export function onAccentChange(fn: () => void): void {
  _accentListeners.push(fn);
}

export function offAccentChange(fn: () => void): void {
  _accentListeners = _accentListeners.filter((f) => f !== fn);
}

export function isWireframe(): boolean {
  return _wireframeMode;
}

export function toggleWireframe(): void {
  _wireframeMode = !_wireframeMode;
  for (const fn of _wireframeListeners) fn();
}

function onWireframeChange(fn: () => void): void {
  _wireframeListeners.push(fn);
}

function offWireframeChange(fn: () => void): void {
  _wireframeListeners = _wireframeListeners.filter((f) => f !== fn);
}

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

// Helper to create SVG elements
function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

function createBaseSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 20 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '0.5');
  return svg;
}

// ---- ICON BUILDERS ----
// Each returns an SVGSVGElement with a 20x16 wireframe icon

function iconNavigation(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '3', width: '18', height: '10', rx: '1' }));
  svg.appendChild(svgEl('rect', { x: '4', y: '6', width: '4', height: '2', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '9', y: '6', width: '3', height: '2', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '14', y: '6', width: '3', height: '2', rx: '0.5' }));
  return svg;
}

function iconHeader(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '2', width: '18', height: '12', rx: '1' }));
  const r = svgEl('rect', { x: '3', y: '5', width: '14', height: '2', rx: '0.5' });
  r.setAttribute('fill', 'currentColor');
  r.setAttribute('fill-opacity', '0.15');
  r.setAttribute('stroke', 'none');
  svg.appendChild(r);
  svg.appendChild(svgEl('line', { x1: '3', y1: '9', x2: '12', y2: '9' }));
  return svg;
}

function iconHero(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '14', rx: '1' }));
  const r = svgEl('rect', { x: '5', y: '4', width: '10', height: '2', rx: '0.5' });
  r.setAttribute('fill', 'currentColor');
  r.setAttribute('fill-opacity', '0.15');
  r.setAttribute('stroke', 'none');
  svg.appendChild(r);
  svg.appendChild(svgEl('line', { x1: '6', y1: '8', x2: '14', y2: '8' }));
  svg.appendChild(svgEl('rect', { x: '7', y: '10', width: '6', height: '2', rx: '1' }));
  return svg;
}

function iconSection(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '14', rx: '1' }));
  const r = svgEl('rect', { x: '3', y: '3', width: '8', height: '2', rx: '0.5' });
  r.setAttribute('fill', 'currentColor');
  r.setAttribute('fill-opacity', '0.15');
  r.setAttribute('stroke', 'none');
  svg.appendChild(r);
  svg.appendChild(svgEl('line', { x1: '3', y1: '7', x2: '15', y2: '7' }));
  svg.appendChild(svgEl('line', { x1: '3', y1: '10', x2: '13', y2: '10' }));
  return svg;
}

function iconSidebar(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '7', height: '14', rx: '1' }));
  svg.appendChild(svgEl('line', { x1: '3', y1: '4', x2: '6', y2: '4' }));
  svg.appendChild(svgEl('line', { x1: '3', y1: '7', x2: '6', y2: '7' }));
  svg.appendChild(svgEl('line', { x1: '3', y1: '10', x2: '6', y2: '10' }));
  return svg;
}

function iconFooter(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '10', width: '18', height: '5', rx: '1' }));
  svg.appendChild(svgEl('rect', { x: '3', y: '12', width: '4', height: '1.5', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '8', y: '12', width: '4', height: '1.5', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '13', y: '12', width: '4', height: '1.5', rx: '0.5' }));
  return svg;
}

function iconModal(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '3', y: '2', width: '14', height: '12', rx: '1.5' }));
  const r = svgEl('rect', { x: '5', y: '4', width: '10', height: '2', rx: '0.5' });
  r.setAttribute('fill', 'currentColor');
  r.setAttribute('fill-opacity', '0.15');
  r.setAttribute('stroke', 'none');
  svg.appendChild(r);
  svg.appendChild(svgEl('line', { x1: '5', y1: '8', x2: '13', y2: '8' }));
  svg.appendChild(svgEl('rect', { x: '11', y: '10', width: '4', height: '2', rx: '1' }));
  return svg;
}

function iconBanner(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '5', width: '18', height: '6', rx: '1' }));
  const r = svgEl('rect', { x: '3', y: '7', width: '8', height: '2', rx: '0.5' });
  r.setAttribute('fill', 'currentColor');
  r.setAttribute('fill-opacity', '0.15');
  r.setAttribute('stroke', 'none');
  svg.appendChild(r);
  svg.appendChild(svgEl('rect', { x: '13', y: '7', width: '4', height: '2', rx: '1' }));
  return svg;
}

function iconDrawer(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '10', y: '1', width: '9', height: '14', rx: '1' }));
  const r = svgEl('rect', { x: '1', y: '1', width: '7', height: '14', rx: '1' });
  r.setAttribute('opacity', '0.15');
  svg.appendChild(r);
  return svg;
}

function iconPopover(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '4', y: '1', width: '12', height: '10', rx: '1' }));
  svg.appendChild(svgEl('line', { x1: '6', y1: '4', x2: '14', y2: '4' }));
  svg.appendChild(svgEl('line', { x1: '6', y1: '7', x2: '12', y2: '7' }));
  svg.appendChild(svgEl('path', { d: 'M8,11 L10,13 L12,11' }));
  return svg;
}

function iconDivider(): SVGSVGElement {
  const svg = createBaseSvg();
  const l = svgEl('line', { x1: '2', y1: '8', x2: '18', y2: '8' });
  l.setAttribute('opacity', '0.3');
  svg.appendChild(l);
  return svg;
}

// CONTENT icons

function iconCard(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '1', width: '16', height: '14', rx: '1' }));
  const r = svgEl('rect', { x: '2', y: '1', width: '16', height: '6', rx: '0' });
  r.setAttribute('fill', 'currentColor');
  r.setAttribute('fill-opacity', '0.04');
  r.setAttribute('stroke', 'none');
  svg.appendChild(r);
  svg.appendChild(svgEl('line', { x1: '4', y1: '9', x2: '14', y2: '9' }));
  svg.appendChild(svgEl('line', { x1: '4', y1: '12', x2: '10', y2: '12' }));
  return svg;
}

function iconText(): SVGSVGElement {
  const svg = createBaseSvg();
  const l1 = svgEl('line', { x1: '2', y1: '3', x2: '16', y2: '3' });
  l1.setAttribute('opacity', '0.4');
  svg.appendChild(l1);
  const l2 = svgEl('line', { x1: '2', y1: '6', x2: '14', y2: '6' });
  l2.setAttribute('opacity', '0.3');
  svg.appendChild(l2);
  const l3 = svgEl('line', { x1: '2', y1: '9', x2: '12', y2: '9' });
  l3.setAttribute('opacity', '0.25');
  svg.appendChild(l3);
  const l4 = svgEl('line', { x1: '2', y1: '12', x2: '10', y2: '12' });
  l4.setAttribute('opacity', '0.2');
  svg.appendChild(l4);
  return svg;
}

function iconImage(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '1', width: '16', height: '14', rx: '1' }));
  const d1 = svgEl('line', { x1: '2', y1: '1', x2: '18', y2: '15' });
  d1.setAttribute('opacity', '0.2');
  svg.appendChild(d1);
  const d2 = svgEl('line', { x1: '18', y1: '1', x2: '2', y2: '15' });
  d2.setAttribute('opacity', '0.2');
  svg.appendChild(d2);
  return svg;
}

function iconVideo(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '2', width: '18', height: '12', rx: '1' }));
  const tri = svgEl('path', { d: 'M8,5 L8,11 L14,8 Z' });
  tri.setAttribute('fill', 'currentColor');
  tri.setAttribute('fill-opacity', '0.15');
  svg.appendChild(tri);
  return svg;
}

function iconTable(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '14', rx: '1' }));
  svg.appendChild(svgEl('line', { x1: '1', y1: '5', x2: '19', y2: '5' }));
  svg.appendChild(svgEl('line', { x1: '1', y1: '9', x2: '19', y2: '9' }));
  svg.appendChild(svgEl('line', { x1: '7', y1: '1', x2: '7', y2: '15' }));
  svg.appendChild(svgEl('line', { x1: '13', y1: '1', x2: '13', y2: '15' }));
  return svg;
}

function iconGrid(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '8', height: '6', rx: '1' }));
  svg.appendChild(svgEl('rect', { x: '11', y: '1', width: '8', height: '6', rx: '1' }));
  svg.appendChild(svgEl('rect', { x: '1', y: '9', width: '8', height: '6', rx: '1' }));
  svg.appendChild(svgEl('rect', { x: '11', y: '9', width: '8', height: '6', rx: '1' }));
  return svg;
}

function iconList(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('circle', { cx: '3', cy: '3', r: '1.5' }));
  svg.appendChild(svgEl('line', { x1: '6', y1: '3', x2: '16', y2: '3' }));
  svg.appendChild(svgEl('circle', { cx: '3', cy: '8', r: '1.5' }));
  svg.appendChild(svgEl('line', { x1: '6', y1: '8', x2: '16', y2: '8' }));
  svg.appendChild(svgEl('circle', { cx: '3', cy: '13', r: '1.5' }));
  svg.appendChild(svgEl('line', { x1: '6', y1: '13', x2: '16', y2: '13' }));
  return svg;
}

function iconChart(): SVGSVGElement {
  const svg = createBaseSvg();
  const bars = [
    { x: '3', y: '10', width: '3', height: '5' },
    { x: '7', y: '7', width: '3', height: '8' },
    { x: '11', y: '4', width: '3', height: '11' },
    { x: '15', y: '6', width: '3', height: '9' },
  ];
  for (const b of bars) {
    const r = svgEl('rect', { x: b.x, y: b.y, width: b.width, height: b.height, rx: '0.5' });
    r.setAttribute('fill', 'currentColor');
    r.setAttribute('fill-opacity', '0.15');
    svg.appendChild(r);
  }
  return svg;
}

function iconCodeBlock(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '14', rx: '1' }));
  // 3 dots
  const dots = [
    { cx: '4', cy: '3.5', r: '0.8' },
    { cx: '6.5', cy: '3.5', r: '0.8' },
    { cx: '9', cy: '3.5', r: '0.8' },
  ];
  for (const d of dots) {
    const c = svgEl('circle', d);
    c.setAttribute('fill', 'currentColor');
    c.setAttribute('fill-opacity', '0.25');
    c.setAttribute('stroke', 'none');
    svg.appendChild(c);
  }
  // lines
  const lines = [
    { x1: '4', y1: '7', x2: '14', y2: '7' },
    { x1: '6', y1: '9.5', x2: '12', y2: '9.5' },
    { x1: '4', y1: '12', x2: '10', y2: '12' },
  ];
  for (const l of lines) {
    const ln = svgEl('line', l);
    ln.setAttribute('opacity', '0.3');
    svg.appendChild(ln);
  }
  return svg;
}

function iconMap(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '14', rx: '1' }));
  const d1 = svgEl('line', { x1: '1', y1: '14', x2: '10', y2: '1' });
  d1.setAttribute('opacity', '0.15');
  svg.appendChild(d1);
  const d2 = svgEl('line', { x1: '10', y1: '1', x2: '18', y2: '14' });
  d2.setAttribute('opacity', '0.15');
  svg.appendChild(d2);
  const pin = svgEl('circle', { cx: '10', cy: '7', r: '1.5' });
  pin.setAttribute('fill', 'currentColor');
  pin.setAttribute('fill-opacity', '0.2');
  svg.appendChild(pin);
  return svg;
}

function iconTimeline(): SVGSVGElement {
  const svg = createBaseSvg();
  const vline = svgEl('line', { x1: '5', y1: '2', x2: '5', y2: '14' });
  vline.setAttribute('opacity', '0.25');
  svg.appendChild(vline);
  // circles
  svg.appendChild(svgEl('circle', { cx: '5', cy: '3', r: '1.5' }));
  const c2 = svgEl('circle', { cx: '5', cy: '8', r: '1.5' });
  c2.setAttribute('fill', 'currentColor');
  c2.setAttribute('fill-opacity', '0.2');
  svg.appendChild(c2);
  svg.appendChild(svgEl('circle', { cx: '5', cy: '13', r: '1.5' }));
  // lines
  svg.appendChild(svgEl('line', { x1: '8', y1: '3', x2: '16', y2: '3' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '8', x2: '14', y2: '8' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '13', x2: '16', y2: '13' }));
  return svg;
}

function iconCalendar(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '14', rx: '1' }));
  svg.appendChild(svgEl('line', { x1: '1', y1: '5', x2: '19', y2: '5' }));
  svg.appendChild(svgEl('line', { x1: '6', y1: '0', x2: '6', y2: '3' }));
  svg.appendChild(svgEl('line', { x1: '14', y1: '0', x2: '14', y2: '3' }));
  const dotPositions = [
    { cx: '5', cy: '8' }, { cx: '10', cy: '8' }, { cx: '15', cy: '8' },
    { cx: '5', cy: '12' }, { cx: '10', cy: '12' },
  ];
  for (const pos of dotPositions) {
    const d = svgEl('circle', { ...pos, r: '0.8' });
    d.setAttribute('fill', 'currentColor');
    d.setAttribute('fill-opacity', '0.2');
    d.setAttribute('stroke', 'none');
    svg.appendChild(d);
  }
  return svg;
}

function iconAccordion(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '4', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '1', y: '6.5', width: '18', height: '4', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '1', y: '12', width: '18', height: '3', rx: '0.5' }));
  svg.appendChild(svgEl('line', { x1: '3', y1: '3', x2: '12', y2: '3' }));
  return svg;
}

function iconCarousel(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '4', y: '2', width: '12', height: '10', rx: '1' }));
  svg.appendChild(svgEl('path', { d: 'M3,7 L1,8 L3,9' }));
  svg.appendChild(svgEl('path', { d: 'M17,7 L19,8 L17,9' }));
  svg.appendChild(svgEl('circle', { cx: '8', cy: '14', r: '0.8' }));
  const c2 = svgEl('circle', { cx: '10', cy: '14', r: '0.8' });
  c2.setAttribute('fill', 'currentColor');
  c2.setAttribute('fill-opacity', '0.2');
  c2.setAttribute('stroke', 'none');
  svg.appendChild(c2);
  svg.appendChild(svgEl('circle', { cx: '12', cy: '14', r: '0.8' }));
  return svg;
}

function iconLogo(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '3', width: '6', height: '10', rx: '1' }));
  svg.appendChild(svgEl('path', { d: 'M4,6 L2.5,10 L5.5,10 Z' }));
  svg.appendChild(svgEl('line', { x1: '9', y1: '5', x2: '18', y2: '5' }));
  svg.appendChild(svgEl('line', { x1: '9', y1: '8', x2: '16', y2: '8' }));
  return svg;
}

function iconFaq(): SVGSVGElement {
  const svg = createBaseSvg();
  // Question marks as circles + dots
  const q1 = svgEl('circle', { cx: '4', cy: '4', r: '2.5' });
  q1.setAttribute('opacity', '0.3');
  svg.appendChild(q1);
  svg.appendChild(svgEl('line', { x1: '4', y1: '8', x2: '4', y2: '8.5' }));
  const q2 = svgEl('circle', { cx: '4', cy: '11', r: '2.5' });
  q2.setAttribute('opacity', '0.3');
  svg.appendChild(q2);
  svg.appendChild(svgEl('line', { x1: '4', y1: '14.5', x2: '4', y2: '15' }));
  // answer lines
  svg.appendChild(svgEl('line', { x1: '8', y1: '4', x2: '17', y2: '4' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '7', x2: '15', y2: '7' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '11', x2: '17', y2: '11' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '14', x2: '15', y2: '14' }));
  return svg;
}

function iconGallery(): SVGSVGElement {
  const svg = createBaseSvg();
  const rects = [
    { x: '1', y: '1', width: '5', height: '6' },
    { x: '8', y: '1', width: '5', height: '6' },
    { x: '15', y: '1', width: '4', height: '6' },
    { x: '1', y: '9', width: '5', height: '6' },
    { x: '8', y: '9', width: '5', height: '6' },
    { x: '15', y: '9', width: '4', height: '6' },
  ];
  for (const r of rects) {
    svg.appendChild(svgEl('rect', { ...r, rx: '0.5' }));
  }
  return svg;
}

// CONTROLS icons

function iconButton(): SVGSVGElement {
  const svg = createBaseSvg();
  const r = svgEl('rect', { x: '3', y: '5', width: '14', height: '6', rx: '3' });
  r.setAttribute('fill', 'currentColor');
  r.setAttribute('fill-opacity', '0.15');
  svg.appendChild(r);
  svg.appendChild(svgEl('line', { x1: '7', y1: '8', x2: '13', y2: '8' }));
  return svg;
}

function iconInput(): SVGSVGElement {
  const svg = createBaseSvg();
  const label = svgEl('rect', { x: '2', y: '2', width: '6', height: '2', rx: '0.5' });
  label.setAttribute('fill', 'currentColor');
  label.setAttribute('fill-opacity', '0.15');
  label.setAttribute('stroke', 'none');
  svg.appendChild(label);
  svg.appendChild(svgEl('rect', { x: '2', y: '6', width: '16', height: '8', rx: '1' }));
  const cursor = svgEl('line', { x1: '4', y1: '10', x2: '10', y2: '10' });
  cursor.setAttribute('opacity', '0.2');
  svg.appendChild(cursor);
  return svg;
}

function iconSearch(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '4', width: '16', height: '8', rx: '4' }));
  svg.appendChild(svgEl('circle', { cx: '5', cy: '8', r: '2' }));
  svg.appendChild(svgEl('line', { x1: '6.5', y1: '9.5', x2: '8', y2: '11' }));
  const txt = svgEl('line', { x1: '10', y1: '8', x2: '15', y2: '8' });
  txt.setAttribute('opacity', '0.2');
  svg.appendChild(txt);
  return svg;
}

function iconForm(): SVGSVGElement {
  const svg = createBaseSvg();
  // First field
  const l1 = svgEl('rect', { x: '2', y: '1', width: '7', height: '2', rx: '0.5' });
  l1.setAttribute('fill', 'currentColor');
  l1.setAttribute('fill-opacity', '0.15');
  l1.setAttribute('stroke', 'none');
  svg.appendChild(l1);
  svg.appendChild(svgEl('rect', { x: '2', y: '3.5', width: '16', height: '3', rx: '0.5' }));
  // Second field
  const l2 = svgEl('rect', { x: '2', y: '8', width: '7', height: '2', rx: '0.5' });
  l2.setAttribute('fill', 'currentColor');
  l2.setAttribute('fill-opacity', '0.15');
  l2.setAttribute('stroke', 'none');
  svg.appendChild(l2);
  svg.appendChild(svgEl('rect', { x: '2', y: '10.5', width: '16', height: '3', rx: '0.5' }));
  // Submit button
  const btn = svgEl('rect', { x: '5', y: '14', width: '10', height: '2', rx: '1' });
  btn.setAttribute('fill', 'currentColor');
  btn.setAttribute('fill-opacity', '0.15');
  svg.appendChild(btn);
  return svg;
}

function iconTabs(): SVGSVGElement {
  const svg = createBaseSvg();
  const t1 = svgEl('rect', { x: '2', y: '3', width: '8', height: '4', rx: '1' });
  t1.setAttribute('fill', 'currentColor');
  t1.setAttribute('fill-opacity', '0.08');
  svg.appendChild(t1);
  svg.appendChild(svgEl('rect', { x: '10', y: '3', width: '8', height: '4', rx: '1' }));
  svg.appendChild(svgEl('rect', { x: '2', y: '7', width: '16', height: '8', rx: '1' }));
  return svg;
}

function iconDropdown(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '2', width: '16', height: '5', rx: '1' }));
  svg.appendChild(svgEl('path', { d: 'M14,4 L16,6 L18,4' }));
  const dashed = svgEl('rect', { x: '2', y: '9', width: '16', height: '6', rx: '1' });
  dashed.setAttribute('stroke-dasharray', '2,1.5');
  svg.appendChild(dashed);
  return svg;
}

function iconToggle(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '4', y: '5', width: '12', height: '6', rx: '3' }));
  const c = svgEl('circle', { cx: '12', cy: '8', r: '2.5' });
  c.setAttribute('fill', 'currentColor');
  c.setAttribute('fill-opacity', '0.15');
  svg.appendChild(c);
  return svg;
}

function iconStepper(): SVGSVGElement {
  const svg = createBaseSvg();
  const c1 = svgEl('circle', { cx: '4', cy: '8', r: '2' });
  c1.setAttribute('fill', 'currentColor');
  c1.setAttribute('fill-opacity', '0.15');
  svg.appendChild(c1);
  svg.appendChild(svgEl('circle', { cx: '10', cy: '8', r: '2' }));
  svg.appendChild(svgEl('circle', { cx: '16', cy: '8', r: '2' }));
  svg.appendChild(svgEl('line', { x1: '6', y1: '8', x2: '8', y2: '8' }));
  svg.appendChild(svgEl('line', { x1: '12', y1: '8', x2: '14', y2: '8' }));
  return svg;
}

function iconRating(): SVGSVGElement {
  const svg = createBaseSvg();
  const starPath = (cx: number, cy: number): string => {
    return `M${cx},${cy - 2} L${cx + 0.6},${cy - 0.7} L${cx + 2},${cy - 0.5} L${cx + 1},${cy + 0.5} L${cx + 1.3},${cy + 2} L${cx},${cy + 1} L${cx - 1.3},${cy + 2} L${cx - 1},${cy + 0.5} L${cx - 2},${cy - 0.5} L${cx - 0.6},${cy - 0.7} Z`;
  };
  const s1 = svgEl('path', { d: starPath(5, 8) });
  s1.setAttribute('fill', 'currentColor');
  s1.setAttribute('fill-opacity', '0.15');
  svg.appendChild(s1);
  const s2 = svgEl('path', { d: starPath(10, 8) });
  s2.setAttribute('fill', 'currentColor');
  s2.setAttribute('fill-opacity', '0.15');
  svg.appendChild(s2);
  svg.appendChild(svgEl('path', { d: starPath(15, 8) }));
  return svg;
}

function iconFileUpload(): SVGSVGElement {
  const svg = createBaseSvg();
  const r = svgEl('rect', { x: '2', y: '2', width: '16', height: '12', rx: '1' });
  r.setAttribute('stroke-dasharray', '2,1.5');
  svg.appendChild(r);
  svg.appendChild(svgEl('path', { d: 'M10,5 L10,9 M8,6 L10,4 L12,6' }));
  const ln = svgEl('line', { x1: '5', y1: '11', x2: '15', y2: '11' });
  ln.setAttribute('opacity', '0.2');
  svg.appendChild(ln);
  return svg;
}

function iconCheckbox(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '5', y: '4', width: '10', height: '8', rx: '1.5' }));
  svg.appendChild(svgEl('path', { d: 'M7,8 L9,10 L13,6' }));
  return svg;
}

function iconRadio(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('circle', { cx: '10', cy: '8', r: '4' }));
  const inner = svgEl('circle', { cx: '10', cy: '8', r: '2' });
  inner.setAttribute('fill', 'currentColor');
  inner.setAttribute('fill-opacity', '0.15');
  svg.appendChild(inner);
  return svg;
}

function iconSlider(): SVGSVGElement {
  const svg = createBaseSvg();
  const track = svgEl('line', { x1: '2', y1: '8', x2: '18', y2: '8' });
  track.setAttribute('opacity', '0.2');
  svg.appendChild(track);
  const filled = svgEl('line', { x1: '2', y1: '8', x2: '11', y2: '8' });
  filled.setAttribute('opacity', '0.25');
  svg.appendChild(filled);
  svg.appendChild(svgEl('circle', { cx: '11', cy: '8', r: '2.5' }));
  return svg;
}

function iconDatePicker(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '1', width: '16', height: '5', rx: '1' }));
  const cal = svgEl('rect', { x: '14', y: '2.5', width: '3', height: '2', rx: '0.5' });
  cal.setAttribute('fill', 'currentColor');
  cal.setAttribute('fill-opacity', '0.15');
  cal.setAttribute('stroke', 'none');
  svg.appendChild(cal);
  const dashed = svgEl('rect', { x: '2', y: '7', width: '16', height: '8', rx: '1' });
  dashed.setAttribute('stroke-dasharray', '2,1');
  svg.appendChild(dashed);
  const dots = [
    { cx: '5', cy: '10' }, { cx: '9', cy: '10' }, { cx: '13', cy: '10' }, { cx: '5', cy: '13' },
  ];
  for (const pos of dots) {
    const d = svgEl('circle', { ...pos, r: '0.7' });
    d.setAttribute('fill', 'currentColor');
    d.setAttribute('fill-opacity', '0.15');
    d.setAttribute('stroke', 'none');
    svg.appendChild(d);
  }
  return svg;
}

// ELEMENTS icons

function iconAvatar(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('circle', { cx: '10', cy: '6', r: '3.5' }));
  const arc = svgEl('path', { d: 'M5,14 Q5,10 10,9.5 Q15,10 15,14' });
  arc.setAttribute('opacity', '0.25');
  svg.appendChild(arc);
  return svg;
}

function iconBadge(): SVGSVGElement {
  const svg = createBaseSvg();
  const r = svgEl('rect', { x: '4', y: '5', width: '12', height: '6', rx: '3' });
  r.setAttribute('fill', 'currentColor');
  r.setAttribute('fill-opacity', '0.08');
  svg.appendChild(r);
  const ln = svgEl('line', { x1: '7', y1: '8', x2: '13', y2: '8' });
  ln.setAttribute('opacity', '0.3');
  svg.appendChild(ln);
  return svg;
}

function iconTag(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '3', y: '5', width: '12', height: '6', rx: '2' }));
  svg.appendChild(svgEl('line', { x1: '5', y1: '8', x2: '10', y2: '8' }));
  // X
  const x1 = svgEl('line', { x1: '14', y1: '6', x2: '16', y2: '10' });
  x1.setAttribute('opacity', '0.3');
  svg.appendChild(x1);
  const x2 = svgEl('line', { x1: '16', y1: '6', x2: '14', y2: '10' });
  x2.setAttribute('opacity', '0.3');
  svg.appendChild(x2);
  return svg;
}

function iconBreadcrumb(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('line', { x1: '1', y1: '8', x2: '4', y2: '8' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '8', x2: '11', y2: '8' }));
  svg.appendChild(svgEl('line', { x1: '15', y1: '8', x2: '18', y2: '8' }));
  const ch1 = svgEl('path', { d: 'M6,6 L7,8 L6,10' });
  ch1.setAttribute('opacity', '0.25');
  svg.appendChild(ch1);
  const ch2 = svgEl('path', { d: 'M13,6 L14,8 L13,10' });
  ch2.setAttribute('opacity', '0.25');
  svg.appendChild(ch2);
  return svg;
}

function iconPagination(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '5', width: '3', height: '6', rx: '0.5' }));
  const r2 = svgEl('rect', { x: '6', y: '5', width: '3', height: '6', rx: '0.5' });
  r2.setAttribute('fill', 'currentColor');
  r2.setAttribute('fill-opacity', '0.08');
  svg.appendChild(r2);
  svg.appendChild(svgEl('rect', { x: '10', y: '5', width: '3', height: '6', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '14', y: '5', width: '3', height: '6', rx: '0.5' }));
  return svg;
}

function iconProgress(): SVGSVGElement {
  const svg = createBaseSvg();
  const bg = svgEl('rect', { x: '2', y: '7', width: '16', height: '2', rx: '1' });
  bg.setAttribute('opacity', '0.2');
  svg.appendChild(bg);
  const fill = svgEl('rect', { x: '2', y: '7', width: '10', height: '2', rx: '1' });
  fill.setAttribute('fill', 'currentColor');
  fill.setAttribute('fill-opacity', '0.2');
  svg.appendChild(fill);
  return svg;
}

function iconAlert(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '3', width: '18', height: '10', rx: '1' }));
  svg.appendChild(svgEl('circle', { cx: '5', cy: '8', r: '2' }));
  svg.appendChild(svgEl('line', { x1: '5', y1: '6.5', x2: '5', y2: '8' }));
  const dot = svgEl('circle', { cx: '5', cy: '9', r: '0.3' });
  dot.setAttribute('fill', 'currentColor');
  dot.setAttribute('stroke', 'none');
  svg.appendChild(dot);
  svg.appendChild(svgEl('line', { x1: '9', y1: '8', x2: '17', y2: '8' }));
  return svg;
}

function iconToast(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '4', width: '18', height: '8', rx: '1.5' }));
  const c = svgEl('circle', { cx: '4', cy: '8', r: '1.5' });
  c.setAttribute('fill', 'currentColor');
  c.setAttribute('fill-opacity', '0.15');
  c.setAttribute('stroke', 'none');
  svg.appendChild(c);
  svg.appendChild(svgEl('line', { x1: '8', y1: '7', x2: '16', y2: '7' }));
  const l2 = svgEl('line', { x1: '8', y1: '9.5', x2: '13', y2: '9.5' });
  l2.setAttribute('opacity', '0.2');
  svg.appendChild(l2);
  return svg;
}

function iconNotification(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '2', width: '18', height: '12', rx: '1' }));
  const c = svgEl('circle', { cx: '4', cy: '5', r: '1.5' });
  c.setAttribute('fill', 'currentColor');
  c.setAttribute('fill-opacity', '0.15');
  c.setAttribute('stroke', 'none');
  svg.appendChild(c);
  svg.appendChild(svgEl('line', { x1: '8', y1: '4', x2: '16', y2: '4' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '7', x2: '14', y2: '7' }));
  // badge dot
  const badge = svgEl('circle', { cx: '16', cy: '3', r: '1.5' });
  badge.setAttribute('fill', 'currentColor');
  badge.setAttribute('fill-opacity', '0.3');
  badge.setAttribute('stroke', 'none');
  svg.appendChild(badge);
  return svg;
}

function iconTooltip(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '3', y: '1', width: '14', height: '10', rx: '1' }));
  svg.appendChild(svgEl('line', { x1: '6', y1: '5', x2: '14', y2: '5' }));
  svg.appendChild(svgEl('path', { d: 'M8,11 L10,13 L12,11' }));
  return svg;
}

function iconStat(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '14', rx: '1' }));
  const label = svgEl('rect', { x: '3', y: '3', width: '6', height: '1.5', rx: '0.5' });
  label.setAttribute('fill', 'currentColor');
  label.setAttribute('fill-opacity', '0.15');
  label.setAttribute('stroke', 'none');
  svg.appendChild(label);
  const val = svgEl('rect', { x: '3', y: '6', width: '12', height: '3', rx: '0.5' });
  val.setAttribute('fill', 'currentColor');
  val.setAttribute('fill-opacity', '0.2');
  val.setAttribute('stroke', 'none');
  svg.appendChild(val);
  const sub = svgEl('line', { x1: '3', y1: '11', x2: '10', y2: '11' });
  sub.setAttribute('opacity', '0.15');
  svg.appendChild(sub);
  return svg;
}

function iconSkeleton(): SVGSVGElement {
  const svg = createBaseSvg();
  const rects = [
    { x: '2', y: '2', width: '16', height: '3', rx: '1' },
    { x: '2', y: '7', width: '12', height: '3', rx: '1' },
    { x: '2', y: '12', width: '8', height: '2', rx: '1' },
  ];
  for (const r of rects) {
    const el = svgEl('rect', r);
    el.setAttribute('fill', 'currentColor');
    el.setAttribute('fill-opacity', '0.08');
    el.setAttribute('stroke', 'none');
    svg.appendChild(el);
  }
  return svg;
}

function iconChip(): SVGSVGElement {
  const svg = createBaseSvg();
  const r1 = svgEl('rect', { x: '1', y: '5', width: '8', height: '6', rx: '3' });
  r1.setAttribute('fill', 'currentColor');
  r1.setAttribute('fill-opacity', '0.08');
  svg.appendChild(r1);
  svg.appendChild(svgEl('rect', { x: '11', y: '5', width: '8', height: '6', rx: '3' }));
  // X on second chip
  const x1 = svgEl('line', { x1: '16', y1: '7', x2: '18', y2: '9' });
  x1.setAttribute('opacity', '0.25');
  svg.appendChild(x1);
  const x2 = svgEl('line', { x1: '18', y1: '7', x2: '16', y2: '9' });
  x2.setAttribute('opacity', '0.25');
  svg.appendChild(x2);
  return svg;
}

function iconIcon(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('path', { d: 'M10,2 L11.5,6 L16,6.5 L12.5,9.5 L13.5,14 L10,11.5 L6.5,14 L7.5,9.5 L4,6.5 L8.5,6 Z' }));
  return svg;
}

function iconSpinner(): SVGSVGElement {
  const svg = createBaseSvg();
  const bg = svgEl('circle', { cx: '10', cy: '8', r: '5' });
  bg.setAttribute('opacity', '0.12');
  svg.appendChild(bg);
  const arc = svgEl('path', { d: 'M10,3 A5,5 0 0,1 15,8' });
  arc.setAttribute('opacity', '0.35');
  svg.appendChild(arc);
  return svg;
}

// BLOCKS icons

function iconPricing(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '0.5', width: '16', height: '15', rx: '1' }));
  const title = svgEl('rect', { x: '5', y: '2', width: '10', height: '2', rx: '0.5' });
  title.setAttribute('fill', 'currentColor');
  title.setAttribute('fill-opacity', '0.15');
  title.setAttribute('stroke', 'none');
  svg.appendChild(title);
  const price = svgEl('rect', { x: '6', y: '5', width: '8', height: '2', rx: '0.5' });
  price.setAttribute('fill', 'currentColor');
  price.setAttribute('fill-opacity', '0.2');
  price.setAttribute('stroke', 'none');
  svg.appendChild(price);
  svg.appendChild(svgEl('line', { x1: '5', y1: '9', x2: '15', y2: '9' }));
  svg.appendChild(svgEl('line', { x1: '5', y1: '11', x2: '15', y2: '11' }));
  const btn = svgEl('rect', { x: '5', y: '13', width: '10', height: '2', rx: '1' });
  btn.setAttribute('fill', 'currentColor');
  btn.setAttribute('fill-opacity', '0.15');
  svg.appendChild(btn);
  return svg;
}

function iconTestimonial(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '1', width: '18', height: '14', rx: '1' }));
  const quote = svgEl('path', { d: 'M3,3 L4,5' });
  quote.setAttribute('opacity', '0.3');
  svg.appendChild(quote);
  svg.appendChild(svgEl('line', { x1: '5', y1: '6', x2: '16', y2: '6' }));
  svg.appendChild(svgEl('line', { x1: '5', y1: '8', x2: '14', y2: '8' }));
  svg.appendChild(svgEl('circle', { cx: '4', cy: '12', r: '1.5' }));
  svg.appendChild(svgEl('line', { x1: '7', y1: '12', x2: '14', y2: '12' }));
  return svg;
}

function iconCta(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '1', y: '2', width: '18', height: '12', rx: '1' }));
  const title = svgEl('rect', { x: '5', y: '4', width: '10', height: '2', rx: '0.5' });
  title.setAttribute('fill', 'currentColor');
  title.setAttribute('fill-opacity', '0.15');
  title.setAttribute('stroke', 'none');
  svg.appendChild(title);
  svg.appendChild(svgEl('line', { x1: '6', y1: '8', x2: '14', y2: '8' }));
  svg.appendChild(svgEl('rect', { x: '6', y: '10', width: '8', height: '2.5', rx: '1' }));
  return svg;
}

function iconProductCard(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '0.5', width: '16', height: '15', rx: '1' }));
  const img = svgEl('rect', { x: '2', y: '0.5', width: '16', height: '6', rx: '0' });
  img.setAttribute('fill', 'currentColor');
  img.setAttribute('fill-opacity', '0.04');
  img.setAttribute('stroke', 'none');
  svg.appendChild(img);
  const title = svgEl('rect', { x: '4', y: '8', width: '10', height: '2', rx: '0.5' });
  title.setAttribute('fill', 'currentColor');
  title.setAttribute('fill-opacity', '0.15');
  title.setAttribute('stroke', 'none');
  svg.appendChild(title);
  svg.appendChild(svgEl('line', { x1: '4', y1: '11.5', x2: '8', y2: '11.5' }));
  svg.appendChild(svgEl('rect', { x: '4', y: '13', width: '12', height: '2', rx: '1' }));
  return svg;
}

function iconProfile(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('circle', { cx: '10', cy: '4', r: '2.5' }));
  const name = svgEl('rect', { x: '5', y: '8', width: '10', height: '2', rx: '0.5' });
  name.setAttribute('fill', 'currentColor');
  name.setAttribute('fill-opacity', '0.15');
  name.setAttribute('stroke', 'none');
  svg.appendChild(name);
  const bio = svgEl('line', { x1: '6', y1: '12', x2: '14', y2: '12' });
  bio.setAttribute('opacity', '0.2');
  svg.appendChild(bio);
  return svg;
}

function iconFeature(): SVGSVGElement {
  const svg = createBaseSvg();
  // Two rows
  svg.appendChild(svgEl('rect', { x: '2', y: '2', width: '4', height: '4', rx: '0.5' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '3', x2: '17', y2: '3' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '5', x2: '15', y2: '5' }));
  svg.appendChild(svgEl('rect', { x: '2', y: '10', width: '4', height: '4', rx: '0.5' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '11', x2: '17', y2: '11' }));
  svg.appendChild(svgEl('line', { x1: '8', y1: '13', x2: '15', y2: '13' }));
  return svg;
}

function iconTeam(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('circle', { cx: '6', cy: '4', r: '2' }));
  const c2 = svgEl('circle', { cx: '10', cy: '4', r: '2' });
  c2.setAttribute('fill', 'currentColor');
  c2.setAttribute('fill-opacity', '0.08');
  svg.appendChild(c2);
  svg.appendChild(svgEl('circle', { cx: '14', cy: '4', r: '2' }));
  const ln1 = svgEl('line', { x1: '3', y1: '9', x2: '17', y2: '9' });
  ln1.setAttribute('fill', 'currentColor');
  ln1.setAttribute('fill-opacity', '0.15');
  svg.appendChild(ln1);
  const ln2 = svgEl('line', { x1: '5', y1: '12', x2: '15', y2: '12' });
  ln2.setAttribute('opacity', '0.2');
  svg.appendChild(ln2);
  return svg;
}

function iconLogin(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '0.5', width: '16', height: '15', rx: '1.5' }));
  const title = svgEl('rect', { x: '5', y: '2', width: '10', height: '2', rx: '0.5' });
  title.setAttribute('fill', 'currentColor');
  title.setAttribute('fill-opacity', '0.15');
  title.setAttribute('stroke', 'none');
  svg.appendChild(title);
  svg.appendChild(svgEl('rect', { x: '4', y: '5.5', width: '12', height: '3', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '4', y: '9.5', width: '12', height: '3', rx: '0.5' }));
  const btn = svgEl('rect', { x: '5', y: '13', width: '10', height: '2', rx: '1' });
  btn.setAttribute('fill', 'currentColor');
  btn.setAttribute('fill-opacity', '0.15');
  svg.appendChild(btn);
  return svg;
}

function iconContact(): SVGSVGElement {
  const svg = createBaseSvg();
  svg.appendChild(svgEl('rect', { x: '2', y: '0.5', width: '16', height: '15', rx: '1' }));
  const label = svgEl('rect', { x: '3', y: '2', width: '5', height: '1.5', rx: '0.5' });
  label.setAttribute('fill', 'currentColor');
  label.setAttribute('fill-opacity', '0.15');
  label.setAttribute('stroke', 'none');
  svg.appendChild(label);
  svg.appendChild(svgEl('rect', { x: '3', y: '4', width: '14', height: '2.5', rx: '0.5' }));
  svg.appendChild(svgEl('rect', { x: '3', y: '7.5', width: '14', height: '4', rx: '0.5' }));
  const btn = svgEl('rect', { x: '5', y: '13', width: '10', height: '2', rx: '1' });
  btn.setAttribute('fill', 'currentColor');
  btn.setAttribute('fill-opacity', '0.15');
  svg.appendChild(btn);
  return svg;
}

// Icon registry
const ICON_BUILDERS: Record<string, () => SVGSVGElement> = {
  // Layout
  navigation: iconNavigation,
  header: iconHeader,
  hero: iconHero,
  section: iconSection,
  sidebar: iconSidebar,
  footer: iconFooter,
  modal: iconModal,
  banner: iconBanner,
  drawer: iconDrawer,
  popover: iconPopover,
  divider: iconDivider,
  // Content
  card: iconCard,
  text: iconText,
  image: iconImage,
  video: iconVideo,
  table: iconTable,
  grid: iconGrid,
  list: iconList,
  chart: iconChart,
  codeBlock: iconCodeBlock,
  map: iconMap,
  timeline: iconTimeline,
  calendar: iconCalendar,
  accordion: iconAccordion,
  carousel: iconCarousel,
  logo: iconLogo,
  faq: iconFaq,
  gallery: iconGallery,
  // Controls
  button: iconButton,
  input: iconInput,
  search: iconSearch,
  form: iconForm,
  tabs: iconTabs,
  dropdown: iconDropdown,
  toggle: iconToggle,
  stepper: iconStepper,
  rating: iconRating,
  fileUpload: iconFileUpload,
  checkbox: iconCheckbox,
  radio: iconRadio,
  slider: iconSlider,
  datePicker: iconDatePicker,
  // Elements
  avatar: iconAvatar,
  badge: iconBadge,
  tag: iconTag,
  breadcrumb: iconBreadcrumb,
  pagination: iconPagination,
  progress: iconProgress,
  alert: iconAlert,
  toast: iconToast,
  notification: iconNotification,
  tooltip: iconTooltip,
  stat: iconStat,
  skeleton: iconSkeleton,
  chip: iconChip,
  icon: iconIcon,
  spinner: iconSpinner,
  // Blocks
  pricing: iconPricing,
  testimonial: iconTestimonial,
  cta: iconCta,
  productCard: iconProductCard,
  profile: iconProfile,
  feature: iconFeature,
  team: iconTeam,
  login: iconLogin,
  contact: iconContact,
};

export function getWireframeIcon(name: string): SVGSVGElement | null {
  const builder = ICON_BUILDERS[name];
  if (!builder) return null;
  return builder();
}

/**
 * Splits camelCase into separate words and capitalizes each.
 * "codeBlock" -> "Code Block", "datePicker" -> "Date Picker"
 */
function formatName(name: string): string {
  // Insert a space before each uppercase letter, then capitalize each word
  const words = name.replace(/([A-Z])/g, ' $1').trim().split(/\s+/);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export class ComponentPalette {
  private shadow: ShadowRoot;
  private panel: HTMLDivElement | null = null;
  private dropCallback: DropCallback | null = null;
  private clearCallback: ClearCallback | null = null;
  private placedCount = 0;
  private countLabel: HTMLSpanElement | null = null;
  private activeDragItem: HTMLDivElement | null = null;
  private wireframeToggleEl: HTMLDivElement | null = null;
  private dotGridEl: HTMLDivElement | null = null;
  private opacityOverlayEl: HTMLDivElement | null = null;
  private wireframeChangeHandler: (() => void) | null = null;

  constructor(shadowRoot: ShadowRoot) {
    this.shadow = shadowRoot;
    this.build();
  }

  private build(): void {
    // Inject scrollbar and animation styles
    const style = document.createElement('style');
    style.textContent = [
      '@keyframes endow-palette-in {',
      '  from { opacity: 0; filter: blur(5px); }',
      '  to { opacity: 1; filter: blur(0); }',
      '}',
      '.endow-palette-scroll::-webkit-scrollbar { width: 3px; }',
      '.endow-palette-scroll::-webkit-scrollbar-track { background: transparent; }',
      '.endow-palette-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }',
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
      fontFamily:    "'EndowSans', system-ui, sans-serif",
      display:       'flex',
      flexDirection: 'column',
      userSelect:    'none',
      animation:     'endow-palette-in 0.2s ease',
    });

    // Scrollable area
    const scrollWrap = document.createElement('div');
    Object.assign(scrollWrap.style, {
      position:  'relative',
      flex:      '1',
      minHeight: '0',
    });

    const scrollArea = document.createElement('div');
    scrollArea.className = 'endow-palette-scroll';
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

    // Dot-grid background overlay (appended to document.body so it's between page and endow overlay)
    this.dotGridEl = document.createElement('div');
    this.dotGridEl.dataset['endowGrid'] = '';
    Object.assign(this.dotGridEl.style, {
      position:      'fixed',
      inset:         '0',
      zIndex:        '2147483600',
      pointerEvents: 'none',
      display:       'none',
      background:    'white',
      backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)',
      backgroundSize:  '24px 24px',
    });
    document.body.appendChild(this.dotGridEl);
    _gridDotGridEl = this.dotGridEl;

    // Page opacity overlay (white layer that dims page content)
    this.opacityOverlayEl = document.createElement('div');
    this.opacityOverlayEl.dataset['endowOpacity'] = '';
    Object.assign(this.opacityOverlayEl.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         '100vw',
      height:        '100vh',
      background:    '#ffffff',
      opacity:       '0',
      zIndex:        '2147483598',
      pointerEvents: 'none',
      display:       'none',
    });
    document.body.appendChild(this.opacityOverlayEl);

    // Listen to wireframe state changes
    this.wireframeChangeHandler = () => this.applyWireframeState();
    onWireframeChange(this.wireframeChangeHandler);

    document.addEventListener('dragover', this.handleDragOver);
    document.addEventListener('drop', this.handleDrop);
  }

  private applyWireframeState(): void {
    const wf = isWireframe();
    // Update toggle pill
    if (this.wireframeToggleEl) {
      const pill = this.wireframeToggleEl.querySelector('[data-toggle-track]') as HTMLDivElement | null;
      const label = this.wireframeToggleEl.querySelector('[data-toggle-knob]') as HTMLSpanElement | null;
      if (pill && label) {
        if (wf) {
          pill.style.background = 'rgba(249,115,22,0.2)';
          pill.style.borderColor = 'rgba(249,115,22,0.5)';
          label.style.color = '#f97316';
        } else {
          pill.style.background = 'transparent';
          pill.style.borderColor = 'rgba(255,255,255,0.25)';
          label.style.color = 'rgba(255,255,255,0.5)';
        }
      }
    }
    // Update dot grid
    if (this.dotGridEl) {
      this.dotGridEl.style.display = wf ? '' : 'none';
      if (wf) this.applyTheme();
    }
    // Update palette item active states via accent color
    if (this.panel) {
      const items = this.panel.querySelectorAll('[data-primitive-type]');
      items.forEach((item) => {
        // If drag-active, swap the blue to orange
        const el = item as HTMLDivElement;
        if (el === this.activeDragItem) {
          if (wf) {
            el.style.background = 'rgba(249,115,22,0.15)';
            el.style.border = '1px solid rgba(249,115,22,0.3)';
          } else {
            el.style.background = 'rgba(59,130,246,0.15)';
            el.style.border = '1px solid rgba(59,130,246,0.3)';
          }
        }
      });
    }
  }

  private applyTheme(): void {
    const theme = resolveTheme();
    if (this.dotGridEl) {
      if (theme === 'dark') {
        this.dotGridEl.style.background = '#141414';
        this.dotGridEl.style.backgroundImage = 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)';
      } else {
        this.dotGridEl.style.background = 'white';
        this.dotGridEl.style.backgroundImage = 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)';
      }
      this.dotGridEl.style.backgroundSize = '24px 24px';
    }
    if (this.opacityOverlayEl) {
      this.opacityOverlayEl.style.background = theme === 'dark' ? '#141414' : '#ffffff';
    }
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
      width:          '20px',
      height:         '16px',
      border:         '1px dashed rgba(255,255,255,0.15)',
      background:     'rgba(255,255,255,0.04)',
      borderRadius:   '3px',
      flexShrink:     '0',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      color:          'rgba(255,255,255,0.35)',
    });

    // Per-component wireframe icon
    const iconSvg = getWireframeIcon(name);
    if (iconSvg) {
      iconSvg.style.width = '20px';
      iconSvg.style.height = '16px';
      iconBox.appendChild(iconSvg);
    }
    item.appendChild(iconBox);

    // Label
    const label = document.createElement('span');
    label.textContent = formatName(name);
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
      e.dataTransfer.setData('endow/type', name);
      e.dataTransfer.setData('endow/category', category);
      this.activeDragItem = item;
      const wf = isWireframe();
      item.style.background = wf ? 'rgba(249,115,22,0.15)' : 'rgba(59,130,246,0.15)';
      item.style.border = wf
        ? '1px solid rgba(249,115,22,0.3)'
        : '1px solid rgba(59,130,246,0.3)';
    });

    item.addEventListener('dragend', () => {
      this.activeDragItem = null;
      item.style.background = '';
      item.style.border = '1px solid transparent';
    });

    return item;
  }

  private buildFooter(): HTMLDivElement {
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display:        'flex',
      flexDirection:  'column',
      gap:            '10px',
      padding:        '10px 12px 12px',
      borderTop:      '1px solid rgba(255,255,255,0.07)',
    });

    // Top row: count + clear
    const topRow = document.createElement('div');
    Object.assign(topRow.style, {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
    });

    this.countLabel = document.createElement('span');
    this.countLabel.textContent = '0 placed';
    Object.assign(this.countLabel.style, {
      fontSize:   '11px',
      fontWeight: '500',
      color:      'rgba(255,255,255,0.5)',
    });
    topRow.appendChild(this.countLabel);

    // Opacity slider
    const opacityWrap = document.createElement('div');
    Object.assign(opacityWrap.style, {
      display:       'flex',
      flexDirection: 'column',
      gap:           '3px',
    });

    const opacityLabel = document.createElement('span');
    opacityLabel.textContent = 'Toggle Opacity';
    Object.assign(opacityLabel.style, {
      fontSize:   '10px',
      fontWeight: '500',
      color:      'rgba(255,255,255,0.5)',
    });
    opacityWrap.appendChild(opacityLabel);

    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0';
    opacitySlider.max = '100';
    opacitySlider.value = '100';
    Object.assign(opacitySlider.style, {
      width:           '100%',
      height:          '4px',
      cursor:          'pointer',
      appearance:      'none',
      background:      'rgba(255,255,255,0.15)',
      borderRadius:    '2px',
      outline:         'none',
    });

    // Inject slider thumb styles (orange thumb, gray track)
    const sliderId = 'endow-opacity-slider-' + Date.now();
    opacitySlider.id = sliderId;
    const sliderStyle = document.createElement('style');
    sliderStyle.textContent = [
      '#' + sliderId + '::-webkit-slider-thumb {',
      '  -webkit-appearance: none;',
      '  appearance: none;',
      '  width: 12px;',
      '  height: 12px;',
      '  border-radius: 50%;',
      '  background: #f97316;',
      '  cursor: pointer;',
      '  border: none;',
      '}',
      '#' + sliderId + '::-moz-range-thumb {',
      '  width: 12px;',
      '  height: 12px;',
      '  border-radius: 50%;',
      '  background: #f97316;',
      '  cursor: pointer;',
      '  border: none;',
      '}',
    ].join('\n');
    this.shadow.appendChild(sliderStyle);

    opacitySlider.addEventListener('input', () => {
      const val = parseInt(opacitySlider.value, 10);
      if (this.opacityOverlayEl) {
        if (val >= 100) {
          this.opacityOverlayEl.style.display = 'none';
          this.opacityOverlayEl.style.opacity = '0';
        } else {
          this.opacityOverlayEl.style.display = '';
          // At slider=0, page fully hidden (overlay opacity=1)
          // At slider=100, page fully visible (overlay opacity=0)
          this.opacityOverlayEl.style.opacity = String((100 - val) / 100);
        }
      }
    });

    opacityWrap.appendChild(opacitySlider);
    footer.appendChild(opacityWrap);

    // Accent color swatches
    const SWATCHES = [
      { hex: '#D97757', r: 59,  g: 130, b: 246 },
      { hex: '#8b5cf6', r: 139, g: 92,  b: 246 },
      { hex: '#22c55e', r: 34,  g: 197, b: 94  },
      { hex: '#f97316', r: 249, g: 115, b: 22  },
      { hex: '#ef4444', r: 239, g: 68,  b: 68  },
      { hex: '#ec4899', r: 236, g: 72,  b: 153 },
    ];

    const colorWrap = document.createElement('div');
    Object.assign(colorWrap.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '8px',
    });

    const swatchDots: HTMLDivElement[] = [];
    for (const swatch of SWATCHES) {
      const dot = document.createElement('div');
      const isActive = swatch.hex === '#D97757';
      Object.assign(dot.style, {
        width:        '18px',
        height:       '18px',
        borderRadius: '50%',
        background:   swatch.hex,
        cursor:       'pointer',
        border:       isActive ? '2px solid #fff' : '2px solid transparent',
        boxShadow:    isActive ? `0 0 0 1px ${swatch.hex}` : 'none',
        transition:   'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
        flexShrink:   '0',
      });
      dot.addEventListener('mouseenter', () => {
        if (dot.style.borderColor !== 'rgb(255, 255, 255)') {
          dot.style.transform = 'scale(1.15)';
        }
      });
      dot.addEventListener('mouseleave', () => {
        dot.style.transform = '';
      });
      dot.addEventListener('mousedown', () => {
        dot.style.transform = 'scale(0.92)';
      });
      dot.addEventListener('mouseup', () => {
        dot.style.transform = '';
      });
      dot.addEventListener('click', () => {
        for (const d of swatchDots) {
          d.style.border = '2px solid transparent';
          d.style.boxShadow = 'none';
        }
        dot.style.border = '2px solid #fff';
        dot.style.boxShadow = `0 0 0 1px ${swatch.hex}`;
        setAccentColor(swatch.r, swatch.g, swatch.b);
      });
      swatchDots.push(dot);
      colorWrap.appendChild(dot);
    }
    footer.appendChild(colorWrap);

    // Wireframe toggle - pill-shaped button with dashed border
    this.wireframeToggleEl = document.createElement('div');
    Object.assign(this.wireframeToggleEl.style, {
      display:       'flex',
      flexDirection: 'column',
      gap:           '2px',
      cursor:        'pointer',
    });

    const togglePill = document.createElement('div');
    togglePill.dataset['toggleTrack'] = '';
    Object.assign(togglePill.style, {
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      padding:      '3px 8px',
      borderRadius: '10px',
      border:       '1px dashed rgba(255,255,255,0.25)',
      background:   'transparent',
      transition:   'background 0.15s ease, border-color 0.15s ease',
    });

    const toggleLabel = document.createElement('span');
    toggleLabel.dataset['toggleKnob'] = '';
    toggleLabel.textContent = 'Wireframe Mode';
    Object.assign(toggleLabel.style, {
      fontSize:   '10px',
      fontWeight: '500',
      color:      'rgba(255,255,255,0.5)',
      transition: 'color 0.15s ease',
    });
    togglePill.appendChild(toggleLabel);
    this.wireframeToggleEl.appendChild(togglePill);

    const toggleDesc = document.createElement('span');
    toggleDesc.textContent = 'Show component outlines on blank canvas';
    Object.assign(toggleDesc.style, {
      fontSize: '10px',
      color:    'rgba(255,255,255,0.4)',
    });
    this.wireframeToggleEl.appendChild(toggleDesc);

    this.wireframeToggleEl.addEventListener('click', () => {
      toggleWireframe();
    });

    // Clear button in the top row
    const clearBtn = document.createElement('span');
    clearBtn.textContent = 'Clear';
    Object.assign(clearBtn.style, {
      fontSize:   '11px',
      fontWeight: '500',
      color:      'rgba(255,255,255,0.5)',
      cursor:     'pointer',
      transition: 'color 0.12s ease',
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
    topRow.appendChild(clearBtn);
    footer.appendChild(topRow);

    footer.appendChild(this.wireframeToggleEl);

    // Theme selector (System / Dark / Light)
    const themeRow = document.createElement('div');
    Object.assign(themeRow.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '4px',
    });

    const themeLabel = document.createElement('span');
    themeLabel.textContent = 'Theme';
    Object.assign(themeLabel.style, {
      fontSize:   '10px',
      fontWeight: '500',
      color:      'rgba(255,255,255,0.4)',
      marginRight: '4px',
    });
    themeRow.appendChild(themeLabel);

    const themePills: HTMLDivElement[] = [];
    const THEME_OPTIONS: WireframeTheme[] = ['system', 'dark', 'light'];
    for (const opt of THEME_OPTIONS) {
      const pill = document.createElement('div');
      const isActive = opt === _wireframeTheme;
      pill.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      Object.assign(pill.style, {
        fontSize:     '10px',
        fontWeight:   '500',
        padding:      '2px 8px',
        borderRadius: '8px',
        cursor:       'pointer',
        color:        isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
        background:   isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
        transition:   'background 0.12s ease, color 0.12s ease',
      });
      pill.addEventListener('mouseenter', () => {
        if (_wireframeTheme !== opt) {
          pill.style.background = 'rgba(255,255,255,0.06)';
        }
      });
      pill.addEventListener('mouseleave', () => {
        if (_wireframeTheme !== opt) {
          pill.style.background = 'transparent';
        }
      });
      pill.addEventListener('click', () => {
        _wireframeTheme = opt;
        for (const p of themePills) {
          const active = p.textContent?.toLowerCase() === opt;
          p.style.color = active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
          p.style.background = active ? 'rgba(255,255,255,0.12)' : 'transparent';
        }
        this.applyTheme();
      });
      themePills.push(pill);
      themeRow.appendChild(pill);
    }
    footer.appendChild(themeRow);

    // Helper text
    const helperText = document.createElement('span');
    helperText.textContent = 'Drag components onto the canvas.';
    Object.assign(helperText.style, {
      fontSize: '10px',
      color:    'rgba(255,255,255,0.3)',
      lineHeight: '1.3',
    });
    footer.appendChild(helperText);

    return footer;
  }

  private updateCountLabel(): void {
    if (this.countLabel) {
      this.countLabel.textContent = `${this.placedCount} placed`;
    }
  }

  private handleDragOver = (e: DragEvent): void => {
    if (!e.dataTransfer?.types.includes('endow/type')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  private handleDrop = (e: DragEvent): void => {
    if (!e.dataTransfer?.types.includes('endow/type')) return;
    e.preventDefault();

    const type = e.dataTransfer.getData('endow/type');
    const category = e.dataTransfer.getData('endow/category');
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
    if (this.wireframeChangeHandler) {
      offWireframeChange(this.wireframeChangeHandler);
    }
    this.panel?.remove();
    this.dotGridEl?.remove();
    this.opacityOverlayEl?.remove();
    this.panel = null;
    this.countLabel = null;
    this.dotGridEl = null;
    this.opacityOverlayEl = null;
    _gridDotGridEl = null;
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

  isWireframe(): boolean {
    return isWireframe();
  }

  toggleWireframe(): void {
    toggleWireframe();
  }
}
