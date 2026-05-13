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

    // Load Improv fonts
    if (!document.getElementById('improv-font')) {
      const style = document.createElement('style');
      style.id = 'improv-font';
      style.textContent = [
        "@font-face{font-family:ImprovSans;src:url('http://localhost:9223/fonts/improvsans-400.woff2') format('woff2');font-weight:400;font-display:swap}",
        "@font-face{font-family:ImprovSans;src:url('http://localhost:9223/fonts/improvsans-700.woff2') format('woff2');font-weight:700;font-display:swap}",
        "@font-face{font-family:'ImprovSerif';src:url('http://localhost:9223/fonts/improvserif-400.woff2') format('woff2');font-weight:400;font-display:swap}",
        "@font-face{font-family:'ImprovSerif';src:url('http://localhost:9223/fonts/improvserif-700.woff2') format('woff2');font-weight:700;font-display:swap}",
        "@font-face{font-family:ImprovMono;src:url('http://localhost:9223/fonts/improvmono-400.woff2') format('woff2');font-weight:400;font-display:swap}",
      ].join('');
      document.head.appendChild(style);
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
            'font-family:ImprovMono,ui-monospace,monospace;white-space:nowrap;pointer-events:none;' +
            'max-width:200px;overflow:hidden;text-overflow:ellipsis';
          label.textContent = sel;
          highlight.appendChild(label);

          document.body.appendChild(highlight);
          (this._taskHighlights as any[]).push({ el: el as HTMLElement, box: highlight });
        }
      }
      this._startHighlightTracking();
    });

    this._changesPanel.setOnItemClick((index: number) => {
      const entries = this._changeHistory.filter((e: any) =>
        (e.status === 'completed' && e.changes && e.changes.length > 0) || e.status === 'needsInfo'
      );
      const entry = entries[index];
      if (entry) {
        this._changesPanel!.showDetail(entry as any, index);
      }
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
    // Keep action pill visible for Claude button if changes exist
    if ((this.promptMode as any)?._actionPill && this._changeHistory.some(e => !e.reviewed)) {
      const pill = (this.promptMode as any)._actionPill;
      pill.style.display = 'flex';
      pill.style.opacity = '1';
      pill.style.transform = 'scale(1)';
      // Hide queue-specific buttons, show only Claude
      if ((this.promptMode as any)._queueBtn) (this.promptMode as any)._queueBtn.style.display = 'none';
      if ((this.promptMode as any)._sendAllBtn) (this.promptMode as any)._sendAllBtn.style.display = 'none';
      if ((this.promptMode as any)._clearAllBtn) (this.promptMode as any)._clearAllBtn.style.display = 'none';
      if ((this.promptMode as any)._pillDivider) (this.promptMode as any)._pillDivider.style.display = 'none';
      if ((this.promptMode as any)._claudeBtn) (this.promptMode as any)._claudeBtn.style.display = 'flex';
      if ((this.promptMode as any)._claudeDivider) (this.promptMode as any)._claudeDivider.style.display = 'none';
    }
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
    this._toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:10px 20px;z-index:2147483647;pointer-events:none;display:flex;align-items:center;gap:10px;font-family:ImprovSans,system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:improv-toast-slide-in 0.3s cubic-bezier(0.23,1,0.32,1) forwards;overflow:hidden';
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
    this._toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:10px 20px;z-index:2147483647;pointer-events:none;display:flex;align-items:center;gap:10px;font-family:ImprovSans,system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:improv-toast-slide-in 0.3s cubic-bezier(0.23,1,0.32,1) forwards;max-width:480px';

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
            'font-size:10px;font-family:ImprovMono,ui-monospace,monospace;color:rgba(255,255,255,0.7);' +
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

    // If prompt mode is active, update its claude button in the action pill
    if (this.promptMode && (this.promptMode as any)._claudeBtn) {
      (this.promptMode as any)._claudeBtn.style.display = unreviewed > 0 ? 'flex' : 'none';
      if ((this.promptMode as any)._claudeDivider) {
        (this.promptMode as any)._claudeDivider.style.display = unreviewed > 0 ? '' : 'none';
      }
      // Show the action pill if claude changes exist even with empty queue
      if (unreviewed > 0 && (this.promptMode as any)._actionPill) {
        (this.promptMode as any)._actionPill.style.display = 'flex';
        (this.promptMode as any)._actionPill.style.opacity = '1';
        (this.promptMode as any)._actionPill.style.transform = 'scale(1)';
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
