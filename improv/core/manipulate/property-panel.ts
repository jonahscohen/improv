import { attachScrub, parseNumericValue, formatNumericValue } from './scrub.js';
import type { DetectedControls } from './control-detector.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PropertyChangeCallback = (property: string, value: string) => void;
type ElementSelectCallback = (element: HTMLElement) => void;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function rgbToHex(rgb: string): string {
  const match = rgb.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/,
  );
  if (!match) return '#000000';
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}

function parseColor(val: string): string {
  if (!val || val === 'transparent') return '#000000';
  if (val.startsWith('rgb')) return rgbToHex(val);
  if (val.startsWith('#'))
    return val.length === 4
      ? '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3]
      : val;
  return '#000000';
}

function parsePx(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function cssPropToCamel(property: string): string {
  return property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function getVal(
  computedStyles: Record<string, string>,
  property: string,
): string {
  const camel = cssPropToCamel(property);
  return computedStyles[camel] ?? computedStyles[property] ?? '';
}

// ---------------------------------------------------------------------------
// SVG icon helpers (paths from Lucide, verbatim)
// ---------------------------------------------------------------------------

function svgIcon(w: number, h: number, pathData: string, strokeW = 1.5): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', String(strokeW));
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  const parts = pathData.split('|');
  for (const d of parts) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d.trim());
    el.appendChild(p);
  }
  return el;
}

// Lucide chevron-down
function chevronDownIcon(size: number = 12): SVGSVGElement {
  return svgIcon(size, size, 'M6 9l6 6l6-6');
}

// Lucide chevron-right (for tree expand/collapse)
function chevronRightIcon(size: number = 16): SVGSVGElement {
  return svgIcon(size, size, 'M9 18l6-6l-6-6');
}

// Lucide plus
function plusIcon(size: number = 14): SVGSVGElement {
  return svgIcon(size, size, 'M12 5v14|M5 12h14');
}

// Lucide link/chain icon for aspect ratio lock
function chainIcon(size: number = 14): SVGSVGElement {
  return svgIcon(
    size,
    size,
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71|M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  );
}

// Lucide corner-down-right (for split/expand icon)
function splitIcon(size: number = 14): SVGSVGElement {
  return svgIcon(size, size, 'M9 4v8h8|M5 4v4a4 4 0 0 0 4 4h8');
}

// Lucide code-2 icon for DOM element nodes
function codeTagIcon(size: number = 16): SVGSVGElement {
  return svgIcon(size, size, 'M18 16l4-4l-4-4|M6 8l-4 4l4 4|M14.5 4l-5 16');
}

// Lucide component icon for framework components
function componentIcon(size: number = 16): SVGSVGElement {
  return svgIcon(
    size,
    size,
    'M5.5 8.5L9 12l-3.5 3.5L2 12l3.5-3.5z|M12 2l3.5 3.5L12 9L8.5 5.5L12 2z|M18.5 8.5L22 12l-3.5 3.5L15 12l3.5-3.5z|M12 15l3.5 3.5L12 22l-3.5-3.5L12 15z',
  );
}

// ---------------------------------------------------------------------------
// Lucide alignment icons (verbatim paths)
// ---------------------------------------------------------------------------

// Horizontal alignment
const ALIGN_H_LEFT = 'M4 4v16|M8 8h12|M8 16h8';
const ALIGN_H_CENTER = 'M12 4v16|M6 8h12|M8 16h8';
const ALIGN_H_RIGHT = 'M20 4v16|M4 8h12|M8 16h8';

// Vertical alignment
const ALIGN_V_TOP = 'M4 4h16|M8 8v12|M16 8v8';
const ALIGN_V_CENTER = 'M4 12h16|M8 6v12|M16 8v8';
const ALIGN_V_BOTTOM = 'M4 20h16|M8 4v12|M16 8v8';

// Display icons
const ICON_BLOCK = 'M3 3h18v18H3z';
const ICON_FLEX_ROW = 'M3 3h18v18H3z|M9 3v18|M15 3v18';
const ICON_FLEX_COL = 'M3 3h18v18H3z|M3 9h18|M3 15h18';
const ICON_GRID = 'M3 3h18v18H3z|M3 9h18|M3 15h18|M9 3v18|M15 3v18';

// Text alignment icons (Lucide align-left, align-center, align-right)
const TEXT_ALIGN_LEFT = 'M21 6H3|M15 12H3|M17 18H3';
const TEXT_ALIGN_CENTER = 'M21 6H3|M17 12H7|M21 18H3';
const TEXT_ALIGN_RIGHT = 'M21 6H3|M21 12H9|M21 18H3';

// Vertical text alignment
const TEXT_VALIGN_TOP = 'M4 4h16|M12 8v12';
const TEXT_VALIGN_MIDDLE = 'M4 12h16|M12 6v12';
const TEXT_VALIGN_BOTTOM = 'M4 20h16|M12 4v12';

// Spacing icons
const ICON_PADDING_H = 'M7 4v16|M17 4v16|M7 12h10';
const ICON_PADDING_V = 'M4 7h16|M4 17h16|M12 7v10';
const ICON_MARGIN_H = 'M3 4v16|M21 4v16|M3 12h18';
const ICON_MARGIN_V = 'M4 3h16|M4 21h16|M12 3v18';

// Corner radius icon
const ICON_RADIUS =
  'M3 12V5a2 2 0 0 1 2-2h7|M21 12v7a2 2 0 0 1-2 2h-7';

// ---------------------------------------------------------------------------
// CSS Custom Property names (set on panel root, referenced everywhere)
// ---------------------------------------------------------------------------

const V = {
  surface: '--retune-surface',
  surfaceHover: '--retune-surface-hover',
  text: '--retune-text',
  textSecondary: '--retune-text-secondary',
  textTertiary: '--retune-text-tertiary',
  border: '--retune-border',
  inputBg: '--retune-input-bg',
  blueBg: '--retune-blue-bg',
  blueText: '--retune-blue-text',
  blue500: '--retune-blue-500',
  black: '--retune-black',
  white: '--retune-white',
} as const;

