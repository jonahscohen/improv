import { Transport } from './transport';
import { Overlay } from './overlay';
import { Toolbar } from './toolbar';
import { AdapterRegistry } from './adapter-registry';
import { PreviewEngine } from './preview-engine';
import { ChangeBuffer } from './change-buffer';
import { ApplyConfirmation } from './apply-confirmation';
import { ManipulateMode } from './manipulate/index.js';
import { PromptMode } from './prompt/index.js';
import { AnnotateMode } from './annotate/index.js';
import { LayoutMode } from './layout/index.js';
import type { ImprovAdapter, ImprovMode } from './types';

declare global {
  interface Window {
    __improv: ImprovCore;
  }
}

export class ImprovCore {
  private transport: Transport;
  private overlay: Overlay;
  private registry: AdapterRegistry;
  private toolbar: Toolbar | null = null;
  private active = false;
  private currentMode: ImprovMode | null = null;

  private previewEngine: PreviewEngine | null = null;
  private changeBuffer: ChangeBuffer | null = null;
  private manipulateMode: ManipulateMode | null = null;
  private promptMode: PromptMode | null = null;
  private annotateMode: AnnotateMode | null = null;
  private layoutMode: LayoutMode | null = null;
  private applyConfirmation: ApplyConfirmation | null = null;

  constructor() {
    this.transport = new Transport();
    this.overlay = new Overlay();
    this.registry = new AdapterRegistry();
  }

  async init(): Promise<void> {
    // Register server-push handlers
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

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Cmd+Shift+. toggles toolbar visibility (connection stays alive)
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
          this.toolbar.setBadge(this.changeBuffer?.count() ?? 0);
        }
        return;
      }
      // Escape exits current mode (back to toolbar with no active mode)
      if (e.key === 'Escape' && this.active) {
        e.preventDefault();
        if (this.currentMode) {
          this.switchMode(null);
          this.toolbar?.setActiveMode(null);
        }
      }
    });

    try {
      await this.transport.connect();
    } catch {
      // Connection failure is non-fatal; reconnect will be attempted automatically
    }

    // Auto-activate on load - toolbar appears immediately on every page
    this.activate();
  }

  activate(): void {
    if (this.active) return;
    this.active = true;

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

    // Keep connected status in sync
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
    // Deactivate whichever controller is currently active
    this.manipulateMode?.deactivate();
    this.manipulateMode = null;
    this.promptMode?.deactivate();
    this.promptMode = null;
    this.annotateMode?.deactivate();
    this.annotateMode = null;
    this.layoutMode?.deactivate();
    this.layoutMode = null;

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
      this.promptMode.onPromptSent((text, count) => {
        this.applyConfirmation?.showSuccess([{
          label: text.length > 60 ? text.slice(0, 57) + '...' : text,
          detail: `${count} element${count === 1 ? '' : 's'} selected`,
        }]);
      });
      this.promptMode.activate();
    } else if (mode === 'annotate') {
      this.annotateMode = new AnnotateMode(this.overlay, this.transport, this.registry);
      this.annotateMode.onAnnotationChange(() => {
        this.toolbar?.setBadge(this.getTotalPendingCount());
      });
      this.annotateMode.activate();
    } else if (mode === 'layout') {
      this.layoutMode = new LayoutMode(this.overlay, this.transport);
      this.layoutMode.activate();
    }

    this.toolbar?.setBadge(this.getTotalPendingCount());
    this.toolbar?.showSendButton(mode === 'annotate' || mode === 'prompt');
  }

  private getTotalPendingCount(): number {
    let count = this.changeBuffer?.count() ?? 0;
    if (this.annotateMode) {
      count += this.annotateMode.getStore().pendingCount();
    }
    return count;
  }

  private async applyChanges(): Promise<void> {
    if (!this.changeBuffer || this.changeBuffer.count() === 0) return;
    const changes = this.changeBuffer.flush();

    this.applyConfirmation?.showSending('Sending to Claude...');

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
      this.applyConfirmation?.showSuccess(items);
    } catch (err) {
      // Restore changes to the buffer on failure
      for (const c of changes) {
        this.changeBuffer?.add(c.selector, c.property, c.oldValue, c.newValue);
      }
      const message = err instanceof Error ? err.message : 'Connection error';
      this.applyConfirmation?.showError(message, () => this.applyChanges());
    }
  }

  private async sendAnnotations(): Promise<void> {
    if (!this.annotateMode) return;
    const store = this.annotateMode.getStore();
    const pending = store.getPending();
    if (pending.length === 0) return;

    this.applyConfirmation?.showSending('Sending annotations to Claude...');

    try {
      await this.transport.request('push_annotations', {
        annotations: pending,
      });

      const items = pending.map((a) => ({
        label: a.comment.length > 60 ? `${a.comment.slice(0, 57)}...` : a.comment,
        detail: a.elementSelector !== 'text-selection' ? a.elementSelector : 'Text selection',
      }));

      const successItems = items.length > 0
        ? items
        : [{ label: `${pending.length} annotation${pending.length === 1 ? '' : 's'} sent` }];

      this.applyConfirmation?.showSuccess(successItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection error';
      this.applyConfirmation?.showError(message, () => this.sendAnnotations());
    }
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

  isActive(): boolean {
    return this.active;
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
}

const improv = new ImprovCore();
window.__improv = improv;
improv.init().catch(() => {
  // Silent fail - transport will retry
});

export default improv;
