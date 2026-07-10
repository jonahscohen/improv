#!/bin/bash
# PreToolUse hook (matcher: Write|Edit|MultiEdit|NotebookEdit|Bash).
#
# When the SESSION model is Fable (claude-fable-5), Fable is orchestrator-only:
# it may NOT produce or execute on its own. It blocks Fable's file-authoring and
# shell tools and directs it to delegate production to an Opus teammate and review
# to Codex. For every other model (Opus/Sonnet/Haiku) this hook is a no-op - the
# user's model choice is honored, per the standing "model choice is the user's"
# rule. Authorized by Jonah 2026-07-06 (cost control). Paired with the Fable
# exception in model-router-guard.sh that lets Fable spawn the Opus producer.
# See session_2026-07-06_fable-orchestrator-hook-conflict.md.

INPUT=$(cat)

TOOL=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_name",""))' 2>/dev/null)

# Only gate the production/execution tools; everything else passes untouched.
case "$TOOL" in
  Write|Edit|MultiEdit|NotebookEdit|Bash) ;;
  *) echo '{}'; exit 0 ;;
esac

TP=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("transcript_path","") or "")' 2>/dev/null)
SID=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id","") or "")' 2>/dev/null)

MODEL=$("$HOME/.claude/hooks/detect-session-model.sh" "$TP" "$SID")

case "$MODEL" in
  *fable*) ;;                # Fable session -> enforce orchestrator-only
  *) echo '{}'; exit 0 ;;    # non-Fable or indeterminate -> allow (fail-open)
esac

REASON="Fable is in orchestrator-only mode (cost control, Jonah 2026-07-06): direct ${TOOL} calls are blocked. Delegate production to an Opus teammate (Agent tool with model: opus) and review to Codex (codex:codex-rescue agent or /code-review). You may still Read/Grep/Glob, spawn teammates, SendMessage, ask questions, and track tasks. To do this work yourself, switch the session model off Fable (Opus/Sonnet/Haiku)."

python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$REASON"
