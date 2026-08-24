#!/bin/bash
# test-scheduled-research-run.sh - contract tests for the SHARED scheduled-research spine
# claude/hooks/lib/scheduled-research-run.sh (the generic runner every learning-researcher
# reuses: the taste miner, the CC feature-tracker, the cmux feature-tracker).
#
# WHY THIS FILE EXISTS
# The runner is safety-adjacent infra. It DISCOVERS + PROPOSES and must NEVER (a) run a
# flow when the source has not changed, (b) advance its cursor unless a run COMPLETELY
# succeeded, or (c) leave a hung headless `claude -p` (and the node + sub-agents it spawns)
# alive past the wall clock. Each of those is a distinct failure class with a distinct exit
# code, and each is tested here against the REAL lib (no stubs of the runner itself) with
# injected flows so no network / no claude binary is required.
#
# The load-bearing guarantees, and where each is proven:
#   - the has-new-signal gate no-ops when the cursor is current (pre-check prints "skip") and
#     runs when it is stale (pre-check prints "run"); a BROKEN pre-check (ANY non-zero exit,
#     including a masked-in-a-pipeline failure, OR exit 0 with no decision) fails loud (exit
#     2), never a silent forever-skip           -> scenarios GATE / PRECHECK-ERR / PRECHECK-CONTRACT
#   - DRY_RUN runs the gate (the pre-check DOES run) but does not run the flow or advance the
#     cursor                                                -> scenarios DRY_RUN / DRY_RUN-PRECHECK
#   - a complete run advances the cursor (mtime touch + optional content write) -> scenario SUCCESS
#   - the cursor is NOT advanced when the flow produces nothing, exits non-zero,
#     or times out                                                    -> scenarios NOPRODUCE / FLOWFAIL / TIMEOUT
#   - the wall-clock watchdog group-KILLs a hung, TERM-ignoring child within the timeout,
#     proven against the process-group physics it relies on           -> scenarios PGKILL-PREMISE / TIMEOUT
#   - a backgrounded, TERM-ignoring descendant that outlives an exit-0 flow is reaped on the
#     NORMAL completion path too, not only on timeout                  -> scenario NORMAL-REAP
#   - a produced-but-uncommittable cursor is surfaced as exit 6, never swallowed -> scenario ADVANCE-FAIL
#   - the cursor is snapshotted BEFORE the flow and rolled back to its exact pre-run state on
#     ANY non-success: a partial-writing SRR_ADVANCE_CMD (even with a broken TMPDIR), or a
#     misbehaving flow that writes the cursor itself and then fails
#                                              -> scenarios ADVANCE-ROLLBACK / FLOW-WRITES-CURSOR
#
# HOW IT WORKS
# Every scenario drives the REAL lib via `env SRR_*=... bash <lib>`, injecting SRR_FLOW_CMD
# (the override path) so the runner never needs claude or the network. The runner is
# unmodified - a change that breaks the contract fails here instead of in production.
#
# Exit codes:
#   0  all scenarios passed
#   1  one or more assertions failed
#   2  harness/setup error (lib missing, perl missing, mktemp failed)

set -u

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LIB="$REPO_ROOT/claude/hooks/lib/scheduled-research-run.sh"
TEMPLATE="$REPO_ROOT/claude/launchd/com.yesand.scheduled-research.plist.template"

PASS=0
FAIL=0
pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
setup_fail() { echo "SETUP-FAIL: $1"; exit 2; }

[ -f "$LIB" ] || setup_fail "runner lib not found at $LIB"
command -v perl >/dev/null 2>&1 || setup_fail "perl required (the runner uses perl setpgrp for group-kill; macOS ships it)"

WORK="$(mktemp -d)" || setup_fail "mktemp failed"

# Background pids spawned by the premise / timeout scenarios, torn down unconditionally so a
# failed assertion never leaks a runaway sleep.
LEAK_PIDS=""
cleanup() {
  local p
  for p in $LEAK_PIDS; do
    kill -KILL "$p" 2>/dev/null || true
    kill -KILL "-$p" 2>/dev/null || true
  done
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

# A real directory to serve as SRR_REPO_ROOT (the runner only requires it to be a dir).
FAKE_REPO="$WORK/repo"
mkdir -p "$FAKE_REPO"

mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null; }

# run_srr: runs the REAL lib with the SRR_ENV array as its environment.
# Sets RC (exit code) and LAST_OUT (stdout). stderr is captured to $WORK/stderr.
RC=0
LAST_OUT=""
run_srr() {
  LAST_OUT="$(env "${SRR_ENV[@]}" /bin/bash "$LIB" 2>"$WORK/stderr")"
  RC=$?
}

echo "== scheduled-research-run.sh contract =="

# ---------------------------------------------------------------------------
# Static checks: the lib parses and the plist template is valid.
# ---------------------------------------------------------------------------
echo "-- static: bash -n and plist lint"
if bash -n "$LIB" 2>"$WORK/synerr"; then
  pass "runner passes bash -n (syntax clean)"
else
  fail "runner fails bash -n: $(cat "$WORK/synerr")"
fi
if [ -f "$TEMPLATE" ]; then
  if command -v plutil >/dev/null 2>&1; then
    if plutil -lint "$TEMPLATE" >/dev/null 2>&1; then
      pass "plist template passes plutil -lint"
    else
      fail "plist template fails plutil -lint: $(plutil -lint "$TEMPLATE" 2>&1)"
    fi
  else
    pass "plutil unavailable - skipping template lint (not a macOS host)"
  fi
else
  fail "plist template not found at $TEMPLATE"
fi

# ---------------------------------------------------------------------------
# CONFIG: every missing/malformed required parameter is a distinct exit-2 failure. Each
# case is an explicit array whose ONE flaw is the parameter under test; every other value
# is valid, so the exit 2 is attributable to that flaw and nothing else. A "missing" var is
# passed empty (the runner treats unset and empty identically via ${VAR:-}).
# ---------------------------------------------------------------------------
echo "-- config validation (exit 2 on any bad/missing required parameter)"
CFG_CUR="$WORK/cfg_cursor"; CFG_SENT="$WORK/cfg_sentinel"; rm -f "$CFG_CUR" "$CFG_SENT"

cfg_case() { # $1=label ; SRR_ENV already set by caller ; asserts exit 2
  run_srr
  [ "$RC" = 2 ] && pass "$1 -> exit 2" || fail "$1 -> exit 2 (got $RC)"
}

