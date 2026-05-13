import type { ImprovMode } from './types';
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

type ModeCallback = (mode: ImprovMode | null) => void;
type ActionCallback = () => void;

const MODES: ImprovMode[] = ['prompt', 'manipulate'];

const MODE_LABELS: Record<string, string> = {
  manipulate: 'Manipulate',
  prompt: 'Prompt',
  layout: 'Layout',
};

const VERBOSITY_OPTIONS = ['compact', 'standard', 'detailed', 'forensic'] as const;

function applyStyles(el: HTMLElement | SVGElement, styles: Partial<CSSStyleDeclaration>): void {
  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined) {
      (el.style as any)[key] = value;
    }
  }
}

export class Toolbar {
  el: HTMLDivElement;
  activeMode: ImprovMode | null = null;
  modeCallbacks: ModeCallback[] = [];
  applyCallbacks: ActionCallback[] = [];
  sendToClaudeCallbacks: ActionCallback[] = [];
  clearAllCallbacks: ActionCallback[] = [];
  modeButtons = new Map<ImprovMode, HTMLButtonElement>();
  badgeEl: HTMLSpanElement;
  badgeDivider: HTMLDivElement;
  sendBtnWrap: HTMLButtonElement;
  actionDivider: HTMLDivElement;
  settingsPanel: HTMLDivElement | null = null;
  settingsBtn: HTMLButtonElement | null = null;
  verbosity: string = 'standard';
  connected: boolean = false;
  port: number = 3901;
  markerColor: string = (function () {
    try {
      return localStorage.getItem('improv-marker-color') || '#3b82f6';
    } catch (e) {
      return '#3b82f6';
    }
  })();
  markerColorCallbacks: Array<(color: string) => void> = [];
  showHints: boolean | undefined;
  showSelectionLabels: boolean | undefined;
  hintsCallbacks: Array<(v: boolean) => void> = [];
  selectionLabelCallbacks: Array<(v: boolean) => void> = [];

