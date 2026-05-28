export interface ScrubOptions {
  initialValue: number;
  step: number;
  onUpdate: (value: number) => void;
  onCommit: (value: number) => void;
}

export function attachScrub(element: HTMLElement, options: ScrubOptions): () => void {
  let dragging = false;
  let startX = 0;
  let startValue = 0;

  function onMouseDown(event: MouseEvent): void {
    dragging = true;
    startX = event.clientX;
    startValue = options.initialValue;
    document.body.style.cursor = 'ew-resize';
    event.preventDefault();
  }

  function onMouseMove(event: MouseEvent): void {
    if (!dragging) return;

    const dx = event.clientX - startX;
    let effectiveStep = options.step;
    if (event.shiftKey) {
      effectiveStep = options.step * 10;
    } else if (event.altKey) {
      effectiveStep = options.step * 0.1;
    }

    const steps = Math.round(dx / 2);
    const newValue = Math.round((startValue + steps * effectiveStep) * 1000) / 1000;
    options.onUpdate(newValue);
  }

  function onMouseUp(event: MouseEvent): void {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';

    const dx = event.clientX - startX;
    let effectiveStep = options.step;
    if (event.shiftKey) {
      effectiveStep = options.step * 10;
    } else if (event.altKey) {
      effectiveStep = options.step * 0.1;
    }

    const steps = Math.round(dx / 2);
    const commitValue = Math.round((startValue + steps * effectiveStep) * 1000) / 1000;
    options.onCommit(commitValue);
  }

  element.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  return function cleanup(): void {
    element.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}

export function parseNumericValue(value: string): { number: number; unit: string } | null {
  const match = value.trim().match(/^(-?[\d.]+)(px|rem|em|%|vw|vh|pt|ch|ex)?$/);
  if (!match) return null;
  return {
    number: parseFloat(match[1]),
    unit: match[2] ?? '',
  };
}

export function formatNumericValue(num: number, unit: string): string {
  return `${num}${unit}`;
}
