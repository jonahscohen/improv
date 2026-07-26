#!/bin/bash
# PreToolUse hook for Agent (and a hard block on Workflow) inside cmux-teams.
# When running inside cmux with the agent-teams shim active, gate Agent calls so
# they take the correct teammate form, and reject the spawn shapes that are
# guaranteed NOT to produce a visible teammate.
#
# Detection: CMUX_SOCKET_PATH set AND CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1.
# Outside that combination (regular shell, or claude run without the cmux
# claude-teams wrapper), the hook is a no-op.
#
# Decisions in cmux-teams mode:
#   - Workflow tool            -> DENY  (silent in-process subagents, never a split)
#   - Agent missing `name`     -> DENY  (an unnamed agent is not a teammate)
#   - Agent run_in_background  -> DENY  (background = in-process = INVISIBLE; can
#                                        never be a pane. Exception: the user
#                                        explicitly asked for a background agent.)
#   - Named foreground Agent   -> ALLOW + attach a KNOWN-ISSUE notice (below)
#
# HISTORY (2026-06-23, Jonah): an earlier version asserted "name is what makes a
# teammate a visible cmux split" and passed any named spawn. Named spawns were in
# fact NOT rendering as panes. Root cause was traced and FIXED
# (session_2026-06-23_cmux-teammate-pane-FIX.md): the harness spawns a teammate by
# `respawn-pane`'ing a cmux pane with a COMPOUND command (cd ... && env ...
# claude.exe ...); cmux's __tmux-compat runs respawn/split commands via execvp on
# the whitespace-split string (no shell), so the first token `cd` (a builtin)
# fails and the pane dies. The user-owned tmux shim
# (~/.cmuxterm/claude-teams-bin/tmux) now wraps such compound commands in a
# one-token launch script, and teammates render + run correctly (verified: a
# spawned teammate appeared as cmux surface:39 with a live claude.exe process that
# executed its task). So: `name` is required AND now sufficient for a visible
# pane, PROVIDED the shim fix is in place (cmux regenerates the stock shim per
# session). The pass-path notice points the spawner at that dependency.
# team-reaper.sh cleans up the per-session team/task dirs on session end.
#
# HISTORY (2026-07-26, Jonah): every gate below is a LEAD-session concern - it
# exists to make a spawn land as a visible cmux pane. A teammate has no pane to
# spawn into, and the agent-teams runtime REJECTS a named spawn that originates
# from a teammate ("Teammates cannot spawn other teammates - the team roster is
# flat"). So inside a teammate this hook's name REQUIREMENT and the runtime's name
# PROHIBITION cancelled out and no spawn shape was possible at all: unnamed was
# denied here, named was denied there. A teammate session could not delegate
# (fan-out, independent reviewers) and had to do everything inline. Fix: a
# teammate context is EXEMPT from every gate in this hook. The lead's
# named-teammate mandate is untouched. See
# session_2026-07-26_teammate-spawn-hook-contradiction-fix.md.

set -euo pipefail

# Skip when not in cmux-teams mode. Empty stdout signals no decision -> allow.
if [ -z "${CMUX_SOCKET_PATH:-}" ] || [ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-0}" != "1" ]; then
  echo '{}'
  exit 0
fi

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print(d.get("tool_name","") or "")' 2>/dev/null)

emit_deny() {
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$1"
  exit 0
}

emit_allow_with_notice() {
  # No permissionDecision -> the tool proceeds via the normal permission flow;
  # additionalContext surfaces the notice without ever blocking the call.
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','additionalContext':sys.argv[1]}}))" "$1"
  exit 0
}

