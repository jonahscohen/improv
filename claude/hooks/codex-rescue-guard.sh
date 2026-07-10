#!/bin/bash
# PreToolUse hook for the Agent tool. Governs how codex-rescue agents are spawned
# so the cross-model REVIEW gate always runs through a REAL Codex pass and never
# silently downgrades.
#
# TWO DISEASES this guards against:
#
# 1. NO-RELAY (reference_codex_rescue_teammate_no_relay.md): in cmux teams mode a
#    NAMED codex:codex-rescue teammate is Bash-only (no SendMessage), so it runs
#    codex but cannot relay the review back - findings strand in its pane, ~7 min
#    wasted. -> Deny any NAMED codex-rescue spawn.
#
# 2. SILENT DOWNGRADE (session_2026-06-30_codex-rescue-silent-downgrade.md): when
#    codex is slow (config gpt-5.5/xhigh) or wedges, the codex-rescue agent returns
#    a placeholder and reviews the diff ITSELF - a same-model review wearing a
#    cross-model label, with no error surfaced. -> Deny REVIEW-intent codex-rescue
#    spawns (named or unnamed) and redirect to the deterministic wrapper, which
#    ALWAYS runs real Codex or fails loudly. Investigation/fix/rescue use of the
#    agent (no review intent) is still allowed.
#
# THE CURE for both: ~/.claude/hooks/codex-review.py - real Codex or a loud,
# distinct-exit-code failure (3 wedged / 4 backend / 5 empty). NOTE: it passes the
# prompt POSITIONALLY and the diff via input=, NOT `codex exec < diff` (that stdin
# redirect is the documented wedge - reference_codex_exec_hang_sigkill.md).
#
# TRIP: tool_name == "Agent" AND subagent_type contains both "codex" and "rescue".
# Any parse error -> no-op (fail-open; never break Agent spawns).
#
# Collaborator: Jonah Cohen, 2026-06-25 (extended 2026-06-30).

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, re

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

try:
    tool = data.get("tool_name", "") or ""
    inp = data.get("tool_input", {}) or {}
    subagent = (inp.get("subagent_type", "") or "").lower()
    name = (inp.get("name", "") or "").strip()
    prompt = (inp.get("prompt", "") or "").lower()

    is_codex_rescue = ("codex" in subagent) and ("rescue" in subagent)

    redirect = (
        "Run the deterministic wrapper instead: "
        "`git diff <base> | ~/.claude/hooks/codex-review.py \"<review prompt>\" -C <repo>`. "
        "It ALWAYS runs REAL Codex or fails loudly (exit 3 wedged / 4 backend / 5 empty) and "
        "never silently downgrades to a same-model self-review the way the codex-rescue agent "
        "does when codex is slow. (Prompt is positional + diff via stdin input - NOT `codex exec "
        "< diff`, which wedges.) See session_2026-06-30_codex-rescue-silent-downgrade."
    )

    def deny(reason):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))

    if tool == "Agent" and is_codex_rescue:
        # Review intent: mentions review/critique AND a code-artifact word. Investigation
        # prompts ("debug why X crashes", "review the logs") lack the artifact words and pass.
        review_verb = re.search(r"\b(review|critique|audit)\b", prompt) is not None
        # Word-boundary match so substrings do NOT false-fire (diff in "different",
        # patch in "dispatch", code in "codebase", work in "network").
        artifact = re.search(
            r"\b(diffs?|findings|cross-model|changes?|patch(?:es)?|edits?|code|"
            r"implementation|branch|commits?|work|pr|pull request)\b", prompt) is not None
        review_intent = review_verb and artifact

        if name:
            deny("BLOCKED: a codex-rescue agent spawned as a NAMED teammate cannot relay findings "
                 "(Bash-only, no SendMessage) - it strands its review in its own pane. " + redirect)
        elif review_intent:
            deny("BLOCKED: cross-model REVIEW via the codex-rescue agent silently downgrades to a "
                 "same-model self-review when codex is slow/wedged (observed 2026-06-30). " + redirect
                 + " (Investigation/fix/rescue use of codex-rescue is fine - this blocks REVIEW intent only.)")
        else:
            print("{}")
    else:
        print("{}")
except Exception:
    print("{}")
'