// Resolved dark-mode values (scraped from retune.dev)
const TOKENS: Record<string, string> = {
  [V.surface]: 'color-mix(in srgb, #1c1917 95%, #ffffff)',
  [V.surfaceHover]: 'rgba(255,255,255,0.05)',
  [V.text]: 'rgba(255,255,255,0.9)',
  [V.textSecondary]: 'rgba(255,255,255,0.7)',
  [V.textTertiary]: 'rgba(255,255,255,0.5)',
  [V.border]: 'rgba(255,255,255,0.1)',
  [V.inputBg]: 'rgba(255,255,255,0.08)',
  [V.blueBg]: 'color-mix(in srgb, #0768CF 50%, transparent)',
  [V.blueText]: '#0D99FF',
  [V.blue500]: '#0D99FF',
  [V.black]: '#1c1917',
  [V.white]: '#ffffff',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 280;
const FONT = 'system-ui, -apple-system, sans-serif';
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

// Shorthand accessors for var() references
const tv = (name: string) => `var(${name})`;

// ---------------------------------------------------------------------------
// Tree node type for the Elements tab
// ---------------------------------------------------------------------------

interface TreeNode {
  element: HTMLElement;
  depth: number;
  children: TreeNode[];
  expanded: boolean;
  tagName: string;
  displayName: string;
  isComponent: boolean;
}

// ---------------------------------------------------------------------------
// PropertyPanel
// ---------------------------------------------------------------------------

export class PropertyPanel {
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private cleanups: Array<() => void> = [];
  private changeCallback: PropertyChangeCallback | null = null;
  private selectCallback: ElementSelectCallback | null = null;
  private activeTab: 'elements' | 'design' = 'design';
  private tabContentEl: HTMLDivElement | null = null;
  private controls: DetectedControls | null = null;
  private computedStyles: Record<string, string> = {};
  private originalValues: Record<string, string> = {};
  private selectedElement: HTMLElement | null = null;
  private treeRoot: TreeNode | null = null;

  constructor(shadowRoot: ShadowRoot) {
    this.shadow = shadowRoot;
    this.container = document.createElement('div');
    this.applyContainerStyles();
    this.shadow.appendChild(this.container);
  }

  // -----------------------------------------------------------------------
  // Container styles - set CSS custom properties on the root
  // -----------------------------------------------------------------------

  private applyContainerStyles(): void {
    // Apply CSS custom properties
    for (const [prop, value] of Object.entries(TOKENS)) {
      this.container.style.setProperty(prop, value);
    }

    Object.assign(this.container.style, {
      position: 'fixed',
      right: '16px',
      bottom: '68px',
      width: PANEL_WIDTH + 'px',
      maxHeight: 'calc(100vh - 84px)',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      background: tv(V.surface),
      borderRadius: '16px',
      border: '1px solid ' + tv(V.border),
      boxShadow:
        '0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.04)',
      pointerEvents: 'auto',
      fontFamily: FONT,
      fontSize: '13px',
      color: tv(V.text),
      zIndex: '2147483647',
      opacity: '0',
      transform: 'translateY(12px)',
    });

    requestAnimationFrame(() => {
      this.container.style.transition =
        'opacity 150ms ' + EASE + ', transform 150ms ' + EASE;
      this.container.style.opacity = '1';
      this.container.style.transform = 'translateY(0)';
    });

    // Hide scrollbar for webkit
    const style = document.createElement('style');
    style.textContent =
      ':host ::-webkit-scrollbar { display: none; }\n' +
      '.improv-pp-retune::-webkit-scrollbar { display: none; }';
    this.shadow.appendChild(style);
    this.container.classList.add('improv-pp-retune');
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  render(
    controls: DetectedControls,
    computedStyles: Record<string, string>,
  ): void {
    this.cleanup();
    this.clearContainer();
    this.controls = controls;
    this.computedStyles = computedStyles;

    // Capture initial values for per-field reset tracking
    this.originalValues = {};
    for (const key of Object.keys(computedStyles)) {
      this.originalValues[key] = computedStyles[key];
    }

    // Build element tree from document.body
    this.treeRoot = this.buildTree(document.body, 0);

    // Tab bar
    this.buildTabBar();

    // Tab content area
    this.tabContentEl = document.createElement('div');
    this.container.appendChild(this.tabContentEl);

    // Render active tab
    this.renderTabContent();
  }

  onPropertyChange(callback: PropertyChangeCallback): void {
    this.changeCallback = callback;
  }

  onElementSelect(callback: ElementSelectCallback): void {
    this.selectCallback = callback;
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
    if (this.shadow.contains(this.container)) {
      this.shadow.removeChild(this.container);
    }
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private cleanup(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
  }

  private clearContainer(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  // -----------------------------------------------------------------------
  // Tab bar (Retune-exact: padding 4px 8px, border-bottom 1px solid border)
  // -----------------------------------------------------------------------

  private buildTabBar(): void {
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      display: 'flex',
      alignItems: 'center',
      padding: '4px 8px',
      borderBottom: '1px solid ' + tv(V.border),
      position: 'relative',
    });

    // Sliding pill indicator (behind tabs)
    const pill = document.createElement('div');
    Object.assign(pill.style, {
      position: 'absolute',
      height: '32px',
      background: tv(V.inputBg),
      borderRadius: '8px',
      transition: 'all 0.2s ' + EASE,
      pointerEvents: 'none',
    });
    bar.appendChild(pill);

    const tabs: HTMLButtonElement[] = [];
    const tabDefs: Array<{ label: string; id: 'elements' | 'design' }> = [
      { label: 'Elements', id: 'elements' },
      { label: 'Design', id: 'design' },
    ];

    for (const def of tabDefs) {
      const btn = document.createElement('button');
      btn.textContent = def.label;
      const isActive = this.activeTab === def.id;

      Object.assign(btn.style, {
        background: 'none',
        border: 'none',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: '500',
        fontFamily: FONT,
        color: isActive ? tv(V.text) : tv(V.textTertiary),
        cursor: 'pointer',
        position: 'relative',
        zIndex: '1',
        transition: 'color 150ms ' + EASE,
      });

      const onClick = () => {
        this.activeTab = def.id;
        for (let i = 0; i < tabs.length; i++) {
          const t = tabs[i];
          t.style.color =
            tabDefs[i].id === def.id ? tv(V.text) : tv(V.textTertiary);
        }
        this.updatePillPosition(pill, tabs, tabDefs);
        this.renderTabContent();
      };
      btn.addEventListener('click', onClick);
      this.cleanups.push(() => btn.removeEventListener('click', onClick));

      tabs.push(btn);
      bar.appendChild(btn);
    }

    // Version text on right
    const version = document.createElement('span');
    version.textContent = 'v0.1';
    Object.assign(version.style, {
      fontSize: '11px',
      color: tv(V.textTertiary),
      marginLeft: 'auto',
      paddingRight: '8px',
      flexShrink: '0',
    });

    bar.appendChild(version);
    this.container.appendChild(bar);

    // Position pill after layout
    requestAnimationFrame(() => {
      this.updatePillPosition(pill, tabs, tabDefs);
    });
  }

  private updatePillPosition(
    pill: HTMLDivElement,
    tabs: HTMLButtonElement[],
    tabDefs: Array<{ id: string }>,
  ): void {
    const activeIdx = tabDefs.findIndex((d) => d.id === this.activeTab);
    if (activeIdx < 0 || !tabs[activeIdx]) return;
    const btn = tabs[activeIdx];
    const parent = btn.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const offsetLeft = btnRect.left - parentRect.left;
    pill.style.width = btnRect.width + 'px';
    pill.style.transform = 'translateX(' + offsetLeft + 'px)';
  }

  private renderTabContent(): void {
    if (!this.tabContentEl) return;
    while (this.tabContentEl.firstChild) {
      this.tabContentEl.removeChild(this.tabContentEl.firstChild);
    }

    if (this.activeTab === 'design') {
      this.buildDesignTab(this.tabContentEl);
    } else {
      this.buildElementsTab(this.tabContentEl);
    }
  }

  // -----------------------------------------------------------------------
  // Elements tab - DOM tree
  // -----------------------------------------------------------------------

  private buildTree(element: HTMLElement, depth: number): TreeNode {
    const tagName = element.tagName.toLowerCase();
    const isComponent = this.isFrameworkComponent(element);
    const displayName = this.getNodeDisplayName(element);

    const node: TreeNode = {
      element,
      depth,
      children: [],
      expanded: depth < 2,
      tagName,
      displayName,
      isComponent,
    };

    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i] as HTMLElement;
      if (!child || child.nodeType !== 1) continue;
      // Skip our own panel
      if (
        child.tagName === 'IMPROV-PANEL' ||
        child.classList.contains('improv-pp-retune')
      )
        continue;
      // Skip script/style/noscript
      const tag = child.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
      node.children.push(this.buildTree(child, depth + 1));
    }

    return node;
  }

  private isFrameworkComponent(el: HTMLElement): boolean {
    // Check for React/Vue/Svelte component markers
    for (const attr of el.getAttributeNames()) {
      if (
        attr.startsWith('data-reactroot') ||
        attr.startsWith('data-v-') ||
        attr.startsWith('data-svelte')
      )
        return true;
    }
    // Check for custom elements (web components)
    if (el.tagName.includes('-')) return true;
    return false;
  }

  private getNodeDisplayName(el: HTMLElement): string {
    // Prefer class name
    if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.split(/\s+/)[0];
      if (firstClass && firstClass.length < 30) {
        return '.' + firstClass;
      }
    }
    // Then id
    if (el.id) {
      return '#' + el.id;
    }
    // Then text content (truncated)
    const text = el.textContent?.trim();
    if (text && text.length > 0) {
      const truncated = text.length > 30 ? text.substring(0, 27) + '...' : text;
      // Only show text if this element has direct text nodes
      let hasDirectText = false;
      for (const child of el.childNodes) {
        if (child.nodeType === 3 && child.textContent?.trim()) {
          hasDirectText = true;
          break;
        }
      }
      if (hasDirectText) return truncated;
    }
    // Fallback to tag
    return el.tagName.toLowerCase();
  }

  private buildElementsTab(parent: HTMLDivElement): void {
    const treeContainer = document.createElement('div');
    Object.assign(treeContainer.style, {
      padding: '4px 0',
      overflowX: 'auto',
    });

    if (this.treeRoot) {
      this.renderTreeNode(treeContainer, this.treeRoot);
    }

    parent.appendChild(treeContainer);
  }

  private renderTreeNode(container: HTMLElement, node: TreeNode): void {
    const row = document.createElement('div');
    const paddingLeft = node.depth * 20 + 12;
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      height: '32px',
      paddingLeft: paddingLeft + 'px',
      paddingRight: '8px',
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'background 0.12s',
    });

    // Check if this is the selected element
    const isSelected = node.element === this.selectedElement;
    if (isSelected) {
      row.style.background = tv(V.blueBg);
    }

    // Hover
    const onEnter = () => {
      if (!isSelected) {
        row.style.background = tv(V.surfaceHover);
      }
    };
    const onLeave = () => {
      if (!isSelected) {
        row.style.background = 'transparent';
      }
    };
    row.addEventListener('mouseenter', onEnter);
    row.addEventListener('mouseleave', onLeave);
    this.cleanups.push(() => {
      row.removeEventListener('mouseenter', onEnter);
      row.removeEventListener('mouseleave', onLeave);
    });

    // Arrow (expand/collapse) - 16x16
    const arrowWrap = document.createElement('div');
    Object.assign(arrowWrap.style, {
      width: '16px',
      height: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      marginRight: '4px',
    });

    if (node.children.length > 0) {
      const arrow = chevronRightIcon(16);
      Object.assign(arrow.style, {
        transition: 'transform 0.12s',
        transform: node.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        color: tv(V.textTertiary),
      });
      arrowWrap.appendChild(arrow);

      const onArrowClick = (e: MouseEvent) => {
        e.stopPropagation();
        node.expanded = !node.expanded;
        arrow.style.transform = node.expanded
          ? 'rotate(90deg)'
          : 'rotate(0deg)';
        // Toggle children visibility
        const childContainer = row.nextElementSibling as HTMLElement | null;
        if (childContainer && childContainer.dataset.treeChildren === 'true') {
          childContainer.style.display = node.expanded ? 'block' : 'none';
        }
      };
      arrowWrap.addEventListener('click', onArrowClick);
      arrowWrap.style.cursor = 'pointer';
      this.cleanups.push(() =>
        arrowWrap.removeEventListener('click', onArrowClick),
      );
    }
    row.appendChild(arrowWrap);

    // Icon - 16x16 (tag icon for DOM, component icon for framework)
    const iconWrap = document.createElement('div');
    Object.assign(iconWrap.style, {
      width: '16px',
      height: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      marginRight: '6px',
      color: node.isComponent ? tv(V.blueText) : tv(V.textTertiary),
    });
    iconWrap.appendChild(
      node.isComponent ? componentIcon(16) : codeTagIcon(16),
    );
    row.appendChild(iconWrap);

    // Name
    const nameEl = document.createElement('span');
    nameEl.textContent = node.displayName;
    Object.assign(nameEl.style, {
      fontSize: '13px',
      fontWeight: '400',
      color: isSelected ? tv(V.text) : tv(V.text),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: '1',
      minWidth: '0',
    });
    row.appendChild(nameEl);

    // Click to select element
    const onRowClick = () => {
      this.selectedElement = node.element;
      this.selectCallback?.(node.element);
      // Re-render tree to update selection highlighting
      if (this.tabContentEl) {
        this.renderTabContent();
      }
    };
    row.addEventListener('click', onRowClick);
    this.cleanups.push(() => row.removeEventListener('click', onRowClick));

    container.appendChild(row);

    // Children container
    if (node.children.length > 0) {
      const childContainer = document.createElement('div');
      childContainer.dataset.treeChildren = 'true';
      childContainer.style.display = node.expanded ? 'block' : 'none';
      for (const child of node.children) {
        this.renderTreeNode(childContainer, child);
      }
      container.appendChild(childContainer);
    }
  }

  // -----------------------------------------------------------------------
  // Design tab - all 11 sections
  // -----------------------------------------------------------------------

  private buildDesignTab(parent: HTMLDivElement): void {
    if (!this.controls) return;
    const cs = this.computedStyles;
    const groupNames = new Set(this.controls.groups.map((g) => g.name));
    const hasTypography = groupNames.has('typography');
    const hasFlex = groupNames.has('flex');
    const hasGrid = groupNames.has('grid');

    // Determine element tag
    const tag = this.getElementTag();

    // 1. Element Tag
    this.buildElementTagSection(parent, tag);

    // 2. Position
    this.buildPositionSection(parent, cs);

    // 3. Layout
    this.buildLayoutSection(parent, cs, hasFlex, hasGrid);

    // 4. Spacing
    this.buildSpacingSection(parent, cs);

    // 5. Size
    this.buildSizeSection(parent, cs);

    // 6. Typography (only for text elements)
    if (hasTypography) {
      this.buildTypographySection(parent, cs);
    }

    // 7. Appearance
    this.buildAppearanceSection(parent, cs);

    // 8-11. Collapsed sections
    this.buildCollapsedSection(parent, 'Fill');
    this.buildCollapsedSection(parent, 'Border');
    this.buildCollapsedSection(parent, 'Shadow');
    this.buildCollapsedSection(parent, 'Filters');
  }

  private getElementTag(): string {
    if (!this.controls) return 'div';
    const groups = new Set(this.controls.groups.map((g) => g.name));
    if (groups.has('image')) return 'img';
    if (groups.has('typography')) {
      const fs = parsePx(getVal(this.computedStyles, 'font-size'));
      if (fs >= 28) return 'h1';
      if (fs >= 22) return 'h2';
      if (fs >= 18) return 'h3';
      return 'p';
    }
    if (groups.has('flex') || groups.has('grid')) return 'div';
    return 'div';
  }

  // -----------------------------------------------------------------------
  // 1. Element Tag Section
  // -----------------------------------------------------------------------

  private buildElementTagSection(parent: HTMLDivElement, tag: string): void {
    const section = this.createSection();

    // Header with element tag as title
    const header = this.makeSectionHeader(tag);
    section.appendChild(header);

    // Body
    const body = this.makeSectionBody();

    // Target group
    const targetRow = this.makeSectionRow();

    const targetLabel = this.makeGroupLabelInline('Target');
    targetRow.appendChild(targetLabel);

    // Selector pills
    const pillWrap = document.createElement('div');
    Object.assign(pillWrap.style, {
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap',
    });

    const instancePill = this.makeSelectorPill('This instance', true);
    pillWrap.appendChild(instancePill);

    targetRow.appendChild(pillWrap);
    body.appendChild(targetRow);

    // Trigger group
    const triggerRow = this.makeSectionRow();

    const triggerLabel = this.makeGroupLabelInline('Trigger');
    triggerRow.appendChild(triggerLabel);

    const triggerSelect = this.makeSelectControl(
      ['None', 'Hover', 'Focus', 'Active'],
      'None',
      (_val: string) => {
        // State trigger - future feature
      },
    );
    triggerRow.appendChild(triggerSelect);
    body.appendChild(triggerRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // 2. Position Section
  // -----------------------------------------------------------------------

  private buildPositionSection(
    parent: HTMLDivElement,
    cs: Record<string, string>,
  ): void {
    const section = this.createSection();

    const header = this.makeSectionHeader('Position');
    section.appendChild(header);

    const body = this.makeSectionBody();

    // Alignment field
    const alignFieldRow = this.makeSectionRow();
    const alignLabel = this.makeGroupLabelInline('Alignment');
    alignFieldRow.appendChild(alignLabel);
    body.appendChild(alignFieldRow);

    const alignRow = this.makeSectionRow();
    Object.assign(alignRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    });

    // Horizontal alignment group
    const hGroup = this.makeIconButtonGroup(
      [
        { icon: ALIGN_H_LEFT, value: 'left' },
        { icon: ALIGN_H_CENTER, value: 'center' },
        { icon: ALIGN_H_RIGHT, value: 'right' },
      ],
      '',
      (val) => this.emitChange('text-align', val),
    );
    alignRow.appendChild(hGroup);

    // Vertical alignment group
    const display = getVal(cs, 'display') || 'block';
    const isFlexOrGrid =
      display === 'flex' ||
      display === 'inline-flex' ||
      display === 'grid' ||
      display === 'inline-grid';

    const vGroup = this.makeIconButtonGroup(
      [
        { icon: ALIGN_V_TOP, value: 'flex-start' },
        { icon: ALIGN_V_CENTER, value: 'center' },
        { icon: ALIGN_V_BOTTOM, value: 'flex-end' },
      ],
      '',
      (val) => this.emitChange('align-items', val),
    );
    if (!isFlexOrGrid) {
      Object.assign(vGroup.style, {
        opacity: '0.3',
        pointerEvents: 'none',
      });
    }
    alignRow.appendChild(vGroup);

    body.appendChild(alignRow);

    // Position type field
    const positionVal = getVal(cs, 'position') || 'static';
    const typeRow = this.makeSectionRow();
    Object.assign(typeRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });
    const posLabel = this.makeGroupLabelInline('Type');
    typeRow.appendChild(posLabel);
    const posSelect = this.makeSelectControl(
      ['static', 'relative', 'absolute', 'fixed', 'sticky'],
      positionVal,
      (val) => this.emitChange('position', val),
    );
    typeRow.appendChild(posSelect);
    body.appendChild(typeRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // 3. Layout Section
  // -----------------------------------------------------------------------

  private buildLayoutSection(
    parent: HTMLDivElement,
    cs: Record<string, string>,
    hasFlex: boolean,
    _hasGrid: boolean,
  ): void {
    const section = this.createSection();

    const header = this.makeSectionHeader('Layout');
    section.appendChild(header);

    const body = this.makeSectionBody();

    // Determine active display mode
    const display = getVal(cs, 'display') || 'block';
    const flexDir = getVal(cs, 'flex-direction') || 'row';
    let activeDisplay = 'block';
    if (display === 'flex' || display === 'inline-flex') {
      activeDisplay = flexDir === 'column' ? 'flex-col' : 'flex-row';
    } else if (display === 'grid' || display === 'inline-grid') {
      activeDisplay = 'grid';
    }

    // Display field label
    const displayLabelRow = this.makeSectionRow();
    displayLabelRow.appendChild(this.makeGroupLabelInline('Display'));
    body.appendChild(displayLabelRow);

    // Display segmented control with sliding pill
    const displayRow = this.makeSectionRow();
    const segmented = this.makeSegmentedControl(
      [
        { icon: ICON_BLOCK, value: 'block', label: 'Block' },
        { icon: ICON_FLEX_ROW, value: 'flex-row', label: 'Flex Row' },
        { icon: ICON_FLEX_COL, value: 'flex-col', label: 'Flex Column' },
        { icon: ICON_GRID, value: 'grid', label: 'Grid' },
      ],
      activeDisplay,
      (val) => {
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
      },
    );
    displayRow.appendChild(segmented);
    body.appendChild(displayRow);

    // Flex-specific controls: Reverse + Wrap
    if (hasFlex) {
      const flexExtrasRow = this.makeSectionRow();
      Object.assign(flexExtrasRow.style, {
        display: 'flex',
        gap: '8px',
      });

      // Reverse (No dropdown by default)
      const reverseLabel = this.makeGroupLabelInline('Reverse');
      flexExtrasRow.appendChild(reverseLabel);
      const reverseSelect = this.makeSelectControl(
        ['No', 'Yes'],
        flexDir.includes('reverse') ? 'Yes' : 'No',
        (val) => {
          const baseDir =
            activeDisplay === 'flex-col' ? 'column' : 'row';
          this.emitChange(
            'flex-direction',
            val === 'Yes' ? baseDir + '-reverse' : baseDir,
          );
        },
      );
      flexExtrasRow.appendChild(reverseSelect);

      const wrapLabel = this.makeGroupLabelInline('Wrap');
      flexExtrasRow.appendChild(wrapLabel);
      const wrapSelect = this.makeSelectControl(
        ['nowrap', 'wrap', 'wrap-reverse'],
        getVal(cs, 'flex-wrap') || 'nowrap',
        (val) => this.emitChange('flex-wrap', val),
      );
      flexExtrasRow.appendChild(wrapSelect);
      body.appendChild(flexExtrasRow);

      // Gap
      const gapRow = this.makeSectionRow();
      Object.assign(gapRow.style, { display: 'flex', gap: '8px' });
      const gapLabel = this.makeGroupLabelInline('Gap');
      gapRow.appendChild(gapLabel);
      gapRow.appendChild(this.makePropInput('gap', null, cs));
      body.appendChild(gapRow);

      // Justify content
      const justifyRow = this.makeSectionRow();
      Object.assign(justifyRow.style, { display: 'flex', gap: '8px' });
      const justifyLabel = this.makeGroupLabelInline('Justify');
      justifyRow.appendChild(justifyLabel);
      const justifySelect = this.makeSelectControl(
        [
          'flex-start',
          'flex-end',
          'center',
          'space-between',
          'space-around',
          'space-evenly',
        ],
        getVal(cs, 'justify-content') || 'flex-start',
        (val) => this.emitChange('justify-content', val),
      );
      justifyRow.appendChild(justifySelect);
      body.appendChild(justifyRow);

      // Align items
      const alignRow = this.makeSectionRow();
      Object.assign(alignRow.style, { display: 'flex', gap: '8px' });
      const alignLabel = this.makeGroupLabelInline('Align');
      alignRow.appendChild(alignLabel);
      const alignSelect = this.makeSelectControl(
        ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
        getVal(cs, 'align-items') || 'stretch',
        (val) => this.emitChange('align-items', val),
      );
      alignRow.appendChild(alignSelect);
      body.appendChild(alignRow);
    }

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // 4. Spacing Section
  // -----------------------------------------------------------------------

  private buildSpacingSection(
    parent: HTMLDivElement,
    cs: Record<string, string>,
  ): void {
    const section = this.createSection();

    const header = this.makeSectionHeader('Spacing');
    section.appendChild(header);

    const body = this.makeSectionBody();

    // Padding group
    const padRow = this.makeSectionRowWithSplit();
    Object.assign(padRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    const padLabel = this.makeGroupLabelInline('Padding');
    padRow.appendChild(padLabel);

    // Horizontal padding input with icon
    padRow.appendChild(
      this.makePropInput('padding-left', ICON_PADDING_H, cs),
    );

    // Vertical padding input with icon
    padRow.appendChild(
      this.makePropInput('padding-top', ICON_PADDING_V, cs),
    );

    // Split button
    padRow.appendChild(this.makeSplitButton());

    body.appendChild(padRow);

    // Margin group
    const marRow = this.makeSectionRowWithSplit();
    Object.assign(marRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    const marLabel = this.makeGroupLabelInline('Margin');
    marRow.appendChild(marLabel);

    marRow.appendChild(
      this.makePropInput('margin-left', ICON_MARGIN_H, cs),
    );
    marRow.appendChild(
      this.makePropInput('margin-top', ICON_MARGIN_V, cs),
    );
    marRow.appendChild(this.makeSplitButton());

    body.appendChild(marRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // 5. Size Section
  // -----------------------------------------------------------------------

  private buildSizeSection(
    parent: HTMLDivElement,
    cs: Record<string, string>,
  ): void {
    const section = this.createSection();

    const header = this.makeSectionHeader('Size', () => {
      // Add size constraint action
    });
    section.appendChild(header);

    const body = this.makeSectionBody();

    // Width + Height row with labels above
    const labelsRow = this.makeSectionRow();
    Object.assign(labelsRow.style, {
      display: 'flex',
      gap: '8px',
    });
    const wLabelSpan = this.makeGroupLabelInline('Width');
    wLabelSpan.style.flex = '1';
    const hLabelSpan = this.makeGroupLabelInline('Height');
    hLabelSpan.style.flex = '1';
    labelsRow.appendChild(wLabelSpan);
    labelsRow.appendChild(hLabelSpan);
    // Spacer for lock button
    const lockSpacer = document.createElement('div');
    lockSpacer.style.width = '32px';
    lockSpacer.style.flexShrink = '0';
    labelsRow.appendChild(lockSpacer);
    body.appendChild(labelsRow);

    // Combo inputs row
    const whRow = this.makeSectionRow();
    Object.assign(whRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    whRow.appendChild(this.makeComboInput('width', cs));
    whRow.appendChild(this.makeComboInput('height', cs));

    // Lock aspect ratio button (chain icon)
    const lockBtn = document.createElement('button');
    Object.assign(lockBtn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      border: 'none',
      background: 'transparent',
      color: tv(V.textTertiary),
      cursor: 'pointer',
      padding: '0',
      flexShrink: '0',
    });
    lockBtn.appendChild(chainIcon(14));
    const onLockEnter = () => {
      lockBtn.style.background = tv(V.surfaceHover);
    };
    const onLockLeave = () => {
      lockBtn.style.background = 'transparent';
    };
    lockBtn.addEventListener('mouseenter', onLockEnter);
    lockBtn.addEventListener('mouseleave', onLockLeave);
    this.cleanups.push(() => {
      lockBtn.removeEventListener('mouseenter', onLockEnter);
      lockBtn.removeEventListener('mouseleave', onLockLeave);
    });
    whRow.appendChild(lockBtn);

    body.appendChild(whRow);

    // Max W + Max H labels
    const maxLabelsRow = this.makeSectionRow();
    Object.assign(maxLabelsRow.style, {
      display: 'flex',
      gap: '8px',
      marginTop: '4px',
    });
    const mwLabelSpan = this.makeGroupLabelInline('Max W');
    mwLabelSpan.style.flex = '1';
    const mhLabelSpan = this.makeGroupLabelInline('Max H');
    mhLabelSpan.style.flex = '1';
    maxLabelsRow.appendChild(mwLabelSpan);
    maxLabelsRow.appendChild(mhLabelSpan);
    body.appendChild(maxLabelsRow);

    // Max W + Max H inputs
    const maxRow = this.makeSectionRow();
    Object.assign(maxRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    maxRow.appendChild(
      this.makePropInput('max-width', null, cs, 1, true),
    );
    maxRow.appendChild(
      this.makePropInput('max-height', null, cs, 1, true),
    );

    body.appendChild(maxRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // 6. Typography Section
  // -----------------------------------------------------------------------

  private buildTypographySection(
    parent: HTMLDivElement,
    cs: Record<string, string>,
  ): void {
    const section = this.createSection();

    const header = this.makeSectionHeader('Typography');
    section.appendChild(header);

    const body = this.makeSectionBody();

    // Font family picker
    const fontFamily = getVal(cs, 'font-family') || 'system-ui';
    const fontRow = this.makeSectionRow();
    const fontBtn = document.createElement('button');
    Object.assign(fontBtn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      height: '32px',
      padding: '0 8px',
      borderRadius: '8px',
      background: tv(V.inputBg),
      border: 'none',
      color: tv(V.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT,
      cursor: 'pointer',
      textAlign: 'left',
    });
    const firstFont = fontFamily.split(',')[0].trim().replace(/["']/g, '');
    const fontText = document.createElement('span');
    fontText.textContent = firstFont;
    Object.assign(fontText.style, {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    fontBtn.appendChild(fontText);
    fontBtn.appendChild(chevronDownIcon(10));

    const onFontEnter = () => {
      fontBtn.style.background = tv(V.border);
    };
    const onFontLeave = () => {
      fontBtn.style.background = tv(V.inputBg);
    };
    fontBtn.addEventListener('mouseenter', onFontEnter);
    fontBtn.addEventListener('mouseleave', onFontLeave);
    this.cleanups.push(() => {
      fontBtn.removeEventListener('mouseenter', onFontEnter);
      fontBtn.removeEventListener('mouseleave', onFontLeave);
    });

    fontRow.appendChild(fontBtn);
    body.appendChild(fontRow);

    // Size + Weight row
    const sizeWeightRow = this.makeSectionRow();
    Object.assign(sizeWeightRow.style, {
      display: 'flex',
      gap: '8px',
    });

    const sizeLabel = this.makeGroupLabelInline('Size');
    sizeWeightRow.appendChild(sizeLabel);
    sizeWeightRow.appendChild(this.makePropInput('font-size', null, cs));

    const weightLabel = this.makeGroupLabelInline('Weight');
    sizeWeightRow.appendChild(weightLabel);
    const weightVal = getVal(cs, 'font-weight') || '400';
    const weightSelect = this.makeSelectControl(
      ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
      weightVal,
      (val) => this.emitChange('font-weight', val),
    );
    sizeWeightRow.appendChild(weightSelect);
    body.appendChild(sizeWeightRow);

    // Line height + Letter spacing
    const lineLetterRow = this.makeSectionRow();
    Object.assign(lineLetterRow.style, {
      display: 'flex',
      gap: '8px',
    });
    const lhLabel = this.makeGroupLabelInline('Line height');
    lineLetterRow.appendChild(lhLabel);
    lineLetterRow.appendChild(
      this.makeComboInput('line-height', cs, 0.1),
    );

    const lsLabel = this.makeGroupLabelInline('Letter spacing');
    lineLetterRow.appendChild(lsLabel);
    lineLetterRow.appendChild(
      this.makeComboInput('letter-spacing', cs, 0.1),
    );
    body.appendChild(lineLetterRow);

    // Color row (swatch + hex input in one container)
    const colorRow = this.makeSectionRow();
    const colorControl = this.makeColorRow('color', cs);
    colorRow.appendChild(colorControl);
    body.appendChild(colorRow);

    // Text align segmented - 3-option
    const alignRow = this.makeSectionRow();
    Object.assign(alignRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const alignLabel = this.makeGroupLabelInline('Align');
    alignRow.appendChild(alignLabel);

    const currentAlign = getVal(cs, 'text-align') || 'left';
    const alignSeg = this.makeSegmentedControl(
      [
        { icon: TEXT_ALIGN_LEFT, value: 'left', label: 'Left' },
        { icon: TEXT_ALIGN_CENTER, value: 'center', label: 'Center' },
        { icon: TEXT_ALIGN_RIGHT, value: 'right', label: 'Right' },
      ],
      currentAlign,
      (val) => this.emitChange('text-align', val),
    );
    alignRow.appendChild(alignSeg);
    body.appendChild(alignRow);

    // Vertical align segmented - 3-option
    const vAlignRow = this.makeSectionRow();
    Object.assign(vAlignRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const vAlignLabel = this.makeGroupLabelInline('Vertical');
    vAlignRow.appendChild(vAlignLabel);

    const currentVAlign = getVal(cs, 'vertical-align') || 'top';
    let vAlignVal = 'top';
    if (currentVAlign === 'middle') vAlignVal = 'middle';
    else if (currentVAlign === 'bottom') vAlignVal = 'bottom';

    const vAlignSeg = this.makeSegmentedControl(
      [
        { icon: TEXT_VALIGN_TOP, value: 'top', label: 'Top' },
        { icon: TEXT_VALIGN_MIDDLE, value: 'middle', label: 'Middle' },
        { icon: TEXT_VALIGN_BOTTOM, value: 'bottom', label: 'Bottom' },
      ],
      vAlignVal,
      (val) => this.emitChange('vertical-align', val),
    );
    vAlignRow.appendChild(vAlignSeg);
    body.appendChild(vAlignRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // 7. Appearance Section
  // -----------------------------------------------------------------------

  private buildAppearanceSection(
    parent: HTMLDivElement,
    cs: Record<string, string>,
  ): void {
    const section = this.createSection();

    const header = this.makeSectionHeader('Appearance');
    section.appendChild(header);

    const body = this.makeSectionBody();

    // Opacity + Z-index row
    const opZRow = this.makeSectionRow();
    Object.assign(opZRow.style, { display: 'flex', gap: '8px' });

    const opLabel = this.makeGroupLabelInline('Opacity');
    opZRow.appendChild(opLabel);
    opZRow.appendChild(this.makePropInput('opacity', null, cs, 0.05));

    const zLabel = this.makeGroupLabelInline('Z index');
    opZRow.appendChild(zLabel);
    opZRow.appendChild(this.makePropInput('z-index', null, cs, 1));
    body.appendChild(opZRow);

    // Corner radius group with split button
    const radiusRow = this.makeSectionRowWithSplit();
    Object.assign(radiusRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    const radiusLabel = this.makeGroupLabelInline('Corner radius');
    radiusRow.appendChild(radiusLabel);
    radiusRow.appendChild(
      this.makePropInput('border-radius', ICON_RADIUS, cs),
    );
    radiusRow.appendChild(this.makeSplitButton());

    body.appendChild(radiusRow);

    // Overflow row
    const overflowRow = this.makeSectionRow();
    Object.assign(overflowRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });
    const overflowLabel = this.makeGroupLabelInline('Overflow');
    overflowRow.appendChild(overflowLabel);
    const overflowVal = getVal(cs, 'overflow') || 'visible';
    const overflowSelect = this.makeSelectControl(
      ['visible', 'hidden', 'scroll', 'auto'],
      overflowVal,
      (val) => this.emitChange('overflow', val),
    );
    overflowRow.appendChild(overflowSelect);
    body.appendChild(overflowRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // 8-11. Collapsed sections (header only with + button)
  // -----------------------------------------------------------------------

  private buildCollapsedSection(parent: HTMLDivElement, title: string): void {
    const section = this.createSection();
    const header = this.makeSectionHeader(title, () => {
      // Placeholder for add action
    });
    section.appendChild(header);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // Section structure helpers (Retune-exact dimensions)
  // -----------------------------------------------------------------------

  private createSection(): HTMLDivElement {
    const section = document.createElement('div');
    Object.assign(section.style, {
      borderBottom: '1px solid ' + tv(V.border),
    });
    return section;
  }

  private makeSectionHeader(
    title: string,
    onAdd?: () => void,
  ): HTMLDivElement {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px 0 16px',
      height: '44px',
    });

    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    Object.assign(titleEl.style, {
      fontSize: '13px',
      fontWeight: '600',
      color: tv(V.text),
      letterSpacing: '-0.01em',
    });
    header.appendChild(titleEl);

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
        color: tv(V.textTertiary),
        cursor: 'pointer',
        padding: '0',
        opacity: '0',
        transition: 'opacity 120ms, background 120ms',
      });
      addBtn.appendChild(plusIcon(14));

      // Show add button on section hover
      const sectionEl = header.parentElement;
      const onHeaderEnter = () => {
        addBtn.style.opacity = '1';
      };
      const onHeaderLeave = () => {
        addBtn.style.opacity = '0';
      };
      const onBtnEnter = () => {
        addBtn.style.background = tv(V.surfaceHover);
      };
      const onBtnLeave = () => {
        addBtn.style.background = 'transparent';
      };
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
    const body = document.createElement('div');
    Object.assign(body.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingBottom: '16px',
    });
    return body;
  }

  // Row with standard padding: 0 48px 0 16px
  private makeSectionRow(): HTMLDivElement {
    const row = document.createElement('div');
    Object.assign(row.style, {
      padding: '0 48px 0 16px',
    });
    return row;
  }

  // Row with split button padding: 0 8px 0 16px
  private makeSectionRowWithSplit(): HTMLDivElement {
    const row = document.createElement('div');
    Object.assign(row.style, {
      padding: '0 8px 0 16px',
    });
    return row;
  }

  // Group label inline: 11px, weight 500, color textTertiary
  private makeGroupLabelInline(text: string): HTMLSpanElement {
    const label = document.createElement('span');
    label.textContent = text;
    Object.assign(label.style, {
      fontSize: '12px',
      fontWeight: '500',
      color: tv(V.textSecondary),
      flexShrink: '0',
      padding: '0',
    });
    return label;
  }

  // -----------------------------------------------------------------------
  // Selector pill (for Target row)
  // -----------------------------------------------------------------------

  private makeSelectorPill(text: string, active: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      padding: '4px 8px',
      borderRadius: '8px',
      fontSize: '11px',
      fontWeight: '500',
      fontFamily: FONT,
      border: 'none',
      cursor: 'pointer',
      background: active ? tv(V.blueBg) : tv(V.inputBg),
      color: active ? tv(V.blueText) : tv(V.textSecondary),
      transition: 'background 120ms, color 120ms',
    });
    return btn;
  }

  // -----------------------------------------------------------------------
  // Split button (32x32)
  // -----------------------------------------------------------------------

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
      color: tv(V.textTertiary),
      cursor: 'pointer',
      padding: '0',
      flexShrink: '0',
    });
    btn.appendChild(splitIcon(12));

    const onEnter = () => {
      btn.style.background = tv(V.surfaceHover);
    };
    const onLeave = () => {
      btn.style.background = 'transparent';
    };
    btn.addEventListener('mouseenter', onEnter);
    btn.addEventListener('mouseleave', onLeave);
    this.cleanups.push(() => {
      btn.removeEventListener('mouseenter', onEnter);
      btn.removeEventListener('mouseleave', onLeave);
    });

    return btn;
  }

  // -----------------------------------------------------------------------
  // Per-field reset dot (4px, #0D99FF)
  // -----------------------------------------------------------------------

  private makeResetDot(
    property: string,
    currentValue: string,
    onReset: () => void,
  ): HTMLDivElement {
    const dot = document.createElement('div');
    Object.assign(dot.style, {
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      background: tv(V.blue500),
      cursor: 'pointer',
      flexShrink: '0',
      display: 'none',
      position: 'absolute',
      left: '4px',
      top: '50%',
      transform: 'translateY(-50%)',
    });

    // Check if value differs from original
    const origKey = cssPropToCamel(property);
    const origVal =
      this.originalValues[origKey] ?? this.originalValues[property] ?? '';
    if (currentValue !== origVal && currentValue !== '') {
      dot.style.display = 'block';
    }

    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      dot.style.display = 'none';
      onReset();
    };
    dot.addEventListener('click', onClick);
    this.cleanups.push(() => dot.removeEventListener('click', onClick));

    return dot;
  }

  // -----------------------------------------------------------------------
  // PropInput control (Retune-exact: h32, r8, bg inputBg, label 32px)
  // -----------------------------------------------------------------------

  private makePropInput(
    property: string,
    iconPath: string | null,
    computedStyles: Record<string, string>,
    step: number = 1,
    showDash: boolean = false,
  ): HTMLDivElement {
    const rawValue = getVal(computedStyles, property);
    const parsed = parseNumericValue(rawValue);

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      borderRadius: '8px',
      background: tv(V.inputBg),
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      flex: '1',
      minWidth: '0',
    });

    // Hover: bg -> border color (rgba(255,255,255,0.1))
    const onEnter = () => {
      wrapper.style.background = tv(V.border);
    };
    const onLeave = () => {
      if (wrapper.querySelector('input:focus')) return;
      wrapper.style.background = tv(V.inputBg);
    };
    wrapper.addEventListener('mouseenter', onEnter);
    wrapper.addEventListener('mouseleave', onLeave);
    this.cleanups.push(() => {
      wrapper.removeEventListener('mouseenter', onEnter);
      wrapper.removeEventListener('mouseleave', onLeave);
    });

    // Icon label area (32px wide, ew-resize cursor, flex-shrink 0)
    if (iconPath) {
      const labelEl = document.createElement('div');
      Object.assign(labelEl.style, {
        width: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'ew-resize',
        userSelect: 'none',
        flexShrink: '0',
        color: tv(V.textTertiary),
        position: 'relative',
      });

      const icon = svgIcon(12, 12, iconPath);
      labelEl.appendChild(icon);

      // Reset dot inside label area
      const resetDot = this.makeResetDot(property, rawValue, () => {
        const origKey = cssPropToCamel(property);
        const origVal =
          this.originalValues[origKey] ??
          this.originalValues[property] ??
          '';
        input.value = origVal;
        this.emitChange(property, origVal);
      });
      labelEl.appendChild(resetDot);

      wrapper.appendChild(labelEl);

      // Scrub on label area
      if (parsed !== null) {
        const unit = parsed.unit || 'px';
        const cleanup = attachScrub(labelEl, {
          initialValue: parsed.number,
          step,
          onUpdate: (val) => {
            input.value = String(Math.round(val * 1000) / 1000);
          },
          onCommit: (val) => {
            input.value = String(Math.round(val * 1000) / 1000);
            this.emitChange(property, formatNumericValue(val, unit));
          },
        });
        this.cleanups.push(cleanup);
      }
    } else {
      // No icon - still add reset dot
      const resetDot = this.makeResetDot(property, rawValue, () => {
        const origKey = cssPropToCamel(property);
        const origVal =
          this.originalValues[origKey] ??
          this.originalValues[property] ??
          '';
        input.value = origVal;
        this.emitChange(property, origVal);
      });
      wrapper.appendChild(resetDot);
    }

    // Input field
    const input = document.createElement('input');
    input.type = 'text';
    const displayVal = parsed
      ? String(Math.round(parsed.number * 1000) / 1000)
      : rawValue || '';
    input.value = displayVal;
    if (showDash && !displayVal) {
      input.placeholder = '-';
    }
    Object.assign(input.style, {
      flex: '1',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: tv(V.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT,
      padding: '0 8px',
      boxSizing: 'border-box',
      letterSpacing: '-0.005em',
      fontVariantNumeric: 'tabular-nums',
    });

    // Focus: outline 1px solid border
    const onFocus = () => {
      wrapper.style.outline = '1px solid ' + tv(V.border);
      wrapper.style.background = tv(V.border);
    };
    const onBlur = () => {
      wrapper.style.outline = 'none';
      wrapper.style.background = tv(V.inputBg);
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    this.cleanups.push(() => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
    });

    // Commit on Enter or change
    const onCommit = () => {
      const val = input.value.trim();
      if (parsed) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          const unit = parsed.unit || 'px';
          this.emitChange(property, formatNumericValue(num, unit));
        }
      } else {
        this.emitChange(property, val);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onCommit();
        input.blur();
      }
    };
    input.addEventListener('change', onCommit);
    input.addEventListener('keydown', onKeyDown);
    this.cleanups.push(() => {
      input.removeEventListener('change', onCommit);
      input.removeEventListener('keydown', onKeyDown);
    });

    wrapper.appendChild(input);
    return wrapper;
  }

  // -----------------------------------------------------------------------
  // ComboInput (input + dropdown trigger chevron, 32px chevron area)
  // -----------------------------------------------------------------------

  private makeComboInput(
    property: string,
    computedStyles: Record<string, string>,
    step: number = 1,
  ): HTMLDivElement {
    const rawValue = getVal(computedStyles, property);
    const parsed = parseNumericValue(rawValue);

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      borderRadius: '8px',
      background: tv(V.inputBg),
      display: 'flex',
      alignItems: 'center',
      flex: '1',
      minWidth: '0',
    });

    // Hover
    const onEnter = () => {
      wrapper.style.background = tv(V.border);
    };
    const onLeave = () => {
      if (wrapper.querySelector('input:focus')) return;
      wrapper.style.background = tv(V.inputBg);
    };
    wrapper.addEventListener('mouseenter', onEnter);
    wrapper.addEventListener('mouseleave', onLeave);
    this.cleanups.push(() => {
      wrapper.removeEventListener('mouseenter', onEnter);
      wrapper.removeEventListener('mouseleave', onLeave);
    });

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    let displayVal = '';
    if (
      property === 'width' &&
      (rawValue === 'auto' || !rawValue)
    ) {
      displayVal = 'Fill';
    } else if (parsed) {
      displayVal = String(Math.round(parsed.number * 1000) / 1000);
    } else {
      displayVal = rawValue || '';
    }
    input.value = displayVal;
    Object.assign(input.style, {
      flex: '1',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: tv(V.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT,
      paddingLeft: '8px',
      paddingRight: '32px',
      boxSizing: 'border-box',
      letterSpacing: '-0.005em',
      fontVariantNumeric: 'tabular-nums',
    });

    // Focus
    const onFocus = () => {
      wrapper.style.outline = '1px solid ' + tv(V.border);
      wrapper.style.background = tv(V.border);
    };
    const onBlur = () => {
      wrapper.style.outline = 'none';
      wrapper.style.background = tv(V.inputBg);
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    this.cleanups.push(() => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
    });

    // Commit
    const onCommit = () => {
      const val = input.value.trim();
      if (parsed) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          const unit = parsed.unit || 'px';
          this.emitChange(property, formatNumericValue(num, unit));
        }
      } else {
        this.emitChange(property, val);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onCommit();
        input.blur();
      }
    };
    input.addEventListener('change', onCommit);
    input.addEventListener('keydown', onKeyDown);
    this.cleanups.push(() => {
      input.removeEventListener('change', onCommit);
      input.removeEventListener('keydown', onKeyDown);
    });

    wrapper.appendChild(input);

    // Chevron trigger on right (32px wide area)
    const chevronArea = document.createElement('div');
    Object.assign(chevronArea.style, {
      position: 'absolute',
      right: '0',
      top: '0',
      bottom: '0',
      width: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: tv(V.textTertiary),
    });
    chevronArea.appendChild(chevronDownIcon(12));
    wrapper.appendChild(chevronArea);

    return wrapper;
  }

  // -----------------------------------------------------------------------
  // SelectControl (Retune-exact: h32, r8, bg inputBg, 32px chevron area)
  // -----------------------------------------------------------------------

  private makeSelectControl(
    options: string[],
    currentValue: string,
    onChange: (val: string) => void,
  ): HTMLDivElement {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      borderRadius: '8px',
      background: tv(V.inputBg),
      display: 'flex',
      alignItems: 'center',
      flex: '1',
      minWidth: '0',
      cursor: 'pointer',
      padding: '0',
      border: 'none',
    });

    const valueText = document.createElement('span');
    valueText.textContent = currentValue;
    Object.assign(valueText.style, {
      flex: '1',
      fontSize: '11px',
      fontWeight: '450',
      color: tv(V.text),
      paddingLeft: '8px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      textAlign: 'left',
    });

    // Chevron area (32px)
    const chevronWrap = document.createElement('div');
    Object.assign(chevronWrap.style, {
      width: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: tv(V.textTertiary),
      flexShrink: '0',
    });
    chevronWrap.appendChild(chevronDownIcon(10));

    wrapper.appendChild(valueText);
    wrapper.appendChild(chevronWrap);

    // Hover
    const onEnter = () => {
      wrapper.style.background = tv(V.border);
    };
    const onLeave = () => {
      wrapper.style.background = tv(V.inputBg);
    };
    wrapper.addEventListener('mouseenter', onEnter);
    wrapper.addEventListener('mouseleave', onLeave);
    this.cleanups.push(() => {
      wrapper.removeEventListener('mouseenter', onEnter);
      wrapper.removeEventListener('mouseleave', onLeave);
    });

    // Click to show dropdown
    let dropdown: HTMLDivElement | null = null;

    const closeDropdown = () => {
      if (dropdown && dropdown.parentElement) {
        dropdown.parentElement.removeChild(dropdown);
      }
      dropdown = null;
    };

    const onClick = (e: MouseEvent) => {
      e.stopPropagation();

      if (dropdown) {
        closeDropdown();
        return;
      }

      dropdown = document.createElement('div');
      Object.assign(dropdown.style, {
        position: 'absolute',
        top: '34px',
        left: '0',
        right: '0',
        background: '#222',
        borderRadius: '8px',
        border: '1px solid ' + tv(V.border),
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        zIndex: '10',
        maxHeight: '200px',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        padding: '4px',
      });

      for (const opt of options) {
        const item = document.createElement('div');
        const isActive = opt === valueText.textContent;
        Object.assign(item.style, {
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          color: isActive ? tv(V.blueText) : tv(V.textSecondary),
          background: isActive ? tv(V.blueBg) : 'transparent',
          cursor: 'pointer',
        });
        item.textContent = opt;

        const onItemEnter = () => {
          if (!isActive) item.style.background = tv(V.inputBg);
        };
        const onItemLeave = () => {
          if (!isActive) item.style.background = 'transparent';
        };
        const onItemClick = (ev: MouseEvent) => {
          ev.stopPropagation();
          valueText.textContent = opt;
          onChange(opt);
          closeDropdown();
        };
        item.addEventListener('mouseenter', onItemEnter);
        item.addEventListener('mouseleave', onItemLeave);
        item.addEventListener('click', onItemClick);
        this.cleanups.push(() => {
          item.removeEventListener('mouseenter', onItemEnter);
          item.removeEventListener('mouseleave', onItemLeave);
          item.removeEventListener('click', onItemClick);
        });

        dropdown.appendChild(item);
      }

      wrapper.appendChild(dropdown);

      // Close on outside click
      const onDocClick = () => {
        closeDropdown();
        document.removeEventListener('click', onDocClick);
      };
      setTimeout(
        () => document.addEventListener('click', onDocClick),
        0,
      );
      this.cleanups.push(() =>
        document.removeEventListener('click', onDocClick),
      );
    };

    wrapper.addEventListener('click', onClick);
    this.cleanups.push(() =>
      wrapper.removeEventListener('click', onClick),
    );

    return wrapper;
  }

  // -----------------------------------------------------------------------
  // SegmentedControl (Retune-exact: bg inputBg, r8, pad 2px, pill h calc(100%-4px), r6)
  // -----------------------------------------------------------------------

  private makeSegmentedControl(
    items: Array<{ icon: string; value: string; label: string }>,
    activeValue: string,
    onChange: (val: string) => void,
  ): HTMLDivElement {
    const outer = document.createElement('div');
    Object.assign(outer.style, {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      background: tv(V.inputBg),
      borderRadius: '8px',
      padding: '2px',
      flex: '1',
    });

    // Sliding pill
    const pill = document.createElement('div');
    Object.assign(pill.style, {
      position: 'absolute',
      height: 'calc(100% - 4px)',
      background: tv(V.surfaceHover),
      borderRadius: '6px',
      transition: 'transform 0.2s ' + EASE,
      pointerEvents: 'none',
      zIndex: '0',
    });
    outer.appendChild(pill);

    const buttons: HTMLButtonElement[] = [];
    let activeIdx = items.findIndex((i) => i.value === activeValue);
    if (activeIdx < 0) activeIdx = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const btn = document.createElement('button');
      const isActive = i === activeIdx;
      Object.assign(btn.style, {
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '28px',
        border: 'none',
        background: 'transparent',
        color: isActive ? tv(V.text) : tv(V.textTertiary),
        cursor: 'pointer',
        position: 'relative',
        zIndex: '1',
        padding: '0',
        borderRadius: '6px',
        transition: 'color 150ms',
      });
      btn.title = item.label;
      btn.setAttribute('aria-label', item.label);
      btn.appendChild(svgIcon(14, 14, item.icon));

      const onClick = () => {
        activeIdx = i;
        for (let j = 0; j < buttons.length; j++) {
          buttons[j].style.color =
            j === i ? tv(V.text) : tv(V.textTertiary);
        }
        updatePill();
        onChange(item.value);
      };
      btn.addEventListener('click', onClick);
      this.cleanups.push(() =>
        btn.removeEventListener('click', onClick),
      );

      buttons.push(btn);
      outer.appendChild(btn);
    }

    const updatePill = () => {
      if (!buttons[activeIdx]) return;
      const segW = 100 / items.length;
      pill.style.width = segW + '%';
      pill.style.transform =
        'translateX(' + activeIdx * 100 + '%)';
    };

    requestAnimationFrame(updatePill);

    return outer;
  }

  // -----------------------------------------------------------------------
  // Icon button group (for alignment - 28x28, r6)
  // -----------------------------------------------------------------------

  private makeIconButtonGroup(
    items: Array<{ icon: string; value: string }>,
    activeValue: string,
    onChange: (val: string) => void,
  ): HTMLDivElement {
    const group = document.createElement('div');
    Object.assign(group.style, {
      display: 'flex',
      gap: '2px',
    });

    const buttons: HTMLButtonElement[] = [];

    for (const item of items) {
      const btn = document.createElement('button');
      const isActive = item.value === activeValue;
      Object.assign(btn.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: 'none',
        background: isActive ? tv(V.inputBg) : 'transparent',
        color: isActive ? tv(V.text) : tv(V.textTertiary),
        cursor: 'pointer',
        padding: '0',
        transition: 'background 120ms, color 120ms',
      });
      btn.appendChild(svgIcon(18, 18, item.icon));

      const onClick = () => {
        for (const b of buttons) {
          b.style.background = 'transparent';
          b.style.color = tv(V.textTertiary);
        }
        btn.style.background = tv(V.inputBg);
        btn.style.color = tv(V.text);
        onChange(item.value);
      };
      btn.addEventListener('click', onClick);
      this.cleanups.push(() =>
        btn.removeEventListener('click', onClick),
      );

      const onEnter = () => {
        if (btn.style.background !== tv(V.border)) {
          btn.style.background = tv(V.surfaceHover);
        }
      };
      const onLeave = () => {
        if (btn.style.background === tv(V.surfaceHover)) {
          btn.style.background = 'transparent';
        }
      };
      btn.addEventListener('mouseenter', onEnter);
      btn.addEventListener('mouseleave', onLeave);
      this.cleanups.push(() => {
        btn.removeEventListener('mouseenter', onEnter);
        btn.removeEventListener('mouseleave', onLeave);
      });

      buttons.push(btn);
      group.appendChild(btn);
    }

    return group;
  }

  // -----------------------------------------------------------------------
  // ColorRow (Retune-exact: swatch 16x16, inset shadow, hex input in same container)
  // -----------------------------------------------------------------------

  private makeColorRow(
    property: string,
    computedStyles: Record<string, string>,
  ): HTMLDivElement {
    const rawValue = getVal(computedStyles, property);
    const hexValue = parseColor(rawValue);

    // Container row
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      height: '32px',
    });

    // Hex section (flex 1, contains swatch + hex input)
    const hexSection = document.createElement('div');
    Object.assign(hexSection.style, {
      flex: '1',
      display: 'flex',
      alignItems: 'center',
      background: tv(V.inputBg),
      borderRadius: '8px',
      overflow: 'hidden',
      height: '32px',
    });

    // Swatch container (32px wide, centers 16x16 swatch)
    const swatchContainer = document.createElement('div');
    Object.assign(swatchContainer.style, {
      width: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      position: 'relative',
    });

    // Swatch inner (16x16 circle)
    const swatchInner = document.createElement('div');
    Object.assign(swatchInner.style, {
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: hexValue,
      boxShadow: 'rgba(0,0,0,0.1) 0px 0px 0px 1px inset',
    });

    // Hidden native color input over swatch
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = hexValue;
    Object.assign(colorInput.style, {
      position: 'absolute',
      inset: '0',
      opacity: '0',
      width: '100%',
      height: '100%',
      cursor: 'pointer',
      padding: '0',
      border: 'none',
    });
    swatchContainer.appendChild(swatchInner);
    swatchContainer.appendChild(colorInput);

    // Hex text input
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = hexValue;
    Object.assign(hexInput.style, {
      flex: '1',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: tv(V.text),
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT,
      padding: '0 8px',
      boxSizing: 'border-box',
      letterSpacing: '-0.005em',
    });

    const onColorInput = () => {
      swatchInner.style.background = colorInput.value;
      hexInput.value = colorInput.value;
      this.emitChange(property, colorInput.value);
    };
    colorInput.addEventListener('input', onColorInput);
    this.cleanups.push(() =>
      colorInput.removeEventListener('input', onColorInput),
    );

    const onHexChange = () => {
      const val = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{3,6}$/.test(val)) {
        const normalized =
          val.length === 4
            ? '#' +
              val[1] +
              val[1] +
              val[2] +
              val[2] +
              val[3] +
              val[3]
            : val;
        swatchInner.style.background = normalized;
        colorInput.value = normalized;
        this.emitChange(property, normalized);
      }
    };
    hexInput.addEventListener('change', onHexChange);
    this.cleanups.push(() =>
      hexInput.removeEventListener('change', onHexChange),
    );

    // Focus style on hex section
    const onFocus = () => {
      hexSection.style.outline = '1px solid ' + tv(V.border);
    };
    const onBlur = () => {
      hexSection.style.outline = 'none';
    };
    hexInput.addEventListener('focus', onFocus);
    hexInput.addEventListener('blur', onBlur);
    this.cleanups.push(() => {
      hexInput.removeEventListener('focus', onFocus);
      hexInput.removeEventListener('blur', onBlur);
    });

    hexSection.appendChild(swatchContainer);
    hexSection.appendChild(hexInput);

    row.appendChild(hexSection);
    return row;
  }

  // -----------------------------------------------------------------------
  // Change emission
  // -----------------------------------------------------------------------

  private emitChange(property: string, value: string): void {
    this.changeCallback?.(property, value);
  }
}