SRR_ENV=( "SRR_JOB_NAME=" "SRR_CURSOR_FILE=$CFG_CUR" "SRR_REPO_ROOT=$FAKE_REPO" "SRR_LOG_FILE=$WORK/cfg_log" "SRR_PRECHECK_CMD=exit 0" "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $CFG_SENT" )
cfg_case "missing SRR_JOB_NAME"

SRR_ENV=( "SRR_JOB_NAME=bad/name" "SRR_CURSOR_FILE=$CFG_CUR" "SRR_REPO_ROOT=$FAKE_REPO" "SRR_LOG_FILE=$WORK/cfg_log" "SRR_PRECHECK_CMD=exit 0" "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $CFG_SENT" )
cfg_case "SRR_JOB_NAME with a slash"

SRR_ENV=( "SRR_JOB_NAME=cfg" "SRR_CURSOR_FILE=" "SRR_REPO_ROOT=$FAKE_REPO" "SRR_LOG_FILE=$WORK/cfg_log" "SRR_PRECHECK_CMD=exit 0" "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $CFG_SENT" )
cfg_case "missing SRR_CURSOR_FILE"

SRR_ENV=( "SRR_JOB_NAME=cfg" "SRR_CURSOR_FILE=$CFG_CUR" "SRR_REPO_ROOT=$FAKE_REPO" "SRR_LOG_FILE=$WORK/cfg_log" "SRR_PRECHECK_CMD=" "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $CFG_SENT" )
cfg_case "missing SRR_PRECHECK_CMD"

SRR_ENV=( "SRR_JOB_NAME=cfg" "SRR_CURSOR_FILE=$CFG_CUR" "SRR_REPO_ROOT=$FAKE_REPO" "SRR_LOG_FILE=$WORK/cfg_log" "SRR_PRECHECK_CMD=exit 0" "SRR_SUCCESS_CMD=" "SRR_FLOW_CMD=touch $CFG_SENT" )
cfg_case "missing SRR_SUCCESS_CMD"

SRR_ENV=( "SRR_JOB_NAME=cfg" "SRR_CURSOR_FILE=$CFG_CUR" "SRR_REPO_ROOT=$FAKE_REPO" "SRR_LOG_FILE=$WORK/cfg_log" "SRR_PRECHECK_CMD=exit 0" "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=" )
cfg_case "neither SRR_FLOW_CMD nor SRR_PROMPT"

SRR_ENV=( "SRR_JOB_NAME=cfg" "SRR_CURSOR_FILE=$CFG_CUR" "SRR_REPO_ROOT=$FAKE_REPO" "SRR_LOG_FILE=$WORK/cfg_log" "SRR_PRECHECK_CMD=exit 0" "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $CFG_SENT" "SRR_TIMEOUT_SECS=abc" )
cfg_case "non-numeric SRR_TIMEOUT_SECS"

SRR_ENV=( "SRR_JOB_NAME=cfg" "SRR_CURSOR_FILE=$CFG_CUR" "SRR_REPO_ROOT=$WORK/no-such-repo" "SRR_LOG_FILE=$WORK/cfg_log" "SRR_PRECHECK_CMD=exit 0" "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $CFG_SENT" )
cfg_case "non-existent SRR_REPO_ROOT"

# A config error is caught BEFORE the gate, so no case above ran the flow or made the cursor.
[ ! -e "$CFG_SENT" ] && pass "config errors never run the flow" || fail "config errors must not run the flow (found $CFG_SENT)"
[ ! -e "$CFG_CUR" ]  && pass "config errors never advance/create the cursor" || fail "config errors must not create the cursor (found $CFG_CUR)"

# ---------------------------------------------------------------------------
# PRECHECK-ERR: a pre-check that exits non-zero is an ERROR (exit 2), not a quiet skip.
# ---------------------------------------------------------------------------
echo "-- pre-check non-zero exit is a loud error, not a silent skip"
CUR="$WORK/pcerr_cursor"; SENT="$WORK/pcerr_sentinel"; rm -f "$CUR" "$SENT"
SRR_ENV=(
  "SRR_JOB_NAME=pcerr" "SRR_CURSOR_FILE=$CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/pcerr_log" "SRR_PRECHECK_CMD=exit 3"
  "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $SENT"
)
run_srr
[ "$RC" = 2 ] && pass "pre-check exit 3 -> runner exit 2" || fail "pre-check exit 3 -> runner exit 2 (got $RC)"
[ ! -e "$SENT" ] && pass "pre-check error never runs the flow" || fail "pre-check error must not run the flow"
[ ! -e "$CUR" ]  && pass "pre-check error never advances the cursor" || fail "pre-check error must not advance the cursor"

# ---------------------------------------------------------------------------
# GATE: no-op when the cursor is CURRENT (pre-check prints "skip"); open when it is STALE
# (pre-check prints "run"). Uses a real find-newer gate, the reflect-style signal.
# ---------------------------------------------------------------------------
echo "-- has-new-signal gate: skip when current, run when stale"
SIGDIR="$WORK/signals"; mkdir -p "$SIGDIR"
GATE_CUR="$WORK/gate_cursor"; GATE_SENT="$WORK/gate_sentinel"
# A find-newer pre-check under the new contract: print "run" iff a *.md under $SIGDIR is newer
# than the cursor, else "skip"; and `|| exit 2` the find so an internal failure surfaces as an
# error (never a silent skip). Exits 0 with the decision on stdout.
GATE_PRECHECK='m=$(find '"$SIGDIR"' -name "*.md" -newer "$SRR_CURSOR_FILE" 2>/dev/null) || exit 2; [ -n "$m" ] && echo run || echo skip'

# CURRENT: create an old signal, then a NEWER cursor -> nothing newer than the cursor.
: > "$SIGDIR/old.md"
sleep 1
: > "$GATE_CUR"
rm -f "$GATE_SENT"
CUR_BEFORE="$(mtime "$GATE_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=gate" "SRR_CURSOR_FILE=$GATE_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/gate_log" "SRR_PRECHECK_CMD=$GATE_PRECHECK"
  "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $GATE_SENT"
)
run_srr
[ "$RC" = 0 ] && pass "cursor current -> exit 0 (clean skip)" || fail "cursor current -> exit 0 (got $RC)"
[ ! -e "$GATE_SENT" ] && pass "cursor current -> flow NOT run" || fail "cursor current -> flow must not run"
[ "$(mtime "$GATE_CUR")" = "$CUR_BEFORE" ] && pass "cursor current -> cursor NOT advanced" \
  || fail "cursor current -> cursor must not advance"
