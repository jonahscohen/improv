import type { JustifyMode } from './types';
import {
  iconManipulate,
  iconPrompt,
  iconLayout,
  iconSettings,
  iconEraser,
  iconSend,
  iconClose,
  MODE_ICON_BUILDERS,
  type IconBuilder,
} from './icons';

// ---------------------------------------------------------------------------
// Theme palette module.
//
// There is one toolbar per page, so the resolved palette is tracked as a small
// piece of module state. currentPalette() is the read path shared by every
// justify surface (toolbar chrome, the inline prompt, the hover/selection
// labels). Long-lived surfaces that must re-skin when the theme flips register
// an applier via registerThemedSurface(); short-lived ones just read
// currentPalette() at creation time.
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface Palette {
  surface: string;
  input: string;
  text: string;
  textDim: string;
  border: string;
  borderSubtle: string;
  hover: string;
}

// dark = the current hardcoded justify look (unchanged, so 'dark' preserves the
// existing appearance). light = a brand-informed warm-paper scheme.
export const PALETTES: Record<ResolvedTheme, Palette> = {
  dark: {
    surface: '#1a1a1a',
    input: '#252525',
    text: 'rgba(255,255,255,0.85)',
    textDim: 'rgba(255,255,255,0.75)',
    border: 'rgba(255,255,255,0.12)',
    borderSubtle: 'rgba(255,255,255,0.1)',
    hover: 'rgba(255,255,255,0.08)',
  },
  light: {
    surface: '#F4EFE4',
    input: '#FFFFFF',
    text: 'rgba(26,31,27,0.9)',
    textDim: 'rgba(26,31,27,0.72)',
    border: 'rgba(26,31,27,0.18)',
    borderSubtle: 'rgba(26,31,27,0.12)',
    hover: 'rgba(26,31,27,0.08)',
  },
};

// Collapse a theme choice to a concrete palette key. 'system' defers to the
// caller-provided OS preference so this stays a pure function (testable without
// a window).
export function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

// Boot with the persisted theme, not a hardcoded dark: chrome built before the
// first Toolbar constructs (the launcher, a queue pill from an early daemon
// push) reads currentPalette() at creation and would otherwise render dark on
// light-themed machines until a theme event fires.
let _currentPalette: Palette = (() => {
  try {
    const stored = readStoredTheme(typeof localStorage === 'undefined' ? undefined : localStorage, 'dark');
    const sysDark =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
    return PALETTES[resolveTheme(stored, sysDark)];
  } catch {
    return PALETTES.dark;
  }
})();

export function currentPalette(): Palette {
  return _currentPalette;
}

type ThemedApplier = (palette: Palette) => void;
interface ThemedSurface {
  apply: ThemedApplier;
}
const _themedSurfaces: ThemedSurface[] = [];

// Register a long-lived element's re-skin applier. The applier is called once
// immediately (so a late-registered surface matches the active theme) and again
// on every theme change. Returns an unregister function - call it on teardown
// so the registry does not retain detached nodes.
export function registerThemedSurface(apply: ThemedApplier): () => void {
  const entry: ThemedSurface = { apply };
  _themedSurfaces.push(entry);
  try {
    apply(_currentPalette);
  } catch {}
  return () => {
    const i = _themedSurfaces.indexOf(entry);
    if (i !== -1) _themedSurfaces.splice(i, 1);
  };
}

// Minimal storage shape so the persistence helpers are unit-testable with a
// fake and never assume a real localStorage exists.
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const THEME_STORAGE_KEY = 'justify.theme';
const MARKER_STORAGE_KEY = 'justify.markerColor';

