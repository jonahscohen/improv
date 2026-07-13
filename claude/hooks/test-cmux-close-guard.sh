#!/usr/bin/env bash
# Regression tests for cmux-close-guard.sh.
#
# The guard exists because on 2026-07-12 a lead session force-closed surface:23,
# a pane it assumed was a leftover of its own build agents. It was Jonah's LIVE
# justify-watch worker. Killing it stalled two queued Send-All batches.
#
# Two guarantees:
#   1. A close of a pane backed by a LIVE agent process is blocked. Always.
#      No confirmation token unlocks it. This is the falsification target: the
#      incident command must go red.
#   2. A close of a genuinely dead / idle pane that the session positively
#      identifies as its own is ALLOWED. A guard that always blocks is a guard
#      someone deletes.
#
# Hermetic: a stub cmux serves fixtures built around REAL pids (a live sleep, a
# reaped pid), so the liveness check runs for real without touching the user's
# actual cmux session.
#
# Run:  bash claude/hooks/test-cmux-close-guard.sh
set -uo pipefail

GUARD="$(cd "$(dirname "$0")" && pwd)/cmux-close-guard.sh"
TMP="$(mktemp -d)"
PASS=0
FAIL=0

cleanup() {
  [ -n "${LIVE_PID:-}" ] && kill "$LIVE_PID" 2>/dev/null
  [ -n "${SHELL_PID:-}" ] && kill "$SHELL_PID" 2>/dev/null
  [ -n "${BUSY_PID:-}" ] && kill "$BUSY_PID" 2>/dev/null
  [ -n "${PROT_PID:-}" ] && kill "$PROT_PID" 2>/dev/null
  rm -rf "$TMP"
}
trap cleanup EXIT

# --- real processes to make liveness checks real -----------------------------
sleep 300 & LIVE_PID=$!    # stands in for a running claude.exe
sleep 300 & SHELL_PID=$!   # stands in for an idle zsh
sleep 300 & BUSY_PID=$!    # stands in for a node dev server
sleep 300 & PROT_PID=$!    # stands in for justify-serve
sleep 0.01 & DEAD_PID=$!   # reaped below: a genuinely dead pid
wait "$DEAD_PID" 2>/dev/null

UUID40="AAAAAAAA-0000-4000-8000-000000000040"

# --- fixtures ----------------------------------------------------------------
cat > "$TMP/panels.txt" <<EOF
  surface:23 BBBBBBBB-0000-4000-8000-000000000023  terminal  "general-purpose"
  surface:40 $UUID40  terminal  "general-purpose"
  surface:41 CCCCCCCC-0000-4000-8000-000000000041  terminal  "shell"
  surface:42 DDDDDDDD-0000-4000-8000-000000000042  terminal  "dev server"
  surface:43 EEEEEEEE-0000-4000-8000-000000000043  terminal  "justify"
  surface:44 FFFFFFFF-0000-4000-8000-000000000044  terminal  "general-purpose"
  surface:45 99999999-0000-4000-8000-000000000045  terminal  "no process data"
EOF

# cmux top --processes --format tsv rows: cpu, mem, count, kind, id, parent, name
{
  printf '0.0\t1\t1\tsurface\tsurface:23\tpane:1\tgeneral-purpose\n'
  printf '0.0\t1\t1\tprocess\t%s\tsurface:23\tclaude.exe\n' "$LIVE_PID"
  printf '0.0\t1\t1\tsurface\tsurface:40\tpane:2\tgeneral-purpose\n'
  printf '0.0\t1\t1\tprocess\t%s\tsurface:40\tclaude.exe\n' "$DEAD_PID"
  printf '0.0\t1\t1\tsurface\tsurface:41\tpane:3\tshell\n'
  printf '0.0\t1\t1\tprocess\t%s\tsurface:41\tzsh\n' "$SHELL_PID"
  printf '0.0\t1\t1\tsurface\tsurface:42\tpane:4\tdev server\n'
  printf '0.0\t1\t1\tprocess\t%s\tsurface:42\tnode\n' "$BUSY_PID"
  printf '0.0\t1\t1\tsurface\tsurface:43\tpane:5\tjustify\n'
  printf '0.0\t1\t1\tprocess\t%s\tsurface:43\tjustify-serve\n' "$PROT_PID"
  printf '0.0\t1\t1\tsurface\tsurface:44\tpane:6\tgeneral-purpose\n'
  printf '0.0\t1\t1\tprocess\t%s\tsurface:44\tclaude.exe\n' "$DEAD_PID"
} > "$TMP/top.tsv"

