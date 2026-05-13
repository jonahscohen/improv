type SelectCallback = (text: string, rect: DOMRect) => void;

export class TextSelection {
  onSelect: SelectCallback | null = null;
  private boundMouseup: (e: MouseEvent) => void;

  constructor() {
    this.boundMouseup = this._onMouseup.bind(this);
  }

  enable(callback: SelectCallback): void {
    this.onSelect = callback;
    document.addEventListener('mouseup', this.boundMouseup, { capture: true });
  }

  disable(): void {
    this.onSelect = null;
    document.removeEventListener('mouseup', this.boundMouseup, { capture: true });
  }

  private _onMouseup(_e: MouseEvent): void {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      const text = sel.toString().trim();
      if (!text) return;

      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      this.onSelect?.(text, rect);
    }, 0);
  }
}
