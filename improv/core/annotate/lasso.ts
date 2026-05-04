export class LassoSelect {
  private container: HTMLElement;
  private rect: HTMLDivElement | null = null;
  private onComplete: ((elements: HTMLElement[]) => void) | null = null;
  private startX = 0;
  private startY = 0;
  private dragging = false;

  private boundMousedown: (e: MouseEvent) => void;
  private boundMousemove: (e: MouseEvent) => void;
  private boundMouseup: (e: MouseEvent) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.boundMousedown = this._onMousedown.bind(this);
    this.boundMousemove = this._onMousemove.bind(this);
    this.boundMouseup = this._onMouseup.bind(this);
  }

  enable(onComplete: (elements: HTMLElement[]) => void): void {
    this.onComplete = onComplete;
    document.addEventListener('mousedown', this.boundMousedown, { capture: true });
  }

  disable(): void {
    this.onComplete = null;
    document.removeEventListener('mousedown', this.boundMousedown, { capture: true });
    document.removeEventListener('mousemove', this.boundMousemove, { capture: true });
    document.removeEventListener('mouseup', this.boundMouseup, { capture: true });
    this._removeRect();
    this.dragging = false;
  }

  private _onMousedown(e: MouseEvent): void {
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.dragging = false;
    document.addEventListener('mousemove', this.boundMousemove, { capture: true });
    document.addEventListener('mouseup', this.boundMouseup, { capture: true });
  }

  private _onMousemove(e: MouseEvent): void {
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    // Only start drawing after a minimum drag distance
    if (!this.dragging && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    this.dragging = true;

    const left = Math.min(this.startX, e.clientX);
    const top = Math.min(this.startY, e.clientY);
    const width = Math.abs(dx);
    const height = Math.abs(dy);

    if (!this.rect) {
      this.rect = document.createElement('div');
      this.rect.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'border:2px dashed #3b82f6',
        'background:rgba(59,130,246,0.08)',
        'z-index:2147483646',
        'border-radius:2px',
      ].join(';');
      this.container.appendChild(this.rect);
    }

    this.rect.style.left = `${left}px`;
    this.rect.style.top = `${top}px`;
    this.rect.style.width = `${width}px`;
    this.rect.style.height = `${height}px`;
  }

  private _onMouseup(e: MouseEvent): void {
    document.removeEventListener('mousemove', this.boundMousemove, { capture: true });
    document.removeEventListener('mouseup', this.boundMouseup, { capture: true });

    if (!this.dragging) {
      this._removeRect();
      return;
    }

    const selectionRect = {
      left: Math.min(this.startX, e.clientX),
      top: Math.min(this.startY, e.clientY),
      right: Math.max(this.startX, e.clientX),
      bottom: Math.max(this.startY, e.clientY),
    };

    this._removeRect();
    this.dragging = false;

    if (this.onComplete) {
      const matched = this._findIntersecting(selectionRect);
      this.onComplete(matched);
    }
  }

  private _findIntersecting(sel: { left: number; top: number; right: number; bottom: number }): HTMLElement[] {
    const all = Array.from(document.querySelectorAll<HTMLElement>('*'));
    return all.filter((el) => {
      // Skip overlay host and its children
      if (el.closest('[data-improv]')) return false;
      const r = el.getBoundingClientRect();
      return this._rectsIntersect(sel, r);
    });
  }

  private _rectsIntersect(
    a: { left: number; top: number; right: number; bottom: number },
    b: DOMRect,
  ): boolean {
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  }

  private _removeRect(): void {
    if (this.rect) {
      this.rect.remove();
      this.rect = null;
    }
  }
}
