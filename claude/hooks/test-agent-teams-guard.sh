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
# _invoke prints the guard's RAW stdout (empty on crash); decision() reduces that
# to a permission verdict and advice() to the notice text. Both directions of the
# hook's output matter: the 2026-07-26 lead misfire ALLOWED the spawn and only
# inverted the ADVICE, so a decision-only assertion passed it. (Reported live by
# team-lead: a named lead spawn succeeded but was told "you are a teammate, spawn
# UNNAMED".)
#
# PANES (6th arg, default "yes"): pins AGENT_TEAMS_GUARD_FORCE_PANES so the
# ambient TMUX of whatever session runs this suite can never decide a case. This
# matters more than the other pins: a LEAD case run with panes unpinned inherits
# the runner's TMUX, and a teammate shell has TMUX unset, so every lead deny
# would silently become the pane-fallback allow. Default "yes" keeps every
# pre-2026-07-27 case meaning exactly what it meant when it was written.
_invoke() {
  local tool="$1" name="$2" bg="$3" ctx="$4" nocmux="${5:-}" panes="${6:-yes}"
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
  # Appended AFTER the case block on purpose: forced-teammate/forced-lead REPLACE
  # `extra` wholesale, so pinning panes inside the initialiser would be dropped by
  # exactly the two cases that assert the break-glass override.
  extra+=("AGENT_TEAMS_GUARD_FORCE_PANES=$panes")

  local payload
  payload=$(python3 -c '
import json, sys
tool, name, bg, transcript = sys.argv[1:5]
ti = {"subagent_type": "general-purpose", "prompt": "do the thing"}
if name:
    ti["name"] = name
# Three DISTINCT payload shapes, because the harness really does send three
# (dumped from live spawns 2026-07-27):
#   bg "1"     -> "run_in_background": true
#   bg "false" -> "run_in_background": false
#   bg "0"     -> key ABSENT entirely. This is what the model omitting the
#                 parameter looks like on the wire; the runtime does NOT
#                 materialise its documented true-default into tool_input, so
#                 "absent" and "false" are indistinguishable to the hook.
if bg == "1":
    ti["run_in_background"] = True
elif bg == "false":
    ti["run_in_background"] = False
print(json.dumps({"tool_name": tool, "session_id": "test-atg",
                  "transcript_path": transcript, "tool_input": ti}))' \
    "$tool" "$name" "$bg" "$transcript")

  local -a mode=("CMUX_SOCKET_PATH=/tmp/atg-fake.sock" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1")
  [ -z "$nocmux" ] || mode=("CMUX_SOCKET_PATH=" "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1")

  local out rc
  out=$(printf '%s' "$payload" | env -u CLAUDE_CODE_CHILD_SESSION \
    -u AGENT_TEAMS_GUARD_FORCE_CONTEXT -u TMUX -u TMUX_PANE \
    "${mode[@]}" "AGENT_TEAMS_GUARD_PS=$ps_stub" "${extra[@]}" \
    bash "$GUARD" 2>/dev/null)
  rc=$?
  [ "$rc" -eq 0 ] || return 1
  printf '%s' "$out"
}

# Prints the permission decision, or crash(...)/unparseable - never a silent allow.
decision() {
  local out
  # A hook that dies emits nothing. Scoring that as "allow" would let most of the
  # cases below pass on a guard that never ran, so it is its own verdict.
  out=$(_invoke "$@") || { printf 'crash(nonzero exit)\n'; return; }
  [ -n "$out" ] || { printf 'crash(no output)\n'; return; }
  printf '%s' "$out" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("unparseable"); sys.exit(0)
h = d.get("hookSpecificOutput") or {}
print(h.get("permissionDecision", "allow"))'
}

# Prints the advisory notice the pass path attaches (additionalContext).
advice() {
  local out
  out=$(_invoke "$@") || { printf 'crash(nonzero exit)\n'; return; }
  [ -n "$out" ] || { printf 'crash(no output)\n'; return; }
  printf '%s' "$out" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("unparseable"); sys.exit(0)
h = d.get("hookSpecificOutput") or {}
print(h.get("additionalContext", "") or h.get("permissionDecisionReason", "") or "(none)")'
}

# expect_advice <substring-that-must-appear> <substring-that-must-NOT-appear|-> <label> <tool> <name> <bg> <ctx>
expect_advice() {
  local want="$1" forbid="$2" label="$3"; shift 3
  local got; got="$(advice "$@")"
  local okwant=1 okforbid=1
  case "$got" in *"$want"*) ;; *) okwant=0 ;; esac
  if [ "$forbid" != "-" ]; then
    case "$got" in *"$forbid"*) okforbid=0 ;; esac
  fi
  if [ "$okwant" -eq 1 ] && [ "$okforbid" -eq 1 ]; then
    PASS=$((PASS + 1)); printf "  ok    %-58s -> %s...\n" "$label" "$(printf '%s' "$got" | cut -c1-32)"
  else
    FAIL=$((FAIL + 1)); printf "  FAIL  %-58s -> %s\n" "$label" "$(printf '%s' "$got" | cut -c1-90)"
  fi
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
echo "THE LEAD MISFIRE (reported live 2026-07-26) - the ADVICE must not invert:"
# team-lead spawned Agent name=artifact-builder and the hook attached the TEAMMATE
# notice ("you are a spawned teammate ... spawn UNNAMED ... do NOT pass name").
# The spawn still SUCCEEDED, which is why the decision-only cases above passed
# right through it. Only asserting the notice text catches this class.
expect_advice "Named teammate spawn permitted" "Teammate context" \
  "named lead spawn is told it is the LEAD"        Agent "artifact-builder" 0 lead-childenv
