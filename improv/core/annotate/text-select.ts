export class TextSelect {
  private onSelect: ((text: string, rect: DOMRect) => void) | null = null;
  private boundMouseup: (e: MouseEvent) => void;

  constructor() {
    this.boundMouseup = this._onMouseup.bind(this);
  }

  enable(onSelect: (text: string, rect: DOMRect) => void): void {
    this.onSelect = onSelect;
    document.addEventListener('mouseup', this.boundMouseup, { capture: true });
  }

  disable(): void {
    this.onSelect = null;
    document.removeEventListener('mouseup', this.boundMouseup, { capture: true });
  }

  private _onMouseup(_e: MouseEvent): void {
    // Defer so the browser can finalize the selection
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      if (!text) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0) return;

      this.onSelect?.(text, rect);
    }, 0);
  }
}