  private _closeBtn!: HTMLButtonElement;
  private _closeSvg!: SVGSVGElement;
  private _closeP1!: SVGPathElement;
  private _closeP2!: SVGPathElement;
  private _closeP3: SVGPathElement | null = null;
  private _closeDivider!: HTMLDivElement;
  private _collapsed: boolean = false;
  private _tt!: HTMLDivElement;
  private _ttTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(shadowRoot: ShadowRoot) {
    const animSheet = new CSSStyleSheet();
    animSheet.replaceSync(`
      @keyframes improv-pill-in {
        from { opacity: 0; transform: translateY(12px) scale(0.92); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes improv-icon-in {
        from { opacity: 0; transform: scale(0.8); filter: blur(2px); }
        to { opacity: 1; transform: scale(1); filter: blur(0); }
      }
      @keyframes improv-panel-in {
        from { opacity: 0; transform: translateY(8px) scale(0.97); filter: blur(3px); }
        to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
      }
      @keyframes improv-input-glow {
        0% { box-shadow: 0 0 4px 0px var(--improv-glow-color, #3b82f6); }
        50% { box-shadow: 0 0 8px 1px var(--improv-glow-color, #3b82f6); }
        100% { box-shadow: 0 0 4px 0px var(--improv-glow-color, #3b82f6); }
      }
      @keyframes improv-glow-pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
      }
      @keyframes improv-toast-slide-in {
        from { transform: translateY(-100%) translateX(-50%); opacity: 0; }
        to { transform: translateY(0) translateX(-50%); opacity: 1; }
      }
      @keyframes improv-toast-slide-out {
        from { transform: translateY(0) translateX(-50%); opacity: 1; }
        to { transform: translateY(-100%) translateX(-50%); opacity: 0; }
      }
      @keyframes improv-toast-progress {
        0% { width: 0%; }
        100% { width: 100%; }
      }
      @keyframes improv-toast-check-draw {
        from { stroke-dashoffset: 20; }
        to { stroke-dashoffset: 0; }
      }
      @keyframes improv-send-pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 currentColor; }
        30% { transform: scale(1.12); }
        50% { transform: scale(0.95); }
        70% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      @keyframes improv-badge-pop {
        0% { transform: scale(0.5); }
        60% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      @keyframes improv-msg-wiggle {
        0% { transform: scale(1) rotate(0deg); }
        20% { transform: scale(1.05) rotate(-7deg); }
        50% { transform: scale(1.05) rotate(7deg); }
        80% { transform: scale(1.02) rotate(-2deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      @keyframes improv-icon-hover-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(120deg); }
      }
      @keyframes improv-icon-hover-nudge {
        0% { transform: translate(0, 0); }
        15% { transform: translate(1.5px, -1.5px); }
        30% { transform: translate(0, 0); }
        45% { transform: translate(1.5px, -1.5px); }
        60% { transform: translate(0, 0); }
        100% { transform: translate(0, 0); }
      }
      @keyframes improv-icon-hover-shake {
        0% { transform: translateX(0); }
        20% { transform: translateX(-2px) rotate(-3deg); }
        40% { transform: translateX(2px) rotate(3deg); }
        60% { transform: translateX(-1px) rotate(-1deg); }
        80% { transform: translateX(1px) rotate(1deg); }
        100% { transform: translateX(0) rotate(0); }
      }
      @keyframes improv-icon-hover-rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(90deg); }
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
      fontFamily: 'system-ui, -apple-system, sans-serif',
      animation: 'improv-pill-in 0.35s cubic-bezier(0.23, 1, 0.32, 1) forwards',
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

    this.badgeDivider = this.createVerticalDivider();
    this.badgeDivider.style.display = 'none';

    let btnDelay = 0;
    for (const mode of MODES) {
      const btn = this.createToolbarButton(MODE_ICON_BUILDERS[mode], MODE_LABELS[mode]);
      btn.style.animation = `improv-icon-in 0.2s cubic-bezier(0.23, 1, 0.32, 1) ${btnDelay}ms both`;
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
      color: 'rgba(255,255,255,0.65)',
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
        this._closeBtn.style.background = this.markerColor + '33';
        this._closeBtn.style.color = this.markerColor || '#3b82f6';
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
        this._closeBtn.style.color = 'rgba(255,255,255,0.65)';
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
        this._closeP1.setAttribute('d', 'M19 4L10 4');
        this._closeP1.style.strokeDasharray = '12';
        this._closeP2.setAttribute('d', 'M14 20L5 20');
        this._closeP2.style.strokeDasharray = '12';
        if (!this._closeP3) {
          this._closeP3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          this._closeP3.setAttribute('d', 'M15 4L9 20');
          this._closeP3.style.cssText = 'stroke-dasharray:20;stroke-dashoffset:0';
          this._closeSvg.appendChild(this._closeP3);
        } else {
          this._closeP3.style.display = '';
        }
      } else {
        this._collapsed = false;
        this._closeP1.setAttribute('d', 'M18 6 6 18');
        this._closeP1.style.strokeDasharray = '20';
        this._closeP2.setAttribute('d', 'm6 6 12 12');
        this._closeP2.style.strokeDasharray = '20';
        if (this._closeP3) this._closeP3.style.display = 'none';
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
    this._tt.style.cssText = 'position:fixed;transform:translateX(-50%) translateY(4px);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 14px;font-size:11px;font-family:system-ui,sans-serif;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 120ms ease,transform 120ms ease;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:2147483647';
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
    this._closeP1.setAttribute('d', 'M19 4L10 4');
    this._closeP1.style.strokeDasharray = '12';
    this._closeP2.setAttribute('d', 'M14 20L5 20');
    this._closeP2.style.strokeDasharray = '12';
    this._closeP3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._closeP3.setAttribute('d', 'M15 4L9 20');
    this._closeP3.style.cssText = 'stroke-dasharray:20;stroke-dashoffset:0';
    this._closeSvg.appendChild(this._closeP3);
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
      color: 'rgba(255,255,255,0.65)',
      transition: 'background 120ms ease, color 120ms ease, transform 80ms ease',
      flexShrink: '0',
    });

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
        btn.style.background = this.markerColor + '33';
        btn.style.color = this.markerColor || '#3b82f6';
      }
      if (tooltip === 'Prompt') {
        icon.style.animation = 'improv-msg-wiggle 0.5s cubic-bezier(0.23,1,0.32,1)';
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
          Settings: 'improv-icon-hover-spin',
          Send: 'improv-icon-hover-nudge',
          Clear: 'improv-icon-hover-shake',
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
        btn.style.color = 'rgba(255,255,255,0.65)';
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
      background: 'rgba(255,255,255,0.12)',
      flexShrink: '0',
      margin: '0 3px',
    });
    return d;
  }

  toggleSettingsPanel(): void {
    if (this.settingsPanel) {
      this.settingsPanel.remove();
      this.settingsPanel = null;
      if (this.settingsBtn) {
        this.settingsBtn.style.background = 'transparent';
        this.settingsBtn.style.color = 'rgba(255,255,255,0.65)';
        delete this.settingsBtn.dataset.active;
      }
      return;
    }

    if (this.settingsBtn) {
      this.settingsBtn.style.background = this.markerColor || '#3b82f6';
      this.settingsBtn.style.color = ['#f97316', '#eab308', '#22c55e'].indexOf(this.markerColor) !== -1 ? '#1a1a1a' : '#fff';
      this.settingsBtn.dataset.active = '1';
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
      animation: 'improv-panel-in 0.25s cubic-bezier(0.23, 1, 0.32, 1) both',
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
      this.verbosity = select.value;
    });
    verbSection.appendChild(select);
    panel.appendChild(verbSection);

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
    if (statusVal) statusVal.style.color = this.connected ? '#22c55e' : '#ef4444';
    connInfo.appendChild(statusRow);
    connSection.appendChild(connInfo);
    panel.appendChild(connSection);

    const colorSection = this.buildSettingsRow('Marker Color');
    const swatchRow = document.createElement('div');
    applyStyles(swatchRow, {
      display: 'flex',
      gap: '6px',
      alignItems: 'center',
    });

    const SWATCHES = ['#3b82f6', '#ef4444', '#f97316', '#eab308', '#22c55e', '#8b5cf6'];
    const swatchEls: HTMLDivElement[] = [];
    for (const hex of SWATCHES) {
      const dot = document.createElement('div');
      const isActive = hex === this.markerColor;
      applyStyles(dot, {
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: hex,
        cursor: 'pointer',
        border: isActive ? '2px solid #fff' : '2px solid transparent',
        boxShadow: isActive ? `0 0 0 1px ${hex}` : 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease',
        flexShrink: '0',
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
        for (const d of swatchEls) {
          d.style.border = '2px solid transparent';
          d.style.boxShadow = 'none';
        }
        dot.style.border = '2px solid #fff';
        dot.style.boxShadow = `0 0 0 1px ${hex}`;
        this.markerColor = hex;
        try {
          localStorage.setItem('improv-marker-color', hex);
        } catch (e) {}
        for (const cb of this.markerColorCallbacks) cb(hex);
      });
      swatchEls.push(dot);
      swatchRow.appendChild(dot);
    }
    colorSection.appendChild(swatchRow);
    panel.appendChild(colorSection);

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
  }

  buildToggle(initial: boolean, onChange: (v: boolean) => void): HTMLDivElement {
    const wrap = document.createElement('div');
    applyStyles(wrap, {
      width: '36px',
      height: '20px',
      borderRadius: '10px',
      background: initial ? '#0D99FF' : '#333',
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
    wrap.addEventListener('click', function () {
      on = !on;
      wrap.style.background = on ? '#0D99FF' : '#333';
      knob.style.left = on ? '18px' : '2px';
      onChange(on);
    });
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
      color: 'rgba(255,255,255,0.35)',
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      fontFamily: 'system-ui, sans-serif',
    });
    section.appendChild(heading);
    return section;
  }

  buildKVRow(key: string, value: string): HTMLDivElement {
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

  initDrag(): void {}

  updateModeButtonStyles(): void {
    const _mc = this.markerColor || '#3b82f6';
    const _ic = ['#f97316', '#eab308', '#22c55e'].indexOf(_mc) !== -1 ? '#1a1a1a' : '#fff';
    this.modeButtons.forEach((btn, mode) => {
      if (mode === this.activeMode) {
        btn.style.background = _mc;
        btn.style.color = _ic;
        btn.dataset.active = '1';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'rgba(255,255,255,0.65)';
        delete btn.dataset.active;
      }
    });
    if (this.settingsBtn && this.settingsBtn.dataset.active) {
      this.settingsBtn.style.background = _mc;
      this.settingsBtn.style.color = _ic;
    }
  }

  setActiveMode(mode: ImprovMode | null): void {
    this.activeMode = mode;
    this.updateModeButtonStyles();
  }

  getActiveMode(): ImprovMode | null {
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
        this.badgeEl.style.animation = 'improv-badge-pop 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
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
    if (this.settingsPanel) {
      this.settingsPanel.remove();
      this.settingsPanel = null;
    }
    this.el.remove();
  }
}