case "$LAST_OUT" in *"would run"*) fail "cursor current -> should not print a would-run line";; *) pass "cursor current -> no would-run line on stdout";; esac

# STALE: add a signal NEWER than the cursor -> gate opens. DRY_RUN so we observe the gate
# open without needing a real flow, and confirm it still has no side effects.
sleep 1
: > "$SIGDIR/new.md"
CUR_BEFORE="$(mtime "$GATE_CUR")"
SRR_ENV+=( "DRY_RUN=1" )
run_srr
[ "$RC" = 0 ] && pass "cursor stale -> exit 0" || fail "cursor stale -> exit 0 (got $RC)"
case "$LAST_OUT" in *"would run"*) pass "cursor stale -> gate OPENED (printed would-run under DRY_RUN)";; *) fail "cursor stale -> gate should open (no would-run line: '$LAST_OUT')";; esac
[ ! -e "$GATE_SENT" ] && pass "cursor stale + DRY_RUN -> flow NOT run" || fail "DRY_RUN must not run the flow"
[ "$(mtime "$GATE_CUR")" = "$CUR_BEFORE" ] && pass "cursor stale + DRY_RUN -> cursor NOT advanced" \
  || fail "DRY_RUN must not advance the cursor"

# ---------------------------------------------------------------------------
# DRY_RUN with a built (SRR_PROMPT) invocation: the preview shows the real claude command,
# and nothing runs.
# ---------------------------------------------------------------------------
echo "-- DRY_RUN previews the built claude invocation, no side effects"
DR_CUR="$WORK/dry_cursor"; rm -f "$DR_CUR"
SRR_ENV=(
  "SRR_JOB_NAME=dry" "SRR_CURSOR_FILE=$DR_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/dry_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_SUCCESS_CMD=exit 0" "SRR_PROMPT=/test-track" "DRY_RUN=1"
)
run_srr
[ "$RC" = 0 ] && pass "DRY_RUN built-invocation -> exit 0" || fail "DRY_RUN built-invocation -> exit 0 (got $RC)"
case "$LAST_OUT" in *"/test-track"*) pass "DRY_RUN preview contains the prompt (/test-track)";; *) fail "DRY_RUN preview should contain the prompt: '$LAST_OUT'";; esac
case "$LAST_OUT" in *"bypassPermissions"*) pass "DRY_RUN preview contains --permission-mode bypassPermissions";; *) fail "DRY_RUN preview should contain bypassPermissions: '$LAST_OUT'";; esac
[ ! -e "$DR_CUR" ] && pass "DRY_RUN -> cursor not created" || fail "DRY_RUN -> cursor must not be created"

# ---------------------------------------------------------------------------
# SUCCESS: a complete run advances the cursor (mtime touch + optional content write).
# ---------------------------------------------------------------------------
echo "-- complete success advances the cursor (touch + optional content write)"
OK_CUR="$WORK/ok_cursor"; OK_PROP="$WORK/ok_proposal"
rm -f "$OK_PROP"
# pre-seed the cursor with an ancient mtime so an advance is unambiguous
: > "$OK_CUR"; touch -t 202001010000 "$OK_CUR"
OK_BEFORE="$(mtime "$OK_CUR")"
# flow sleeps 1s then produces a proposal newer than the start marker; success predicate
# is a find-newer against $SRR_START_MARKER (exported by the runner).
SRR_ENV=(
  "SRR_JOB_NAME=ok" "SRR_CURSOR_FILE=$OK_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/ok_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=sleep 1; touch $OK_PROP"
  "SRR_SUCCESS_CMD=find $WORK -name ok_proposal -newer \"\$SRR_START_MARKER\" | grep -q ."
  "SRR_ADVANCE_CMD=printf %s 2.0.0 > \"\$SRR_CURSOR_FILE\""
)
run_srr
[ "$RC" = 0 ] && pass "complete run -> exit 0" || fail "complete run -> exit 0 (got $RC; stderr: $(cat "$WORK/stderr"))"
[ -e "$OK_PROP" ] && pass "complete run -> flow produced the proposal artifact" || fail "complete run -> proposal artifact missing"
[ "$(mtime "$OK_CUR")" -gt "$OK_BEFORE" ] && pass "complete run -> cursor mtime advanced" \
  || fail "complete run -> cursor mtime must advance (before=$OK_BEFORE now=$(mtime "$OK_CUR"))"
[ "$(cat "$OK_CUR" 2>/dev/null)" = "2.0.0" ] && pass "complete run -> SRR_ADVANCE_CMD wrote the new cursor content (2.0.0)" \
  || fail "complete run -> advance cmd should have written 2.0.0 (got '$(cat "$OK_CUR" 2>/dev/null)')"

# ---------------------------------------------------------------------------
# NOPRODUCE: flow exits 0 but the success predicate finds nothing -> exit 4, cursor kept.
# ---------------------------------------------------------------------------
echo "-- flow produced nothing -> exit 4, cursor NOT advanced"
NP_CUR="$WORK/np_cursor"; : > "$NP_CUR"; touch -t 202001010000 "$NP_CUR"
NP_BEFORE="$(mtime "$NP_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=np" "SRR_CURSOR_FILE=$NP_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/np_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=true"
  "SRR_SUCCESS_CMD=find $WORK -name np_proposal_never -newer \"\$SRR_START_MARKER\" | grep -q ."
)
run_srr
[ "$RC" = 4 ] && pass "no artifact produced -> exit 4" || fail "no artifact produced -> exit 4 (got $RC)"
[ "$(mtime "$NP_CUR")" = "$NP_BEFORE" ] && pass "no artifact produced -> cursor NOT advanced" \
  || fail "no artifact produced -> cursor must not advance"

# ---------------------------------------------------------------------------
# FLOWFAIL: flow exits non-zero -> exit 4 even if the success predicate WOULD pass.
# ---------------------------------------------------------------------------
echo "-- flow exits non-zero -> exit 4 (precedence over the success predicate), cursor kept"
FF_CUR="$WORK/ff_cursor"; : > "$FF_CUR"; touch -t 202001010000 "$FF_CUR"
FF_BEFORE="$(mtime "$FF_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=ff" "SRR_CURSOR_FILE=$FF_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/ff_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=exit 7"
  "SRR_SUCCESS_CMD=exit 0"
)
run_srr
[ "$RC" = 4 ] && pass "flow exit 7 -> runner exit 4" || fail "flow exit 7 -> runner exit 4 (got $RC)"
[ "$(mtime "$FF_CUR")" = "$FF_BEFORE" ] && pass "flow failure -> cursor NOT advanced" \
  || fail "flow failure -> cursor must not advance"

