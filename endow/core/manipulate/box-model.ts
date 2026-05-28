function parsePx(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function fmtVal(val: string): string {
  const n = parsePx(val);
  return String(Math.round(n));
}

type BoxValues = {
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  width: string;
  height: string;
};

function extractValues(computedStyles: Record<string, string>): BoxValues {
  function get(key: string): string {
    return computedStyles[key] ?? '0px';
  }
  return {
    marginTop: get('marginTop'),
    marginRight: get('marginRight'),
    marginBottom: get('marginBottom'),
    marginLeft: get('marginLeft'),
    paddingTop: get('paddingTop'),
    paddingRight: get('paddingRight'),
    paddingBottom: get('paddingBottom'),
    paddingLeft: get('paddingLeft'),
    width: get('width'),
    height: get('height'),
  };
}

const MARGIN_BG = 'rgba(249, 115, 22, 0.15)';
const MARGIN_TEXT = '#f97316';
const PADDING_BG = 'rgba(34, 197, 94, 0.15)';
const PADDING_TEXT = '#22c55e';
const CONTENT_BG = 'rgba(59, 130, 246, 0.15)';
const CONTENT_TEXT = '#93c5fd';

function makeEdgeLabel(val: string, color: string, position: 'top' | 'bottom' | 'left' | 'right'): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'position: absolute',
    'font-size: 9px',
    'font-variant-numeric: tabular-nums',
    `color: ${color}`,
    'font-family: "EndowSans", system-ui, sans-serif',
    'pointer-events: none',
    'display: flex',
    'align-items: center',
    'justify-content: center',
  ].join(';');

  if (position === 'top') {
    el.style.top = '2px';
    el.style.left = '0';
    el.style.right = '0';
    el.style.height = '12px';
  } else if (position === 'bottom') {
    el.style.bottom = '2px';
    el.style.left = '0';
    el.style.right = '0';
    el.style.height = '12px';
  } else if (position === 'left') {
    el.style.left = '2px';
    el.style.top = '0';
    el.style.bottom = '0';
    el.style.width = '18px';
    el.style.writingMode = 'vertical-lr';
    el.style.transform = 'rotate(180deg)';
  } else if (position === 'right') {
    el.style.right = '2px';
    el.style.top = '0';
    el.style.bottom = '0';
    el.style.width = '18px';
    el.style.writingMode = 'vertical-lr';
  }

  el.textContent = fmtVal(val);
  return el;
}

export class BoxModel {
  private root: HTMLDivElement | null = null;
  private labels: Map<string, HTMLElement> = new Map();

  render(computedStyles: Record<string, string>): HTMLDivElement {
    const vals = extractValues(computedStyles);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'width: 180px',
      'height: 120px',
      'margin: 0 auto 12px',
      'position: relative',
      'box-sizing: border-box',
    ].join(';');

    // Margin layer (outermost)
    const marginLayer = document.createElement('div');
    marginLayer.style.cssText = [
      'position: absolute',
      'inset: 0',
      `background: ${MARGIN_BG}`,
      'border-radius: 3px',
    ].join(';');

    const mTop = makeEdgeLabel(vals.marginTop, MARGIN_TEXT, 'top');
    const mBottom = makeEdgeLabel(vals.marginBottom, MARGIN_TEXT, 'bottom');
    const mLeft = makeEdgeLabel(vals.marginLeft, MARGIN_TEXT, 'left');
    const mRight = makeEdgeLabel(vals.marginRight, MARGIN_TEXT, 'right');
    this.labels.set('marginTop', mTop);
    this.labels.set('marginBottom', mBottom);
    this.labels.set('marginLeft', mLeft);
    this.labels.set('marginRight', mRight);
    marginLayer.appendChild(mTop);
    marginLayer.appendChild(mBottom);
    marginLayer.appendChild(mLeft);
    marginLayer.appendChild(mRight);

