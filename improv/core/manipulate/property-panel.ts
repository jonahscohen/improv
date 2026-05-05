import { DetectedControls, ControlDefinition, ControlGroup } from './control-detector.js';
import { attachScrub, parseNumericValue, formatNumericValue } from './scrub.js';

type PropertyChangeCallback = (property: string, value: string) => void;

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

function rgbaAlpha(val: string): number {
  const match = val.match(
    /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)$/,
  );
  return match ? parseFloat(match[1]) : 1;
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

function fmtVal(val: string): string {
  return String(Math.round(parsePx(val)));
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

function svgIcon(w: number, h: number, pathData: string): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '2');
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

function svgIconMulti(w: number, h: number, elements: Array<{ tag: string; attrs: Record<string, string> }>): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '2');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  for (const item of elements) {
    const child = document.createElementNS('http://www.w3.org/2000/svg', item.tag);
    for (const [k, v] of Object.entries(item.attrs)) {
      child.setAttribute(k, v);
    }
    el.appendChild(child);
  }
  return el;
}

// Lucide chevron-down
function chevronDownIcon(size: number = 12): SVGSVGElement {
  return svgIcon(size, size, 'M6 9l6 6l6-6');
}

// Lucide plus
function plusIcon(size: number = 14): SVGSVGElement {
  return svgIcon(size, size, 'M12 5v14|M5 12h14');
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

// Spacing icons (simplified box representations)
const ICON_PADDING_H = 'M7 4v16|M17 4v16|M7 12h10';
const ICON_PADDING_V = 'M4 7h16|M4 17h16|M12 7v10';
const ICON_MARGIN_H = 'M3 4v16|M21 4v16|M3 12h18';
const ICON_MARGIN_V = 'M4 3h16|M4 21h16|M12 3v18';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 280;
const FONT = 'system-ui, -apple-system, sans-serif';
const BG = '#1a1a1a';
const BORDER = 'rgba(255,255,255,0.06)';
const SHADOW = '0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.04)';
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

const TEXT_PRIMARY = 'rgba(255,255,255,0.85)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.65)';
const TEXT_TERTIARY = 'rgba(255,255,255,0.45)';
const TEXT_DIM = 'rgba(255,255,255,0.35)';
const TEXT_FAINT = 'rgba(255,255,255,0.25)';

const INPUT_BG = 'rgba(255,255,255,0.05)';
const INPUT_BG_HOVER = 'rgba(255,255,255,0.08)';
const INPUT_BG_ACTIVE = 'rgba(255,255,255,0.1)';
const INPUT_FOCUS = 'rgba(255,255,255,0.12)';

const PILL_ACTIVE_BG = 'rgba(59,130,246,0.15)';
const PILL_ACTIVE_COLOR = '#6dacfc';

// ---------------------------------------------------------------------------
// PropertyPanel
// ---------------------------------------------------------------------------

export class PropertyPanel {
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private cleanups: Array<() => void> = [];
  private changeCallback: PropertyChangeCallback | null = null;
  private activeTab: 'elements' | 'design' = 'design';
  private tabContentEl: HTMLDivElement | null = null;
  private controls: DetectedControls | null = null;
  private computedStyles: Record<string, string> = {};

  constructor(shadow: ShadowRoot) {
    this.shadow = shadow;
    this.container = document.createElement('div');
    this.applyContainerStyles();
    this.shadow.appendChild(this.container);
  }

  // -----------------------------------------------------------------------
  // Container styles
  // -----------------------------------------------------------------------

  private applyContainerStyles(): void {
    Object.assign(this.container.style, {
      position: 'fixed',
      right: '16px',
      bottom: '68px',
      width: PANEL_WIDTH + 'px',
      maxHeight: 'calc(100vh - 84px)',
      overflowY: 'auto',
      scrollbarWidth: 'none',
      background: BG,
      borderRadius: '16px',
      border: '1px solid ' + BORDER,
      boxShadow: SHADOW,
      pointerEvents: 'auto',
      fontFamily: FONT,
      fontSize: '13px',
      color: TEXT_PRIMARY,
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

  render(controls: DetectedControls, computedStyles: Record<string, string>): void {
    this.cleanup();
    this.clearContainer();
    this.controls = controls;
    this.computedStyles = computedStyles;

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

  show(): void {
    this.container.style.display = '';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  destroy(): void {
    this.cleanup();
    this.changeCallback = null;
    this.controls = null;
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
  // Tab bar
  // -----------------------------------------------------------------------

  private buildTabBar(): void {
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      display: 'flex',
      alignItems: 'center',
      height: '40px',
      padding: '4px 8px',
      borderBottom: '1px solid ' + BORDER,
      position: 'relative',
    });

    const tabsWrap = document.createElement('div');
    Object.assign(tabsWrap.style, {
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      flex: '1',
    });

    // Sliding pill indicator
    const pill = document.createElement('div');
    Object.assign(pill.style, {
      position: 'absolute',
      height: '28px',
      background: INPUT_BG,
      borderRadius: '8px',
      transition: 'transform 150ms ' + EASE + ', width 150ms ' + EASE,
      pointerEvents: 'none',
    });
    tabsWrap.appendChild(pill);

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
        padding: '0 12px',
        height: '28px',
        fontSize: '12px',
        fontWeight: '500',
        fontFamily: FONT,
        color: isActive ? TEXT_PRIMARY : TEXT_DIM,
        cursor: 'pointer',
        position: 'relative',
        zIndex: '1',
        transition: 'color 150ms ' + EASE,
      });

      const onClick = () => {
        this.activeTab = def.id;
        for (let i = 0; i < tabs.length; i++) {
          const t = tabs[i];
          t.style.color = tabDefs[i].id === def.id ? TEXT_PRIMARY : TEXT_DIM;
        }
        this.updatePillPosition(pill, tabs, tabDefs);
        this.renderTabContent();
      };
      btn.addEventListener('click', onClick);
      this.cleanups.push(() => btn.removeEventListener('click', onClick));

      tabs.push(btn);
      tabsWrap.appendChild(btn);
    }

    // Version text
    const version = document.createElement('span');
    version.textContent = 'v0.1';
    Object.assign(version.style, {
      fontSize: '11px',
      color: TEXT_FAINT,
      marginLeft: 'auto',
      flexShrink: '0',
    });

    bar.appendChild(tabsWrap);
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
  // Elements tab (placeholder)
  // -----------------------------------------------------------------------

  private buildElementsTab(parent: HTMLDivElement): void {
    const empty = document.createElement('div');
    Object.assign(empty.style, {
      padding: '24px 12px',
      textAlign: 'center',
      fontSize: '11px',
      color: TEXT_DIM,
    });
    empty.textContent = 'Element tree coming soon';
    parent.appendChild(empty);
  }

  // -----------------------------------------------------------------------
  // Design tab - all sections
  // -----------------------------------------------------------------------

  private buildDesignTab(parent: HTMLDivElement): void {
    if (!this.controls) return;
    const cs = this.computedStyles;
    const groupNames = new Set(this.controls.groups.map((g) => g.name));
    const hasTypography = groupNames.has('typography');
    const hasFlex = groupNames.has('flex');
    const hasGrid = groupNames.has('grid');
    const hasPosition = groupNames.has('position');

    // Determine element tag
    const tag = this.getElementTag();

    // 1. Element Info
    this.buildElementInfoSection(parent, tag);

    // 2. Position
    this.buildPositionSection(parent, cs, hasPosition);

    // 3. Layout
    this.buildLayoutSection(parent, cs, hasFlex, hasGrid);

    // 4. Spacing
    this.buildSpacingSection(parent, cs);

    // 5. Size
    this.buildSizeSection(parent, cs);

    // 6. Typography (only for text elements)
    if (hasTypography) {
      const typoControls =
        this.controls.groups.find((g) => g.name === 'typography')?.controls ?? [];
      this.buildTypographySection(parent, typoControls, cs);
    }

    // 7. Appearance
    this.buildAppearanceSection(parent, cs);

    // 8. Fill (header only)
    this.buildCollapsedSection(parent, 'Fill');

    // 9. Border (header only)
    this.buildCollapsedSection(parent, 'Border');

    // 10. Shadow (header only)
    this.buildCollapsedSection(parent, 'Shadow');

    // 11. Filters (header only)
    this.buildCollapsedSection(parent, 'Filters');
  }

  private getElementTag(): string {
    // Attempt to read tag from the computed styles if stored, fall back to generic
    // The control-detector groups don't expose the element tag, so we use a heuristic
    // based on which groups are present.
    if (!this.controls) return 'div';
    const groups = new Set(this.controls.groups.map((g) => g.name));
    if (groups.has('image')) return 'img';
    if (groups.has('typography')) {
      // Check font-size to guess heading vs paragraph
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
  // 1. Element Info Section
  // -----------------------------------------------------------------------

  private buildElementInfoSection(parent: HTMLDivElement, tag: string): void {
    const section = document.createElement('div');

    // Header
    const header = this.makeSectionHeader(tag);
    section.appendChild(header);

    // Body
    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '8px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    // Target row
    const targetRow = document.createElement('div');
    Object.assign(targetRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const targetLabel = document.createElement('span');
    targetLabel.textContent = 'Target';
    Object.assign(targetLabel.style, {
      fontSize: '11px',
      color: TEXT_DIM,
      minWidth: '42px',
      flexShrink: '0',
    });
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

    // Trigger row
    const triggerRow = document.createElement('div');
    Object.assign(triggerRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const triggerLabel = document.createElement('span');
    triggerLabel.textContent = 'Trigger';
    Object.assign(triggerLabel.style, {
      fontSize: '11px',
      color: TEXT_DIM,
      minWidth: '42px',
      flexShrink: '0',
    });
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

  private makeSelectorPill(text: string, active: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      padding: '6px 8px',
      borderRadius: '8px',
      fontSize: '11px',
      fontWeight: '500',
      fontFamily: FONT,
      border: 'none',
      cursor: 'pointer',
      background: active ? PILL_ACTIVE_BG : INPUT_BG,
      color: active ? PILL_ACTIVE_COLOR : TEXT_SECONDARY,
      transition: 'background 120ms, color 120ms',
    });
    return btn;
  }

  // -----------------------------------------------------------------------
  // 2. Position Section
  // -----------------------------------------------------------------------

  private buildPositionSection(
    parent: HTMLDivElement,
    cs: Record<string, string>,
    _hasPosition: boolean,
  ): void {
    const section = document.createElement('div');

    const header = this.makeSectionHeader('POSITION');
    section.appendChild(header);

    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '8px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    // Alignment row: two groups of 3 icon buttons
    const alignRow = document.createElement('div');
    Object.assign(alignRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
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
    const vGroup = this.makeIconButtonGroup(
      [
        { icon: ALIGN_V_TOP, value: 'flex-start' },
        { icon: ALIGN_V_CENTER, value: 'center' },
        { icon: ALIGN_V_BOTTOM, value: 'flex-end' },
      ],
      '',
      (val) => this.emitChange('align-items', val),
    );
    alignRow.appendChild(vGroup);

    body.appendChild(alignRow);

    // Position type row
    const positionVal = getVal(cs, 'position') || 'static';
    const posRow = document.createElement('div');
    Object.assign(posRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const posSelect = this.makeSelectControl(
      ['static', 'relative', 'absolute', 'fixed', 'sticky'],
      positionVal,
      (val) => this.emitChange('position', val),
    );
    posRow.appendChild(posSelect);
    body.appendChild(posRow);

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
    hasGrid: boolean,
  ): void {
    const section = document.createElement('div');

    const header = this.makeSectionHeader('LAYOUT');
    section.appendChild(header);

    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '8px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    // Determine active display mode
    const display = getVal(cs, 'display') || 'block';
    const flexDir = getVal(cs, 'flex-direction') || 'row';
    let activeDisplay = 'block';
    if (display === 'flex' || display === 'inline-flex') {
      activeDisplay = flexDir === 'column' ? 'flex-col' : 'flex-row';
    } else if (display === 'grid' || display === 'inline-grid') {
      activeDisplay = 'grid';
    }

    // Display segmented control
    const segmented = this.makeSegmentedControl(
      [
        { icon: ICON_BLOCK, value: 'block', label: 'Block' },
        { icon: ICON_FLEX_ROW, value: 'flex-row', label: 'Flex Row' },
        { icon: ICON_FLEX_COL, value: 'flex-col', label: 'Flex Col' },
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
    body.appendChild(segmented);

    // Show flex-specific controls if flex
    if (hasFlex) {
      const gapInput = this.makePropInput('gap', 'Gap', cs);
      body.appendChild(gapInput);

      const wrapSelect = this.makeSelectControl(
        ['nowrap', 'wrap', 'wrap-reverse'],
        getVal(cs, 'flex-wrap') || 'nowrap',
        (val) => this.emitChange('flex-wrap', val),
      );
      body.appendChild(wrapSelect);

      // Justify content
      const justifySelect = this.makeSelectControl(
        ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
        getVal(cs, 'justify-content') || 'flex-start',
        (val) => this.emitChange('justify-content', val),
      );
      body.appendChild(justifySelect);

      // Align items
      const alignSelect = this.makeSelectControl(
        ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
        getVal(cs, 'align-items') || 'stretch',
        (val) => this.emitChange('align-items', val),
      );
      body.appendChild(alignSelect);
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
    const section = document.createElement('div');

    const header = this.makeSectionHeader('SPACING');
    section.appendChild(header);

    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '8px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    // Padding group
    const paddingGroup = document.createElement('div');
    Object.assign(paddingGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    const padLabel = document.createElement('span');
    padLabel.textContent = 'Padding';
    Object.assign(padLabel.style, {
      fontSize: '11px',
      color: TEXT_DIM,
      minWidth: '48px',
      flexShrink: '0',
    });
    paddingGroup.appendChild(padLabel);

    // Horizontal padding (left/right shorthand)
    const padH = this.makePropInput('padding-left', ICON_PADDING_H, cs, 1, true);
    paddingGroup.appendChild(padH);

    // Vertical padding (top/bottom shorthand)
    const padV = this.makePropInput('padding-top', ICON_PADDING_V, cs, 1, true);
    paddingGroup.appendChild(padV);

    body.appendChild(paddingGroup);

    // Margin group
    const marginGroup = document.createElement('div');
    Object.assign(marginGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    const marLabel = document.createElement('span');
    marLabel.textContent = 'Margin';
    Object.assign(marLabel.style, {
      fontSize: '11px',
      color: TEXT_DIM,
      minWidth: '48px',
      flexShrink: '0',
    });
    marginGroup.appendChild(marLabel);

    const marH = this.makePropInput('margin-left', ICON_MARGIN_H, cs, 1, true);
    marginGroup.appendChild(marH);

    const marV = this.makePropInput('margin-top', ICON_MARGIN_V, cs, 1, true);
    marginGroup.appendChild(marV);

    body.appendChild(marginGroup);

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
    const section = document.createElement('div');

    const header = this.makeSectionHeader('SIZE');
    section.appendChild(header);

    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '8px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    // Width + Height side by side
    const whRow = document.createElement('div');
    Object.assign(whRow.style, { display: 'flex', gap: '8px' });

    whRow.appendChild(this.makePropInput('width', 'W', cs));
    whRow.appendChild(this.makePropInput('height', 'H', cs));
    body.appendChild(whRow);

    // Max W + Max H
    const maxRow = document.createElement('div');
    Object.assign(maxRow.style, { display: 'flex', gap: '8px' });

    maxRow.appendChild(this.makePropInput('max-width', 'MW', cs));
    maxRow.appendChild(this.makePropInput('max-height', 'MH', cs));
    body.appendChild(maxRow);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // 6. Typography Section
  // -----------------------------------------------------------------------

  private buildTypographySection(
    parent: HTMLDivElement,
    controls: ControlDefinition[],
    cs: Record<string, string>,
  ): void {
    const section = document.createElement('div');

    const header = this.makeSectionHeader('TYPOGRAPHY');
    section.appendChild(header);

    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '8px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    // Font family picker button
    const fontFamily = getVal(cs, 'font-family') || 'system-ui';
    const fontBtn = document.createElement('button');
    Object.assign(fontBtn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      height: '32px',
      padding: '0 8px',
      borderRadius: '8px',
      background: INPUT_BG,
      border: 'none',
      color: TEXT_PRIMARY,
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT,
      cursor: 'pointer',
      textAlign: 'left',
    });
    // Show just the first font name
    const firstFont = fontFamily.split(',')[0].trim().replace(/["']/g, '');
    const fontText = document.createElement('span');
    fontText.textContent = firstFont;
    fontText.style.overflow = 'hidden';
    fontText.style.textOverflow = 'ellipsis';
    fontText.style.whiteSpace = 'nowrap';
    fontBtn.appendChild(fontText);
    fontBtn.appendChild(chevronDownIcon(10));
    body.appendChild(fontBtn);

    // Size + Weight row
    const sizeWeightRow = document.createElement('div');
    Object.assign(sizeWeightRow.style, { display: 'flex', gap: '8px' });

    sizeWeightRow.appendChild(this.makePropInput('font-size', 'Sz', cs));

    const weightVal = getVal(cs, 'font-weight') || '400';
    const weightSelect = this.makeSelectControl(
      ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
      weightVal,
      (val) => this.emitChange('font-weight', val),
    );
    sizeWeightRow.appendChild(weightSelect);
    body.appendChild(sizeWeightRow);

    // Line height + Letter spacing
    const lineLetterRow = document.createElement('div');
    Object.assign(lineLetterRow.style, { display: 'flex', gap: '8px' });

    lineLetterRow.appendChild(this.makePropInput('line-height', 'LH', cs, 0.1));
    lineLetterRow.appendChild(this.makePropInput('letter-spacing', 'LS', cs, 0.1));
    body.appendChild(lineLetterRow);

    // Color row
    const colorRow = this.makeColorRow('color', cs);
    body.appendChild(colorRow);

    // Text align segmented
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
    body.appendChild(alignSeg);

    // Vertical align segmented
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
    body.appendChild(vAlignSeg);

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
    const section = document.createElement('div');

    const header = this.makeSectionHeader('APPEARANCE');
    section.appendChild(header);

    const body = document.createElement('div');
    Object.assign(body.style, {
      padding: '8px 12px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    // Opacity + Z-index
    const opZRow = document.createElement('div');
    Object.assign(opZRow.style, { display: 'flex', gap: '8px' });

    opZRow.appendChild(this.makePropInput('opacity', 'Op', cs, 0.05));
    opZRow.appendChild(this.makePropInput('z-index', 'Z', cs, 1));
    body.appendChild(opZRow);

    // Corner radius
    const radiusInput = this.makePropInput('border-radius', 'R', cs);
    body.appendChild(radiusInput);

    // Overflow
    const overflowVal = getVal(cs, 'overflow') || 'visible';
    const overflowSelect = this.makeSelectControl(
      ['visible', 'hidden', 'scroll', 'auto'],
      overflowVal,
      (val) => this.emitChange('overflow', val),
    );
    body.appendChild(overflowSelect);

    section.appendChild(body);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // Collapsed section (header only with + button)
  // -----------------------------------------------------------------------

  private buildCollapsedSection(parent: HTMLDivElement, title: string): void {
    const section = document.createElement('div');
    const header = this.makeSectionHeader(title, () => {
      // Placeholder for add action
    });
    section.appendChild(header);
    parent.appendChild(section);
  }

  // -----------------------------------------------------------------------
  // Section header
  // -----------------------------------------------------------------------

  private makeSectionHeader(
    title: string,
    onAdd?: () => void,
  ): HTMLDivElement {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '40px',
      padding: '0 12px',
      borderBottom: '1px solid ' + BORDER,
    });

    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    Object.assign(titleEl.style, {
      fontSize: '11px',
      fontWeight: '500',
      color: TEXT_TERTIARY,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    });
    header.appendChild(titleEl);

    if (onAdd) {
      const addBtn = document.createElement('button');
      Object.assign(addBtn.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: TEXT_TERTIARY,
        cursor: 'pointer',
        padding: '0',
      });
      addBtn.appendChild(plusIcon(14));

      const onEnter = () => { addBtn.style.background = INPUT_BG; };
      const onLeave = () => { addBtn.style.background = 'transparent'; };
      addBtn.addEventListener('mouseenter', onEnter);
      addBtn.addEventListener('mouseleave', onLeave);
      addBtn.addEventListener('click', onAdd);
      this.cleanups.push(() => {
        addBtn.removeEventListener('mouseenter', onEnter);
        addBtn.removeEventListener('mouseleave', onLeave);
        addBtn.removeEventListener('click', onAdd);
      });

      header.appendChild(addBtn);
    }

    return header;
  }

  // -----------------------------------------------------------------------
  // PropInput control
  // -----------------------------------------------------------------------

  private makePropInput(
    property: string,
    label: string,
    computedStyles: Record<string, string>,
    step: number = 1,
    isIcon: boolean = false,
  ): HTMLDivElement {
    const rawValue = getVal(computedStyles, property);
    const parsed = parseNumericValue(rawValue);

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'relative',
      height: '32px',
      borderRadius: '8px',
      background: INPUT_BG,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      flex: '1',
      minWidth: '0',
    });

    // Hover
    const onEnter = () => { wrapper.style.background = INPUT_BG_HOVER; };
    const onLeave = () => {
      if (wrapper.querySelector('input:focus')) return;
      wrapper.style.background = INPUT_BG;
    };
    wrapper.addEventListener('mouseenter', onEnter);
    wrapper.addEventListener('mouseleave', onLeave);
    this.cleanups.push(() => {
      wrapper.removeEventListener('mouseenter', onEnter);
      wrapper.removeEventListener('mouseleave', onLeave);
    });

    // Label area (28px wide, ew-resize cursor)
    const labelEl = document.createElement('div');
    Object.assign(labelEl.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      bottom: '0',
      width: '28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'ew-resize',
      userSelect: 'none',
      flexShrink: '0',
      zIndex: '1',
    });

    if (isIcon) {
      // Render a small icon from the label (which is SVG path data)
      const icon = svgIcon(12, 12, label);
      icon.style.color = TEXT_DIM;
      labelEl.appendChild(icon);
    } else {
      const labelText = document.createElement('span');
      labelText.textContent = label;
      Object.assign(labelText.style, {
        fontSize: '11px',
        color: TEXT_DIM,
        pointerEvents: 'none',
      });
      labelEl.appendChild(labelText);
    }

    // Input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = parsed ? String(Math.round(parsed.number * 1000) / 1000) : rawValue || '';
    Object.assign(input.style, {
      width: '100%',
      height: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: TEXT_PRIMARY,
      fontSize: '11px',
      fontWeight: '450',
      fontFamily: FONT,
      paddingLeft: '28px',
      paddingRight: '6px',
      boxSizing: 'border-box',
      fontVariantNumeric: 'tabular-nums',
    });

    // Focus outline on wrapper
    const onFocus = () => {
      wrapper.style.outline = '1px solid ' + INPUT_FOCUS;
      wrapper.style.background = INPUT_BG_HOVER;
    };
    const onBlur = () => {
      wrapper.style.outline = 'none';
      wrapper.style.background = INPUT_BG;
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    this.cleanups.push(() => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
    });

    // Commit on Enter or blur
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

    wrapper.appendChild(labelEl);
    wrapper.appendChild(input);
    return wrapper;
  }

  // -----------------------------------------------------------------------
  // SelectControl
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
      background: INPUT_BG,
      display: 'flex',
      alignItems: 'center',
      flex: '1',
      minWidth: '0',
      cursor: 'pointer',
    });

    const valueText = document.createElement('span');
    valueText.textContent = currentValue;
    Object.assign(valueText.style, {
      flex: '1',
      fontSize: '11px',
      fontWeight: '450',
      color: TEXT_PRIMARY,
      padding: '0 8px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });

    const chevron = chevronDownIcon(10);
    Object.assign(chevron.style, {
      flexShrink: '0',
      marginRight: '8px',
      color: TEXT_DIM,
    });

    wrapper.appendChild(valueText);
    wrapper.appendChild(chevron);

    // Hover
    const onEnter = () => { wrapper.style.background = INPUT_BG_HOVER; };
    const onLeave = () => { wrapper.style.background = INPUT_BG; };
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
        border: '1px solid ' + BORDER,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        zIndex: '10',
        maxHeight: '200px',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        padding: '4px',
      });

      for (const opt of options) {
        const item = document.createElement('div');
        const isActive = opt === currentValue;
        Object.assign(item.style, {
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          color: isActive ? PILL_ACTIVE_COLOR : TEXT_SECONDARY,
          background: isActive ? PILL_ACTIVE_BG : 'transparent',
          cursor: 'pointer',
        });
        item.textContent = opt;

        const onItemEnter = () => {
          if (!isActive) item.style.background = INPUT_BG;
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
      setTimeout(() => document.addEventListener('click', onDocClick), 0);
      this.cleanups.push(() => document.removeEventListener('click', onDocClick));
    };

    wrapper.addEventListener('click', onClick);
    this.cleanups.push(() => wrapper.removeEventListener('click', onClick));

    return wrapper;
  }

  // -----------------------------------------------------------------------
  // SegmentedControl
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
      background: INPUT_BG,
      borderRadius: '8px',
      height: '28px',
      overflow: 'hidden',
    });

    // Sliding pill
    const pill = document.createElement('div');
    Object.assign(pill.style, {
      position: 'absolute',
      height: '100%',
      background: INPUT_BG_ACTIVE,
      borderRadius: '6px',
      transition: 'transform 150ms ' + EASE + ', width 150ms ' + EASE,
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
        height: '100%',
        border: 'none',
        background: 'transparent',
        color: isActive ? TEXT_PRIMARY : TEXT_DIM,
        cursor: 'pointer',
        position: 'relative',
        zIndex: '1',
        padding: '0',
        transition: 'color 150ms',
      });
      btn.title = item.label;
      btn.appendChild(svgIcon(14, 14, item.icon));

      const onClick = () => {
        activeIdx = i;
        for (let j = 0; j < buttons.length; j++) {
          buttons[j].style.color = j === i ? TEXT_PRIMARY : TEXT_DIM;
        }
        updatePill();
        onChange(item.value);
      };
      btn.addEventListener('click', onClick);
      this.cleanups.push(() => btn.removeEventListener('click', onClick));

      buttons.push(btn);
      outer.appendChild(btn);
    }

    const updatePill = () => {
      if (!buttons[activeIdx]) return;
      const segW = 100 / items.length;
      pill.style.width = segW + '%';
      pill.style.transform = 'translateX(' + (activeIdx * 100) + '%)';
    };

    requestAnimationFrame(updatePill);

    return outer;
  }

  // -----------------------------------------------------------------------
  // Icon button group (for alignment)
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
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: 'none',
        background: isActive ? INPUT_BG_ACTIVE : 'transparent',
        color: isActive ? TEXT_PRIMARY : TEXT_DIM,
        cursor: 'pointer',
        padding: '0',
      });
      btn.appendChild(svgIcon(14, 14, item.icon));

      const onClick = () => {
        for (const b of buttons) {
          b.style.background = 'transparent';
          b.style.color = TEXT_DIM;
        }
        btn.style.background = INPUT_BG_ACTIVE;
        btn.style.color = TEXT_PRIMARY;
        onChange(item.value);
      };
      btn.addEventListener('click', onClick);
      this.cleanups.push(() => btn.removeEventListener('click', onClick));

      const onEnter = () => {
        if (btn.style.background !== INPUT_BG_ACTIVE) {
          btn.style.background = INPUT_BG;
        }
      };
      const onLeave = () => {
        if (btn.style.background === INPUT_BG) {
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
  // ColorRow
  // -----------------------------------------------------------------------

  private makeColorRow(
    property: string,
    computedStyles: Record<string, string>,
  ): HTMLDivElement {
    const rawValue = getVal(computedStyles, property);
    const hexValue = parseColor(rawValue);

    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      height: '32px',
    });

    // Swatch: 16x16 circle
    const swatchWrap = document.createElement('div');
    Object.assign(swatchWrap.style, {
      position: 'relative',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: hexValue,
      flexShrink: '0',
      cursor: 'pointer',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
    });

    // Hidden native color input
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
    swatchWrap.appendChild(colorInput);

    // Hex text input
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = hexValue;
    Object.assign(hexInput.style, {
      flex: '1',
      height: '32px',
      border: 'none',
      outline: 'none',
      background: INPUT_BG,
      borderRadius: '8px',
      color: TEXT_PRIMARY,
      fontSize: '11px',
      fontFamily: FONT,
      padding: '0 8px',
      boxSizing: 'border-box',
    });

    const onColorInput = () => {
      swatchWrap.style.background = colorInput.value;
      hexInput.value = colorInput.value;
      this.emitChange(property, colorInput.value);
    };
    colorInput.addEventListener('input', onColorInput);
    this.cleanups.push(() => colorInput.removeEventListener('input', onColorInput));

    const onHexChange = () => {
      const val = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{3,6}$/.test(val)) {
        const normalized =
          val.length === 4
            ? '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3]
            : val;
        swatchWrap.style.background = normalized;
        colorInput.value = normalized;
        this.emitChange(property, normalized);
      }
    };
    hexInput.addEventListener('change', onHexChange);
    this.cleanups.push(() => hexInput.removeEventListener('change', onHexChange));

    // Focus style
    const onFocus = () => { hexInput.style.outline = '1px solid ' + INPUT_FOCUS; };
    const onBlur = () => { hexInput.style.outline = 'none'; };
    hexInput.addEventListener('focus', onFocus);
    hexInput.addEventListener('blur', onBlur);
    this.cleanups.push(() => {
      hexInput.removeEventListener('focus', onFocus);
      hexInput.removeEventListener('blur', onBlur);
    });

    row.appendChild(swatchWrap);
    row.appendChild(hexInput);
    return row;
  }

  // -----------------------------------------------------------------------
  // Change emission
  // -----------------------------------------------------------------------

  private emitChange(property: string, value: string): void {
    this.changeCallback?.(property, value);
  }
}
