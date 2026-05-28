---
name: arch-detective OMC keyword mechanism research (2026-05-28)
description: Forensic research output on OMC's magic-keyword architecture, dispatched mid-session after exec summary delivery. Confirmed deterministic UserPromptSubmit hook (not skill auto-triggers) and informed T-0008 implementation 1:1.
type: reference
relates_to: [session_2026-05-28_omc-research-synthesis.md, session_2026-05-28_t0008_sidecoach_keyword_hook.md]
---

Collaborator: Jonah

## Why this exists separately

Jonah was skeptical of OMC's "magic keywords" claim because sidecoach had previously tried skill auto-triggers (2026-05-20 finding: they don't fire reliably). He asked for forensic confirmation of which mechanism OMC uses BEFORE we built our analog. arch-detective (single teammate, team `omc-keywords-arch`) did the source-code dive.

Putting the findings in a standalone reference beat because (a) they directly informed T-0008's architecture, (b) they explain WHY we chose hook-based interception over skill auto-triggers, (c) the sanitization order is non-obvious and worth preserving as documented research rather than buried in T-0008's implementation.

## Mechanism confirmed

Hook-based prompt interception (option #1 of three possibilities I had named). A `UserPromptSubmit` shell hook runs a Node bridge BEFORE Claude sees the prompt; the bridge regex-matches the keyword and injects a `<mode>...</mode>` block as `additionalContext` in the hook output. Deterministic. Not skill auto-triggering.

This is the mechanism that bypasses the 2026-05-20 ceiling: skill auto-triggers are unreliable because Claude has discretion over whether to fire them. Hook-based interception is deterministic because it executes outside the model.

## Source citations (yeachan-heo/oh-my-claudecode @ main)

- `src/hooks/keyword-detector/index.ts` (~930 lines) - regex tables, sanitization, conflict resolution
- `src/hooks/bridge.ts:1430-1718` - `processKeywordDetector()` UserPromptSubmit handler
- `src/installer/hooks.ts:313-321` - registers `keyword-detector.mjs` on UserPromptSubmit via the user's settings.json (NOT plugin.json - the installer writes settings directly)
- `src/installer/hooks.ts:125-280` - the message constants (`RALPH_MESSAGE`, `ULTRATHINK_MESSAGE`, etc.) that get injected
- Tests: `src/hooks/keyword-detector/__tests__/index.test.ts` (~2,286 lines, Vitest)

## Trace (the `ralph` example)

1. User submits prompt "ralph fix the parser"
2. Claude Code fires UserPromptSubmit, runs `~/.claude/omc/hooks/keyword-detector.mjs`
3. Script pipes stdin into `processHook` (bridge.ts:3038) -> `processKeywordDetector` (bridge.ts:1430)
4. `getAllKeywordsWithSizeCheck()` runs sanitization then matches `KEYWORD_PATTERNS.ralph = /\b(ralph)\b(?!-)|(랄프)(?!로렌)/i`
5. Hook returns `{continue: true, message: RALPH_MESSAGE}` - Claude receives `[RALPH + ULTRAWORK MODE ACTIVATED]` injected ABOVE its turn

## Sanitization order (CRITICAL - skip and you fire on code examples)

Applied BEFORE regex matching:
1. `stripPastedCommandPayloads` - strips pasted command outputs
2. `sanitizeForKeywordDetection`:
   - strips ``` fenced code blocks
   - strips inline ` backtick ` spans
   - strips URLs
   - strips file paths
   - strips magic-keyword headers (e.g. `[MAGIC KEYWORD:]`)
   - strips git diffs
   - strips role-tag transcripts

This order matters. Without it, keywords inside code examples or transcripts would fire the mode.

## Match logic

Strict regex with word boundaries PLUS:
- `isInformationalKeywordContext` blocks help/question framings ("what's ralph?", "how do I use autopilot")
- `looksLikeReferenceContent` blocks "vs / versus / comparison / article" framings
- `applyRalplanGate` - if an execution keyword is present but the prompt lacks file paths / symbols / issue numbers, redirects to `ralplan` mode (gate bypass: `force:` or `!` prefix)
- `task-size-detector` - suppresses heavy modes (ralph / autopilot / ultrawork / team) on <50-word prompts

Brand-collision exclusions in regex:
- `ralph` excludes `ralph lauren` via `/\b(ralph)\b(?!-)/i` (negative lookahead on hyphen)
- Korean `랄프` matches; `랄프로렌` (Ralph Lauren) is excluded via `(?!로렌)`

## Permanently-disabled keyword (worker recursion safety)

The `team` keyword is permanently disabled via placeholder regex `/(?!x)x/` to prevent worker recursion (workers spawning workers). They learned that the hard way and shipped a permanent disable rather than relying on a runtime check. Pattern worth lifting if we ever ship T-0007 (Codex/Gemini orchestration) where the same recursion risk exists.

## Reliability claim

Mechanism guarantees firing because it's a deterministic shell hook with identical execution on every prompt. NOT skill auto-trigger. Reliability bounded by regex precision, not by Claude's choice. Test suite is 2,286 lines (~500+ assertions) covering each pattern + every sanitization branch + the ralplan gate + size suppression.

## What we lifted into T-0008

Direct architectural ports:
- UserPromptSubmit shell hook (claude/hooks/sidecoach-keyword.sh)
- Sanitization order (code fences -> inline backticks -> URLs -> XML tags -> transcript markers)
- Informational suppression ("what is X" / "how to use X" / "how do I X" framings)
- Word-boundary regex with hyphen-aware negation (`(?<![\w-])PATTERN(?![\w-])` - sidecoach's variant rejects both `polished` and `audit-trail`)
- Multi-match tie-break (registry order wins, deterministic)

Not lifted yet (deferred):
- ralplan gate equivalent for sidecoach verbs (could route execution verbs to `shape` planning mode when file paths absent)
- task-size-detector for heavy sidecoach modes (forge/kiln could suppress on <50-word prompts)
- Worker-recursion permanent-disable pattern (relevant if T-0007 ships)

## When to revisit this research

- If T-0008's keyword hook starts firing on edge cases the sanitization doesn't catch -> add more sanitization stages following OMC's order
- If we ship multi-CLI orchestration (T-0007) -> port the `team`-keyword permanent-disable pattern
- If OMC's regex precision improves materially (e.g. they ship Unicode-aware tokenization) -> mirror those changes
