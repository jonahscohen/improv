let freezeSheet: CSSStyleSheet | null = null;
let enabled = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function _impSelBlock(e: Event): void {
  e.preventDefault();
}

export function enableEventIntercept(): void {
  if (enabled) return;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(
    'html { pointer-events: none !important; user-select: none !important; -webkit-user-select: none !important; }\n' +
    '[data-improv] { pointer-events: auto !important; }'
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  freezeSheet = sheet;
  enabled = true;
  document.addEventListener('selectstart', _impSelBlock, true);
}

export function disableEventIntercept(): void {
  if (!enabled || freezeSheet === null) return;

  document.removeEventListener('selectstart', _impSelBlock, true);
  const target = freezeSheet;
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
    (s) => s !== target,
  );
  freezeSheet = null;
  enabled = false;
}

export function getElementAtPoint(x: number, y: number): HTMLElement | null {
  if (freezeSheet !== null) {
    freezeSheet.disabled = true;

    const el = document.elementFromPoint(x, y) as HTMLElement | null;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (freezeSheet !== null) {
        freezeSheet.disabled = false;
      }
    }, 100);

    return el;
  }

  return document.elementFromPoint(x, y) as HTMLElement | null;
}

export function isInterceptEnabled(): boolean {
  return enabled;
}
