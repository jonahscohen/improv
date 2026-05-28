// ---------------------------------------------------------------------------
// icons.ts - SVG icons extracted verbatim from reference tool v0.7.6
// Source: reference design tool (v0.7.6)
// All path data copied character-for-character from the reference source.
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------------------
// Helper: create an <svg> wrapper (mirrors the reference tool's `I` component at line 7954)
// ---------------------------------------------------------------------------
function makeSvg(size: number, viewBox = '0 0 24 24'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  return svg;
}

// ---------------------------------------------------------------------------
// Helper: create a <path> element with arbitrary attributes
// ---------------------------------------------------------------------------
function makePath(attrs: Record<string, string>): SVGPathElement {
  const path = document.createElementNS(SVG_NS, 'path');
  for (const [k, v] of Object.entries(attrs)) {
    path.setAttribute(k, v);
  }
  return path;
}

// ===========================================================================
//  RADIUS ICONS (lines 7957-7967)
// ===========================================================================

export function radiusTopLeft(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M12.4781 8L12.5 8H15.5C15.7761 8 16 8.22386 16 8.5C16 8.77614 15.7761 9 15.5 9H12.5C11.7917 9 11.2905 9.00039 10.8987 9.0324C10.5128 9.06393 10.2772 9.12365 10.092 9.21799C9.71569 9.40973 9.40973 9.71569 9.21799 10.092C9.12365 10.2772 9.06393 10.5128 9.0324 10.8987C9.00039 11.2905 9 11.7917 9 12.5V15.5C9 15.7761 8.77614 16 8.5 16C8.22386 16 8 15.7761 8 15.5V12.5L8 12.4781C8 11.7966 7.99999 11.2546 8.03572 10.8173C8.07231 10.3695 8.14884 9.98765 8.32698 9.63803C8.6146 9.07354 9.07354 8.6146 9.63803 8.32698C9.98765 8.14884 10.3695 8.07231 10.8173 8.03572C11.2546 7.99999 11.7966 8 12.4781 8Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function radiusTopRight(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M11.5219 8L11.5 8H8.5C8.22386 8 8 8.22386 8 8.5C8 8.77614 8.22386 9 8.5 9H11.5C12.2083 9 12.7095 9.00039 13.1013 9.0324C13.4872 9.06393 13.7228 9.12365 13.908 9.21799C14.2843 9.40973 14.5903 9.71569 14.782 10.092C14.8764 10.2772 14.9361 10.5128 14.9676 10.8987C14.9996 11.2905 15 11.7917 15 12.5V15.5C15 15.7761 15.2239 16 15.5 16C15.7761 16 16 15.7761 16 15.5V12.5V12.4781C16 11.7966 16 11.2546 15.9643 10.8173C15.9277 10.3695 15.8512 9.98765 15.673 9.63803C15.3854 9.07354 14.9265 8.6146 14.362 8.32698C14.0123 8.14884 13.6305 8.07231 13.1827 8.03572C12.7454 7.99999 12.2034 8 11.5219 8Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function radiusBottomLeft(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M12.4781 16H12.5H15.5C15.7761 16 16 15.7761 16 15.5C16 15.2239 15.7761 15 15.5 15H12.5C11.7917 15 11.2905 14.9996 10.8987 14.9676C10.5128 14.9361 10.2772 14.8764 10.092 14.782C9.71569 14.5903 9.40973 14.2843 9.21799 13.908C9.12365 13.7228 9.06393 13.4872 9.0324 13.1013C9.00039 12.7095 9 12.2083 9 11.5V8.5C9 8.22386 8.77614 8 8.5 8C8.22386 8 8 8.22386 8 8.5V11.5L8 11.5219C8 12.2034 7.99999 12.7454 8.03572 13.1827C8.07231 13.6305 8.14884 14.0123 8.32698 14.362C8.6146 14.9265 9.07354 15.3854 9.63803 15.673C9.98765 15.8512 10.3695 15.9277 10.8173 15.9643C11.2546 16 11.7966 16 12.4781 16Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function radiusBottomRight(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M11.5219 16H11.5H8.5C8.22386 16 8 15.7761 8 15.5C8 15.2239 8.22386 15 8.5 15H11.5C12.2083 15 12.7095 14.9996 13.1013 14.9676C13.4872 14.9361 13.7228 14.8764 13.908 14.782C14.2843 14.5903 14.5903 14.2843 14.782 13.908C14.8764 13.7228 14.9361 13.4872 14.9676 13.1013C14.9996 12.7095 15 12.2083 15 11.5V8.5C15 8.22386 15.2239 8 15.5 8C15.7761 8 16 8.22386 16 8.5V11.5V11.5219C16 12.2034 16 12.7454 15.9643 13.1827C15.9277 13.6305 15.8512 14.0123 15.673 14.362C15.3854 14.9265 14.9265 15.3854 14.362 15.673C14.0123 15.8512 13.6305 15.9277 13.1827 15.9643C12.7454 16 12.2034 16 11.5219 16Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

// ===========================================================================
//  PADDING ICONS (lines 7969-7988)
// ===========================================================================

export function alPaddingHorizontal(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M8 7.5C8 7.22386 7.77614 7 7.5 7C7.22386 7 7 7.22386 7 7.5V16.5C7 16.7761 7.22386 17 7.5 17C7.77614 17 8 16.7761 8 16.5V7.5ZM16.5 7C16.7761 7 17 7.22386 17 7.5V16.5C17 16.7761 16.7761 17 16.5 17C16.2239 17 16 16.7761 16 16.5V7.5C16 7.22386 16.2239 7 16.5 7ZM13 13V11H11V13H13ZM14 11C14 10.4477 13.5523 10 13 10H11C10.4477 10 10 10.4477 10 11V13C10 13.5523 10.4477 14 11 14H13C13.5523 14 14 13.5523 14 13V11Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function alPaddingVertical(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M7.5 16C7.22386 16 7 16.2239 7 16.5C7 16.7761 7.22386 17 7.5 17H16.5C16.7761 17 17 16.7761 17 16.5C17 16.2239 16.7761 16 16.5 16H7.5ZM7 7.5C7 7.22385 7.22386 7 7.5 7H16.5C16.7761 7 17 7.22385 17 7.5C17 7.77615 16.7761 8 16.5 8H7.5C7.22386 8 7 7.77615 7 7.5ZM13 11H11V13H13V11ZM11 10C10.4477 10 10 10.4477 10 11V13C10 13.5523 10.4477 14 11 14H13C13.5523 14 14 13.5523 14 13V11C14 10.4477 13.5523 10 13 10H11Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function alPaddingTop(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M7.5 7C7.22386 7 7 7.22385 7 7.5C7 7.77615 7.22386 8 7.5 8H16.5C16.7761 8 17 7.77615 17 7.5C17 7.22385 16.7761 7 16.5 7L7.5 7ZM11 11H13V13H11V11ZM10 11C10 10.4477 10.4477 10 11 10H13C13.5523 10 14 10.4477 14 11V13C14 13.5523 13.5523 14 13 14H11C10.4477 14 10 13.5523 10 13V11Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function alPaddingBottom(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M11 11H13V13H11V11ZM10 11C10 10.4477 10.4477 10 11 10H13C13.5523 10 14 10.4477 14 11V13C14 13.5523 13.5523 14 13 14H11C10.4477 14 10 13.5523 10 13V11ZM7.5 16C7.22386 16 7 16.2239 7 16.5C7 16.7761 7.22386 17 7.5 17H16.5C16.7761 17 17 16.7761 17 16.5C17 16.2239 16.7761 16 16.5 16H7.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function alPaddingLeft(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M8 7.5C8 7.22386 7.77614 7 7.5 7C7.22386 7 7 7.22386 7 7.5V16.5C7 16.7761 7.22386 17 7.5 17C7.77614 17 8 16.7761 8 16.5V7.5ZM13 11V13H11V11H13ZM13 10C13.5523 10 14 10.4477 14 11V13C14 13.5523 13.5523 14 13 14H11C10.4477 14 10 13.5523 10 13V11C10 10.4477 10.4477 10 11 10H13Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function alPaddingRight(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M17 7.5C17 7.22386 16.7761 7 16.5 7C16.2239 7 16 7.22386 16 7.5V16.5C16 16.7761 16.2239 17 16.5 17C16.7761 17 17 16.7761 17 16.5V7.5ZM13 11V13H11V11H13ZM13 10C13.5523 10 14 10.4477 14 11V13C14 13.5523 13.5523 14 13 14H11C10.4477 14 10 13.5523 10 13V11C10 10.4477 10.4477 10 11 10H13Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function alPaddingSides(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M8 9.5C8 9.22385 7.77614 9 7.5 9C7.22386 9 7 9.22385 7 9.5L7 14.5C7 14.7761 7.22386 15 7.5 15C7.77614 15 8 14.7761 8 14.5V9.5ZM17 9.5C17 9.22385 16.7761 9 16.5 9C16.2239 9 16 9.22385 16 9.5V14.5C16 14.7761 16.2239 15 16.5 15C16.7761 15 17 14.7761 17 14.5V9.5ZM9 7.5C9 7.22385 9.22386 7 9.5 7H14.5C14.7761 7 15 7.22385 15 7.5C15 7.77615 14.7761 8 14.5 8H9.5C9.22386 8 9 7.77615 9 7.5ZM9.5 16C9.22386 16 9 16.2239 9 16.5C9 16.7761 9.22386 17 9.5 17H14.5C14.7761 17 15 16.7761 15 16.5C15 16.2239 14.7761 16 14.5 16H9.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

// ===========================================================================
//  SPACING ICONS (lines 7990-7994)
// ===========================================================================

export function alSpacingHorizontal(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M7 15.5C7 15.2239 7.22386 15 7.5 15H7.75C7.88807 15 8 14.8881 8 14.75V8.25C8 8.11193 7.88807 8 7.75 8H7.5C7.22386 8 7 7.77614 7 7.5C7 7.22386 7.22386 7 7.5 7H7.75C8.44036 7 9 7.55964 9 8.25V14.75C9 15.4404 8.44036 16 7.75 16H7.5C7.22386 16 7 15.7761 7 15.5ZM15 14.7502C15 14.8883 15.1119 15.0002 15.25 15.0002H15.5C15.7761 15.0002 16 15.2241 16 15.5002C16 15.7764 15.7761 16.0002 15.5 16.0002H15.25C14.5596 16.0002 14 15.4406 14 14.7502V8.25012C14 7.55977 14.5596 7.00012 15.25 7.00012H15.5C15.7761 7.00012 16 7.22398 16 7.50012C16 7.77626 15.7761 8.00012 15.5 8.00012H15.25C15.1119 8.00012 15 8.11205 15 8.25012V14.7502ZM11 13.5C11 13.7761 11.2239 14 11.5 14C11.7761 14 12 13.7761 12 13.5V9.5C12 9.22386 11.7761 9 11.5 9C11.2239 9 11 9.22386 11 9.5V13.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function alSpacingVertical(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M7.5 7C7.77614 7 8 7.22386 8 7.5V7.75C8 7.88807 8.11193 8 8.25 8H14.75C14.8881 8 15 7.88807 15 7.75V7.5C15 7.22386 15.2239 7 15.5 7C15.7761 7 16 7.22386 16 7.5V7.75C16 8.44036 15.4404 9 14.75 9H8.25C7.55964 9 7 8.44036 7 7.75V7.5C7 7.22386 7.22386 7 7.5 7ZM8.25 15C8.11193 15 8 15.1119 8 15.25V15.5C8 15.7761 7.77614 16 7.5 16C7.22386 16 7 15.7761 7 15.5V15.25C7 14.5596 7.55964 14 8.25 14H14.7501C15.4405 14 16.0001 14.5596 16.0001 15.25V15.5C16.0001 15.7761 15.7763 16 15.5001 16C15.224 16 15.0001 15.7761 15.0001 15.5V15.25C15.0001 15.1119 14.8882 15 14.7501 15H8.25ZM9.5 11C9.22386 11 9 11.2239 9 11.5C9 11.7761 9.22386 12 9.5 12H13.5C13.7761 12 14 11.7761 14 11.5C14 11.2239 13.7761 11 13.5 11H9.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

// ===========================================================================
//  LAYOUT ALIGNMENT ICONS (lines 7996-8030)
// ===========================================================================

export function layoutAlignLeft(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M17.25 10C17.6642 10 18 9.66421 18 9.25V8.75C18 8.33579 17.6642 8 17.25 8H8.75C8.33579 8 8 8.33579 8 8.75V9.25C8 9.66421 8.33579 10 8.75 10H17.25ZM13.25 15C13.6642 15 14 14.6642 14 14.25V13.75C14 13.3358 13.6642 13 13.25 13H8.75C8.33579 13 8 13.3358 8 13.75V14.25C8 14.6642 8.33579 15 8.75 15H13.25Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  svg.appendChild(makePath({
    d: 'M6 17.5C6 17.7761 5.77614 18 5.5 18C5.22386 18 5 17.7761 5 17.5V5.5C5 5.22386 5.22386 5 5.5 5C5.77614 5 6 5.22386 6 5.5V17.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.3',
  }));
  return svg;
}

export function layoutAlignRight(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M6.75 10C6.33579 10 6 9.66421 6 9.25V8.75C6 8.33579 6.33579 8 6.75 8H15.25C15.6642 8 16 8.33579 16 8.75V9.25C16 9.66421 15.6642 10 15.25 10H6.75ZM10.75 15C10.3358 15 10 14.6642 10 14.25V13.75C10 13.3358 10.3358 13 10.75 13H15.25C15.6642 13 16 13.3358 16 13.75V14.25C16 14.6642 15.6642 15 15.25 15H10.75Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  svg.appendChild(makePath({
    d: 'M18 17.5C18 17.7761 18.2239 18 18.5 18C18.7761 18 19 17.7761 19 17.5V5.5C19 5.22386 18.7761 5 18.5 5C18.2239 5 18 5.22386 18 5.5V17.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.3',
  }));
  return svg;
}

export function layoutAlignHorizontalCenter(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M17.25 10C17.6642 10 18 9.66421 18 9.25V8.75C18 8.33579 17.6642 8 17.25 8H7.75C7.33579 8 7 8.33579 7 8.75V9.25C7 9.66421 7.33579 10 7.75 10H17.25ZM15.25 15C15.6642 15 16 14.6642 16 14.25V13.75C16 13.3358 15.6642 13 15.25 13H9.75C9.33579 13 9 13.3358 9 13.75V14.25C9 14.6642 9.33579 15 9.75 15H15.25Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M13 17.5C13 17.7761 12.7761 18 12.5 18C12.2239 18 12 17.7761 12 17.5V15H13V17.5ZM13 13V10H12V13H13ZM13 5.5V8H12V5.5C12 5.22386 12.2239 5 12.5 5C12.7761 5 13 5.22386 13 5.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.3',
  }));
  return svg;
}

export function layoutAlignTop(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M10 17.25C10 17.6642 9.66421 18 9.25 18H8.75C8.33579 18 8 17.6642 8 17.25L8 8.75C8 8.33579 8.33579 8 8.75 8H9.25C9.66421 8 10 8.33579 10 8.75V17.25ZM15 13.25C15 13.6642 14.6642 14 14.25 14H13.75C13.3358 14 13 13.6642 13 13.25V8.75C13 8.33579 13.3358 8 13.75 8H14.25C14.6642 8 15 8.33579 15 8.75V13.25Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  svg.appendChild(makePath({
    d: 'M17.5 6C17.7761 6 18 5.77614 18 5.5C18 5.22386 17.7761 5 17.5 5L5.5 5C5.22386 5 5 5.22386 5 5.5C5 5.77614 5.22386 6 5.5 6L17.5 6Z',
    fill: 'currentColor',
    'fill-opacity': '0.3',
  }));
  return svg;
}

export function layoutAlignBottom(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M10 6.75C10 6.33579 9.66421 6 9.25 6H8.75C8.33579 6 8 6.33579 8 6.75L8 15.25C8 15.6642 8.33579 16 8.75 16H9.25C9.66421 16 10 15.6642 10 15.25V6.75ZM15 10.75C15 10.3358 14.6642 10 14.25 10H13.75C13.3358 10 13 10.3358 13 10.75V15.25C13 15.6642 13.3358 16 13.75 16H14.25C14.6642 16 15 15.6642 15 15.25V10.75Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  svg.appendChild(makePath({
    d: 'M17.5 18C17.7761 18 18 18.2239 18 18.5C18 18.7761 17.7761 19 17.5 19H5.5C5.22386 19 5 18.7761 5 18.5C5 18.2239 5.22386 18 5.5 18H17.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.3',
  }));
  return svg;
}

export function layoutAlignVerticalCenter(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M10 6.75C10 6.33579 9.66421 6 9.25 6H8.75C8.33579 6 8 6.33579 8 6.75V16.25C8 16.6642 8.33579 17 8.75 17H9.25C9.66421 17 10 16.6642 10 16.25V6.75ZM15 8.75C15 8.33579 14.6642 8 14.25 8H13.75C13.3358 8 13 8.33579 13 8.75V14.25C13 14.6642 13.3358 15 13.75 15H14.25C14.6642 15 15 14.6642 15 14.25V8.75Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M17.5 11C17.7761 11 18 11.2239 18 11.5C18 11.7761 17.7761 12 17.5 12H15V11H17.5ZM13 11H10V12H13V11ZM5.5 11H8V12H5.5C5.22386 12 5 11.7761 5 11.5C5 11.2239 5.22386 11 5.5 11Z',
    fill: 'currentColor',
    'fill-opacity': '0.3',
  }));
  return svg;
}

// ===========================================================================
//  TEXT ALIGNMENT ICONS (lines 8032-8039)
// ===========================================================================

export function textAlignLeft(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M5 7.5C5 7.22386 5.22386 7 5.5 7H18.5C18.7761 7 19 7.22386 19 7.5C19 7.77614 18.7761 8 18.5 8H5.5C5.22386 8 5 7.77614 5 7.5ZM5 11.5C5 11.2239 5.22386 11 5.5 11H12.5C12.7761 11 13 11.2239 13 11.5C13 11.7761 12.7761 12 12.5 12H5.5C5.22386 12 5 11.7761 5 11.5ZM5.5 15C5.22386 15 5 15.2239 5 15.5C5 15.7761 5.22386 16 5.5 16H14.5C14.7761 16 15 15.7761 15 15.5C15 15.2239 14.7761 15 14.5 15H5.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function textAlignCenter(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M5 7.5C5 7.22386 5.22386 7 5.5 7H18.5C18.7761 7 19 7.22386 19 7.5C19 7.77614 18.7761 8 18.5 8H5.5C5.22386 8 5 7.77614 5 7.5ZM8 11.5C8 11.2239 8.22386 11 8.5 11H15.5C15.7761 11 16 11.2239 16 11.5C16 11.7761 15.7761 12 15.5 12H8.5C8.22386 12 8 11.7761 8 11.5ZM7.5 15C7.22386 15 7 15.2239 7 15.5C7 15.7761 7.22386 16 7.5 16H16.5C16.7761 16 17 15.7761 17 15.5C17 15.2239 16.7761 15 16.5 15H7.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function textAlignRight(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M19 7.5C19 7.22386 18.7761 7 18.5 7H5.5C5.22386 7 5 7.22386 5 7.5C5 7.77614 5.22386 8 5.5 8H18.5C18.7761 8 19 7.77614 19 7.5ZM19 11.5C19 11.2239 18.7761 11 18.5 11H11.5C11.2239 11 11 11.2239 11 11.5C11 11.7761 11.2239 12 11.5 12H18.5C18.7761 12 19 11.7761 19 11.5ZM18.5 15C18.7761 15 19 15.2239 19 15.5C19 15.7761 18.7761 16 18.5 16H9.5C9.22386 16 9 15.7761 9 15.5C9 15.2239 9.22386 15 9.5 15H18.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

// ===========================================================================
//  DISPLAY / LAYOUT MODE ICONS (lines 8050-8061)
// ===========================================================================

export function rectangleSmall(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M16.5 7H7.5C7.22386 7 7 7.22386 7 7.5V16.5C7 16.7761 7.22386 17 7.5 17H16.5C16.7761 17 17 16.7761 17 16.5V7.5C17 7.22386 16.7761 7 16.5 7ZM7.5 6C6.67157 6 6 6.67157 6 7.5V16.5C6 17.3284 6.67157 18 7.5 18H16.5C17.3284 18 18 17.3284 18 16.5V7.5C18 6.67157 17.3284 6 16.5 6H7.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function autolayoutAddHorizontal(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    d: 'M9.2998 18C10.1282 18 10.7998 17.3284 10.7998 16.5L10.7998 7.5C10.7998 6.67157 10.1282 6 9.2998 6H7.5L7.34668 6.00781C6.59028 6.08461 6 6.72334 6 7.5L6 16.5C6 17.3284 6.67157 18 7.5 18H9.2998ZM16.5 18C17.3283 17.9998 18 17.3283 18 16.5V7.5C18 6.67167 17.3283 6.00015 16.5 6H14.7002L14.5469 6.00781C13.7905 6.08461 13.2002 6.72334 13.2002 7.5L13.2002 16.5C13.2002 17.3284 13.8718 18 14.7002 18H16.5ZM7.5 17C7.22386 17 7 16.7761 7 16.5L7 7.5C7 7.22386 7.22386 7 7.5 7H9.2998C9.57595 7 9.7998 7.22386 9.7998 7.5L9.7998 16.5C9.7998 16.7761 9.57595 17 9.2998 17H7.5ZM14.7002 17C14.4241 17 14.2002 16.7761 14.2002 16.5L14.2002 7.5C14.2002 7.22386 14.4241 7 14.7002 7H16.5C16.776 7.00015 17 7.22395 17 7.5V16.5C17 16.7761 16.776 16.9998 16.5 17H14.7002Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function autolayoutAddVertical(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    d: 'M6 9.2998C6 10.1282 6.67157 10.7998 7.5 10.7998L16.5 10.7998C17.3284 10.7998 18 10.1282 18 9.29981L18 7.5L17.9922 7.34668C17.9154 6.59028 17.2767 6 16.5 6L7.5 6C6.67157 6 6 6.67157 6 7.5L6 9.2998ZM6 16.5C6.00015 17.3283 6.67167 18 7.5 18L16.5 18C17.3283 18 17.9998 17.3283 18 16.5L18 14.7002L17.9922 14.5469C17.9154 13.7905 17.2767 13.2002 16.5 13.2002L7.5 13.2002C6.67157 13.2002 6 13.8718 6 14.7002L6 16.5ZM7 7.5C7 7.22386 7.22386 7 7.5 7L16.5 7C16.7761 7 17 7.22386 17 7.5L17 9.29981C17 9.57595 16.7761 9.79981 16.5 9.79981L7.5 9.7998C7.22386 9.7998 7 9.57595 7 9.2998L7 7.5ZM7 14.7002C7 14.4241 7.22386 14.2002 7.5 14.2002L16.5 14.2002C16.7761 14.2002 17 14.4241 17 14.7002L17 16.5C16.9998 16.776 16.776 17 16.5 17L7.5 17C7.22395 17 7.00015 16.776 7 16.5L7 14.7002Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function gridView(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M7 7H10V10H7V7ZM6 7C6 6.44771 6.44771 6 7 6H10C10.5523 6 11 6.44771 11 7V10C11 10.5523 10.5523 11 10 11H7C6.44771 11 6 10.5523 6 10V7ZM7 14H10V17H7V14ZM6 14C6 13.4477 6.44771 13 7 13H10C10.5523 13 11 13.4477 11 14V17C11 17.5523 10.5523 18 10 18H7C6.44771 18 6 17.5523 6 17V14ZM17 7H14V10H17V7ZM14 6C13.4477 6 13 6.44771 13 7V10C13 10.5523 13.4477 11 14 11H17C17.5523 11 18 10.5523 18 10V7C18 6.44771 17.5523 6 17 6H14ZM14 14H17V17H14V14ZM13 14C13 13.4477 13.4477 13 14 13H17C17.5523 13 18 13.4477 18 14V17C18 17.5523 17.5523 18 17 18H14C13.4477 18 13 17.5523 13 17V14Z',
    fill: 'currentColor',
  }));
  return svg;
}

// ===========================================================================
//  UTILITY ICONS (lines 8062-8091)
// ===========================================================================

export function chevronDown(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M9.64645 11.1464C9.84171 10.9512 10.1583 10.9512 10.3536 11.1464L12 12.7929L13.6464 11.1464C13.8417 10.9512 14.1583 10.9512 14.3536 11.1464C14.5488 11.3417 14.5488 11.6583 14.3536 11.8536L12.3536 13.8536C12.1583 14.0488 11.8417 14.0488 11.6464 13.8536L9.64645 11.8536C9.45118 11.6583 9.45118 11.3417 9.64645 11.1464Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function chevronUp(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M11.6464 10.1464C11.8417 9.95118 12.1583 9.95118 12.3536 10.1464L14.3536 12.1464C14.5488 12.3417 14.5488 12.6583 14.3536 12.8536C14.1583 13.0488 13.8417 13.0488 13.6464 12.8536L12 11.2071L10.3536 12.8536C10.1583 13.0488 9.84171 13.0488 9.64645 12.8535C9.45118 12.6583 9.45118 12.3417 9.64645 12.1464L11.6464 10.1464Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function plus(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M12 6C12.2761 6 12.5 6.22386 12.5 6.5V11.5H17.5C17.7761 11.5 18 11.7239 18 12C18 12.2761 17.7761 12.5 17.5 12.5H12.5V17.5C12.5 17.7761 12.2761 18 12 18C11.7239 18 11.5 17.7761 11.5 17.5V12.5H6.5C6.22386 12.5 6 12.2761 6 12C6 11.7239 6.22386 11.5 6.5 11.5H11.5V6.5C11.5 6.22386 11.7239 6 12 6Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function minus(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M6 12C6 11.7239 6.22386 11.5 6.5 11.5H17.5C17.7761 11.5 18 11.7239 18 12C18 12.2761 17.7761 12.5 17.5 12.5H6.5C6.22386 12.5 6 12.2761 6 12Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function flipHorizontalSmall(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M12.5 6.5C12.5 6.22386 12.2761 6 12 6C11.7239 6 11.5 6.22386 11.5 6.5V17.5C11.5 17.7761 11.7239 18 12 18C12.2761 18 12.5 17.7761 12.5 17.5V6.5ZM6 9.10355C6 8.43538 6.80786 8.10075 7.28033 8.57323L10 11.2929C10.3905 11.6834 10.3905 12.3166 10 12.7071L7.28033 15.4268C6.80785 15.8993 6 15.5646 6 14.8965V9.10355ZM7 14.2929L9.29289 12L7 9.70711V14.2929ZM18 9.10355C18 8.43538 17.1921 8.10075 16.7197 8.57323L14 11.2929C13.6095 11.6834 13.6095 12.3166 14 12.7071L16.7197 15.4268C17.1922 15.8993 18 15.5646 18 14.8965V9.10355ZM17 14.2929L14.7071 12L17 9.70711V14.2929Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function adjustSmall(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M8 5.5C8 5.22386 8.22386 5 8.5 5C8.77614 5 9 5.22386 9 5.5V12.05C10.1411 12.2816 11 13.2905 11 14.5C11 15.7095 10.1411 16.7184 9 16.95V18.5C9 18.7761 8.77614 19 8.5 19C8.22386 19 8 18.7761 8 18.5V16.95C6.85888 16.7184 6 15.7095 6 14.5C6 13.2905 6.85888 12.2816 8 12.05V5.5ZM7 14.5C7 13.6716 7.67157 13 8.5 13C9.32843 13 10 13.6716 10 14.5C10 15.3284 9.32843 16 8.5 16C7.67157 16 7 15.3284 7 14.5ZM15 18.5C15 18.7761 15.2239 19 15.5 19C15.7761 19 16 18.7761 16 18.5V11.95C17.1411 11.7184 18 10.7095 18 9.5C18 8.29052 17.1411 7.28164 16 7.05001V5.5C16 5.22386 15.7761 5 15.5 5C15.2239 5 15 5.22386 15 5.5V7.05001C13.8589 7.28164 13 8.29052 13 9.5C13 10.7095 13.8589 11.7184 15 11.95V18.5ZM14 9.5C14 10.3284 14.6716 11 15.5 11C16.3284 11 17 10.3284 17 9.5C17 8.67157 16.3284 8 15.5 8C14.6716 8 14 8.67157 14 9.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function check(size: number = 16): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    d: 'M11.0839 4.22268C11.2371 3.99294 11.5475 3.93087 11.7773 4.08401C12.007 4.23718 12.0691 4.5476 11.916 4.77737L7.91596 10.7774C7.83287 10.902 7.69784 10.9833 7.54877 10.9981C7.39988 11.0127 7.25223 10.9593 7.14643 10.8535L4.14643 7.85354C3.9512 7.65827 3.95118 7.34176 4.14643 7.14651C4.34168 6.95126 4.6582 6.95128 4.85346 7.14651L7.42182 9.71487L11.0839 4.22268Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function rotate(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M10.2322 6.47491C11.2085 5.4986 12.7915 5.4986 13.7678 6.47491L15.2929 8.00003H14C13.7239 8.00003 13.5 8.22389 13.5 8.50003C13.5 8.77618 13.7239 9.00003 14 9.00003H16.5C16.7761 9.00003 17 8.77618 17 8.50003V6.00003C17 5.72389 16.7761 5.50003 16.5 5.50003C16.2239 5.50003 16 5.72389 16 6.00003V7.29293L14.4749 5.7678C13.108 4.40097 10.892 4.40097 9.52513 5.7678L7.14645 8.14648C6.95118 8.34174 6.95118 8.65833 7.14645 8.85359C7.34171 9.04885 7.65829 9.04885 7.85355 8.85359L10.2322 6.47491ZM13.0607 9.64648C12.4749 9.0607 11.5251 9.06069 10.9393 9.64648L7.64645 12.9394C7.06066 13.5252 7.06066 14.4749 7.64645 15.0607L10.9393 18.3536C11.5251 18.9394 12.4749 18.9394 13.0607 18.3536L16.3536 15.0607C16.9393 14.4749 16.9393 13.5252 16.3536 12.9394L13.0607 9.64648ZM11.6464 10.3536C11.8417 10.1583 12.1583 10.1583 12.3536 10.3536L15.6464 13.6465C15.8417 13.8417 15.8417 14.1583 15.6464 14.3536L12.3536 17.6465C12.1583 17.8417 11.8417 17.8417 11.6464 17.6465L8.35355 14.3536C8.15829 14.1583 8.15829 13.8417 8.35355 13.6465L11.6464 10.3536Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

// ===========================================================================
//  VARIABLE ACTION ICONS (lines 9062-9069)
// ===========================================================================

export function hexagonIcon(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    d: 'M12.5 11.0346C13.0522 11.0346 13.4999 11.4824 13.5 12.0346C13.5 12.5868 13.0523 13.0346 12.5 13.0346C11.9477 13.0346 11.5 12.5868 11.5 12.0346C11.5001 11.4824 11.9478 11.0346 12.5 11.0346Z',
    fill: 'currentColor',
  }));
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M11.5 6.26795C12.1188 5.91068 12.8812 5.91068 13.5 6.26795L17 8.28846C17.6187 8.64574 18 9.30641 18 10.0209V14.0619C17.9999 14.7763 17.6187 15.4371 17 15.7943L13.5 17.8148C12.8813 18.1719 12.1187 18.1719 11.5 17.8148L8 15.7943C7.3813 15.4371 7.00013 14.7763 7 14.0619V10.0209C7 9.30641 7.38129 8.64574 8 8.28846L11.5 6.26795ZM13 7.13416C12.6906 6.95553 12.3094 6.95553 12 7.13416L8.5 9.15467L8.38965 9.22791C8.14588 9.41565 8 9.70826 8 10.0209V14.0619C8.00013 14.419 8.1907 14.7495 8.5 14.9281L12 16.9486C12.2707 17.1048 12.5965 17.1244 12.8809 17.0072L13 16.9486L16.5 14.9281C16.8093 14.7495 16.9999 14.419 17 14.0619V10.0209C17 9.70826 16.8541 9.41565 16.6104 9.22791L16.5 9.15467L13 7.13416Z',
    fill: 'currentColor',
  }));
  return svg;
}

export function unlinkIcon(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    d: 'M12.3533 14.646C12.5485 14.8412 12.5484 15.1578 12.3533 15.3531L11.3534 16.353C10.3297 17.3765 8.67028 17.3766 7.64665 16.353C6.62317 15.3294 6.62317 13.6699 7.64665 12.6462L8.64654 11.6463C8.84181 11.4512 9.15844 11.4511 9.35364 11.6463C9.54883 11.8415 9.54874 12.1582 9.35364 12.3534L8.35375 13.3533C7.7208 13.9865 7.7208 15.0128 8.35375 15.6459C8.98687 16.279 10.0132 16.2789 10.6463 15.6459L11.6462 14.646C11.8414 14.451 12.1581 14.4511 12.3533 14.646ZM8.0002 9.00021C8.27634 9.00021 8.50015 9.22401 8.50015 9.50015C8.49994 9.77612 8.27622 10.0001 8.0002 10.0001H6.50036C6.22434 10.0001 6.00061 9.77612 6.00041 9.50015C6.00041 9.22401 6.22422 9.00021 6.50036 9.00021H8.0002ZM14.5002 15.5002C14.7763 15.5002 15.0001 15.724 15.0001 16.0001V17.5C15 17.776 14.7763 17.9999 14.5002 17.9999C14.2241 17.9999 14.0004 17.776 14.0002 17.5V16.0001C14.0002 15.724 14.2241 15.5002 14.5002 15.5002ZM9.50073 5.99984C9.77664 6.00011 10.0007 6.22381 10.0007 6.49978V7.99962C10.0007 8.2756 9.77664 8.4993 9.50073 8.49957C9.22459 8.49957 9.00078 8.27576 9.00078 7.99962V6.49978C9.00078 6.22364 9.22459 5.99984 9.50073 5.99984ZM17.5006 13.9997C17.7765 13.9998 18.0004 14.2237 18.0005 14.4996C18.0005 14.7757 17.7766 14.9994 17.5006 14.9996H16.0007C15.7246 14.9996 15.5008 14.7758 15.5008 14.4996C15.5009 14.2235 15.7246 13.9997 16.0007 13.9997H17.5006ZM16.3543 7.64676C17.3774 8.67043 17.3776 10.33 16.3543 11.3535L15.3544 12.3534C15.1592 12.5486 14.8426 12.5484 14.6473 12.3534C14.452 12.1582 14.452 11.8416 14.6473 11.6463L15.6472 10.6464C16.28 10.0134 16.2798 8.98702 15.6472 8.35387C15.0141 7.72075 13.9871 7.72018 13.3539 8.35317L12.354 9.35307C12.1588 9.54825 11.8422 9.54808 11.6469 9.35307C11.4519 9.15779 11.4517 8.84114 11.6469 8.64596L12.6468 7.64607C13.6705 6.62254 15.3306 6.62312 16.3543 7.64676Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

// ===========================================================================
//  ASPECT RATIO LOCK ICONS (line 11051 - inline SVGs)
// ===========================================================================

export function lockClosed(size: number = 16): SVGSVGElement {
  const svg = makeSvg(size, '0 0 24 24');
  svg.appendChild(makePath({
    d: 'M12 4C14.2091 4 16 5.79086 16 8V10H16.125C17.1605 10 18 10.8395 18 11.875V17.125C18 18.1605 17.1605 19 16.125 19H7.875C6.83947 19 6 18.1605 6 17.125V11.875C6 10.8395 6.83947 10 7.875 10H8V8C8 5.79086 9.79086 4 12 4ZM7.875 11C7.39175 11 7 11.3918 7 11.875V17.125C7 17.6082 7.39175 18 7.875 18H16.125C16.6082 18 17 17.6082 17 17.125V11.875C17 11.3918 16.6082 11 16.125 11H7.875ZM15 8C15 6.34315 13.6569 5 12 5C10.3431 5 9 6.34315 9 8V10H15V8Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function lockOpen(size: number = 16): SVGSVGElement {
  const svg = makeSvg(size, '0 0 24 24');
  svg.appendChild(makePath({
    d: 'M16.125 10C17.1605 10 18 10.8395 18 11.875V17.125C18 18.1605 17.1605 19 16.125 19H7.875C6.83947 19 6 18.1605 6 17.125V11.875C6 10.8395 6.83947 10 7.875 10H8V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V7.5C16 7.77614 15.7761 8 15.5 8C15.2239 8 15 7.77614 15 7.5V7C15 5.34315 13.6569 4 12 4C10.3431 4 9 5.34315 9 7V10H16.125ZM7.875 11C7.39175 11 7 11.3918 7 11.875V17.125C7 17.6082 7.39175 18 7.875 18H16.125C16.6082 18 17 17.6082 17 17.125V11.875C17 11.3918 16.6082 11 16.125 11H7.875Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

// ===========================================================================
//  ALIGNMENT GRID ICONS (lines 9803-9847) - 16x16 viewBox, color parameter
// ===========================================================================

export function iconDot(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    d: 'M8 7C8.55228 7 9 7.44772 9 8C9 8.55228 8.55228 9 8 9C7.44772 9 7 8.55228 7 8C7 7.44772 7.44772 7 8 7Z',
    fill: color,
    'fill-opacity': '0.3',
  }));
  return svg;
}

export function iconPositionLeft(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M4 3C3.44772 3 3 3.44772 3 4C3 4.55228 3.44772 5 4 5L9 5C9.55228 5 10 4.55229 10 4C10 3.44772 9.55228 3 9 3L4 3ZM4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9L12 9C12.5523 9 13 8.55229 13 8C13 7.44772 12.5523 7 12 7L4 7ZM3 12C3 11.4477 3.44771 11 4 11L7 11C7.55228 11 8 11.4477 8 12C8 12.5523 7.55228 13 7 13L4 13C3.44771 13 3 12.5523 3 12Z',
    fill: color,
  }));
  return svg;
}

export function iconPositionCenterH(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M10 3C10.5523 3 11 3.44772 11 4C11 4.55228 10.5523 5 10 5L6 5C5.44772 5 5 4.55228 5 4C5 3.44772 5.44772 3 6 3H10ZM12 7C12.5523 7 13 7.44772 13 8C13 8.55228 12.5523 9 12 9L4 9C3.44772 9 3 8.55228 3 8C3 7.44771 3.44772 7 4 7L12 7ZM10 12C10 11.4477 9.55228 11 9 11H7C6.44772 11 6 11.4477 6 12C6 12.5523 6.44772 13 7 13H9C9.55228 13 10 12.5523 10 12Z',
    fill: color,
  }));
  return svg;
}

export function iconPositionRight(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9L12 9C12.5523 9 13 8.55229 13 8C13 7.44772 12.5523 7 12 7L4 7ZM7 3C6.44772 3 6 3.44772 6 4C6 4.55228 6.44772 5 7 5L12 5C12.5523 5 13 4.55229 13 4C13 3.44772 12.5523 3 12 3L7 3ZM8 12C8 11.4477 8.44771 11 9 11L12 11C12.5523 11 13 11.4477 13 12C13 12.5523 12.5523 13 12 13L9 13C8.44771 13 8 12.5523 8 12Z',
    fill: color,
  }));
  return svg;
}

export function iconPositionTop(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M3 4C3 3.44772 3.44772 3 4 3C4.55228 3 5 3.44772 5 4V9C5 9.55228 4.55228 10 4 10C3.44772 10 3 9.55228 3 9V4ZM7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4ZM12 3C11.4477 3 11 3.44772 11 4V7C11 7.55228 11.4477 8 12 8C12.5523 8 13 7.55228 13 7V4C13 3.44772 12.5523 3 12 3Z',
    fill: color,
  }));
  return svg;
}

export function iconPositionCenterV(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4ZM3 6C3 5.44772 3.44772 5 4 5C4.55228 5 5 5.44772 5 6V10C5 10.5523 4.55228 11 4 11C3.44772 11 3 10.5523 3 10V6ZM12 6C11.4477 6 11 6.44772 11 7V9C11 9.55228 11.4477 10 12 10C12.5523 10 13 9.55228 13 9V7C13 6.44772 12.5523 6 12 6Z',
    fill: color,
  }));
  return svg;
}