# ---------------------------------------------------------------------------
# ADVANCE-FAIL: the flow produced an artifact but the cursor cannot be advanced -> exit 6.
# Two branches: (a) SRR_ADVANCE_CMD fails, (b) the cursor path is un-writable.
# ---------------------------------------------------------------------------
echo "-- produced-but-uncommittable cursor -> exit 6 (never a false success)"
AF_CUR="$WORK/af_cursor"; rm -f "$AF_CUR"
SRR_ENV=(
  "SRR_JOB_NAME=af" "SRR_CURSOR_FILE=$AF_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/af_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=true" "SRR_SUCCESS_CMD=exit 0"
  "SRR_ADVANCE_CMD=exit 1"
)
run_srr
[ "$RC" = 6 ] && pass "SRR_ADVANCE_CMD failure -> exit 6" || fail "SRR_ADVANCE_CMD failure -> exit 6 (got $RC)"

# un-writable cursor path (/dev/null is a char device; /dev/null/x cannot be created)
SRR_ENV=(
  "SRR_JOB_NAME=af2" "SRR_CURSOR_FILE=/dev/null/cursor" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/af2_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=true" "SRR_SUCCESS_CMD=exit 0"
)
run_srr
[ "$RC" = 6 ] && pass "un-writable cursor path -> exit 6" || fail "un-writable cursor path -> exit 6 (got $RC)"

# ---------------------------------------------------------------------------
# PGKILL-PREMISE: the physics the watchdog depends on. A single-pid kill of a process-group
# leader leaves a reparented grandchild alive; only a GROUP kill (kill -SIG -pgid) reaps it.
# If this premise ever breaks, the TIMEOUT scenario below proves nothing, so it is asserted
# first (the repo's premise-before-control discipline).
# ---------------------------------------------------------------------------
echo "-- PREMISE: group kill reaches a reparented grandchild; single-pid kill does not"
export PREMISE_GCF="$WORK/premise_gc"; rm -f "$PREMISE_GCF"
cat > "$WORK/premise_leader.sh" <<'EOS'
#!/bin/bash
# grandchild records its own pid then becomes a bare sleep (survives its parent's death)
bash -c 'echo $$ > "$PREMISE_GCF"; exec sleep 999' &
sleep 999
EOS
perl -e 'setpgrp 0,0; exec @ARGV or exit 127' -- /bin/bash "$WORK/premise_leader.sh" &
LEADER=$!
disown "$LEADER" 2>/dev/null || true   # suppress bash's "Killed: 9" job-control notice when we kill it below
LEAK_PIDS="$LEAK_PIDS $LEADER"
gcpid=""
for _i in $(seq 1 25); do [ -s "$PREMISE_GCF" ] && { gcpid="$(cat "$PREMISE_GCF")"; break; }; sleep 0.2; done
LEAK_PIDS="$LEAK_PIDS $gcpid"
if [ -n "$gcpid" ] && kill -0 "$gcpid" 2>/dev/null; then
  pass "premise: grandchild $gcpid running under group leader $LEADER"
  kill -KILL "$LEADER" 2>/dev/null; sleep 0.5
  if kill -0 "$gcpid" 2>/dev/null; then
    pass "single-pid kill of the leader leaves the reparented grandchild ALIVE (group kill is required)"
  else
    fail "single-pid kill unexpectedly reaped the grandchild - premise broken, TIMEOUT scenario would prove nothing"
  fi
  kill -KILL "-$LEADER" 2>/dev/null; sleep 0.5
  if kill -0 "$gcpid" 2>/dev/null; then
    fail "group kill (kill -SIG -pgid) did NOT reap the grandchild $gcpid - group signalling broken on this host"
  else
    pass "group kill reaps the reparented grandchild"
  fi
else
  fail "premise setup failed: no live grandchild recorded (got '$gcpid')"
fi

# ---------------------------------------------------------------------------
# TIMEOUT: a hung flow that spawns a TERM-IGNORING grandchild. The runner must exit 5,
# leave the cursor untouched, and the group-KILL sweep must reap the TERM-ignoring
# grandchild (a single-pid kill would not) - all within the wall clock.
# ---------------------------------------------------------------------------
echo "-- watchdog group-kills a hung, TERM-ignoring child within the wall clock -> exit 5"
export H_GCF="$WORK/h_gc"; rm -f "$H_GCF"
cat > "$WORK/h_flow.sh" <<'EOS'
#!/bin/bash
# grandchild ignores TERM and loops - only a group KILL reaps it; records its pid.
bash -c 'trap "" TERM; echo $$ > "$H_GCF"; while :; do sleep 1; done' &
# the flow itself hangs well past the timeout
sleep 999
EOS
TO_CUR="$WORK/to_cursor"; : > "$TO_CUR"; touch -t 202001010000 "$TO_CUR"
TO_BEFORE="$(mtime "$TO_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=timeout" "SRR_CURSOR_FILE=$TO_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/to_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_SUCCESS_CMD=exit 0"
  "SRR_FLOW_CMD=/bin/bash $WORK/h_flow.sh"
  "H_GCF=$H_GCF"
  "SRR_TIMEOUT_SECS=2" "SRR_POLL_SECS=1" "SRR_GRACE_SECS=1"
)
t0=$SECONDS
run_srr
elapsed=$((SECONDS - t0))
h_gcpid="$(cat "$H_GCF" 2>/dev/null || true)"
[ -n "$h_gcpid" ] && LEAK_PIDS="$LEAK_PIDS $h_gcpid"
[ "$RC" = 5 ] && pass "hung flow -> exit 5 (timed out)" || fail "hung flow -> exit 5 (got $RC; stderr: $(cat "$WORK/stderr"))"
# TIMEOUT_SECS 2 + GRACE 1 = ~3s; allow generous slack for scheduler jitter but bound it so
# a watchdog that never fired (and blocked ~forever) is caught.
[ "$elapsed" -ge 2 ] && pass "watchdog waited the full timeout before killing (elapsed ${elapsed}s >= 2s)" \
  || fail "watchdog fired too early (elapsed ${elapsed}s < 2s) - it is not honoring SRR_TIMEOUT_SECS"
[ "$elapsed" -le 30 ] && pass "watchdog killed the hung flow promptly (elapsed ${elapsed}s <= 30s)" \
  || fail "watchdog did NOT kill the hung flow in time (elapsed ${elapsed}s) - the wall clock is not enforced"
