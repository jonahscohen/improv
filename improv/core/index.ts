import { Transport } from './transport';
import { Overlay } from './overlay';
import { Toolbar } from './toolbar';
import { AdapterRegistry } from './adapter-registry';
import { PreviewEngine } from './preview-engine';
import { ChangeBuffer } from './change-buffer';
import { ApplyConfirmation } from './apply-confirmation';
import { ManipulateMode } from './manipulate/index.js';
import { PromptMode } from './prompt/index.js';
import { ChangesPanel } from './changes-panel';
import type { ImprovAdapter, ImprovMode } from './types';

// Window.__improv typed via assignment below

export class ImprovCore {
  private transport: Transport;
  private overlay: Overlay;
  _changeQueue: unknown[] = [];
  private _screenGlow: HTMLDivElement | null = null;
  private registry: AdapterRegistry;
  private toolbar: Toolbar | null = null;
  private active = false;
  private currentMode: ImprovMode | null = null;

  private previewEngine: PreviewEngine | null = null;
  private changeBuffer: ChangeBuffer | null = null;
  private manipulateMode: ManipulateMode | null = null;
  private promptMode: PromptMode | null = null;
  private applyConfirmation: ApplyConfirmation | null = null;
  private _toast: HTMLDivElement | null = null;
  _changeHistory: Array<Record<string, unknown>> = [];
  private _changesPanel: ChangesPanel | null = null;
  private _claudeBtn: HTMLDivElement | null = null;
  private _claudePulseStyle: HTMLStyleElement | null = null;
  private _taskHighlights: Array<{el: HTMLElement; box: HTMLElement}> = [];

  constructor() {
    this.transport = new Transport();
    this.overlay = new Overlay();
    this.registry = new AdapterRegistry();
  }

  async init(): Promise<void> {
    this.transport.on('activate', () => this.activate());
    this.transport.on('deactivate', () => this.deactivate());

    this.transport.on('changes_applied', () => {
      this.toolbar?.setBadge(this.changeBuffer?.count() ?? 0);
    });

    this.transport.on('cleared', () => {
      this.changeBuffer?.clear();
      this.previewEngine?.clearAll();
      this.toolbar?.setBadge(0);
    });

    this.transport.on('improv_response', (data: unknown) => {
      const response = data as Record<string, unknown>;
      response.reviewed = false;
      this._changeHistory.push(response);
      try {
        localStorage.setItem('improv-change-history', JSON.stringify(this._changeHistory));
      } catch {}
      this._updateClaudeBadge();
      const status = response.status as string;
      const summary = response.summary as string;
      if (status === 'completed') {
        this._showResponseToast(summary, 'completed');
        this._highlightChangedElements(response.changes as any[]);
        this._previewChanges(response.changes as any[]);
        setTimeout(() => location.reload(), 2000);
      } else if (status === 'needsInfo') {
        this._showResponseToast(response.question as string || summary, 'needsInfo');
      } else {
        this._showResponseToast(summary, 'failed');
      }
    });

    try {
      const stored = localStorage.getItem('improv-change-history');
      if (stored) this._changeHistory = JSON.parse(stored);
    } catch {}

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '.') {
        e.preventDefault();
        if (this.toolbar) {
          this.toolbar.destroy();
          this.toolbar = null;
          this.switchMode(null);
        } else {
          this.toolbar = new Toolbar(this.overlay.getShadowRoot());
          this.toolbar.setConnected(this.transport.isConnected());
          this.toolbar.onMode((mode) => this.switchMode(mode));
          this.toolbar.onApply(() => this.applyChanges());
          this.toolbar.onSendToClaude(() => this.sendAnnotations());
          this.toolbar.onClearAll(() => this.clearAll());
          this.toolbar.onMarkerColorChange((c: string) => {
            this.overlay.setHighlightColor(c);
            this._updateScreenGlowColor(c);
            this.toolbar?.updateModeButtonStyles();
            this._syncPromptModeColor(c);
          });
          this.toolbar.setBadge(this.changeBuffer?.count() ?? 0);
        }
        return;
      }
      if (e.key === 'Escape' && this.active) {
        e.preventDefault();
        if (this._changesPanel?.isVisible()) {
          this._changesPanel.hide();
        } else if (this.currentMode) {
          this.switchMode(null);
          this.toolbar?.setActiveMode(null);
        }
        return;
      }