expect_advice "Named teammate spawn permitted" "Teammate context" \
  "same, with only the ambient lead signals"       Agent "artifact-builder" 0 lead
expect_advice "Teammate context" "Named teammate spawn permitted" \
  "a real teammate is still told it is a teammate" Agent ""                 0 teammate-script

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
echo "run_in_background: the three payload shapes the harness actually sends:"
# The Agent schema documents background as its DEFAULT, so absence LOOKS like it
# should mean true. It must not be read that way: in pane-capable session-d883bc0d
# all four named teammates were spawned with the key ABSENT and all four got real
# tmux pane ids. Denying the absent shape would deny the only shape proven to
# produce a pane.
expect "$A" "named, run_in_background ABSENT (the shape that panes)" Agent "prod" 0     lead
expect "$A" "named, run_in_background explicitly false"              Agent "prod" false lead
expect "$D" "named, run_in_background explicitly true"               Agent "prod" 1     lead
expect_advice "run_in_background key OMITTED" "-" \
  "the background deny names the exact re-issue shape"               Agent "prod" 1     lead

echo
echo "PANE FALLBACK (2026-07-27) - a session that cannot make panes:"
# session-c3ca5a31: the guard denied background telling the spawner to re-issue
# "for a visible teammate that renders as its own cmux pane", the spawner
# complied, and the re-issue registered backendType in-process with NO pane. Then
# it permitted that spawn claiming it "renders as its own visible cmux pane".
# Both messages were false in the session they fired in. Nothing may DENY here,
# because no other shape could have succeeded either.
expect "$A" "unnamed Agent is not denied when panes are impossible"  Agent ""     0 lead "" no
expect "$A" "named background Agent is not denied either"            Agent "prod" 1 lead "" no
expect "$A" "Workflow is not denied either"                          Workflow ""  0 lead "" no
expect "$A" "named foreground Agent still allowed"                   Agent "prod" 0 lead "" no
expect_advice "PANE FALLBACK" "renders as its own visible cmux pane" \
  "fallback notice never promises a pane"                            Agent "prod" 0 lead "" no
expect_advice "relaunch the session with 'cmux claude-teams'" "-" \
  "fallback notice gives an action that works in-session"            Agent ""     0 lead "" no
expect_advice "renders as its own visible cmux pane" "PANE FALLBACK" \
  "a pane-capable lead still gets the pane promise"                  Agent "prod" 0 lead "" yes
# Ordering: the teammate exemption must win over the pane check, since a teammate
# legitimately has TMUX unset while still owning a real pane (measured: teammate
# pid 61831 has no TMUX, tmuxPaneId %3758...).
expect_advice "Teammate context" "PANE FALLBACK" \
  "teammate exemption is checked before pane capability"             Agent ""     0 teammate-script "" no

