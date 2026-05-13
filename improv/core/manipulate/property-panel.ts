import { attachScrub, parseNumericValue, formatNumericValue } from './scrub.js';
import type { DetectedControls } from './control-detector.js';
import {
  radiusTopLeft,
  alPaddingHorizontal,
  alPaddingVertical,
  alPaddingSides,
  alSpacingHorizontal,
  layoutAlignLeft,
  layoutAlignRight,
  layoutAlignHorizontalCenter,
  layoutAlignTop,
  layoutAlignBottom,
  layoutAlignVerticalCenter,
  textAlignLeft,
  textAlignCenter,
  textAlignRight,
  textAlignTop,
  textAlignMiddle,
  textAlignBottom,
  rectangleSmall,
  autolayoutAddHorizontal,
  autolayoutAddVertical,
  gridView,
  chevronDown,
  plus,
  lockClosed,
  lockOpen,
  iconDot,
  iconPositionLeft,
  iconPositionCenterH,
  iconPositionRight,
  iconPositionTop,
  iconPositionCenterV,
  iconPositionBottom,
} from './icons.js';

type PropertyChangeCallback = (property: string, value: string) => void;
type ElementSelectCallback = (element: HTMLElement) => void;

function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/);
  if (!match) return '#000000';
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function normalizeColor(val: string): string {
  if (!val || val === 'transparent') return '#000000';
  if (val.startsWith('rgb')) return rgbToHex(val);
  if (val.startsWith('#')) {
    return val.length === 4
      ? '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3]
      : val;
  }
  return '#000000';
}

function parseFloatSafe(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function extractOpacityPercent(val: string): number {
  const match = val.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  return match ? Math.round(parseFloat(match[1]) * 100) : 100;
}

function parseShadow(val: string): { inset: boolean; x: number; y: number; blur: number; spread: number; color: string } | null {
  if (!val || val === 'none') return null;
  const inset = val.includes('inset');
  const cleaned = val.replace('inset', '').trim();
  const colorMatch = cleaned.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
  const color = colorMatch ? colorMatch[1] : 'rgba(0,0,0,0.15)';
  const nums = cleaned.replace(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/, '').trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
  return {
    inset,
    x: nums[0] ?? 0,
    y: nums[1] ?? 0,
    blur: nums[2] ?? 0,
    spread: nums[3] ?? 0,
    color,
  };
}

function formatShadow(s: { inset: boolean; x: number; y: number; blur: number; spread: number; color: string }): string {
  const parts: string[] = [];
  if (s.inset) parts.push('inset');
  parts.push(s.x + 'px', s.y + 'px', s.blur + 'px', s.spread + 'px', s.color);
  return parts.join(' ');
}

function parseFilters(val: string): { type: string; value: number; unit: string }[] {
  if (!val || val === 'none') return [];
  const regex = /(\w[\w-]*)\(([^)]+)\)/g;
  const results: { type: string; value: number; unit: string }[] = [];
  let m;
  while ((m = regex.exec(val)) !== null) {
    const type = m[1];
    const raw = m[2].trim();
    const num = parseFloat(raw);
    const unit = raw.replace(String(num), '').trim() || '';
    results.push({ type, value: isNaN(num) ? 0 : num, unit });
  }
  return results;
}

function formatFilters(filters: { type: string; value: number; unit: string }[]): string {
  if (filters.length === 0) return 'none';
  return filters.map(f => f.type + '(' + f.value + f.unit + ')').join(' ');
}

function toCamelCase(prop: string): string {
  return prop.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
}

function getVal(styles: Record<string, string>, prop: string): string {
  const camel = toCamelCase(prop);
  return styles[camel] ?? styles[prop] ?? '';
}

interface TreeNode {
  element: HTMLElement;
  depth: number;
  children: TreeNode[];
  expanded: boolean;
  tagName: string;
  displayName: string;
  isComponent: boolean;
}

const cssVars = {
  surface: '--improv-surface',
  surfaceHover: '--improv-surface-hover',
  text: '--improv-text',
  textSecondary: '--improv-text-secondary',
  textTertiary: '--improv-text-tertiary',
  border: '--improv-border',
  inputBg: '--improv-input-bg',
  blueBg: '--improv-blue-bg',
  blueText: '--improv-blue-text',
  blue500: '--improv-blue-500',
  surfaceActive: '--improv-surface-active',
  black: '--improv-black',
  white: '--improv-white',
};

const darkTheme: Record<string, string> = {
  [cssVars.surface]: 'color-mix(in srgb, #1c1917 95%, #ffffff)',
  [cssVars.surfaceHover]: 'color-mix(in srgb, #ffffff 5%, transparent)',
  [cssVars.text]: 'color-mix(in srgb, #ffffff 90%, transparent)',
  [cssVars.textSecondary]: 'color-mix(in srgb, #ffffff 70%, transparent)',
  [cssVars.textTertiary]: 'color-mix(in srgb, #ffffff 50%, transparent)',
  [cssVars.border]: 'color-mix(in srgb, #ffffff 10%, transparent)',
  [cssVars.inputBg]: 'color-mix(in srgb, #ffffff 5%, transparent)',
  [cssVars.blueBg]: 'color-mix(in srgb, #0768CF 50%, transparent)',
  [cssVars.blueText]: '#0D99FF',
  [cssVars.blue500]: '#0D99FF',
  [cssVars.surfaceActive]: 'color-mix(in srgb, #ffffff 5%, transparent)',
  [cssVars.black]: '#1c1917',
  [cssVars.white]: '#ffffff',
};

const PANEL_WIDTH = 280;
const FONT_FAMILY = 'system-ui, -apple-system, sans-serif';
const EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

function v(cssVar: string): string {
  return `var(${cssVar})`;
}

export class PropertyPanel {
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private cleanups: Array<() => void> = [];
  private changeCallback: PropertyChangeCallback | null = null;
  private selectCallback: ElementSelectCallback | null = null;
  private activeTab: string = 'design';
  private tabContentEl: HTMLDivElement | null = null;
  private controls: DetectedControls | null = null;
  private computedStyles: Record<string, string> = {};
  private originalValues: Record<string, string> = {};
  private selectedElement: HTMLElement | null = null;
  private treeRoot: TreeNode | null = null;

  constructor(shadow: ShadowRoot) {
    this.shadow = shadow;
    this.container = document.createElement('div');
    this.applyContainerStyles();
    this.shadow.appendChild(this.container);
  }

