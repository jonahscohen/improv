#!/bin/bash
# PreToolUse hook for the Agent tool. Blocks spawning a codex-rescue agent as a
# NAMED teammate, which cannot relay its findings back to the lead.
#
# THE DISEASE (reference_codex_rescue_teammate_no_relay.md): in cmux teams mode
# every Agent spawn must be NAMED. A named codex:codex-rescue (a.k.a codex:rescue)
# teammate is Bash-ONLY - it has no SendMessage tool - so it runs codex fine but
# CANNOT relay its review back. It goes idle and the findings are stranded in its
# own pane. ~7 minutes wasted each time before anyone notices.
#
# THE CURE: deny the spawn at PreToolUse and redirect to running codex DIRECTLY
# via the CLI (still a different model, so still satisfies produce-and-verify), or
# a general-purpose agent that runs codex and SendMessages the result.
#
# TRIP CONDITION: tool_name == "Agent" AND subagent_type contains both "codex" and
# "rescue" (case-insensitive: matches codex:codex-rescue and codex:rescue) AND name
# is non-empty (a named teammate). Otherwise no-op. Any parse error -> no-op
# (fail-open; never break Agent spawns).
#
# Collaborator: Jonah Cohen, 2026-06-25.

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

try:
    tool = data.get("tool_name", "") or ""
    inp = data.get("tool_input", {}) or {}
    subagent = (inp.get("subagent_type", "") or "").lower()
    name = inp.get("name", "") or ""

    is_codex_rescue = ("codex" in subagent) and ("rescue" in subagent)

    if tool == "Agent" and is_codex_rescue and name.strip():
        reason = (
            "BLOCKED: a codex-rescue agent spawned as a named teammate cannot relay "
            "findings (Bash-only, no SendMessage) - it will strand its review in its "
            "own pane. Run codex DIRECTLY instead: codex exec -C <repo> -s read-only "
            "\"$(cat prompt.txt)\" < change.diff  (still cross-model = satisfies "
            "produce-and-verify). Or use a general-purpose agent that runs codex and "
            "SendMessages the result. See reference_codex_rescue_teammate_no_relay."
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason
            }
        }))
    else:
        print("{}")
except Exception:
    print("{}")
'
