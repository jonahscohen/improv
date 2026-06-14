// sidecoach/src/validators/project-collector.ts
//
// Recursive project discovery driven by the ONE shared source-support matrix.
// Returns discovered, inspected, policy-skipped, unreadable, oversized, and
// unsupported files. A root read/stat failure throws (validator-level error
// path); per-file gaps remain in `discovered`, never silently dropped.
import * as fs from 'fs';
import * as path from 'path';
import type { CollectedFile, DiscoveredFile, ProductCheckContext } from './check-context';
import { sourceKindForPath, isCollectableSourceKind } from './source-support-matrix';

const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git']);
const MAX_BYTES = 2 * 1024 * 1024;

// Root read/stat failure throws. Nested failures are recorded, never discarded.
function walk(root: string, dir: string, discovered: DiscoveredFile[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(root, abs);
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || SKIP_DIR.has(e.name)) {
        discovered.push({ path: rel, sourceKind: 'directory', outcome: 'policy_skipped', reason: 'excluded_directory' });
        continue;
      }
      try { walk(root, abs, discovered); }
      catch { discovered.push({ path: rel, sourceKind: 'directory', outcome: 'unreadable', reason: 'readdir_failed' }); }
    } else if (e.isFile()) {
      const kind = sourceKindForPath(abs);
      discovered.push({
        path: rel,
        sourceKind: kind ?? `extension:${path.extname(abs).toLowerCase() || '<none>'}`,
        outcome: kind && isCollectableSourceKind(kind) ? 'inspected' : 'unsupported',
      });
    }
  }
}

export interface Collected {
  discovered: DiscoveredFile[];
  files: CollectedFile[];
  inspectedFiles: string[];
  skippedFiles: string[];
  unreadableFiles: string[];
  unsupportedFiles: string[];
  cssText: string;
  markup: string;
}

export function collectFromPath(projectPath: string): Collected {
  // Missing/unreadable root is a validator-level collection failure and throws.
  fs.statSync(projectPath);
  const discovered: DiscoveredFile[] = [];
  walk(projectPath, projectPath, discovered);
  const files: CollectedFile[] = [];
  for (const d of discovered.filter((x) => x.outcome === 'inspected')) {
    const abs = path.join(projectPath, d.path);
    try {
      if (fs.statSync(abs).size > MAX_BYTES) { d.outcome = 'oversized'; d.reason = 'over_2mb'; continue; }
      const content = fs.readFileSync(abs, 'utf-8');
      const kind = d.sourceKind;
      const isCss = kind === 'css' || kind === 'scss' || kind === 'less';
      files.push({
        path: d.path, sourceKind: kind,
        cssText: isCss ? content : extractInlineCss(content),
        markup: isCss ? '' : content,
        evidenceKindsPresent: [kind],
      });
    } catch { d.outcome = 'unreadable'; d.reason = 'stat_or_read_failed'; }
  }
  return assemble(discovered, files);
}

function extractInlineCss(html: string): string {
  let out = '';
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) out += '\n' + m[1];
  return out;
}

function assemble(discovered: DiscoveredFile[], files: CollectedFile[]): Collected {
  return {
    discovered,
    files,
    inspectedFiles: discovered.filter((d) => d.outcome === 'inspected').map((d) => d.path),
    skippedFiles: discovered.filter((d) => d.outcome === 'policy_skipped' || d.outcome === 'oversized' || d.outcome === 'unreadable').map((d) => d.path),
    unreadableFiles: discovered.filter((d) => d.outcome === 'unreadable').map((d) => d.path),
    unsupportedFiles: discovered.filter((d) => d.outcome === 'unsupported').map((d) => d.path),
    cssText: files.map((f) => f.cssText).filter(Boolean).join('\n'),
    markup: files.map((f) => f.markup).filter(Boolean).join('\n'),
  };
}

// Normalize whatever validateProduct received into a Collected. An in-memory
// context (unit tests) is used verbatim; a { projectPath } is walked. A context
// with NEITHER yields an empty collection (-> required rules inconclusive).
export function collect(context: unknown): Collected {
  const c = context as Partial<ProductCheckContext> & { projectPath?: string };
  if (c && Array.isArray(c.files)) {
    const discovered: DiscoveredFile[] = c.discoveredFiles ?? c.files.map((f) => ({ path: f.path, sourceKind: f.sourceKind, outcome: 'inspected' as const }));
    return assemble(discovered, c.files as CollectedFile[]);
  }
  if (c && typeof c.projectPath === 'string') return collectFromPath(c.projectPath);
  return { discovered: [], files: [], inspectedFiles: [], skippedFiles: [], unreadableFiles: [], unsupportedFiles: [], cssText: '', markup: '' };
}
