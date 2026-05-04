import type { ImprovMode } from './types';

type ModeCallback = (mode: ImprovMode | null) => void;
type ApplyCallback = () => void;

// SVG path data sourced verbatim from Heroicons (stroke-based, 24x24 viewBox)
const ICONS: Record<string, string> = {
  // Heroicons: arrows-up-down
  manipulate:
    'M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 3L16.5 21m0 0L12 16.5m4.5 4.5V7.5',
  // Heroicons: chat-bubble-left
  prompt:
    'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
  // Heroicons: squares-2x2
  'annotate-layout':
    'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
};

const LABELS: Record<string, string> = {
  manipulate: 'Manipulate',
  prompt: 'Prompt',
  'annotate-layout': 'Annotate / Layout',
};

export class Toolbar {
  private el: HTMLDivElement;
  private activeMode: ImprovMode | null = null;
  private modeCallbacks: ModeCallback[] = [];
  private applyCallbacks: ApplyCallback[] = [];
  private statusDot: HTMLDivElement;
  private badge: HTMLDivElement;
  private applyBtn: HTMLButtonElement;
  private buttons = new Map<ImprovMode, HTMLButtonElement>();

  constructor(shadowRoot: ShadowRoot) {
    // Wrapper
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:4px',
      'background:#1a1a2e',
      'border:1px solid #333',
      'border-radius:12px',
      'padding:8px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
      'pointer-events:all',
      'user-select:none',
      'z-index:2147483647',
    ].join(';');

    // Mode buttons row
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display:flex;gap:4px;';

    const modes: ImprovMode[] = ['manipulate', 'prompt', 'annotate-layout'];
    for (const mode of modes) {
      const btn = this.createModeButton(mode);
      this.buttons.set(mode, btn);
      buttonRow.appendChild(btn);
    }
    this.el.appendChild(buttonRow);

    // Apply button (hidden until changes are queued)
    this.applyBtn = document.createElement('button');
    this.applyBtn.textContent = 'Apply';
    this.applyBtn.style.cssText = [
      'display:none',
      'width:100%',
      'border:none',
      'background:#22c55e',
      'color:#fff',
      'font-size:12px',
      'font-family:system-ui,sans-serif',
      'font-weight:600',
      'border-radius:8px',
      'padding:6px 12px',
      'cursor:pointer',
      'transition:background 120ms ease,transform 80ms ease',
      'margin-top:2px',
    ].join(';');
    this.applyBtn.addEventListener('click', () => {
      this.applyCallbacks.forEach((cb) => cb());
    });
    this.applyBtn.addEventListener('mouseenter', () => {
      this.applyBtn.style.background = '#16a34a';
    });
    this.applyBtn.addEventListener('mouseleave', () => {
      this.applyBtn.style.background = '#22c55e';
    });
    this.applyBtn.addEventListener('mousedown', () => {
      this.applyBtn.style.transform = 'scale(0.96)';
    });
    this.applyBtn.addEventListener('mouseup', () => {
      this.applyBtn.style.transform = '';
    });
    this.el.appendChild(this.applyBtn);

    // Bottom row: status dot + badge
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding-top:2px;';

    this.statusDot = document.createElement('div');
    this.statusDot.style.cssText =
      'width:8px;height:8px;border-radius:50%;background:#ef4444;flex-shrink:0;';
    bottomRow.appendChild(this.statusDot);

    this.badge = document.createElement('div');
    this.badge.style.cssText = [
      'display:none',
      'background:#3b82f6',
      'color:#fff',
      'font-size:11px',
      'font-family:system-ui,sans-serif',
      'font-weight:600',
      'border-radius:10px',
      'padding:1px 6px',
      'line-height:16px',
    ].join(';');
    bottomRow.appendChild(this.badge);

    this.el.appendChild(bottomRow);

    // Drag behavior
    this.initDrag();

    shadowRoot.appendChild(this.el);
  }

  private createModeButton(mode: ImprovMode): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.dataset['mode'] = mode;
    btn.title = LABELS[mode];
    btn.style.cssText = [
      'width:36px',
      'height:36px',
      'border:none',
      'background:transparent',
      'border-radius:8px',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:0',
      'transition:background 120ms ease',
      'color:#aaa',
    ].join(';');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', ICONS[mode]);
    svg.appendChild(pathEl);
    btn.appendChild(svg);

    btn.addEventListener('click', () => {
      const next = this.activeMode === mode ? null : mode;
      this.setActiveMode(next);
      this.modeCallbacks.forEach((cb) => cb(next));
    });

    btn.addEventListener('mouseenter', () => {
      if (this.activeMode !== mode) {
        btn.style.background = 'rgba(255,255,255,0.07)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (this.activeMode !== mode) {
        btn.style.background = 'transparent';
      }
    });

    return btn;
  }

  private initDrag(): void {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origRight = 20;
    let origBottom = 20;

    this.el.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origRight = parseInt(this.el.style.right || '20', 10);
      origBottom = parseInt(this.el.style.bottom || '20', 10);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.el.style.right = `${origRight - dx}px`;
      this.el.style.bottom = `${origBottom - dy}px`;
    });

    document.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

  setActiveMode(mode: ImprovMode | null): void {
    this.activeMode = mode;
    this.buttons.forEach((btn, m) => {
      if (m === mode) {
        btn.style.background = 'rgba(59,130,246,0.25)';
        btn.style.color = '#3b82f6';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#aaa';
      }
    });
  }

  getActiveMode(): ImprovMode | null {
    return this.activeMode;
  }

  onMode(callback: ModeCallback): void {
    this.modeCallbacks.push(callback);
  }

  onApply(callback: ApplyCallback): void {
    this.applyCallbacks.push(callback);
  }

  setConnected(connected: boolean): void {
    this.statusDot.style.background = connected ? '#22c55e' : '#ef4444';
  }

  setBadge(count: number): void {
    if (count > 0) {
      this.badge.style.display = 'block';
      this.badge.textContent = String(count);
      this.applyBtn.style.display = 'block';
      this.applyBtn.textContent = `Apply (${count})`;
    } else {
      this.badge.style.display = 'none';
      this.badge.textContent = '';
      this.applyBtn.style.display = 'none';
    }
  }

  destroy(): void {
    this.el.remove();
  }
}
