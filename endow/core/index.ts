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
import type { EndowAdapter, EndowMode } from './types';

// Window.__endow typed via assignment below

function detectEndowUrl(): { port: number; baseUrl: string } {
  const scripts = document.querySelectorAll('script[src*="endow-core"]');
  let port = 9223;
  let isHttps = false;
  for (const script of scripts) {
    const src = (script as HTMLScriptElement).src;
    const match = src.match(/:(\d+)/);
    if (match) port = parseInt(match[1], 10);
    if (src.startsWith('https://')) isHttps = true;
  }
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const baseUrl = `${protocol}://localhost:${port}`;
  return { port, baseUrl };
}

export class EndowCore {
  private transport: Transport;
  private overlay: Overlay;
  private endowPort: number;
  private endowBaseUrl: string;
  _changeQueue: unknown[] = [];
  private _screenGlow: HTMLDivElement | null = null;
  private registry: AdapterRegistry;
  private toolbar: Toolbar | null = null;
  private active = false;
  private currentMode: EndowMode | null = null;

  private previewEngine: PreviewEngine | null = null;
  private changeBuffer: ChangeBuffer | null = null;
  private manipulateMode: ManipulateMode | null = null;
  private promptMode: PromptMode | null = null;
  private applyConfirmation: ApplyConfirmation | null = null;
  private _toast: HTMLDivElement | null = null;
  _changeHistory: Array<Record<string, unknown>> = [];
  private _barTray: HTMLDivElement | null = null;
  private _queuePill: HTMLDivElement | null = null;
  private _changesPanel: ChangesPanel | null = null;
  private _taskHighlights: Array<{el: HTMLElement; box: HTMLElement}> = [];

  // Claudebar
  private _claudePill: HTMLDivElement | null = null;
  private _claudeSpark: HTMLDivElement | null = null;
  private _claudeLabel: HTMLSpanElement | null = null;
  private _claudeAnim: Animation | null = null;
  _claudeState: 'none' | 'connected' | 'sending' | 'working' | 'review' | 'review-active' | 'retry' | 'retrying' = 'none';
  _pendingResponses: number = 0;
  private _claudeTimeout: number | null = null;
  _lastPromptData: any = null;
  private _spriteSvgs: Record<string, string> = {};
  private _spritesLoaded = false;
  _watchActive = false;
  private _watchPollInterval: number | null = null;
  private _watchMissCount = 0;
  private _connectedTimeout: number | null = null;
  private static _spriteConfigs: Record<string, {frameCount: number; speed: number}> = {
    writing: { frameCount: 8, speed: 90 },
    shimmer: { frameCount: 15, speed: 100 },
    waiting: { frameCount: 16, speed: 600 },
    thinking: { frameCount: 9, speed: 90 }
  };
  private static _waitingFrameIndices = [2, 4, 7, 8, 11, 14, 15];
  private static _staticSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"/></svg>';

  constructor() {
    const urlInfo = detectEndowUrl();
    this.endowPort = urlInfo.port;
    this.endowBaseUrl = urlInfo.baseUrl;
    this.transport = new Transport(this.endowPort);
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

    this.transport.on('endow_working', () => {
      if (this._claudeState === 'sending') {
        this._claudeToWorking();
      }
    });

    this.transport.on('endow_response', (data: unknown) => {
      const response = data as Record<string, unknown>;
      response.reviewed = false;
      this._changeHistory.push(response);
      try {
        fetch(`${this.endowBaseUrl}/responses`,{method:'POST',body:JSON.stringify(this._changeHistory)}).catch(()=>{});
      } catch {}
      this._updateClaudeBadge();
      const status = response.status as string;
      if (status === 'completed') {
        this._highlightChangedElements(response.changes as any[]);
        this._previewChanges(response.changes as any[]);
      }
      // Decrement pending count and only transition to review when all responses are in
      this._pendingResponses = Math.max(0, this._pendingResponses - 1);
      if (this._pendingResponses === 0) {
        this._claudeToReview();
      }
    });

    // Load change history from server
    fetch(`${this.endowBaseUrl}/responses`).then(r => r.json()).then((data: any[]) => {
      this._changeHistory = data;
      this._updateClaudeBadge();
    }).catch(() => {});

    // Restore Claudebar state if mid-job on reload
    this._loadSprites();
    setTimeout(() => this._loadClaudeState(), 500);

    // Restore queued changes on page load (independent of prompt mode)
    // Delay to ensure _queuePill is created by activate() first
    setTimeout(() => {
    fetch(`${this.endowBaseUrl}/queue`).then(r => r.json()).then((data: any[]) => {
      if (!data || data.length === 0) return;
      // Only load if queue isn't already populated (prevent double-load)
      if (this._changeQueue.length > 0) return;
      for (const item of data) {
        const elements = (item.elements || []).map((el: any) => {
          let domNode: Element | null = null;
          try { domNode = document.querySelector(el.selector); } catch {}
          return { domNode: domNode || document.body, selector: el.selector, tagName: el.tagName || 'div' };
        });
        this._changeQueue.push({ prompt: item.prompt, elements });
      }
      // Show queuebar immediately
      if (this._queuePill && this._changeQueue.length > 0) {
        this._queuePill.style.display = 'flex';
        this._queuePill.style.opacity = '1';
        this._queuePill.style.transform = '';
        // Create queue UI elements if they don't exist yet
        const existingBtn = this._queuePill.querySelector('[data-queue-btn]');
        if (!existingBtn) {
          const btn = document.createElement('div');
          btn.dataset.queueBtn = '';
          btn.style.cssText = 'width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);border:none;display:flex;align-items:center;justify-content:center;color:#D97757;transition:background 150ms ease,transform 0.1s;flex-shrink:0;padding:0;position:relative';
          const count = document.createElement('span');
          count.style.cssText = 'font-size:13px;font-weight:700;font-family:EndowSans,system-ui,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none;line-height:1;color:#D97757';
          count.textContent = String(this._changeQueue.length);
          btn.appendChild(count);
          this._queuePill.appendChild(btn);

          const label = document.createElement('span');
          label.dataset.queueLabel = '';
          label.style.cssText = 'font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;transition:width 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;font-family:EndowSans,system-ui,sans-serif;cursor:pointer';
          label.textContent = this._changeQueue.length === 1 ? 'Queued Task' : 'Queued Tasks';
          this._queuePill.appendChild(label);

          this._queuePill.style.gap = '10px';
          this._queuePill.style.padding = '6px 18px 6px 6px';
          this._queuePill.style.cursor = 'pointer';

          // Wire pill-level click that works without prompt mode
          const qPill = this._queuePill;
          const qLabel = label;
          let collapsed = false;
          qPill.onclick = () => {
            if (!collapsed) {
              collapsed = true;
              const w = qLabel.offsetWidth;
              qLabel.style.width = w + 'px';
              qLabel.offsetHeight;
              qLabel.style.width = '0';
              qLabel.style.opacity = '0';
              qPill.style.gap = '0';
              qPill.style.padding = '6px';
              // Active state on circle
              btn.style.background = '#D97757';
              btn.style.color = '#fff';
              count.style.color = '#fff';
            } else {
              // Toggle active styling
              const isActive = btn.style.background === 'rgb(217, 119, 87)';
              if (isActive) {
                btn.style.background = 'rgba(255,255,255,0.08)';
                btn.style.color = '#D97757';
                count.style.color = '#D97757';
              } else {
                btn.style.background = '#D97757';
                btn.style.color = '#fff';
                count.style.color = '#fff';
              }
            }
            // Create a lightweight prompt mode just for the queue panel (no full overlay)
            if (!this.promptMode) {
              this.promptMode = new PromptMode(this.overlay, this.transport, this.registry);
              (this.promptMode as any)._core = this;
              (this.promptMode as any).setWatchActive(this._watchActive);
            }
            // Sync queue data and refs
            if ((this.promptMode as any)._changeQueue.length === 0 && this._changeQueue.length > 0) {
              (this.promptMode as any)._changeQueue = this._changeQueue;
            }
            (this.promptMode as any)._queueCollapsed = collapsed;
            (this.promptMode as any)._actionPill = qPill;
            (this.promptMode as any)._queueBtn = btn;
            (this.promptMode as any)._queueLabel = qLabel;
            (this.promptMode as any)._queueCount = count;
            (this.promptMode as any)._toggleQueuePanel();
          };
        } else {
          // Update existing count
          const count = existingBtn.querySelector('span');
          if (count) count.textContent = String(this._changeQueue.length);
          const label = this._queuePill.querySelector('[data-queue-label]') as HTMLElement;
          if (label) { label.style.display = ''; label.style.width = ''; label.style.opacity = '1'; }
          this._queuePill.style.gap = '10px';
          this._queuePill.style.padding = '6px 18px 6px 6px';
        }
      }
    }).catch(() => {});
    }, 300);

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
        const next = this.currentMode === 'prompt' ? null : 'prompt' as EndowMode;
        this.toolbar.setActiveMode(next);
        this.switchMode(next);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        const next = this.currentMode === 'manipulate' ? null : 'manipulate' as EndowMode;
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

    // Load Endow fonts
    if (!document.getElementById('endow-font')) {
      const style = document.createElement('style');
      style.id = 'endow-font';
      style.textContent = [
        "@font-face{font-family:EndowSans;src:url('http://localhost:9223/fonts/endowsans-400.woff2') format('woff2');font-weight:400;font-display:swap}",
        "@font-face{font-family:EndowSans;src:url('http://localhost:9223/fonts/endowsans-700.woff2') format('woff2');font-weight:700;font-display:swap}",
        "@font-face{font-family:'EndowSerif';src:url('http://localhost:9223/fonts/endowserif-400.woff2') format('woff2');font-weight:400;font-display:swap}",
        "@font-face{font-family:'EndowSerif';src:url('http://localhost:9223/fonts/endowserif-700.woff2') format('woff2');font-weight:700;font-display:swap}",
        "@font-face{font-family:EndowMono;src:url('http://localhost:9223/fonts/endowmono-400.woff2') format('woff2');font-weight:400;font-display:swap}",
      ].join('');
      document.head.appendChild(style);
    }
    this._startWatchMonitor();
    this.activate();
  }

