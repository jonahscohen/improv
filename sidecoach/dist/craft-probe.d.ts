import type { RuleVerdict } from './validators/check-context';
/** Canonical severity ladder, hardest first. Mirrors product-rule-types CanonicalSeverity. */
export declare const CRAFT_SEVERITY_RANK: Record<string, number>;
export declare const CRAFT_UNRANKED = 4;
/** One rule's static-source outcome on this project. */
export interface ProbedRule {
    canonicalRuleKey: string;
    findingClass: string;
    severity: string;
    status: RuleVerdict['status'];
    message: string;
    remediation?: string;
    evidenceLocations: string[];
}
/** The whole project's static-source outcome. */
export interface CraftProbe {
    projectPath: string;
    /**
     * True only when at least one source file was actually inspected. An empty or source-free
     * directory yields `measured: false`, and a caller must NOT present its results as a clean
     * page - nothing was checked. This is the flag that separates "nothing failed" from
     * "nothing was looked at", which is the distinction a passing-by-default scan destroys.
     */
    measured: boolean;
    inspectedFiles: number;
    skippedFiles: number;
    results: ProbedRule[];
    /** Rules whose static check FAILED. Ordered hardest-first, then by key for run-to-run stability. */
    failed: ProbedRule[];
    /** Rules that could not be decided from static source (browser-evidence rules land here). */
    inconclusive: ProbedRule[];
    /** Rules that passed. Present so a caller can report a denominator honestly. */
    passed: ProbedRule[];
    /** Rules with no applicable target in this project (no buttons -> no press-feedback rule). */
    notApplicable: ProbedRule[];
    /** Set when collection itself failed; every list is empty and `measured` is false. */
    error?: string;
}
/** Hardest-first, then alphabetical by key so two runs over one project order identically. */
export declare function sortProbedRules(rules: ProbedRule[]): ProbedRule[];
/**
 * How long a memoised probe is reused.
 *
 * Cross-model review 2026-07-29 (Medium): the cache was keyed on the resolved path alone and held for
 * the whole process lifetime, so a long-lived process that probed a project, watched it change, then
 * probed again would teach stale failures - or worse, a stale CLEAN result. A flow chain runs in
 * seconds, which is the case the cache exists for, so a short TTL keeps the win and drops the staleness
 * window to something smaller than a human edit cycle.
 */
export declare const CRAFT_PROBE_TTL_MS = 30000;
/** Drop the memoised probes. For tests that reuse a path or mutate a tree between probes. */
export declare function resetCraftProbeCache(): void;
/**
 * Probe a project against every registry rule that static source can decide.
 *
 * Never throws. A missing or unreadable root, or a check that itself throws, degrades to an
 * empty/partial probe with `measured` false and `error` set - a guidance build must not crash
 * because a project could not be read, but it must also not claim a clean result it did not earn.
 */
export declare function probeProject(projectPath: string, opts?: {
    designTokens?: Record<string, unknown>;
}): Promise<CraftProbe>;
/**
 * The failing rules in a project restricted to a set of finding classes.
 *
 * `findingClasses` is matched against the registry's own `findingClass` (polish, a11y, theming,
 * anti-pattern), so a flow asks for its own domain and cannot accidentally teach another flow's
 * rules. An empty list means every class.
 */
export declare function failedInClasses(probe: CraftProbe, findingClasses?: string[]): ProbedRule[];
/** The failing rules whose canonical key starts with any of the given prefixes. */
export declare function failedWithPrefix(probe: CraftProbe, prefixes: string[]): ProbedRule[];
/** The failing rules restricted to an explicit key allowlist, keeping probe ordering. */
export declare function failedInKeys(probe: CraftProbe, keys: string[]): ProbedRule[];
/**
 * The INCONCLUSIVE rules in a scope. The mirror of the two functions above, and the reason it exists:
 * a caller that only asks "what failed in my domain?" cannot tell an all-passed domain from a domain
 * whose rules were never decided, and will report the second as the first. Cross-model review
 * 2026-07-29 (High) caught exactly that. Every scope helper therefore comes in pairs.
 */
export declare function inconclusiveInClasses(probe: CraftProbe, findingClasses?: string[]): ProbedRule[];
/** The inconclusive rules restricted to an explicit key allowlist, keeping probe ordering. */
export declare function inconclusiveInKeys(probe: CraftProbe, keys: string[]): ProbedRule[];
//# sourceMappingURL=craft-probe.d.ts.map