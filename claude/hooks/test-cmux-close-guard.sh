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

# --- unhealthy-cmux stubs (TRANSIENT / DRIFT / EMPTY) -------------------------
# A close stays FAIL-CLOSED when cmux cannot be introspected - the close subcommand
# can still work while list-panels/top/tree are broken, so "cannot see it" is never
# read as "cannot close it". The remedy is the per-target CMUX_CLOSE_UNVERIFIED
# break-glass, not an automatic allow. The default "$TMP/cmux" stub is the healthy
# case that exercises the normal liveness + ownership gates.

# TRANSIENT: cmux resolves but every subcommand errors (server unreachable).
cat > "$TMP/cmux-err" <<'EOF'
#!/bin/bash
echo "cmux: could not connect to server" >&2
exit 1
EOF
chmod +x "$TMP/cmux-err"

# DRIFT: cmux exits 0 but `top` is not the 7-column tsv this guard parses.
cat > "$TMP/cmux-drift" <<EOF
#!/bin/bash
case "\$1 \$2" in
  "list-panels --id-format") printf '  surface:23 BBBBBBBB-0000-4000-8000-000000000023 terminal "x"\n'; exit 0 ;;
  "top --all")               printf 'this output is not tab separated at all\n'; exit 0 ;;
esac
exit 0
EOF
chmod +x "$TMP/cmux-drift"

# EMPTY: cmux exits 0 but prints nothing (a half-up session).
cat > "$TMP/cmux-empty" <<'EOF'
#!/bin/bash
exit 0
EOF
chmod +x "$TMP/cmux-empty"

# An absolute path that does not exist. Its BASENAME must be `cmux` or the guard
# never classifies the command as a cmux invocation in the first place (it matches
# on basename), and the row would pass for the wrong reason.
NO_CMUX="$TMP/no-such-dir/cmux"

# --- harness -----------------------------------------------------------------
SESSION="cmux-close-guard-test"

