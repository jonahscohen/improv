"use strict";
// Pure TypeScript port of the sanitize + word-boundary + informational-
// suppression logic that lives in `claude/hooks/sidecoach-keyword.sh`.
//
// The bash hook lives at hook-time (UserPromptSubmit). The MCP tool exposes
// the same logic so callers can resolve a phrase outside of the hook (e.g.
// from inside a Claude conversation, or a test harness). Behavior MUST match
// the hook 1:1 modulo regex flavor differences between Python and JS.
//
// The hook tests live at claude/hooks/test-sidecoach-keyword.sh and we want
// this port to remain compatible enough that the same fixtures pass.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitize = sanitize;
exports.isInformational = isInformational;
exports.resolveKeyword = resolveKeyword;
// ---------------------------------------------------------------------------
// Sanitization pipeline (5 stages, order matters)
// ---------------------------------------------------------------------------
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
function sanitize(text) {
    let t = text;
    // 1. Fenced code blocks.
    t = t.replace(/```[\s\S]*?```/g, ' ');
    // 2. Inline backticks.
    t = t.replace(/`[^`\n]*`/g, ' ');
    // 3. URLs.
    t = t.replace(/\b(?:https?|file|ftp):\/\/\S+/gi, ' ');
    // 4. XML tag bodies.
    t = t.replace(/<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?<\/\1\s*>/g, ' ');
    // 5. Stray XML tags (open or self-closing).
    t = t.replace(/<[a-zA-Z!/][^>]*>/g, ' ');
    // 6. Transcript markers.
    t = t.replace(/\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]/gi, ' ');
    return t;
}
// ---------------------------------------------------------------------------
// Informational-framing suppression
// ---------------------------------------------------------------------------
/**
 * Return true if the pattern appears only inside an informational framing -
 * "what is X", "how to use X", "X is a Y", "explain X", "define X", etc.
 * In those cases the user is asking what something is rather than asking us
 * to run it. The bash hook blocks firing in those cases; we mirror that.
 */
function isInformational(text, pattern) {
    // JS regex doesn't have \b for hyphen-aware boundaries, so we mirror the
    // bash hook's (?<![\w-]) ... (?![\w-]) explicitly.
    const escaped = escapeRegex(pattern);
    const noWordBefore = `(?<![\\w-])`;
    const noWordAfter = `(?![\\w-])`;
    const frames = [
        `\\bwhat\\s+(?:is|are|was|were|does|did)\\s+(?:the\\s+|a\\s+|an\\s+)?${escaped}${noWordAfter}`,
        `\\bwhat['’]s\\s+(?:the\\s+|a\\s+|an\\s+)?${escaped}${noWordAfter}`,
        `\\bhow\\s+to\\s+(?:use\\s+)?(?:the\\s+)?${escaped}${noWordAfter}`,
        `\\bhow\\s+do\\s+(?:i|you|we)\\s+(?:use\\s+)?(?:the\\s+)?${escaped}${noWordAfter}`,
        `\\btell\\s+me\\s+about\\s+(?:the\\s+|a\\s+|an\\s+)?${escaped}${noWordAfter}`,
        `\\bexplain\\s+(?:the\\s+|how\\s+|what\\s+)?${escaped}${noWordAfter}`,
        `\\bdefine\\s+${escaped}${noWordAfter}`,
        `${noWordBefore}${escaped}\\s+is\\s+(?:a|an|the)\\b`,
        `\\bwhat\\s+(?:the\\s+)?${escaped}\\s+(?:does|means|is)\\b`,
    ];
    for (const frame of frames) {
        if (new RegExp(frame, 'i').test(text))
            return true;
    }
    return false;
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function wordBoundaryMatch(text, pattern) {
    // Mirror Python's (?<![\w-])PATTERN(?![\w-]).
    const re = new RegExp(`(?<![\\w-])${escapeRegex(pattern)}(?![\\w-])`, 'i');
    return re.test(text);
}
function matchEntries(entries, sanitized, nameOf) {
    const out = [];
    for (const entry of entries) {
        const pattern = entry.pattern || nameOf(entry);
        if (!pattern)
            continue;
        if (!wordBoundaryMatch(sanitized, pattern))
            continue;
        if (isInformational(sanitized, pattern))
            continue;
        out.push(entry);
    }
    return out;
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
function resolveKeyword(phrase, registries) {
    if (!phrase || !phrase.trim()) {
        return { kind: 'none', reason: 'empty phrase' };
    }
    const sanitized = sanitize(phrase);
    if (!sanitized.trim()) {
        return { kind: 'none', reason: 'phrase became empty after sanitization (all code/URLs/XML)' };
    }
    const matchedModes = matchEntries(registries.modes, sanitized, (m) => m.mode);
    const matchedVerbs = matchEntries(registries.verbs, sanitized, (v) => v.verb);
    if (matchedModes.length > 0) {
        const chosen = matchedModes[0];
        return {
            kind: 'mode',
            name: chosen.mode,
            chain: chosen.chain,
            reason: matchedModes.length > 1
                ? `multiple modes matched (${matchedModes.map((m) => m.mode).join(', ')}); tie-broken to first in registry order`
                : 'matched mode',
        };
    }
    if (matchedVerbs.length > 0) {
        const chosen = matchedVerbs[0];
        return {
            kind: 'verb',
            name: chosen.verb,
            reason: matchedVerbs.length > 1
                ? `multiple verbs matched (${matchedVerbs.map((v) => v.verb).join(', ')}); tie-broken to first in registry order`
                : 'matched verb',
        };
    }
    return { kind: 'none', reason: 'no verb or mode matched after sanitization + informational suppression' };
}
//# sourceMappingURL=keyword-resolver.js.map