# The tree must account for every surface that has process data, or the guard
# refuses to enumerate a workspace/window close at all.
cat > "$TMP/tree.txt" <<'EOF'
window window:1 [current]
├── workspace workspace:1 "live"
│   ├── pane pane:1
│   │   └── surface surface:23 [terminal] "general-purpose"
│   └── pane pane:2
│       └── surface surface:40 [terminal] "general-purpose"
├── workspace workspace:2 "idle"
│   ├── pane pane:3
│   │   └── surface surface:41 [terminal] "shell"
│   └── pane pane:6
│       └── surface surface:44 [terminal] "general-purpose"
└── workspace workspace:3 "misc"
    ├── pane pane:4
    │   └── surface surface:42 [terminal] "dev server"
    └── pane pane:5
        └── surface surface:43 [terminal] "justify"
EOF
# surface:45 is deliberately absent: it exists in list-panels but has NO process
# data in top, which is the "cannot prove it is dead" case.

# Same tree with surface:43 missing: cmux's tree no longer accounts for every
# surface it reports process data for, so member lists cannot be trusted.
grep -v "surface:43" "$TMP/tree.txt" > "$TMP/tree-drift.txt"

# --- stub cmux ---------------------------------------------------------------
cat > "$TMP/cmux" <<EOF
#!/bin/bash
TREE="\${CMUX_STUB_TREE:-$TMP/tree.txt}"
case "\$1 \$2" in
  "list-panels --id-format") cat "$TMP/panels.txt"; exit 0 ;;
  "top --all")               cat "$TMP/top.tsv";    exit 0 ;;
  "tree --all")              cat "\$TREE";          exit 0 ;;
esac
exit 1
EOF
chmod +x "$TMP/cmux"

# --- harness -----------------------------------------------------------------
SESSION="cmux-close-guard-test"

