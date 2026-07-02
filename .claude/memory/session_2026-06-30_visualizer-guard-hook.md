---
name: visualizer-guard hook (durable fix for dark-mode a11y widget bug)
description: Built a PreToolUse hook that blocks mcp__visualize__show_widget calls with the failure modes that produced invisible dark-mode text - guessed numbered tokens, hardcoded var() color fallbacks, CDATA wrappers, font-weight 600+. Root-cause fix so the a11y bug can't recur.
type: project
relates_to: [reference_visualizer_token_contract.md, decision_hook_system_architecture.md]
---

Collaborator: Jonah Cohen. 2026-06-30.

## What was done
- Built `claude/hooks/visualizer-guard.sh`, a PreToolUse hook matching `mcp__visualize__show_widget`, modeled on `validation-guard.sh`. Extracts `widget_code` and DENIES on four failure modes: CDATA wrappers, hardcoded color fallbacks inside `var()`, hallucinated numbered tokens (`--text-100`, `--bg-200`, `--surface-3+`, `--accent-main-*`), and font-weight 600/700/800/900/bold.
- Wrote `claude/hooks/_tests/test-visualizer-guard.sh` - 21 cases (13 deny, 8 allow). All pass. Verified my original broken widget's exact patterns (`var(--text-100, #1a1a1a)`, `--danger-300`, `font-weight: 700`, CDATA) are caught, and the corrected v2 widget (`var(--surface-2)`, `var(--text-primary)`, weight 500) passes.
- Symlinked into `~/.claude/hooks/visualizer-guard.sh` (matches existing hook-symlink pattern; verified realpath resolves to repo).
- Registered the matcher in BOTH `claude/settings.json` (repo source) and `~/.claude/settings.json` (live), idempotently, with timestamped backups of both. Both validate as JSON.
- Wrote `reference_visualizer_token_contract.md` - the canonical token list + dark-mode contract + authoring rules, so future sessions author correctly without re-reading the 903-line visualize read_me.

## Why (root cause, self-analysis)
The triggering failure: I rendered a findings widget using guessed Tailwind-style token names (`--text-100`, `--bg-200`, `--danger-300`, `--accent-main-100`) that DO NOT EXIST in the visualizer, each with a hardcoded hex/rgba fallback (`var(--text-200, #333)`). In light mode the fallback looked fine. In dark mode the light-mode hex won on a dark surface = invisible text. An a11y failure.

Failure mode named: I authored from memory of a generic design-token convention instead of the visualizer's actual contract, and I hedged the guess with hardcoded fallbacks - which is exactly what made it fail silently rather than loudly. The fallback was the trap: without it the missing token would have inherited a visible default; with it, the wrong color was pinned.

First correction attempt was a one-shot re-render (fixed that widget only). Jonah correctly pushed for the ROOT fix: a mechanical gate so it can't recur, not a patched instance. That is this hook.

## How (mechanism)
PreToolUse deny via `hookSpecificOutput.permissionDecision=deny` with a remedy message pointing at the token-contract beat. High-precision regexes: var()-fallback rule only fires on hex/rgb/hsl fallbacks (var-as-fallback allowed); numbered-token rule allows `--surface-0/1/2` and only blocks the fake numbered families; canvas/Chart.js bare-hex is intentionally NOT blocked (legitimate use).

## Activation
Hook FILE is live immediately (read fresh each call). Hook REGISTRATION in settings.json needs a SESSION RESTART to take effect - the harness loads PreToolUse matchers at startup. Until restart, the guard is wired but not yet firing.

## Codex cross-model review (gate) + fold
Codex CLI 0.130.0 probed available; review run via codex-rescue. 10 findings: 9 confirmed the hook sound (deny-JSON shape matches known-working validation-guard.sh, no canonical-token false positives, case-insensitive hex via `-i`, no shell-injection surface, `printf '%s'` correct). One real HIGH gap: multi-line CSS - a `var(--x, #hex)` split across lines inside a `<style>` block slips past grep's line-by-line matching (false negative). Folded: flatten `\n\r\t` to spaces (reassign `CODE`) right after extraction so all six checks match against single-line input. Added 2 regression cases (multiline var-fallback, multiline numbered token). Suite now 23/23 green. (The codex-rescue agent twice returned before its codex exec finished and did the review from direct file analysis instead - same-model independent floor; noted as a codex-rescue async-return quirk.)

## Files touched
- claude/hooks/visualizer-guard.sh (new)
- claude/hooks/_tests/test-visualizer-guard.sh (new)
- claude/settings.json (PreToolUse matcher added)
- ~/.claude/settings.json (PreToolUse matcher added - live)
- .claude/memory/reference_visualizer_token_contract.md (new)
- ~/.claude/hooks/visualizer-guard.sh (symlink)
