interface SelectorToken {
  name: string;
  penalty: number;
  level?: number;
}

interface FinderOptions {
  root: Element | Document;
  idName: (name: string) => boolean;
  className: (name: string) => boolean;
  tagName: (name: string) => boolean;
  attr: (name: string, value: string) => boolean;
  seedMinLength: number;
  optimizedMinLength: number;
  threshold: number;
  maxNumberOfTries: number;
  timeoutMs: number | undefined;
}

type Penalty = SelectorToken[];

let config: FinderOptions;
let rootDocument: Document | Element;
let startTime: Date;

function finder(element: Element, options?: Partial<FinderOptions>): string {
  startTime = new Date();
  if (element.nodeType !== Node.ELEMENT_NODE)
    throw new Error("Can't generate CSS selector for non-element node type.");
  if (element.tagName.toLowerCase() === 'html') return 'html';

  const defaults: FinderOptions = {
    root: document.body,
    idName: (_name: string) => true,
    className: (_name: string) => true,
    tagName: (_name: string) => true,
    attr: (_name: string, _value: string) => false,
    seedMinLength: 1,
    optimizedMinLength: 2,
    threshold: 1000,
    maxNumberOfTries: 10000,
    timeoutMs: undefined as number | undefined,
  };

  config = { ...defaults, ...options };
  rootDocument = resolveRoot(config.root, defaults);

  const found = search(element, 'all', () =>
    search(element, 'two', () =>
      search(element, 'one', () =>
        search(element, 'none')
      )
    )
  );

  if (found) {
    const optimized = sortByPenalty(optimize(found, element));
    if (optimized.length > 0) return selectorToString(optimized[0]);
    return selectorToString(found);
  } else {
    throw new Error('Selector was not found.');
  }
}

function resolveRoot(root: Element | Document, defaults: FinderOptions): Document | Element {
  if (root.nodeType === Node.DOCUMENT_NODE) return root;
  if (root === defaults.root) return (root as Element).ownerDocument!;
  return root;
}

function search(
  element: Element,
  mode: 'all' | 'two' | 'one' | 'none',
  fallback?: () => Penalty | null
): Penalty | null {
  let found: Penalty | null = null;
  const stack: SelectorToken[][] = [];
  let current: Element | null = element;
  let level = 0;

  while (current) {
    const elapsed = new Date().getTime() - startTime.getTime();
    if (config.timeoutMs !== undefined && elapsed > config.timeoutMs)
      throw new Error(`Timeout: Can't find a unique selector after ${elapsed}ms`);

    let candidates =
      notEmpty(idToken(current)) ||
      notEmpty(...attrTokens(current)) ||
      notEmpty(...classTokens(current)) ||
      notEmpty(tagToken(current)) ||
      [wildcard()];

    const nthIndex = nthChild(current);

    if (mode === 'all') {
      if (nthIndex) {
        candidates = candidates.concat(
          candidates.filter(canAddNth).map((c) => addNth(c, nthIndex))
        );
      }
    } else if (mode === 'two') {
      candidates = candidates.slice(0, 1);
      if (nthIndex) {
        candidates = candidates.concat(
          candidates.filter(canAddNth).map((c) => addNth(c, nthIndex))
        );
      }
    } else if (mode === 'one') {
      const [first] = (candidates = candidates.slice(0, 1));
      if (nthIndex && canAddNth(first)) {
        candidates = [addNth(first, nthIndex)];
      }
    } else if (mode === 'none') {
      candidates = [wildcard()];
      if (nthIndex) {
        candidates = [addNth(candidates[0], nthIndex)];
      }
    }

    for (const c of candidates) c.level = level;

    stack.push(candidates);
    if (stack.length >= config.seedMinLength) {
      found = tryToFind(stack, fallback);
      if (found) break;
    }

    current = current.parentElement;
    level++;
  }

  if (!found) found = tryToFind(stack, fallback);
  if (!found && fallback) return fallback();
  return found;
}

