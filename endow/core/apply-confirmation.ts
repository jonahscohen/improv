// Heroicons: check (mini, 20x20) - sourced verbatim from Heroicons
const CHECK_ICON_PATH = 'M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z';

// Heroicons: x-circle (mini, 20x20) - sourced verbatim from Heroicons
const X_CIRCLE_PATH = 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z';

export interface ConfirmationItem {
  label: string;
  detail?: string;
}

type State = 'sending' | 'success' | 'error' | 'hidden';

const MAX_VISIBLE_ITEMS = 5;

export class ApplyConfirmation {
  private shadowRoot: ShadowRoot;
  private container: HTMLDivElement;
  private state: State = 'hidden';
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private styleEl: HTMLStyleElement;

  constructor(shadowRoot: ShadowRoot) {
    this.shadowRoot = shadowRoot;

    // Inject keyframe animations once
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = [
      '@keyframes endow-toast-in {',
      '  from { opacity: 0; transform: translateY(-20px); }',
      '  to   { opacity: 1; transform: translateY(0); }',
      '}',
      '@keyframes endow-toast-out {',
      '  from { opacity: 1; transform: translateY(0); }',
      '  to   { opacity: 0; transform: translateY(-10px); }',
      '}',
      '@keyframes endow-pulse-border {',
      '  0%, 100% { border-color: rgba(99,102,241,0.4); }',
      '  50%       { border-color: rgba(99,102,241,0.9); }',
      '}',
    ].join('\n');
    this.shadowRoot.appendChild(this.styleEl);

    // Root container - top-center fixed inside Shadow DOM
    this.container = document.createElement('div');
    this.applyStyles(this.container, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%) translateY(-20px)',
      zIndex: '2147483646',
      minWidth: '280px',
      maxWidth: '400px',
      background: '#1a1a2e',
      border: '1px solid #333',
      borderLeft: '4px solid #333',
      borderRadius: '10px',
      padding: '12px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)',
      fontFamily: "'EndowSans', system-ui, sans-serif",
      pointerEvents: 'all',
      opacity: '0',
      display: 'none',
      userSelect: 'none',
    });

    this.shadowRoot.appendChild(this.container);
  }

  // ---- Public API ----

  showSending(message: string): void {
    this.cancelDismiss();
    this.state = 'sending';
    this.clearContainer();

    // Sending state: pulsing border
    this.applyStyles(this.container, {
      borderLeftColor: 'rgba(99,102,241,0.9)',
      animation: 'endow-toast-in 200ms ease-out forwards, endow-pulse-border 1.2s ease-in-out infinite',
    });

    const row = document.createElement('div');
    this.applyStyles(row, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const spinner = this.createSpinner();
    row.appendChild(spinner);

    const text = document.createElement('span');
    text.textContent = message;
    this.applyStyles(text, {
      fontSize: '12px',
      fontWeight: '500',
      color: '#a5b4fc',
      lineHeight: '1.4',
    });
    row.appendChild(text);

    this.container.appendChild(row);
    this.show();
  }

  showSuccess(items: ConfirmationItem[]): void {
    this.cancelDismiss();
    this.state = 'success';
    this.clearContainer();

    this.applyStyles(this.container, {
      borderLeftColor: '#22c55e',
      animation: 'endow-toast-in 200ms ease-out forwards',
    });

    // Header row
    const headerRow = document.createElement('div');
    this.applyStyles(headerRow, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: items.length > 0 ? '8px' : '0',
    });

    headerRow.appendChild(this.createCheckIcon('#22c55e', 16));

    const headerText = document.createElement('span');
    headerText.textContent = 'Sent to Claude';
    this.applyStyles(headerText, {
      fontSize: '12px',
      fontWeight: '600',
      color: '#22c55e',
    });
    headerRow.appendChild(headerText);

    // Count badge
    if (items.length > 0) {
      const count = document.createElement('span');
      const n = items.length;
      count.textContent = this.describeCount(n);
      this.applyStyles(count, {
        marginLeft: 'auto',
        fontSize: '10px',
        fontWeight: '500',
        color: '#4ade80',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: '0',
      });
      headerRow.appendChild(count);
    }

    this.container.appendChild(headerRow);

    // Items list (max 5, then "+N more")
    if (items.length > 0) {
      const visible = items.slice(0, MAX_VISIBLE_ITEMS);
      const overflow = items.length - visible.length;

      const list = document.createElement('div');
      this.applyStyles(list, {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      });

      for (const item of visible) {
        list.appendChild(this.createItemRow(item));
      }

      if (overflow > 0) {
        const more = document.createElement('span');
        more.textContent = `+${overflow} more`;
        this.applyStyles(more, {
          fontSize: '10px',
          color: '#4ade80',
          paddingLeft: '22px',
          marginTop: '2px',
          fontVariantNumeric: 'tabular-nums',
        });
        list.appendChild(more);
      }

      this.container.appendChild(list);
    }

    this.show();

    // Auto-dismiss after 3 seconds
    this.dismissTimer = setTimeout(() => {
      this.animateDismiss();
    }, 3000);
  }

  showError(message: string, onRetry?: () => void): void {
    this.cancelDismiss();
    this.state = 'error';
    this.clearContainer();

    this.applyStyles(this.container, {
      borderLeftColor: '#ef4444',
      animation: 'endow-toast-in 200ms ease-out forwards',
    });

    // Header row
    const headerRow = document.createElement('div');
    this.applyStyles(headerRow, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: onRetry ? '10px' : '0',
    });

    headerRow.appendChild(this.createXIcon());

    const headerText = document.createElement('span');
    headerText.textContent = 'Failed to send';
    this.applyStyles(headerText, {
      fontSize: '12px',
      fontWeight: '600',
      color: '#ef4444',
    });
    headerRow.appendChild(headerText);

    this.container.appendChild(headerRow);

    // Message
    if (message) {
      const msg = document.createElement('span');
      msg.textContent = message;
      this.applyStyles(msg, {
        display: 'block',
        fontSize: '11px',
        color: '#888',
        lineHeight: '1.4',
        marginBottom: onRetry ? '10px' : '0',
        paddingLeft: '22px',
      });
      this.container.appendChild(msg);
    }

    // Retry button
    if (onRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.textContent = 'Retry';
      this.applyStyles(retryBtn, {
        display: 'block',
        marginLeft: 'auto',
        border: '1px solid rgba(239,68,68,0.5)',
        background: 'rgba(239,68,68,0.1)',
        color: '#ef4444',
        fontSize: '11px',
        fontWeight: '600',
        fontFamily: "'EndowSans', system-ui, sans-serif",
        borderRadius: '6px',
        padding: '4px 12px',
        cursor: 'pointer',
        transition: 'background 120ms ease, transform 80ms ease',
      });
      retryBtn.addEventListener('mouseenter', () => {
        retryBtn.style.background = 'rgba(239,68,68,0.2)';
      });
      retryBtn.addEventListener('mouseleave', () => {
        retryBtn.style.background = 'rgba(239,68,68,0.1)';
      });
      retryBtn.addEventListener('mousedown', () => {
        retryBtn.style.transform = 'scale(0.96)';
      });
      retryBtn.addEventListener('mouseup', () => {
        retryBtn.style.transform = '';
      });
      retryBtn.addEventListener('click', () => {
        this.dismiss();
        onRetry();
      });
      this.container.appendChild(retryBtn);
    }

    this.show();
  }

  dismiss(): void {
    this.cancelDismiss();
    this.container.style.display = 'none';
    this.container.style.opacity = '0';
    this.state = 'hidden';
  }

  destroy(): void {
    this.cancelDismiss();
    this.container.remove();
    this.styleEl.remove();
  }

  // ---- Private helpers ----

  private show(): void {
    this.container.style.display = 'block';
  }

  private animateDismiss(): void {
    this.container.style.animation = 'endow-toast-out 300ms ease-in forwards';
    const onEnd = (): void => {
      this.container.removeEventListener('animationend', onEnd);
      if (this.state !== 'hidden') {
        this.container.style.display = 'none';
        this.container.style.opacity = '0';
        this.state = 'hidden';
      }
    };
    this.container.addEventListener('animationend', onEnd);
  }

  private cancelDismiss(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }

  private clearContainer(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    // Reset animation so it can retrigger
    this.container.style.animation = 'none';
  }

  private describeCount(n: number): string {
    return `${n} change${n === 1 ? '' : 's'} applied`;
  }

  private createItemRow(item: ConfirmationItem): HTMLDivElement {
    const row = document.createElement('div');
    this.applyStyles(row, {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '6px',
    });

    row.appendChild(this.createCheckIcon('#4ade80', 14));

    const textBlock = document.createElement('div');
    this.applyStyles(textBlock, {
      display: 'flex',
      flexDirection: 'column',
      gap: '1px',
      minWidth: '0',
    });

    const label = document.createElement('span');
    label.textContent = item.label;
    this.applyStyles(label, {
      fontSize: '11px',
      fontWeight: '500',
      color: '#ccc',
      lineHeight: '1.3',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    textBlock.appendChild(label);

    if (item.detail) {
      const detail = document.createElement('span');
      detail.textContent = item.detail;
      this.applyStyles(detail, {
        fontSize: '10px',
        color: '#666',
        lineHeight: '1.3',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
      textBlock.appendChild(detail);
    }

    row.appendChild(textBlock);
    return row;
  }

  private createCheckIcon(color: string, size: number): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', color);
    svg.style.flexShrink = '0';
    svg.style.marginTop = size === 14 ? '1px' : '0';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', CHECK_ICON_PATH);
    path.setAttribute('clip-rule', 'evenodd');
    svg.appendChild(path);

    return svg;
  }

  private createXIcon(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', '#ef4444');
    svg.style.flexShrink = '0';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', X_CIRCLE_PATH);
    path.setAttribute('clip-rule', 'evenodd');
    svg.appendChild(path);

    return svg;
  }

  private createSpinner(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('fill', 'none');
    svg.style.flexShrink = '0';
    svg.style.animation = 'spin 1s linear infinite';

    // Inject spin keyframe if not already added (reuse the style element)
    if (!this.styleEl.textContent?.includes('@keyframes spin')) {
      this.styleEl.textContent += [
        '@keyframes spin {',
        '  from { transform: rotate(0deg); }',
        '  to   { transform: rotate(360deg); }',
        '}',
      ].join('\n');
    }

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    circle.setAttribute('stroke', 'rgba(99,102,241,0.25)');
    circle.setAttribute('stroke-width', '3');
    svg.appendChild(circle);

    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arc.setAttribute('d', 'M12 2a10 10 0 0 1 10 10');
    arc.setAttribute('stroke', '#818cf8');
    arc.setAttribute('stroke-width', '3');
    arc.setAttribute('stroke-linecap', 'round');
    svg.appendChild(arc);

    return svg;
  }

  private applyStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
    for (const [key, value] of Object.entries(styles)) {
      if (value !== undefined) {
        (el.style as any)[key] = value;
      }
    }
  }
}