if [ -n "$h_gcpid" ]; then
  if kill -0 "$h_gcpid" 2>/dev/null; then
    fail "the TERM-ignoring grandchild $h_gcpid SURVIVED - the group-KILL sweep did not reach it"
  else
    pass "the TERM-ignoring grandchild ($h_gcpid) was group-KILLed (single-pid kill could not have done this)"
  fi
else
  fail "grandchild pid was never recorded - the hung flow did not start as expected"
fi
[ "$(mtime "$TO_CUR")" = "$TO_BEFORE" ] && pass "timeout -> cursor NOT advanced" \
  || fail "timeout -> cursor must not advance"

# ---------------------------------------------------------------------------
# PRECHECK-CONTRACT (finding 1): the gate decision is on STDOUT ("run"/"skip") + exit 0. ANY
# non-zero pre-check exit means the gate itself BROKE -> exit 2, never a silent skip. This
# closes the masked-failure hole where a broken gate exited 1 and was read as "no new signal"
# and the runner then no-op'd forever.
# ---------------------------------------------------------------------------
echo "-- pre-check contract: non-zero exit ERRORS (never skips); run/skip decided on stdout"

# (a) a pre-check that dies non-zero (exit 1, which USED to mean 'skip') -> runner ERRORS.
PCC_CUR="$WORK/pcc_cursor"; PCC_SENT="$WORK/pcc_sentinel"; rm -f "$PCC_CUR" "$PCC_SENT"
SRR_ENV=(
  "SRR_JOB_NAME=pcc" "SRR_CURSOR_FILE=$PCC_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/pcc_log" "SRR_PRECHECK_CMD=exit 1"
  "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $PCC_SENT"
)
run_srr
[ "$RC" = 2 ] && pass "pre-check exit 1 -> runner exit 2 (no longer a silent skip)" || fail "pre-check exit 1 -> runner exit 2 (got $RC)"
[ ! -e "$PCC_SENT" ] && pass "pre-check exit 1 -> flow NOT run" || fail "pre-check exit 1 -> flow must not run"
[ ! -e "$PCC_CUR" ]  && pass "pre-check exit 1 -> cursor NOT advanced" || fail "pre-check exit 1 -> cursor must not advance"

# (b) a MASKED-IN-A-PIPELINE failure that surfaces as a non-zero exit -> runner ERRORS, not
#     skip (the exact repro: a missing command behind a pipeline, made loud with pipefail).
#     NOTE: the runner cannot police a pre-check that catches its own error and DELIBERATELY
#     prints "skip" - that residual is the pre-check author's responsibility (the contract
#     says: guard fallible steps with `|| exit 2` / `set -o pipefail` so an internal failure
#     surfaces as a non-zero exit). What the runner guarantees is that a non-zero exit can
#     never be read as a skip; this case proves that.
PCC2_SENT="$WORK/pcc2_sentinel"; rm -f "$PCC2_SENT"
SRR_ENV=(
  "SRR_JOB_NAME=pcc2" "SRR_CURSOR_FILE=$WORK/pcc2_cursor" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/pcc2_log"
  "SRR_PRECHECK_CMD=set -o pipefail; this_command_does_not_exist_xyz | cat"
  "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $PCC2_SENT"
)
run_srr
[ "$RC" = 2 ] && pass "masked-in-a-pipeline failure -> runner exit 2 (broken gate, not a skip)" || fail "masked-pipeline failure -> runner exit 2 (got $RC)"
[ ! -e "$PCC2_SENT" ] && pass "masked-pipeline failure -> flow NOT run" || fail "masked-pipeline failure -> flow must not run"

# (c) a well-behaved pre-check that prints "skip" -> clean skip (exit 0), flow NOT run, cursor kept.
PCC3_CUR="$WORK/pcc3_cursor"; PCC3_SENT="$WORK/pcc3_sentinel"
: > "$PCC3_CUR"; touch -t 202001010000 "$PCC3_CUR"; rm -f "$PCC3_SENT"
PCC3_BEFORE="$(mtime "$PCC3_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=pcc3" "SRR_CURSOR_FILE=$PCC3_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/pcc3_log" "SRR_PRECHECK_CMD=echo skip"
  "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $PCC3_SENT"
)
run_srr
[ "$RC" = 0 ] && pass "pre-check prints 'skip' -> exit 0 (clean skip)" || fail "pre-check 'skip' -> exit 0 (got $RC)"
[ ! -e "$PCC3_SENT" ] && pass "pre-check 'skip' -> flow NOT run" || fail "pre-check 'skip' -> flow must not run"
[ "$(mtime "$PCC3_CUR")" = "$PCC3_BEFORE" ] && pass "pre-check 'skip' -> cursor NOT advanced" || fail "pre-check 'skip' -> cursor must not advance"

# (d) a well-behaved pre-check that prints "run" -> flow RUNS to a complete run (exit 0).
PCC4_CUR="$WORK/pcc4_cursor"; PCC4_SENT="$WORK/pcc4_sentinel"; rm -f "$PCC4_CUR" "$PCC4_SENT"
SRR_ENV=(
  "SRR_JOB_NAME=pcc4" "SRR_CURSOR_FILE=$PCC4_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/pcc4_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $PCC4_SENT"
)
run_srr
[ "$RC" = 0 ] && pass "pre-check prints 'run' -> exit 0 (complete run)" || fail "pre-check 'run' -> exit 0 (got $RC; stderr: $(cat "$WORK/stderr"))"
[ -e "$PCC4_SENT" ] && pass "pre-check 'run' -> flow WAS run (sentinel present)" || fail "pre-check 'run' -> flow must run"

# (e) exit 0 with NO run/skip decision -> ambiguous gate is an ERROR (exit 2), never a skip.
PCC5_SENT="$WORK/pcc5_sentinel"; rm -f "$PCC5_SENT"
SRR_ENV=(
  "SRR_JOB_NAME=pcc5" "SRR_CURSOR_FILE=$WORK/pcc5_cursor" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/pcc5_log" "SRR_PRECHECK_CMD=exit 0"
  "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $PCC5_SENT"
)
run_srr
[ "$RC" = 2 ] && pass "pre-check exit 0 with no run/skip decision -> exit 2 (ambiguous gate errors)" || fail "no-decision pre-check -> exit 2 (got $RC)"
[ ! -e "$PCC5_SENT" ] && pass "no-decision pre-check -> flow NOT run" || fail "no-decision pre-check -> flow must not run"

