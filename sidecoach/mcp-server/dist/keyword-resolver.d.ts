import type { ModeEntry, VerbEntry } from './registries';
/**
 * Strip non-intent regions from the prompt body before regex matching.
 * Mirrors the Python sanitize() in sidecoach-keyword.sh:
 *
 *   1. Fenced code blocks: ```...```
 *   2. Inline backticks: `code`
 *   3. URLs: http://, https://, file://, ftp://
 *   4. XML tag bodies and stray XML tags
 *   5. Transcript markers: [MAGIC KEYWORD: ...], [TURN N: ...]
 */
export declare function sanitize(text: string): string;
/**
 * Return true if the pattern appears only inside an informational framing -
 * "what is X", "how to use X", "X is a Y", "explain X", "define X", etc.
 * In those cases the user is asking what something is rather than asking us
 * to run it. The bash hook blocks firing in those cases; we mirror that.
 */
export declare function isInformational(text: string, pattern: string): boolean;
export type ResolutionKind = 'verb' | 'mode' | 'none';
export interface KeywordMatch {
    kind: ResolutionKind;
    name?: string;
    chain?: string[];
    reason?: string;
}
/**
 * Resolve a raw user phrase against a verb registry and a mode registry.
 *
 * Behavior matches sidecoach-keyword.sh:
 *  - Modes take precedence over verbs (mode chains already name verbs).
 *  - Multi-match: tie-break to first entry in registry order.
 *  - Word-boundary match (`(?<![\\w-]) ... (?![\\w-])`) to avoid firing on
 *    "polished" / "audit-trail" / "extraction" etc.
 *  - Informational framings ("what is X", "X is a Y", etc.) suppress firing.
 */
export declare function resolveKeyword(phrase: string, registries: {
    verbs: VerbEntry[];
    modes: ModeEntry[];
}): KeywordMatch;
//# sourceMappingURL=keyword-resolver.d.ts.map