export function iconPositionBottom(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4ZM3 7C3 6.44772 3.44772 6 4 6C4.55228 6 5 6.44772 5 7V12C5 12.5523 4.55228 13 4 13C3.44772 13 3 12.5523 3 12V7ZM12 8C11.4477 8 11 8.44772 11 9V12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12V9C13 8.44772 12.5523 8 12 8Z',
    fill: color,
  }));
  return svg;
}

// ===========================================================================
//  ALIGNMENT GRID - STRETCH BAR ICONS (lines 9824-9847)
// ===========================================================================

export function iconSBBarH(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    d: 'M12 7C12.5523 7 13 7.44772 13 8C13 8.55229 12.5523 9 12 9L4 9C3.44772 9 3 8.55228 3 8C3 7.44772 3.44771 7 4 7L12 7Z',
    fill: color,
  }));
  return svg;
}

export function iconSBBarHLeft(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    d: 'M4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9L8 9C8.55228 9 9 8.55229 9 8C9 7.44772 8.55228 7 8 7L4 7Z',
    fill: color,
  }));
  return svg;
}

export function iconSBBarHCenter(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    d: 'M6 7C5.44772 7 5 7.44772 5 8C5 8.55228 5.44772 9 6 9L10 9C10.5523 9 11 8.55228 11 8C11 7.44772 10.5523 7 10 7L6 7Z',
    fill: color,
  }));
  return svg;
}

