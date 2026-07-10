export class Overlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private highlight: HTMLDivElement | null = null;
  private trackedElement: HTMLElement | null = null;
  private rafId: number | null = null;
  private _hlColor: string | undefined;
  // Dotted outlines on the hovered element's direct children (the manipulate
  // picker's hover detail, opted into by prompt mode via setChildOutlines).
  private childOutlinesEnabled = false;
  private childOutlinePool: HTMLDivElement[] = [];
  private childList: Element[] = [];

  constructor() {
    this.host = document.createElement('div');
    this.host.dataset['justify'] = '';
    this.host.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';

    this.shadow = this.host.attachShadow({ mode: 'open' });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      :host{all:initial;}
      .justify-container{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;overflow:visible;z-index:2147483647;}
    `);
    this.shadow.adoptedStyleSheets = [sheet];

    this.container = document.createElement('div');
    this.container.className = 'justify-container';
    this.shadow.appendChild(this.container);
  }

  mount(): void {
    if (!document.body.contains(this.host)) {
      document.body.appendChild(this.host);
    }
  }

  unmount(): void {
    this.stopTracking();
    this.host.remove();
  }

  isVisible(): boolean {
    return document.body.contains(this.host);
  }

  getShadowRoot(): ShadowRoot {
    return this.shadow;
  }

  getContainer(): HTMLDivElement {
    return this.container;
  }

  showHighlight(rect: DOMRect): void {
    this.trackedElement = null;
    this.stopTracking();
    this.hideChildOutlines();
    this.positionHighlight(rect);
  }

  trackElement(el: HTMLElement): void {
    this.trackedElement = el;
    this.positionHighlight(el.getBoundingClientRect());
    this.rebuildChildList(el);
    this.updateChildOutlines();
    this.startTracking();
  }

  // The eligible-children LIST is computed once per hover target (getComputedStyle
  // per child is too heavy for the rAF tick); only the rects refresh per frame.
  private rebuildChildList(el: HTMLElement): void {
    this.childList = [];
    if (!this.childOutlinesEnabled) return;
    for (const c of Array.from(el.children)) {
      if (c.hasAttribute('data-justify') || c.hasAttribute('data-justify-host')) continue;
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      this.childList.push(c);
    }
  }

  private updateChildOutlines(): void {
    let poolIdx = 0;
    if (this.childOutlinesEnabled && this.trackedElement) {
      for (const child of this.childList) {
        if (poolIdx >= 20) break;
        const r = child.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        let outline = this.childOutlinePool[poolIdx];
        if (!outline) {
          outline = document.createElement('div');
          outline.style.cssText =
            'position:fixed;display:none;pointer-events:none;border:1px dotted ' + (this._hlColor || '#D97757') + ';background:none;';
          this.container.appendChild(outline);
          this.childOutlinePool.push(outline);
        }
        outline.style.top = `${r.top}px`;
        outline.style.left = `${r.left}px`;
        outline.style.width = `${r.width}px`;
        outline.style.height = `${r.height}px`;
        outline.style.display = 'block';
        poolIdx++;
      }
    }
    for (let i = poolIdx; i < this.childOutlinePool.length; i++) {
      this.childOutlinePool[i].style.display = 'none';
    }
  }

  private hideChildOutlines(): void {
    this.childList = [];
    for (const outline of this.childOutlinePool) {
      outline.style.display = 'none';
    }
  }

  setChildOutlines(enabled: boolean): void {
    this.childOutlinesEnabled = enabled;
    if (!enabled) this.hideChildOutlines();
  }

  private positionHighlight(rect: DOMRect): void {
    if (!this.highlight) {
      this.highlight = document.createElement('div');
      // The highlight is created lazily on first hover, AFTER setHighlightColor
      // has usually run (mode entry seeds it from the persisted marker) - so the
      // stored color must win over the default here, not just in later updates.
      this.highlight.style.cssText =
        'position:fixed;pointer-events:none;border:1px solid ' + (this._hlColor || '#D97757') + ';border-radius:0;transition:top 60ms ease,left 60ms ease,width 60ms ease,height 60ms ease;';
      this.container.appendChild(this.highlight);
    }

    Object.assign(this.highlight.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  private startTracking(): void {
    if (this.rafId !== null) return;
    const tick = () => {
      if (this.trackedElement && this.highlight) {
        const rect = this.trackedElement.getBoundingClientRect();
        Object.assign(this.highlight.style, {
          top: `${rect.top}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        this.updateChildOutlines();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopTracking(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  hideHighlight(): void {
    this.stopTracking();
    this.trackedElement = null;
    this.hideChildOutlines();
    if (this.highlight) {
      this.highlight.remove();
      this.highlight = null;
    }
  }

  appendToContainer(el: HTMLElement): void {
    this.container.appendChild(el);
  }

  removeFromContainer(el: HTMLElement): void {
    if (this.container.contains(el)) {
      this.container.removeChild(el);
    }
  }

  setHighlightColor(c: string): void {
    this._hlColor = c;
    if (this.highlight) {
      this.highlight.style.borderColor = c;
    }
    for (const outline of this.childOutlinePool) {
      outline.style.borderColor = c;
    }
  }
}
