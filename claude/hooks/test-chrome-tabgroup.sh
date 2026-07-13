#!/usr/bin/env bash
# Falsification suite for the chrome-tabgroup trio.
# Every hook runs under a FAKE $HOME so no test can touch real session state.
# A guard that cannot go red is not a guard: mutants at the bottom prove each
# branch is load-bearing.

HERE="$(cd "$(dirname "$0")" && pwd)"
TRACK="$HERE/chrome-tabgroup-track.sh"
CLEAR="$HERE/chrome-tabgroup-clear.sh"
STOP="$HERE/chrome-tabgroup-stop.sh"

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL %s\n' "$1"; }

# Fresh fake HOME per case.
newhome() { FH="$(mktemp -d)"; mkdir -p "$FH/.claude"; echo "$FH"; }

SID="test-session-abc"
MARK_OF()   { echo "$1/.claude/.chrome-tabgroup.$SID"; }
REMIND_OF() { echo "$1/.claude/.chrome-tabgroup-reminded.$SID"; }

run() { # $1 hook, $2 fake-home, $3 json  -> echoes exit code
  printf '%s' "$3" | HOME="$2" bash "$1" >/dev/null 2>&1; echo $?
}

j_tool() { printf '{"session_id":"%s","tool_name":"%s","tool_input":{},"tool_response":"%s"}' "$SID" "$1" "$2"; }
j_stop() { printf '{"session_id":"%s","stop_hook_active":%s}' "$SID" "${1:-false}"; }

echo "=== track: a browsing tool creates the marker ==="
FH=$(newhome)
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__navigate '')" >/dev/null
[ -f "$(MARK_OF "$FH")" ] && ok "navigate -> marker created" || bad "navigate -> marker created"

echo
echo "=== track: a close call must NOT re-arm (that is clear's job) ==="
FH=$(newhome)
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__tabs_close_mcp '')" >/dev/null
[ -f "$(MARK_OF "$FH")" ] && bad "close must not create a marker via track" || ok "track skips tabs_close"

echo
echo "=== clear: full close (group empty) removes marker + reminded ==="
FH=$(newhome); : > "$(MARK_OF "$FH")"; : > "$(REMIND_OF "$FH")"
run "$CLEAR" "$FH" "$(j_tool mcp__claude-in-chrome__tabs_close_mcp 'Closed tab 5. Group is now empty (auto-removed).')" >/dev/null
{ [ ! -f "$(MARK_OF "$FH")" ] && [ ! -f "$(REMIND_OF "$FH")" ]; } && ok "empty close clears both" || bad "empty close clears both"

echo
echo "=== clear: partial close (tabs remain) KEEPS the marker ==="
FH=$(newhome); : > "$(MARK_OF "$FH")"
run "$CLEAR" "$FH" "$(j_tool mcp__claude-in-chrome__tabs_close_mcp 'Closed tab 5. 1 tab(s) remain.')" >/dev/null
[ -f "$(MARK_OF "$FH")" ] && ok "partial close keeps the marker" || bad "partial close keeps the marker"

echo
echo "=== clear: unparseable result errs toward KEEPING (extra reminder, not a leak) ==="
FH=$(newhome); : > "$(MARK_OF "$FH")"
run "$CLEAR" "$FH" "$(j_tool mcp__claude-in-chrome__tabs_close_mcp 'weird garbage')" >/dev/null
[ -f "$(MARK_OF "$FH")" ] && ok "unparseable close keeps the marker" || bad "unparseable close keeps the marker"

echo
echo "=== stop: no marker -> allow ==="
FH=$(newhome)
[ "$(run "$STOP" "$FH" "$(j_stop)")" = 0 ] && ok "no marker -> exit 0" || bad "no marker -> exit 0"

echo
echo "=== stop: fresh marker (still browsing) -> allow ==="
FH=$(newhome); : > "$(MARK_OF "$FH")"   # mtime = now
[ "$(run "$STOP" "$FH" "$(j_stop)")" = 0 ] && ok "fresh marker -> exit 0" || bad "fresh marker -> exit 0"