# --- teammate vs lead context -------------------------------------------------
# A teammate inherits CMUX_SOCKET_PATH and CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
# from the lead, so the mode check above cannot tell the two apart. Detect the
# teammate case explicitly and exempt it (see the 2026-07-26 history note).
#
# Either ONE signal is enough. Exempting is the fail-safe direction: a missed
# teammate deadlocks delegation entirely, while a misread lead only loses a
# spawn-shape nudge.
#   1. transcript records carrying `teamName` or `isSidechain: true` - the same
#      signal memory-nudge.sh and verify-before-done.sh already key off. Verified
#      2026-07-26: a teammate transcript carries teamName from record 3 onward; a
#      lead transcript carries neither. An in-process sidechain subagent of the
#      LEAD trips isSidechain and is exempted too, which is correct - it has no
#      pane of its own either.
#   2. an ancestor process argv carrying --agent-id / --agent-name /
#      --parent-session-id - the flags the harness launches a teammate with.
#      CAUTION: the LEAD's argv carries --teammate-mode, so never match on the
#      word "teammate" here; only those three flags are teammate-only.
#
# REJECTED SIGNAL - do not re-add: CLAUDE_CODE_CHILD_SESSION. It reads like a
# teammate marker and IS present in a teammate's hook env, but claude.exe sets it
# unconditionally on every process it spawns, in every session - it is hardcoded
# next to CLAUDECODE / CLAUDE_PID in the child-env builder, with no teammate
# condition. Keying off it exempted the LEAD too, silently voiding the mandate
# this hook exists for (caught by an independent review, 2026-07-26). Note the
# trap that produced it: `ps eww` on the lead's own pid shows the lead's EXEC-time
# env, which cannot show what claude passes to its CHILDREN, so the var looks
# teammate-only when checked that way. Inspect a lead-spawned child process
# instead.
#
# Seams: AGENT_TEAMS_GUARD_FORCE_CONTEXT=teammate|lead is a break-glass and the
# hermetic-test hook; AGENT_TEAMS_GUARD_PS points the ancestor walk at a stub ps.
# Both are ambient env, so the emitted notice names whichever signal fired - a
# stray export is then diagnosable from the transcript instead of invisible.
PS_BIN="${AGENT_TEAMS_GUARD_PS:-ps}"

_transcript_says_teammate() {
  printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print("0"); sys.exit(0)
path = data.get("transcript_path") or ""
if not path:
    print("0"); sys.exit(0)
try:
    with open(path) as fh:
        for i, line in enumerate(fh):
            if i > 20:  # only the header + first few records carry these
                break
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("isSidechain") is True or d.get("teamName"):
                print("1"); sys.exit(0)
except OSError:
    pass
print("0")
' 2>/dev/null || printf '0'
}

_ancestor_is_teammate() {
  local p cmd i
  p="${PPID:-}"
  [ -n "$p" ] || return 1
  i=0
  while [ -n "$p" ] && [ "$p" != "0" ] && [ "$p" != "1" ] && [ "$i" -lt 12 ]; do
    # -ww: BSD/macOS ps truncates `command` to the terminal width unless widened.
    # The teammate flags sit early in argv so truncation has not been observed,
    # but a long wrapper path could push them past the cut and misread a teammate
    # as the lead - which is the deadlock direction. (Codex review, 2026-07-26.)
    cmd=$("$PS_BIN" -ww -o command= -p "$p" 2>/dev/null) || cmd=""
    case "$cmd" in
      *--agent-id*|*--agent-name*|*--parent-session-id*) return 0 ;;
      # A claude session WITHOUT those flags is the lead. Stop there rather than
      # walking on into cmux/login/launchd.
      */claude.exe*|*/claude\ *) return 1 ;;
    esac
    p=$("$PS_BIN" -o ppid= -p "$p" 2>/dev/null | tr -d '[:space:]') || p=""
    i=$((i + 1))
  done
  return 1
}

TEAMMATE_SIGNAL=""

is_teammate_context() {
  case "${AGENT_TEAMS_GUARD_FORCE_CONTEXT:-}" in
    teammate) TEAMMATE_SIGNAL="AGENT_TEAMS_GUARD_FORCE_CONTEXT=teammate"; return 0 ;;
    lead)     return 1 ;;
  esac
  if [ "$(_transcript_says_teammate)" = "1" ]; then
    TEAMMATE_SIGNAL="transcript teamName/isSidechain"
    return 0
  fi
  if _ancestor_is_teammate; then
    TEAMMATE_SIGNAL="ancestor argv --agent-id"
    return 0
  fi
  return 1
}

