export class Overlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private highlight: HTMLDivElement | null = null;
  private trackedElement: HTMLElement | null = null;
  private rafId: number | null = null;
  private _hlColor: string | undefined;

  constructor() {
    this.host = document.createElement('div');
    this.host.dataset['endow'] = '';
    this.host.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';

    this.shadow = this.host.attachShadow({ mode: 'open' });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      :host{all:initial;}
      .endow-container{position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;overflow:visible;}
    `);
    this.shadow.adoptedStyleSheets = [sheet];

    this.container = document.createElement('div');
    this.container.className = 'endow-container';
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
    this.positionHighlight(rect);
  }

  trackElement(el: HTMLElement): void {
    this.trackedElement = el;
    this.positionHighlight(el.getBoundingClientRect());
    this.startTracking();
  }

  private positionHighlight(rect: DOMRect): void {
    if (!this.highlight) {
      this.highlight = document.createElement('div');
      this.highlight.style.cssText =
        'position:fixed;pointer-events:none;border:2px solid ' + '#D97757' + ';border-radius:5px;transition:top 60ms ease,left 60ms ease,width 60ms ease,height 60ms ease;';
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
  }
}