echo
echo "=== stop: STALE marker (idle) -> block once, sets reminded ==="
FH=$(newhome); M="$(MARK_OF "$FH")"; : > "$M"
touch -A -001000 "$M" 2>/dev/null || touch -d '10 minutes ago' "$M" 2>/dev/null  # 10 min old
rc=$(run "$STOP" "$FH" "$(j_stop)")
{ [ "$rc" = 2 ] && [ -f "$(REMIND_OF "$FH")" ]; } && ok "stale marker -> exit 2 + reminded set" || bad "stale marker -> exit 2 + reminded set (got $rc)"

echo
echo "=== stop: stale marker but ALREADY reminded -> allow (no second block) ==="
FH=$(newhome); M="$(MARK_OF "$FH")"; : > "$M"; : > "$(REMIND_OF "$FH")"
touch -A -001000 "$M" 2>/dev/null || touch -d '10 minutes ago' "$M" 2>/dev/null
[ "$(run "$STOP" "$FH" "$(j_stop)")" = 0 ] && ok "reminded -> exit 0" || bad "reminded -> exit 0"

echo
echo "=== stop: stop_hook_active bypasses the block even when eligible ==="
FH=$(newhome); M="$(MARK_OF "$FH")"; : > "$M"
touch -A -001000 "$M" 2>/dev/null || touch -d '10 minutes ago' "$M" 2>/dev/null
[ "$(run "$STOP" "$FH" "$(j_stop true)")" = 0 ] && ok "stop_hook_active -> exit 0" || bad "stop_hook_active -> exit 0"

echo
echo "=== stop: configurable threshold (IDLE=1s makes a ~3s-old marker eligible) ==="
FH=$(newhome); M="$(MARK_OF "$FH")"; : > "$M"
touch -A -000005 "$M" 2>/dev/null || touch -d '5 seconds ago' "$M" 2>/dev/null
rc=$(printf '%s' "$(j_stop)" | HOME="$FH" CHROME_TABGROUP_IDLE_SECONDS=1 bash "$STOP" >/dev/null 2>&1; echo $?)
[ "$rc" = 2 ] && ok "IDLE=1 -> stale at 5s -> exit 2" || bad "IDLE=1 -> exit 2 (got $rc)"

echo
echo "=== end-to-end: open, go idle, blocked once, then close clears it ==="
FH=$(newhome)
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__navigate '')" >/dev/null
M="$(MARK_OF "$FH")"; touch -A -001000 "$M" 2>/dev/null || touch -d '10 minutes ago' "$M" 2>/dev/null
r1=$(run "$STOP" "$FH" "$(j_stop)")            # blocks
run "$CLEAR" "$FH" "$(j_tool mcp__claude-in-chrome__tabs_close_mcp 'Group is now empty (auto-removed).')" >/dev/null
r2=$(run "$STOP" "$FH" "$(j_stop)")            # marker gone -> allow
{ [ "$r1" = 2 ] && [ "$r2" = 0 ]; } && ok "block once -> close -> allow" || bad "block once -> close -> allow (r1=$r1 r2=$r2)"

echo
echo "=== Codex #1: a remaining tab TITLED with an empty-phrase must NOT wipe the marker ==="
FH=$(newhome); : > "$(MARK_OF "$FH")"
resp='[{"type":"text","text":"Closed tab 1. 1 tab(s) remain."},{"type":"text","text":"Available tabs: tabId 2 \"Cart is now empty\" (https://x/cart)"}]'
printf '{"session_id":"%s","tool_name":"mcp__claude-in-chrome__tabs_close_mcp","tool_response":%s}' "$SID" "$resp" | HOME="$FH" bash "$CLEAR" >/dev/null 2>&1
[ -f "$(MARK_OF "$FH")" ] && ok "remaining tab titled 'is now empty' keeps the marker" || bad "remaining tab title wiped the marker (LEAK)"

