#!/bin/bash
# PreToolUse hook for Bash|Agent|Workflow. NON-NEGOTIABLE (Jonah, 2026-06-11).
#
# Claude is FORBIDDEN from automatically routing work to another model and from
# using fable-router, ever. The session model is the user's choice alone; it is
# never Claude's to switch, downgrade, upgrade, or "route". This hook makes the
# rule mechanical on every surface that can launch model-bearing work:
#   - Bash: fable-router invocations, claude --model/--fallback-model overrides,
#     ANTHROPIC_MODEL assignments, generic model-router binaries
#   - Agent: the `model` parameter (subagent model override)
#   - Workflow: model overrides in agent() opts or phase meta, fable-router refs
# There is no override flag. If a task seems to need a different model, STOP and
# ask the user - they decide, never the harness.
#
# FRONTIER SCHEME (Jonah 2026-07-06, expanded 2026-08-05): the .5 frontier models
# (claude-fable-5, claude-opus-5, claude-sonnet-5) are user-mandated orchestrators
# that delegate production to a PREFERRED model (opus/sonnet/haiku = the 4.x
# generation). So the Agent `model` parameter is handled as:
#   - target is a PREFERRED model + session is FRONTIER -> allowed (delegate down).
#   - target is a FRONTIER model (fable / opus-5 / sonnet-5) -> blocked UNLESS the
#     user just typed "confirm" (frontier-confirm.sh one-shot token). This is the
#     "route an agent to sonnet 5 -> confirm" flow.
#   - target is a PREFERRED model but session is NOT frontier -> blocked, unchanged
#     (a normal session does not route agents to other models; the user decides).
# The CLI-level routing hacks (fable-router, claude --model, ANTHROPIC_MODEL) stay
# blocked for ALL models with NO override. See frontier-orchestrator-guard.sh +
# frontier-confirm.sh + session_2026-07-06_fable-orchestrator-hook-conflict.md.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_name",""))' 2>/dev/null)

# Detect the session model once (used to scope the Fable Agent-model exception).
_TP=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("transcript_path","") or "")' 2>/dev/null)
_SID=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id","") or "")' 2>/dev/null)
SESSION_MODEL=$("$HOME/.claude/hooks/detect-session-model.sh" "$_TP" "$_SID")

REASON=""

if [ "$TOOL" = "Bash" ]; then
  CMD=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

  if echo "$CMD" | grep -qiE 'fable[-_]?router'; then
    REASON="BLOCKED (non-negotiable): fable-router is forbidden. Claude never routes to another model, automatically or otherwise. Stay on the session model; if a different model seems needed, ask the user."
  elif echo "$CMD" | grep -qE '(^|[;|&(][[:space:]]*)claude([[:space:]]+[^;|&]*)?[[:space:]]--(model|fallback-model)([[:space:]=]|$)'; then
    # `claude` must be at a COMMAND position (start, or after ; | & ( ) - not merely preceded by a
    # space - so a bare `claude --model X` override is blocked while an arg like `--provider claude
    # --model gemini-3.6-flash` to ANOTHER tool (the sidecoach eval harness) is not false-blocked.
    REASON="BLOCKED (non-negotiable): claude --model/--fallback-model overrides the session model. Model choice belongs to the user alone - never set it from a command."
  elif echo "$CMD" | grep -qE '(^|[[:space:];|&])(export[[:space:]]+)?ANTHROPIC_MODEL='; then
    REASON="BLOCKED (non-negotiable): setting ANTHROPIC_MODEL re-routes work to another model. Model choice belongs to the user alone."
  elif echo "$CMD" | grep -qiE '(^|[[:space:];|&/])(model[-_]router|llm[-_]router)([[:space:]]|$)'; then
    REASON="BLOCKED (non-negotiable): model-router tooling is forbidden. Claude never routes to another model."
  fi

elif [ "$TOOL" = "Agent" ]; then
  AGENT_MODEL=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("model",""))' 2>/dev/null)
  AGENT_PROMPT=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("prompt",""))' 2>/dev/null)

  if echo "$AGENT_PROMPT" | grep -qiE 'fable[-_]?router'; then
    REASON="BLOCKED (non-negotiable): fable-router is forbidden, including instructing a subagent to use it."
  elif echo "$AGENT_MODEL" | grep -qiE 'fable[-_]?router'; then
    REASON="BLOCKED (non-negotiable): fable-router is forbidden as an Agent model value."
  elif [ -n "$AGENT_MODEL" ]; then
    # Is the TARGET a frontier model? fable (=fable-5) or an opus-5 / sonnet-5 id.
    # A bare opus/sonnet/haiku, or a 4.x id, is a PREFERRED target.
    if echo "$AGENT_MODEL" | grep -qiE '(^|[^a-z0-9])fable([^a-z0-9]|$)|opus-?5|sonnet-?5'; then
      # Frontier target -> gated. A single user-typed "confirm" lifts it once.
      . "$HOME/.claude/hooks/frontier-confirm.sh" 2>/dev/null || true
      if type frontier_check_confirm >/dev/null 2>&1 && frontier_check_confirm "$AGENT_MODEL"; then
        : # confirmed by the user - allow this one route.
      else
        REASON="BLOCKED: routing an agent to a frontier model ($AGENT_MODEL). Frontier models (Opus 5 / Sonnet 5 / Fable 5) are gated - reply 'confirm' to allow this one route, or target a preferred model (opus/sonnet/haiku = the 4.x generation)."
      fi
    else
      # Preferred target -> allowed only when a frontier session is delegating
      # production down. A non-frontier session routing an agent to another model
      # stays blocked (unchanged rule; the user decides model choice).
      case "$SESSION_MODEL" in
        *fable-5*|*opus-5*|*sonnet-5*)
          : # frontier orchestrator delegating to a preferred producer - allowed.
          ;;
        *)
          REASON="BLOCKED (non-negotiable): the Agent 'model' parameter routes the subagent to another model ($AGENT_MODEL). Omit it - subagents inherit the session model the user chose. If a different model seems needed, ask the user."
          ;;
      esac
    fi
  fi

elif [ "$TOOL" = "Workflow" ]; then
  WF_BLOB=$(echo "$INPUT" | python3 -c '
import json,sys
ti = json.load(sys.stdin).get("tool_input",{})
print(json.dumps(ti.get("script","")) + json.dumps(ti.get("args","")) + json.dumps(ti.get("name","")))' 2>/dev/null)

  if echo "$WF_BLOB" | grep -qiE 'fable[-_]?router'; then
    REASON="BLOCKED (non-negotiable): fable-router is forbidden inside workflow scripts."
  elif echo "$WF_BLOB" | grep -qE "[\"']?model[\"']?[[:space:]]*:[[:space:]]*[\\\\]?[\"'](sonnet|opus|haiku|fable|claude-)"; then
    REASON="BLOCKED (non-negotiable): workflow contains a model override (agent opts.model or phase meta model). Omit it - workflow agents inherit the session model the user chose."
  fi
fi

if [ -n "$REASON" ]; then
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$REASON"
else
  echo '{}'
fi
