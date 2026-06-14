"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVIDENCE_SOURCE_COMPATIBILITY = exports.SEVERITY_TABLE = void 0;
exports.isBlocking = isBlocking;
exports.sourceKindsForEvidence = sourceKindsForEvidence;
exports.isStaticallySatisfiable = isStaticallySatisfiable;
function isBlocking(sev, blocking) {
    return blocking.includes(sev);
}
// The normalization table - used ONCE at registry-authoring time to SEED severity.
// The evaluator never reads it (per-rule severity is authoritative). --check uses it
// to flag undocumented divergence (Task 4).
exports.SEVERITY_TABLE = {
    critical: 'blocker', P0: 'blocker', error: 'blocker',
    high: 'major', P1: 'major',
    medium: 'minor', P2: 'minor',
    low: 'advisory',
};
// EVIDENCE-COMPATIBILITY MODEL (spec lines 526-533, 608-612). Maps each evidence
// requirement to the SOURCE KINDS that can satisfy it statically. Browser-only
// evidence (dom / computed-style / contrast) maps to the EMPTY set: no static
// source kind can provide it until a browser-evidence collector exists (P4b+).
// This makes both `requiredRuleIds` derivation and the coverage satisfiability
// guard well-defined instead of prose.
exports.EVIDENCE_SOURCE_COMPATIBILITY = {
    'css-rule': ['css', 'scss', 'sass', 'less', 'tsx', 'jsx', 'html', 'vue', 'svelte'],
    'markup': ['html', 'tsx', 'jsx', 'vue', 'svelte'],
    'computed-style': [],
    'dom': [],
    'contrast': [],
};
// The union of source kinds that can satisfy ALL of the given evidence requirements
// (union across requirements; a rule is satisfied if any listed kind is present for
// each requirement family it declares).
function sourceKindsForEvidence(reqs) {
    const set = new Set();
    for (const e of reqs)
        for (const k of exports.EVIDENCE_SOURCE_COMPATIBILITY[e])
            set.add(k);
    return [...set];
}
// A rule is statically satisfiable iff it declares at least one evidence
// requirement and EVERY requirement has a non-empty static source-kind set
// (i.e. no dom / computed-style / contrast requirement).
function isStaticallySatisfiable(reqs) {
    return reqs.length > 0 && reqs.every((e) => exports.EVIDENCE_SOURCE_COMPATIBILITY[e].length > 0);
}
//# sourceMappingURL=product-rule-types.js.map