export function iconSBBarHRight(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    d: 'M8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9L12 9C12.5523 9 13 8.55229 13 8C13 7.44772 12.5523 7 12 7L8 7Z',
    fill: color,
  }));
  return svg;
}

export function iconSBBarV(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    d: 'M7 4C7 3.44772 7.44772 3 8 3C8.55228 3 9 3.44772 9 4V12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12V4Z',
    fill: color,
  }));
  return svg;
}

export function iconSBBarVTop(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M8 3C7.44772 3 7 3.44772 7 4V8C7 8.55228 7.44772 9 8 9C8.55228 9 9 8.55228 9 8V4C9 3.44772 8.55228 3 8 3Z',
    fill: color,
  }));
  return svg;
}

export function iconSBBarVCenter(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M8 5C7.44772 5 7 5.44772 7 6V10C7 10.5523 7.44772 11 8 11C8.55228 11 9 10.5523 9 10V6C9 5.44772 8.55228 5 8 5Z',
    fill: color,
  }));
  return svg;
}

export function iconSBBarVBottom(size: number = 16, color: string = '#a8a29e'): SVGSVGElement {
  const svg = makeSvg(size, '0 0 16 16');
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M8 7C7.44772 7 7 7.44772 7 8V12C7 12.5523 7.44772 13 8 13C8.55228 13 9 12.5523 9 12V8C9 7.44772 8.55228 7 8 7Z',
    fill: color,
  }));
  return svg;
}

