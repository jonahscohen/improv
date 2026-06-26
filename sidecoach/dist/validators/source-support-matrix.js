"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_SOURCE_KINDS_BY_EVIDENCE = exports.SOURCE_KIND_BY_EXTENSION = void 0;
exports.supportedKindsFor = supportedKindsFor;
exports.sourceKindForPath = sourceKindForPath;
exports.isCollectableSourceKind = isCollectableSourceKind;
// Extension -> source kind. The ONLY place file extensions map to source kinds.
exports.SOURCE_KIND_BY_EXTENSION = {
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'scss',
    '.less': 'less',
    '.html': 'html',
    '.htm': 'html',
    '.tsx': 'tsx',
    '.jsx': 'jsx',
    '.vue': 'vue',
    '.svelte': 'svelte',
};
// Evidence requirement -> the supported source-kind block. The ONLY support list.
// Browser-only evidence (computed-style / dom / contrast) lists the browser kind
// at level 'full' plus the static kinds at level 'none' (a placeholder declaring
// "owned but no static source can satisfy this") so the generator's static-
// satisfiability derivation stays well-defined.
exports.SUPPORTED_SOURCE_KINDS_BY_EVIDENCE = {
    'css-rule': [
        { kind: 'css', level: 'full' },
        { kind: 'scss', level: 'full' },
        { kind: 'less', level: 'full' },
        { kind: 'tsx', level: 'partial' },
        { kind: 'html', level: 'partial' },
    ],
    'markup': [
        { kind: 'html', level: 'full' },
        { kind: 'tsx', level: 'partial' },
        { kind: 'jsx', level: 'partial' },
        { kind: 'vue', level: 'partial' },
        { kind: 'svelte', level: 'partial' },
    ],
    'computed-style': [
        { kind: 'computed-style', level: 'full' },
        { kind: 'tsx', level: 'none' },
        { kind: 'html', level: 'none' },
    ],
    'dom': [
        { kind: 'dom', level: 'full' },
        { kind: 'tsx', level: 'none' },
        { kind: 'html', level: 'none' },
    ],
    'contrast': [
        { kind: 'contrast', level: 'full' },
        { kind: 'tsx', level: 'none' },
        { kind: 'html', level: 'none' },
    ],
    // rendered-scan: satisfied ONLY by a live rendered scan of a renderUrl (scanRenderedLive),
    // never by a static file - same browser-only shape as dom/contrast (the rendered kind at
    // 'full' plus static kinds at 'none' so static-satisfiability derivation stays well-defined).
    'rendered-scan': [
        { kind: 'rendered-scan', level: 'full' },
        { kind: 'tsx', level: 'none' },
        { kind: 'html', level: 'none' },
    ],
};
// The supported source-kind block for a rule's evidence requirements. Every rule
// in the partial-static slice declares exactly one requirement, so this returns
// that block verbatim. Multi-requirement rules merge (strongest level per kind).
function supportedKindsFor(...requirements) {
    if (requirements.length === 1)
        return exports.SUPPORTED_SOURCE_KINDS_BY_EVIDENCE[requirements[0]].map((s) => ({ ...s }));
    const rank = { full: 3, partial: 2, none: 1 };
    const best = new Map();
    for (const e of requirements) {
        for (const s of exports.SUPPORTED_SOURCE_KINDS_BY_EVIDENCE[e]) {
            const cur = best.get(s.kind);
            if (!cur || rank[s.level] > rank[cur.level])
                best.set(s.kind, { ...s });
        }
    }
    return [...best.values()];
}
// Collector helpers: resolve a path to its source kind, and decide whether a kind
// can actually be read for static evidence (browser-only kinds never appear from
// the filesystem, so the matrix's static kinds are exactly the collectable set).
const COLLECTABLE_KINDS = new Set(Object.values(exports.SOURCE_KIND_BY_EXTENSION));
function sourceKindForPath(filePath) {
    const lower = filePath.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0)
        return undefined;
    const ext = lower.slice(dot);
    return exports.SOURCE_KIND_BY_EXTENSION[ext];
}
function isCollectableSourceKind(kind) {
    return COLLECTABLE_KINDS.has(kind);
}
//# sourceMappingURL=source-support-matrix.js.map