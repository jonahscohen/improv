export interface DetectedSection {
  element: HTMLElement;
  selector: string;
  label: string;
  rect: DOMRect;
}

type ReorderCallback = (sections: DetectedSection[]) => void;

function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .slice(0, 2)
    .map((c) => `.${CSS.escape(c)}`)
    .join('');
  return `${tag}${classes}`;
}

function deriveLabel(el: HTMLElement, index: number): string {
  if (el.id) return el.id;
  // Look for heading text in first 80 chars
  const h = el.querySelector('h1,h2,h3,h4,h5,h6');
  if (h?.textContent) return h.textContent.trim().slice(0, 40);
  const aria = el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby');
  if (aria) return aria.slice(0, 40);
  return `Section ${index + 1}`;
}

export class SectionDetector {
  private onReorder: ReorderCallback | null = null;
  private dragHandles: Map<HTMLElement, HTMLDivElement> = new Map();
  private sections: DetectedSection[] = [];

  detect(): DetectedSection[] {
    const root = document.querySelector('main') ?? document.body;
    const children = Array.from(root.children) as HTMLElement[];

    this.sections = children
      .filter((el) => {
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((el, i): DetectedSection => ({
        element: el,
        selector: buildSelector(el),
        label:    deriveLabel(el, i),
        rect:     el.getBoundingClientRect(),
      }));

    return this.sections;
  }

  enable(onReorder: ReorderCallback): void {
    this.onReorder = onReorder;
    this.sections  = this.detect();

    for (const section of this.sections) {
      this.attachHandle(section);
    }
  }

  private attachHandle(section: DetectedSection): void {
    const handle = document.createElement('div');
    handle.draggable = true;
    handle.dataset['sectionHandle'] = '';
    handle.style.position   = 'absolute';
    handle.style.top        = '4px';
    handle.style.right      = '4px';
    handle.style.width      = '20px';
    handle.style.height     = '20px';
    handle.style.background = '#6366f1';
    handle.style.borderRadius = '3px';
    handle.style.cursor     = 'grab';
    handle.style.zIndex     = '9998';
    handle.style.opacity    = '0.7';
    handle.title            = `Drag to reorder: ${section.label}`;

    // Position relative to the section
    const computedPos = getComputedStyle(section.element).position;
    if (computedPos === 'static') {
      section.element.style.position = 'relative';
    }

    section.element.appendChild(handle);
    this.dragHandles.set(section.element, handle);

    let dragSource: DetectedSection | null = null;

    handle.addEventListener('dragstart', (e: DragEvent) => {
      dragSource = section;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('endow/section', section.selector);
      }
    });

    section.element.addEventListener('dragover', (e: DragEvent) => {
      if (!dragSource || dragSource === section) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });

    section.element.addEventListener('drop', (e: DragEvent) => {
      if (!dragSource || dragSource === section) return;
      e.preventDefault();

      const fromIndex = this.sections.indexOf(dragSource);
      const toIndex   = this.sections.indexOf(section);
      if (fromIndex === -1 || toIndex === -1) return;

      // Reorder in DOM
      const parent = section.element.parentElement;
      if (!parent) return;

      if (fromIndex < toIndex) {
        parent.insertBefore(dragSource.element, section.element.nextSibling);
      } else {
        parent.insertBefore(dragSource.element, section.element);
      }

      // Update internal order
      this.sections.splice(fromIndex, 1);
      this.sections.splice(toIndex, 0, dragSource);
      dragSource = null;

      this.onReorder?.(this.sections);
    });
  }

  disable(): void {
    for (const [el, handle] of this.dragHandles) {
      handle.remove();
    }
    this.dragHandles.clear();
    this.onReorder = null;
  }
}