# Teammate: exempt from every gate below, and never deny. Denying the named shape
# too (the runtime rejects it) would only re-create the deadlock from the other
# side if detection ever misread a lead, so this path only ever advises.
if is_teammate_context; then
  emit_allow_with_notice "Teammate context (detected via: ${TEAMMATE_SIGNAL}): this session is a spawned teammate, not the lead, so the cmux-teams spawn gates (name required, no run_in_background, no Workflow) do NOT apply - a teammate has no pane of its own to spawn into. Spawn UNNAMED in-process subagents: Agent({subagent_type, prompt}). Do NOT pass name (or team_name): the runtime rejects a named spawn from a teammate with 'Teammates cannot spawn other teammates - the team roster is flat'. Relay results to the lead with SendMessage."
fi

# Workflow spawns silent in-process subagents that can never appear as cmux
# splits. In cmux-teams mode that defeats the team flow, so it is hard-blocked.
if [ "$TOOL_NAME" = "Workflow" ]; then
  emit_deny "BLOCKED: the Workflow tool spawns silent in-process subagents that cannot appear as cmux splits. This session is inside cmux with agent-teams enabled (CMUX_SOCKET_PATH set, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1). Do NOT use Workflow here. Spawn a named teammate instead: Agent({subagent_type, name, prompt}) - and do NOT pass team_name (deprecated; the session has one implicit team). Coordinate via SendMessage and a shared TaskList."
fi

# Only gate the Agent tool from here. Anything else passes through.
if [ "$TOOL_NAME" != "Agent" ]; then
  echo '{}'
  exit 0
fi

NAME=$(echo "$INPUT" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print((d.get("tool_input") or {}).get("name","") or "")' 2>/dev/null)

RUN_BG=$(echo "$INPUT" | python3 -c 'import json,sys
d=json.load(sys.stdin)
v=(d.get("tool_input") or {}).get("run_in_background", False)
print("1" if v in (True,"true","True",1) else "0")' 2>/dev/null)

# Missing name: not a teammate. Block.
if [ -z "$NAME" ]; then
  emit_deny "BLOCKED: inside cmux with agent-teams enabled, every Agent call must spawn as a NAMED teammate so it gets its own visible cmux pane. Re-issue with a name: Agent({subagent_type, name, prompt}). Do NOT pass team_name (deprecated; passing it triggers a 'session team not found' error). Coordinate via SendMessage + a shared TaskList."
fi

# Background = invisible. A background subagent runs in-process and can NEVER be a
# cmux split/pane. Block unless the user explicitly asked for a background agent.
if [ "$RUN_BG" = "1" ]; then
  emit_deny "BLOCKED: run_in_background:true makes an INVISIBLE in-process subagent - it can never appear as a cmux pane/split. You named the agent to make it a visible teammate, then set run_in_background, which defeats that. Re-issue WITHOUT run_in_background for a visible (foreground) teammate that renders as its own cmux pane. Use run_in_background ONLY if the user EXPLICITLY asked for a background/invisible agent."
fi

# Named foreground Agent - the correct teammate form. Allow, with a note about
# the shim dependency that makes panes actually render here.
emit_allow_with_notice "Named teammate spawn permitted - it renders as its own visible cmux pane. This depends on the tmux-shim fix at ~/.cmuxterm/claude-teams-bin/tmux: cmux's __tmux-compat cannot run the harness's compound respawn command (cd ... && env ... claude.exe ...) so the shim wraps it in a one-token launch script (see session_2026-06-23_cmux-teammate-pane-FIX.md). cmux REGENERATES the stock shim per 'cmux claude-teams' launch, so if a teammate ever fails to appear or run, re-apply that shim fix (stock backup: tmux.orig). Verify with 'tmux list-panes -a' / 'cmux list-panels' / 'ps aux | grep claude.exe'."
