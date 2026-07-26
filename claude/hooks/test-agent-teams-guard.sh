#!/usr/bin/env bash
# Regression tests for agent-teams-guard.sh.
#
# THE INCIDENT (2026-07-26): a teammate session could not spawn a subagent at all.
# This hook required every Agent call to carry a `name`; the agent-teams runtime
# rejects a NAMED spawn originating from a teammate ("Teammates cannot spawn other
# teammates - the team roster is flat"). Unnamed was denied here, named was denied
# there, so a teammate had no working delegation shape and did everything inline.
#
# THE NEAR-MISS (same day, caught by an independent review): the first fix keyed
# teammate detection off CLAUDE_CODE_CHILD_SESSION. claude.exe sets that var on
# EVERY process it spawns in EVERY session, so it exempted the lead too and
# silently voided the mandate. The `lead + CLAUDE_CODE_CHILD_SESSION=1` case below
# is that regression, pinned.
#
# Three guarantees:
#   1. The LEAD's named-teammate mandate is intact: unnamed Agent, background
#      Agent, and Workflow all still deny - including when the ambient env carries
#      CLAUDE_CODE_CHILD_SESSION=1, which it always does.
#   2. A TEAMMATE session is exempt from every gate - by each detection signal
#      independently, so losing one signal does not resurrect the deadlock.
#   3. The guard always exits 0 with parseable JSON. A crashed hook that emits
#      nothing must never be scored as an allow.
#
# Hermetic: no real cmux, no real teammate. cmux-teams mode is faked with env,
# teammate detection is driven by a stub `ps` plus transcript fixtures. The suite
# must pass identically whether run from a lead session or from inside a teammate,
# so every case pins every signal rather than inheriting any of them.
#
# Run:  bash claude/hooks/test-agent-teams-guard.sh
set -uo pipefail

GUARD="$(cd "$(dirname "$0")" && pwd)/agent-teams-guard.sh"
TMP="$(mktemp -d)"
[ -n "$TMP" ] && [ -d "$TMP" ] || { echo "setup failed: no temp dir" >&2; exit 2; }
PASS=0
FAIL=0
trap 'rm -rf "$TMP"' EXIT

# --- stub ps: drives the ancestor-argv signal --------------------------------
# The walk calls: ps -ww -o command= -p <pid>   and   ps -o ppid= -p <pid>
# so each stub scans its args for the field selector rather than a fixed position.

# A teammate: claude.exe launched with the harness's per-agent flags.
cat > "$TMP/ps-teammate" <<'EOF'
#!/bin/bash
# Scan args for the field selector: the guard passes -ww to the command= call,
# so the selector is not at a fixed position.
field=""
for a in "$@"; do case "$a" in ppid=|command=) field="$a" ;; esac; done
case "$field" in
  ppid=)    echo 1 ;;
  command=) echo "/n/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe --agent-id x@session-1 --agent-name x --team-name session-1 --parent-session-id p1 --agent-type general-purpose" ;;
esac
EOF

# The lead: note --teammate-mode, which is NOT a teammate marker. Matching the
# word "teammate" here would misread every lead as a teammate.
cat > "$TMP/ps-lead" <<'EOF'
#!/bin/bash
# Scan args for the field selector: the guard passes -ww to the command= call,
# so the selector is not at a fixed position.
field=""
for a in "$@"; do case "$a" in ppid=|command=) field="$a" ;; esac; done
case "$field" in
  ppid=)    echo 1 ;;
  command=) echo "/opt/homebrew/bin/claude --append-system-prompt You are Claude Code running inside cmux --resume abc123 --teammate-mode tmux" ;;
esac
EOF

# No claude ancestor at all (the walk runs out without deciding).
cat > "$TMP/ps-none" <<'EOF'
#!/bin/bash
# Scan args for the field selector: the guard passes -ww to the command= call,
# so the selector is not at a fixed position.
field=""
for a in "$@"; do case "$a" in ppid=|command=) field="$a" ;; esac; done
case "$field" in
  ppid=)    echo 1 ;;
  command=) echo "/bin/zsh -l" ;;
esac
EOF
chmod +x "$TMP/ps-teammate" "$TMP/ps-lead" "$TMP/ps-none"

# --- transcript fixtures: drive the transcript signal -------------------------
cat > "$TMP/transcript-teammate.jsonl" <<'EOF'
{"type":"agent-setting"}
{"type":"mode"}
{"type":"user","isSidechain":false,"teamName":"session-2073a2f8","agentName":"hook-fixer"}
EOF

cat > "$TMP/transcript-lead.jsonl" <<'EOF'
{"type":"agent-setting"}
{"type":"mode"}
{"type":"user","isSidechain":false,"cwd":"/repo"}
EOF

