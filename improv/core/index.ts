import { Transport } from './transport';
import { Overlay } from './overlay';
import { Toolbar } from './toolbar';
import { AdapterRegistry } from './adapter-registry';
import { PreviewEngine } from './preview-engine';
import { ChangeBuffer } from './change-buffer';
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
      // Cmd+Shift+. toggles overlay on/off
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '.') {
        e.preventDefault();
        if (this.active) {
          this.deactivate();
        } else {
          this.activate();
        }
        return;
      }
      // Escape exits current mode (back to toolbar), or deactivates if no mode
      if (e.key === 'Escape' && this.active) {
        e.preventDefault();
        if (this.currentMode) {
          this.switchMode(null);
          this.toolbar?.setActiveMode(null);
        } else {
          this.deactivate();
        }
      }
    });

    try {
      await this.transport.connect();
    } catch {
      // Connection failure is non-fatal; reconnect will be attempted automatically
    }
  }

  activate(): void {
    if (this.active) return;
    this.active = true;

    this.previewEngine = new PreviewEngine();
    this.changeBuffer = new ChangeBuffer();

    this.overlay.mount();

    this.toolbar = new Toolbar(this.overlay.getShadowRoot());
    this.toolbar.setConnected(this.transport.isConnected());
    this.toolbar.onMode((mode) => this.switchMode(mode));

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
      this.promptMode.activate();
    } else if (mode === 'annotate-layout') {
      this.annotateMode = new AnnotateMode(this.overlay, this.transport, this.registry);
      this.annotateMode.activate();
    }

    this.toolbar?.setBadge(this.changeBuffer?.count() ?? 0);
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
