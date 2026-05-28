import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, extname } from 'path';
import chokidar from 'chokidar';
import type { ComponentInfo } from './types.js';

const COMPONENT_DIRS = [
  'components',
  'ui',
  'lib',
  'src/components',
  'src/ui',
];

const COMPONENT_EXTENSIONS = new Set(['.tsx', '.jsx', '.vue', '.svelte']);

export class ComponentScanner {
  scanProject(projectRoot: string): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    // Parse DESIGN.md if present
    const designMdPath = join(projectRoot, 'DESIGN.md');
    if (existsSync(designMdPath)) {
      const designComponents = this.parseDesignMd(designMdPath);
      components.push(...designComponents);
    }

    // Scan known component directories
    const seenNames = new Set(components.map((c) => c.name));

    for (const dirName of COMPONENT_DIRS) {
      const dirPath = join(projectRoot, dirName);
      if (!existsSync(dirPath)) continue;

      const found = this.scanDirectory(dirPath);
      for (const info of found) {
        if (!seenNames.has(info.name)) {
          seenNames.add(info.name);
          components.push(info);
        }
      }
    }

    return components;
  }

  watch(projectRoot: string, onChange: (components: ComponentInfo[]) => void): void {
    const watchDirs = COMPONENT_DIRS.map((d) => join(projectRoot, d)).filter(existsSync);

    if (watchDirs.length === 0) return;

    const watcher = chokidar.watch(watchDirs, {
      ignoreInitial: true,
      ignored: /(node_modules|\.git|dist)/,
    });

    const rescan = () => {
      onChange(this.scanProject(projectRoot));
    };

    watcher.on('add', rescan);
    watcher.on('unlink', rescan);
    watcher.on('change', rescan);
  }

  private parseDesignMd(filePath: string): ComponentInfo[] {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return [];
    }

    const components: ComponentInfo[] = [];
    const lines = content.split('\n');
    let inComponentsSection = false;

    for (const line of lines) {
      if (/^##\s+Components/i.test(line)) {
        inComponentsSection = true;
        continue;
      }

      // Stop at the next ## heading
      if (inComponentsSection && /^##\s/.test(line)) {
        break;
      }

      if (inComponentsSection) {
        // Extract component names from lines like "- Button", "### Button", "**Card**"
        const match = line.match(/(?:^[-*]\s+|\*\*|###?\s+)([A-Z][A-Za-z0-9]+)/);
        if (match) {
          components.push({
            name: match[1],
            category: 'project',
            source: 'project',
          });
        }
      }
    }

    return components;
  }

  private scanDirectory(dir: string): ComponentInfo[] {
    const results: ComponentInfo[] = [];

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.startsWith('.')) continue;

      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        results.push(...this.scanDirectory(fullPath));
      } else {
        const ext = extname(entry);
        if (!COMPONENT_EXTENSIONS.has(ext)) continue;

        const name = this.toPascalCase(basename(entry, ext));
        if (!name) continue;

        results.push({
          name,
          category: 'project',
          source: 'project',
          filePath: fullPath,
        });
      }
    }

    return results;
  }

  private toPascalCase(filename: string): string {
    // If already PascalCase (starts with uppercase), return as-is
    if (/^[A-Z]/.test(filename)) return filename;

    // Convert kebab-case or snake_case to PascalCase
    return filename
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
}
