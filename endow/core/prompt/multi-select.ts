export interface SelectedElement {
  domNode: Element;
  selector: string;
  tagName: string;
  textContent: string;
  classes: string[];
  computedStyles: Record<string, string>;
  boundingBox: DOMRect;
  adapterData: any[];
}

export class MultiSelect {
  items: SelectedElement[] = [];

  add(e: SelectedElement) {
    this.items.push(e);
  }

  remove(e: SelectedElement) {
    this.items = this.items.filter(t => t.domNode !== e.domNode);
  }

  toggle(e: SelectedElement) {
    this.items.some(n => n.domNode === e.domNode) ? this.remove(e) : this.add(e);
  }

  clear() {
    this.items = [];
  }

  getAll(): SelectedElement[] {
    return [...this.items];
  }

  count(): number {
    return this.items.length;
  }
}
