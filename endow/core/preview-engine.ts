interface Change {
  selector: string;
  property: string;
  newValue: string;
}

export class PreviewEngine {
  private changes = new Map<string, Change>();
  private sheet: CSSStyleSheet | null = null;
  private attached = false;

  applyChange(selector: string, property: string, value: string): void {
    const key = `${selector}::${property}`;
    this.changes.set(key, { selector, property, newValue: value });
    this.rebuildSheet();
  }

  removeChange(selector: string, property: string): void {
    const key = `${selector}::${property}`;
    this.changes.delete(key);
    this.rebuildSheet();
  }

  clearAll(): void {
    this.changes.clear();
    this.rebuildSheet();
  }

  getChanges(): Change[] {
    return Array.from(this.changes.values());
  }

  generateCSS(): string {
    const bySelector = new Map<string, Map<string, string>>();

    for (const { selector, property, newValue } of this.changes.values()) {
      if (!bySelector.has(selector)) {
        bySelector.set(selector, new Map());
      }
      bySelector.get(selector)!.set(property, newValue);
    }

    const rules: string[] = [];
    for (const [selector, props] of bySelector) {
      const declarations = Array.from(props.entries())
        .map(([prop, val]) => `  ${prop}: ${val} !important;`)
        .join('\n');
      rules.push(`${selector} {\n${declarations}\n}`);
    }

    return rules.join('\n');
  }

  attach(): void {
    if (this.attached) return;
    this.sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.sheet];
    this.attached = true;
    this.rebuildSheet();
  }

  detach(): void {
    if (!this.sheet) return;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== this.sheet
    );
    this.sheet = null;
    this.attached = false;
  }

  changeCount(): number {
    return this.changes.size;
  }

  private rebuildSheet(): void {
    if (!this.sheet) return;
    this.sheet.replaceSync(this.generateCSS());
  }
}
