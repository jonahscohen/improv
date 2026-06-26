---
name: doctor-hooks-verified
description: codexdoctor's two self-healing hooks (codex-rescue-guard PreToolUse + codex-failure-watcher PostToolUse) built, wired in settings.json (valid JSON), and lead-verified by hand-test across trip/no-op/edge cases. Durable cure for the codex no-relay + capacity failure modes. Needs a SESSION RESTART to take effect.
type: reference
relates_to: [session_2026-06-25_codex-verdict-and-doctor-deployed.md, reference_codex_rescue_teammate_no_relay.md, session_2026-06-25_codex-rescue-guard-hook.md, decision_hook_system_architecture.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Jonah's self-healing-doctor request; scope = Guard + runtime watcher (his pick).

## TWO HOOKS BUILT (claude/hooks/, wired in claude/settings.json - JSON validated)
1. **codex-rescue-guard.sh** (PreToolUse, matcher Agent, settings.json:133): DENIES spawning a codex-rescue agent as a NAMED teammate (the no-relay misconfiguration) with a redirect to the CLI pattern. Prevents the ~7-min waste at spawn.
2. **codex-failure-watcher.sh** (PostToolUse, matcher Bash, settings.json:367): on a codex command whose output contains "at capacity"/error, INJECTS a treat-directive (retry leaner / switch model / fall back to lead-gate). Targets capacity+error (a hang can't be caught at PostToolUse - that stays manual elapsed-vs-CPU + SIGKILL).

## LEAD-VERIFIED (hand-tested, all correct)
- guard TRIP: codex:codex-rescue + name -> deny JSON with redirect. codex:rescue short form + name -> deny. UNNAMED codex-rescue -> {} (in-process can relay, correctly not blocked). general-purpose named -> {}.
- watcher TRIP: codex cmd + "Selected model is at capacity" -> inject JSON. NO-OP: plain ls -> {}. NON-codex cmd that merely contains "at capacity" -> {} (no false positive - only codex cmds trip).
- settings.json: valid JSON (python3 -m json.tool OK), existing entries untouched, both new entries added.

## RESTART REQUIRED
Hooks load at SessionStart, so these are NOT live in the current session - a restart is needed for them to fire. Until then the no-relay/capacity behavior is unchanged (handle manually: run codex via CLI, retry-lean on capacity).

## OPEN
codexdoctor's beat (codex-rescue-guard-hook) + the codex-doctor protocol note in claude/docs/ - confirm both cover the watcher too. The hooks themselves (the cure) are verified-accepted.

## Files touched
- claude/hooks/codex-rescue-guard.sh, claude/hooks/codex-failure-watcher.sh, claude/settings.json (by codexdoctor; lead-verified)
</content>