    // Margin label
    const marginLabel = document.createElement('div');
    marginLabel.style.cssText = [
      'position: absolute',
      'top: 3px',
      'left: 5px',
      'font-size: 8px',
      `color: ${MARGIN_TEXT}`,
      'opacity: 0.7',
      'font-family: "EndowSans", system-ui, sans-serif',
    ].join(';');
    marginLabel.textContent = 'margin';
    marginLayer.appendChild(marginLabel);

    // Padding layer (inset from margin)
    const paddingLayer = document.createElement('div');
    paddingLayer.style.cssText = [
      'position: absolute',
      'inset: 16px',
      `background: ${PADDING_BG}`,
      'border-radius: 2px',
    ].join(';');

    const pTop = makeEdgeLabel(vals.paddingTop, PADDING_TEXT, 'top');
    const pBottom = makeEdgeLabel(vals.paddingBottom, PADDING_TEXT, 'bottom');
    const pLeft = makeEdgeLabel(vals.paddingLeft, PADDING_TEXT, 'left');
    const pRight = makeEdgeLabel(vals.paddingRight, PADDING_TEXT, 'right');
    this.labels.set('paddingTop', pTop);
    this.labels.set('paddingBottom', pBottom);
    this.labels.set('paddingLeft', pLeft);
    this.labels.set('paddingRight', pRight);
    paddingLayer.appendChild(pTop);
    paddingLayer.appendChild(pBottom);
    paddingLayer.appendChild(pLeft);
    paddingLayer.appendChild(pRight);

    // Padding label
    const paddingLabel = document.createElement('div');
    paddingLabel.style.cssText = [
      'position: absolute',
      'top: 3px',
      'left: 5px',
      'font-size: 8px',
      `color: ${PADDING_TEXT}`,
      'opacity: 0.7',
      'font-family: "EndowSans", system-ui, sans-serif',
    ].join(';');
    paddingLabel.textContent = 'padding';
    paddingLayer.appendChild(paddingLabel);

    // Content layer (innermost)
    const contentLayer = document.createElement('div');
    contentLayer.style.cssText = [
      'position: absolute',
      'inset: 20px',
      `background: ${CONTENT_BG}`,
      'border-radius: 2px',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'gap: 2px',
    ].join(';');

    const contentW = document.createElement('span');
    contentW.style.cssText = `font-size: 9px; color: ${CONTENT_TEXT}; font-variant-numeric: tabular-nums; font-family: "EndowSans", system-ui, sans-serif;`;
    contentW.textContent = fmtVal(vals.width);
    this.labels.set('width', contentW);

    const contentX = document.createElement('span');
    contentX.style.cssText = `font-size: 9px; color: ${CONTENT_TEXT}; opacity: 0.5; font-family: "EndowSans", system-ui, sans-serif;`;
    contentX.textContent = 'x';

    const contentH = document.createElement('span');
    contentH.style.cssText = `font-size: 9px; color: ${CONTENT_TEXT}; font-variant-numeric: tabular-nums; font-family: "EndowSans", system-ui, sans-serif;`;
    contentH.textContent = fmtVal(vals.height);
    this.labels.set('height', contentH);

    contentLayer.appendChild(contentW);
    contentLayer.appendChild(contentX);
    contentLayer.appendChild(contentH);

    paddingLayer.appendChild(contentLayer);
    marginLayer.appendChild(paddingLayer);
    wrapper.appendChild(marginLayer);

    this.root = wrapper;
    return wrapper;
  }

  update(computedStyles: Record<string, string>): void {
    const vals = extractValues(computedStyles);

    const set = (key: string, val: string) => {
      const el = this.labels.get(key);
      if (el) el.textContent = fmtVal(val);
    };

    set('marginTop', vals.marginTop);
    set('marginBottom', vals.marginBottom);
    set('marginLeft', vals.marginLeft);
    set('marginRight', vals.marginRight);
    set('paddingTop', vals.paddingTop);
    set('paddingBottom', vals.paddingBottom);
    set('paddingLeft', vals.paddingLeft);
    set('paddingRight', vals.paddingRight);
    set('width', vals.width);
    set('height', vals.height);
  }

  getRoot(): HTMLDivElement | null {
    return this.root;
  }
}