# ---------------------------------------------------------------------------
# ADVANCE-ROLLBACK (finding 2): an SRR_ADVANCE_CMD that PARTIAL-WRITES the cursor then dies
# non-zero must NOT leave the cursor changed - otherwise the next run sees it as current,
# skips, and a cycle is silently lost. The runner snapshots the cursor and rolls it back
# (content AND mtime), or deletes it if it did not exist. Distinct from ADVANCE-FAIL, whose
# advance-cmd never touched the cursor.
# ---------------------------------------------------------------------------
echo "-- advance-cmd partial-writes then FAILS -> cursor rolled back (content AND mtime), exit 6"
AR_CUR="$WORK/ar_cursor"
printf 'ORIG-1.0.0' > "$AR_CUR"; touch -t 202001010000 "$AR_CUR"
AR_CONTENT_BEFORE="$(cat "$AR_CUR")"
AR_MTIME_BEFORE="$(mtime "$AR_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=ar" "SRR_CURSOR_FILE=$AR_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/ar_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=true" "SRR_SUCCESS_CMD=exit 0"
  "SRR_ADVANCE_CMD=printf PARTIAL-9.9.9 > \"\$SRR_CURSOR_FILE\"; exit 1"
)
run_srr
[ "$RC" = 6 ] && pass "advance partial-write + fail -> exit 6" || fail "advance partial-write + fail -> exit 6 (got $RC)"
[ "$(cat "$AR_CUR" 2>/dev/null)" = "$AR_CONTENT_BEFORE" ] && pass "advance failure -> cursor CONTENT rolled back (unchanged)" \
  || fail "advance failure -> cursor content must be unchanged (before='$AR_CONTENT_BEFORE' now='$(cat "$AR_CUR" 2>/dev/null)')"
[ "$(mtime "$AR_CUR")" = "$AR_MTIME_BEFORE" ] && pass "advance failure -> cursor MTIME rolled back (unchanged)" \
  || fail "advance failure -> cursor mtime must be unchanged (before=$AR_MTIME_BEFORE now=$(mtime "$AR_CUR"))"

# sub-case: the cursor did NOT exist; a partial write + failed advance must leave it absent.
AR2_CUR="$WORK/ar2_cursor"; rm -f "$AR2_CUR"
SRR_ENV=(
  "SRR_JOB_NAME=ar2" "SRR_CURSOR_FILE=$AR2_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/ar2_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=true" "SRR_SUCCESS_CMD=exit 0"
  "SRR_ADVANCE_CMD=printf PARTIAL > \"\$SRR_CURSOR_FILE\"; exit 1"
)
run_srr
[ "$RC" = 6 ] && pass "advance fail (no prior cursor) -> exit 6" || fail "advance fail (no prior cursor) -> exit 6 (got $RC)"
[ ! -e "$AR2_CUR" ] && pass "advance fail (no prior cursor) -> partial cursor removed (rolled back to absent)" \
  || fail "advance fail -> partial cursor must be removed (found '$(cat "$AR2_CUR" 2>/dev/null)')"

# sub-case (Codex High #2): even with a BROKEN temp dir (TMPDIR unwritable), the rollback is
# NOT best-effort - the cursor is snapshotted next to itself and a failed partial-writing
# advance still rolls back cleanly (proves the sibling-snapshot fallback + verified restore).
H2_CUR="$WORK/h2_cursor"; printf 'ORIG-1.0.0' > "$H2_CUR"; touch -t 202001010000 "$H2_CUR"
H2_CONTENT_BEFORE="$(cat "$H2_CUR")"; H2_MTIME_BEFORE="$(mtime "$H2_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=h2" "SRR_CURSOR_FILE=$H2_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/h2_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=true" "SRR_SUCCESS_CMD=exit 0"
  "SRR_ADVANCE_CMD=printf PARTIAL-9.9.9 > \"\$SRR_CURSOR_FILE\"; exit 1"
  "TMPDIR=/dev/null"
)
run_srr
[ "$RC" = 6 ] && pass "broken TMPDIR + advance fail -> exit 6" || fail "broken TMPDIR + advance fail -> exit 6 (got $RC)"
[ "$(cat "$H2_CUR" 2>/dev/null)" = "$H2_CONTENT_BEFORE" ] && pass "broken TMPDIR -> cursor CONTENT still rolled back (sibling snapshot)" \
  || fail "broken TMPDIR -> cursor content must be unchanged (now='$(cat "$H2_CUR" 2>/dev/null)')"
[ "$(mtime "$H2_CUR")" = "$H2_MTIME_BEFORE" ] && pass "broken TMPDIR -> cursor MTIME still rolled back" \
  || fail "broken TMPDIR -> cursor mtime must be unchanged (before=$H2_MTIME_BEFORE now=$(mtime "$H2_CUR"))"
# the sibling snapshot used for the fallback must be cleaned up, never left next to the cursor
[ -z "$(ls "$H2_CUR".srrsnap.* 2>/dev/null)" ] && pass "broken TMPDIR -> no sibling snapshot file left behind" \
  || fail "broken TMPDIR -> a sibling snapshot leaked: $(ls "$H2_CUR".srrsnap.* 2>/dev/null)"

# ---------------------------------------------------------------------------
# FLOW-WRITES-CURSOR (Codex Medium #4): a misbehaving FLOW that writes the cursor itself and
# then FAILS must not leave the cursor advanced. The pre-flow snapshot rolls it back on the
# exit-4 (incomplete) path, upholding "advance ONLY on complete success".
# ---------------------------------------------------------------------------
echo "-- a failing flow that wrote the cursor itself is rolled back (exit 4, cursor pre-run)"
C4_CUR="$WORK/c4_cursor"; printf 'ORIG-1.0.0' > "$C4_CUR"; touch -t 202001010000 "$C4_CUR"
C4_CONTENT_BEFORE="$(cat "$C4_CUR")"; C4_MTIME_BEFORE="$(mtime "$C4_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=c4" "SRR_CURSOR_FILE=$C4_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/c4_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=printf 9.9.9 > \"\$SRR_CURSOR_FILE\"; exit 7" "SRR_SUCCESS_CMD=exit 0"
)
run_srr
[ "$RC" = 4 ] && pass "flow writes cursor then exits 7 -> exit 4 (incomplete)" || fail "flow writes cursor + exit 7 -> exit 4 (got $RC)"
[ "$(cat "$C4_CUR" 2>/dev/null)" = "$C4_CONTENT_BEFORE" ] && pass "failed flow's cursor write rolled back (content)" \
  || fail "failed flow -> cursor content must be pre-run (now='$(cat "$C4_CUR" 2>/dev/null)')"
