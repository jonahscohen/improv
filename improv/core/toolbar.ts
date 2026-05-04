import type { ImprovMode } from './types';

type ModeCallback = (mode: ImprovMode | null) => void;
type ActionCallback = () => void;

const MODES: ImprovMode[] = ['manipulate', 'prompt', 'annotate', 'layout'];

const MODE_LABELS: Record<ImprovMode, string> = {
  manipulate: 'Manipulate',
  prompt: 'Prompt',
  annotate: 'Annotate',
  layout: 'Layout',
};

const VERBOSITY_OPTIONS = ['compact', 'standard', 'detailed', 'forensic'] as const;

// ---------------------------------------------------------------------------
// Lucide icon builders (all 24x24 viewBox, stroke-based, no innerHTML)
// ---------------------------------------------------------------------------

function svgBase(size: number): SVGSVGElement {
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

function addPath(svg: SVGSVGElement, d: string): void {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
}

function addLine(svg: SVGSVGElement, x1: string, y1: string, x2: string, y2: string): void {
  const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l.setAttribute('x1', x1);
  l.setAttribute('y1', y1);
  l.setAttribute('x2', x2);
  l.setAttribute('y2', y2);
  svg.appendChild(l);
}

function addRect(
  svg: SVGSVGElement,
  x: string,
  y: string,
  w: string,
  h: string,
  rx: string,
): void {
  const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  r.setAttribute('x', x);
  r.setAttribute('y', y);
  r.setAttribute('width', w);
  r.setAttribute('height', h);
  r.setAttribute('rx', rx);
  svg.appendChild(r);
}

function addCircle(svg: SVGSVGElement, cx: string, cy: string, r: string): void {
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', cx);
  c.setAttribute('cy', cy);
  c.setAttribute('r', r);
  c.setAttribute('fill', 'none');
  c.setAttribute('stroke', 'currentColor');
  svg.appendChild(c);
}

// Lucide: sliders-horizontal
function iconSlidersHorizontal(size: number): SVGSVGElement {
  const svg = svgBase(size);
  const lines: [string, string, string, string][] = [
    ['10', '5', '3', '5'],
    ['12', '19', '3', '19'],
    ['21', '12', '12', '12'],
    ['21', '19', '16', '19'],
    ['21', '5', '14', '5'],
    ['8', '12', '3', '12'],
  ];
  for (const [x1, y1, x2, y2] of lines) {
    addLine(svg, x1, y1, x2, y2);
  }
  // Vertical slider knobs
  addLine(svg, '14', '3', '14', '7');
  addLine(svg, '16', '17', '16', '21');
  addLine(svg, '8', '10', '8', '14');
  return svg;
}

// Lucide: message-square-text
function iconMessageSquareText(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addPath(
    svg,
    'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z',
  );
  addLine(svg, '7', '11', '17', '11');
  addLine(svg, '7', '15', '13', '15');
  addLine(svg, '7', '7', '15', '7');
  return svg;
}

// Lucide: pen-line
function iconPenLine(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addLine(svg, '13', '21', '21', '21');
  addPath(
    svg,
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
  );
  return svg;
}

// Lucide: layout-grid
function iconLayoutGrid(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addRect(svg, '3', '3', '7', '7', '1');
  addRect(svg, '14', '3', '7', '7', '1');
  addRect(svg, '14', '14', '7', '7', '1');
  addRect(svg, '3', '14', '7', '7', '1');
  return svg;
}

// Lucide: settings
function iconSettings(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addPath(
    svg,
    'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
  );
  addCircle(svg, '12', '12', '3');
  return svg;
}

// Lucide: eraser
function iconEraser(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addPath(
    svg,
    'M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21',
  );
  addLine(svg, '5.082', '11.09', '13.91', '19.918');
  return svg;
}

// Lucide: send
function iconSend(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addPath(
    svg,
    'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z',
  );
  addLine(svg, '21.854', '2.147', '10.914', '13.086');
  return svg;
}

// Lucide: x (close)
function iconX(size: number): SVGSVGElement {
  const svg = svgBase(size);
  addLine(svg, '18', '6', '6', '18');
  addLine(svg, '6', '6', '18', '18');
  return svg;
}

const MODE_ICON_BUILDERS: Record<ImprovMode, (size: number) => SVGSVGElement> = {
  manipulate: iconSlidersHorizontal,
  prompt: iconMessageSquareText,
  annotate: iconPenLine,
  layout: iconLayoutGrid,
};

// ---------------------------------------------------------------------------
// Style helper
// ---------------------------------------------------------------------------

function applyStyles(el: HTMLElement | SVGElement, styles: Partial<CSSStyleDeclaration>): void {
  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined) {
      (el.style as Record<string, string>)[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

export class Toolbar {
  private el: HTMLDivElement;
  private activeMode: ImprovMode | null = null;

  // Callback registries
  private modeCallbacks: ModeCallback[] = [];
  private applyCallbacks: ActionCallback[] = [];
  private sendToClaudeCallbacks: ActionCallback[] = [];
  private clearAllCallbacks: ActionCallback[] = [];

  // DOM references
  private modeButtons = new Map<ImprovMode, HTMLButtonElement>();
  private badgeEl: HTMLSpanElement;
  private badgeDivider: HTMLDivElement;
  private sendBtnWrap: HTMLButtonElement;
  private actionDivider: HTMLDivElement;
  private settingsPanel: HTMLDivElement | null = null;

  // Settings state
  private verbosity: (typeof VERBOSITY_OPTIONS)[number] = 'standard';
  private connected = false;
  private port = 3901;

  constructor(shadowRoot: ShadowRoot) {
    // ---- Pill bar container ----
    this.el = document.createElement('div');
    applyStyles(this.el, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      height: '44px',
      display: 'flex',
      alignItems: 'center',
      background: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '22px',
      padding: '6px',
      gap: '0px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.08)',
      pointerEvents: 'all',
      userSelect: 'none',
      zIndex: '2147483647',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    });

    // ---- Badge (change count) ----
    this.badgeEl = document.createElement('span');
    applyStyles(this.badgeEl, {
      display: 'none',
      minWidth: '28px',
      height: '28px',
      lineHeight: '28px',
      textAlign: 'center',
      background: '#0D99FF',
      color: '#fff',
      fontSize: '11px',
      fontWeight: '600',
      fontVariantNumeric: 'tabular-nums',
      borderRadius: '10px',
      padding: '0 8px',
      boxSizing: 'border-box',
      flexShrink: '0',
    });
    this.el.appendChild(this.badgeEl);

    // Badge divider (only visible when badge is visible)
    this.badgeDivider = this.createVerticalDivider();
    this.badgeDivider.style.display = 'none';
    this.el.appendChild(this.badgeDivider);

    // ---- Mode buttons ----
    for (const mode of MODES) {
      const btn = this.createToolbarButton(
        MODE_ICON_BUILDERS[mode],
        MODE_LABELS[mode],
      );
      btn.addEventListener('click', () => {
        const next = this.activeMode === mode ? null : mode;
        this.setActiveMode(next);
        this.modeCallbacks.forEach((cb) => cb(next));
      });
      this.modeButtons.set(mode, btn);
      this.el.appendChild(btn);
    }

    // ---- Divider before actions ----
    this.actionDivider = this.createVerticalDivider();
    this.el.appendChild(this.actionDivider);

    // ---- Send/Apply button ----
    this.sendBtnWrap = this.createToolbarButton(iconSend, 'Send');
    applyStyles(this.sendBtnWrap, { display: 'none' });
    this.sendBtnWrap.addEventListener('click', () => {
      this.applyCallbacks.forEach((cb) => cb());
      this.sendToClaudeCallbacks.forEach((cb) => cb());
    });
    this.el.appendChild(this.sendBtnWrap);

    // ---- Clear button ----
    const clearBtn = this.createToolbarButton(iconEraser, 'Clear');
    clearBtn.addEventListener('click', () => {
      this.clearAllCallbacks.forEach((cb) => cb());
    });
    this.el.appendChild(clearBtn);

    // ---- Settings button ----
    const settingsBtn = this.createToolbarButton(iconSettings, 'Settings');
    settingsBtn.addEventListener('click', () => {
      this.toggleSettingsPanel();
    });
    this.el.appendChild(settingsBtn);

    // ---- Drag ----
    this.initDrag();

    shadowRoot.appendChild(this.el);
  }

  // ------------------------------------------------------------------
  // Button factory
  // ------------------------------------------------------------------

  private createToolbarButton(
    iconBuilder: (size: number) => SVGSVGElement,
    tooltip: string,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.title = tooltip;
    applyStyles(btn, {
      width: '32px',
      height: '32px',
      border: 'none',
      background: 'transparent',
      borderRadius: '10px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      color: 'rgba(255,255,255,0.65)',
      transition: 'background 120ms ease, color 120ms ease, transform 80ms ease',
      flexShrink: '0',
    });

    const icon = iconBuilder(18);
    applyStyles(icon, { flexShrink: '0', pointerEvents: 'none' });
    btn.appendChild(icon);

    btn.addEventListener('mouseenter', () => {
      if (!btn.dataset['active']) {
        btn.style.background = 'rgba(255,255,255,0.08)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (!btn.dataset['active']) {
        btn.style.background = 'transparent';
      }
    });
    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'scale(0.92)';
    });
    btn.addEventListener('mouseup', () => {
      btn.style.transform = '';
    });

    return btn;
  }

  // ------------------------------------------------------------------
  // Vertical divider (between groups)
  // ------------------------------------------------------------------

  private createVerticalDivider(): HTMLDivElement {
    const d = document.createElement('div');
    applyStyles(d, {
      width: '1px',
      height: '16px',
      background: 'rgba(255,255,255,0.12)',
      flexShrink: '0',
      margin: '0 3px',
    });
    return d;
  }

  // ------------------------------------------------------------------
  // Settings panel
  // ------------------------------------------------------------------

  private toggleSettingsPanel(): void {
    if (this.settingsPanel) {
      this.settingsPanel.remove();
      this.settingsPanel = null;
      return;
    }

    const panel = document.createElement('div');
    this.settingsPanel = panel;
    applyStyles(panel, {
      position: 'fixed',
      bottom: '68px',
      right: '20px',
      width: '260px',
      background: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.08)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      zIndex: '2147483647',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      pointerEvents: 'all',
    });

    // Header row with title and close button
    const headerRow = document.createElement('div');
    applyStyles(headerRow, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    });

    const title = document.createElement('span');
    title.textContent = 'Settings';
    applyStyles(title, {
      fontSize: '13px',
      fontWeight: '600',
      color: 'rgba(255,255,255,0.85)',
    });
    headerRow.appendChild(title);

    const closeBtn = document.createElement('button');
    applyStyles(closeBtn, {
      width: '24px',
      height: '24px',
      border: 'none',
      background: 'transparent',
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      color: 'rgba(255,255,255,0.5)',
      transition: 'background 120ms ease',
    });
    closeBtn.appendChild(iconX(14));
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.08)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
    });
    closeBtn.addEventListener('click', () => {
      this.toggleSettingsPanel();
    });
    headerRow.appendChild(closeBtn);
    panel.appendChild(headerRow);

    // Verbosity dropdown
    const verbSection = this.buildSettingsRow('Verbosity');
    const select = document.createElement('select');
    applyStyles(select, {
      width: '100%',
      background: '#252525',
      color: 'rgba(255,255,255,0.75)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px',
      padding: '6px 8px',
      fontSize: '12px',
      fontFamily: 'system-ui, sans-serif',
      outline: 'none',
      cursor: 'pointer',
    });
    for (const opt of VERBOSITY_OPTIONS) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      if (opt === this.verbosity) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      this.verbosity = select.value as (typeof VERBOSITY_OPTIONS)[number];
    });
    verbSection.appendChild(select);
    panel.appendChild(verbSection);

    // Connection status
    const connSection = this.buildSettingsRow('Connection');
    const connInfo = document.createElement('div');
    applyStyles(connInfo, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    });

    const portRow = this.buildKVRow('Port', String(this.port));
    connInfo.appendChild(portRow);

    const statusRow = this.buildKVRow('Status', this.connected ? 'Connected' : 'Disconnected');
    const statusVal = statusRow.lastElementChild as HTMLElement;
    if (statusVal) {
      statusVal.style.color = this.connected ? '#22c55e' : '#ef4444';
    }
    connInfo.appendChild(statusRow);

    connSection.appendChild(connInfo);
    panel.appendChild(connSection);

    // Insert into the same shadow root as the toolbar
    this.el.parentNode!.appendChild(panel);
  }

  private buildSettingsRow(label: string): HTMLDivElement {
    const section = document.createElement('div');
    applyStyles(section, {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    });

    const heading = document.createElement('span');
    heading.textContent = label;
    applyStyles(heading, {
      fontSize: '10px',
      fontWeight: '600',
      color: 'rgba(255,255,255,0.35)',
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      fontFamily: 'system-ui, sans-serif',
    });
    section.appendChild(heading);
    return section;
  }

  private buildKVRow(key: string, value: string): HTMLDivElement {
    const row = document.createElement('div');
    applyStyles(row, {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '11px',
      fontFamily: 'system-ui, sans-serif',
    });

    const k = document.createElement('span');
    k.textContent = key;
    applyStyles(k, { color: 'rgba(255,255,255,0.4)' });
    row.appendChild(k);

    const v = document.createElement('span');
    v.textContent = value;
    applyStyles(v, {
      color: 'rgba(255,255,255,0.65)',
      fontVariantNumeric: 'tabular-nums',
    });
    row.appendChild(v);

    return row;
  }

  // ------------------------------------------------------------------
  // Drag
  // ------------------------------------------------------------------

  private initDrag(): void {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origRight = 20;
    let origBottom = 20;

    this.el.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only drag when clicking pill background, not buttons
      if (target.closest('button') || target.closest('span')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origRight = parseInt(this.el.style.right || '20', 10);
      origBottom = parseInt(this.el.style.bottom || '20', 10);
      this.el.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.el.style.right = `${origRight - dx}px`;
      this.el.style.bottom = `${origBottom - dy}px`;

      // Move settings panel if visible
      if (this.settingsPanel) {
        this.settingsPanel.style.right = `${origRight - dx}px`;
        this.settingsPanel.style.bottom = `${origBottom - dy + 48}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        this.el.style.cursor = '';
      }
    });
  }

  // ------------------------------------------------------------------
  // Private: update mode button visuals
  // ------------------------------------------------------------------

  private updateModeButtonStyles(): void {
    this.modeButtons.forEach((btn, mode) => {
      if (mode === this.activeMode) {
        btn.style.background = 'rgba(59,130,246,0.2)';
        btn.style.color = '#6dacfc';
        btn.dataset['active'] = '1';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'rgba(255,255,255,0.65)';
        delete btn.dataset['active'];
      }
    });
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  setActiveMode(mode: ImprovMode | null): void {
    this.activeMode = mode;
    this.updateModeButtonStyles();
  }

  getActiveMode(): ImprovMode | null {
    return this.activeMode;
  }

  onMode(callback: ModeCallback): void {
    this.modeCallbacks.push(callback);
  }

  onApply(callback: ActionCallback): void {
    this.applyCallbacks.push(callback);
  }

  onSendToClaude(callback: ActionCallback): void {
    this.sendToClaudeCallbacks.push(callback);
  }

  onClearAll(callback: ActionCallback): void {
    this.clearAllCallbacks.push(callback);
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }

  setBadge(count: number): void {
    if (count > 0) {
      this.badgeEl.style.display = 'inline-flex';
      this.badgeEl.textContent = String(count);
      this.badgeDivider.style.display = '';
      this.sendBtnWrap.style.display = 'flex';
    } else {
      this.badgeEl.style.display = 'none';
      this.badgeEl.textContent = '';
      this.badgeDivider.style.display = 'none';
      // Only hide send if no other reason to show it
      if (!this.sendBtnWrap.dataset['forceVisible']) {
        this.sendBtnWrap.style.display = 'none';
      }
    }
  }

  showSendButton(visible: boolean): void {
    if (visible) {
      this.sendBtnWrap.style.display = 'flex';
      this.sendBtnWrap.dataset['forceVisible'] = '1';
    } else {
      delete this.sendBtnWrap.dataset['forceVisible'];
      // Only hide if badge count is also 0
      if (this.badgeEl.style.display === 'none') {
        this.sendBtnWrap.style.display = 'none';
      }
    }
  }

  destroy(): void {
    if (this.settingsPanel) {
      this.settingsPanel.remove();
      this.settingsPanel = null;
    }
    this.el.remove();
  }
}
