import { PendingChange } from './types.js';

export class ChangeBuffer {
  private changes: Map<string, PendingChange> = new Map();
  private nextId = 1;

  add(selector: string, property: string, oldValue: string, newValue: string): string {
    const key = `${selector}::${property}`;
    const existing = this.changes.get(key);

    if (existing) {
      this.changes.set(key, { ...existing, newValue });
      return existing.id;
    }

    const id = `change-${this.nextId++}`;
    this.changes.set(key, {
      id,
      selector,
      property,
      oldValue,
      newValue,
      timestamp: Date.now(),
    });
    return id;
  }

  remove(id: string): void {
    for (const [key, change] of this.changes) {
      if (change.id === id) {
        this.changes.delete(key);
        return;
      }
    }
  }

  getAll(): PendingChange[] {
    return Array.from(this.changes.values());
  }

  flush(): PendingChange[] {
    const all = this.getAll();
    this.changes.clear();
    return all;
  }

  count(): number {
    return this.changes.size;
  }

  clear(): void {
    this.changes.clear();
  }
}