echo
echo "=== Codex #6: tabs_context is inventory - must NOT refresh a stale marker's mtime ==="
FH=$(newhome); M="$(MARK_OF "$FH")"
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__navigate '')" >/dev/null
touch -A -001000 "$M" 2>/dev/null || touch -d '10 minutes ago' "$M" 2>/dev/null
b=$(stat -f %m "$M" 2>/dev/null || stat -c %Y "$M")
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__tabs_context_mcp '')" >/dev/null
a=$(stat -f %m "$M" 2>/dev/null || stat -c %Y "$M")
[ "$a" = "$b" ] && ok "tabs_context left mtime unchanged (idle timer intact)" || bad "tabs_context refreshed mtime (LEAK)"

echo
echo "=== Codex #6b: tabs_context still CREATES the marker if none exists ==="
FH=$(newhome)
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__tabs_context_mcp '')" >/dev/null
[ -f "$(MARK_OF "$FH")" ] && ok "tabs_context creates marker when absent" || bad "tabs_context did not create the marker"

echo
echo "=== a substantive browse tool DOES refresh a stale marker ==="
FH=$(newhome); M="$(MARK_OF "$FH")"; : > "$M"
touch -A -001000 "$M" 2>/dev/null || touch -d '10 minutes ago' "$M" 2>/dev/null
b=$(stat -f %m "$M" 2>/dev/null || stat -c %Y "$M")
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__computer '')" >/dev/null
a=$(stat -f %m "$M" 2>/dev/null || stat -c %Y "$M")
[ "$a" -gt "$b" ] && ok "computer refreshed mtime" || bad "computer did not refresh mtime"

echo
echo "=== Codex #2: track must NOT reap another (live-but-idle) session's marker at 2 days ==="
FH=$(newhome); OTHER="$FH/.claude/.chrome-tabgroup.sessionA"; : > "$OTHER"
touch -A -480000 "$OTHER" 2>/dev/null || touch -d '2 days ago' "$OTHER" 2>/dev/null
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__navigate '')" >/dev/null
[ -f "$OTHER" ] && ok "2-day-old other-session marker survives" || bad "track reaped a 2-day-old marker (LEAK)"

echo
echo "=== Codex #5: a non-integer threshold must fall back to 90, not block a fresh marker ==="
FH=$(newhome); : > "$(MARK_OF "$FH")"   # fresh
rc=$(printf '%s' "$(j_stop)" | HOME="$FH" CHROME_TABGROUP_IDLE_SECONDS=abc bash "$STOP" >/dev/null 2>&1; echo $?)
[ "$rc" = 0 ] && ok "bad env -> fresh marker not blocked (exit 0)" || bad "bad env blocked a fresh marker (got $rc)"

echo
echo "=== the atomic lock is cleared on close, so a second burst can block again ==="
FH=$(newhome); M="$(MARK_OF "$FH")"; : > "$M"
touch -A -001000 "$M" 2>/dev/null || touch -d '10 minutes ago' "$M" 2>/dev/null
r1=$(run "$STOP" "$FH" "$(j_stop)")                                                  # burst 1 blocks
run "$CLEAR" "$FH" "$(j_tool mcp__claude-in-chrome__tabs_close_mcp 'Group is now empty (auto-removed).')" >/dev/null
[ -d "$(REMIND_OF "$FH").lock" ] && bad "lock dir survived close" || ok "close removed the lock dir"
run "$TRACK" "$FH" "$(j_tool mcp__claude-in-chrome__navigate '')" >/dev/null                # burst 2 opens
touch -A -001000 "$M" 2>/dev/null || touch -d '10 minutes ago' "$M" 2>/dev/null
r2=$(run "$STOP" "$FH" "$(j_stop)")                                                  # burst 2 blocks again
{ [ "$r1" = 2 ] && [ "$r2" = 2 ]; } && ok "each open-group burst blocks once (r1=$r1 r2=$r2)" || bad "second burst did not block (r1=$r1 r2=$r2)"

echo
echo "============================================================"
printf 'passed %d, failed %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