decision() {  # decision <command> [ledger|drift]
  local mode="${2:-}"
  local ledger_file="$HOME/.claude/.cmux-owned-surfaces.$SESSION"
  if [ "$mode" = "ledger" ]; then
    mkdir -p "$HOME/.claude"
    printf '%s\n' "surface:44" > "$ledger_file"
  else
    rm -f "$ledger_file"
  fi
  local stub_tree=""
  [ "$mode" = "drift" ] && stub_tree="$TMP/tree-drift.txt"
  local out
  out=$(python3 -c '
import json,sys
print(json.dumps({"tool_name":"Bash","session_id":sys.argv[2],"tool_input":{"command":sys.argv[1]}}))' \
    "$1" "$SESSION" \
    | CMUX_STUB_TREE="$stub_tree" CMUX_CLOSE_GUARD_CMUX="$TMP/cmux" bash "$GUARD" 2>/dev/null)
  rm -f "$ledger_file"
  printf '%s' "$out" | python3 -c '
import json,sys
try: d=json.load(sys.stdin)
except Exception: d={}
h=d.get("hookSpecificOutput") or {}
print(h.get("permissionDecision","allow"))' 2>/dev/null
}

expect() {  # expect <want> <command> <label> [ledger|drift]
  local want="$1" cmd="$2" label="$3" mode="${4:-}"
  local got; got="$(decision "$cmd" "$mode")"
  if [ "$got" = "$want" ]; then
    PASS=$((PASS+1)); printf "  ok    %-56s -> %s\n" "$label" "$got"
  else
    FAIL=$((FAIL+1)); printf "  FAIL  %-56s -> %s (wanted %s)\n" "$label" "$got" "$want"
  fi
}

D="deny"; A="allow"
CONFIRM="CMUX_CLOSE_CONFIRM"

echo "must BLOCK - a live pane is never a leftover:"
expect "$D" "cmux close-surface --surface surface:23" \
  "THE INCIDENT: close a live agent pane"
expect "$D" "$CONFIRM=surface:23 cmux close-surface --surface surface:23" \
  "live pane, even WITH the ownership token"
expect "$D" "$CONFIRM=surface:23 cmux close-surface --surface BBBBBBBB-0000-4000-8000-000000000023" \
  "live pane addressed by uuid"
expect "$D" "$CONFIRM=surface:23 cmux close-surface --surface 23" \
  "live pane addressed by bare index"
expect "$D" "$CONFIRM=surface:43 cmux close-surface --surface surface:43" \
  "protected pane (justify-serve) with token"
expect "$D" "$CONFIRM=surface:42 cmux close-surface --surface surface:42" \
  "busy pane (node dev server) with token"
expect "$D" "$CONFIRM=workspace:1 cmux close-workspace --workspace workspace:1" \
  "workspace containing a live agent pane"
expect "$D" "$CONFIRM=window:1 cmux close-window --window window:1" \
  "window containing a live agent pane"
expect "$D" "cd /tmp && $CONFIRM=surface:23 cmux close-surface --surface surface:23" \
  "live pane after &&"

echo
echo "must BLOCK - unproven target or unproven ownership:"
expect "$D" "cmux close-surface" \
  "no --surface: target cannot be identified"
expect "$D" "cmux close-surface --surface surface:99" \
  "unknown surface cannot be proven dead"
expect "$D" "cmux close-surface --surface surface:40" \
  "dead pane, but ownership never asserted"
expect "$D" "cmux close-surface --surface surface:41" \
  "idle shell pane, ownership never asserted"
expect "$D" "$CONFIRM=surface:41 cmux close-surface --surface surface:40" \
  "token names a DIFFERENT surface than the target"
expect "$D" "$CONFIRM=1 cmux close-surface --surface surface:40" \
  "truthy token that names no surface"
expect "$D" "cmux close-workspace --workspace workspace:2" \
  "idle workspace, ownership never asserted"

echo
echo "must BLOCK - bypass routes an independent Codex review found in the regex draft:"
expect "$D" "$CONFIRM=surface:23 'cmux' close-surface --surface surface:23" \
  "quoted command word"
expect "$D" "$CONFIRM=surface:23 cmu\\x close-surface --surface surface:23" \
  "backslash-escaped command word"
expect "$D" "\$(printf cmux) close-surface --surface surface:23" \
  "command substitution as the executable"
expect "$D" "bash -c '$CONFIRM=surface:23 cmux close-surface --surface surface:23'" \
  "close smuggled inside bash -c"
expect "$D" "eval '$CONFIRM=surface:23 cmux close-surface --surface surface:23'" \
  "close smuggled inside eval"
expect "$D" "if $CONFIRM=surface:23 cmux close-surface --surface surface:23; then :; fi" \
  "close behind an if keyword"
expect "$D" "time cmux close-surface --surface surface:23" \
  "close behind time"
expect "$D" "command cmux close-surface --surface surface:23" \
  "close behind command"
expect "$D" "timeout 5 cmux close-surface --surface surface:23" \
  "close behind timeout 5"
expect "$D" "env $CONFIRM=surface:23 cmux close-surface --surface surface:23" \
  "close behind env with the token"
expect "$D" "sudo -E cmux close-surface --surface surface:23" \
  "close behind sudo -E"
expect "$D" "$CONFIRM=surface:40 cmux close-surface --surface surface:40; bash -c '$CONFIRM=surface:23 cmux close-surface --surface surface:23'" \
  "safe close first, live close wrapped second"
expect "$D" "$CONFIRM=surface:40 cmux close-surface --surface surface:40 --surface surface:23" \
  "repeated --surface flag hiding a live target"
expect "$D" "$CONFIRM=surface:40 echo ok; cmux close-surface --surface surface:40" \
  "token sits on a DIFFERENT command in the line"
expect "$D" "$CONFIRM=surface:45 cmux close-surface --surface surface:45" \
  "surface has no process data: cannot prove it is dead"
expect "$D" "$CONFIRM=workspace:9 cmux close-workspace --workspace workspace:9" \
  "workspace with no known panes"

echo
echo "must BLOCK - bypass routes Codex found in the SECOND pass (tokenizer holes):"
expect "$D" "\$(printf 'cmux close-surface --surface surface:23')" \
  "whole close generated by a command substitution"
expect "$D" "\`printf 'cmux close-surface --surface surface:23'\`" \
  "whole close generated by backticks"
expect "$D" "\$(printf c)\$(printf mux) close-surface --surface surface:23" \
  "executable assembled from two substitutions"
expect "$D" "CMUX=cmux; \$CMUX close-surface --surface surface:23" \
  "executable held in a shell variable"
expect "$D" "\$'cmux' close-surface --surface surface:23" \
  "ANSI-C quoted executable"
expect "$D" "cmux \$'close-surface' --surface surface:23" \
  "ANSI-C quoted subcommand"
expect "$D" "bash <<'EOF'
cmux close-surface --surface surface:23
EOF" \
  "heredoc fed to a shell (it executes the body)"
expect "$D" "bash < <(printf 'cmux close-surface --surface surface:23')" \
  "process substitution piped into a shell"
expect "$D" "sudo -u spare3 cmux close-surface --surface surface:23" \
  "sudo -u operand hiding the executable"
expect "$D" "env -u FOO cmux close-surface --surface surface:23" \
  "env -u operand hiding the executable"
expect "$D" "sudo -u spare3 bash -c 'cmux close-surface --surface surface:23'" \
  "sudo -u operand in front of a shell wrapper"
expect "$D" "cmux --no-focus close-surface --surface surface:23" \
  "boolean global flag desyncing subcommand detection"
expect "$D" "$CONFIRM=workspace:2 cmux close-workspace --workspace workspace:2" \
  "workspace close when the pane tree is incomplete" "drift"

echo
echo "must BLOCK - executor routes Codex found in the THIRD pass:"
expect "$D" "echo 'cmux close-surface --surface surface:23' | bash" \
  "close piped into a shell's stdin"
expect "$D" "cat <<'EOF' | bash
cmux close-surface --surface surface:23
EOF" \
  "heredoc piped into a shell"
expect "$D" "env -S 'cmux close-surface --surface surface:23'" \
  "env -S executes its operand"
expect "$D" "find . -maxdepth 0 -exec cmux close-surface --surface surface:23 \\;" \
  "close run via find -exec"
expect "$D" "awk 'BEGIN{system(\"cmux close-surface --surface surface:23\")}'" \
  "close run via awk system()"
expect "$D" "cmux \"\$(printf close-surface)\" --surface surface:23" \
  "subcommand generated by a substitution"
expect "$D" "CMUX=cmux; \"\$CMUX\" close-surface --surface surface:23" \
  "executable in a double-quoted variable"
expect "$D" "\$'cmu\\x78' close-surface --surface surface:23" \
  "executable hidden in an ANSI-C escape"
expect "$D" "xargs cmux close-surface --surface surface:23 < /dev/null" \
  "close handed to xargs"
expect "$D" "\$(printf bash) <<'EOF'
cmux close-surface --surface surface:23
EOF" \
  "heredoc fed to a shell named by a substitution"

echo
echo "must ALLOW - a dead pane this session positively identifies as its own:"
expect "$A" "$CONFIRM=surface:40 cmux close-surface --surface surface:40" \
  "dead agent pane + matching token"
expect "$A" "$CONFIRM=surface:40 cmux close-surface --surface $UUID40" \
  "dead agent pane by uuid + matching token"
expect "$A" "$CONFIRM=$UUID40 cmux close-surface --surface surface:40" \
  "token given as uuid, target as ref"
expect "$A" "$CONFIRM=surface:41 cmux close-surface --surface surface:41" \
  "idle shell pane + matching token"
expect "$A" "$CONFIRM=surface:40,surface:41 cmux close-surface --surface surface:41" \
  "multi-value token listing the target"
expect "$A" "$CONFIRM=workspace:2 cmux close-workspace --workspace workspace:2" \
  "workspace of dead/idle panes + matching token"
expect "$A" "cmux close-surface --surface surface:44" \
  "dead pane owned via the session ledger" "ledger"
expect "$A" "env $CONFIRM=surface:41 cmux close-surface --surface surface:41" \
  "token carried through an env prefix"

echo
echo "must ALLOW - prose about the command, and every other cmux subcommand:"
expect "$A" "cmux list-panels" \
  "list-panels"
expect "$A" "cmux browser --surface surface:23 screenshot --out /tmp/a.png" \
  "screenshot an agent surface"
expect "$A" "cmux top --all --processes" \
  "process introspection"
expect "$A" "echo 'never run cmux close-surface --surface surface:23 on a live pane'" \
  "prose inside single quotes"
expect "$A" "git commit -m \"note: cmux close-surface killed the worker\"" \
  "prose inside a commit message"
expect "$A" "grep -rn 'cmux close-surface' docs/" \
  "grep for the command name"
expect "$A" "cat > /tmp/beat.md <<'EOF'
Do not run cmux close-surface --surface surface:23 - it was alive.
EOF" \
  "prose inside a heredoc body"
expect "$A" "cat > /tmp/beat.md <<'END-MARKER'
Do not run cmux close-surface --surface surface:23 - it was alive.
END-MARKER" \
  "heredoc with a non-word delimiter"
expect "$A" "cmux help close-surface" \
  "reading the help for the close command"
expect "$A" "cmux browser --surface surface:23 screenshot --out /tmp/close-surface.png" \
  "the token appears only in a filename argument"
expect "$A" "bash claude/hooks/test-cmux-close-guard.sh" \
  "running this very test suite"
# Regression: the guard blocked this for real while being built. Writing a probe
# script whose CONTENT mentions the command, then running it, is not a close - the
# heredoc body is a file being written, not the executable region of the line.
expect "$A" "cat > /tmp/probe.py <<'EOF'
cases = ['cmux close-surface --surface surface:23']
EOF
python3 /tmp/probe.py" \
  "write a probe script that quotes the command, then run it"
expect "$A" "kill 12345" \
  "unrelated command"

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