  activate(): void {
    if (this.active) return;
    this.active = true;
    console.log('[Endow] activate()');

    this.previewEngine = new PreviewEngine();
    this.changeBuffer = new ChangeBuffer();

    this.overlay.mount();

    // Bar tray - flex container for claudebar + queuebar side by side
    if (!this._barTray) {
      this._barTray = document.createElement('div');
      this._barTray.dataset.endow = '';
      this._barTray.style.cssText =
        'position:fixed;bottom:20px;left:20px;display:flex;align-items:center;gap:8px;' +
        'z-index:2147483647;pointer-events:none';
      this.overlay.getContainer().parentNode?.appendChild(this._barTray);
    }

    // Persistent queuebar - lives independently of prompt mode
    if (!this._queuePill) {
      this._queuePill = document.createElement('div');
      this._queuePill.dataset.endow = '';
      this._queuePill.style.cssText =
        'height:44px;display:none;align-items:center;' +
        'background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:22px;' +
        'padding:6px;gap:2px;box-shadow:0 2px 12px rgba(0,0,0,0.4);pointer-events:all;' +
        'transition:padding 0.35s cubic-bezier(0.4,0,0.2,1),gap 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease,transform 0.35s cubic-bezier(0.4,0,0.2,1)';

      // Old Claude button removed - Claudebar replaces it

      this._barTray!.appendChild(this._queuePill);
    }

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
      () => this.toolbar?.getMarkerColor() || '#D97757'
    );
    this._changesPanel.setOnDone((_promptId: string, entry: Record<string, unknown>) => {
      entry.reviewed = true;
      try { fetch('http://localhost:9223/responses',{method:'POST',body:JSON.stringify(this._changeHistory)}).catch(()=>{}); } catch {}
      this._updateClaudeBadge();
    });
    this._changesPanel.setOnUndoDone((_promptId: string, entry: Record<string, unknown>) => {
      entry.reviewed = false;
      try { fetch('http://localhost:9223/responses',{method:'POST',body:JSON.stringify(this._changeHistory)}).catch(()=>{}); } catch {}
      this._updateClaudeBadge();
    });
    this._changesPanel.setOnReply((promptId: string, text: string) => {
      this._claudeState = 'sending';
      this._pendingResponses = 1;
      const promptData = {
        context: 'Reply to ' + promptId + ': ' + text,
        prompt: text,
        elementCount: 0
      };
      this._lastPromptData = promptData;
      this._showClaudeBar('Sending to Claude', 'writing', true);
      this.transport.request('push_prompt', promptData).catch((e: unknown) => {
        console.warn('[Endow] Reply failed:', e);
        this._claudeToRetry();
      });
    });

    this._changesPanel.setOnClearReviewed(() => {
      this._changeHistory = this._changeHistory.filter(e => !e.reviewed);
      try { fetch('http://localhost:9223/responses',{method:'POST',body:JSON.stringify(this._changeHistory)}).catch(()=>{}); } catch {}
      this._updateClaudeBadge();
      const actionable = this._changeHistory.filter(e => !e.reviewed);
      if (actionable.length === 0) {
        this._changesPanel?.hide();
        if (this._claudeState === 'review' || this._claudeState === 'review-active') {
          this._removeClaudeBar(false);
        }
      }
    });

