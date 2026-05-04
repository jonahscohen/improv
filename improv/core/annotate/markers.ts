type Intent = 'fix' | 'change' | 'question' | 'approve';
type Severity = 'blocking' | 'important' | 'suggestion';

export class AnnotationMarker {
  private shadow: ShadowRoot;
  private markers: HTMLDivElement[] = [];
  private popups: HTMLDivElement[] = [];

  constructor(shadow: ShadowRoot) {
    this.shadow = shadow;
  }

  create(elementRect: DOMRect, index: number): HTMLDivElement {
    const marker = document.createElement('div');
    marker.style.cssText = [
      'position:fixed',
      `left:${elementRect.left + elementRect.width - 12}px`,
      `top:${elementRect.top - 12}px`,
      'width:24px',
      'height:24px',
      'background:#3b82f6',
      'color:#fff',
      'border-radius:12px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:12px',
      'font-weight:600',
      'font-family:system-ui,sans-serif',
      'pointer-events:all',
      'cursor:pointer',
      'z-index:1',
      'user-select:none',
      'box-shadow:0 1px 4px rgba(0,0,0,0.3)',
    ].join(';');

    marker.textContent = String(index);
    this.shadow.appendChild(marker);
    this.markers.push(marker);
    return marker;
  }

  showCommentInput(
    marker: HTMLDivElement,
    onSubmit: (comment: string, intent: Intent, severity: Severity) => void,
  ): void {
    // Remove any existing popup
    this.popups.forEach((p) => p.remove());
    this.popups = [];

    const markerRect = marker.getBoundingClientRect();

    const popup = document.createElement('div');
    popup.style.cssText = [
      'position:fixed',
      `left:${markerRect.left}px`,
      `top:${markerRect.bottom + 6}px`,
      'width:280px',
      'background:#1e1e2e',
      'border:1px solid #3b4261',
      'border-radius:8px',
      'padding:12px',
      'display:flex',
      'flex-direction:column',
      'gap:10px',
      'z-index:2',
      'pointer-events:all',
      'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
      'font-family:system-ui,sans-serif',
    ].join(';');

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a comment...';
    textarea.rows = 3;
    textarea.style.cssText = [
      'width:100%',
      'background:#12121f',
      'color:#cdd6f4',
      'border:1px solid #3b4261',
      'border-radius:4px',
      'padding:6px 8px',
      'font-size:13px',
      'font-family:system-ui,sans-serif',
      'resize:vertical',
      'outline:none',
      'box-sizing:border-box',
    ].join(';');
    popup.appendChild(textarea);

    // Intent row
    popup.appendChild(this._buildRadioGroup(
      'intent',
      ['fix', 'change', 'question', 'approve'],
      'fix',
      '#cdd6f4',
    ));

    // Severity row
    popup.appendChild(this._buildRadioGroup(
      'severity',
      ['blocking', 'important', 'suggestion'],
      'suggestion',
      '#cdd6f4',
    ));

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Add annotation';
    submitBtn.style.cssText = [
      'background:#3b82f6',
      'color:#fff',
      'border:none',
      'border-radius:4px',
      'padding:6px 12px',
      'font-size:13px',
      'font-weight:600',
      'cursor:pointer',
      'align-self:flex-end',
      'font-family:system-ui,sans-serif',
    ].join(';');

    submitBtn.addEventListener('click', () => {
      const comment = textarea.value.trim();
      const intentInput = popup.querySelector<HTMLInputElement>('input[name="intent"]:checked');
      const severityInput = popup.querySelector<HTMLInputElement>('input[name="severity"]:checked');
      const intent = (intentInput?.value ?? 'fix') as Intent;
      const severity = (severityInput?.value ?? 'suggestion') as Severity;
      popup.remove();
      this.popups = this.popups.filter((p) => p !== popup);
      onSubmit(comment, intent, severity);
    });

    popup.appendChild(submitBtn);
    this.shadow.appendChild(popup);
    this.popups.push(popup);

    // Focus textarea
    setTimeout(() => textarea.focus(), 0);
  }

  private _buildRadioGroup(
    name: string,
    options: string[],
    defaultValue: string,
    textColor: string,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:flex',
      'gap:8px',
      'flex-wrap:wrap',
      'align-items:center',
    ].join(';');

    const label = document.createElement('span');
    label.textContent = name + ':';
    label.style.cssText = `color:#7f849c;font-size:11px;font-weight:600;min-width:52px;text-transform:uppercase;letter-spacing:0.04em;`;
    row.appendChild(label);

    for (const option of options) {
      const optLabel = document.createElement('label');
      optLabel.style.cssText = `display:flex;align-items:center;gap:3px;cursor:pointer;color:${textColor};font-size:12px;`;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = name;
      radio.value = option;
      if (option === defaultValue) radio.checked = true;
      radio.style.cssText = 'accent-color:#3b82f6;cursor:pointer;';

      const optText = document.createElement('span');
      optText.textContent = option;

      optLabel.appendChild(radio);
      optLabel.appendChild(optText);
      row.appendChild(optLabel);
    }

    return row;
  }

  clear(): void {
    for (const marker of this.markers) {
      marker.remove();
    }
    for (const popup of this.popups) {
      popup.remove();
    }
    this.markers = [];
    this.popups = [];
  }

  destroy(): void {
    this.clear();
  }
}
