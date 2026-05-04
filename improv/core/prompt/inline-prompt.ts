type SubmitCallback = (text: string) => void;

export class InlinePrompt {
  private container: HTMLDivElement;
  private input: HTMLInputElement;
  private submitCallback: SubmitCallback | null = null;
  private visible = false;

  constructor(shadow: ShadowRoot) {
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'position:fixed',
      'display:none',
      'z-index:2147483647',
      'background:#1e1e2e',
      'border:2px solid #3b82f6',
      'border-radius:8px',
      'padding:8px',
      'min-width:300px',
      'pointer-events:auto',
      'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
    ].join(';');

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Describe the change...';
    this.input.style.cssText = [
      'width:100%',
      'background:#2a2a3e',
      'color:#e2e8f0',
      'border:1px solid #3b4263',
      'border-radius:4px',
      'padding:6px 10px',
      'font-size:13px',
      'font-family:system-ui,sans-serif',
      'outline:none',
      'box-sizing:border-box',
    ].join(';');

    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const value = this.input.value.trim();
        if (value && this.submitCallback) {
          this.submitCallback(value);
        }
        this.hide();
      } else if (e.key === 'Escape') {
        this.hide();
      }
    });

    this.container.appendChild(this.input);
    shadow.appendChild(this.container);
  }

  show(x: number, y: number): void {
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
    this.container.style.display = 'block';
    this.visible = true;
    // Defer focus so the layout is committed before we attempt focus
    requestAnimationFrame(() => {
      this.input.value = '';
      this.input.focus();
    });
  }

  hide(): void {
    this.container.style.display = 'none';
    this.visible = false;
  }

  onPromptSubmit(callback: SubmitCallback): void {
    this.submitCallback = callback;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.remove();
  }
}
