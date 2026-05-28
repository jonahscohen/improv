export type ControlGroup = 'box' | 'typography' | 'flex' | 'grid' | 'image' | 'position';

export interface ControlDefinition {
  property: string;
  label: string;
  type: 'number' | 'color' | 'select' | 'toggle';
  unit?: string;
  options?: string[];
  step?: number;
}

export interface DetectedControls {
  groups: { name: ControlGroup; controls: ControlDefinition[] }[];
}

export const BOX_CONTROLS: ControlDefinition[] = [
  { property: 'padding-top', label: 'Padding Top', type: 'number', unit: 'px' },
  { property: 'padding-right', label: 'Padding Right', type: 'number', unit: 'px' },
  { property: 'padding-bottom', label: 'Padding Bottom', type: 'number', unit: 'px' },
  { property: 'padding-left', label: 'Padding Left', type: 'number', unit: 'px' },
  { property: 'margin-top', label: 'Margin Top', type: 'number', unit: 'px' },
  { property: 'margin-right', label: 'Margin Right', type: 'number', unit: 'px' },
  { property: 'margin-bottom', label: 'Margin Bottom', type: 'number', unit: 'px' },
  { property: 'margin-left', label: 'Margin Left', type: 'number', unit: 'px' },
  { property: 'border-top-left-radius', label: 'Radius TL', type: 'number', unit: 'px' },
  { property: 'border-top-right-radius', label: 'Radius TR', type: 'number', unit: 'px' },
  { property: 'border-bottom-right-radius', label: 'Radius BR', type: 'number', unit: 'px' },
  { property: 'border-bottom-left-radius', label: 'Radius BL', type: 'number', unit: 'px' },
  { property: 'background-color', label: 'Background', type: 'color' },
  { property: 'opacity', label: 'Opacity', type: 'number', step: 0.05 },
  { property: 'box-shadow', label: 'Box Shadow', type: 'number' },
  { property: 'z-index', label: 'Z-Index', type: 'number', step: 1 },
];

export const TYPOGRAPHY_CONTROLS: ControlDefinition[] = [
  { property: 'font-size', label: 'Font Size', type: 'number', unit: 'px' },
  {
    property: 'font-weight',
    label: 'Font Weight',
    type: 'select',
    options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  },
  { property: 'line-height', label: 'Line Height', type: 'number', step: 0.1 },
  { property: 'letter-spacing', label: 'Letter Spacing', type: 'number', unit: 'px', step: 0.1 },
  { property: 'color', label: 'Color', type: 'color' },
  {
    property: 'text-align',
    label: 'Text Align',
    type: 'select',
    options: ['left', 'center', 'right', 'justify'],
  },
];

export const FLEX_CONTROLS: ControlDefinition[] = [
  {
    property: 'flex-direction',
    label: 'Direction',
    type: 'select',
    options: ['row', 'row-reverse', 'column', 'column-reverse'],
  },
  { property: 'gap', label: 'Gap', type: 'number', unit: 'px' },
  {
    property: 'align-items',
    label: 'Align Items',
    type: 'select',
    options: ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
  },
  {
    property: 'justify-content',
    label: 'Justify Content',
    type: 'select',
    options: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
  },
  {
    property: 'flex-wrap',
    label: 'Flex Wrap',
    type: 'select',
    options: ['nowrap', 'wrap', 'wrap-reverse'],
  },
];

export const GRID_CONTROLS: ControlDefinition[] = [
  { property: 'grid-template-columns', label: 'Columns', type: 'number' },
  { property: 'grid-template-rows', label: 'Rows', type: 'number' },
  { property: 'gap', label: 'Gap', type: 'number', unit: 'px' },
];

export const IMAGE_CONTROLS: ControlDefinition[] = [
  {
    property: 'object-fit',
    label: 'Object Fit',
    type: 'select',
    options: ['fill', 'contain', 'cover', 'none', 'scale-down'],
  },
  {
    property: 'object-position',
    label: 'Object Position',
    type: 'select',
    options: ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'],
  },
  { property: 'aspect-ratio', label: 'Aspect Ratio', type: 'number', step: 0.1 },
];

export const POSITION_CONTROLS: ControlDefinition[] = [
  { property: 'top', label: 'Top', type: 'number', unit: 'px' },
  { property: 'right', label: 'Right', type: 'number', unit: 'px' },
  { property: 'bottom', label: 'Bottom', type: 'number', unit: 'px' },
  { property: 'left', label: 'Left', type: 'number', unit: 'px' },
  { property: 'z-index', label: 'Z-Index', type: 'number', step: 1 },
];

const TEXT_TAGS = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'P', 'SPAN', 'A', 'BUTTON', 'LABEL',
  'LI', 'TD', 'TH', 'CAPTION', 'FIGCAPTION',
  'BLOCKQUOTE', 'CITE', 'CODE', 'EM', 'STRONG',
  'SMALL', 'SUB', 'SUP', 'TIME', 'MARK',
  'DT', 'DD', 'LEGEND', 'SUMMARY',
]);

function hasDirectText(element: HTMLElement): boolean {
  if (TEXT_TAGS.has(element.tagName)) return true;
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim().length) {
      return true;
    }
  }
  return false;
}

export function detectControls(element: HTMLElement): DetectedControls {
  const computed = getComputedStyle(element);
  const groups: { name: ControlGroup; controls: ControlDefinition[] }[] = [];

  groups.push({ name: 'box', controls: BOX_CONTROLS });

  if (hasDirectText(element)) {
    groups.push({ name: 'typography', controls: TYPOGRAPHY_CONTROLS });
  }

  const display = computed.display;
  if (display === 'flex' || display === 'inline-flex') {
    groups.push({ name: 'flex', controls: FLEX_CONTROLS });
  } else if (display === 'grid' || display === 'inline-grid') {
    groups.push({ name: 'grid', controls: GRID_CONTROLS });
  }

  const tag = element.tagName;
  if (tag === 'IMG' || tag === 'VIDEO' || tag === 'PICTURE') {
    groups.push({ name: 'image', controls: IMAGE_CONTROLS });
  }

  const position = computed.position;
  if (position === 'absolute' || position === 'fixed' || position === 'relative' || position === 'sticky') {
    groups.push({ name: 'position', controls: POSITION_CONTROLS });
  }

  return { groups };
}