# --- harness -----------------------------------------------------------------
# decision <tool> <name> <run_in_background> <ctx> [nocmux]
#   ctx: lead              lead transcript + lead ps, child-session var stripped
#        lead-childenv     same, but CLAUDE_CODE_CHILD_SESSION=1 (the always-on
#                          ambient value) - must still enforce
#        teammate-script   teammate transcript only (ps says lead)
#        teammate-ps       teammate ancestor argv only (transcript says lead)
#        teammate-nops     teammate transcript, ps sees no claude ancestor at all
#        forced-teammate   AGENT_TEAMS_GUARD_FORCE_CONTEXT=teammate over lead signals
#        forced-lead       AGENT_TEAMS_GUARD_FORCE_CONTEXT=lead over teammate signals
# Prints the permission decision, or crash(...)/unparseable - never a silent allow.
decision() {
  local tool="$1" name="$2" bg="$3" ctx="$4" nocmux="${5:-}"
  local ps_stub="$TMP/ps-lead" transcript="$TMP/transcript-lead.jsonl"
  local -a extra=("AGENT_TEAMS_GUARD_FORCE_CONTEXT=")
  case "$ctx" in
    lead)            ;;
    lead-childenv)   extra+=("CLAUDE_CODE_CHILD_SESSION=1") ;;
    teammate-script) transcript="$TMP/transcript-teammate.jsonl" ;;
    teammate-ps)     ps_stub="$TMP/ps-teammate" ;;
    teammate-nops)   transcript="$TMP/transcript-teammate.jsonl"; ps_stub="$TMP/ps-none" ;;
    forced-teammate) extra=("AGENT_TEAMS_GUARD_FORCE_CONTEXT=teammate") ;;
    forced-lead)
      extra=("AGENT_TEAMS_GUARD_FORCE_CONTEXT=lead" "CLAUDE_CODE_CHILD_SESSION=1")
      transcript="$TMP/transcript-teammate.jsonl"; ps_stub="$TMP/ps-teammate" ;;
  esac

  local payload
  payload=$(python3 -c '
import json, sys
tool, name, bg, transcript = sys.argv[1:5]
ti = {"subagent_type": "general-purpose", "prompt": "do the thing"}
if name:
    ti["name"] = name
if bg == "1":
    ti["run_in_background"] = True
print(json.dumps({"tool_name": tool, "session_id": "test-atg",
                  "transcript_path": transcript, "tool_input": ti}))' \
    "$tool" "$name" "$bg" "$transcript")

  local -a mode=("CMUX_SOCKET_PATH=/tmp/atg-fake.sock" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1")
  [ -z "$nocmux" ] || mode=("CMUX_SOCKET_PATH=" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1")

  local out rc
  out=$(printf '%s' "$payload" | env -u CLAUDE_CODE_CHILD_SESSION \
    -u AGENT_TEAMS_GUARD_FORCE_CONTEXT \
    "${mode[@]}" "AGENT_TEAMS_GUARD_PS=$ps_stub" "${extra[@]}" \
    bash "$GUARD" 2>/dev/null)
  rc=$?
  # A hook that dies emits nothing. Scoring that as "allow" would let 13 of the
  # cases below pass on a guard that never ran, so it is its own verdict.
  if [ "$rc" -ne 0 ]; then printf 'crash(exit=%s)\n' "$rc"; return; fi
  if [ -z "$out" ]; then printf 'crash(no output)\n'; return; fi
  printf '%s' "$out" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("unparseable"); sys.exit(0)
h = d.get("hookSpecificOutput") or {}
print(h.get("permissionDecision", "allow"))'
}

expect() {  # expect <want> <label> <tool> <name> <bg> <ctx> [nocmux]
  local want="$1" label="$2"; shift 2
  local got; got="$(decision "$@")"
  if [ "$got" = "$want" ]; then
    PASS=$((PASS + 1)); printf "  ok    %-58s -> %s\n" "$label" "$got"
  else
    FAIL=$((FAIL + 1)); printf "  FAIL  %-58s -> %s (wanted %s)\n" "$label" "$got" "$want"
  fi
}

D="deny"; A="allow"

echo "LEAD session - the named-teammate mandate must be intact:"
expect "$D" "unnamed Agent"                     Agent ""     0 lead
expect "$D" "unnamed background Agent"          Agent ""     1 lead
expect "$D" "named background Agent"            Agent "prod" 1 lead
expect "$D" "Workflow"                          Workflow ""  0 lead
expect "$A" "named foreground Agent"            Agent "prod" 0 lead

echo
echo "LEAD detection must survive the two look-alike teammate markers:"
# CLAUDE_CODE_CHILD_SESSION=1 is present in EVERY session's hook env (claude.exe
# hardcodes it in its child-env builder), and the lead's own argv carries
# --teammate-mode. Reading either as a teammate marker voids the mandate silently.
expect "$D" "lead + CLAUDE_CODE_CHILD_SESSION=1 still enforced"  Agent ""     0 lead-childenv
expect "$D" "lead + CHILD_SESSION, background variant"           Agent ""     1 lead-childenv
expect "$D" "lead + CHILD_SESSION, Workflow variant"             Workflow ""  0 lead-childenv
expect "$A" "lead + CHILD_SESSION, named foreground still passes" Agent "prod" 0 lead-childenv
expect "$D" "lead argv has --teammate-mode, still enforced"      Agent ""     0 lead

echo
echo "TEAMMATE session - every gate exempt, by EACH signal on its own:"
expect "$A" "unnamed Agent via transcript teamName"       Agent ""  0 teammate-script
expect "$A" "unnamed Agent via ancestor --agent-id"       Agent ""  0 teammate-ps
expect "$A" "unnamed Agent when ps sees no claude at all"  Agent ""  0 teammate-nops

echo
echo "TEAMMATE session - the hook never denies, whatever the spawn shape:"
# The runtime rejects the named shape; this hook advising instead of denying is
# what keeps a detection miss from re-creating the deadlock from the other side.
expect "$A" "unnamed background Agent"           Agent ""     1 teammate-script
expect "$A" "named Agent"                        Agent "prod" 0 teammate-script
expect "$A" "named background Agent"             Agent "prod" 1 teammate-script
expect "$A" "Workflow"                           Workflow ""  0 teammate-script

echo
echo "Break-glass override wins over the signals in both directions:"
expect "$A" "forced teammate over lead signals"  Agent ""     0 forced-teammate
expect "$D" "forced lead over teammate signals"  Agent ""     0 forced-lead

echo
echo "Outside cmux-teams mode the hook is a no-op:"
expect "$A" "unnamed Agent, no CMUX_SOCKET_PATH" Agent ""     0 lead nocmux
expect "$A" "Workflow, no CMUX_SOCKET_PATH"      Workflow ""  0 lead nocmux

echo
echo "Detection survives a broken ps and an unreadable transcript:"
# ps is the second signal's only source and the transcript the first's. Neither
# failing may crash the guard; both failing just means "lead".
BADPS="$TMP/no-such-ps"
for label in "ps binary missing" "transcript path missing"; do
  case "$label" in
    "ps binary missing") T="$TMP/transcript-lead.jsonl"; P="$BADPS" ;;
    *)                   T="$TMP/no-such-transcript.jsonl"; P="$TMP/ps-lead" ;;
  esac
  OUT=$(printf '{"tool_name":"Agent","session_id":"t","transcript_path":"%s","tool_input":{"subagent_type":"general-purpose","prompt":"x"}}' "$T" \
    | env -u CLAUDE_CODE_CHILD_SESSION AGENT_TEAMS_GUARD_FORCE_CONTEXT= \
      CMUX_SOCKET_PATH=/tmp/atg-fake.sock CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 \
      "AGENT_TEAMS_GUARD_PS=$P" bash "$GUARD" 2>/dev/null)
  RC=$?
  if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q '"permissionDecision": "deny"'; then
    PASS=$((PASS + 1)); printf "  ok    %-58s -> deny (exit 0)\n" "$label"
  else
    FAIL=$((FAIL + 1)); printf "  FAIL  %-58s -> exit=%s out=%s\n" "$label" "$RC" "$OUT"
  fi
done

echo
echo "The teammate pass path explains the shape AND names the firing signal:"
NOTICE=$(printf '%s' '{"tool_name":"Agent","session_id":"t","transcript_path":"","tool_input":{"subagent_type":"general-purpose","prompt":"x"}}' \
  | env -u CLAUDE_CODE_CHILD_SESSION CMUX_SOCKET_PATH=/tmp/atg-fake.sock \
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 AGENT_TEAMS_GUARD_FORCE_CONTEXT=teammate \
    bash "$GUARD" 2>/dev/null)
case "$NOTICE" in
  *"Teammate context (detected via: AGENT_TEAMS_GUARD_FORCE_CONTEXT=teammate)"*"UNNAMED"*"roster is flat"*)
    PASS=$((PASS + 1)); printf "  ok    %-58s -> present\n" "notice names the signal, the shape, and the rule" ;;
  *)
    FAIL=$((FAIL + 1)); printf "  FAIL  %-58s -> %s\n" "notice names the signal, the shape, and the rule" "$NOTICE" ;;
esac

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