    this._changesPanel.setOnHide(() => {
      // Deactivate Claudebar icon when panel hides
      if (this._claudePill && this._claudeState === 'review-active') {
        const icon = this._claudePill.querySelector('div') as HTMLElement;
        if (icon) { icon.style.background = 'rgba(255,255,255,0.08)'; icon.style.color = '#D97757'; }
        if (this._claudeSpark) this._setSpark(this._claudeSpark, EndowCore._staticSvg, '#D97757');
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
          highlight.dataset.endow = '';
          highlight.style.cssText =
            'position:fixed;pointer-events:none;z-index:2147483646;' +
            'border:2px solid #D97757;border-radius:4px;' +
            'transition:top 60ms ease,left 60ms ease,width 60ms ease,height 60ms ease';

          const label = document.createElement('div');
          label.dataset.endow = '';
          label.style.cssText =
            'position:absolute;top:-22px;left:0;padding:2px 6px;border-radius:3px;' +
            'background:#D97757;color:#fff;font-size:9px;font-weight:600;' +
            'font-family:EndowMono,ui-monospace,monospace;white-space:nowrap;pointer-events:none;' +
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
      this._claudeState = 'sending';
      this._pendingResponses = 1;
      const promptData = {
        context: 'REVERT REQUEST for ' + promptId + ':\n' + revertDetails,
        prompt: 'Revert the changes from ' + promptId + '. Restore these properties to their original values:\n' + revertDetails,
        elementCount: changes.length
      };
      this._lastPromptData = promptData;
      this._showClaudeBar('Sending to Claude', 'writing', true);
      this.transport.request('push_prompt', promptData).catch((e: unknown) => {
        console.warn('[Endow] Revert prompt failed:', e);
        this._claudeToRetry();
      });
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

  switchMode(mode: EndowMode | null): void {
    console.log('[Endow] switchMode:', mode);

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
      (this.promptMode as any).setWatchActive(this._watchActive);
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
    this._updateClaudeBadge();
  }

  private _showScreenGlow(color?: string): void {
    if (!this._screenGlow) {
      this._screenGlow = document.createElement('div');
      this._screenGlow.id = 'endow-screen-glow';
      this._screenGlow.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;opacity:0;transition:opacity 1.2s ease-in-out';
      if (!document.getElementById('endow-glow-style')) {
        const gs = document.createElement('style');
        gs.id = 'endow-glow-style';
        gs.textContent = '@keyframes endow-glow-pulse{0%{filter:brightness(0.7)}50%{filter:brightness(1)}100%{filter:brightness(0.7)}}';
        document.head.appendChild(gs);
      }
    }
    const c = color || '#D97757';
    const _r = parseInt(c.slice(1, 3), 16);
    const _g = parseInt(c.slice(3, 5), 16);
    const _b = parseInt(c.slice(5, 7), 16);
    this._screenGlow.style.boxShadow =
      'rgba(' + _r + ',' + _g + ',' + _b + ',0.65) 0px 0px 15px 0px inset, ' +
      'rgba(' + _r + ',' + _g + ',' + _b + ',0.45) 0px 0px 25px 0px inset, ' +
      'rgba(' + _r + ',' + _g + ',' + _b + ',0.18) 0px 0px 35px 0px inset';
    this._screenGlow.style.animation = 'endow-glow-pulse 3s ease-in-out infinite';
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
    this._toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:10px 20px;z-index:2147483647;pointer-events:none;display:flex;align-items:center;gap:10px;font-family:EndowSans,system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:endow-toast-slide-in 0.3s cubic-bezier(0.23,1,0.32,1) forwards;overflow:hidden';
    const _mColor = this.toolbar ? this.toolbar.getMarkerColor() : '#D97757';
    const _bar = document.createElement('div');
    _bar.style.cssText = 'position:absolute;bottom:0;left:0;height:2px;background:' + _mColor + ';border-radius:0 0 24px 24px;animation:endow-toast-progress 1.5s ease forwards';
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

    if (!document.getElementById('endow-toast-style')) {
      const _ts = document.createElement('style');
      _ts.id = 'endow-toast-style';
      _ts.textContent = '@keyframes endow-toast-slide-in{from{transform:translateY(-100%) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}@keyframes endow-toast-slide-out{from{transform:translateY(0) translateX(-50%);opacity:1}to{transform:translateY(-100%) translateX(-50%);opacity:0}}@keyframes endow-toast-progress{0%{width:0}100%{width:100%}}@keyframes endow-toast-check-draw{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}';
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
      _cp.style.cssText = 'stroke-dasharray:20;animation:endow-toast-check-draw 0.4s ease forwards';
      _svg.appendChild(_cp);
      while (_spin.firstChild) _spin.removeChild(_spin.firstChild);
      _spin.appendChild(_svg);
      _txt.textContent = 'Sent to Claude';
      _txt.style.fontWeight = '700';
      _bar.style.display = 'none';
      setTimeout(() => {
        if (_self._toast) {
          _self._toast.style.animation = 'endow-toast-slide-out 0.3s ease forwards';
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
    this._toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:10px 20px;z-index:2147483647;pointer-events:none;display:flex;align-items:center;gap:10px;font-family:EndowSans,system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:endow-toast-slide-in 0.3s cubic-bezier(0.23,1,0.32,1) forwards;max-width:480px';

    const _mColor = this.toolbar ? this.toolbar.getMarkerColor() : '#D97757';

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
      path.style.cssText = 'stroke-dasharray:20;animation:endow-toast-check-draw 0.4s ease forwards';
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

    if (!document.getElementById('endow-toast-style')) {
      const ts = document.createElement('style');
      ts.id = 'endow-toast-style';
      ts.textContent = '@keyframes endow-toast-slide-in{from{transform:translateY(-100%) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}@keyframes endow-toast-slide-out{from{transform:translateY(0) translateX(-50%);opacity:1}to{transform:translateY(-100%) translateX(-50%);opacity:0}}@keyframes endow-toast-progress{0%{width:0}100%{width:100%}}@keyframes endow-toast-check-draw{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}';
      document.head.appendChild(ts);
    }
    document.body.appendChild(this._toast);

    const dismissDelay = status === 'needsInfo' ? 5000 : 3000;
    const self = this;
    setTimeout(() => {
      if (self._toast) {
        self._toast.style.animation = 'endow-toast-slide-out 0.3s ease forwards';
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

  registerAdapter(adapter: EndowAdapter): void {
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
    const mc = this.toolbar?.getMarkerColor() || '#D97757';
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
        highlight.dataset.endow = '';
        highlight.style.cssText =
          'position:fixed;pointer-events:none;z-index:2147483646;' +
          'border:2px solid ' + mc + ';border-radius:4px;' +
          'box-shadow:0 0 12px ' + mc + '40;' +
          'top:' + rect.top + 'px;left:' + rect.left + 'px;' +
          'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
          'transition:opacity 0.4s ease;opacity:1';

        if (!reducedMotion) {
          highlight.style.animation = 'endow-highlight-pulse 0.6s ease-in-out 2';
        }

        const selectorChanges = changes.filter(c => c.selector === sel);
        if (selectorChanges.length > 0) {
          const pill = document.createElement('div');
          pill.dataset.endow = '';
          pill.style.cssText =
            'position:absolute;top:-24px;left:0;padding:2px 8px;border-radius:4px;' +
            'background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);' +
            'font-size:10px;font-family:EndowMono,ui-monospace,monospace;color:rgba(255,255,255,0.7);' +
            'white-space:nowrap;pointer-events:none';
          pill.textContent = selectorChanges.map(c => c.property + ': ' + c.newValue).join('; ');
          highlight.appendChild(pill);
        }

        document.body.appendChild(highlight);
        setTimeout(() => { highlight.style.opacity = '0'; }, 1200);
        setTimeout(() => { highlight.remove(); }, 1600);
      }
    }

    if (!document.getElementById('endow-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'endow-highlight-style';
      style.textContent = '@keyframes endow-highlight-pulse{0%{box-shadow:0 0 4px ' + mc + '40}50%{box-shadow:0 0 20px ' + mc + '60}100%{box-shadow:0 0 4px ' + mc + '40}}';
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

  // === CLAUDEBAR ===
  private _persistClaudeState(): void {
    try {
      fetch('http://localhost:9223/claude-state', {
        method: 'POST',
        body: JSON.stringify({ state: this._claudeState })
      }).catch(() => {});
    } catch {}
  }

  private _loadClaudeState(): void {
    fetch(`${this.endowBaseUrl}/watch-status`)
      .then(r => r.json())
      .then((watchData: { active: boolean }) => {
        if (!watchData.active) return;
        return fetch(`${this.endowBaseUrl}/claude-state`).then(r => r.json());
      })
      .then((data: any) => {
        if (!data || !data.state || data.state === 'none') return;
        const s = data.state as string;
        if (s === 'sending' || s === 'working' || s === 'retrying') {
          this._claudeState = 'working' as any;
          this._showClaudeBar('Working', 'shimmer', true);
        } else if (s === 'retry') {
          this._claudeState = 'working' as any;
          this._showClaudeBar('Working', 'shimmer', true);
          setTimeout(() => this._claudeToRetry(), 100);
        } else if (s === 'review') {
          this._claudeState = 'sending' as any;
          this._showClaudeBar('Review Changes', 'waiting', false);
          setTimeout(() => this._claudeToReview(), 100);
        }
      })
      .catch(() => {});
  }

  private _startWatchMonitor(): void {
    const poll = () => {
      fetch(`${this.endowBaseUrl}/watch-status`)
        .then(r => r.json())
        .then((data: { active: boolean }) => {
          if (data.active) {
            this._watchMissCount = 0;
            if (!this._watchActive) {
              this._watchActive = true;
              this._onWatchConnected();
            }
          } else {
            this._watchMissCount++;
            if (this._watchActive && this._watchMissCount >= 3) {
              this._watchActive = false;
              this._onWatchDisconnected();
            }
          }
        })
        .catch(() => {
          this._watchMissCount++;
          if (this._watchActive && this._watchMissCount >= 3) {
            this._watchActive = false;
            this._onWatchDisconnected();
          }
        });
    };
    poll();
    this._watchPollInterval = window.setInterval(poll, 5000);
  }

  private _onWatchConnected(): void {
    if (this.promptMode) (this.promptMode as any).setWatchActive(true);
    if (this._claudeState === 'none') {
      this._claudeState = 'connected';
      this._showClaudeBar('Connected', 'thinking', false);
      this._connectedTimeout = window.setTimeout(() => {
        this._connectedTimeout = null;
        if (this._claudeState === 'connected') {
          this._claudeState = 'none';
          this._removeClaudeBar(false);
        }
      }, 3000);
    }
  }

  private _onWatchDisconnected(): void {
    if (this.promptMode) (this.promptMode as any).setWatchActive(false);
    if (this._connectedTimeout !== null) {
      clearTimeout(this._connectedTimeout);
      this._connectedTimeout = null;
    }
    if (this._claudeState === 'connected') {
      this._claudeState = 'none';
      this._removeClaudeBar(false);
    } else if (this._claudeState === 'sending' || this._claudeState === 'working' || this._claudeState === 'retrying') {
      if (this._claudeTimeout !== null) { clearTimeout(this._claudeTimeout); this._claudeTimeout = null; }
      this._claudeState = 'none';
      this._removeClaudeBar(true);
      this._showDisconnectedBar();
    }
  }

  private _showDisconnectedBar(): void {
    this._loadSprites();
    this._removeClaudeBar(true);
    const pill = document.createElement('div');
    pill.dataset.endow = '';
    pill.dataset.claudeBar = '';
    pill.style.cssText =
      'height:44px;display:flex;align-items:center;' +
      'background:#1a1a1a;border:1px solid rgba(217,119,87,0.3);border-radius:22px;' +
      'padding:6px 18px 6px 6px;gap:10px;box-shadow:0 2px 12px rgba(0,0,0,0.4);pointer-events:all;' +
      'opacity:0;transform:translateX(-20px);overflow:visible;cursor:pointer;flex-shrink:0;' +
      'animation:endow-claudebar-glow 2s ease-in-out infinite;' +
      'transition:opacity 0.25s ease,transform 0.35s cubic-bezier(0.4,0,0.2,1)';

    const icon = document.createElement('div');
    icon.style.cssText =
      'width:32px;height:32px;border-radius:50%;background:rgba(217,119,87,0.12);' +
      'display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;color:#D97757';
    icon.insertAdjacentHTML('beforeend', EndowCore._staticSvg);
    const svg = icon.querySelector('svg');
    if (svg) { svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('fill', '#D97757'); }
    pill.appendChild(icon);

    const label = document.createElement('span');
    label.style.cssText =
      'font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;' +
      'font-family:EndowSans,system-ui,sans-serif';
    label.textContent = 'Connection lost';
    pill.appendChild(label);

    const tip = document.createElement('div');
    tip.dataset.endow = '';
    tip.style.cssText =
      'position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(4px);' +
      'background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:8px 12px;' +
      'font-size:11px;font-family:EndowSans,system-ui,sans-serif;color:rgba(255,255,255,0.7);' +
      'white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 150ms ease,transform 150ms ease;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.4)';
    tip.textContent = 'Claude disconnected. Say "watch endow" to reconnect.';
    pill.appendChild(tip);

    pill.addEventListener('mouseenter', () => { tip.style.opacity = '1'; tip.style.transform = 'translateX(-50%) translateY(0)'; });
    pill.addEventListener('mouseleave', () => { tip.style.opacity = '0'; tip.style.transform = 'translateX(-50%) translateY(4px)'; });

    if (this._barTray) this._barTray.insertBefore(pill, this._barTray.firstChild);
    this._claudePill = pill;
    this._claudeSpark = null;
    this._claudeLabel = label;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => { pill.style.opacity = '1'; pill.style.transform = 'translateX(0)'; });
    });
  }

  private _loadSprites(): void {
    if (this._spritesLoaded) return;
    this._spritesLoaded = true;
    ['writing', 'shimmer', 'waiting', 'thinking'].forEach(name => {
      fetch(`${this.endowBaseUrl}/spark-${name}.svg`).then(r => r.text()).then(t => { this._spriteSvgs[name] = t; }).catch(() => {});
    });
  }

  private _setSpark(container: HTMLDivElement, svgText: string, fill: string): void {
    container.textContent = '';
    container.insertAdjacentHTML('beforeend', svgText);
    const svg = container.querySelector('svg');
    if (svg) svg.setAttribute('fill', fill);
  }

  private _animateSpark(container: HTMLDivElement, spriteName: string): Animation | null {
    const svgText = this._spriteSvgs[spriteName];
    const cfg = EndowCore._spriteConfigs[spriteName];
    if (!svgText || !cfg) return null;
    this._setSpark(container, svgText, '#D97757');
    const svg = container.querySelector('svg');
    if (!svg) return null;
    (svg as SVGElement).style.width = '18px';
    (svg as SVGElement).style.height = (cfg.frameCount * 18) + 'px';
    (svg as SVGElement).style.display = 'block';
    let frames: Keyframe[], dur: number;
    if (spriteName === 'waiting') {
      frames = EndowCore._waitingFrameIndices.map(i => ({ transform: `translateY(-${i * (100 / cfg.frameCount)}%)` }));
      dur = 80 * frames.length;
    } else {
      frames = Array.from({length: cfg.frameCount}, (_, i) => ({ transform: `translateY(-${i * (100 / cfg.frameCount)}%)` }));
      dur = cfg.speed * frames.length;
    }
    return svg.animate(frames, { duration: dur, iterations: Infinity, easing: `steps(${frames.length}, jump-none)` });
  }

  _showClaudeBar(text: string, sprite: string, hasDots: boolean): void {
    this._loadSprites();
    this._removeClaudeBar(true);

    const pill = document.createElement('div');
    pill.dataset.endow = '';
    pill.dataset.claudeBar = '';
    pill.style.cssText =
      'height:44px;display:flex;align-items:center;' +
      'background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:22px;' +
      'padding:6px 18px 6px 6px;gap:10px;box-shadow:0 2px 12px rgba(0,0,0,0.4);pointer-events:all;' +
      'transition:padding 0.35s cubic-bezier(0.4,0,0.2,1),gap 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease,transform 0.35s cubic-bezier(0.4,0,0.2,1);' +
      'opacity:0;transform:translateX(-20px);overflow:visible;cursor:default;flex-shrink:0';

    const icon = document.createElement('div');
    icon.style.cssText =
      'width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);' +
      'display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;color:#D97757;' +
      'transition:background 0.15s,transform 0.1s';
    const spark = document.createElement('div');
    spark.style.cssText = 'width:18px;height:18px;overflow:hidden';
    spark.querySelector?.('svg')?.setAttribute('fill', 'currentColor');
    icon.appendChild(spark);
    pill.appendChild(icon);

    const label = document.createElement('span');
    label.style.cssText =
      'font-size:14px;font-weight:500;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;' +
      'transition:width 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;font-family:EndowSans,system-ui,sans-serif';
    label.textContent = text;
    if (hasDots) {
      const dots = document.createElement('span');
      dots.style.cssText = 'display:inline-block;width:1.2em;text-align:left;vertical-align:baseline';
      const style = document.createElement('style');
      style.textContent = '@keyframes endow-ellipsis{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}';
      dots.appendChild(style);
      const after = document.createElement('span');
      after.style.cssText = 'display:inline';
      after.setAttribute('data-dots', '');
      dots.appendChild(after);
      // Use a simple interval for dots since pseudo-element content animation needs real CSS
      let dotState = 0;
      const dotFrames = ['', '.', '..', '...'];
      const dotInterval = setInterval(() => { dotState = (dotState + 1) % 4; after.textContent = dotFrames[dotState]; }, 375);
      (pill as any)._dotInterval = dotInterval;
      label.appendChild(dots);
    }
    pill.appendChild(label);

    // Insert into tray BEFORE the queuebar so Claudebar is on the left
    if (this._barTray) {
      this._barTray.insertBefore(pill, this._barTray.firstChild);
    }
    this._claudePill = pill;
    this._claudeSpark = spark;
    this._claudeLabel = label;
    if (this._claudeState !== 'connected') this._persistClaudeState();

    // Start sprite after a tick to let SVG load
    setTimeout(() => {
      if (this._claudeSpark && this._spriteSvgs[sprite]) {
        this._claudeAnim = this._animateSpark(this._claudeSpark, sprite);
      }
    }, 50);

    // Slide-fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pill.style.opacity = '1';
        pill.style.transform = 'translateX(0)';
      });
    });

    // Start 60s timeout for retry (skip for transient 'connected' state)
    if (this._claudeState !== 'connected') {
      if (this._claudeTimeout !== null) { clearTimeout(this._claudeTimeout); this._claudeTimeout = null; }
      this._claudeTimeout = window.setTimeout(() => {
        this._claudeTimeout = null;
        if (this._claudeState === 'sending' || this._claudeState === 'working' || this._claudeState === 'retrying') {
          this._claudeToRetry();
        }
      }, 60000);
    }
  }

  _claudeToRetry(): void {
    if (!this._claudePill || !this._claudeSpark || !this._claudeLabel) return;
    this._claudeState = 'retry';
    this._persistClaudeState();

    // Clear dots interval
    if ((this._claudePill as any)._dotInterval) { clearInterval((this._claudePill as any)._dotInterval); (this._claudePill as any)._dotInterval = null; }

    // Cancel sprite animation
    if (this._claudeAnim) { this._claudeAnim.cancel(); this._claudeAnim = null; }

    // Swap icon to Lucide redo SVG
    this._claudeSpark.textContent = '';
    this._claudeSpark.style.overflow = 'visible';
    const redoSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    redoSvg.setAttribute('width', '18');
    redoSvg.setAttribute('height', '18');
    redoSvg.setAttribute('viewBox', '0 0 24 24');
    redoSvg.setAttribute('fill', 'none');
    redoSvg.setAttribute('stroke', 'currentColor');
    redoSvg.setAttribute('stroke-width', '2');
    redoSvg.setAttribute('stroke-linecap', 'round');
    redoSvg.setAttribute('stroke-linejoin', 'round');
    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p1.setAttribute('d', 'M21 7v6h-6');
    redoSvg.appendChild(p1);
    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute('d', 'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7');
    redoSvg.appendChild(p2);
    this._claudeSpark.appendChild(redoSvg);

    // Set label
    this._claudeLabel.textContent = 'Retry Send';

    // Add pulsing orange border glow
    this._claudePill.style.animation = 'endow-claudebar-glow 3s ease-in-out infinite';
    if (!document.getElementById('endow-claudebar-glow-style')) {
      const s = document.createElement('style');
      s.id = 'endow-claudebar-glow-style';
      s.textContent = '@keyframes endow-claudebar-glow{0%,100%{border-color:rgba(255,255,255,0.1);box-shadow:0 2px 12px rgba(0,0,0,0.4)}50%{border-color:rgba(217,119,87,0.25);box-shadow:0 2px 12px rgba(0,0,0,0.4),0 0 12px rgba(217,119,87,0.06)}}';
      document.head.appendChild(s);
    }

    // Make clickable
    this._claudePill.style.cursor = 'pointer';
    this._claudePill.onclick = () => this._retryClaudeBarClick();
  }

  private _retryClaudeBarClick(): void {
    if (!this._claudePill || !this._claudeSpark || !this._claudeLabel || !this._lastPromptData) return;

    // Transition to "Retrying..." state
    this._claudeState = 'retrying';
    this._persistClaudeState();
    this._claudePill.style.animation = 'none';
    this._claudePill.style.cursor = 'default';

    // Clear dots interval if any
    if ((this._claudePill as any)._dotInterval) { clearInterval((this._claudePill as any)._dotInterval); }

    // Restore orbiting sprite
    this._claudeSpark.style.overflow = 'hidden';
    if (this._spriteSvgs.shimmer) {
      this._claudeAnim = this._animateSpark(this._claudeSpark, 'shimmer');
    }

    // Set label with animated dots
    this._claudeLabel.textContent = 'Retrying';
    const dots = document.createElement('span');
    dots.style.cssText = 'display:inline-block;width:1.2em;text-align:left;vertical-align:baseline';
    const after = document.createElement('span');
    dots.appendChild(after);
    let dotState = 0;
    const dotFrames = ['', '.', '..', '...'];
    const dotInterval = setInterval(() => { dotState = (dotState + 1) % 4; after.textContent = dotFrames[dotState]; }, 375);
    (this._claudePill as any)._dotInterval = dotInterval;
    this._claudeLabel.appendChild(dots);

    // Re-send the stored prompt
    this.transport.request('push_prompt', this._lastPromptData)
      .catch((e: unknown) => { console.warn('[Endow] Retry failed:', e); });

    // Start a new 60s timeout
    if (this._claudeTimeout !== null) { clearTimeout(this._claudeTimeout); }
    this._claudeTimeout = window.setTimeout(() => {
      this._claudeTimeout = null;
      if (this._claudeState === 'retrying') {
        this._claudeToRetry();
      }
    }, 60000);
  }

  _claudeToWorking(): void {
    if (!this._claudePill || !this._claudeSpark || !this._claudeLabel) return;
    this._claudeState = 'working';
    this._persistClaudeState();
    // Clear timeout - we got a response progression
    if (this._claudeTimeout !== null) { clearTimeout(this._claudeTimeout); this._claudeTimeout = null; }
    if (this._claudeAnim) { this._claudeAnim.cancel(); this._claudeAnim = null; }
    if (this._spriteSvgs.shimmer) {
      this._claudeAnim = this._animateSpark(this._claudeSpark, 'shimmer');
    }
    this._claudeLabel.textContent = 'Working';
    const dots = document.createElement('span');
    dots.style.cssText = 'display:inline-block;width:1.2em;text-align:left;vertical-align:baseline';
    const after = document.createElement('span');
    dots.appendChild(after);
    let dotState = 0;
    const dotFrames = ['', '.', '..', '...'];
    const dotInterval = setInterval(() => { dotState = (dotState + 1) % 4; after.textContent = dotFrames[dotState]; }, 375);
    if ((this._claudePill as any)._dotInterval) clearInterval((this._claudePill as any)._dotInterval);
    (this._claudePill as any)._dotInterval = dotInterval;
    this._claudeLabel.appendChild(dots);
  }

  _claudeToReview(): void {
    if (!this._claudePill || !this._claudeSpark || !this._claudeLabel) return;
    const actionable = this._changeHistory.filter(e => !e.reviewed);
    if (actionable.length === 0) { this._removeClaudeBar(false); return; }
    this._claudeState = 'review';
    this._persistClaudeState();
    // Clear timeout - Claude responded
    if (this._claudeTimeout !== null) { clearTimeout(this._claudeTimeout); this._claudeTimeout = null; }
    if ((this._claudePill as any)._dotInterval) { clearInterval((this._claudePill as any)._dotInterval); }
    if (this._claudeAnim) { this._claudeAnim.cancel(); this._claudeAnim = null; }
    if (this._spriteSvgs.waiting) {
      this._claudeAnim = this._animateSpark(this._claudeSpark, 'waiting');
    }
    this._claudePill.style.animation = 'endow-claudebar-glow 3s ease-in-out infinite';
    this._claudePill.style.opacity = '1';
    if (!document.getElementById('endow-claudebar-glow-style')) {
      const s = document.createElement('style');
      s.id = 'endow-claudebar-glow-style';
      s.textContent = '@keyframes endow-claudebar-glow{0%,100%{border-color:rgba(255,255,255,0.1);box-shadow:0 2px 12px rgba(0,0,0,0.4)}50%{border-color:rgba(217,119,87,0.25);box-shadow:0 2px 12px rgba(0,0,0,0.4),0 0 12px rgba(217,119,87,0.06)}}';
      document.head.appendChild(s);
    }
    this._claudeLabel.textContent = 'Review Changes';
    this._claudePill.style.cursor = 'pointer';
    this._claudePill.onclick = () => this._claudeBarClick();
  }

  private _claudeBarClick(): void {
    if (!this._claudePill || !this._claudeSpark || !this._claudeLabel) return;

    // Close queue panel if open
    if (this.promptMode && (this.promptMode as any)._queuePanel) {
      (this.promptMode as any)._toggleQueuePanel();
    }

    if (this._claudeState === 'review') {
      // Collapse to icon-only, open changes panel
      this._claudeState = 'review-active';
      this._claudePill.style.animation = 'none';
      const icon = this._claudePill.querySelector('div') as HTMLElement;
      if (icon) { icon.style.background = '#D97757'; icon.style.color = '#fff'; }
      if (this._claudeAnim) { this._claudeAnim.cancel(); this._claudeAnim = null; }
      this._setSpark(this._claudeSpark, EndowCore._staticSvg, '#fff');

      const labelW = this._claudeLabel.offsetWidth;
      this._claudeLabel.style.width = labelW + 'px';
      this._claudeLabel.offsetHeight;
      this._claudeLabel.style.width = '0';
      this._claudeLabel.style.opacity = '0';
      this._claudePill.style.gap = '0';
      this._claudePill.style.padding = '6px';

      // Open changes panel
      const actionable = this._changeHistory.filter(e => !e.reviewed);
      if (actionable.length > 0) {
        this._changesPanel?.toggle(this._changeHistory as any);
      } else {
        this._removeClaudeBar(false);
      }
    } else if (this._claudeState === 'review-active') {
      // Toggle panel
      const icon = this._claudePill.querySelector('div') as HTMLElement;
      const isOpen = this._changesPanel?.isVisible();
      if (isOpen) {
        this._changesPanel?.hide();
        if (icon) { icon.style.background = 'rgba(255,255,255,0.08)'; icon.style.color = '#D97757'; }
        this._setSpark(this._claudeSpark, EndowCore._staticSvg, '#D97757');
      } else {
        const actionable = this._changeHistory.filter(e => !e.reviewed);
        if (actionable.length > 0) {
          this._changesPanel?.toggle(this._changeHistory as any);
          if (icon) { icon.style.background = '#D97757'; icon.style.color = '#fff'; }
          this._setSpark(this._claudeSpark, EndowCore._staticSvg, '#fff');
        } else {
          this._removeClaudeBar(false);
        }
      }
    }
  }

  _removeClaudeBar(instant: boolean): void {
    if (!this._claudePill) return;
    if ((this._claudePill as any)._dotInterval) clearInterval((this._claudePill as any)._dotInterval);
    // Clear timeout on removal
    if (this._claudeTimeout !== null) { clearTimeout(this._claudeTimeout); this._claudeTimeout = null; }
    this._claudePill.onclick = null;
    if (instant) {
      this._claudePill.remove();
    } else {
      const p = this._claudePill;
      p.style.opacity = '0';
      p.style.transform = 'scale(0.9)';
      setTimeout(() => p.remove(), 260);
    }
    this._claudePill = null;
    this._claudeSpark = null;
    this._claudeLabel = null;
    this._claudeAnim = null;
    this._claudeState = 'none';
    this._persistClaudeState();
  }

  private _updateClaudeBadge(): void {
    if (this._queuePill) {
      const queueCount = this._changeQueue?.length || 0;
      const hasQueueUI = !!this._queuePill.querySelector('[data-queue-btn]');
      const hasContent = hasQueueUI || this._queuePill.childElementCount > 0;
      if (queueCount > 0 && hasContent) {
        const wasHidden = this._queuePill.style.display === 'none';
        this._queuePill.style.display = 'flex';
        if (wasHidden) {
          this._queuePill.style.opacity = '0';
          this._queuePill.style.transform = 'translateX(-20px)';
          this._queuePill.style.transition = 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)';
          const pill = this._queuePill;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              pill.style.opacity = '1';
              pill.style.transform = 'translateX(0)';
            });
          });
        } else {
          this._queuePill.style.opacity = '1';
          this._queuePill.style.transform = '';
        }
      } else {
        this._queuePill.style.display = 'none';
      }
    }
  }

