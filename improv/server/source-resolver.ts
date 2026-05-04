import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { StyleChange, SourceLocation } from './types.js';

export class SourceResolver {
  constructor(public readonly projectRoot: string) {}

  async resolve(change: StyleChange): Promise<SourceLocation | null> {
    if (change.cssomData) {
      const location = this.resolveFromCssom(change.cssomData);
      if (location) return location;
    }
    return this.resolveFromGrep(change.selector, change.property);
  }

  private resolveFromCssom(cssomData: NonNullable<StyleChange['cssomData']>): SourceLocation | null {
    const { stylesheetHref, ruleSelector } = cssomData;
    if (!stylesheetHref) return null;

    // Parse the href to a file path
    let filePath: string;
    try {
      const url = new URL(stylesheetHref);
      filePath = join(this.projectRoot, url.pathname);
    } catch {
      // Not a valid URL - treat as relative path
      filePath = join(this.projectRoot, stylesheetHref);
    }

    if (!existsSync(filePath)) return null;

    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(ruleSelector)) {
        return {
          filePath,
          line: i + 1,
          ruleSelector,
        };
      }
    }

    return { filePath, line: 1, ruleSelector };
  }

  private resolveFromGrep(selector: string, property: string): SourceLocation | null {
    const cssExtensions = new Set(['.css', '.scss', '.sass', '.less']);
    const files = this.collectStyleFiles(this.projectRoot, cssExtensions);

    for (const filePath of files) {
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }

      const lines = content.split('\n');
      let inMatchingRule = false;
      let ruleStartLine = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!inMatchingRule && line.includes(selector)) {
          inMatchingRule = true;
          ruleStartLine = i + 1;
        }

        if (inMatchingRule && line.includes(property)) {
          return {
            filePath,
            line: i + 1,
            ruleSelector: selector,
          };
        }

        // Reset if we encounter a closing brace (end of rule block)
        if (inMatchingRule && line.includes('}')) {
          inMatchingRule = false;
          ruleStartLine = -1;
        }
      }
    }

    return null;
  }

  private collectStyleFiles(dir: string, extensions: Set<string>): string[] {
    const results: string[] = [];

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }

    for (const entry of entries) {
      // Skip hidden directories, node_modules, dist
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') {
        continue;
      }

      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        results.push(...this.collectStyleFiles(fullPath, extensions));
      } else {
        const dotIdx = entry.lastIndexOf('.');
        if (dotIdx !== -1) {
          const ext = entry.slice(dotIdx);
          if (extensions.has(ext)) {
            results.push(fullPath);
          }
        }
      }
    }

    return results;
  }
}
