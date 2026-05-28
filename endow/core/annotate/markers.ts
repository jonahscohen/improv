type Intent = 'fix' | 'change' | 'question' | 'approve';
type Severity = 'blocking' | 'important' | 'suggestion';

const INTENT_COLORS: Record<Intent, string> = {
  fix: '#ef4444',
  change: '#D97757',
  question: '#eab308',
  approve: '#22c55e',
};

const SEVERITY_COLORS: Record<Severity, string> = {
  blocking: '#ef4444',
  important: '#f97316',
  suggestion: '#6b7280',
};

export class AnnotationMarker {
  private shadow: ShadowRoot;
  private markers: HTMLDivElement[] = [];
  private lines: SVGSVGElement[] = [];
  private activePopup: HTMLDivElement | null = null;

  constructor(shadow: ShadowRoot) {
    this.shadow = shadow;
  }

  create(rect: DOMRect, index: number, intent: string = 'fix'): HTMLDivElement {
    const color = INTENT_COLORS[intent as Intent] ?? INTENT_COLORS.fix;

    // Dashed connecting line from marker to center of element
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const markerX = rect.left + rect.width - 12;
    const markerY = rect.top - 12;

    const minX = Math.min(centerX, markerX + 12);
    const minY = Math.min(centerY, markerY + 12);
    const maxX = Math.max(centerX, markerX + 12);
    const maxY = Math.max(centerY, markerY + 12);
    const svgW = Math.max(maxX - minX, 1);
    const svgH = Math.max(maxY - minY, 1);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(svgW));
    svg.setAttribute('height', String(svgH));
    svg.style.cssText = [
      'position:fixed',
      `left:${minX}px`,
      `top:${minY}px`,
      'pointer-events:none',
      'z-index:2147483644',
      'overflow:visible',
    ].join(';');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(centerX - minX));
    line.setAttribute('y1', String(centerY - minY));
    line.setAttribute('x2', String(markerX + 12 - minX));
    line.setAttribute('y2', String(markerY + 12 - minY));
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '4 3');
    line.setAttribute('opacity', '0.6');
    svg.appendChild(line);
    this.shadow.appendChild(svg);
    this.lines.push(svg);

    // Circle marker
    const marker = document.createElement('div');
    marker.style.cssText = [
      'position:fixed',
      `left:${markerX}px`,
      `top:${markerY}px`,
      'width:24px',
      'height:24px',
      `background:${color}`,
      'color:#fff',
      'border-radius:12px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:11px',
      'font-weight:700',
      'font-family:EndowSans,system-ui,sans-serif',
      'pointer-events:all',
      'cursor:pointer',
      'z-index:2147483645',
      'user-select:none',
      'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
      'transition:transform 0.1s',
    ].join(';');

    marker.textContent = String(index);
    marker.dataset.intent = intent;
    marker.addEventListener('mouseover', () => {
      marker.style.transform = 'scale(1.15)';
    });
    marker.addEventListener('mouseout', () => {
      marker.style.transform = 'scale(1)';
    });

    this.shadow.appendChild(marker);
    this.markers.push(marker);
    return marker;
  }

  showPopup(
    rect: DOMRect,
    elementName: string,
    elementPath: string,
    onSubmit: (comment: string, intent: string, severity: string) => void,
  ): void {
    this.hidePopup();

    const popup = document.createElement('div');

    // Position: try right of element, clamp to viewport
    const popupW = 300;
    let left = rect.right + 12;
    if (left + popupW > window.innerWidth - 8) {
      left = rect.left - popupW - 12;
    }
    if (left < 8) left = 8;
    let top = rect.top;
    if (top + 380 > window.innerHeight - 8) {
      top = window.innerHeight - 388;
    }
    if (top < 8) top = 8;

    popup.style.cssText = [
      'position:fixed',
      `left:${left}px`,
      `top:${top}px`,
      `width:${popupW}px`,
      'background:#1a1a2e',
      'border-radius:12px',
      'padding:16px',
      'display:flex',
      'flex-direction:column',
      'gap:12px',
      'z-index:2147483647',
      'pointer-events:all',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
      'font-family:EndowSans,system-ui,sans-serif',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

    const tagLine = document.createElement('div');
    tagLine.style.cssText = 'color:#e2e8f0;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    tagLine.textContent = elementName;
    header.appendChild(tagLine);

    const pathLine = document.createElement('div');
    pathLine.style.cssText = 'color:#64748b;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    pathLine.textContent = elementPath;
    header.appendChild(pathLine);

    popup.appendChild(header);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:#2a2a3e;';
    popup.appendChild(divider);

    // Intent pills
    const intentRow = this._buildPillGroup(
      'intent',
      ['fix', 'change', 'question', 'approve'],
      'fix',
      INTENT_COLORS,
    );
    popup.appendChild(intentRow);

    // Severity pills
    const severityRow = this._buildPillGroup(
      'severity',
      ['blocking', 'important', 'suggestion'],
      'suggestion',
      SEVERITY_COLORS,
    );
    popup.appendChild(severityRow);

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Describe the issue...';
    textarea.style.cssText = [
      'width:100%',
      'background:#2a2a3e',
      'color:#e2e8f0',
      'border:1px solid #3a3a5c',
      'border-radius:8px',
      'padding:8px 10px',
      'font-size:13px',
      'font-family:EndowSans,system-ui,sans-serif',
      'resize:none',
      'outline:none',
      'box-sizing:border-box',
      'min-height:64px',
      'max-height:120px',
      'line-height:1.5',
    ].join(';');
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
    popup.appendChild(textarea);

    // Action row
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Add Annotation';
    submitBtn.style.cssText = [
      'background:#D97757',
      'color:#fff',
      'border:none',
      'border-radius:8px',
      'padding:9px 12px',
      'font-size:13px',
      'font-weight:600',
      'cursor:pointer',
      'font-family:EndowSans,system-ui,sans-serif',
      'transition:background 0.1s',
      'width:100%',
    ].join(';');
    submitBtn.addEventListener('mouseover', () => { submitBtn.style.background = '#2563eb'; });
    submitBtn.addEventListener('mouseout', () => { submitBtn.style.background = '#D97757'; });

    submitBtn.addEventListener('click', () => {
      const comment = textarea.value.trim();
      const selectedIntents = Array.from(popup.querySelectorAll<HTMLButtonElement>('[data-group="intent"][data-selected="true"]'))
        .map((el) => el.dataset.value).filter(Boolean);
      const selectedSeverities = Array.from(popup.querySelectorAll<HTMLButtonElement>('[data-group="severity"][data-selected="true"]'))
        .map((el) => el.dataset.value).filter(Boolean);
      this.hidePopup();
      onSubmit(
        comment,
        selectedIntents.join(',') || 'fix',
        selectedSeverities.join(',') || 'suggestion',
      );
    });
    actions.appendChild(submitBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = [
      'background:none',
      'border:none',
      'color:#64748b',
      'font-size:12px',
      'cursor:pointer',
      'font-family:EndowSans,system-ui,sans-serif',
      'padding:2px',
      'text-align:center',
    ].join(';');
    cancelBtn.addEventListener('click', () => { this.hidePopup(); });
    cancelBtn.addEventListener('mouseover', () => { cancelBtn.style.color = '#94a3b8'; });
    cancelBtn.addEventListener('mouseout', () => { cancelBtn.style.color = '#64748b'; });
    actions.appendChild(cancelBtn);

    popup.appendChild(actions);
    this.shadow.appendChild(popup);
    this.activePopup = popup;

    setTimeout(() => textarea.focus(), 0);
  }

  hidePopup(): void {
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
  }

  updateMarkerIntent(marker: HTMLDivElement, intent: string): void {
    const color = INTENT_COLORS[intent as Intent] ?? INTENT_COLORS.fix;
    marker.style.background = color;
    marker.dataset.intent = intent;
  }

  clear(): void {
    this.hidePopup();
    for (const m of this.markers) m.remove();
    for (const l of this.lines) l.remove();
    this.markers = [];
    this.lines = [];
  }

  destroy(): void {
    this.clear();
  }

  // Legacy shim - show popup anchored relative to a marker element
  showCommentInput(
    marker: HTMLDivElement,
    onSubmit: (comment: string, intent: Intent, severity: Severity) => void,
  ): void {
    const markerRect = marker.getBoundingClientRect();
    const fakeRect = new DOMRect(
      markerRect.left - 24,
      markerRect.top + 12,
      24,
      24,
    );
    this.showPopup(fakeRect, 'Element', '', (comment, intent, severity) => {
      onSubmit(comment, intent as Intent, severity as Severity);
    });
  }

  private _buildPillGroup(
    group: string,
    options: string[],
    defaultValue: string,
    colors: Record<string, string>,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

    for (const option of options) {
      const pill = document.createElement('button');
      const color = colors[option] ?? '#6b7280';
      const isDefault = option === defaultValue;

      pill.textContent = option.charAt(0).toUpperCase() + option.slice(1);
      pill.dataset.group = group;
      pill.dataset.value = option;
      pill.dataset.selected = isDefault ? 'true' : 'false';

      const applyStyle = (selected: boolean) => {
        pill.style.cssText = [
          `background:${color}`,
          `opacity:${selected ? '1' : '0.22'}`,
          'color:#fff',
          'border:none',
          'border-radius:20px',
          'padding:4px 10px',
          'font-size:11px',
          'font-weight:600',
          'cursor:pointer',
          'font-family:EndowSans,system-ui,sans-serif',
          'transition:opacity 0.1s',
          'user-select:none',
        ].join(';');
      };

      applyStyle(isDefault);

      pill.addEventListener('click', () => {
        // Toggle this pill on/off (multi-select, not radio)
        const wasSelected = pill.dataset.selected === 'true';
        pill.dataset.selected = wasSelected ? 'false' : 'true';
        applyStyle(!wasSelected);
      });

      row.appendChild(pill);
    }

    return row;
  }
}