function tryToFind(
  stack: SelectorToken[][],
  fallback?: () => Penalty | null
): Penalty | null {
  const candidates = sortByPenalty(combinations(stack));
  if (candidates.length > config.threshold) return fallback ? fallback() : null;
  for (const candidate of candidates) {
    if (isUnique(candidate)) return candidate;
  }
  return null;
}

function selectorToString(path: Penalty): string {
  let prev = path[0];
  let result = prev.name;
  for (let i = 1; i < path.length; i++) {
    const level = path[i].level || 0;
    if (prev.level === level - 1) {
      result = `${path[i].name} > ${result}`;
    } else {
      result = `${path[i].name} ${result}`;
    }
    prev = path[i];
  }
  return result;
}

function totalPenalty(path: Penalty): number {
  return path.map((t) => t.penalty).reduce((a, b) => a + b, 0);
}

function isUnique(path: Penalty): boolean {
  const sel = selectorToString(path);
  switch (rootDocument.querySelectorAll(sel).length) {
    case 0:
      throw new Error(`Can't select any node with this selector: ${sel}`);
    case 1:
      return true;
    default:
      return false;
  }
}

function idToken(el: Element): SelectorToken | null {
  const id = el.getAttribute('id');
  if (id && config.idName(id)) {
    return { name: '#' + CSS.escape(id), penalty: 0 };
  }
  return null;
}

function attrTokens(el: Element): SelectorToken[] {
  return Array.from(el.attributes)
    .filter((a) => config.attr(a.name, a.value))
    .map((a) => ({
      name: `[${CSS.escape(a.name)}="${CSS.escape(a.value)}"]`,
      penalty: 0.5,
    }));
}

function classTokens(el: Element): SelectorToken[] {
  return Array.from(el.classList)
    .filter(config.className)
    .map((c) => ({
      name: '.' + CSS.escape(c),
      penalty: 1,
    }));
}

function tagToken(el: Element): SelectorToken | null {
  const tag = el.tagName.toLowerCase();
  if (config.tagName(tag)) {
    return { name: tag, penalty: 2 };
  }
  return null;
}

function wildcard(): SelectorToken {
  return { name: '*', penalty: 3 };
}

function nthChild(el: Element): number | null {
  const parent = el.parentNode;
  if (!parent) return null;
  let child = parent.firstChild;
  if (!child) return null;
  let index = 0;
  while (child) {
    if (child.nodeType === Node.ELEMENT_NODE) index++;
    if (child === el) break;
    child = child.nextSibling;
  }
  return index;
}

function addNth(token: SelectorToken, index: number): SelectorToken {
  return {
    name: token.name + `:nth-child(${index})`,
    penalty: token.penalty + 1,
  };
}

function canAddNth(token: SelectorToken): boolean {
  return token.name !== 'html' && !token.name.startsWith('#');
}

function notEmpty(...tokens: (SelectorToken | null)[]): SelectorToken[] | null {
  const filtered = tokens.filter(isNotNull);
  return filtered.length > 0 ? filtered : null;
}

function isNotNull(token: SelectorToken | null): token is SelectorToken {
  return token != null;
}

function* combinations(
  stack: SelectorToken[][],
  path: SelectorToken[] = []
): Generator<Penalty> {
  if (stack.length > 0) {
    for (const token of stack[0]) {
      yield* combinations(stack.slice(1, stack.length), path.concat(token));
    }
  } else {
    yield path;
  }
}

function sortByPenalty(iter: Iterable<Penalty>): Penalty[] {
  return [...iter].sort((a, b) => totalPenalty(a) - totalPenalty(b));
}

function* optimize(
  path: Penalty,
  element: Element,
  state: { counter: number; visited: Map<string, boolean> } = {
    counter: 0,
    visited: new Map(),
  }
): Generator<Penalty> {
  if (path.length > 2 && path.length > config.optimizedMinLength) {
    for (let i = 1; i < path.length - 1; i++) {
      if (state.counter > config.maxNumberOfTries) return;
      state.counter += 1;
      const shortened = [...path];
      shortened.splice(i, 1);
      const sel = selectorToString(shortened);
      if (state.visited.has(sel)) return;
      if (isUnique(shortened) && matchesElement(shortened, element)) {
        yield shortened;
        state.visited.set(sel, true);
        yield* optimize(shortened, element, state);
      }
    }
  }
}

