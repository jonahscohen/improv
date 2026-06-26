// sidecoach/src/__tests__/referee-independence.test.ts
//
// EVAL-INTEGRITY GUARD (Stage 1): the PRODUCT objective scanner must be a DISTINCT artifact from the eval
// ground-truth REFEREE (eval/objective-label-rendered.mjs). If the product ever imported the referee, the
// scorecard would go circular (product measured against its own code => trivial 1.0) and the whole baseline
// foundation would be worthless. This test mechanically walks the product scanner's TRANSITIVE import graph
// (within src/) and asserts NO module reaches anything under eval/ or references the referee by name.
//
// Both product and referee may draw on the same PUBLIC specs (WCAG / CSS Color 4); they must NOT share code.
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');
const ENTRY = path.join(SRC, 'validators', 'objective-rendered-scanner.ts');

// Extract every import/export-from/dynamic-import/require specifier from a source file.
function specifiersOf(code: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)\s+(?:[^'"`]*?\sfrom\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) { const s = m[1] || m[2] || m[3]; if (s) specs.push(s); }
  return specs;
}

// Resolve a RELATIVE specifier to an on-disk src/ file (.ts / .js / dir index). Non-relative (node builtins,
// playwright, packages) are returned as null - they cannot reach eval/.
function resolveRelative(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const cands = [base, base + '.ts', base + '.js', base + '.mjs', path.join(base, 'index.ts'), path.join(base, 'index.js')];
  for (const c of cands) { if (existsSync(c) && statSync(c).isFile()) return c; }
  return base; // unresolved relative path - still subject to the eval/ check below
}

function run(): void {
  if (!existsSync(ENTRY)) throw new Error(`scanner entry not found: ${ENTRY}`);
  const seen = new Set<string>();
  const queue = [ENTRY];
  const violations: string[] = [];

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = readFileSync(file, 'utf8');
    for (const spec of specifiersOf(code)) {
      // Direct red flags: any specifier that names eval/ or the referee module.
      const norm = spec.replace(/\\/g, '/');
      if (/(^|\/)eval\//.test(norm) || /objective-label-rendered/.test(norm) || /objective-label\.mjs/.test(norm)) {
        violations.push(`${path.relative(SRC, file)} imports "${spec}"`);
        continue;
      }
      const resolved = resolveRelative(file, spec);
      if (!resolved) continue; // node/package import - cannot reach eval/
      const rel = path.relative(SRC, resolved).replace(/\\/g, '/');
      // A resolved path that escapes src/ into eval/ is a violation.
      if (rel.startsWith('..') && /(^|\/)eval(\/|$)/.test(path.relative(path.dirname(SRC), resolved).replace(/\\/g, '/'))) {
        violations.push(`${path.relative(SRC, file)} imports "${spec}" -> ${resolved} (outside src/, into eval/)`);
        continue;
      }
      if (resolved.startsWith(SRC + path.sep)) queue.push(resolved);
    }
  }

  if (violations.length) {
    throw new Error(`referee-independence VIOLATED - product scanner reaches eval/ ground truth:\n  ${violations.join('\n  ')}`);
  }
  console.log(`referee-independence: OK (${seen.size} product module(s) in the objective-scanner graph, zero eval/ imports)`);
}

run();
