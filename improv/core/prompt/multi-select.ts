import type { SelectedElement } from '../types.js';

export class MultiSelect {
  private items: SelectedElement[] = [];

  add(el: SelectedElement): void {
    this.items.push(el);
  }

  remove(el: SelectedElement): void {
    this.items = this.items.filter((item) => item.domNode !== el.domNode);
  }

  toggle(el: SelectedElement): void {
    const exists = this.items.some((item) => item.domNode === el.domNode);
    if (exists) {
      this.remove(el);
    } else {
      this.add(el);
    }
  }

  clear(): void {
    this.items = [];
  }

  getAll(): SelectedElement[] {
    return [...this.items];
  }

  count(): number {
    return this.items.length;
  }
}