function matchesElement(path: Penalty, element: Element): boolean {
  return rootDocument.querySelector(selectorToString(path)) === element;
}

export function isDynamicClassName(className: string): boolean {
  if (/^_[a-zA-Z]/.test(className)) return true;
  if (className.startsWith('css-') || className.startsWith('sc-')) return true;
  if (
    /^[a-z]{1,3}[A-Za-z0-9]{8,}$/.test(className) &&
    /[A-Z0-9]/.test(className.slice(1))
  ) {
    return true;
  }
  return false;
}

export function filterClasses(classes: string[]): string[] {
  return classes.filter((cls) => !isDynamicClassName(cls));
}

function buildFallbackSelector(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (el) => el.tagName === current!.tagName
      );
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
    } else {
      parts.unshift(tag);
    }
    current = parent as HTMLElement | null;
  }

  return parts.join(' > ') || element.tagName.toLowerCase();
}

export function generateSelector(element: HTMLElement): string {
  try {
    return finder(element, {
      className: (name) => !isDynamicClassName(name),
    });
  } catch {
    return buildFallbackSelector(element);
  }
}

export function getElementPath(element: HTMLElement, maxDepth = 4): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && current !== document.body && depth < maxDepth) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : '';
    const rawClasses = Array.from(current.classList);
    const filteredClasses = filterClasses(rawClasses);
    const classStr = filteredClasses.length > 0 ? `.${filteredClasses.join('.')}` : '';
    parts.unshift(`${tag}${id}${classStr}`);
    current = current.parentElement as HTMLElement | null;
    depth++;
  }

  return parts.join(' > ');
}

const COMPUTED_STYLE_PROPERTIES = [
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
  'backgroundColor', 'color', 'opacity',
  'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign',
  'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap', 'flexWrap',
  'gridTemplateColumns', 'gridTemplateRows',
  'width', 'height', 'maxWidth', 'maxHeight', 'minWidth', 'minHeight',
  'position', 'top', 'right', 'bottom', 'left', 'zIndex',
  'boxShadow', 'objectFit', 'objectPosition', 'aspectRatio', 'overflow',
] as const;

const SKIP_VALUES = new Set(['none', 'normal', 'auto', '0px']);

export function getComputedStylesSubset(element: HTMLElement): Record<string, string> {
  const computed = getComputedStyle(element);
  const result: Record<string, string> = {};

  for (const prop of COMPUTED_STYLE_PROPERTIES) {
    const value = computed.getPropertyValue(
      prop.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
    );
    if (value && !SKIP_VALUES.has(value)) {
      result[prop] = value;
    }
  }

  return result;
}

export function getNearbyText(element: HTMLElement): string {
  const parent = element.parentElement;
  if (!parent) return '';

  const siblings = Array.from(parent.children).filter((el) => el !== element);
  return siblings
    .slice(0, 3)
    .map((el) => (el.textContent ?? '').trim().slice(0, 80))
    .filter((text) => text.length > 0)
    .join(' | ');
}

export function getAccessibilityInfo(element: HTMLElement): { role: string; label: string } {
  const role = element.getAttribute('role') ?? element.tagName.toLowerCase();

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return { role, label: ariaLabel };

  const labelledById = element.getAttribute('aria-labelledby');
  if (labelledById) {
    const labelEl = document.getElementById(labelledById);
    if (labelEl) return { role, label: (labelEl.textContent ?? '').trim() };
  }

  const title = element.getAttribute('title');
  if (title) return { role, label: title };

  const alt = element.getAttribute('alt');
  if (alt) return { role, label: alt };

  return { role, label: '' };
}