echo
echo "Pane capability is read from the REAL TMUX vars, and needs BOTH:"
# The seam is bypassed here so the env predicate itself is under test. Requiring
# both vars is deliberate: a partial env (the classic case is TMUX_PANE leaking
# into a child that is no longer inside tmux) must NOT be read as pane-capable,
# because that re-enables the unactionable denies this whole block prevents.
# (Codex review, 2026-07-27.)
env_panes() { # env_panes <TMUX> <TMUX_PANE>
  printf '{"tool_name":"Agent","session_id":"t","transcript_path":"%s","tool_input":{"subagent_type":"general-purpose","prompt":"x"}}' \
    "$TMP/transcript-lead.jsonl" \
  | env -u CLAUDE_CODE_CHILD_SESSION -u AGENT_TEAMS_GUARD_FORCE_PANES \
      AGENT_TEAMS_GUARD_FORCE_CONTEXT= TMUX="$1" TMUX_PANE="$2" \
      CMUX_SOCKET_PATH=/tmp/atg-fake.sock CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 \
      "AGENT_TEAMS_GUARD_PS=$TMP/ps-lead" bash "$GUARD" 2>/dev/null
}
expect_env() { # expect_env <want-decision> <label> <TMUX> <TMUX_PANE>
  local want="$1" label="$2" out got
  out=$(env_panes "$3" "$4") || { FAIL=$((FAIL+1)); printf "  FAIL  %-58s -> crash\n" "$label"; return; }
  got=$(printf '%s' "$out" | python3 -c 'import json,sys
try: d=json.load(sys.stdin)
except Exception: print("unparseable"); sys.exit(0)
print((d.get("hookSpecificOutput") or {}).get("permissionDecision","allow"))')
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); printf "  ok    %-58s -> %s\n" "$label" "$got"
  else FAIL=$((FAIL+1)); printf "  FAIL  %-58s -> %s (wanted %s)\n" "$label" "$got" "$want"; fi
}
expect_env "$D" "both TMUX and TMUX_PANE set -> gates enforced" "/tmp/s,1,2" "%42"
expect_env "$A" "TMUX only (partial env) -> advise, never deny"  "/tmp/s,1,2" ""
expect_env "$A" "TMUX_PANE only (stale leak) -> advise, never deny" ""        "%42"
expect_env "$A" "neither set -> advise, never deny"              ""           ""

echo
echo "A broken guard must fail SOFT but never QUIET (guarantee #3):"
# Under set -euo pipefail an assignment inherits its command substitution's exit
# status, so unparseable stdin used to abort the hook and emit NOTHING - the one
# outcome that can be misread as a silent allow. (Codex review, 2026-07-27.)
for label in "malformed JSON on stdin" "empty stdin"; do
  case "$label" in
    "malformed JSON on stdin") STDIN='{"tool_name": "Agent", BROKEN' ;;
    *)                         STDIN='' ;;
  esac
  # ps MUST be pinned to the lead stub. Without it the real ps runs, and when this
  # suite is executed from inside a real teammate the ancestor walk finds
  # --agent-id and takes the teammate exemption before the parse-failure branch is
  # ever reached - the case would then silently test nothing. (Caught doing exactly
  # that while writing these two cases.)
  OUT=$(printf '%s' "$STDIN" | env -u CLAUDE_CODE_CHILD_SESSION -u TMUX -u TMUX_PANE \
    AGENT_TEAMS_GUARD_FORCE_CONTEXT= CMUX_SOCKET_PATH=/tmp/atg-fake.sock \
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 "AGENT_TEAMS_GUARD_PS=$TMP/ps-lead" \
    bash "$GUARD" 2>/dev/null)
  RC=$?
  VALID=$(printf '%s' "$OUT" | python3 -c 'import json,sys
try: json.load(sys.stdin); print("yes")
except Exception: print("no")')
  case "$OUT" in *"gates were SKIPPED"*) LOUD=yes ;; *) LOUD=no ;; esac
  if [ "$RC" -eq 0 ] && [ "$VALID" = yes ] && [ "$LOUD" = yes ]; then
    PASS=$((PASS+1)); printf "  ok    %-58s -> exit 0, valid JSON, says so\n" "$label"
  else
    FAIL=$((FAIL+1)); printf "  FAIL  %-58s -> rc=%s valid=%s loud=%s out=%s\n" "$label" "$RC" "$VALID" "$LOUD" "$OUT"
  fi