  _buildQueueRow(idx: number, item: QueueItem, isLast: boolean): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'padding:10px 12px;border-radius:10px;' + (isLast ? '' : 'margin-bottom:6px;') + 'background:rgba(255,255,255,0.02);transition:background 80ms ease;cursor:pointer';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:flex-start;gap:8px';

    const numCircle = document.createElement('div');
    numCircle.style.cssText = 'width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#D97757';
    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-size:10px;font-weight:700;color:#1a1a1a;font-variant-numeric:tabular-nums;font-family:EndowSans,system-ui,sans-serif';
    numSpan.textContent = String(idx + 1);
    numCircle.appendChild(numSpan);
    topRow.appendChild(numCircle);

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;min-width:0';

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);line-height:1.4';
    summary.textContent = item.prompt;
    body.appendChild(summary);

    const target = document.createElement('div');
    target.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.35);margin-top:3px;font-family:EndowSans,system-ui,sans-serif';
    if (item.elements.length === 1) {
      const el = item.elements[0];
      const lastSeg = (el.selector || '').split(/\s+/).pop() || '';
      const tag = (el.tagName || '').toLowerCase();
      target.textContent = lastSeg.startsWith(tag) ? lastSeg : (tag + ' ' + lastSeg).trim();
    } else if (item.elements.length === 0) {
      target.textContent = 'no element';
    } else {
      target.textContent = item.elements.length + ' elements';
    }
    body.appendChild(target);

    topRow.appendChild(body);

    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display:flex;gap:4px;flex-shrink:0;opacity:0;transition:opacity 100ms ease';

    const editBtn = document.createElement('button');
    editBtn.style.cssText = 'width:24px;height:24px;border:none;background:transparent;color:rgba(255,255,255,0.4);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 100ms ease,color 100ms ease;padding:0';
    editBtn.title = 'Edit';
    const eSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    eSvg.setAttribute('width', '14'); eSvg.setAttribute('height', '14'); eSvg.setAttribute('viewBox', '0 0 24 24');
    eSvg.setAttribute('fill', 'none'); eSvg.setAttribute('stroke', 'currentColor'); eSvg.setAttribute('stroke-width', '2');
    eSvg.setAttribute('stroke-linecap', 'round'); eSvg.setAttribute('stroke-linejoin', 'round');
    const ep = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ep.setAttribute('d', 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z');
    eSvg.appendChild(ep);
    editBtn.appendChild(eSvg);
    editBtn.addEventListener('mouseenter', function () { editBtn.style.background = 'rgba(255,255,255,0.08)'; editBtn.style.color = 'rgba(255,255,255,0.85)'; });
    editBtn.addEventListener('mouseleave', function () { editBtn.style.background = 'transparent'; editBtn.style.color = 'rgba(255,255,255,0.4)'; });
    editBtn.addEventListener('click', () => { this.promptMode?._editQueueItem(idx); });
    actionsDiv.appendChild(editBtn);

    const rmBtn = document.createElement('button');
    rmBtn.style.cssText = 'width:24px;height:24px;border:none;background:transparent;color:rgba(255,255,255,0.4);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 100ms ease,color 100ms ease;padding:0';
    rmBtn.title = 'Remove';
    const dSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dSvg.setAttribute('width', '14'); dSvg.setAttribute('height', '14'); dSvg.setAttribute('viewBox', '0 0 24 24');
    dSvg.setAttribute('fill', 'none'); dSvg.setAttribute('stroke', 'currentColor'); dSvg.setAttribute('stroke-width', '2');
    dSvg.setAttribute('stroke-linecap', 'round'); dSvg.setAttribute('stroke-linejoin', 'round');
    const d1 = document.createElementNS('http://www.w3.org/2000/svg', 'path'); d1.setAttribute('d', 'M3 6h18'); dSvg.appendChild(d1);
    const d2 = document.createElementNS('http://www.w3.org/2000/svg', 'path'); d2.setAttribute('d', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'); dSvg.appendChild(d2);
    const d3 = document.createElementNS('http://www.w3.org/2000/svg', 'path'); d3.setAttribute('d', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'); dSvg.appendChild(d3);
    const d4 = document.createElementNS('http://www.w3.org/2000/svg', 'line'); d4.setAttribute('x1', '10'); d4.setAttribute('y1', '11'); d4.setAttribute('x2', '10'); d4.setAttribute('y2', '17'); dSvg.appendChild(d4);
    const d5 = document.createElementNS('http://www.w3.org/2000/svg', 'line'); d5.setAttribute('x1', '14'); d5.setAttribute('y1', '11'); d5.setAttribute('x2', '14'); d5.setAttribute('y2', '17'); dSvg.appendChild(d5);
    rmBtn.appendChild(dSvg);
    rmBtn.addEventListener('mouseenter', function () { rmBtn.style.background = 'rgba(239,68,68,0.15)'; rmBtn.style.color = '#ef4444'; });
    rmBtn.addEventListener('mouseleave', function () { rmBtn.style.background = 'transparent'; rmBtn.style.color = 'rgba(255,255,255,0.4)'; });
    rmBtn.addEventListener('click', () => { this.promptMode?._confirmRemoveItem(idx); });
    actionsDiv.appendChild(rmBtn);

    topRow.appendChild(actionsDiv);
    row.appendChild(topRow);

    row.addEventListener('mouseenter', function () { row.style.background = 'rgba(255,255,255,0.06)'; actionsDiv.style.opacity = '1'; });
    row.addEventListener('mouseleave', function () { row.style.background = 'rgba(255,255,255,0.02)'; actionsDiv.style.opacity = '0'; });
    row.addEventListener('click', (e: Event) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.promptMode?._editQueueItem(idx);
    });

    return row;
  }

  _appendQueueRowAnimated(idx: number, item: QueueItem, listEl: HTMLElement, hdrText: HTMLElement | null, queueLength?: number) {
    if (!listEl) return;
    const DUR = 320;
    const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
    const actualQueueLength = queueLength !== undefined ? queueLength : this._changeQueue.length;

    const rows = listEl.children;
    if (rows.length > 0) {
      const prevLast = rows[rows.length - 1] as HTMLElement;
      try {
        prevLast.animate(
          [{ marginBottom: '0px' }, { marginBottom: '6px' }],
          { duration: DUR, easing: EASE, fill: 'forwards' }
        );
      } catch (e) {
        prevLast.style.marginBottom = '6px';
      }
    }

    const row = this._buildQueueRow(idx, item, true);
    listEl.appendChild(row);
    const naturalHeight = row.scrollHeight;

    row.style.maxHeight = '0px';
    row.style.opacity = '0';
    row.style.transform = 'translateY(10px)';
    row.style.paddingTop = '0';
    row.style.paddingBottom = '0';
    row.style.overflow = 'hidden';

    let anim: Animation | null = null;
    try {
      anim = row.animate(
        [
          { maxHeight: '0px', opacity: 0, transform: 'translateY(10px)', paddingTop: '0px', paddingBottom: '0px' },
          { maxHeight: naturalHeight + 'px', opacity: 1, transform: 'translateY(0)', paddingTop: '10px', paddingBottom: '10px' },
        ],
        { duration: DUR, easing: EASE, fill: 'forwards' }
      );
    } catch (e) {
      row.style.maxHeight = '';
      row.style.opacity = '';
      row.style.transform = '';
      row.style.paddingTop = '';
      row.style.paddingBottom = '';
      row.style.overflow = '';
    }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      row.style.maxHeight = '';
      row.style.overflow = '';
      row.style.opacity = '1';
      row.style.transform = 'translateY(0)';
      row.style.paddingTop = '10px';
      row.style.paddingBottom = '10px';
      if (anim) {
        try { anim.cancel(); } catch (e) {}
      }
      listEl.scrollTop = listEl.scrollHeight;
    };

    if (anim) {
      anim.addEventListener('finish', settle);
    }

    setTimeout(settle, DUR + 30);

    try {
      listEl.scrollTo({ top: listEl.scrollHeight + naturalHeight + 12, behavior: 'smooth' });
    } catch (e) {
      listEl.scrollTop = listEl.scrollHeight + naturalHeight + 12;
    }

    if (hdrText) {
      hdrText.textContent = 'Queued ' + (actualQueueLength === 1 ? 'Task' : 'Tasks') + ' (' + actualQueueLength + ')';
    }
  }
}

const LOG_PREFIX = '[Endow]';
const log = {
  info: (...args: unknown[]) => console.log(LOG_PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(LOG_PREFIX, ...args),
  error: (...args: unknown[]) => console.error(LOG_PREFIX, ...args),
};

let endow: EndowCore;
try {
  log.info('Initializing...');
  endow = new EndowCore();
  window.__endow = endow;
  endow.init().then(() => {
    log.info('Ready. Transport:', endow.getTransport().isConnected() ? 'connected' : 'disconnected');
  }).catch((err) => {
    log.warn('Init completed with error (non-fatal):', err?.message ?? err);
  });
  log.info('Core created, init started.');
} catch (err) {
  log.error('Fatal error during initialization:', err);
  throw err;
}

export default endow;