[ "$(mtime "$C4_CUR")" = "$C4_MTIME_BEFORE" ] && pass "failed flow's cursor write rolled back (mtime)" \
  || fail "failed flow -> cursor mtime must be pre-run (before=$C4_MTIME_BEFORE now=$(mtime "$C4_CUR"))"

# ---------------------------------------------------------------------------
# CD-NO-ORPHAN (reviewer Low 2a): a cd into REPO_ROOT that passes the -d check but then fails
# (dir not searchable) must die 2 BEFORE the run temp dir is created, so no temp is orphaned.
# Guarded: skipped as root (root bypasses the permission that makes cd fail) and skipped if the
# platform lets the owner cd into a 0000 dir anyway (then the premise does not hold).
# ---------------------------------------------------------------------------
echo "-- a cd failure after the repo -d check does not orphan a run temp dir (exit 2)"
if [ "$(id -u)" = 0 ]; then
  pass "CD-NO-ORPHAN skipped (running as root; cd cannot be made to fail by permission)"
else
  RO_REPO="$WORK/ro_repo"; mkdir -p "$RO_REPO"; chmod 000 "$RO_REPO"
  if ( cd "$RO_REPO" ) 2>/dev/null; then
    chmod 755 "$RO_REPO" 2>/dev/null || true
    pass "CD-NO-ORPHAN skipped (this platform allows cd into a 0000 dir; premise does not hold)"
  else
    RO_TMP="$WORK/ro_tmp"; mkdir -p "$RO_TMP"
    SRR_ENV=(
      "SRR_JOB_NAME=rocd" "SRR_CURSOR_FILE=$WORK/rocd_cursor" "SRR_REPO_ROOT=$RO_REPO"
      "SRR_LOG_FILE=$WORK/rocd_log" "SRR_PRECHECK_CMD=echo run"
      "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=true" "TMPDIR=$RO_TMP"
    )
    run_srr
    chmod 755 "$RO_REPO" 2>/dev/null || true   # restore so the trap cleanup can remove it
    [ "$RC" = 2 ] && pass "cd failure (repo passes -d but is not cd-able) -> exit 2" || fail "cd failure -> exit 2 (got $RC)"
    [ -z "$(ls -A "$RO_TMP" 2>/dev/null)" ] && pass "cd failure -> no run temp dir orphaned under TMPDIR" \
      || fail "cd failure -> a run temp dir was orphaned under TMPDIR: $(ls -A "$RO_TMP" 2>/dev/null)"
  fi
fi

# ---------------------------------------------------------------------------
# NORMAL-REAP (finding 3): a flow that backgrounds a TERM-ignoring descendant and exits 0
# must not leak that descendant. The watchdog stopped when the leader exited, so the NORMAL
# (non-timeout) path must group-KILL the flow's process group before deciding success.
# ---------------------------------------------------------------------------
echo "-- watchdog reaps a backgrounded TERM-ignoring survivor on NORMAL (exit 0) completion"
export N_GCF="$WORK/n_gc"; rm -f "$N_GCF"
cat > "$WORK/n_flow.sh" <<'EOS'
#!/bin/bash
# background a TERM-ignoring survivor (records its pid, then loops - only a group KILL reaps it)
bash -c 'trap "" TERM; echo $$ > "$N_GCF"; while :; do sleep 1; done' &
# wait until the survivor has recorded its pid, then complete NORMALLY (exit 0)
for _i in $(seq 1 25); do [ -s "$N_GCF" ] && break; sleep 0.2; done
exit 0
EOS
NC_CUR="$WORK/nc_cursor"; : > "$NC_CUR"; touch -t 202001010000 "$NC_CUR"
SRR_ENV=(
  "SRR_JOB_NAME=normalreap" "SRR_CURSOR_FILE=$NC_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/nc_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_SUCCESS_CMD=exit 0"
  "SRR_FLOW_CMD=/bin/bash $WORK/n_flow.sh"
  "N_GCF=$N_GCF"
  "SRR_TIMEOUT_SECS=30" "SRR_POLL_SECS=1" "SRR_GRACE_SECS=1"
)
run_srr
n_gcpid="$(cat "$N_GCF" 2>/dev/null || true)"
[ -n "$n_gcpid" ] && LEAK_PIDS="$LEAK_PIDS $n_gcpid"
[ "$RC" = 0 ] && pass "flow exits 0 -> runner exit 0 (complete run)" || fail "flow exits 0 -> runner exit 0 (got $RC; stderr: $(cat "$WORK/stderr"))"
if [ -n "$n_gcpid" ]; then
  # poll briefly: KILL is async and the reparented survivor is reaped by init a beat later.
  _dead=0
  for _i in $(seq 1 25); do kill -0 "$n_gcpid" 2>/dev/null || { _dead=1; break; }; sleep 0.2; done
  [ "$_dead" = 1 ] && pass "the TERM-ignoring survivor ($n_gcpid) was reaped on normal completion (single-pid kill could not have done this)" \
    || fail "the TERM-ignoring survivor $n_gcpid SURVIVED a normal completion - the normal-path group reap did not reach it"
else
  fail "survivor pid was never recorded - the flow did not start as expected"
fi

# ---------------------------------------------------------------------------
# DRY_RUN-PRECHECK (finding 4): the corrected doc says DRY_RUN RUNS the gate (its side effects
# and log line are NOT suppressed) - only the flow and the cursor advance are skipped. Lock
# that: a DRY_RUN whose pre-check touches a sentinel must leave the sentinel behind.
# ---------------------------------------------------------------------------
echo "-- DRY_RUN runs the pre-check (doc/behavior lock), but not the flow or cursor advance"
DP_CUR="$WORK/dp_cursor"; DP_PCSENT="$WORK/dp_precheck_ran"; DP_FLOWSENT="$WORK/dp_flow_ran"
rm -f "$DP_CUR" "$DP_PCSENT" "$DP_FLOWSENT"
SRR_ENV=(
  "SRR_JOB_NAME=dryprecheck" "SRR_CURSOR_FILE=$DP_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/dp_log"
  "SRR_PRECHECK_CMD=touch $DP_PCSENT; echo run"
  "SRR_SUCCESS_CMD=exit 0" "SRR_FLOW_CMD=touch $DP_FLOWSENT" "DRY_RUN=1"
)
run_srr
[ "$RC" = 0 ] && pass "DRY_RUN + gate opens -> exit 0" || fail "DRY_RUN + gate opens -> exit 0 (got $RC)"
[ -e "$DP_PCSENT" ] && pass "DRY_RUN -> the pre-check DID run (matches corrected doc)" || fail "DRY_RUN -> pre-check must run (doc says it does)"
[ ! -e "$DP_FLOWSENT" ] && pass "DRY_RUN -> the flow did NOT run" || fail "DRY_RUN -> flow must not run"
[ ! -e "$DP_CUR" ] && pass "DRY_RUN -> cursor NOT advanced/created" || fail "DRY_RUN -> cursor must not advance"
case "$LAST_OUT" in *"would run"*) pass "DRY_RUN -> printed the would-run preview";; *) fail "DRY_RUN -> should print would-run: '$LAST_OUT'";; esac

