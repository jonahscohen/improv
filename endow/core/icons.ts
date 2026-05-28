export function svgBase(size: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}

export function addPath(svg: SVGSVGElement, d: string): void {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
}

export function addLine(svg: SVGSVGElement, x1: string, y1: string, x2: string, y2: string): void {
  const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l.setAttribute('x1', x1);
  l.setAttribute('y1', y1);
  l.setAttribute('x2', x2);
  l.setAttribute('y2', y2);
  svg.appendChild(l);
}

export function addRect(svg: SVGSVGElement, x: string, y: string, w: string, h: string, rx: string): void {
  const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  r.setAttribute('x', x);
  r.setAttribute('y', y);
  r.setAttribute('width', w);
  r.setAttribute('height', h);
  r.setAttribute('rx', rx);
  svg.appendChild(r);
}

export function addCircle(svg: SVGSVGElement, cx: string, cy: string, r: string): void {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx);
  c.setAttribute('cy', cy);
  c.setAttribute('r', r);
  c.setAttribute('fill', 'none');
  c.setAttribute('stroke', 'currentColor');
  svg.appendChild(c);
}

export function iconManipulate(size: number): SVGSVGElement {
  const svg = svgBase(size);
  const ns = 'http://www.w3.org/2000/svg';
  const t1r = document.createElementNS(ns, 'line');
  t1r.setAttribute('x1', '21');
  t1r.setAttribute('x2', '14');
  t1r.setAttribute('y1', '4');
  t1r.setAttribute('y2', '4');
  t1r.dataset.sl = 't1r';
  svg.appendChild(t1r);
  const t1l = document.createElementNS(ns, 'line');
  t1l.setAttribute('x1', '10');
  t1l.setAttribute('x2', '3');
  t1l.setAttribute('y1', '4');
  t1l.setAttribute('y2', '4');
  t1l.dataset.sl = 't1l';
  svg.appendChild(t1l);
  const t2r = document.createElementNS(ns, 'line');
  t2r.setAttribute('x1', '21');
  t2r.setAttribute('x2', '12');
  t2r.setAttribute('y1', '12');
  t2r.setAttribute('y2', '12');
  t2r.dataset.sl = 't2r';
  svg.appendChild(t2r);
  const t2l = document.createElementNS(ns, 'line');
  t2l.setAttribute('x1', '8');
  t2l.setAttribute('x2', '3');
  t2l.setAttribute('y1', '12');
  t2l.setAttribute('y2', '12');
  t2l.dataset.sl = 't2l';
  svg.appendChild(t2l);
  const t3l = document.createElementNS(ns, 'line');
  t3l.setAttribute('x1', '3');
  t3l.setAttribute('x2', '12');
  t3l.setAttribute('y1', '20');
  t3l.setAttribute('y2', '20');
  t3l.dataset.sl = 't3l';
  svg.appendChild(t3l);
  const t3r = document.createElementNS(ns, 'line');
  t3r.setAttribute('x1', '16');
  t3r.setAttribute('x2', '21');
  t3r.setAttribute('y1', '20');
  t3r.setAttribute('y2', '20');
  t3r.dataset.sl = 't3r';
  svg.appendChild(t3r);
  const k1 = document.createElementNS(ns, 'line');
  k1.setAttribute('x1', '14');
  k1.setAttribute('x2', '14');
  k1.setAttribute('y1', '2');
  k1.setAttribute('y2', '6');
  k1.dataset.sl = 'k1';
  svg.appendChild(k1);
  const k2 = document.createElementNS(ns, 'line');
  k2.setAttribute('x1', '8');
  k2.setAttribute('x2', '8');
  k2.setAttribute('y1', '10');
  k2.setAttribute('y2', '14');
  k2.dataset.sl = 'k2';
  svg.appendChild(k2);
  const k3 = document.createElementNS(ns, 'line');
  k3.setAttribute('x1', '16');
  k3.setAttribute('x2', '16');
  k3.setAttribute('y1', '18');
  k3.setAttribute('y2', '22');
  k3.dataset.sl = 'k3';
  svg.appendChild(k3);
  return svg;
}

export function iconPrompt(size: number): SVGSVGElement {
  const svg = svgBase(size);
  svg.style.transformOrigin = 'center';
  addPath(svg, 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
  return svg;
}

export function iconAnnotate(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addLine(svg, '13', '21', '21', '21');
  addPath(svg, 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z');
  return svg;
}

export function iconLayout(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addRect(svg, '3', '3', '7', '7', '1');
  addRect(svg, '14', '3', '7', '7', '1');
  addRect(svg, '14', '14', '7', '7', '1');
  addRect(svg, '3', '14', '7', '7', '1');
  return svg;
}

export function iconSettings(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addPath(svg, 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915');
  addCircle(svg, '12', '12', '3');
  return svg;
}

export function iconEraser(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addPath(svg, 'M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21');
  addLine(svg, '5.082', '11.09', '13.91', '19.918');
  return svg;
}

export function iconSend(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addPath(svg, 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z');
  addLine(svg, '21.854', '2.147', '10.914', '13.086');
  return svg;
}

export function iconClose(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addLine(svg, '18', '6', '6', '18');
  addLine(svg, '6', '6', '18', '18');
  return svg;
}

export type IconBuilder = (size: number) => SVGSVGElement;

export const MODE_ICON_BUILDERS: Record<string, IconBuilder> = {
  manipulate: iconManipulate,
  prompt: iconPrompt,
  layout: iconLayout,
};
