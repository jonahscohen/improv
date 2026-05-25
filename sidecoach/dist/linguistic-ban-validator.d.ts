/**
 * Linguistic Ban Validator
 *
 * Detects AI-template-y language patterns in generated copy. This is the
 * validator that closes the largest forensic gap: yesterday's marketing site
 * shipped "Memory in layers. Not a feature, a discipline.", "Not a platform.
 * Not a framework. Not for everyone.", and "Stop describing the UI. Show it."
 * - all three are named templates the absorbed taste-skill content bans by
 * pattern, but no validator was checking for them.
 *
 * Two detection layers:
 *
 * 1. Slop word scan - exact-word matching against the ~30-entry taste-skill
 *    ban list (Elevate, Seamless, Unleash, Delve, Tapestry, Acme, Nexus, etc).
 *    Each hit is a P1 finding.
 *
 * 2. Rhetorical-template scan - regex-matched named templates from
 *    reference-loader.loadRhetoricalPatterns(). The 8 patterns currently cover:
 *    triplet-negation, negation-as-positioning, imperative-pair, world-of-opener,
 *    realm-of-opener, tapestry-prose, goes-without-saying, delve-into.
 *    Each match is a P0 finding (the templates are the loudest tells).
 *
 * Both layers operate on plain text - HTML/markdown formatting is stripped
 * before scanning. Code blocks and inline code are exempt (a slop word in a
 * code sample is documenting the ban, not committing it).
 *
 * Used by flowJ tactical-polish to scan generated copy before sign-off, and
 * available standalone for any flow that emits user-facing text.
 */
export type LinguisticFindingSeverity = 'P0' | 'P1' | 'P2';
export interface LinguisticFinding {
    severity: LinguisticFindingSeverity;
    type: 'slop-word' | 'rhetorical-template';
    match: string;
    context: string;
    patternName?: string;
    remediation: string;
}
export interface LinguisticBanReport {
    scanned: number;
    findings: LinguisticFinding[];
    summary: string;
}
/**
 * Run the full linguistic-ban scan on a piece of generated copy.
 * Accepts HTML, markdown, or plain text. Strips formatting before scanning.
 *
 * @param input - The copy to scan
 * @param label - Optional label for the source (e.g. "marketing-site/index.html hero")
 */
export declare function scanForLinguisticBans(input: string, label?: string): LinguisticBanReport;
/**
 * Convenience function for flow handlers: returns ready-to-append guidance lines
 * describing the findings, suitable for FlowExecutionResult.guidance.
 */
export declare function findingsToGuidance(report: LinguisticBanReport): string[];
//# sourceMappingURL=linguistic-ban-validator.d.ts.map