# ---------------------------------------------------------------------------
# PROPOSE-ONLY WRITE-FENCE (SRR_ALLOWED_WRITE_ROOTS): a clean flow that touches a repo file
# outside the allowed roots fails the run (exit 7) and rolls the cursor back; a flow that writes
# only inside them succeeds. Needs a git work tree (the fence inspects git's view); armed-but-not-
# git fails closed.
# ---------------------------------------------------------------------------
echo "-- propose-only write-fence (SRR_ALLOWED_WRITE_ROOTS)"
GREPO="$WORK/gitrepo"
mkdir -p "$GREPO/allowed" "$GREPO/live"
( cd "$GREPO" && git init -q && git config user.email t@t && git config user.name t \
  && printf 'orig\n' > live/registry.txt && git add -A && git commit -qm init ) 2>/dev/null

# compliant: flow writes ONLY under allowed/ -> exit 0, cursor advances
FEN_CUR="$WORK/fen_cursor"; : > "$FEN_CUR"; touch -t 202001010000 "$FEN_CUR"; FEN_BEFORE="$(mtime "$FEN_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=fenok" "SRR_CURSOR_FILE=$FEN_CUR" "SRR_REPO_ROOT=$GREPO"
  "SRR_LOG_FILE=$WORK/fenok_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=printf x > $GREPO/allowed/proposal.md"
  "SRR_SUCCESS_CMD=find $GREPO/allowed -name proposal.md -newer \"\$SRR_START_MARKER\" | grep -q ."
  "SRR_ALLOWED_WRITE_ROOTS=allowed"
)
run_srr
[ "$RC" = 0 ] && pass "fence: flow writes only inside allowed roots -> exit 0" || fail "fence compliant -> exit 0 (got $RC; stderr: $(cat "$WORK/stderr"))"
[ "$(mtime "$FEN_CUR")" -gt "$FEN_BEFORE" ] && pass "fence: compliant run advances the cursor" || fail "fence compliant -> cursor should advance"

# violation: flow ALSO edits a live file outside allowed roots -> exit 7, cursor NOT advanced
FEV_CUR="$WORK/fev_cursor"; : > "$FEV_CUR"; touch -t 202001010000 "$FEV_CUR"; FEV_BEFORE="$(mtime "$FEV_CUR")"
SRR_ENV=(
  "SRR_JOB_NAME=fenbad" "SRR_CURSOR_FILE=$FEV_CUR" "SRR_REPO_ROOT=$GREPO"
  "SRR_LOG_FILE=$WORK/fenbad_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=printf y > $GREPO/allowed/p2.md; printf HACKED > $GREPO/live/registry.txt"
  "SRR_SUCCESS_CMD=find $GREPO/allowed -name p2.md -newer \"\$SRR_START_MARKER\" | grep -q ."
  "SRR_ALLOWED_WRITE_ROOTS=allowed"
)
run_srr
[ "$RC" = 7 ] && pass "fence: a stray live-file write -> exit 7 (propose-only violated)" || fail "fence violation -> exit 7 (got $RC; stderr: $(cat "$WORK/stderr"))"
[ "$(mtime "$FEV_CUR")" = "$FEV_BEFORE" ] && pass "fence: violation rolls the cursor back (not advanced)" || fail "fence violation -> cursor must not advance"

# fail-closed: fence armed but SRR_REPO_ROOT is not a git work tree -> exit 7
FEC_CUR="$WORK/fec_cursor"
SRR_ENV=(
  "SRR_JOB_NAME=fenfc" "SRR_CURSOR_FILE=$FEC_CUR" "SRR_REPO_ROOT=$FAKE_REPO"
  "SRR_LOG_FILE=$WORK/fenfc_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=true" "SRR_SUCCESS_CMD=exit 0" "SRR_ALLOWED_WRITE_ROOTS=allowed"
)
run_srr
[ "$RC" = 7 ] && pass "fence: armed but non-git repo -> exit 7 (fail-closed)" || fail "fence fail-closed -> exit 7 (got $RC)"

# content-aware: a live file ALREADY dirty before the flow, re-modified by the flow, is STILL
# caught (a path-set diff would have skipped it; the worktree-tree diff sees the content change).
( cd "$GREPO" && git checkout -q -- live/registry.txt 2>/dev/null )   # reset from the violation test
FED_CUR="$WORK/fed_cursor"; : > "$FED_CUR"; touch -t 202001010000 "$FED_CUR"; FED_BEFORE="$(mtime "$FED_CUR")"
printf 'locally-edited\n' > "$GREPO/live/registry.txt"   # DIRTY before the run
SRR_ENV=(
  "SRR_JOB_NAME=fendirty" "SRR_CURSOR_FILE=$FED_CUR" "SRR_REPO_ROOT=$GREPO"
  "SRR_LOG_FILE=$WORK/fendirty_log" "SRR_PRECHECK_CMD=echo run"
  "SRR_FLOW_CMD=printf z > $GREPO/allowed/p3.md; printf INJECTED >> $GREPO/live/registry.txt"
  "SRR_SUCCESS_CMD=find $GREPO/allowed -name p3.md -newer \"\$SRR_START_MARKER\" | grep -q ."
  "SRR_ALLOWED_WRITE_ROOTS=allowed"
)
run_srr
[ "$RC" = 7 ] && pass "fence: a PRE-DIRTY live file re-modified by the flow -> exit 7 (content-aware)" || fail "fence pre-dirty re-mod -> exit 7 (got $RC; stderr: $(cat "$WORK/stderr"))"
[ "$(mtime "$FED_CUR")" = "$FED_BEFORE" ] && pass "fence: pre-dirty violation rolls the cursor back" || fail "fence pre-dirty -> cursor must not advance"

# ---------------------------------------------------------------------------
echo
echo "TALLY: $PASS passed, $FAIL failed"
if [ "$FAIL" = 0 ]; then
  echo "ALL SCHEDULED-RESEARCH-RUN CONTRACT CHECKS PASSED"
  exit 0
fi
exit 1