      // Single-key shortcuts: suppress when text input is focused
      const ae = document.activeElement;
      const inInput = ae?.tagName === 'INPUT' || ae?.tagName === 'TEXTAREA' || (ae as HTMLElement)?.isContentEditable;
      if (inInput) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!this.toolbar || this.toolbar._collapsed) return;

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        const next = this.currentMode === 'prompt' ? null : 'prompt' as ImprovMode;
        this.toolbar.setActiveMode(next);
        this.switchMode(next);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const next = this.currentMode === 'manipulate' ? null : 'manipulate' as ImprovMode;
        this.toolbar.setActiveMode(next);
        this.switchMode(next);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this._changesPanel?.toggle(this._changeHistory as any);
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        if (this.promptMode && (this.promptMode as any)._toggleQueuePanel) {
          (this.promptMode as any)._toggleQueuePanel();
        }
      }
    });

    try {
      await this.transport.connect();
    } catch {
    }

    this.activate();
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    console.log('[Improv] activate()');

    this.previewEngine = new PreviewEngine();
    this.changeBuffer = new ChangeBuffer();

    this.overlay.mount();

    this.applyConfirmation = new ApplyConfirmation(this.overlay.getShadowRoot());

    this.toolbar = new Toolbar(this.overlay.getShadowRoot());
    this.toolbar.setConnected(this.transport.isConnected());
    this.toolbar.onMode((mode) => this.switchMode(mode));
    this.toolbar.onApply(() => this.applyChanges());
    this.toolbar.onSendToClaude(() => this.sendAnnotations());
    this.toolbar.onClearAll(() => this.clearAll());
    this.toolbar.onMarkerColorChange((c: string) => {
      this.overlay.setHighlightColor(c);
      this._updateScreenGlowColor(c);
      this.toolbar?.updateModeButtonStyles();
      this._syncPromptModeColor(c);
    });

    this._changesPanel = new ChangesPanel(
      this.overlay.getShadowRoot(),
      () => this.toolbar?.getMarkerColor() || '#3b82f6'
    );
    this._changesPanel.setOnDone((promptId: string) => {
      for (const entry of this._changeHistory) {
        if (entry.promptId === promptId) {
          entry.reviewed = true;
        }
      }
      try { localStorage.setItem('improv-change-history', JSON.stringify(this._changeHistory)); } catch {}
      this._updateClaudeBadge();
      // Re-sync panel with current history
      if (this._changesPanel?.isVisible()) {
        this._changesPanel.show(this._changeHistory as any);
      }
    });
    this._changesPanel.setOnReply((promptId: string, text: string) => {
      this.transport.request('push_prompt', {
        context: 'Reply to ' + promptId + ': ' + text,
        prompt: text,
        elementCount: 0
      }).catch((e: unknown) => { console.warn('[Improv] Reply failed:', e); });
    });

    this._changesPanel.setOnClearReviewed(() => {
      this._changeHistory = this._changeHistory.filter(e => !e.reviewed);
      try { localStorage.setItem('improv-change-history', JSON.stringify(this._changeHistory)); } catch {}
      this._updateClaudeBadge();
      if (this._changeHistory.length === 0 && this._claudeBtn) {
        this._claudeBtn.remove();
        this._claudeBtn = null;
      }
    });

    this._changesPanel.setOnPreviewToggle((_promptId: string, changes: any[], showOld: boolean) => {
      if (this.previewEngine) {
        this.previewEngine.attach();
        for (const ch of changes) {
          this.previewEngine.applyChange(ch.selector, ch.property, showOld ? ch.oldValue : ch.newValue);
        }
      }
    });

    this._changesPanel.setOnSelect((selectors: string[]) => {
      this._clearTaskHighlights();
      if (selectors.length === 0) return;

      for (const sel of selectors) {
        let els: Element[];
        try { els = Array.from(document.querySelectorAll(sel)); } catch { continue; }
        for (const el of els) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          const highlight = document.createElement('div');
          highlight.dataset.improv = '';
          highlight.style.cssText =
            'position:fixed;pointer-events:none;z-index:2147483646;' +
            'border:2px solid #D97757;border-radius:4px;' +
            'transition:top 60ms ease,left 60ms ease,width 60ms ease,height 60ms ease';

          const label = document.createElement('div');
          label.dataset.improv = '';
          label.style.cssText =
            'position:absolute;top:-22px;left:0;padding:2px 6px;border-radius:3px;' +
            'background:#D97757;color:#fff;font-size:9px;font-weight:600;' +
            'font-family:ui-monospace,monospace;white-space:nowrap;pointer-events:none;' +
            'max-width:200px;overflow:hidden;text-overflow:ellipsis';
          label.textContent = sel;
          highlight.appendChild(label);

          document.body.appendChild(highlight);
          (this._taskHighlights as any[]).push({ el: el as HTMLElement, box: highlight });
        }
      }
      this._startHighlightTracking();
    });

    this._changesPanel.setOnRevert((promptId: string, changes: any[]) => {
      const revertDetails = changes.map((ch: any) => 
        ch.selector + ' { ' + ch.property + ': ' + ch.oldValue + ' }'
      ).join('\n');
      this.transport.request('push_prompt', {
        context: 'REVERT REQUEST for ' + promptId + ':\n' + revertDetails,
        prompt: 'Revert the changes from ' + promptId + '. Restore these properties to their original values:\n' + revertDetails,
        elementCount: changes.length
      }).catch((e: unknown) => { console.warn('[Improv] Revert prompt failed:', e); });
      this._showResponseToast('Revert requested', 'needsInfo');
    });

    if (this._changeHistory.some(e => !e.reviewed)) {
      this._updateClaudeBadge();
    }

    const onDisconnected = () => this.toolbar?.setConnected(false);
    const onConnected = () => this.toolbar?.setConnected(true);
    this.transport.on('disconnected', onDisconnected);
    this.transport.on('connected', onConnected);
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;

    this.switchMode(null);
    this.toolbar?.destroy();
    this.toolbar = null;
    this.applyConfirmation?.destroy();
    this.applyConfirmation = null;
    this.overlay.unmount();

    this.previewEngine?.detach();
    this.previewEngine = null;
    this.changeBuffer = null;
  }

  switchMode(mode: ImprovMode | null): void {
    console.log('[Improv] switchMode:', mode);

    this.manipulateMode?.deactivate();
    this.manipulateMode = null;
    this.promptMode?.deactivate();
    this.promptMode = null;

    this.currentMode = mode;

    if (mode === 'manipulate' && this.previewEngine && this.changeBuffer) {
      this.manipulateMode = new ManipulateMode(
        this.overlay,
        this.previewEngine,
        this.changeBuffer,
        this.transport,
      );
      this.manipulateMode.activate();
    } else if (mode === 'prompt') {
      this.promptMode = new PromptMode(this.overlay, this.transport, this.registry);
      (this.promptMode as any)._core = this;
      (this.promptMode as any)._changeQueue = this._changeQueue;
      this.promptMode.setColorGetter(() => this.toolbar!.getMarkerColor());
      if ((this.promptMode as any).prompt) {
        (this.promptMode as any).prompt._showHints = (this.toolbar as any).showHints !== false;
      }
      this.overlay.setHighlightColor(this.toolbar!.getMarkerColor());

      this.toolbar!.onMarkerColorChange((c: string) => {
        this.overlay.setHighlightColor(c);
        this._updateScreenGlowColor(c);
        this.toolbar?.updateModeButtonStyles();
        this._syncPromptModeColor(c);
      });

      this.toolbar!.onHintsChange(((v: boolean) => {
        if (this.promptMode) {
          (this.promptMode as any)._showHints = v;
          if ((this.promptMode as any).prompt) (this.promptMode as any).prompt._showHints = v;
          if (!v && (this.promptMode as any)._hLabel) (this.promptMode as any)._hLabel.style.opacity = '0';
        }
      }).bind(this));

      this.toolbar!.onSelectionLabelChange(((v: boolean) => {
        if (this.promptMode) {
          (this.promptMode as any)._showLabels = v;
          if ((this.promptMode as any)._selOverlays && (this.promptMode as any)._selOverlays.length > 0) {
            (this.promptMode as any)._showSelOverlays();
          }
        }
      }).bind(this));

      this.promptMode.onPromptSent((_text: string, _count: number) => {});
      this.promptMode.activate();
    }

    this.toolbar?.setBadge(this.getTotalPendingCount());
    this.toolbar?.showSendButton(mode === 'prompt');

    if (mode === 'prompt' || mode === 'manipulate') {
      this._showScreenGlow(this.toolbar?.getMarkerColor());
    } else {
      this._hideScreenGlow();
    }
  }

  private _syncPromptModeColor(c: string): void {
    if (!this.promptMode) return;
    (this.promptMode as any)._selColor = c;
    if ((this.promptMode as any)._lasso) (this.promptMode as any)._lasso.setColor(c);
    if ((this.promptMode as any).prompt) (this.promptMode as any).prompt.setMarkerColor(c);
    if ((this.promptMode as any)._selOverlays && (this.promptMode as any)._selOverlays.length > 0) {
      (this.promptMode as any)._showSelOverlays();
    }
    const _pic = ['#f97316', '#eab308', '#22c55e'].indexOf(c) !== -1 ? '#1a1a1a' : '#fff';
    if ((this.promptMode as any)._queueBtn && (this.promptMode as any)._queueBtn.dataset.active) {
      (this.promptMode as any)._queueBtn.style.background = c;
      (this.promptMode as any)._queueBtn.style.color = _pic;
      if ((this.promptMode as any)._queueCount) (this.promptMode as any)._queueCount.style.color = _pic;
    } else if ((this.promptMode as any)._queueCount) {
      (this.promptMode as any)._queueCount.style.color = c;
    }
    if ((this.promptMode as any)._sendAllBtn && (this.promptMode as any)._sendAllBtn.style.display !== 'none') {
      (this.promptMode as any)._sendAllBtn.style.background = c + '33';
      (this.promptMode as any)._sendAllBtn.style.color = c;
    }
    if ((this.promptMode as any)._clearAllBtn && (this.promptMode as any)._clearAllBtn.style.display !== 'none') {
      (this.promptMode as any)._clearAllBtn.style.background = c + '33';
      (this.promptMode as any)._clearAllBtn.style.color = c;
    }
    this._updateClaudeBadge();
  }

  private _showScreenGlow(color?: string): void {
    if (!this._screenGlow) {
      this._screenGlow = document.createElement('div');
      this._screenGlow.id = 'improv-screen-glow';
      this._screenGlow.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;opacity:0;transition:opacity 1.2s ease-in-out';
      if (!document.getElementById('improv-glow-style')) {
        const gs = document.createElement('style');
        gs.id = 'improv-glow-style';
        gs.textContent = '@keyframes improv-glow-pulse{0%{filter:brightness(0.7)}50%{filter:brightness(1)}100%{filter:brightness(0.7)}}';
        document.head.appendChild(gs);
      }
    }
    const c = color || '#3b82f6';
    const _r = parseInt(c.slice(1, 3), 16);
    const _g = parseInt(c.slice(3, 5), 16);
    const _b = parseInt(c.slice(5, 7), 16);
    this._screenGlow.style.boxShadow =
      'rgba(' + _r + ',' + _g + ',' + _b + ',0.65) 0px 0px 15px 0px inset, ' +
      'rgba(' + _r + ',' + _g + ',' + _b + ',0.45) 0px 0px 25px 0px inset, ' +
      'rgba(' + _r + ',' + _g + ',' + _b + ',0.18) 0px 0px 35px 0px inset';
    this._screenGlow.style.animation = 'improv-glow-pulse 3s ease-in-out infinite';
    const _cic = document.getElementById('claude-agent-glow-border');
    if (_cic) _cic.style.opacity = '0';
    if (!this._screenGlow.parentNode) {
      document.body.appendChild(this._screenGlow);
      this._screenGlow.getBoundingClientRect();
      this._screenGlow.style.opacity = '1';
    } else {
      this._screenGlow.style.opacity = '1';
    }
  }

  private _hideScreenGlow(): void {
    if (this._screenGlow) {
      this._screenGlow.style.opacity = '0';
    }
    const _cic = document.getElementById('claude-agent-glow-border');
    if (_cic) _cic.style.opacity = '1';
  }

  private _updateScreenGlowColor(color: string): void {
    if (this._screenGlow && this._screenGlow.style.opacity === '1') {
      this._showScreenGlow(color);
    }
  }

  _showToast(message: string, elementCount: number): void {
    if (this._toast) {
      this._toast.remove();
    }
    this._toast = document.createElement('div');
    this._toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:10px 20px;z-index:2147483647;pointer-events:none;display:flex;align-items:center;gap:10px;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:improv-toast-slide-in 0.3s cubic-bezier(0.23,1,0.32,1) forwards;overflow:hidden';
    const _mColor = this.toolbar ? this.toolbar.getMarkerColor() : '#3b82f6';
    const _bar = document.createElement('div');
    _bar.style.cssText = 'position:absolute;bottom:0;left:0;height:2px;background:' + _mColor + ';border-radius:0 0 24px 24px;animation:improv-toast-progress 1.5s ease forwards';
    this._toast.appendChild(_bar);

    const _spin = document.createElement('div');
    _spin.style.cssText = 'width:18px;height:18px;display:grid;grid-template-columns:repeat(4,1fr);gap:1.5px;flex-shrink:0;align-content:center;justify-content:center';
    const _dots: HTMLDivElement[] = [];
    const _PERIM = [0, 1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4];
    const _INNER = [5, 6, 9, 10];
    for (let _di = 0; _di < 16; _di++) {
      const _dot = document.createElement('div');
      _dot.style.cssText = 'width:3px;height:3px;border-radius:50%;background:' + _mColor + ';opacity:0.15;transition:opacity 80ms ease';
      _spin.appendChild(_dot);
      _dots.push(_dot);
    }
    let _head = 0;
    const _tail = [1, 0.82, 0.64, 0.46, 0.3, 0.18];
    const _btail = [0.38, 0.3, 0.22, 0.14];
    const _dmxIv = setInterval(() => {
      for (let _di = 0; _di < 16; _di++) _dots[_di].style.opacity = '0.15';
      for (let _ti = 0; _ti < _tail.length; _ti++) {
        const _pi = (_head - _ti + _PERIM.length) % _PERIM.length;
        _dots[_PERIM[_pi]].style.opacity = String(_tail[_ti]);
      }
      const _bh = (_head + Math.floor(_PERIM.length / 2)) % _PERIM.length;
      for (let _bi = 0; _bi < _btail.length; _bi++) {
        const _bpi = (_bh - _bi + _PERIM.length) % _PERIM.length;
        _dots[_PERIM[_bpi]].style.opacity = String(_btail[_bi]);
      }
      _head = (_head + 1) % _PERIM.length;
    }, 110);
    (_spin as any)._dmxIv = _dmxIv;
    this._toast.appendChild(_spin);

    const _txt = document.createElement('span');
    _txt.style.cssText = 'font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);white-space:nowrap';
    _txt.textContent = 'Sending ' + (elementCount > 0 ? elementCount + ' change' + (elementCount > 1 ? 's' : '') : '') + ' to Claude...';
    this._toast.appendChild(_txt);

    if (!document.getElementById('improv-toast-style')) {
      const _ts = document.createElement('style');
      _ts.id = 'improv-toast-style';
      _ts.textContent = '@keyframes improv-toast-slide-in{from{transform:translateY(-100%) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}@keyframes improv-toast-slide-out{from{transform:translateY(0) translateX(-50%);opacity:1}to{transform:translateY(-100%) translateX(-50%);opacity:0}}@keyframes improv-toast-progress{0%{width:0}100%{width:100%}}@keyframes improv-toast-check-draw{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}';
      document.head.appendChild(_ts);
    }
    document.body.appendChild(this._toast);

    const _self = this;
    setTimeout(() => {
      if (!_self._toast) return;
      if (((_spin as any)._dmxIv)) clearInterval((_spin as any)._dmxIv);
      _spin.style.animation = 'none';
      _spin.style.border = 'none';
      _spin.style.width = '18px';
      _spin.style.height = '18px';
      _spin.style.display = 'flex';
      _spin.style.alignItems = 'center';
      _spin.style.justifyContent = 'center';
      const _svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      _svg.setAttribute('width', '18');
      _svg.setAttribute('height', '18');
      _svg.setAttribute('viewBox', '0 0 24 24');
      _svg.setAttribute('fill', 'none');
      _svg.setAttribute('stroke', 'currentColor');
      _svg.setAttribute('stroke-width', '2.5');
      _svg.setAttribute('stroke-linecap', 'round');
      _svg.setAttribute('stroke-linejoin', 'round');
      _svg.style.color = '#22c55e';
      const _cp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      _cp.setAttribute('d', 'M4 12 9 17L20 6');
      _cp.style.cssText = 'stroke-dasharray:20;animation:improv-toast-check-draw 0.4s ease forwards';
      _svg.appendChild(_cp);
      while (_spin.firstChild) _spin.removeChild(_spin.firstChild);
      _spin.appendChild(_svg);
      _txt.textContent = 'Sent to Claude';
      _txt.style.fontWeight = '700';
      _bar.style.display = 'none';
      setTimeout(() => {
        if (_self._toast) {
          _self._toast.style.animation = 'improv-toast-slide-out 0.3s ease forwards';
          setTimeout(() => {
            if (_self._toast) {
              _self._toast.remove();
              _self._toast = null;
            }
          }, 300);
        }
      }, 1500);
    }, 1500);
  }

  _showResponseToast(message: string, status: 'completed' | 'needsInfo' | 'failed'): void {
    if (this._toast) {
      this._toast.remove();
      this._toast = null;
    }
    this._toast = document.createElement('div');
    this._toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:10px 20px;z-index:2147483647;pointer-events:none;display:flex;align-items:center;gap:10px;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:improv-toast-slide-in 0.3s cubic-bezier(0.23,1,0.32,1) forwards;max-width:480px';

    const _mColor = this.toolbar ? this.toolbar.getMarkerColor() : '#3b82f6';

    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = 'width:18px;height:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    if (status === 'completed') {
      svg.style.color = '#22c55e';
      path.setAttribute('d', 'M4 12 9 17L20 6');
      path.style.cssText = 'stroke-dasharray:20;animation:improv-toast-check-draw 0.4s ease forwards';
    } else if (status === 'needsInfo') {
      svg.style.color = _mColor;
      path.setAttribute('d', 'M12 8v4m0 4h.01');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      svg.appendChild(circle);
    } else {
      svg.style.color = '#ef4444';
      path.setAttribute('d', 'M18 6 6 18M6 6l12 12');
    }
    svg.appendChild(path);
    iconWrap.appendChild(svg);
    this._toast.appendChild(iconWrap);

    const label = document.createElement('span');
    label.style.cssText = 'font-size:11px;font-weight:600;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    if (status === 'completed') {
      label.textContent = message;
    } else if (status === 'needsInfo') {
      label.textContent = 'Claude asks: ' + message;
    } else {
      label.textContent = 'Failed: ' + message;
    }
    this._toast.appendChild(label);

    if (!document.getElementById('improv-toast-style')) {
      const ts = document.createElement('style');
      ts.id = 'improv-toast-style';
      ts.textContent = '@keyframes improv-toast-slide-in{from{transform:translateY(-100%) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}@keyframes improv-toast-slide-out{from{transform:translateY(0) translateX(-50%);opacity:1}to{transform:translateY(-100%) translateX(-50%);opacity:0}}@keyframes improv-toast-progress{0%{width:0}100%{width:100%}}@keyframes improv-toast-check-draw{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}';
      document.head.appendChild(ts);
    }
    document.body.appendChild(this._toast);

    const dismissDelay = status === 'needsInfo' ? 5000 : 3000;
    const self = this;
    setTimeout(() => {
      if (self._toast) {
        self._toast.style.animation = 'improv-toast-slide-out 0.3s ease forwards';
        setTimeout(() => {
          if (self._toast) {
            self._toast.remove();
            self._toast = null;
          }
        }, 300);
      }
    }, dismissDelay);
  }

  private getTotalPendingCount(): number {
    const count = this.changeBuffer?.count() ?? 0;
    return count;
  }

  private async applyChanges(): Promise<void> {
    if (!this.changeBuffer || this.changeBuffer.count() === 0) return;
    const changes = this.changeBuffer.flush();

    try {
      await this.transport.request('push_changes', {
        changes: changes.map((c) => ({
          selector: c.selector,
          property: c.property,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
      });
      this.previewEngine?.clearAll();
      this.toolbar?.setBadge(0);

      const items = changes.map((c) => ({
        label: `${c.selector}`,
        detail: `${c.property}: ${c.newValue}`,
      }));
    } catch (err) {
      for (const c of changes) {
        this.changeBuffer?.add(c.selector, c.property, c.oldValue, c.newValue);
      }
      const message = err instanceof Error ? err.message : 'Connection error';
    }
  }

  private async sendAnnotations(): Promise<void> {
  }

  private clearAll(): void {
    this.switchMode(null);
    this.toolbar?.setActiveMode(null);
    this.changeBuffer?.clear();
    this.previewEngine?.clearAll();
    this.toolbar?.setBadge(0);
    this.transport.request('clear', {}).catch(() => {});
  }

  registerAdapter(adapter: ImprovAdapter): void {
    this.registry.register(adapter);
  }

  private _previewChanges(changes: Array<{ selector: string; property: string; oldValue: string; newValue: string }>): void {
    if (!changes || changes.length === 0 || !this.previewEngine) return;
    this.previewEngine.attach();
    for (const c of changes) {
      this.previewEngine.applyChange(c.selector, c.property, c.newValue);
    }
  }

  private _highlightChangedElements(changes: Array<{ selector: string; property: string; oldValue: string; newValue: string }>): void {
    if (!changes || changes.length === 0) return;
    const mc = this.toolbar?.getMarkerColor() || '#3b82f6';
    const selectors = [...new Set(changes.map(c => c.selector))];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (const sel of selectors) {
      let els: Element[];
      try { els = Array.from(document.querySelectorAll(sel)); } catch { continue; }

      for (const el of els) {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const highlight = document.createElement('div');
        highlight.dataset.improv = '';
        highlight.style.cssText =
          'position:fixed;pointer-events:none;z-index:2147483646;' +
          'border:2px solid ' + mc + ';border-radius:4px;' +
          'box-shadow:0 0 12px ' + mc + '40;' +
          'top:' + rect.top + 'px;left:' + rect.left + 'px;' +
          'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
          'transition:opacity 0.4s ease;opacity:1';

        if (!reducedMotion) {
          highlight.style.animation = 'improv-highlight-pulse 0.6s ease-in-out 2';
        }

        const selectorChanges = changes.filter(c => c.selector === sel);
        if (selectorChanges.length > 0) {
          const pill = document.createElement('div');
          pill.dataset.improv = '';
          pill.style.cssText =
            'position:absolute;top:-24px;left:0;padding:2px 8px;border-radius:4px;' +
            'background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);' +
            'font-size:10px;font-family:ui-monospace,monospace;color:rgba(255,255,255,0.7);' +
            'white-space:nowrap;pointer-events:none';
          pill.textContent = selectorChanges.map(c => c.property + ': ' + c.newValue).join('; ');
          highlight.appendChild(pill);
        }

        document.body.appendChild(highlight);
        setTimeout(() => { highlight.style.opacity = '0'; }, 1200);
        setTimeout(() => { highlight.remove(); }, 1600);
      }
    }

    if (!document.getElementById('improv-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'improv-highlight-style';
      style.textContent = '@keyframes improv-highlight-pulse{0%{box-shadow:0 0 4px ' + mc + '40}50%{box-shadow:0 0 20px ' + mc + '60}100%{box-shadow:0 0 4px ' + mc + '40}}';
      document.head.appendChild(style);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  private _highlightRaf: number | null = null;

  private _startHighlightTracking(): void {
    if (this._highlightRaf !== null) return;
    const tick = () => {
      for (const {el, box} of this._taskHighlights) {
        const r = el.getBoundingClientRect();
        box.style.top = r.top + 'px';
        box.style.left = r.left + 'px';
        box.style.width = r.width + 'px';
        box.style.height = r.height + 'px';
      }
      this._highlightRaf = requestAnimationFrame(tick);
    };
    this._highlightRaf = requestAnimationFrame(tick);
  }

  private _clearTaskHighlights(): void {
    if (this._highlightRaf !== null) {
      cancelAnimationFrame(this._highlightRaf);
      this._highlightRaf = null;
    }
    for (const {box} of this._taskHighlights) box.remove();
    this._taskHighlights = [];
  }

  getTransport(): Transport {
    return this.transport;
  }

  getOverlay(): Overlay {
    return this.overlay;
  }

  getAdapters(): AdapterRegistry {
    return this.registry;
  }

  private _updateClaudeBadge(): void {
    const unreviewed = this._changeHistory.filter(e => !e.reviewed).length;
    if (unreviewed > 0 && !this._claudeBtn) {
      this._claudeBtn = document.createElement('div');
      this._claudeBtn.setAttribute('role', 'button');
      this._claudeBtn.setAttribute('aria-label', 'Review Changes (' + unreviewed + ')');
      this._claudeBtn.setAttribute('tabindex', '0');
      this._claudeBtn.style.cssText =
        'position:fixed;bottom:20px;left:20px;width:44px;height:44px;border-radius:22px;' +
        'background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;z-index:2147483647;' +
        'box-shadow:0 2px 12px rgba(0,0,0,0.15),0 0 0 1px rgba(255,255,255,0.08);' +
        'pointer-events:all;padding:0;outline:none;' +
        'transition:background 120ms ease,color 120ms ease;' +
        'color:#D97757;' +
        'animation:improv-claude-entrance 0.3s cubic-bezier(0.23,1,0.32,1)';

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('width', '18');
      icon.setAttribute('height', '18');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', '#D97757');
      icon.setAttribute('fill-rule', 'nonzero');
      const claudePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      claudePath.setAttribute('d', 'M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z');
      icon.appendChild(claudePath);
      this._claudeBtn.appendChild(icon);

      this._claudeBtn.addEventListener('mouseenter', () => {
        if (!this._claudeBtn!.dataset.active) this._claudeBtn!.style.background = '#D9775715';
      });
      this._claudeBtn.addEventListener('mouseleave', () => {
        if (!this._claudeBtn!.dataset.active) this._claudeBtn!.style.background = '#1a1a1a';
      });
      this._claudeBtn.addEventListener('click', () => {
        this._changesPanel?.toggle(this._changeHistory as any);
        const isOpen = this._changesPanel?.isVisible();
        if (isOpen) {
          this._claudeBtn!.style.background = '#D97757';
          this._claudeBtn!.querySelector('svg')!.setAttribute('fill', '#fff');
          this._claudeBtn!.dataset.active = '1';
        } else {
          this._claudeBtn!.style.background = '#1a1a1a';
          this._claudeBtn!.querySelector('svg')!.setAttribute('fill', '#D97757');
          delete this._claudeBtn!.dataset.active;
        }
      });

      this.overlay.getContainer().parentNode?.appendChild(this._claudeBtn);
      if (!document.getElementById('improv-claude-btn-style')) {
        const s = document.createElement('style');
        s.id = 'improv-claude-btn-style';
        s.textContent = '@keyframes improv-claude-entrance{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}@keyframes improv-claude-btn-pulse{0%{transform:scale(1);box-shadow:0 2px 12px rgba(0,0,0,0.3)}50%{transform:scale(1.08);box-shadow:0 2px 20px rgba(217,119,87,0.45)}100%{transform:scale(1);box-shadow:0 2px 12px rgba(0,0,0,0.3)}}';
        document.head.appendChild(s);
      }
    }

    if (this._claudeBtn) {
      this._claudeBtn.setAttribute('aria-label', 'Review Changes (' + unreviewed + ')');

      if (unreviewed > 0) {
        this._claudeBtn.style.animation = 'improv-claude-btn-pulse 2s ease-in-out infinite';
      } else {
        this._claudeBtn.style.animation = 'none';
        this._claudeBtn.remove();
        this._claudeBtn = null;
        this._claudePulseStyle = null;
      }
    }
  }
}

const LOG_PREFIX = '[Improv]';
const log = {
  info: (...args: unknown[]) => console.log(LOG_PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(LOG_PREFIX, ...args),
  error: (...args: unknown[]) => console.error(LOG_PREFIX, ...args),
};

let improv: ImprovCore;
try {
  log.info('Initializing...');
  improv = new ImprovCore();
  window.__improv = improv;
  improv.init().then(() => {
    log.info('Ready. Transport:', improv.getTransport().isConnected() ? 'connected' : 'disconnected');
  }).catch((err) => {
    log.warn('Init completed with error (non-fatal):', err?.message ?? err);
  });
  log.info('Core created, init started.');
} catch (err) {
  log.error('Fatal error during initialization:', err);
  throw err;
}

export default improv;
