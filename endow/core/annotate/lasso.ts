export class LassoSelect {
  private container: HTMLElement;
  private rect: HTMLDivElement | null = null;
  private countBadge: HTMLDivElement | null = null;
  private freezeBadge: HTMLDivElement | null = null;
  private overlays: HTMLDivElement[] = [];
  private onComplete: ((elements: HTMLElement[]) => void) | null = null;
  private startX = 0;
  private startY = 0;
  private dragging = false;

  private _color: string | undefined;

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
    this.clearOverlays();
    this.dragging = false;
  }

  showSelectionOverlays(elements: HTMLElement[]): void {
    this.clearOverlays();
    const _c = this._color || '#D97757';
    for (const el of elements) {
      const r = el.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.style.cssText = [
        'position:fixed',
        `left:${r.left}px`,
        `top:${r.top}px`,
        `width:${r.width}px`,
        `height:${r.height}px`,
        'background:' + _c + '26',
        'border:1px solid ' + _c + '66',
        'border-radius:2px',
        'pointer-events:none',
        'z-index:2147483643',
      ].join(';');
      this.container.appendChild(overlay);
      this.overlays.push(overlay);
    }
  }

  clearOverlays(): void {
    for (const ov of this.overlays) ov.remove();
    this.overlays = [];
  }

  showFreezeIndicator(onUnfreeze: () => void): void {
    this.hideFreezeIndicator();

    const badge = document.createElement('div');
    badge.style.cssText = [
      'position:fixed',
      'left:12px',
      'top:12px',
      'background:#f97316',
      'color:#fff',
      'border-radius:20px',
      'padding:6px 12px',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'font-family:EndowSans,system-ui,sans-serif',
      'font-size:12px',
      'font-weight:600',
      'z-index:2147483646',
      'pointer-events:all',
      'box-shadow:0 2px 10px rgba(0,0,0,0.3)',
      'user-select:none',
    ].join(';');

    const snowflake = document.createElement('span');
    snowflake.textContent = '❅';
    snowflake.style.cssText = 'font-size:14px;';
    badge.appendChild(snowflake);

    const label = document.createElement('span');
    label.textContent = 'Animations paused';
    badge.appendChild(label);

    const sep = document.createElement('span');
    sep.textContent = '·';
    sep.style.cssText = 'opacity:0.6;';
    badge.appendChild(sep);

    const unfreezeBtn = document.createElement('button');
    unfreezeBtn.textContent = 'Unfreeze';
    unfreezeBtn.style.cssText = [
      'background:rgba(255,255,255,0.2)',
      'border:none',
      'border-radius:12px',
      'color:#fff',
      'font-size:11px',
      'font-weight:700',
      'padding:2px 8px',
      'cursor:pointer',
      'font-family:EndowSans,system-ui,sans-serif',
      'transition:background 0.1s',
    ].join(';');
    unfreezeBtn.addEventListener('mouseover', () => { unfreezeBtn.style.background = 'rgba(255,255,255,0.35)'; });
    unfreezeBtn.addEventListener('mouseout', () => { unfreezeBtn.style.background = 'rgba(255,255,255,0.2)'; });
    unfreezeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onUnfreeze();
    });
    badge.appendChild(unfreezeBtn);

    this.container.appendChild(badge);
    this.freezeBadge = badge;
  }

  hideFreezeIndicator(): void {
    if (this.freezeBadge) {
      this.freezeBadge.remove();
      this.freezeBadge = null;
    }
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

    if (!this.dragging && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    this.dragging = true;

    const left = Math.min(this.startX, e.clientX);
    const top = Math.min(this.startY, e.clientY);
    const width = Math.abs(dx);
    const height = Math.abs(dy);

    const _c = this._color || '#D97757';
    if (!this.rect) {
      this.rect = document.createElement('div');
      this.rect.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'border:2px dashed ' + _c,
        'background:' + _c + '14',
        'z-index:2147483646',
        'border-radius:2px',
      ].join(';');
      this.container.appendChild(this.rect);
    }

    this.rect.style.left = `${left}px`;
    this.rect.style.top = `${top}px`;
    this.rect.style.width = `${width}px`;
    this.rect.style.height = `${height}px`;
    this.rect.style.borderColor = _c;
    this.rect.style.background = _c + '14';

    // Count badge
    const captured = this._findIntersecting({ left, top, right: left + width, bottom: top + height });
    const count = captured.length;

    if (!this.countBadge) {
      this.countBadge = document.createElement('div');
      this.countBadge.style.cssText = [
        'position:fixed',
        'background:#D97757',
        'color:#fff',
        'border-radius:10px',
        'padding:2px 8px',
        'font-size:11px',
        'font-weight:700',
        'font-family:EndowSans,system-ui,sans-serif',
        'pointer-events:none',
        'z-index:2147483647',
        'white-space:nowrap',
      ].join(';');
      this.container.appendChild(this.countBadge);
    }
    this.countBadge.textContent = `${count} element${count === 1 ? '' : 's'}`;
    // Position badge at top-right of lasso rectangle
    this.countBadge.style.left = `${left + width + 4}px`;
    this.countBadge.style.top = `${top}px`;
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
      if (el.closest('[data-endow]')) return false;
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
    if (this.countBadge) {
      this.countBadge.remove();
      this.countBadge = null;
    }
  }

  setColor(c: string): void {
    this._color = c;
  }
}
