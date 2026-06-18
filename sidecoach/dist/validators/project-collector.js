"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionAbortedError = void 0;
exports.collectFromPath = collectFromPath;
exports.collect = collect;
// sidecoach/src/validators/project-collector.ts
//
// Recursive project discovery driven by the ONE shared source-support matrix.
// Returns discovered, inspected, policy-skipped, unreadable, oversized, and
// unsupported files. A root read/stat failure throws (validator-level error
// path); per-file gaps remain in `discovered`, never silently dropped.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const source_support_matrix_1 = require("./source-support-matrix");
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git']);
const MAX_BYTES = 2 * 1024 * 1024;
// Thrown when an AbortSignal fires DURING collection (between directory entries or file
// reads). Distinct from a real collection failure so the caller maps it to an aborted
// validator result rather than unreadable_input.
class CollectionAbortedError extends Error {
    constructor() { super('collection aborted (lease lost / cancelled)'); this.name = 'CollectionAbortedError'; }
}
exports.CollectionAbortedError = CollectionAbortedError;
// Cooperative yield to the EVENT LOOP (macrotask via setImmediate) so setInterval timers
// - notably the lease heartbeat - keep firing during a large/slow collection. A
// microtask (Promise.resolve) would NOT let timers run.
function yieldToEventLoop() { return new Promise((r) => setImmediate(r)); }
// Root read/stat failure throws. Nested failures are recorded, never discarded. Yields +
// re-checks the signal BETWEEN directory entries so a large tree cannot block the event
// loop or starve the heartbeat/abort.
async function walk(root, dir, discovered, signal) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        if (signal?.aborted)
            throw new CollectionAbortedError();
        await yieldToEventLoop();
        const abs = path.join(dir, e.name);
        const rel = path.relative(root, abs);
        if (e.isDirectory()) {
            if (e.name.startsWith('.') || SKIP_DIR.has(e.name)) {
                discovered.push({ path: rel, sourceKind: 'directory', outcome: 'policy_skipped', reason: 'excluded_directory' });
                continue;
            }
            try {
                await walk(root, abs, discovered, signal);
            }
            catch (err) {
                if (err instanceof CollectionAbortedError)
                    throw err; // abort must propagate, not be recorded as unreadable
                discovered.push({ path: rel, sourceKind: 'directory', outcome: 'unreadable', reason: 'readdir_failed' });
            }
        }
        else if (e.isFile()) {
            const kind = (0, source_support_matrix_1.sourceKindForPath)(abs);
            discovered.push({
                path: rel,
                sourceKind: kind ?? `extension:${path.extname(abs).toLowerCase() || '<none>'}`,
                outcome: kind && (0, source_support_matrix_1.isCollectableSourceKind)(kind) ? 'inspected' : 'unsupported',
            });
        }
    }
}
async function collectFromPath(projectPath, signal) {
    // Missing/unreadable root is a validator-level collection failure and throws.
    fs.statSync(projectPath);
    const discovered = [];
    await walk(projectPath, projectPath, discovered, signal);
    const files = [];
    for (const d of discovered.filter((x) => x.outcome === 'inspected')) {
        // Yield + re-check the signal BETWEEN file reads so a many-file collection cannot
        // block the event loop or delay abort.
        if (signal?.aborted)
            throw new CollectionAbortedError();
        await yieldToEventLoop();
        const abs = path.join(projectPath, d.path);
        try {
            if (fs.statSync(abs).size > MAX_BYTES) {
                d.outcome = 'oversized';
                d.reason = 'over_2mb';
                continue;
            }
            const content = fs.readFileSync(abs, 'utf-8');
            const kind = d.sourceKind;
            const isCss = kind === 'css' || kind === 'scss' || kind === 'less';
            files.push({
                path: d.path, sourceKind: kind,
                cssText: isCss ? content : extractInlineCss(content),
                markup: isCss ? '' : content,
                evidenceKindsPresent: [kind],
            });
        }
        catch {
            d.outcome = 'unreadable';
            d.reason = 'stat_or_read_failed';
        }
    }
    return assemble(discovered, files);
}
function extractInlineCss(html) {
    let out = '';
    for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
        out += '\n' + m[1];
    return out;
}
function assemble(discovered, files) {
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
async function collect(context, signal) {
    const c = context;
    if (c && Array.isArray(c.files)) {
        // In-memory context (unit tests): no IO, assemble verbatim - nothing to yield on.
        const discovered = c.discoveredFiles ?? c.files.map((f) => ({ path: f.path, sourceKind: f.sourceKind, outcome: 'inspected' }));
        return assemble(discovered, c.files);
    }
    if (c && typeof c.projectPath === 'string')
        return collectFromPath(c.projectPath, signal);
    return { discovered: [], files: [], inspectedFiles: [], skippedFiles: [], unreadableFiles: [], unsupportedFiles: [], cssText: '', markup: '' };
}
//# sourceMappingURL=project-collector.js.map