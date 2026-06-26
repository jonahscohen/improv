"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/referee-independence.test.ts
//
// EVAL-INTEGRITY GUARD (Stage 1): the PRODUCT objective scanner must be a DISTINCT artifact from the eval
// ground-truth REFEREE (eval/objective-label-rendered.mjs). If the product ever imported the referee, the
// scorecard would go circular (product measured against its own code => trivial 1.0) and the whole baseline
// foundation would be worthless. This test mechanically walks the product scanner's TRANSITIVE import graph
// (within src/) and asserts NO module reaches anything under eval/ or references the referee by name.
//
// Both product and referee may draw on the same PUBLIC specs (WCAG / CSS Color 4); they must NOT share code.
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const SRC = node_path_1.default.resolve(__dirname, '..');
const ENTRY = node_path_1.default.join(SRC, 'validators', 'objective-rendered-scanner.ts');
// Extract every import/export-from/dynamic-import/require specifier from a source file.
function specifiersOf(code) {
    const specs = [];
    const re = /(?:import|export)\s+(?:[^'"`]*?\sfrom\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(code))) {
        const s = m[1] || m[2] || m[3];
        if (s)
            specs.push(s);
    }
    return specs;
}
// Resolve a RELATIVE specifier to an on-disk src/ file (.ts / .js / dir index). Non-relative (node builtins,
// playwright, packages) are returned as null - they cannot reach eval/.
function resolveRelative(fromFile, spec) {
    if (!spec.startsWith('.'))
        return null;
    const base = node_path_1.default.resolve(node_path_1.default.dirname(fromFile), spec);
    const cands = [base, base + '.ts', base + '.js', base + '.mjs', node_path_1.default.join(base, 'index.ts'), node_path_1.default.join(base, 'index.js')];
    for (const c of cands) {
        if ((0, node_fs_1.existsSync)(c) && (0, node_fs_1.statSync)(c).isFile())
            return c;
    }
    return base; // unresolved relative path - still subject to the eval/ check below
}
function run() {
    if (!(0, node_fs_1.existsSync)(ENTRY))
        throw new Error(`scanner entry not found: ${ENTRY}`);
    const seen = new Set();
    const queue = [ENTRY];
    const violations = [];
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file))
            continue;
        seen.add(file);
        const code = (0, node_fs_1.readFileSync)(file, 'utf8');
        for (const spec of specifiersOf(code)) {
            // Direct red flags: any specifier that names eval/ or the referee module.
            const norm = spec.replace(/\\/g, '/');
            if (/(^|\/)eval\//.test(norm) || /objective-label-rendered/.test(norm) || /objective-label\.mjs/.test(norm)) {
                violations.push(`${node_path_1.default.relative(SRC, file)} imports "${spec}"`);
                continue;
            }
            const resolved = resolveRelative(file, spec);
            if (!resolved)
                continue; // node/package import - cannot reach eval/
            const rel = node_path_1.default.relative(SRC, resolved).replace(/\\/g, '/');
            // A resolved path that escapes src/ into eval/ is a violation.
            if (rel.startsWith('..') && /(^|\/)eval(\/|$)/.test(node_path_1.default.relative(node_path_1.default.dirname(SRC), resolved).replace(/\\/g, '/'))) {
                violations.push(`${node_path_1.default.relative(SRC, file)} imports "${spec}" -> ${resolved} (outside src/, into eval/)`);
                continue;
            }
            if (resolved.startsWith(SRC + node_path_1.default.sep))
                queue.push(resolved);
        }
    }
    if (violations.length) {
        throw new Error(`referee-independence VIOLATED - product scanner reaches eval/ ground truth:\n  ${violations.join('\n  ')}`);
    }
    console.log(`referee-independence: OK (${seen.size} product module(s) in the objective-scanner graph, zero eval/ imports)`);
}
run();
//# sourceMappingURL=referee-independence.test.js.map