// ===========================================================================
//  ADDITIONAL LIST/VIEW ICONS (lines 8083-8091)
// ===========================================================================

export function listView(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M6 7C6 6.44772 6.44772 6 7 6C7.55228 6 8 6.44772 8 7C8 7.55228 7.55228 8 7 8C6.44772 8 6 7.55228 6 7ZM10.5 6.5C10.2239 6.5 10 6.72386 10 7C10 7.27614 10.2239 7.5 10.5 7.5H17.5C17.7761 7.5 18 7.27614 18 7C18 6.72386 17.7761 6.5 17.5 6.5H10.5ZM10.5 16.5C10.2239 16.5 10 16.7239 10 17C10 17.2761 10.2239 17.5 10.5 17.5H17.5C17.7761 17.5 18 17.2761 18 17C18 16.7239 17.7761 16.5 17.5 16.5H10.5ZM10.5 11.5C10.2239 11.5 10 11.7239 10 12C10 12.2761 10.2239 12.5 10.5 12.5H17.5C17.7761 12.5 18 12.2761 18 12C18 11.7239 17.7761 11.5 17.5 11.5H10.5ZM6 12C6 11.4477 6.44772 11 7 11C7.55228 11 8 11.4477 8 12C8 12.5523 7.55228 13 7 13C6.44772 13 6 12.5523 6 12ZM7 16C6.44772 16 6 16.4477 6 17C6 17.5523 6.44772 18 7 18C7.55228 18 8 17.5523 8 17C8 16.4477 7.55228 16 7 16Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function numberList(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M11 7C11 6.72386 11.2238 6.5 11.5 6.5H17.5C17.7761 6.5 18 6.72386 18 7C18 7.27614 17.7761 7.5 17.5 7.5H11.5C11.2238 7.5 11 7.27614 11 7ZM6 7.00001C6 6.72387 6.22386 6.50001 6.5 6.50001H7.5C7.77614 6.50001 8 6.72387 8 7.00001V10.5C8 10.7762 7.77614 11 7.5 11C7.22386 11 7 10.7762 7 10.5V7.50001H6.5C6.22386 7.50001 6 7.27616 6 7.00001ZM6 13.5C6 13.2239 6.22386 13 6.5 13H8.5C8.77614 13 9 13.2239 9 13.5V15C9 15.1894 8.893 15.3625 8.72361 15.4472L7 16.309V16.5H8.5C8.77614 16.5 9 16.7239 9 17C9 17.2762 8.77614 17.5 8.5 17.5H6.5C6.22386 17.5 6 17.2762 6 17V16C6 15.8106 6.107 15.6375 6.27639 15.5528L8 14.691V14H6.5C6.22386 14 6 13.7762 6 13.5ZM11.5 16.5C11.2238 16.5 11 16.7239 11 17C11 17.2761 11.2238 17.5 11.5 17.5H17.5C17.7761 17.5 18 17.2761 18 17C18 16.7239 17.7761 16.5 17.5 16.5H11.5ZM11.5 11.5C11.2238 11.5 11 11.7239 11 12C11 12.2761 11.2238 12.5 11.5 12.5H17.5C17.7761 12.5 18 12.2761 18 12C18 11.7239 17.7761 11.5 17.5 11.5H11.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

// ===========================================================================
//  VERTICAL TEXT ALIGNMENT ICONS (lines 8041-8048)
// ===========================================================================

export function textAlignTop(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M5.5 5C5.22386 5 5 5.22386 5 5.5C5 5.77614 5.22386 6 5.5 6H17.5C17.7761 6 18 5.77614 18 5.5C18 5.22386 17.7761 5 17.5 5H5.5ZM11.8536 7.14645C11.6583 6.95118 11.3417 6.95118 11.1464 7.14645L8.14645 10.1464C7.95118 10.3417 7.95118 10.6583 8.14645 10.8536C8.34171 11.0488 8.65829 11.0488 8.85355 10.8536L11 8.70711V16.5C11 16.7761 11.2239 17 11.5 17C11.7761 17 12 16.7761 12 16.5V8.70711L14.1464 10.8536C14.3417 11.0488 14.6583 11.0488 14.8536 10.8536C15.0488 10.6583 15.0488 10.3417 14.8536 10.1464L11.8536 7.14645Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function textAlignMiddle(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M11.8536 9.85355L13.8536 7.85355C14.0488 7.65829 14.0488 7.34171 13.8536 7.14645C13.6583 6.95118 13.3417 6.95118 13.1464 7.14645L12 8.29289V4.5C12 4.22386 11.7761 4 11.5 4C11.2239 4 11 4.22386 11 4.5V8.29289L9.85355 7.14645C9.65829 6.95118 9.34171 6.95118 9.14645 7.14645C8.95118 7.34171 8.95118 7.65829 9.14645 7.85355L11.1464 9.85355C11.3417 10.0488 11.6583 10.0488 11.8536 9.85355ZM11.8536 13.1464L13.8536 15.1464C14.0488 15.3417 14.0488 15.6583 13.8536 15.8536C13.6583 16.0488 13.3417 16.0488 13.1464 15.8536L12 14.7071V18.5C12 18.7761 11.7761 19 11.5 19C11.2239 19 11 18.7761 11 18.5V14.7071L9.85355 15.8536C9.65829 16.0488 9.34171 16.0488 9.14645 15.8536C8.95118 15.6583 8.95118 15.3417 9.14645 15.1464L11.1464 13.1464C11.3417 12.9512 11.6583 12.9512 11.8536 13.1464ZM5.5 11C5.22386 11 5 11.2239 5 11.5C5 11.7761 5.22386 12 5.5 12H17.5C17.7761 12 18 11.7761 18 11.5C18 11.2239 17.7761 11 17.5 11H5.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}

export function textAlignBottom(size: number = 24): SVGSVGElement {
  const svg = makeSvg(size);
  svg.appendChild(makePath({
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M14.8536 13.8536L11.8536 16.8536C11.6583 17.0488 11.3417 17.0488 11.1464 16.8536L8.14645 13.8536C7.95118 13.6583 7.95118 13.3417 8.14645 13.1464C8.34171 12.9512 8.65829 12.9512 8.85355 13.1464L11 15.2929V7.5C11 7.22386 11.2239 7 11.5 7C11.7761 7 12 7.22386 12 7.5V15.2929L14.1464 13.1464C14.3417 12.9512 14.6583 12.9512 14.8536 13.1464C15.0488 13.3417 15.0488 13.6583 14.8536 13.8536ZM5.5 19C5.22386 19 5 18.7761 5 18.5C5 18.2239 5.22386 18 5.5 18H17.5C17.7761 18 18 18.2239 18 18.5C18 18.7761 17.7761 19 17.5 19H5.5Z',
    fill: 'currentColor',
    'fill-opacity': '0.9',
  }));
  return svg;
}