  private applyContainerStyles(): void {
    for (const [k, val] of Object.entries(darkTheme)) {
      this.container.style.setProperty(k, val);
    }
    Object.assign(this.container.style, {
      position: 'fixed',
      right: '16px',
      bottom: '68px',
      width: PANEL_WIDTH + 'px',
      maxHeight: 'calc(100vh - 84px)',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      background: v(cssVars.surface),
      borderRadius: '16px',
      border: '1px solid ' + v(cssVars.border),
      boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.04)',
      pointerEvents: 'auto',
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: v(cssVars.text),
      zIndex: '2147483647',
      opacity: '0',
      transform: 'translateY(12px)',
    });
    requestAnimationFrame(() => {
      this.container.style.transition = 'opacity 150ms ' + EASING + ', transform 150ms ' + EASING;
      this.container.style.opacity = '1';
      this.container.style.transform = 'translateY(0)';
    });
    const style = document.createElement('style');
    style.textContent = `:host ::-webkit-scrollbar { display: none; }
.improv-pp-panel::-webkit-scrollbar { display: none; }`;
    this.shadow.appendChild(style);
    this.container.classList.add('improv-pp-panel');
  }

  render(controls: DetectedControls, computedStyles: Record<string, string>): void {
    this.cleanup();
    this.clearContainer();
    this.controls = controls;
    this.computedStyles = computedStyles;
    this.originalValues = {};
    for (const k of Object.keys(computedStyles)) this.originalValues[k] = computedStyles[k];
    this.treeRoot = this.buildTree(document.body, 0);
    this.buildTabBar();
    this.tabContentEl = document.createElement('div');
    this.container.appendChild(this.tabContentEl);
    this.renderTabContent();
  }

  onPropertyChange(cb: PropertyChangeCallback): void {
    this.changeCallback = cb;
  }

  onElementSelect(cb: ElementSelectCallback): void {
    this.selectCallback = cb;
  }

  show(): void {
    this.container.style.display = '';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  destroy(): void {
    this.cleanup();
    this.changeCallback = null;
    this.selectCallback = null;
    this.controls = null;
    this.treeRoot = null;
    if (this.shadow.contains(this.container)) this.shadow.removeChild(this.container);
  }

  private cleanup(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
  }

  private clearContainer(): void {
    while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
  }

  // ---------------------------------------------------------------------------
  // Tab bar
  // ---------------------------------------------------------------------------

  private buildTabBar(): void {
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      display: 'flex',
      alignItems: 'center',
      padding: '8px',
      borderBottom: '1px solid ' + v(cssVars.border),
      position: 'relative',
    });

    const pill = document.createElement('div');
    Object.assign(pill.style, {
      position: 'absolute',
      top: '8px',
      height: 'calc(100% - 16px)',
      background: v(cssVars.inputBg),
      borderRadius: '8px',
      transition: 'transform 0.2s ' + EASING + ', width 0.2s ' + EASING,
      pointerEvents: 'none',
    });
    bar.appendChild(pill);

    const buttons: HTMLButtonElement[] = [];
    const tabs = [
      { label: 'Elements', id: 'elements' },
      { label: 'Design', id: 'design' },
    ];

    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      const isActive = this.activeTab === tab.id;
      Object.assign(btn.style, {
        background: 'none',
        border: 'none',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: '500',
        fontFamily: FONT_FAMILY,
        color: v(isActive ? cssVars.text : cssVars.textTertiary),
        cursor: 'pointer',
        position: 'relative',
        zIndex: '1',
        transition: 'color 150ms ' + EASING,
      });
      const onClick = () => {
        this.activeTab = tab.id;
        for (let i = 0; i < buttons.length; i++) {
          const b = buttons[i];
          b.style.color = tabs[i].id === tab.id ? v(cssVars.text) : v(cssVars.textTertiary);
        }
        this.updatePillPosition(pill, buttons, tabs);
        this.renderTabContent();
      };
      btn.addEventListener('click', onClick);
      this.cleanups.push(() => btn.removeEventListener('click', onClick));
      buttons.push(btn);
      bar.appendChild(btn);
    }

    const version = document.createElement('span');
    version.textContent = 'v0.1';
    Object.assign(version.style, {
      fontSize: '11px',
      color: v(cssVars.textTertiary),
      marginLeft: 'auto',
      paddingRight: '8px',
      flexShrink: '0',
    });
    bar.appendChild(version);
    this.container.appendChild(bar);
    requestAnimationFrame(() => {
      this.updatePillPosition(pill, buttons, tabs);
    });
  }

  private updatePillPosition(pill: HTMLDivElement, buttons: HTMLButtonElement[], tabs: { id: string }[]): void {
    const idx = tabs.findIndex(t => t.id === this.activeTab);
    if (idx < 0 || !buttons[idx]) return;
    const btn = buttons[idx];
    const parent = btn.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const offset = btnRect.left - parentRect.left;
    pill.style.width = btnRect.width + 'px';
    pill.style.transform = 'translateX(' + offset + 'px)';
  }

  private renderTabContent(): void {
    if (this.tabContentEl) {
      while (this.tabContentEl.firstChild) this.tabContentEl.removeChild(this.tabContentEl.firstChild);
      this.activeTab === 'design' ? this.buildDesignTab(this.tabContentEl) : this.buildElementsTab(this.tabContentEl);
    }
  }

  // ---------------------------------------------------------------------------
  // Elements tab - DOM tree
  // ---------------------------------------------------------------------------

  private buildTree(el: HTMLElement, depth: number): TreeNode {
    const tagName = el.tagName.toLowerCase();
    const isComponent = this.isFrameworkComponent(el);
    const displayName = this.getNodeDisplayName(el);
    const node: TreeNode = {
      element: el,
      depth,
      children: [],
      expanded: depth < 2,
      tagName,
      displayName,
      isComponent,
    };
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i] as HTMLElement;
      if (!child || child.nodeType !== 1 || child.tagName === 'IMPROV-PANEL' || child.classList.contains('improv-pp-panel')) continue;
      const tag = child.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      node.children.push(this.buildTree(child, depth + 1));
    }
    return node;
  }

  private isFrameworkComponent(el: HTMLElement): boolean {
    for (const attr of el.getAttributeNames()) {
      if (attr.startsWith('data-reactroot') || attr.startsWith('data-v-') || attr.startsWith('data-svelte')) return true;
    }
    return !!el.tagName.includes('-');
  }

  private getNodeDisplayName(el: HTMLElement): string {
    if (el.className && typeof el.className === 'string') {
      const first = el.className.split(/\s+/)[0];
      if (first && first.length < 30) return '.' + first;
    }
    if (el.id) return '#' + el.id;
    const text = el.textContent?.trim();
    if (text && text.length > 0) {
      const trunc = text.length > 30 ? text.substring(0, 27) + '...' : text;
      let hasDirect = false;
      for (const c of el.childNodes) {
        if (c.nodeType === 3 && c.textContent?.trim()) {
          hasDirect = true;
          break;
        }
      }
      if (hasDirect) return trunc;
    }
    return el.tagName.toLowerCase();
  }

  private buildElementsTab(parent: HTMLDivElement): void {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      padding: '4px 0',
      overflowX: 'auto',
    });
    if (this.treeRoot) this.renderTreeNode(wrapper, this.treeRoot);
    parent.appendChild(wrapper);
  }

  private renderTreeNode(parent: HTMLElement, node: TreeNode): void {
    const row = document.createElement('div');
    const padLeft = node.depth * 20 + 12;
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      height: '32px',
      paddingLeft: padLeft + 'px',
      paddingRight: '8px',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background 0.12s',
    });

    const isSelected = node.element === this.selectedElement;
    if (isSelected) row.style.background = v(cssVars.blueBg);

    const onEnter = () => {
      if (!isSelected) row.style.background = v(cssVars.surfaceHover);
    };
    const onLeave = () => {
      if (!isSelected) row.style.background = 'transparent';
    };
    row.addEventListener('mouseenter', onEnter);
    row.addEventListener('mouseleave', onLeave);
    this.cleanups.push(() => {
      row.removeEventListener('mouseenter', onEnter);
      row.removeEventListener('mouseleave', onLeave);
    });

    // Chevron wrapper
    const chevWrap = document.createElement('div');
    Object.assign(chevWrap.style, {
      width: '16px',
      height: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      marginRight: '4px',
    });
    if (node.children.length > 0) {
      const chev = chevronDown(16);
      Object.assign(chev.style, {
        transition: 'transform 0.12s',
        transform: node.expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
        color: v(cssVars.textTertiary),
      });
      chevWrap.appendChild(chev);
      const onChev = (e: Event) => {
        e.stopPropagation();
        node.expanded = !node.expanded;
        chev.style.transform = node.expanded ? 'rotate(0deg)' : 'rotate(-90deg)';
        const next = row.nextElementSibling as HTMLElement | null;
        if (next && next.dataset.treeChildren === 'true') {
          next.style.display = node.expanded ? 'block' : 'none';
        }
      };
      chevWrap.addEventListener('click', onChev);
      chevWrap.style.cursor = 'pointer';
      this.cleanups.push(() => chevWrap.removeEventListener('click', onChev));
    }
    row.appendChild(chevWrap);

    // Dot indicator
    const dotWrap = document.createElement('div');
    Object.assign(dotWrap.style, {
      width: '16px',
      height: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      marginRight: '6px',
      color: node.isComponent ? v(cssVars.blueText) : v(cssVars.textTertiary),
    });
    const dot = document.createElement('div');
    Object.assign(dot.style, {
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      background: 'currentColor',
    });
    dotWrap.appendChild(dot);
    row.appendChild(dotWrap);

    // Label
    const label = document.createElement('span');
    label.textContent = node.displayName;
    Object.assign(label.style, {
      fontSize: '13px',
      fontWeight: '400',
      color: v(cssVars.text),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: '1',
      minWidth: '0',
    });
    row.appendChild(label);

    // Click handler
    const onRowClick = () => {
      this.selectedElement = node.element;
      this.selectCallback?.(node.element);
      if (this.tabContentEl) this.renderTabContent();
    };
    row.addEventListener('click', onRowClick);
    this.cleanups.push(() => row.removeEventListener('click', onRowClick));
    parent.appendChild(row);

    // Children
    if (node.children.length > 0) {
      const childWrap = document.createElement('div');
      childWrap.dataset.treeChildren = 'true';
      childWrap.style.display = node.expanded ? 'block' : 'none';
      for (const child of node.children) this.renderTreeNode(childWrap, child);
      parent.appendChild(childWrap);
    }
  }

  // ---------------------------------------------------------------------------
  // Design tab - sections
  // ---------------------------------------------------------------------------

  private buildDesignTab(parent: HTMLElement): void {
    if (!this.controls) return;
    const t = this.computedStyles;
    const names = new Set(this.controls.groups.map(g => g.name));
    const hasTypo = names.has('typography');
    const hasFlex = names.has('flex');
    const hasGrid = names.has('grid');
    const tag = this.getElementTag();
    this.buildElementTagSection(parent, tag);
    this.buildPositionSection(parent, t);
    this.buildLayoutSection(parent, t, hasFlex, hasGrid);
    this.buildSpacingSection(parent, t);
    this.buildSizeSection(parent, t);
    if (hasTypo) this.buildTypographySection(parent, t);
    this.buildAppearanceSection(parent, t);
    this.buildFillSection(parent, t);
    this.buildBorderSection(parent, t);
    this.buildShadowSection(parent, t);
    this.buildFiltersSection(parent, t);
  }

  private getElementTag(): string {
    if (!this.controls) return 'div';
    const names = new Set(this.controls.groups.map(g => g.name));
    if (names.has('image')) return 'img';
    if (names.has('typography')) {
      const fs = parseFloatSafe(getVal(this.computedStyles, 'font-size'));
      return fs >= 28 ? 'h1' : fs >= 22 ? 'h2' : fs >= 18 ? 'h3' : 'p';
    }
    if (names.has('flex') || names.has('grid')) {
      // intentional fall-through to return 'div'
    }
    return 'div';
  }

  // ---------------------------------------------------------------------------
  // Element tag section
  // ---------------------------------------------------------------------------

  private buildElementTagSection(parent: HTMLElement, tag: string): void {
    const section = this.createSection();
    const header = this.makeSectionHeader(tag);
    section.appendChild(header);
    const body = this.makeSectionBody();

    const targetRow = this.makeSectionRow();
    const targetLabel = this.makeGroupLabelInline('Target');
    targetRow.appendChild(targetLabel);
    const pillWrap = document.createElement('div');
    Object.assign(pillWrap.style, {
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap',
    });
    const pill = this.makeSelectorPill('This instance', true);
    pillWrap.appendChild(pill);
    targetRow.appendChild(pillWrap);
    body.appendChild(targetRow);

    const triggerRow = this.makeSectionRow();
    const triggerLabel = this.makeGroupLabelInline('Trigger');
    triggerRow.appendChild(triggerLabel);
    const triggerSelect = this.makeSelectControl(['None', 'Hover', 'Focus', 'Active'], 'None', (_val) => {});
    triggerRow.appendChild(triggerSelect);
    body.appendChild(triggerRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Position section
  // ---------------------------------------------------------------------------

  private buildPositionSection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const header = this.makeSectionHeader('Position');
    section.appendChild(header);
    const body = this.makeSectionBody();

    // Alignment row
    const alignRow = this.makeSectionRow();
    const alignCol = document.createElement('div');
    Object.assign(alignCol.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      flex: '1',
      minWidth: '0',
    });
    alignCol.appendChild(this.makeFieldLabel('Alignment'));

    const alignBtnRow = document.createElement('div');
    Object.assign(alignBtnRow.style, { display: 'flex', gap: '8px' });

    const pos = getVal(t, 'position') || 'static';
    const disp = getVal(t, 'display') || 'block';
    const fd = getVal(t, 'flex-direction') || 'row';

    const isAbsFixed = pos === 'absolute' || pos === 'fixed';
    const isGrid = disp === 'grid' || disp === 'inline-grid';
    const isFlexCol = (disp === 'flex' || disp === 'inline-flex') && fd.includes('column');
    const isFlexRow = (disp === 'flex' || disp === 'inline-flex') && !fd.includes('column');
    const hEnabled = isAbsFixed || isGrid || isFlexCol;
    const vEnabled = isAbsFixed || isGrid || isFlexRow;

    // Horizontal align group
    const hGroup = document.createElement('div');
    Object.assign(hGroup.style, {
      flex: '1',
      display: 'flex',
      background: v(cssVars.surfaceHover),
      borderRadius: '8px',
      overflow: 'hidden',
      opacity: hEnabled ? '1' : '0.3',
      pointerEvents: hEnabled ? 'auto' : 'none',
    });
    const hItems = [
      { icon: () => layoutAlignLeft(24), value: 'left' },
      { icon: () => layoutAlignHorizontalCenter(24), value: 'center' },
      { icon: () => layoutAlignRight(24), value: 'right' },
    ];
    for (let i = 0; i < hItems.length; i++) {
      const item = hItems[i];
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        flex: '1',
        height: '32px',
        border: 'none',
        background: 'transparent',
        color: v(cssVars.text),
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        transition: 'background 0.15s ease',
      });
      if (i > 0) btn.style.boxShadow = 'inset 1px 0 0 ' + v(cssVars.surface);
      btn.appendChild(item.icon());
      const onE = () => { btn.style.background = v(cssVars.border); };
      const onL = () => { btn.style.background = 'transparent'; };
      const onC = () => { this.emitChange('text-align', item.value); };
      btn.addEventListener('mouseenter', onE);
      btn.addEventListener('mouseleave', onL);
      btn.addEventListener('click', onC);
      this.cleanups.push(() => {
        btn.removeEventListener('mouseenter', onE);
        btn.removeEventListener('mouseleave', onL);
        btn.removeEventListener('click', onC);
      });
      hGroup.appendChild(btn);
    }

    // Vertical align group
    const vGroup = document.createElement('div');
    Object.assign(vGroup.style, {
      flex: '1',
      display: 'flex',
      background: v(cssVars.surfaceHover),
      borderRadius: '8px',
      overflow: 'hidden',
      opacity: vEnabled ? '1' : '0.3',
      pointerEvents: vEnabled ? 'auto' : 'none',
    });
    const vItems = [
      { icon: () => layoutAlignTop(24), value: 'flex-start' },
      { icon: () => layoutAlignVerticalCenter(24), value: 'center' },
      { icon: () => layoutAlignBottom(24), value: 'flex-end' },
    ];
    for (let i = 0; i < vItems.length; i++) {
      const item = vItems[i];
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        flex: '1',
        height: '32px',
        border: 'none',
        background: 'transparent',
        color: v(cssVars.text),
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        transition: 'background 0.15s ease',
      });
      if (i > 0) btn.style.boxShadow = 'inset 1px 0 0 ' + v(cssVars.surface);
      btn.appendChild(item.icon());
      const onE = () => { btn.style.background = v(cssVars.border); };
      const onL = () => { btn.style.background = 'transparent'; };
      const onC = () => { this.emitChange('align-items', item.value); };
      btn.addEventListener('mouseenter', onE);
      btn.addEventListener('mouseleave', onL);
      btn.addEventListener('click', onC);
      this.cleanups.push(() => {
        btn.removeEventListener('mouseenter', onE);
        btn.removeEventListener('mouseleave', onL);
        btn.removeEventListener('click', onC);
      });
      vGroup.appendChild(btn);
    }

    alignBtnRow.appendChild(hGroup);
    alignBtnRow.appendChild(vGroup);
    alignCol.appendChild(alignBtnRow);
    alignRow.appendChild(alignCol);
    body.appendChild(alignRow);

    // Type row
    const typeRow = this.makeSectionRow();
    const typeCol = document.createElement('div');
    Object.assign(typeCol.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      flex: '1',
      minWidth: '0',
    });
    typeCol.appendChild(this.makeFieldLabel('Type'));
    const typeSelect = this.makeSelectControl(
      ['static', 'relative', 'absolute', 'fixed', 'sticky'],
      pos,
      (val) => this.emitChange('position', val),
    );
    typeCol.appendChild(typeSelect);
    typeRow.appendChild(typeCol);
    body.appendChild(typeRow);

    // Absolute/fixed offset controls
    if (pos === 'absolute' || pos === 'fixed') {
      const offsetRow = this.makeSectionRow();
      const offsetWrap = document.createElement('div');
      Object.assign(offsetWrap.style, {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        width: '100%',
      });

      const leftCol = document.createElement('div');
      Object.assign(leftCol.style, { flex: '1', minWidth: '0' });
      leftCol.appendChild(this.makePropInput('left', null, t, 1, false, 'L'));
      offsetWrap.appendChild(leftCol);

      const centerCol = document.createElement('div');
      Object.assign(centerCol.style, {
        flex: '1',
        minWidth: '0',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        alignItems: 'stretch',
      });
      centerCol.appendChild(this.makePropInput('top', null, t, 1, false, 'T'));

      const previewBox = document.createElement('div');
      Object.assign(previewBox.style, {
        position: 'relative',
        background: v(cssVars.surfaceHover),
        borderRadius: '8px',
        width: '100%',
        height: '64px',
      });
      const previewInner = document.createElement('div');
      Object.assign(previewInner.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '24px',
        height: '24px',
        background: v(cssVars.surface),
        border: '1px solid ' + v(cssVars.border),
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
      });
      const previewDot = document.createElement('div');
      Object.assign(previewDot.style, {
        width: '4px',
        height: '4px',
        borderRadius: '50%',
        background: '#3b82f6',
      });
      previewInner.appendChild(previewDot);
      previewBox.appendChild(previewInner);
      centerCol.appendChild(previewBox);
      centerCol.appendChild(this.makePropInput('bottom', null, t, 1, false, 'B'));
      offsetWrap.appendChild(centerCol);

      const rightCol = document.createElement('div');
      Object.assign(rightCol.style, { flex: '1', minWidth: '0' });
      rightCol.appendChild(this.makePropInput('right', null, t, 1, false, 'R'));
      offsetWrap.appendChild(rightCol);

      offsetRow.appendChild(offsetWrap);
      body.appendChild(offsetRow);
    }

    // Relative offsets
    if (pos === 'relative') {
      const labelRow = this.makeSectionRow();
      labelRow.appendChild(this.makeGroupLabelInline('Offsets'));
      body.appendChild(labelRow);

      const r1 = this.makeSectionRow();
      Object.assign(r1.style, { display: 'flex', gap: '8px' });
      r1.appendChild(this.makePropInput('top', null, t, 1, false, 'T'));
      r1.appendChild(this.makePropInput('right', null, t, 1, false, 'R'));
      body.appendChild(r1);

      const r2 = this.makeSectionRow();
      Object.assign(r2.style, { display: 'flex', gap: '8px' });
      r2.appendChild(this.makePropInput('bottom', null, t, 1, false, 'B'));
      r2.appendChild(this.makePropInput('left', null, t, 1, false, 'L'));
      body.appendChild(r2);
    }

    // Sticky offsets
    if (pos === 'sticky') {
      const labelRow = this.makeSectionRow();
      labelRow.appendChild(this.makeGroupLabelInline('Sticky offset'));
      body.appendChild(labelRow);

      const r = this.makeSectionRow();
      Object.assign(r.style, { display: 'flex', gap: '8px' });
      r.appendChild(this.makePropInput('top', null, t, 1, false, 'T'));
      r.appendChild(this.makePropInput('bottom', null, t, 1, false, 'B'));
      body.appendChild(r);
    }

    section.appendChild(body);
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Layout section
  // ---------------------------------------------------------------------------

  private buildLayoutSection(parent: HTMLElement, t: Record<string, string>, hasFlex: boolean, hasGrid: boolean): void {
    const section = this.createSection();
    const header = this.makeSectionHeader('Layout');
    section.appendChild(header);
    const body = this.makeSectionBody();

    const disp = getVal(t, 'display') || 'block';
    const fd = getVal(t, 'flex-direction') || 'row';
    let lt = 'block';
    if (disp === 'flex' || disp === 'inline-flex') {
      lt = fd === 'column' ? 'flex-col' : 'flex-row';
    } else if (disp === 'grid' || disp === 'inline-grid') {
      lt = 'grid';
    }

    // Display segmented control
    const dispRow = this.makeSectionRow();
    const dispCol = document.createElement('div');
    Object.assign(dispCol.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      flex: '1',
      minWidth: '0',
    });
    dispCol.appendChild(this.makeFieldLabel('Display'));
    const dispCtrl = this.makeSegmentedControlWithIcons([
      { iconFn: () => rectangleSmall(24), value: 'block', label: 'Block' },
      { iconFn: () => autolayoutAddHorizontal(24), value: 'flex-row', label: 'Flex Row' },
      { iconFn: () => autolayoutAddVertical(24), value: 'flex-col', label: 'Flex Column' },
      { iconFn: () => gridView(24), value: 'grid', label: 'Grid' },
    ], lt, (val) => {
      if (val === 'block') {
        this.emitChange('display', 'block');
      } else if (val === 'flex-row') {
        this.emitChange('display', 'flex');
        this.emitChange('flex-direction', 'row');
      } else if (val === 'flex-col') {
        this.emitChange('display', 'flex');
        this.emitChange('flex-direction', 'column');
      } else if (val === 'grid') {
        this.emitChange('display', 'grid');
      }
    });
    dispCol.appendChild(dispCtrl);
    dispRow.appendChild(dispCol);
    body.appendChild(dispRow);

    // Flex-specific controls
    if (hasFlex) {
      // Alignment + Gap row
      const flexRow = this.makeSectionRow();
      Object.assign(flexRow.style, {
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
      });

      const alignCol = document.createElement('div');
      Object.assign(alignCol.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: '1',
        minWidth: '0',
      });
      alignCol.appendChild(this.makeFieldLabel('Alignment'));
      alignCol.appendChild(this.makeAlignmentGrid(t));
      flexRow.appendChild(alignCol);

      const gapCol = document.createElement('div');
      Object.assign(gapCol.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: '1',
        minWidth: '0',
      });
      gapCol.appendChild(this.makeFieldLabel('Gap'));
      gapCol.appendChild(this.makePropInputWithIcon('gap', () => alSpacingHorizontal(24), t));
      flexRow.appendChild(gapCol);
      body.appendChild(flexRow);

      // Reverse + Wrap row
      const wrapRow = this.makeSectionRow();
      Object.assign(wrapRow.style, { display: 'flex', gap: '8px' });

      const reverseCol = document.createElement('div');
      Object.assign(reverseCol.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: '1',
        minWidth: '0',
      });
      reverseCol.appendChild(this.makeFieldLabel('Reverse'));
      reverseCol.appendChild(this.makeSelectControl(['No', 'Yes'], fd.includes('reverse') ? 'Yes' : 'No', (val) => {
        const base = lt === 'flex-col' ? 'column' : 'row';
        this.emitChange('flex-direction', val === 'Yes' ? base + '-reverse' : base);
      }));
      wrapRow.appendChild(reverseCol);

      const wrapCol = document.createElement('div');
      Object.assign(wrapCol.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: '1',
        minWidth: '0',
      });
      wrapCol.appendChild(this.makeFieldLabel('Wrap'));
      const wrapVal = (() => {
        const fw = getVal(t, 'flex-wrap') || 'nowrap';
        return fw === 'nowrap' ? 'Nowrap' : fw === 'wrap' ? 'Wrap' : 'Wrap-reverse';
      })();
      wrapCol.appendChild(this.makeSelectControl(['Nowrap', 'Wrap', 'Wrap-reverse'], wrapVal, (val) => this.emitChange('flex-wrap', val.toLowerCase())));
      wrapRow.appendChild(wrapCol);
      body.appendChild(wrapRow);
    }

    section.appendChild(body);
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Spacing section
  // ---------------------------------------------------------------------------

  private buildSpacingSection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const header = this.makeSectionHeader('Spacing');
    section.appendChild(header);
    const body = this.makeSectionBody();

    // Padding row
    const paddingRow = this.makeSectionRowWithSplit();
    Object.assign(paddingRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });
    const paddingLabel = this.makeGroupLabelInline('Padding');
    paddingRow.appendChild(paddingLabel);
    paddingRow.appendChild(this.makePropInputWithIcon('padding-left', () => alPaddingHorizontal(24), t));
    paddingRow.appendChild(this.makePropInputWithIcon('padding-top', () => alPaddingVertical(24), t));
    paddingRow.appendChild(this.makeSplitButton());
    body.appendChild(paddingRow);

    // Margin row
    const marginRow = this.makeSectionRowWithSplit();
    Object.assign(marginRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });
    const marginLabel = this.makeGroupLabelInline('Margin');
    marginRow.appendChild(marginLabel);
    marginRow.appendChild(this.makePropInputWithIcon('margin-left', () => alPaddingHorizontal(24), t));
    marginRow.appendChild(this.makePropInputWithIcon('margin-top', () => alPaddingVertical(24), t));
    marginRow.appendChild(this.makeSplitButton());
    body.appendChild(marginRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Size section
  // ---------------------------------------------------------------------------

  private buildSizeSection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const header = this.makeSectionHeader('Size', () => {});
    section.appendChild(header);
    const body = this.makeSectionBody();

    // Labels row
    const labelRow = this.makeSectionRow();
    Object.assign(labelRow.style, { display: 'flex', gap: '8px' });
    const wLabel = this.makeGroupLabelInline('Width');
    wLabel.style.flex = '1';
    const hLabel = this.makeGroupLabelInline('Height');
    hLabel.style.flex = '1';
    labelRow.appendChild(wLabel);
    labelRow.appendChild(hLabel);
    const spacer = document.createElement('div');
    spacer.style.width = '32px';
    spacer.style.flexShrink = '0';
    labelRow.appendChild(spacer);
    body.appendChild(labelRow);

    // Inputs row
    const inputRow = this.makeSectionRow();
    Object.assign(inputRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });
    inputRow.appendChild(this.makeComboInput('width', t));
    inputRow.appendChild(this.makeComboInput('height', t));

    // Lock button
    const lockBtn = document.createElement('button');
    let locked = false;
    Object.assign(lockBtn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: 'none',
      background: 'transparent',
      color: v(cssVars.textTertiary),
      cursor: 'pointer',
      padding: '0',
      flexShrink: '0',
    });
    lockBtn.appendChild(lockOpen(24));
    const lockE = () => { lockBtn.style.background = v(cssVars.surfaceHover); };
    const lockL = () => { lockBtn.style.background = 'transparent'; };
    const lockC = () => {
      locked = !locked;
      while (lockBtn.firstChild) lockBtn.removeChild(lockBtn.firstChild);
      lockBtn.appendChild(locked ? lockClosed(24) : lockOpen(24));
      lockBtn.style.color = v(locked ? cssVars.text : cssVars.textTertiary);
    };
    lockBtn.addEventListener('mouseenter', lockE);
    lockBtn.addEventListener('mouseleave', lockL);
    lockBtn.addEventListener('click', lockC);
    this.cleanups.push(() => {
      lockBtn.removeEventListener('mouseenter', lockE);
      lockBtn.removeEventListener('mouseleave', lockL);
      lockBtn.removeEventListener('click', lockC);
    });
    inputRow.appendChild(lockBtn);
    body.appendChild(inputRow);

    // Max labels row
    const maxLabelRow = this.makeSectionRow();
    Object.assign(maxLabelRow.style, { display: 'flex', gap: '8px', marginTop: '4px' });
    const mwLabel = this.makeGroupLabelInline('Max W');
    mwLabel.style.flex = '1';
    const mhLabel = this.makeGroupLabelInline('Max H');
    mhLabel.style.flex = '1';
    maxLabelRow.appendChild(mwLabel);
    maxLabelRow.appendChild(mhLabel);
    body.appendChild(maxLabelRow);

    // Max inputs row
    const maxRow = this.makeSectionRow();
    Object.assign(maxRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });
    maxRow.appendChild(this.makePropInput('max-width', null, t, 1, true));
    maxRow.appendChild(this.makePropInput('max-height', null, t, 1, true));
    body.appendChild(maxRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Typography section
  // ---------------------------------------------------------------------------

  private buildTypographySection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const header = this.makeSectionHeader('Typography');
    section.appendChild(header);
    const body = this.makeSectionBody();

    const ff = getVal(t, 'font-family') || 'system-ui';

    // Font family button
    const ffRow = this.makeSectionRow();
    const ffBtn = document.createElement('button');
    Object.assign(ffBtn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      height: '32px',
      padding: '0 8px',
      borderRadius: '8px',
      background: v(cssVars.surfaceHover),
      border: 'none',
      color: v(cssVars.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT_FAMILY,
      cursor: 'pointer',
      textAlign: 'left',
    });
    const ffName = ff.split(',')[0].trim().replace(/["']/g, '');
    const ffSpan = document.createElement('span');
    ffSpan.textContent = ffName;
    Object.assign(ffSpan.style, {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    ffBtn.appendChild(ffSpan);
    ffBtn.appendChild(chevronDown(24));
    const ffE = () => { ffBtn.style.background = v(cssVars.border); };
    const ffL = () => { ffBtn.style.background = v(cssVars.surfaceHover); };
    ffBtn.addEventListener('mouseenter', ffE);
    ffBtn.addEventListener('mouseleave', ffL);
    this.cleanups.push(() => {
      ffBtn.removeEventListener('mouseenter', ffE);
      ffBtn.removeEventListener('mouseleave', ffL);
    });
    ffRow.appendChild(ffBtn);
    body.appendChild(ffRow);

    // Size + Weight row
    const swRow = this.makeSectionRow();
    Object.assign(swRow.style, { display: 'flex', gap: '8px' });
    const sizeLabel = this.makeGroupLabelInline('Size');
    swRow.appendChild(sizeLabel);
    swRow.appendChild(this.makePropInput('font-size', null, t));
    const weightLabel = this.makeGroupLabelInline('Weight');
    swRow.appendChild(weightLabel);
    const fw = getVal(t, 'font-weight') || '400';
    const weightSelect = this.makeSelectControl(
      ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
      fw,
      (val) => this.emitChange('font-weight', val),
    );
    swRow.appendChild(weightSelect);
    body.appendChild(swRow);

    // Line height + Letter spacing row
    const lhRow = this.makeSectionRow();
    Object.assign(lhRow.style, { display: 'flex', gap: '8px' });
    const lhLabel = this.makeGroupLabelInline('Line height');
    lhRow.appendChild(lhLabel);
    lhRow.appendChild(this.makeComboInput('line-height', t, 0.1));
    const lsLabel = this.makeGroupLabelInline('Letter spacing');
    lhRow.appendChild(lsLabel);
    lhRow.appendChild(this.makeComboInput('letter-spacing', t, 0.1));
    body.appendChild(lhRow);

    // Color row
    const colorRow = this.makeSectionRow();
    const colorInput = this.makeColorInput('color', t);
    colorRow.appendChild(colorInput);
    body.appendChild(colorRow);

    // Text align row
    const taRow = this.makeSectionRow();
    Object.assign(taRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });
    const taLabel = this.makeGroupLabelInline('Align');
    taRow.appendChild(taLabel);
    const taVal = getVal(t, 'text-align') || 'left';
    const taCtrl = this.makeSegmentedControlWithIcons([
      { iconFn: () => textAlignLeft(24), value: 'left', label: 'Left' },
      { iconFn: () => textAlignCenter(24), value: 'center', label: 'Center' },
      { iconFn: () => textAlignRight(24), value: 'right', label: 'Right' },
    ], taVal, (val) => this.emitChange('text-align', val));
    taRow.appendChild(taCtrl);
    body.appendChild(taRow);

    // Vertical align row
    const vaRow = this.makeSectionRow();
    Object.assign(vaRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });
    const vaLabel = this.makeGroupLabelInline('Vertical');
    vaRow.appendChild(vaLabel);
    const vaRaw = getVal(t, 'vertical-align') || 'top';
    let vaVal = 'top';
    if (vaRaw === 'middle') vaVal = 'middle';
    else if (vaRaw === 'bottom') vaVal = 'bottom';
    const vaCtrl = this.makeSegmentedControlWithIcons([
      { iconFn: () => textAlignTop(24), value: 'top', label: 'Top' },
      { iconFn: () => textAlignMiddle(24), value: 'middle', label: 'Middle' },
      { iconFn: () => textAlignBottom(24), value: 'bottom', label: 'Bottom' },
    ], vaVal, (val) => this.emitChange('vertical-align', val));
    vaRow.appendChild(vaCtrl);
    body.appendChild(vaRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Appearance section
  // ---------------------------------------------------------------------------

  private buildAppearanceSection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const header = this.makeSectionHeader('Appearance');
    section.appendChild(header);
    const body = this.makeSectionBody();

    // Opacity + Z-index row
    const opRow = this.makeSectionRow();
    Object.assign(opRow.style, { display: 'flex', gap: '8px' });
    const opLabel = this.makeGroupLabelInline('Opacity');
    opRow.appendChild(opLabel);
    opRow.appendChild(this.makePropInput('opacity', null, t, 0.05));
    const ziLabel = this.makeGroupLabelInline('Z index');
    opRow.appendChild(ziLabel);
    opRow.appendChild(this.makePropInput('z-index', null, t, 1));
    body.appendChild(opRow);

    // Corner radius row
    const crRow = this.makeSectionRowWithSplit();
    Object.assign(crRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });
    const crLabel = this.makeGroupLabelInline('Corner radius');
    crRow.appendChild(crLabel);
    crRow.appendChild(this.makePropInputWithIcon('border-radius', () => radiusTopLeft(24), t));
    crRow.appendChild(this.makeSplitButton());
    body.appendChild(crRow);

    // Overflow row
    const ofRow = this.makeSectionRow();
    Object.assign(ofRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });
    const ofLabel = this.makeGroupLabelInline('Overflow');
    ofRow.appendChild(ofLabel);
    const ofVal = getVal(t, 'overflow') || 'visible';
    const ofSelect = this.makeSelectControl(['visible', 'hidden', 'scroll', 'auto'], ofVal, (val) => this.emitChange('overflow', val));
    ofRow.appendChild(ofSelect);
    body.appendChild(ofRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Fill section
  // ---------------------------------------------------------------------------

  private buildFillSection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const bg = getVal(t, 'background-color');
    const hasFill = bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)';
    const header = this.makeSectionHeader('Fill', () => {
      this.emitChange('background-color', '#ffffff');
    });
    section.appendChild(header);
    if (hasFill) {
      const body = this.makeSectionBody();
      const row = this.makeSectionRow();
      row.appendChild(this.makeColorInput('background-color', t));
      body.appendChild(row);
      section.appendChild(body);
    }
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Border section
  // ---------------------------------------------------------------------------

  private buildBorderSection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const bs = getVal(t, 'border-style') || getVal(t, 'border-top-style') || 'none';
    const bw = parseFloatSafe(getVal(t, 'border-width') || getVal(t, 'border-top-width') || '0');
    const hasBorder = bs !== 'none' && bw > 0;
    const header = this.makeSectionHeader('Border', () => {
      this.emitChange('border-style', 'solid');
      this.emitChange('border-width', '1px');
      this.emitChange('border-color', '#333333');
    });
    section.appendChild(header);
    if (hasBorder) {
      const body = this.makeSectionBody();

      // Color row
      const colorRow = this.makeSectionRow();
      colorRow.appendChild(this.makeColorInput('border-color', t));
      body.appendChild(colorRow);

      // Width row
      const widthRow = this.makeSectionRowWithSplit();
      Object.assign(widthRow.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      });
      const widthLabel = this.makeGroupLabelInline('Width');
      widthRow.appendChild(widthLabel);
      widthRow.appendChild(this.makePropInput('border-width', null, t));
      widthRow.appendChild(this.makeSplitButton());
      body.appendChild(widthRow);

      // Style row
      const styleRow = this.makeSectionRow();
      Object.assign(styleRow.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      });
      const styleLabel = this.makeGroupLabelInline('Style');
      styleRow.appendChild(styleLabel);
      const styleSelect = this.makeSelectControl(['solid', 'dashed', 'dotted', 'double'], bs, (val) => this.emitChange('border-style', val));
      styleRow.appendChild(styleSelect);
      body.appendChild(styleRow);

      section.appendChild(body);
    }
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Shadow section
  // ---------------------------------------------------------------------------

  private buildShadowSection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const raw = getVal(t, 'box-shadow');
    const shadow = parseShadow(raw);
    const header = this.makeSectionHeader('Shadow', () => {
      this.emitChange('box-shadow', '0px 2px 8px 0px rgba(0,0,0,0.15)');
    });
    section.appendChild(header);
    if (shadow) {
      const body = this.makeSectionBody();

      // Color row
      const colorRow = this.makeSectionRow();
      const hex = normalizeColor(shadow.color);
      const colorWrap = document.createElement('div');
      Object.assign(colorWrap.style, {
        display: 'flex',
        alignItems: 'center',
        height: '32px',
        gap: '1px',
      });

      const colorLeft = document.createElement('div');
      Object.assign(colorLeft.style, {
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        minWidth: '0',
        height: '32px',
        background: v(cssVars.surfaceHover),
        borderRadius: '8px 0 0 8px',
      });

      const swatchWrap = document.createElement('div');
      Object.assign(swatchWrap.style, {
        width: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: '0',
        position: 'relative',
      });
      const swatch = document.createElement('div');
      Object.assign(swatch.style, {
        width: '20px',
        height: '20px',
        borderRadius: '2px',
        background: hex,
        position: 'relative',
        overflow: 'hidden',
      });
      const colorPicker = document.createElement('input');
      colorPicker.type = 'color';
      colorPicker.value = hex;
      Object.assign(colorPicker.style, {
        position: 'absolute',
        inset: '0',
        opacity: '0',
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        padding: '0',
        border: 'none',
      });
      const onColorInput = () => {
        swatch.style.background = colorPicker.value;
        shadow.color = colorPicker.value;
        this.emitChange('box-shadow', formatShadow(shadow));
      };
      colorPicker.addEventListener('input', onColorInput);
      this.cleanups.push(() => colorPicker.removeEventListener('input', onColorInput));
      swatchWrap.appendChild(swatch);
      swatchWrap.appendChild(colorPicker);
      colorLeft.appendChild(swatchWrap);

      const hexInput = document.createElement('input');
      hexInput.type = 'text';
      hexInput.value = hex;
      Object.assign(hexInput.style, {
        flex: '1',
        height: '100%',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: v(cssVars.text),
        fontSize: '11px',
        fontWeight: '450',
        fontFamily: FONT_FAMILY,
        padding: '0',
        letterSpacing: '-0.005em',
      });
      colorLeft.appendChild(hexInput);
      colorWrap.appendChild(colorLeft);

      const opacityWrap = document.createElement('div');
      Object.assign(opacityWrap.style, {
        display: 'flex',
        alignItems: 'center',
        height: '32px',
        background: v(cssVars.surfaceHover),
        borderRadius: '0 8px 8px 0',
        padding: '0 8px 0 4px',
      });
      const opacityInput = document.createElement('input');
      opacityInput.type = 'text';
      opacityInput.value = String(extractOpacityPercent(shadow.color));
      Object.assign(opacityInput.style, {
        width: '28px',
        height: '100%',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: v(cssVars.text),
        fontSize: '11px',
        fontWeight: '450',
        fontFamily: FONT_FAMILY,
        textAlign: 'right',
        letterSpacing: '-0.005em',
        fontVariantNumeric: 'tabular-nums',
      });
      const pctLabel = document.createElement('span');
      pctLabel.textContent = '%';
      Object.assign(pctLabel.style, { fontSize: '11px', color: v(cssVars.textTertiary) });
      opacityWrap.appendChild(opacityInput);
      opacityWrap.appendChild(pctLabel);
      colorWrap.appendChild(opacityWrap);

      colorRow.appendChild(colorWrap);
      body.appendChild(colorRow);

      // X/Y row
      const xyRow = this.makeSectionRow();
      Object.assign(xyRow.style, { display: 'flex', gap: '8px' });
      const xLabel = this.makeGroupLabelInline('X');
      xyRow.appendChild(xLabel);
      xyRow.appendChild(this.makeShadowPropInput(shadow, 'x'));
      const yLabel = this.makeGroupLabelInline('Y');
      xyRow.appendChild(yLabel);
      xyRow.appendChild(this.makeShadowPropInput(shadow, 'y'));
      body.appendChild(xyRow);

      // Blur/Spread row
      const bsRow = this.makeSectionRow();
      Object.assign(bsRow.style, { display: 'flex', gap: '8px' });
      const blurLabel = this.makeGroupLabelInline('Blur');
      bsRow.appendChild(blurLabel);
      bsRow.appendChild(this.makeShadowPropInput(shadow, 'blur'));
      const spreadLabel = this.makeGroupLabelInline('Spread');
      bsRow.appendChild(spreadLabel);
      bsRow.appendChild(this.makeShadowPropInput(shadow, 'spread'));
      body.appendChild(bsRow);

      // Type row
      const typeRow = this.makeSectionRow();
      Object.assign(typeRow.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      });
      const typeLabel = this.makeGroupLabelInline('Type');
      typeRow.appendChild(typeLabel);
      const typeSelect = this.makeSelectControl(['Outside', 'Inside'], shadow.inset ? 'Inside' : 'Outside', (val) => {
        shadow.inset = val === 'Inside';
        this.emitChange('box-shadow', formatShadow(shadow));
      });
      typeRow.appendChild(typeSelect);
      body.appendChild(typeRow);

      section.appendChild(body);
    }
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Filters section
  // ---------------------------------------------------------------------------

  private buildFiltersSection(parent: HTMLElement, t: Record<string, string>): void {
    const section = this.createSection();
    const raw = getVal(t, 'filter');
    const filters = parseFilters(raw);
    const header = this.makeSectionHeader('Filters', () => {
      this.emitChange('filter', 'blur(0px)');
    });
    section.appendChild(header);
    if (filters.length > 0) {
      const body = this.makeSectionBody();
      for (let i = 0; i < filters.length; i++) {
        const f = filters[i];
        const row = this.makeSectionRow();
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          height: '32px',
          background: v(cssVars.surfaceHover),
          borderRadius: '8px',
          padding: '0 8px',
          gap: '8px',
        });

        const typeLabel = document.createElement('span');
        typeLabel.textContent = f.type;
        Object.assign(typeLabel.style, {
          fontSize: '11px',
          fontWeight: '400',
          color: v(cssVars.textTertiary),
          flexShrink: '0',
          minWidth: '50px',
        });
        row.appendChild(typeLabel);

        const track = document.createElement('div');
        Object.assign(track.style, {
          flex: '1',
          height: '4px',
          borderRadius: '2px',
          background: v(cssVars.border),
          position: 'relative',
          cursor: 'pointer',
        });

        let maxVal = 100;
        if (f.unit === 'px') maxVal = 50;
        else if (f.unit === 'deg') maxVal = 360;
        else if (f.type === 'saturate' || f.type === 'contrast' || f.type === 'brightness') maxVal = 200;

        const fillPct = Math.min(100, f.value / maxVal * 100);
        const fill = document.createElement('div');
        Object.assign(fill.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          height: '100%',
          width: fillPct + '%',
          borderRadius: '2px',
          background: v(cssVars.blue500),
        });
        track.appendChild(fill);

        const onTrackClick = (e: MouseEvent) => {
          const rect = track.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          f.value = Math.round(ratio * maxVal * 10) / 10;
          fill.style.width = ratio * 100 + '%';
          valLabel.textContent = f.value + f.unit;
          this.emitChange('filter', formatFilters(filters));
        };
        track.addEventListener('click', onTrackClick);
        this.cleanups.push(() => track.removeEventListener('click', onTrackClick));
        row.appendChild(track);

        const valLabel = document.createElement('span');
        valLabel.textContent = f.value + f.unit;
        Object.assign(valLabel.style, {
          fontSize: '11px',
          fontWeight: '450',
          color: v(cssVars.text),
          fontVariantNumeric: 'tabular-nums',
          minWidth: '36px',
          textAlign: 'right',
          flexShrink: '0',
        });
        row.appendChild(valLabel);
        body.appendChild(row);
      }
      section.appendChild(body);
    }
    parent.appendChild(section);
  }

  // ---------------------------------------------------------------------------
  // Shared UI primitives
  // ---------------------------------------------------------------------------

  private createSection(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, { borderBottom: '1px solid ' + v(cssVars.border) });
    return el;
  }

  private makeSectionHeader(title: string, onAdd?: () => void): HTMLDivElement {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px 0 16px',
      height: '44px',
    });

    const label = document.createElement('span');
    label.textContent = title;
    Object.assign(label.style, {
      fontSize: '12px',
      fontWeight: '500',
      color: v(cssVars.text),
      lineHeight: '20px',
    });
    header.appendChild(label);

    if (onAdd) {
      const addBtn = document.createElement('button');
      Object.assign(addBtn.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: v(cssVars.textTertiary),
        cursor: 'pointer',
        padding: '0',
        opacity: '0',
        transition: 'opacity 120ms, background 120ms',
      });
      addBtn.appendChild(plus(24));
      const onHeaderEnter = () => { addBtn.style.opacity = '1'; };
      const onHeaderLeave = () => { addBtn.style.opacity = '0'; };
      const onBtnEnter = () => { addBtn.style.background = v(cssVars.surfaceHover); };
      const onBtnLeave = () => { addBtn.style.background = 'transparent'; };
      header.addEventListener('mouseenter', onHeaderEnter);
      header.addEventListener('mouseleave', onHeaderLeave);
      addBtn.addEventListener('mouseenter', onBtnEnter);
      addBtn.addEventListener('mouseleave', onBtnLeave);
      addBtn.addEventListener('click', onAdd);
      this.cleanups.push(() => {
        header.removeEventListener('mouseenter', onHeaderEnter);
        header.removeEventListener('mouseleave', onHeaderLeave);
        addBtn.removeEventListener('mouseenter', onBtnEnter);
        addBtn.removeEventListener('mouseleave', onBtnLeave);
        addBtn.removeEventListener('click', onAdd);
      });
      header.appendChild(addBtn);
    }

    return header;
  }

  private makeSectionBody(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingBottom: '16px',
    });
    return el;
  }

  private makeSectionRow(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, { padding: '0 48px 0 16px' });
    return el;
  }

  private makeSectionRowWithSplit(): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, { padding: '0 8px 0 16px' });
    return el;
  }

  private makeGroupLabelInline(text: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.textContent = text;
    Object.assign(el.style, {
      fontSize: '11px',
      fontWeight: '400',
      letterSpacing: '-0.005em',
      color: v(cssVars.textTertiary),
      lineHeight: '16px',
      flexShrink: '0',
    });
    return el;
  }

  private makeFieldLabel(text: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.textContent = text;
    Object.assign(el.style, {
      fontSize: '11px',
      fontWeight: '400',
      letterSpacing: '-0.005em',
      color: v(cssVars.textTertiary),
      lineHeight: '16px',
    });
    return el;
  }

  private makeSelectorPill(text: string, active: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      padding: '4px 8px',
      borderRadius: '8px',
      fontSize: '11px',
      fontWeight: '500',
      fontFamily: FONT_FAMILY,
      border: 'none',
      cursor: 'pointer',
      background: v(active ? cssVars.blueBg : cssVars.surfaceHover),
      color: v(active ? cssVars.blueText : cssVars.textSecondary),
      transition: 'background 120ms, color 120ms',
    });
    return btn;
  }

  private makeSplitButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: 'none',
      background: 'transparent',
      color: v(cssVars.textTertiary),
      cursor: 'pointer',
      padding: '0',
      flexShrink: '0',
    });
    btn.appendChild(alPaddingSides(24));
    const onE = () => { btn.style.background = v(cssVars.surfaceHover); };
    const onL = () => { btn.style.background = 'transparent'; };
    btn.addEventListener('mouseenter', onE);
    btn.addEventListener('mouseleave', onL);
    this.cleanups.push(() => {
      btn.removeEventListener('mouseenter', onE);
      btn.removeEventListener('mouseleave', onL);
    });
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Reset dot
  // ---------------------------------------------------------------------------

  private makeResetDot(prop: string, currentVal: string, onReset: () => void): HTMLDivElement {
    const dot = document.createElement('div');
    Object.assign(dot.style, {
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      background: v(cssVars.blue500),
      cursor: 'pointer',
      flexShrink: '0',
      display: 'none',
      position: 'absolute',
      left: '4px',
      top: '50%',
      transform: 'translateY(-50%)',
    });
    const camel = toCamelCase(prop);
    const orig = this.originalValues[camel] ?? this.originalValues[prop] ?? '';
    if (currentVal !== orig && currentVal !== '') dot.style.display = 'block';
    const onClick = (e: Event) => {
      e.stopPropagation();
      dot.style.display = 'none';
      onReset();
    };
    dot.addEventListener('click', onClick);
    this.cleanups.push(() => dot.removeEventListener('click', onClick));
    return dot;
  }

  // ---------------------------------------------------------------------------
  // Property input (numeric with optional prefix label)
  // ---------------------------------------------------------------------------

  private makePropInput(prop: string, _unused: null | undefined, styles: Record<string, string>, step: number = 1, optional: boolean = false, prefix: string | null = null): HTMLDivElement {
    const raw = getVal(styles, prop);
    const parsed = parseNumericValue(raw);

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      borderRadius: '8px',
      background: v(cssVars.surfaceHover),
      display: 'flex',
      alignItems: 'center',
      overflow: 'visible',
      flex: '1',
      minWidth: '0',
      transition: 'background-color 0.15s',
    });
    const wE = () => { wrapper.style.background = v(cssVars.border); };
    const wL = () => { if (!wrapper.querySelector('input:focus')) wrapper.style.background = v(cssVars.surfaceHover); };
    wrapper.addEventListener('mouseenter', wE);
    wrapper.addEventListener('mouseleave', wL);
    this.cleanups.push(() => {
      wrapper.removeEventListener('mouseenter', wE);
      wrapper.removeEventListener('mouseleave', wL);
    });

    if (prefix) {
      const prefixEl = document.createElement('div');
      Object.assign(prefixEl.style, {
        position: 'absolute',
        left: '0',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: '450',
        letterSpacing: '-0.005em',
        color: v(cssVars.text),
        flexShrink: '0',
        userSelect: 'none',
        cursor: 'ew-resize',
        zIndex: '1',
      });
      prefixEl.textContent = prefix;
      wrapper.appendChild(prefixEl);
      if (parsed !== null) {
        const unit = parsed.unit || 'px';
        const cleanup = attachScrub(prefixEl, {
          initialValue: parsed.number,
          step,
          onUpdate: (val) => {
            input.value = String(Math.round(val * 1e3) / 1e3);
          },
          onCommit: (val) => {
            input.value = String(Math.round(val * 1e3) / 1e3);
            this.emitChange(prop, formatNumericValue(val, unit));
          },
        });
        this.cleanups.push(cleanup);
      }
    }

    const resetDot = this.makeResetDot(prop, raw, () => {
      const camel = toCamelCase(prop);
      const orig = this.originalValues[camel] ?? this.originalValues[prop] ?? '';
      input.value = orig;
      this.emitChange(prop, orig);
    });
    wrapper.appendChild(resetDot);

    const input = document.createElement('input');
    input.type = 'text';
    const displayVal = parsed ? String(Math.round(parsed.number * 1e3) / 1e3) : raw || '';
    input.value = displayVal;
    if (optional && !displayVal) input.placeholder = '-';
    Object.assign(input.style, {
      flex: '1',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: v(cssVars.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT_FAMILY,
      padding: prefix ? '0 8px 0 32px' : '0 8px',
      boxSizing: 'border-box',
      letterSpacing: '-0.005em',
      fontVariantNumeric: 'tabular-nums',
    });

    const fI = () => { wrapper.style.outline = '1px solid ' + v(cssVars.border); wrapper.style.background = v(cssVars.border); };
    const fO = () => { wrapper.style.outline = 'none'; wrapper.style.background = v(cssVars.surfaceHover); };
    input.addEventListener('focus', fI);
    input.addEventListener('blur', fO);
    this.cleanups.push(() => {
      input.removeEventListener('focus', fI);
      input.removeEventListener('blur', fO);
    });

    const commit = () => {
      const val = input.value.trim();
      if (parsed) {
        const n = parseFloat(val);
        if (!isNaN(n)) {
          const unit = parsed.unit || 'px';
          this.emitChange(prop, formatNumericValue(n, unit));
        }
      } else {
        this.emitChange(prop, val);
      }
    };
    const onKd = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { commit(); input.blur(); }
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', onKd);
    this.cleanups.push(() => {
      input.removeEventListener('change', commit);
      input.removeEventListener('keydown', onKd);
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Property input with icon
  // ---------------------------------------------------------------------------

  private makePropInputWithIcon(prop: string, iconFn: () => SVGSVGElement, styles: Record<string, string>, step: number = 1): HTMLDivElement {
    const raw = getVal(styles, prop);
    const parsed = parseNumericValue(raw);

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      borderRadius: '8px',
      background: v(cssVars.surfaceHover),
      display: 'flex',
      alignItems: 'center',
      overflow: 'visible',
      flex: '1',
      minWidth: '0',
      transition: 'background-color 0.15s',
    });
    const wE = () => { wrapper.style.background = v(cssVars.border); };
    const wL = () => { if (!wrapper.querySelector('input:focus')) wrapper.style.background = v(cssVars.surfaceHover); };
    wrapper.addEventListener('mouseenter', wE);
    wrapper.addEventListener('mouseleave', wL);
    this.cleanups.push(() => {
      wrapper.removeEventListener('mouseenter', wE);
      wrapper.removeEventListener('mouseleave', wL);
    });

    const iconWrap = document.createElement('div');
    Object.assign(iconWrap.style, {
      width: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'ew-resize',
      userSelect: 'none',
      flexShrink: '0',
      color: v(cssVars.textTertiary),
      position: 'relative',
    });
    iconWrap.appendChild(iconFn());

    const resetDot = this.makeResetDot(prop, raw, () => {
      const camel = toCamelCase(prop);
      const orig = this.originalValues[camel] ?? this.originalValues[prop] ?? '';
      input.value = orig;
      this.emitChange(prop, orig);
    });
    iconWrap.appendChild(resetDot);
    wrapper.appendChild(iconWrap);

    if (parsed !== null) {
      const unit = parsed.unit || 'px';
      const cleanup = attachScrub(iconWrap, {
        initialValue: parsed.number,
        step,
        onUpdate: (val) => {
          input.value = String(Math.round(val * 1e3) / 1e3);
        },
        onCommit: (val) => {
          input.value = String(Math.round(val * 1e3) / 1e3);
          this.emitChange(prop, formatNumericValue(val, unit));
        },
      });
      this.cleanups.push(cleanup);
    }

    const input = document.createElement('input');
    input.type = 'text';
    const displayVal = parsed ? String(Math.round(parsed.number * 1e3) / 1e3) : raw || '';
    input.value = displayVal;
    Object.assign(input.style, {
      flex: '1',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: v(cssVars.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT_FAMILY,
      padding: '0 8px',
      boxSizing: 'border-box',
      letterSpacing: '-0.005em',
      fontVariantNumeric: 'tabular-nums',
    });

    const fI = () => { wrapper.style.outline = '1px solid ' + v(cssVars.border); wrapper.style.background = v(cssVars.border); };
    const fO = () => { wrapper.style.outline = 'none'; wrapper.style.background = v(cssVars.surfaceHover); };
    input.addEventListener('focus', fI);
    input.addEventListener('blur', fO);
    this.cleanups.push(() => {
      input.removeEventListener('focus', fI);
      input.removeEventListener('blur', fO);
    });

    const commit = () => {
      const val = input.value.trim();
      if (parsed) {
        const n = parseFloat(val);
        if (!isNaN(n)) {
          const unit = parsed.unit || 'px';
          this.emitChange(prop, formatNumericValue(n, unit));
        }
      } else {
        this.emitChange(prop, val);
      }
    };
    const onKd = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { commit(); input.blur(); }
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', onKd);
    this.cleanups.push(() => {
      input.removeEventListener('change', commit);
      input.removeEventListener('keydown', onKd);
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Shadow property input
  // ---------------------------------------------------------------------------

  private makeShadowPropInput(shadow: { inset: boolean; x: number; y: number; blur: number; spread: number; color: string }, field: 'x' | 'y' | 'blur' | 'spread'): HTMLDivElement {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      borderRadius: '8px',
      background: v(cssVars.surfaceHover),
      display: 'flex',
      alignItems: 'center',
      overflow: 'visible',
      flex: '1',
      minWidth: '0',
      transition: 'background-color 0.15s',
    });
    const wE = () => { wrapper.style.background = v(cssVars.border); };
    const wL = () => { if (!wrapper.querySelector('input:focus')) wrapper.style.background = v(cssVars.surfaceHover); };
    wrapper.addEventListener('mouseenter', wE);
    wrapper.addEventListener('mouseleave', wL);
    this.cleanups.push(() => {
      wrapper.removeEventListener('mouseenter', wE);
      wrapper.removeEventListener('mouseleave', wL);
    });

    const input = document.createElement('input');
    input.type = 'text';
    input.value = String(shadow[field]);
    Object.assign(input.style, {
      flex: '1',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: v(cssVars.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT_FAMILY,
      padding: '0 8px',
      boxSizing: 'border-box',
      letterSpacing: '-0.005em',
      fontVariantNumeric: 'tabular-nums',
    });

    const fI = () => { wrapper.style.outline = '1px solid ' + v(cssVars.border); wrapper.style.background = v(cssVars.border); };
    const fO = () => { wrapper.style.outline = 'none'; wrapper.style.background = v(cssVars.surfaceHover); };
    input.addEventListener('focus', fI);
    input.addEventListener('blur', fO);
    this.cleanups.push(() => {
      input.removeEventListener('focus', fI);
      input.removeEventListener('blur', fO);
    });

    const commit = () => {
      const n = parseFloat(input.value.trim());
      if (!isNaN(n)) {
        shadow[field] = n;
        this.emitChange('box-shadow', formatShadow(shadow));
      }
    };
    const onKd = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { commit(); input.blur(); }
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', onKd);
    this.cleanups.push(() => {
      input.removeEventListener('change', commit);
      input.removeEventListener('keydown', onKd);
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Combo input (value + unit dropdown)
  // ---------------------------------------------------------------------------

  private makeComboInput(prop: string, styles: Record<string, string>, step: number = 1): HTMLDivElement {
    const raw = getVal(styles, prop);
    const parsed = parseNumericValue(raw);

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      flex: '1',
      minWidth: '0',
      gap: '1px',
    });

    const left = document.createElement('div');
    Object.assign(left.style, {
      flex: '1',
      height: '32px',
      borderRadius: '8px 0 0 8px',
      background: v(cssVars.surfaceHover),
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '8px',
      minWidth: '0',
      transition: 'background 0.15s',
    });
    const lE = () => { left.style.background = v(cssVars.border); };
    const lL = () => { if (!left.querySelector('input:focus')) left.style.background = v(cssVars.surfaceHover); };
    left.addEventListener('mouseenter', lE);
    left.addEventListener('mouseleave', lL);
    this.cleanups.push(() => {
      left.removeEventListener('mouseenter', lE);
      left.removeEventListener('mouseleave', lL);
    });

    const input = document.createElement('input');
    input.type = 'text';
    let displayVal = '';
    if (prop === 'width' && (raw === 'auto' || !raw)) {
      displayVal = 'Fill';
    } else if (parsed) {
      displayVal = String(Math.round(parsed.number * 1e3) / 1e3);
    } else {
      displayVal = raw || '';
    }
    input.value = displayVal;
    Object.assign(input.style, {
      flex: '1',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: v(cssVars.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT_FAMILY,
      padding: '0',
      paddingRight: '4px',
      boxSizing: 'border-box',
      letterSpacing: '-0.005em',
      fontVariantNumeric: 'tabular-nums',
      minWidth: '0',
    });

    const fI = () => { left.style.outline = '1px solid ' + v(cssVars.border); left.style.background = v(cssVars.border); };
    const fO = () => { left.style.outline = 'none'; left.style.background = v(cssVars.surfaceHover); };
    input.addEventListener('focus', fI);
    input.addEventListener('blur', fO);
    this.cleanups.push(() => {
      input.removeEventListener('focus', fI);
      input.removeEventListener('blur', fO);
    });

    const commit = () => {
      const val = input.value.trim();
      if (parsed) {
        const n = parseFloat(val);
        if (!isNaN(n)) {
          const unit = parsed.unit || 'px';
          this.emitChange(prop, formatNumericValue(n, unit));
        }
      } else {
        this.emitChange(prop, val);
      }
    };
    const onKd = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { commit(); input.blur(); }
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', onKd);
    this.cleanups.push(() => {
      input.removeEventListener('change', commit);
      input.removeEventListener('keydown', onKd);
    });

    left.appendChild(input);
    wrapper.appendChild(left);

    const right = document.createElement('div');
    Object.assign(right.style, {
      width: '32px',
      height: '32px',
      borderRadius: '0 8px 8px 0',
      background: v(cssVars.surfaceHover),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: v(cssVars.textTertiary),
      flexShrink: '0',
      transition: 'background 0.15s',
    });
    right.appendChild(chevronDown(24));
    const rE = () => { right.style.background = v(cssVars.border); };
    const rL = () => { right.style.background = v(cssVars.surfaceHover); };
    right.addEventListener('mouseenter', rE);
    right.addEventListener('mouseleave', rL);
    this.cleanups.push(() => {
      right.removeEventListener('mouseenter', rE);
      right.removeEventListener('mouseleave', rL);
    });
    wrapper.appendChild(right);

    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Select control (dropdown)
  // ---------------------------------------------------------------------------

  private makeSelectControl(options: string[], current: string, onChange: (val: string) => void): HTMLDivElement {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      borderRadius: '8px',
      background: v(cssVars.surfaceHover),
      display: 'flex',
      alignItems: 'center',
      flex: '1',
      minWidth: '0',
      cursor: 'pointer',
      padding: '0',
      border: 'none',
      overflow: 'visible',
    });

    const label = document.createElement('span');
    label.textContent = current;
    Object.assign(label.style, {
      flex: '1',
      fontSize: '11px',
      fontWeight: '450',
      letterSpacing: '-0.005em',
      color: v(cssVars.text),
      paddingLeft: '32px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      textAlign: 'left',
    });

    const chevWrap = document.createElement('div');
    Object.assign(chevWrap.style, {
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: v(cssVars.textSecondary),
      flexShrink: '0',
    });
    chevWrap.appendChild(chevronDown(24));
    wrapper.appendChild(label);
    wrapper.appendChild(chevWrap);

    const wE = () => { wrapper.style.background = v(cssVars.border); };
    const wL = () => { wrapper.style.background = v(cssVars.surfaceHover); };
    wrapper.addEventListener('mouseenter', wE);
    wrapper.addEventListener('mouseleave', wL);
    this.cleanups.push(() => {
      wrapper.removeEventListener('mouseenter', wE);
      wrapper.removeEventListener('mouseleave', wL);
    });

    let dropdown: HTMLDivElement | null = null;
    const closeDropdown = () => {
      if (dropdown && dropdown.parentElement) dropdown.parentElement.removeChild(dropdown);
      dropdown = null;
    };

    const onClick = (e: Event) => {
      e.stopPropagation();
      if (dropdown) { closeDropdown(); return; }
      dropdown = document.createElement('div');
      Object.assign(dropdown.style, {
        position: 'absolute',
        top: '34px',
        left: '0',
        right: '0',
        background: v(cssVars.surface),
        borderRadius: '8px',
        border: '1px solid ' + v(cssVars.border),
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        zIndex: '10',
        maxHeight: '200px',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        padding: '4px',
      });

      for (const opt of options) {
        const item = document.createElement('div');
        const isSelected = opt === label.textContent;
        Object.assign(item.style, {
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          color: v(isSelected ? cssVars.blueText : cssVars.textSecondary),
          background: isSelected ? v(cssVars.blueBg) : 'transparent',
          cursor: 'pointer',
        });
        item.textContent = opt;
        const iE = () => { if (!isSelected) item.style.background = v(cssVars.surfaceHover); };
        const iL = () => { if (!isSelected) item.style.background = 'transparent'; };
        const iC = (ev: Event) => {
          ev.stopPropagation();
          label.textContent = opt;
          onChange(opt);
          closeDropdown();
        };
        item.addEventListener('mouseenter', iE);
        item.addEventListener('mouseleave', iL);
        item.addEventListener('click', iC);
        this.cleanups.push(() => {
          item.removeEventListener('mouseenter', iE);
          item.removeEventListener('mouseleave', iL);
          item.removeEventListener('click', iC);
        });
        dropdown.appendChild(item);
      }

      wrapper.appendChild(dropdown);
      const docClose = () => {
        closeDropdown();
        document.removeEventListener('click', docClose);
      };
      setTimeout(() => document.addEventListener('click', docClose), 0);
      this.cleanups.push(() => document.removeEventListener('click', docClose));
    };
    wrapper.addEventListener('click', onClick);
    this.cleanups.push(() => wrapper.removeEventListener('click', onClick));

    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Segmented control with icons
  // ---------------------------------------------------------------------------

  private makeSegmentedControlWithIcons(items: { iconFn: () => SVGSVGElement; value: string; label: string }[], current: string, onChange: (val: string) => void): HTMLDivElement {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      display: 'flex',
      height: '32px',
      background: v(cssVars.surfaceHover),
      borderRadius: '8px',
      overflow: 'hidden',
      flex: '1',
    });

    const indicator = document.createElement('div');
    Object.assign(indicator.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      height: '100%',
      background: v(cssVars.surface),
      border: '1px solid ' + v(cssVars.border),
      borderRadius: '8px',
      boxSizing: 'border-box',
      transition: 'transform 200ms cubic-bezier(0.77, 0, 0.175, 1)',
      willChange: 'transform',
      pointerEvents: 'none',
      zIndex: '0',
    });
    wrapper.appendChild(indicator);

    const btns: HTMLButtonElement[] = [];
    let activeIdx = items.findIndex(i => i.value === current);
    if (activeIdx < 0) activeIdx = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '32px',
        border: 'none',
        background: 'transparent',
        color: v(cssVars.text),
        cursor: 'pointer',
        position: 'relative',
        zIndex: '1',
        padding: '0',
        borderRadius: '8px',
        transition: 'color 150ms',
      });
      btn.title = item.label;
      btn.setAttribute('aria-label', item.label);
      btn.appendChild(item.iconFn());
      const onC = () => {
        activeIdx = i;
        for (let j = 0; j < btns.length; j++) {
          btns[j].style.color = v(j === i ? cssVars.text : cssVars.textTertiary);
        }
        updateIndicator();
        onChange(item.value);
      };
      btn.addEventListener('click', onC);
      this.cleanups.push(() => btn.removeEventListener('click', onC));
      btns.push(btn);
      wrapper.appendChild(btn);
    }

    const updateIndicator = () => {
      if (!btns[activeIdx]) return;
      const pct = 100 / items.length;
      indicator.style.width = pct + '%';
      indicator.style.transform = 'translateX(' + activeIdx * 100 + '%)';
    };
    requestAnimationFrame(updateIndicator);

    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Alignment grid (3x3)
  // ---------------------------------------------------------------------------

  private makeAlignmentGrid(styles: Record<string, string>): HTMLDivElement {
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gridTemplateRows: 'repeat(3, 1fr)',
      background: v(cssVars.surfaceHover),
      borderRadius: '8px',
      width: '100%',
      height: '72px',
    });

    const activeColor = '#0D99FF';
    const inactiveColor = '#a8a29e';

    const positions = [
      { jc: 'flex-start', ai: 'flex-start', icon: (c: string) => iconPositionLeft(16, c) },
      { jc: 'center', ai: 'flex-start', icon: (c: string) => iconPositionCenterH(16, c) },
      { jc: 'flex-end', ai: 'flex-start', icon: (c: string) => iconPositionRight(16, c) },
      { jc: 'flex-start', ai: 'center', icon: (c: string) => iconPositionLeft(16, c) },
      { jc: 'center', ai: 'center', icon: (c: string) => iconPositionCenterH(16, c) },
      { jc: 'flex-end', ai: 'center', icon: (c: string) => iconPositionRight(16, c) },
      { jc: 'flex-start', ai: 'flex-end', icon: (c: string) => iconPositionLeft(16, c) },
      { jc: 'center', ai: 'flex-end', icon: (c: string) => iconPositionCenterH(16, c) },
      { jc: 'flex-end', ai: 'flex-end', icon: (c: string) => iconPositionRight(16, c) },
    ];

    const currentJC = getVal(styles, 'justify-content') || 'flex-start';
    const currentAI = getVal(styles, 'align-items') || 'flex-start';
    const btns: HTMLButtonElement[] = [];

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const btn = document.createElement('button');
      const isActive = pos.jc === currentJC && pos.ai === currentAI;
      Object.assign(btn.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        padding: '0',
        cursor: 'pointer',
        overflow: 'hidden',
      });
      if (isActive) {
        btn.appendChild(pos.icon(activeColor));
      } else {
        btn.appendChild(iconDot(16, inactiveColor));
      }

      const onE = () => { if (!isActive) btn.style.color = v(cssVars.text); };
      const onL = () => { if (!isActive) btn.style.color = v(cssVars.textTertiary); };
      const onC = () => {
        this.emitChange('justify-content', pos.jc);
        this.emitChange('align-items', pos.ai);
        for (let j = 0; j < btns.length; j++) {
          const pp = positions[j];
          const match = pp.jc === pos.jc && pp.ai === pos.ai;
          btns[j].style.color = v(match ? cssVars.text : cssVars.textTertiary);
        }
      };
      btn.addEventListener('mouseenter', onE);
      btn.addEventListener('mouseleave', onL);
      btn.addEventListener('click', onC);
      this.cleanups.push(() => {
        btn.removeEventListener('mouseenter', onE);
        btn.removeEventListener('mouseleave', onL);
        btn.removeEventListener('click', onC);
      });
      btns.push(btn);
      grid.appendChild(btn);
    }

    return grid;
  }

  // ---------------------------------------------------------------------------
  // Color input (swatch + hex + opacity)
  // ---------------------------------------------------------------------------

  private makeColorInput(prop: string, styles: Record<string, string>): HTMLDivElement {
    const raw = getVal(styles, prop);
    const hex = normalizeColor(raw);
    const opacity = extractOpacityPercent(raw);

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display: 'flex',
      alignItems: 'center',
      height: '32px',
      gap: '1px',
    });

    // Left side: swatch + hex input
    const left = document.createElement('div');
    Object.assign(left.style, {
      flex: '1',
      display: 'flex',
      alignItems: 'center',
      minWidth: '0',
      height: '32px',
      position: 'relative',
      background: v(cssVars.surfaceHover),
      borderRadius: '8px 0 0 8px',
      transition: 'background 0.15s',
    });
    const lE = () => { left.style.background = v(cssVars.border); };
    const lL = () => { if (!left.querySelector('input:focus')) left.style.background = v(cssVars.surfaceHover); };
    left.addEventListener('mouseenter', lE);
    left.addEventListener('mouseleave', lL);
    this.cleanups.push(() => {
      left.removeEventListener('mouseenter', lE);
      left.removeEventListener('mouseleave', lL);
    });

    const swatchWrap = document.createElement('div');
    Object.assign(swatchWrap.style, {
      width: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      position: 'relative',
    });
    const swatch = document.createElement('div');
    Object.assign(swatch.style, {
      width: '20px',
      height: '20px',
      borderRadius: '2px',
      background: hex,
      position: 'relative',
      overflow: 'hidden',
    });
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = hex;
    Object.assign(picker.style, {
      position: 'absolute',
      inset: '0',
      opacity: '0',
      width: '100%',
      height: '100%',
      cursor: 'pointer',
      padding: '0',
      border: 'none',
    });
    swatchWrap.appendChild(swatch);
    swatchWrap.appendChild(picker);

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = hex;
    Object.assign(hexInput.style, {
      flex: '1',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: v(cssVars.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT_FAMILY,
      padding: '0',
      boxSizing: 'border-box',
      letterSpacing: '-0.005em',
    });

    const onPickerInput = () => {
      swatch.style.background = picker.value;
      hexInput.value = picker.value;
      this.emitChange(prop, picker.value);
    };
    picker.addEventListener('input', onPickerInput);
    this.cleanups.push(() => picker.removeEventListener('input', onPickerInput));

    const onHexChange = () => {
      const val = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{3,6}$/.test(val)) {
        const expanded = val.length === 4 ? '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3] : val;
        swatch.style.background = expanded;
        picker.value = expanded;
        this.emitChange(prop, expanded);
      }
    };
    hexInput.addEventListener('change', onHexChange);
    this.cleanups.push(() => hexInput.removeEventListener('change', onHexChange));

    const hfI = () => { left.style.outline = '1px solid ' + v(cssVars.border); };
    const hfO = () => { left.style.outline = 'none'; left.style.background = v(cssVars.surfaceHover); };
    hexInput.addEventListener('focus', hfI);
    hexInput.addEventListener('blur', hfO);
    this.cleanups.push(() => {
      hexInput.removeEventListener('focus', hfI);
      hexInput.removeEventListener('blur', hfO);
    });

    left.appendChild(swatchWrap);
    left.appendChild(hexInput);
    wrapper.appendChild(left);

    // Right side: opacity
    const right = document.createElement('div');
    Object.assign(right.style, {
      display: 'flex',
      alignItems: 'center',
      height: '32px',
      background: v(cssVars.surfaceHover),
      borderRadius: '0 8px 8px 0',
      padding: '0 8px 0 4px',
      transition: 'background 0.15s',
    });
    const rE = () => { right.style.background = v(cssVars.border); };
    const rL = () => { if (!right.querySelector('input:focus')) right.style.background = v(cssVars.surfaceHover); };
    right.addEventListener('mouseenter', rE);
    right.addEventListener('mouseleave', rL);
    this.cleanups.push(() => {
      right.removeEventListener('mouseenter', rE);
      right.removeEventListener('mouseleave', rL);
    });

    const opacityInput = document.createElement('input');
    opacityInput.type = 'text';
    opacityInput.value = String(opacity);
    Object.assign(opacityInput.style, {
      width: '28px',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: v(cssVars.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT_FAMILY,
      textAlign: 'right',
      letterSpacing: '-0.005em',
      fontVariantNumeric: 'tabular-nums',
    });
    const pctLabel = document.createElement('span');
    pctLabel.textContent = '%';
    Object.assign(pctLabel.style, { fontSize: '11px', color: v(cssVars.textTertiary) });
    right.appendChild(opacityInput);
    right.appendChild(pctLabel);
    wrapper.appendChild(right);

    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // Emit change
  // ---------------------------------------------------------------------------

  private emitChange(prop: string, value: string): void {
    this.changeCallback?.(prop, value);
  }
}
