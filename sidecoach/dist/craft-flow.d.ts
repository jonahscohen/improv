import { ProbedRule } from './craft-probe';
/** What a flow declares about its own domain. */
export interface FlowCraftSpec {
    /**
     * `check` - teach what failed; teach nothing when clean.
     * `produce` - teach the up-front standard, and additionally enumerate any failures in scope.
     */
    shape: 'check' | 'produce';
    /** Registry finding classes this flow owns: polish, a11y, theming, anti-pattern. Empty means all. */
    findingClasses?: string[];
    /** An explicit canonical-rule allowlist, used instead of findingClasses when the flow is narrower. */
    ruleKeys?: string[];
    /** Law domains this flow teaches when running in `produce` shape. See craft-laws.lawDomains(). */
    lawDomains?: string[];
    /** Phrase for the header, e.g. "responsive behaviour". */
    domainLabel?: string;
    /** Note cap override. Defaults to MAX_BRIEF_NOTES. */
    limit?: number;
}
export interface FlowCraftResult {
    /** The brief lines, ready to splice above a FINDINGS boundary. [] when there is nothing to teach. */
    brief: string[];
    /**
     * Which shape of brief was produced.
     *
     * `clean` means every in-scope rule was actually DECIDED and passed. `inconclusive` means nothing
     * failed but some in-scope rule could not be decided from static source - a distinction the first
     * version of this file collapsed into `clean`, which made a payload claim "every checked rule in
     * this domain passed" for an accessibility domain whose contrast and hit-area rules had never been
     * evaluated. Cross-model review 2026-07-29 (High). A guidance payload may report what it measured
     * and may report that it could not measure; it may not report the second as the first.
     */
    mode: 'findings' | 'standard' | 'clean' | 'inconclusive' | 'unmeasured';
    /** Every failing rule in scope, named with its measured message and a fix. UNCAPPED. */
    findingLines: string[];
    /** The failing rules in scope, for a caller that wants the raw list. */
    failed: ProbedRule[];
    /**
     * The in-scope rules that could NOT be decided from static source. Carried so a caller can never
     * present an undecided domain as a passing one; `craftGuidanceBlock` names the count.
     */
    undecided: ProbedRule[];
    /** True when at least one source file was actually inspected. */
    measured: boolean;
    inspectedFiles: number;
    /** One line stating what was and was not checked, so a payload never implies more than it did. */
    scopeLine: string;
}
/**
 * Name every failing rule with the validator's own measured message and a concrete fix.
 *
 * The measured remediation wins over the corpus, because it was produced against this project's
 * actual evidence. Where neither resolves, the line SAYS so rather than trailing off - a payload
 * that promises every failure arrives with a fix has to keep that promise visibly.
 */
export declare function findingLinesFor(failed: ProbedRule[]): string[];
/**
 * Build the craft payload for a flow.
 *
 * Never throws: an unreadable project yields `unmeasured` with the standard brief for a produce flow
 * and an explicit scope line either way. A guidance build must not crash because a directory could
 * not be walked, and it must not silently present an unwalked directory as clean.
 */
export declare function flowCraft(projectPath: string | undefined, spec: FlowCraftSpec): Promise<FlowCraftResult>;
/**
 * The complete TEACH-then-CHECK block for a flow payload.
 *
 * Returns the brief, the boundary, the scope line, and the enumerated findings, in that order, ready
 * to splice into `guidance` above whatever the handler already emitted. Handlers call this rather
 * than assembling the order themselves, so TEACH always precedes CHECK in every verb.
 */
export declare function craftGuidanceBlock(result: FlowCraftResult, cleanMessage: string): string[];
//# sourceMappingURL=craft-flow.d.ts.map