done

echo
echo "A guard that cannot EVALUATE a call must fail OPEN, never deny:"
# Fail-closed regression: tool_name parses as Agent but tool_input is not an
# object, so the NAME parse returns empty and the missing-name gate denies - a
# spawn blocked because the guard could not read its own payload. The stated rule
# is the opposite. (Codex confirmation review, 2026-07-27.)
for shape in '"a string"' '[1,2,3]' 'null'; do
  OUT=$(printf '{"tool_name":"Agent","session_id":"t","transcript_path":"%s","tool_input":%s}' \
      "$TMP/transcript-lead.jsonl" "$shape" \
    | env -u CLAUDE_CODE_CHILD_SESSION -u TMUX -u TMUX_PANE AGENT_TEAMS_GUARD_FORCE_CONTEXT= \
      AGENT_TEAMS_GUARD_FORCE_PANES=yes CMUX_SOCKET_PATH=/tmp/atg-fake.sock \
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 "AGENT_TEAMS_GUARD_PS=$TMP/ps-lead" \
      bash "$GUARD" 2>/dev/null)
  RC=$?
  GOT=$(printf '%s' "$OUT" | python3 -c 'import json,sys
try: d=json.load(sys.stdin)
except Exception: print("unparseable"); sys.exit(0)
print((d.get("hookSpecificOutput") or {}).get("permissionDecision","allow"))' 2>/dev/null)
  if [ "$RC" -eq 0 ] && [ "$GOT" = "allow" ]; then
    PASS=$((PASS+1)); printf "  ok    %-58s -> allow (exit 0)\n" "tool_input is $shape -> not denied"
  else
    FAIL=$((FAIL+1)); printf "  FAIL  %-58s -> rc=%s decision=%s\n" "tool_input is $shape -> not denied" "$RC" "$GOT"
  fi
done

# python3 is what every parse AND both emitters run on. Without it the hook used
# to exit 127 with no stdout - a hook that emits nothing, which is the one
# outcome guarantee #3 forbids. PATH is stripped to /bin so python3 is genuinely
# unreachable. Skipped if this box happens to ship /bin/python3.
if [ -x /bin/python3 ]; then
  printf "  skip  %-58s -> /bin/python3 exists on this box\n" "python3 unavailable still emits valid JSON"
else
  OUT=$(printf '{"tool_name":"Agent","session_id":"t","tool_input":{"prompt":"x"}}' \
    | env -i PATH=/bin CMUX_SOCKET_PATH=/tmp/atg-fake.sock \
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 /bin/bash "$GUARD" 2>/dev/null)
  RC=$?
  VALID=$(printf '%s' "$OUT" | python3 -c 'import json,sys
try: json.load(sys.stdin); print("yes")
except Exception: print("no")')
  case "$OUT" in *"python3 is not on PATH"*) LOUD=yes ;; *) LOUD=no ;; esac
  if [ "$RC" -eq 0 ] && [ "$VALID" = yes ] && [ "$LOUD" = yes ]; then
    PASS=$((PASS+1)); printf "  ok    %-58s -> exit 0, valid JSON, says so\n" "python3 unavailable still emits valid JSON"
  else
    FAIL=$((FAIL+1)); printf "  FAIL  %-58s -> rc=%s valid=%s loud=%s out=%s\n" "python3 unavailable still emits valid JSON" "$RC" "$VALID" "$LOUD" "$OUT"
  fi
fi

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
    | env -u CLAUDE_CODE_CHILD_SESSION -u TMUX -u TMUX_PANE AGENT_TEAMS_GUARD_FORCE_CONTEXT= \
      AGENT_TEAMS_GUARD_FORCE_PANES=yes \
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
  | env -u CLAUDE_CODE_CHILD_SESSION -u TMUX -u TMUX_PANE CMUX_SOCKET_PATH=/tmp/atg-fake.sock \
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 AGENT_TEAMS_GUARD_FORCE_CONTEXT=teammate \
    AGENT_TEAMS_GUARD_FORCE_PANES=yes \
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