decision() {  # decision <command> [mode]
  # mode: ""        healthy cmux (default fixtures)
  #       ledger    healthy cmux + the session ownership ledger
  #       drift     healthy cmux, but the pane TREE omits a surface (incomplete)
  #       treefail  healthy list-panels/top, but `tree` answers with nothing
  #       absent    no cmux binary resolves at all
  #       cmuxerr   cmux resolves but every subcommand exits non-zero
  #       cmuxdrift cmux exits 0 but `top` output schema is unrecognised
  #       cmuxempty cmux exits 0 but prints nothing
  #       nooverride  CMUX_CLOSE_GUARD_CMUX unset, so the guard must resolve the
  #                   binary the COMMAND names. Only use with a command that spells
  #                   out an absolute stub path, or the real cmux would be queried.
  local mode="${2:-}"
  local ledger_file="$HOME/.claude/.cmux-owned-surfaces.$SESSION"
  if [ "$mode" = "ledger" ]; then
    mkdir -p "$HOME/.claude"
    printf '%s\n' "surface:44" > "$ledger_file"
  else
    rm -f "$ledger_file"
  fi
  local stub_tree="" cmux_bin="$TMP/cmux"
  case "$mode" in
    drift)     stub_tree="$TMP/tree-drift.txt" ;;
    treefail)  stub_tree="$TMP/no-such-tree-file" ;;
    absent)    cmux_bin="$NO_CMUX" ;;
    cmuxerr)   cmux_bin="$TMP/cmux-err" ;;
    cmuxdrift) cmux_bin="$TMP/cmux-drift" ;;
    cmuxempty) cmux_bin="$TMP/cmux-empty" ;;
  esac
  local out payload
  payload=$(python3 -c '
import json,sys
print(json.dumps({"tool_name":"Bash","session_id":sys.argv[2],"tool_input":{"command":sys.argv[1]}}))' \
    "$1" "$SESSION")
  if [ "$mode" = "nooverride" ]; then
    out=$(printf '%s' "$payload" \
      | env -u CMUX_CLOSE_GUARD_CMUX CMUX_STUB_TREE="$stub_tree" bash "$GUARD" 2>/dev/null)
  else
    out=$(printf '%s' "$payload" \
      | CMUX_STUB_TREE="$stub_tree" CMUX_CLOSE_GUARD_CMUX="$cmux_bin" bash "$GUARD" 2>/dev/null)
  fi
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
UNVERIFIED="CMUX_CLOSE_UNVERIFIED"

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
# The renamed-cmux rule must not drag ordinary tooling in with it. A draft that keyed
# on "first non-flag argument is a close subcommand" applied cmux's own subcommand
# grammar to every executable and denied all four of these - ordinary work, blocked by
# a hook that runs on EVERY Bash call. Requiring a pane-target flag alongside the close
# token is what separates a renamed cmux from a grep. (Codex, 5th pass.)
expect "$A" "rg close-surface claude/hooks" \
  "ripgrep for the close subcommand name"
expect "$A" "grep close-surface docs/cmux.md" \
  "grep a file for the close subcommand name"
expect "$A" "echo close-surface" \
  "echo the bare close subcommand name"
expect "$A" "cat close-surface" \
  "cat a file literally named close-surface"
expect "$A" "export FOO=bar; echo hi" \
  "an export that has nothing to do with PATH"
expect "$A" "out=\$(ls -la); echo done" \
  "an ordinary capture-output assignment"
expect "$A" "echo \$(ls -la)" \
  "an ordinary substitution passed to echo"
expect "$A" "export out=\$(date)" \
  "an ordinary substitution passed to export"
# An ESCAPED \$( or backtick inside double quotes is literal text, not an expansion.
# The tokenizer collapsed escapes before testing for expansions, so inert prose in a
# doc, a beat, or a review prompt read as a live substitution and was denied. This
# fired for real while building the fix, on a command writing about this very guard.
expect "$A" "mytool \"docs say \\\$(cmux close-surface --surface surface:23) is denied\"" \
  "escaped \$( in double-quoted prose is inert"
expect "$A" "mytool \"and \\\`cmux close-surface\\\` too\"" \
  "escaped backticks in double-quoted prose are inert"

echo
echo "must BLOCK - a path-named executable, present or absent, is never trusted:"
# Absent is NOT "cannot run": an earlier command on the same line can create it
# (install/chmod/a symlink target appearing), so a missing path at hook time can be
# a working cmux at execution time. Present is not trusted either - the guard will
# not exec an unverified binary from a pre-execution hook. Both deny.
expect "$D" "$NO_CMUX close-surface --surface surface:23" \
  "absolute path absent at hook time (TOCTOU)" "nooverride"
expect "$D" "install -m 755 $TMP/cmux $NO_CMUX; $NO_CMUX close-surface --surface surface:23" \
  "line creates the binary before closing" "nooverride"
expect "$D" "$NO_CMUX close-workspace --workspace workspace:1" \
  "absolute path absent: workspace" "nooverride"

echo
echo "must BLOCK - an unresolvable BARE name is not proof the close cannot run:"
# The shell that runs the command can resolve `cmux` differently than this hook can:
# a PATH assignment on the same line, a shell function, or simply a different PATH.
# "I cannot find it" is not "it will not run", so this stays fail-closed.
expect "$D" "cmux close-surface --surface surface:23" \
  "bare cmux unresolvable from the hook" "absent"
expect "$D" "PATH=/tmp/cmux-bin:\$PATH cmux close-surface --surface surface:23" \
  "line prepends its own PATH to reach a cmux" "absent"
# The break-glass says "I checked this pane by hand". With no reachable cmux there is
# nothing for that assertion to attach to, so it does NOT apply here - unlike the
# unintrospectable paths below. The remedy is to make cmux resolvable, a one-time fix.
expect "$D" "$UNVERIFIED=surface:23 cmux close-surface --surface surface:23" \
  "break-glass does NOT cover an unresolvable cmux" "absent"

echo
echo "must BLOCK - the guard will not exec a caller-supplied binary to verify:"
# Introspecting an unverified binary from a PRE-execution hook would run it before
# the decision, and its "read-only" subcommands could do anything.
expect "$D" "./cmux close-surface --surface surface:23" \
  "relative path (CWD can change earlier in the line)" "nooverride"
expect "$D" "~/cmux close-surface --surface surface:23" \
  "tilde path (HOME can be reassigned)" "nooverride"
expect "$D" "$TMP/cmux close-surface --surface surface:23" \
  "existing out-of-tree absolute path" "nooverride"

echo
echo "must BLOCK - bypass routes Codex found in the FOURTH pass:"
# A close whose SUBCOMMAND parsed cleanly but whose ARGS are not literal: the flags
# are repeatable and last-value-wins, so a second target expands in at run time and
# cmux closes a pane the guard never checked. surface:40 is dead/owned, surface:23
# is the LIVE agent pane.
expect "$D" "$CONFIRM=surface:40 cmux close-surface --surface surface:40 \"\$(printf -- '--surface')\" surface:23" \
  "dynamic arg smuggles a second --surface"
expect "$D" "$CONFIRM=surface:40 cmux close-surface --surface surface:40 \$OPTS" \
  "unresolvable variable in a parsed close's args"
expect "$D" "$UNVERIFIED=surface:40 cmux close-surface --surface surface:40 \$OPTS" \
  "break-glass cannot launder a dynamic-arg close" "cmuxerr"
# A renamed/copied cmux: classification matches on basename, so `cmux-x` used to be
# "other" and the close token counted as data.
expect "$D" "/tmp/cmux-x close-surface --surface surface:23" \
  "renamed cmux copy run with a close subcommand"
expect "$D" "install -m 755 $TMP/cmux /tmp/cmux-x
/tmp/cmux-x close-surface --surface surface:23" \
  "copy cmux to a new name, then close with it"
expect "$D" "/tmp/cmux-x --no-focus close-surface --surface surface:23" \
  "renamed cmux behind a boolean global flag"
expect "$D" "$CONFIRM=surface:40 PATH=/tmp/cbin:\$PATH cmux close-surface --surface surface:40" \
  "PATH reassigned so a different cmux would run"
expect "$D" "export PATH=/tmp/cbin:\$PATH; $CONFIRM=surface:40 cmux close-surface --surface surface:40" \
  "PATH exported before the close"
expect "$D" "PATH=/tmp/cbin:\$PATH; $CONFIRM=surface:40 cmux close-surface --surface surface:40" \
  "bare PATH assignment before the close"
expect "$D" "hash -p /tmp/cmux-x cmux; $CONFIRM=surface:40 cmux close-surface --surface surface:40" \
  "hash -p remaps cmux before the close"
expect "$D" "export PATH+=:/tmp/cbin; $CONFIRM=surface:40 cmux close-surface --surface surface:40" \
  "PATH appended with the += form"
expect "$D" "PATH+=:/tmp/cbin cmux close-surface --surface surface:40" \
  "PATH += as an env prefix"
# The no-target variant is the sharp one: an unparsed `+=` prefix shifted the
# executable off cmux entirely, so no close was parsed and the line fell through
# ALLOWED - closing the CURRENT pane unverified.
expect "$D" "PATH+=:/tmp/cbin cmux close-surface" \
  "PATH += env prefix on a no-target close"
expect "$D" "FOO+=bar cmux close-surface --surface surface:23" \
  "unrelated += prefix still parses the close"
# An assignment whose VALUE is a substitution EXECUTES it before the assignment. The
# whole word matched ENV_ASSIGN and was swallowed as inert env, so no close was parsed
# and the line was allowed - and capturing output this way is an everyday shape.
expect "$D" "out=\$(cmux close-surface --surface surface:23)" \
  "close inside an assignment's command substitution"
expect "$D" "out=\`cmux close-surface --surface surface:23\`" \
  "close inside an assignment's backticks"
expect "$D" "out=\$(cmux close-surface) echo hi" \
  "substitution assignment prefixing another command"
# A substitution RUNS its contents regardless of which command it hangs off, and even
# when that command is harmless. Only `cmux` commands consulted args_dyn before, so a
# substitution attached to any OTHER command went unexamined.
expect "$D" "echo \$(cmux close-surface --surface surface:23)" \
  "close in a substitution passed to echo"
expect "$D" "export out=\$(cmux close-surface --surface surface:23)" \
  "close in a substitution passed to export"
expect "$D" "printf '%s' \`cmux close-surface --surface surface:23\`" \
  "close in backticks passed to printf"
expect "$D" "/tmp/cmux-x close-surface" \
  "renamed cmux with no target (closes current pane)"

echo
echo "must BLOCK - a \`--\` separator makes the real target unknowable:"
# Past end-of-options cmux's own parser stops reading --surface as a flag, so the
# guard could verify one pane while the close acts on another.
expect "$D" "$CONFIRM=surface:40 cmux close-surface -- --surface surface:40" \
  "end-of-options separator hides the real target"
expect "$D" "$UNVERIFIED=surface:40 cmux close-surface -- --surface surface:40" \
  "break-glass cannot launder a \`--\` close" "cmuxerr"

echo
echo "must BLOCK - UNINTROSPECTABLE cmux: it EXISTS, so the close can still work:"
# Codex review + a stub repro falsified the tempting "if introspection is down the
# close is down too" premise: `top` is heavy and can time out or drift after a cmux
# update while `close-surface` (cheap, separate code path) keeps working. Allowing
# here would let the 2026-07-12 incident straight through.
expect "$D" "cmux close-surface --surface surface:23" \
  "TRANSIENT: cmux CLI exits non-zero" "cmuxerr"
expect "$D" "cmux close-surface --surface surface:23" \
  "EMPTY: cmux answers with no output" "cmuxempty"
expect "$D" "cmux close-surface --surface surface:23" \
  "DRIFT: cmux top output schema unrecognised" "cmuxdrift"
expect "$D" "cmux close-workspace --workspace workspace:2" \
  "TRANSIENT: cmux tree answers with nothing" "treefail"

echo
echo "must ALLOW - the per-target break-glass unsticks an unintrospectable cmux:"
# The no-restart escape hatch. It is deliberately per-target, so it forces the same
# positive identification the ownership gate demands.
expect "$A" "$UNVERIFIED=surface:23 cmux close-surface --surface surface:23" \
  "break-glass names the target: transient" "cmuxerr"
expect "$A" "$UNVERIFIED=surface:23 cmux close-surface --surface surface:23" \
  "break-glass names the target: drift" "cmuxdrift"
expect "$A" "$UNVERIFIED=surface:23 cmux close-surface --surface surface:23" \
  "break-glass names the target: empty" "cmuxempty"
expect "$A" "$UNVERIFIED=workspace:2 cmux close-workspace --workspace workspace:2" \
  "break-glass names the target: tree unavailable" "treefail"

echo
echo "must BLOCK - the break-glass is narrow: it is not a blanket off-switch:"
expect "$D" "$UNVERIFIED=surface:99 cmux close-surface --surface surface:23" \
  "break-glass names a DIFFERENT surface" "cmuxerr"
expect "$D" "$UNVERIFIED=1 cmux close-surface --surface surface:23" \
  "truthy break-glass naming no surface" "cmuxerr"
expect "$D" "$UNVERIFIED=surface:23 cmux close-surface --surface surface:23 --surface surface:41" \
  "break-glass covers only one of two targets" "cmuxerr"
expect "$D" "$UNVERIFIED=surface:23 echo ok; cmux close-surface --surface surface:23" \
  "break-glass sits on a DIFFERENT command" "cmuxerr"
# The hard gate is untouched: when cmux CAN see the pane, no token unlocks a live one.
expect "$D" "$UNVERIFIED=surface:23 cmux close-surface --surface surface:23" \
  "break-glass does NOT unlock a live pane on a healthy cmux"

echo
echo "must BLOCK - a tree outage must not clear OTHER closes on the same line:"
# Codex second pass: the tree break-glass used to emit a whole-line allow, so a
# workspace close carrying a token cleared a LIVE surface close sitting after it -
# the 2026-07-12 incident, reintroduced. Only workspace/window closes need the tree,
# so a tree outage leaves surface liveness perfectly checkable.
expect "$D" "$UNVERIFIED=workspace:2 cmux close-workspace --workspace workspace:2; $UNVERIFIED=surface:23 cmux close-surface --surface surface:23" \
  "tree break-glass must not clear a live surface close" "treefail"
expect "$D" "$UNVERIFIED=workspace:2 cmux close-workspace --workspace workspace:2; cmux close-surface --surface surface:40" \
  "tree break-glass must not clear an unowned close" "treefail"

echo
echo "must BLOCK - FAIL-CLOSED survives: a HEALTHY cmux still protects (control):"
# The negative control. Same commands, healthy cmux: the protection this guard
# exists for must be untouched by everything above.
expect "$D" "cmux close-surface --surface surface:23" \
  "healthy cmux: live agent pane still blocked"
expect "$D" "$CONFIRM=surface:23 cmux close-surface --surface surface:23" \
  "healthy cmux: live pane + token still blocked"
expect "$D" "cmux close-surface --surface surface:40" \
  "healthy cmux: dead pane without ownership still blocked"
expect "$D" "cmux close-workspace --workspace workspace:1" \
  "healthy cmux: workspace with a live pane still blocked"
expect "$D" "$CONFIRM=workspace:2 cmux close-workspace --workspace workspace:2" \
  "healthy cmux: incomplete pane tree still blocked" "drift"

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
