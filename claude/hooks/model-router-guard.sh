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

INPUT=$(cat)
TOOL=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_name",""))' 2>/dev/null)

REASON=""

if [ "$TOOL" = "Bash" ]; then
  CMD=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

  if echo "$CMD" | grep -qiE 'fable[-_]?router'; then
    REASON="BLOCKED (non-negotiable): fable-router is forbidden. Claude never routes to another model, automatically or otherwise. Stay on the session model; if a different model seems needed, ask the user."
  elif echo "$CMD" | grep -qE '(^|[[:space:];|&])claude([[:space:]]+[^;|&]*)?[[:space:]]--(model|fallback-model)([[:space:]=]|$)'; then
    REASON="BLOCKED (non-negotiable): claude --model/--fallback-model overrides the session model. Model choice belongs to the user alone - never set it from a command."
  elif echo "$CMD" | grep -qE '(^|[[:space:];|&])(export[[:space:]]+)?ANTHROPIC_MODEL='; then
    REASON="BLOCKED (non-negotiable): setting ANTHROPIC_MODEL re-routes work to another model. Model choice belongs to the user alone."
  elif echo "$CMD" | grep -qiE '(^|[[:space:];|&/])(model[-_]router|llm[-_]router)([[:space:]]|$)'; then
    REASON="BLOCKED (non-negotiable): model-router tooling is forbidden. Claude never routes to another model."
  fi

elif [ "$TOOL" = "Agent" ]; then
  AGENT_MODEL=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("model",""))' 2>/dev/null)
  AGENT_PROMPT=$(echo "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("prompt",""))' 2>/dev/null)

  if [ -n "$AGENT_MODEL" ]; then
    REASON="BLOCKED (non-negotiable): the Agent 'model' parameter routes the subagent to another model ($AGENT_MODEL). Omit it - subagents inherit the session model the user chose. If a different model seems needed, ask the user."
  elif echo "$AGENT_PROMPT" | grep -qiE 'fable[-_]?router'; then
    REASON="BLOCKED (non-negotiable): fable-router is forbidden, including instructing a subagent to use it."
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
