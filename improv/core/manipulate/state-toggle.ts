type StateToggleCallback = (state: string, active: boolean) => void;

type PseudoState = 'hover' | 'focus' | 'active' | 'visited';

interface PillButton {
  el: HTMLButtonElement;
  state: PseudoState;
  active: boolean;
}

const STATE_LABELS: Record<PseudoState, string> = {
  hover: 'H',
  focus: 'F',
  active: 'A',
  visited: 'V',
};

const STATES: PseudoState[] = ['hover', 'focus', 'active', 'visited'];

export class StateToggle {
  private container: HTMLDivElement;
  private pills: PillButton[] = [];
  private toggleCallback: StateToggleCallback | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = [
      'display: flex',
      'gap: 4px',
      'padding: 8px 12px',
      'border-bottom: 1px solid #2a2a3e',
    ].join(';');

    for (const state of STATES) {
      const btn = document.createElement('button');
      btn.textContent = STATE_LABELS[state];
      btn.title = state;

      this.applyPillStyle(btn, false);

      const pill: PillButton = { el: btn, state, active: false };

      const onClick = () => {
        pill.active = !pill.active;
        this.applyPillStyle(btn, pill.active);
        this.toggleCallback?.(state, pill.active);
      };

      btn.addEventListener('click', onClick);
      this.container.appendChild(btn);
      this.pills.push(pill);
    }
  }

  private applyPillStyle(btn: HTMLButtonElement, active: boolean): void {
    btn.style.cssText = [
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'width: 28px',
      'height: 22px',
      'border-radius: 5px',
      'border: none',
      'font-size: 10px',
      'font-weight: 600',
      'font-family: "Fira Sans", system-ui, sans-serif',
      'cursor: pointer',
      'letter-spacing: 0.02em',
      'transition: background 0.12s, color 0.12s',
      active
        ? 'background: #3b82f6; color: #fff;'
        : 'background: #2a2a3e; color: #888;',
    ].join(';');
  }

  render(): HTMLDivElement {
    return this.container;
  }

  onToggle(callback: StateToggleCallback): void {
    this.toggleCallback = callback;
  }

  getActiveStates(): string[] {
    return this.pills.filter((p) => p.active).map((p) => p.state);
  }

  destroy(): void {
    this.toggleCallback = null;
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.pills = [];
  }
}