export function readStoredTheme(storage: StorageLike | undefined, fallback: ThemeMode): ThemeMode {
  try {
    const v = storage ? storage.getItem(THEME_STORAGE_KEY) : null;
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return fallback;
}

export function writeStoredTheme(storage: StorageLike | undefined, theme: ThemeMode): void {
  try {
    if (storage) storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

export function readStoredMarkerColor(storage: StorageLike | undefined, fallback: string): string {
  try {
    const v = storage ? storage.getItem(MARKER_STORAGE_KEY) : null;
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  } catch {}
  return fallback;
}

export function writeStoredMarkerColor(storage: StorageLike | undefined, color: string): void {
  try {
    if (storage) storage.setItem(MARKER_STORAGE_KEY, color);
  } catch {}
}

function safeStorage(): StorageLike | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

// Yes& ampersand logomark alpha mask (96px PNG, base64) used by the collapsed launcher icon.
const AMP_MASK_URI = 'data:image/png;base64,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';

type ModeCallback = (mode: JustifyMode | null) => void;
type ActionCallback = () => void;

const MODES: JustifyMode[] = ['prompt', 'manipulate'];

const MODE_LABELS: Record<string, string> = {
  manipulate: 'Manipulate',
  prompt: 'Prompt',
  layout: 'Layout',
};


function applyStyles(el: HTMLElement | SVGElement, styles: Partial<CSSStyleDeclaration>): void {
  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined) {
      (el.style as any)[key] = value;
    }
  }
}

export class Toolbar {
  el: HTMLDivElement;
  activeMode: JustifyMode | null = null;
  modeCallbacks: ModeCallback[] = [];
  applyCallbacks: ActionCallback[] = [];
  sendToClaudeCallbacks: ActionCallback[] = [];
  clearAllCallbacks: ActionCallback[] = [];
  modeButtons = new Map<JustifyMode, HTMLButtonElement>();
  badgeEl: HTMLSpanElement;
  badgeDivider: HTMLDivElement;
  sendBtnWrap: HTMLButtonElement;
  actionDivider: HTMLDivElement;
  settingsPanel: HTMLDivElement | null = null;
  settingsBtn: HTMLButtonElement | null = null;
  connected: boolean = false;
  port: number = 3901;
  markerColor: string = '#D97757';
  markerColorCallbacks: Array<(color: string) => void> = [];
  theme: ThemeMode = 'dark';
  themeCallbacks: Array<(palette: Palette) => void> = [];
  _chromeBtns: HTMLButtonElement[] = [];
  _dividers: HTMLDivElement[] = [];
  showHints: boolean | undefined;
  showSelectionLabels: boolean | undefined;
  hintsCallbacks: Array<(v: boolean) => void> = [];
  selectionLabelCallbacks: Array<(v: boolean) => void> = [];

  private _storage: StorageLike | undefined = safeStorage();
  private _mql: MediaQueryList | null = null;
  private _mqlHandler: (() => void) | null = null;
  // Repaint closures for the currently-open settings panel. Rebuilt each time
  // the panel opens (see toggleSettingsPanel), so it never grows unbounded.
  private _panelThemers: Array<() => void> = [];

  private _closeBtn!: HTMLButtonElement;
  private _closeSvg!: SVGSVGElement;
  private _closeP1!: SVGPathElement;
  private _closeP2!: SVGPathElement;
  private _closeP3: SVGPathElement | null = null;
  private _ampEl: HTMLDivElement | null = null;
  private _closeDivider!: HTMLDivElement;
  _collapsed: boolean = false;
  private _tt!: HTMLDivElement;
  private _ttTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(shadowRoot: ShadowRoot) {
    // Restore persisted preferences before any chrome is painted. localStorage
    // can throw in sandboxed embeds, so every access is guarded.
    this.theme = readStoredTheme(this._storage, 'dark');
    this.markerColor = readStoredMarkerColor(this._storage, '#D97757');

    const animSheet = new CSSStyleSheet();
    animSheet.replaceSync(`
      @keyframes justify-pill-in {
        from { opacity: 0; transform: translateY(12px) scale(0.92); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes justify-icon-in {
        from { opacity: 0; transform: scale(0.8); filter: blur(2px); }
        to { opacity: 1; transform: scale(1); filter: blur(0); }
      }
      @keyframes justify-panel-in {
        from { opacity: 0; transform: translateY(8px) scale(0.97); filter: blur(3px); }
        to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
      }
      @keyframes justify-input-glow {
        0% { box-shadow: 0 0 4px 0px var(--justify-glow-color, #D97757); }
        50% { box-shadow: 0 0 8px 1px var(--justify-glow-color, #D97757); }
        100% { box-shadow: 0 0 4px 0px var(--justify-glow-color, #D97757); }
      }
      @keyframes justify-glow-pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
      }
      @keyframes justify-toast-slide-in {
        from { transform: translateY(-100%) translateX(-50%); opacity: 0; }
        to { transform: translateY(0) translateX(-50%); opacity: 1; }
      }
      @keyframes justify-toast-slide-out {
        from { transform: translateY(0) translateX(-50%); opacity: 1; }
        to { transform: translateY(-100%) translateX(-50%); opacity: 0; }
      }
      @keyframes justify-toast-progress {
        0% { width: 0%; }
        100% { width: 100%; }
      }
      @keyframes justify-toast-check-draw {
        from { stroke-dashoffset: 20; }
        to { stroke-dashoffset: 0; }
      }
      @keyframes justify-send-pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 currentColor; }
        30% { transform: scale(1.12); }
        50% { transform: scale(0.95); }
        70% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      @keyframes justify-badge-pop {
        0% { transform: scale(0.5); }
        60% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      @keyframes justify-msg-wiggle {
        0% { transform: scale(1) rotate(0deg); }
        20% { transform: scale(1.05) rotate(-7deg); }
        50% { transform: scale(1.05) rotate(7deg); }
        80% { transform: scale(1.02) rotate(-2deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      @keyframes justify-icon-hover-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(120deg); }
      }
      @keyframes justify-icon-hover-nudge {
        0% { transform: translate(0, 0); }
        15% { transform: translate(1.5px, -1.5px); }
        30% { transform: translate(0, 0); }
        45% { transform: translate(1.5px, -1.5px); }
        60% { transform: translate(0, 0); }
        100% { transform: translate(0, 0); }
      }
      @keyframes justify-icon-hover-shake {
        0% { transform: translateX(0); }
        20% { transform: translateX(-2px) rotate(-3deg); }
        40% { transform: translateX(2px) rotate(3deg); }
        60% { transform: translateX(-1px) rotate(-1deg); }
        80% { transform: translateX(1px) rotate(1deg); }
        100% { transform: translateX(0) rotate(0); }
      }
      @keyframes justify-icon-hover-rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(90deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
      *:focus-visible {
        outline: 2px solid var(--justify-marker, #D97757);
        outline-offset: 2px;
      }
      button:focus-visible {
        outline: 2px solid var(--justify-marker, #D97757);
        outline-offset: 2px;
      }
    `);
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, animSheet];

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
      boxSizing: 'border-box',
      padding: '6px',
      gap: '2px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.08)',
      pointerEvents: 'all',
      userSelect: 'none',
      zIndex: '2147483647',
      fontFamily: "'JustifySans', system-ui, sans-serif",
      animation: 'justify-pill-in 0.35s cubic-bezier(0.23, 1, 0.32, 1) forwards',
      overflow: 'hidden',
      transition: 'width 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
    });

    this.el.addEventListener('animationend', () => {
      this.el.style.animation = 'none';
    });

    this.badgeEl = document.createElement('span');
    applyStyles(this.badgeEl, {
      display: 'none',
      minWidth: '28px',
      height: '28px',
      lineHeight: '28px',
      textAlign: 'center',
      background: this.markerColor || '#D97757',
      color: '#fff',
      fontSize: '11px',
      fontWeight: '600',
      fontVariantNumeric: 'tabular-nums',
      borderRadius: '10px',
      padding: '0 8px',
      boxSizing: 'border-box',
      flexShrink: '0',
    });

    this.badgeDivider = this.createVerticalDivider();
    this.badgeDivider.style.display = 'none';

    let btnDelay = 0;
    for (const mode of MODES) {
      const btn = this.createToolbarButton(MODE_ICON_BUILDERS[mode], MODE_LABELS[mode]);
      btn.style.animation = `justify-icon-in 0.2s cubic-bezier(0.23, 1, 0.32, 1) ${btnDelay}ms both`;
      btn.addEventListener('animationend', function () {
        this.style.animation = 'none';
      }, { once: true });
      btn.addEventListener('click', () => {
        const next = this.activeMode === mode ? null : mode;
        this.setActiveMode(next);
        this.modeCallbacks.forEach((cb) => cb(next));
      });
      this.modeButtons.set(mode, btn);
      this.el.appendChild(btn);
      btnDelay += 30;
    }

    this.actionDivider = this.createVerticalDivider();
    this.actionDivider.style.display = 'none';

    this.sendBtnWrap = this.createToolbarButton(iconSend, 'Send');
    applyStyles(this.sendBtnWrap, { display: 'none' });
    this.sendBtnWrap.addEventListener('click', () => {
      this.applyCallbacks.forEach((cb) => cb());
      this.sendToClaudeCallbacks.forEach((cb) => cb());
    });
    this.sendBtnWrap.style.display = 'none';

    const clearBtn = this.createToolbarButton(iconEraser, 'Clear');
    clearBtn.addEventListener('click', () => {
      this.clearAllCallbacks.forEach((cb) => cb());
    });
    clearBtn.style.display = 'none';

    const settingsBtn = this.createToolbarButton(iconSettings, 'Settings');
    settingsBtn.addEventListener('click', () => {
      this.toggleSettingsPanel();
    });
    this.settingsBtn = settingsBtn;
    this.el.appendChild(settingsBtn);

    this._closeDivider = this.createVerticalDivider();
    this.el.appendChild(this._closeDivider);

    this._closeBtn = document.createElement('button');
    applyStyles(this._closeBtn, {
      width: '32px',
      height: '32px',
      border: 'none',
      background: 'transparent',
      borderRadius: '50%',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      color: currentPalette().textDim,
      transition: 'background 120ms ease, color 120ms ease, transform 80ms ease',
      flexShrink: '0',
      zIndex: '1',
      position: 'absolute',
      right: '5px',
      top: '50%',
      transform: 'translateY(-50%)',
      outline: 'none',
    });

    this._closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this._closeSvg.setAttribute('width', '18');
    this._closeSvg.setAttribute('height', '18');
    this._closeSvg.setAttribute('viewBox', '0 0 24 24');
    this._closeSvg.setAttribute('fill', 'none');
    this._closeSvg.setAttribute('stroke', 'currentColor');
    this._closeSvg.setAttribute('stroke-width', '2');
    this._closeSvg.setAttribute('stroke-linecap', 'round');

    this._closeP1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._closeP1.setAttribute('d', 'M18 6 6 18');
    this._closeP1.style.cssText = 'stroke-dasharray:20;stroke-dashoffset:0;transition:stroke-dashoffset 0.3s ease';
    this._closeSvg.appendChild(this._closeP1);

    this._closeP2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._closeP2.setAttribute('d', 'm6 6 12 12');
    this._closeP2.style.cssText = 'stroke-dasharray:20;stroke-dashoffset:0;transition:stroke-dashoffset 0.3s ease 0.1s';
    this._closeSvg.appendChild(this._closeP2);

    this._closeBtn.appendChild(this._closeSvg);

    this._closeBtn.addEventListener('mouseenter', () => {
      if (!this._closeBtn.dataset.active) {
        this._closeBtn.style.background = (this.markerColor || '#D97757') + '33';
        this._closeBtn.style.color = this.markerColor || '#D97757';
      }
      if (this._collapsed) {
        this._animateAmp();
        return;
      }
      this._closeP1.style.transition = 'none';
      this._closeP1.style.strokeDashoffset = '20';
      this._closeSvg.getBoundingClientRect();
      this._closeP1.style.transition = 'stroke-dashoffset 0.3s ease';
      this._closeP1.style.strokeDashoffset = '0';
      this._closeP2.style.transition = 'none';
      this._closeP2.style.strokeDashoffset = '20';
      this._closeP2.getBoundingClientRect();
      this._closeP2.style.transition = 'stroke-dashoffset 0.3s ease 0.1s';
      this._closeP2.style.strokeDashoffset = '0';
    });

    this._closeBtn.addEventListener('mouseleave', () => {
      if (!this._closeBtn.dataset.active) {
        this._closeBtn.style.background = 'transparent';
        this._closeBtn.style.color = currentPalette().textDim;
      }
    });

    this._closeBtn.addEventListener('mousedown', () => {
      this._closeBtn.style.transform = 'translateY(-50%) scale(0.92)';
    });

    this._closeBtn.addEventListener('mouseup', () => {
      this._closeBtn.style.transform = 'translateY(-50%)';
    });

    this._collapsed = false;

    this._closeBtn.addEventListener('click', () => {
      if (!this._collapsed) {
        this.setActiveMode(null);
        this.modeCallbacks.forEach((d) => d(null));
        if (this.settingsPanel) {
          this.settingsPanel.remove();
          this.settingsPanel = null;
        }
        this._collapsed = true;
        this.el.style.width = '44px';
        for (let _ci = 0; _ci < this.el.childNodes.length; _ci++) {
          const _ch = this.el.childNodes[_ci] as HTMLElement;
          if (_ch !== this._closeBtn && _ch !== (this._tt as any)) {
            _ch.style.transition = 'none';
            _ch.style.opacity = '0';
            _ch.style.pointerEvents = 'none';
          }
        }
        this._showAmp();
      } else {
        this._collapsed = false;
        this._showX();
        if (this.settingsPanel) {
          this.settingsPanel.remove();
          this.settingsPanel = null;
        }
        for (let _ci = 0; _ci < this.el.childNodes.length; _ci++) {
          const _ch = this.el.childNodes[_ci] as HTMLElement;
          if (_ch !== this._closeBtn && _ch !== (this._tt as any)) {
            _ch.style.animation = 'none';
            _ch.style.transition = 'opacity 0.2s ease 0.1s';
            _ch.style.opacity = '1';
            _ch.style.pointerEvents = '';
          }
        }
        this.el.style.width = '157px';
      }
    });

    this.el.appendChild(this._closeBtn);

    this._tt = document.createElement('div');
    this._tt.style.cssText = 'position:fixed;transform:translateX(-50%) translateY(4px);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 14px;font-size:11px;font-family:JustifySans,system-ui,sans-serif;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 120ms ease,transform 120ms ease;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:2147483647';
    this._ttTimer = null;

    this.initDrag();

    shadowRoot.appendChild(this.el);
    shadowRoot.appendChild(this._tt);

    this._collapsed = true;
    this.el.style.width = '44px';
    for (let _ii = 0; _ii < this.el.childNodes.length; _ii++) {
      const _ic = this.el.childNodes[_ii] as HTMLElement;
      if (_ic !== this._closeBtn && _ic !== (this._tt as any)) {
        _ic.style.opacity = '0';
        _ic.style.pointerEvents = 'none';
      }
    }
    this._showAmp();

    // Paint the restored theme onto the freshly built chrome and start watching
    // the OS preference if the restored choice is 'system'. Fire the marker
    // callbacks once so any pre-registered consumer syncs to the restored color
    // (a no-op at construction since core wires its callback afterward - the
    // durable sync path there is getMarkerColor(), read at mode activation).
    this._bindSystemListener();
    this._reskin();
    this.markerColorCallbacks.forEach((cb) => cb(this.markerColor));
  }

  // Collapsed-launcher icon: the Yes& ampersand, painted via currentColor through an
  // alpha mask of the brand logomark (so the swirl counters read as negative space and
  // the mark themes with the toolbar - grey at rest, terracotta on hover).
  private _showAmp(): void {
    this._closeSvg.style.display = 'none';
    this._closeP1.style.display = 'none';
    this._closeP2.style.display = 'none';
    if (this._closeP3) this._closeP3.style.display = 'none';
    if (!this._ampEl) {
      this._ampEl = document.createElement('div');
      this._ampEl.style.cssText =
        'width:22px;height:22px;pointer-events:none;background-color:currentColor;' +
        'transform:scale(1);will-change:transform;' +
        '-webkit-mask:url(' +
        AMP_MASK_URI +
        ') center/contain no-repeat;mask:url(' +
        AMP_MASK_URI +
        ') center/contain no-repeat;';
      this._closeBtn.appendChild(this._ampEl);
    } else {
      this._ampEl.style.display = '';
      this._ampEl.style.transition = 'none';
      this._ampEl.style.transform = 'scale(1)';
    }
  }

  // Hover: spring scale-pop on the ampersand (the j's draw-on doesn't apply to a filled mark).
  private _animateAmp(): void {
    if (!this._ampEl) return;
    this._ampEl.style.transition = 'none';
    this._ampEl.style.transform = 'scale(0.55) rotate(-12deg)';
    this._ampEl.getBoundingClientRect(); // force reflow so the restart takes
    this._ampEl.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    this._ampEl.style.transform = 'scale(1) rotate(0deg)';
  }

  // Expanded state: restore the X (close) icon.
  private _showX(): void {
    this._closeSvg.style.display = '';
    this._closeSvg.setAttribute('viewBox', '0 0 24 24');
    this._closeSvg.setAttribute('width', '18');
    this._closeSvg.setAttribute('height', '18');
    if (this._ampEl) this._ampEl.style.display = 'none';
    this._closeP1.style.display = '';
    this._closeP2.style.display = '';
    this._closeP1.setAttribute('d', 'M18 6 6 18');
    this._closeP1.style.strokeDasharray = '20';
    this._closeP2.setAttribute('d', 'm6 6 12 12');
    this._closeP2.style.strokeDasharray = '20';
    if (this._closeP3) this._closeP3.style.display = 'none';
  }

  createToolbarButton(iconBuilder: IconBuilder, tooltip: string): HTMLButtonElement {
    const btn = document.createElement('button');
    applyStyles(btn, {
      width: '32px',
      height: '32px',
      border: 'none',
      background: 'transparent',
      borderRadius: '50%',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      color: currentPalette().textDim,
      transition: 'background 120ms ease, color 120ms ease, transform 80ms ease',
      flexShrink: '0',
    });
    this._chromeBtns.push(btn);

    const icon = iconBuilder(18) as any;
    applyStyles(icon, {
      flexShrink: '0',
      pointerEvents: 'none',
    });

    icon.addEventListener('animationend', () => {
      icon.style.animation = '';
      if (icon._slAnim) {
        icon._slAnim = false;
        const _els2 = icon.querySelectorAll('[data-sl]');
        const _dur2 = 400;
        const _start2 = performance.now();
        const _tgt2 = icon._slNormals;
        const _cur2 = icon._slTargets;
        (function _step2(ts: number) {
          const p2 = Math.min((ts - _start2) / _dur2, 1);
          const ep2 = 1 - Math.pow(1 - p2, 3);
          for (let _j = 0; _j < _els2.length; _j++) {
            const _el2 = _els2[_j] as SVGElement;
            const _id2 = (_el2 as any).dataset.sl;
            const _t2 = _tgt2[_id2];
            const _c2 = _cur2[_id2];
            if (!_t2) continue;
            for (const _k2 in _t2) {
              const _from2 = _c2[_k2];
              const _to2 = _t2[_k2];
              _el2.setAttribute(_k2, String(_from2 + (_to2 - _from2) * ep2));
            }
          }
          if (p2 < 1) requestAnimationFrame(_step2);
        })(performance.now());
      }
    });

    btn.appendChild(icon);

    btn.addEventListener('mouseenter', () => {
      if (!btn.dataset.active) {
        btn.style.background = (this.markerColor || '#D97757') + '33';
        btn.style.color = this.markerColor || '#D97757';
      }
      if (tooltip === 'Prompt') {
        icon.style.animation = 'justify-msg-wiggle 0.5s cubic-bezier(0.23,1,0.32,1)';
      } else if (tooltip === 'Manipulate') {
        const _targets: Record<string, Record<string, number>> = {
          t1r: { x2: 10 },
          t1l: { x1: 5 },
          t2r: { x2: 18 },
          t2l: { x1: 13 },
          t3l: { x2: 4 },
          t3r: { x1: 8 },
          k1: { x1: 9, x2: 9 },
          k2: { x1: 14, x2: 14 },
          k3: { x1: 8, x2: 8 },
        };
        const _normals: Record<string, Record<string, number>> = {
          t1r: { x2: 14 },
          t1l: { x1: 10 },
          t2r: { x2: 12 },
          t2l: { x1: 8 },
          t3l: { x2: 12 },
          t3r: { x1: 16 },
          k1: { x1: 14, x2: 14 },
          k2: { x1: 8, x2: 8 },
          k3: { x1: 16, x2: 16 },
        };
        const _els = icon.querySelectorAll('[data-sl]');
        icon._slAnim = true;
        icon._slTargets = _targets;
        icon._slNormals = _normals;
        const _dur = 400;
        const _start = performance.now();
        (function _step(ts: number) {
          if (!icon._slAnim) return;
          const p = Math.min((ts - _start) / _dur, 1);
          const ep = 1 - Math.pow(1 - p, 3);
          for (let _i = 0; _i < _els.length; _i++) {
            const _el = _els[_i] as SVGElement;
            const _id = (_el as any).dataset.sl;
            const _t = _targets[_id];
            const _n = _normals[_id];
            if (!_t) continue;
            for (const _k in _t) {
              const _from = _n[_k];
              const _to = _t[_k];
              _el.setAttribute(_k, String(_from + (_to - _from) * ep));
            }
          }
          if (p < 1) requestAnimationFrame(_step);
        })(performance.now());
      } else {
        const _anim: Record<string, string> = {
          Settings: 'justify-icon-hover-spin',
          Send: 'justify-icon-hover-nudge',
          Clear: 'justify-icon-hover-shake',
        };
        const anim = _anim[tooltip];
        if (anim) icon.style.animation = anim + ' 0.7s cubic-bezier(0.23,1,0.32,1)';
      }
      if (this._tt) {
        if (this._ttTimer) {
          clearTimeout(this._ttTimer);
          this._ttTimer = null;
        }
        if (this.showHints === false) return;
        this._tt.textContent = tooltip;
        const w = btn.getBoundingClientRect();
        const bx = w.left + w.width / 2;
        const by = this.el.getBoundingClientRect().top - this._tt.offsetHeight - 8;
        this._tt.style.left = bx + 'px';
        this._tt.style.top = by + 'px';
        this._tt.style.opacity = '1';
        this._tt.style.transform = 'translateX(-50%) translateY(0)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (!btn.dataset.active) {
        btn.style.background = 'transparent';
        btn.style.color = currentPalette().textDim;
      }
      icon.style.animation = '';
      if (icon._slAnim) {
        icon._slAnim = false;
        const _els2 = icon.querySelectorAll('[data-sl]');
        const _dur2 = 400;
        const _start2 = performance.now();
        const _tgt2 = icon._slNormals;
        const _cur2 = icon._slTargets;
        (function _step2(ts: number) {
          const p2 = Math.min((ts - _start2) / _dur2, 1);
          const ep2 = 1 - Math.pow(1 - p2, 3);
          for (let _j = 0; _j < _els2.length; _j++) {
            const _el2 = _els2[_j] as SVGElement;
            const _id2 = (_el2 as any).dataset.sl;
            const _t2 = _tgt2[_id2];
            const _c2 = _cur2[_id2];
            if (!_t2) continue;
            for (const _k2 in _t2) {
              const _from2 = _c2[_k2];
              const _to2 = _t2[_k2];
              _el2.setAttribute(_k2, String(_from2 + (_to2 - _from2) * ep2));
            }
          }
          if (p2 < 1) requestAnimationFrame(_step2);
        })(performance.now());
      }
      if (this._tt) {
        this._tt.style.opacity = '0';
        this._tt.style.transform = 'translateX(-50%) translateY(4px)';
        this._ttTimer = setTimeout(() => {
          this._tt.textContent = '';
        }, 120);
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

  createVerticalDivider(): HTMLDivElement {
    const d = document.createElement('div');
    applyStyles(d, {
      width: '1px',
      height: '16px',
      background: currentPalette().border,
      flexShrink: '0',
      margin: '0 3px',
    });
    this._dividers.push(d);
    return d;
  }

  toggleSettingsPanel(): void {
    if (this.settingsPanel) {
      this.settingsPanel.remove();
      this.settingsPanel = null;
      if (this.settingsBtn) {
        this.settingsBtn.style.background = 'transparent';
        this.settingsBtn.style.color = currentPalette().textDim;
        delete this.settingsBtn.dataset.active;
      }
      return;
    }

    if (this.settingsBtn) {
      this.settingsBtn.style.background = this.markerColor || '#D97757';
      this.settingsBtn.style.color = ['#f97316', '#eab308', '#22c55e'].indexOf(this.markerColor) !== -1 ? '#1a1a1a' : '#fff';
      this.settingsBtn.dataset.active = '1';
    }

    const panel = document.createElement('div');
    this.settingsPanel = panel;
    // Fresh panel means a fresh set of repaint closures - drop any from a
    // previous open so the registry cannot grow across open/close cycles.
    this._panelThemers = [];
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
      fontFamily: "'JustifySans', system-ui, sans-serif",
      pointerEvents: 'all',
      animation: 'justify-panel-in 0.25s cubic-bezier(0.23, 1, 0.32, 1) both',
    });

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
    closeBtn.appendChild(iconClose(14));
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = currentPalette().hover;
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
    });
    closeBtn.addEventListener('click', () => {
      this.toggleSettingsPanel();
    });
    headerRow.appendChild(closeBtn);
    panel.appendChild(headerRow);
    this._panelThemers.push(() => {
      const pal = currentPalette();
      title.style.color = pal.text;
      closeBtn.style.color = pal.textDim;
    });

    const _themeRow = this.buildSettingsRow('Theme');
    _themeRow.appendChild(this.buildThemeControl());
    panel.appendChild(_themeRow);

    const _markerRow = this.buildSettingsRow('Marker Color');
    _markerRow.appendChild(this.buildMarkerColorControl());
    panel.appendChild(_markerRow);

    const _hintRow = this.buildSettingsRow('Hints');
    const _hintToggle = this.buildToggle(this.showHints !== false, (v: boolean) => {
      this.showHints = v;
      if (!v && this._tt) this._tt.style.opacity = '0';
      this.hintsCallbacks.forEach((cb) => {
        cb(v);
      });
    });
    _hintRow.appendChild(_hintToggle);
    panel.appendChild(_hintRow);

    const _labelRow = this.buildSettingsRow('Selection Labels');
    const _labelToggle = this.buildToggle(this.showSelectionLabels !== false, (v: boolean) => {
      this.showSelectionLabels = v;
      this.selectionLabelCallbacks.forEach((cb) => {
        cb(v);
      });
    });
    _labelRow.appendChild(_labelToggle);
    panel.appendChild(_labelRow);

    this.el.parentNode!.appendChild(panel);
    // Paint the panel (and its rows) to the active theme now that it is mounted.
    this._applyPanelTheme();
  }

  buildToggle(initial: boolean, onChange: (v: boolean) => void): HTMLDivElement {
    const wrap = document.createElement('div');
    applyStyles(wrap, {
      width: '36px',
      height: '20px',
      borderRadius: '10px',
      cursor: 'pointer',
      position: 'relative',
      transition: 'background 150ms ease',
      flexShrink: '0',
    });
    const knob = document.createElement('div');
    applyStyles(knob, {
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      background: '#fff',
      position: 'absolute',
      top: '2px',
      left: initial ? '18px' : '2px',
      transition: 'left 150ms ease',
    });
    wrap.appendChild(knob);
    let on = initial;
    // Track fill: marker color when on, themed resting color when off.
    const paint = () => {
      wrap.style.background = on ? this.markerColor : this._toggleOffColor(this._resolved());
      knob.style.left = on ? '18px' : '2px';
    };
    wrap.addEventListener('click', () => {
      on = !on;
      paint();
      onChange(on);
    });
    this._panelThemers.push(paint);
    paint();
    return wrap;
  }

  onHintsChange(cb: (v: boolean) => void): void {
    this.hintsCallbacks.push(cb);
  }

  onSelectionLabelChange(cb: (v: boolean) => void): void {
    this.selectionLabelCallbacks.push(cb);
  }

  buildSettingsRow(label: string): HTMLDivElement {
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
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      fontFamily: "'JustifySans', system-ui, sans-serif",
    });
    const paint = () => {
      heading.style.color = this._headingColor(this._resolved());
    };
    this._panelThemers.push(paint);
    paint();
    section.appendChild(heading);
    return section;
  }

  buildKVRow(key: string, value: string): HTMLDivElement {
    const row = document.createElement('div');
    applyStyles(row, {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '11px',
      fontFamily: "'JustifySans', system-ui, sans-serif",
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

  initDrag(): void {}

  updateModeButtonStyles(): void {
    const _mc = this.markerColor || '#D97757';
    const _ic = ['#f97316', '#eab308', '#22c55e'].indexOf(_mc) !== -1 ? '#1a1a1a' : '#fff';
    this.el.style.setProperty('--justify-marker', _mc);
    this.modeButtons.forEach((btn, mode) => {
      if (mode === this.activeMode) {
        btn.style.background = _mc;
        btn.style.color = _ic;
        btn.dataset.active = '1';
      } else {
        // Palette, not a literal: this repaint runs on every marker change and
        // mode switch, so a hardcoded white here whites-out the pill in light mode.
        btn.style.background = 'transparent';
        btn.style.color = currentPalette().textDim;
        delete btn.dataset.active;
      }
    });
    if (this.settingsBtn && this.settingsBtn.dataset.active) {
      this.settingsBtn.style.background = _mc;
      this.settingsBtn.style.color = _ic;
    }
    // The annotation-count badge is marker-filled at creation; without this it
    // keeps the old marker after a swatch change (this repaint runs on both
    // marker changes and mode switches).
    if (this.badgeEl) this.badgeEl.style.background = _mc;
  }

  setActiveMode(mode: JustifyMode | null): void {
    this.activeMode = mode;
    this.updateModeButtonStyles();
  }

  getActiveMode(): JustifyMode | null {
    return this.activeMode;
  }

  onMode(cb: ModeCallback): void {
    this.modeCallbacks.push(cb);
  }

  onApply(cb: ActionCallback): void {
    this.applyCallbacks.push(cb);
  }

  onSendToClaude(cb: ActionCallback): void {
    this.sendToClaudeCallbacks.push(cb);
  }

  onClearAll(cb: ActionCallback): void {
    this.clearAllCallbacks.push(cb);
  }

  onMarkerColorChange(cb: (color: string) => void): void {
    this.markerColorCallbacks.push(cb);
  }

  getMarkerColor(): string {
    return this.markerColor;
  }

  setMarkerColor(color: string): void {
    this.markerColor = color;
    writeStoredMarkerColor(this._storage, color);
    this.markerColorCallbacks.forEach((cb) => cb(color));
    // Repaint any open settings panel so the selected swatch ring and the
    // marker-colored toggle tracks reflect the new color. No-op when closed.
    this._applyPanelTheme();
  }

  onThemeChange(cb: (palette: Palette) => void): void {
    this.themeCallbacks.push(cb);
  }

  setTheme(theme: ThemeMode): void {
    this.theme = theme;
    writeStoredTheme(this._storage, theme);
    this._bindSystemListener();
    this._reskin();
  }

  private _systemPrefersDark(): boolean {
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch {}
    return false;
  }

  private _resolved(): ResolvedTheme {
    return resolveTheme(this.theme, this._systemPrefersDark());
  }

  // The OS-preference listener is live only while theme === 'system'. matchMedia
  // is guarded for environments (and tests) that lack it.
  private _bindSystemListener(): void {
    this._unbindSystemListener();
    if (this.theme !== 'system') return;
    try {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => this._reskin();
      this._mql = mql;
      this._mqlHandler = handler;
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
      else if (typeof (mql as any).addListener === 'function') (mql as any).addListener(handler);
    } catch {}
  }

  private _unbindSystemListener(): void {
    if (this._mql && this._mqlHandler) {
      try {
        if (typeof this._mql.removeEventListener === 'function') {
          this._mql.removeEventListener('change', this._mqlHandler);
        } else if (typeof (this._mql as any).removeListener === 'function') {
          (this._mql as any).removeListener(this._mqlHandler);
        }
      } catch {}
    }
    this._mql = null;
    this._mqlHandler = null;
  }

  private _headingColor(resolved: ResolvedTheme): string {
    // Section headings sit dimmer than textDim; keep the dark value identical to
    // the pre-theme look so 'dark' is visually unchanged.
    return resolved === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(26,31,27,0.45)';
  }

  private _toggleOffColor(resolved: ResolvedTheme): string {
    return resolved === 'dark' ? '#333' : 'rgba(26,31,27,0.22)';
  }

  // Repaint every chrome surface this toolbar owns, then fan the palette out to
  // registered long-lived surfaces (prompt input) and theme subscribers.
  private _reskin(): void {
    const pal = PALETTES[this._resolved()];
    _currentPalette = pal;
    this.el.style.background = pal.surface;
    this.el.style.borderColor = pal.borderSubtle;
    if (this._tt) {
      this._tt.style.background = pal.surface;
      this._tt.style.borderColor = pal.borderSubtle;
      this._tt.style.color = pal.text;
    }
    this._applyPanelTheme();
    for (const b of this._chromeBtns) {
      if (!b.dataset.active) b.style.color = pal.textDim;
    }
    for (const d of this._dividers) d.style.background = pal.border;
    if (this._closeBtn && !this._closeBtn.dataset.active) this._closeBtn.style.color = pal.textDim;
    for (const s of _themedSurfaces) {
      try {
        s.apply(pal);
      } catch {}
    }
    this.themeCallbacks.forEach((cb) => cb(pal));
  }

  private _applyPanelTheme(): void {
    if (!this.settingsPanel) return;
    const pal = currentPalette();
    this.settingsPanel.style.background = pal.surface;
    this.settingsPanel.style.borderColor = pal.borderSubtle;
    for (const t of this._panelThemers) {
      try {
        t();
      } catch {}
    }
  }

  // Three-segment Light | Dark | System control. The selected segment is a
  // raised pill (input color) over a surface-colored track.
  buildThemeControl(): HTMLDivElement {
    const track = document.createElement('div');
    applyStyles(track, {
      display: 'flex',
      gap: '2px',
      padding: '2px',
      borderRadius: '10px',
      boxSizing: 'border-box',
    });

    const options: Array<{ mode: ThemeMode; label: string }> = [
      { mode: 'light', label: 'Light' },
      { mode: 'dark', label: 'Dark' },
      { mode: 'system', label: 'System' },
    ];
    const segments: Array<{ btn: HTMLButtonElement; mode: ThemeMode }> = [];

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      applyStyles(btn, {
        flex: '1',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        padding: '6px 0',
        fontSize: '11px',
        fontWeight: '600',
        fontFamily: "'JustifySans', system-ui, sans-serif",
        background: 'transparent',
        transition: 'background 150ms ease, color 150ms ease',
      });
      btn.addEventListener('click', () => {
        if (this.theme === opt.mode) return;
        this.setTheme(opt.mode);
      });
      segments.push({ btn, mode: opt.mode });
      track.appendChild(btn);
    }

    const paint = () => {
      const resolved = this._resolved();
      const pal = PALETTES[resolved];
      track.style.background = pal.surface;
      track.style.border = '1px solid ' + pal.border;
      for (const s of segments) {
        const selected = s.mode === this.theme;
        s.btn.style.background = selected ? pal.input : 'transparent';
        s.btn.style.color = selected ? pal.text : pal.textDim;
        s.btn.style.boxShadow = selected ? '0 1px 3px rgba(0,0,0,0.2)' : 'none';
      }
    };
    this._panelThemers.push(paint);
    paint();
    return track;
  }

  // Three fixed marker-color swatches. Selecting one drives the live marker
  // path (setMarkerColor) so every registered consumer reacts immediately.
  buildMarkerColorControl(): HTMLDivElement {
    const row = document.createElement('div');
    applyStyles(row, {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
    });

    const swatchDefs: Array<{ name: string; color: string }> = [
      { name: 'Yes& Red', color: '#DC2618' },
      { name: 'Claude Orange', color: '#D97757' },
      { name: 'Codex Blue', color: '#3B82F6' },
    ];
    const swatches: Array<{ btn: HTMLButtonElement; color: string }> = [];

    for (const def of swatchDefs) {
      const btn = document.createElement('button');
      btn.setAttribute('aria-label', def.name);
      btn.title = def.name;
      applyStyles(btn, {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: 'none',
        background: def.color,
        cursor: 'pointer',
        padding: '0',
        flexShrink: '0',
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      });
      btn.addEventListener('click', () => {
        // setMarkerColor repaints the open panel, moving the selected ring.
        this.setMarkerColor(def.color);
      });
      swatches.push({ btn, color: def.color });
      row.appendChild(btn);
    }

    const paint = () => {
      const pal = currentPalette();
      for (const s of swatches) {
        const selected = s.color.toLowerCase() === this.markerColor.toLowerCase();
        // Ring: a surface-colored gap then a text-colored ring, plus a small
        // scale bump - reads clearly on either palette.
        s.btn.style.boxShadow = selected
          ? '0 0 0 2px ' + pal.surface + ', 0 0 0 4px ' + pal.text
          : 'none';
        s.btn.style.transform = selected ? 'scale(1.12)' : 'scale(1)';
      }
    };
    this._panelThemers.push(paint);
    paint();
    return row;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }

  setBadge(count: number): void {
    if (count > 0) {
      const wasHidden = this.badgeEl.style.display === 'none';
      this.badgeEl.style.display = 'inline-flex';
      this.badgeEl.textContent = String(count);
      this.badgeDivider.style.display = '';
      this.sendBtnWrap.style.display = 'flex';
      if (wasHidden || this.badgeEl.textContent !== String(count)) {
        this.badgeEl.style.animation = 'none';
        void this.badgeEl.offsetWidth;
        this.badgeEl.style.animation = 'justify-badge-pop 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
      }
    } else {
      this.badgeEl.style.display = 'none';
      this.badgeEl.textContent = '';
      this.badgeDivider.style.display = 'none';
      if (!(this.sendBtnWrap as any).dataset.forceVisible) {
        this.sendBtnWrap.style.display = 'none';
      }
    }
  }

  showSendButton(visible: boolean): void {
    if (visible) {
      this.sendBtnWrap.style.display = 'flex';
      (this.sendBtnWrap as any).dataset.forceVisible = '1';
    } else {
      delete (this.sendBtnWrap as any).dataset.forceVisible;
      if (this.badgeEl.style.display === 'none') {
        this.sendBtnWrap.style.display = 'none';
      }
    }
  }

  destroy(): void {
    this._unbindSystemListener();
    if (this.settingsPanel) {
      this.settingsPanel.remove();
      this.settingsPanel = null;
    }
    this.el.remove();
  }
}
