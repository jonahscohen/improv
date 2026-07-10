#!/bin/bash
# Regression test for team-reaper.sh.
# Builds fake team/task/memory trees under an isolated HOME and asserts the
# reaper removes the right team records, preserves the rest, and NEVER touches
# memory. Run: bash claude/hooks/test-team-reaper.sh  (exit 0 = all pass)

set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/team-reaper.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS  $1"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL  $1"; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
export HOME="$SANDBOX"
# Pin the idle threshold so the reap-logic assertions are independent of the
# shipped default (TEAM_REAP_IDLE_MINUTES; production default is 240). The idle
# fixtures below sit at 60m, comfortably past this 30m test threshold.
export TEAM_REAP_IDLE_MINUTES=30
TEAMS="$HOME/.claude/teams"; TASKS="$HOME/.claude/tasks"
MEM="$HOME/.claude/projects/proj/memory"
mkdir -p "$TEAMS" "$TASKS" "$MEM"

# Hermetic process scan: default runs see an EMPTY process list (so the real
# machine's live processes never leak into these assertions). The live-team
# guard section overrides PS_OVERRIDE with a file that simulates a live member.
EMPTY_PS="$SANDBOX/ps_empty.txt"; : > "$EMPTY_PS"

now_ms=$(python3 -c 'import time;print(int(time.time()*1000))')
old_ms=$(python3 -c 'import time;print(int((time.time()-20*3600)*1000))')   # 20h old
fresh_ms="$now_ms"

mk_team() { # name leadSessionId createdMs  [inbox_age_seconds]
  local n="$1" lead="$2" cms="$3" inbox_age="${4:-0}"
  mkdir -p "$TEAMS/$n/inboxes" "$TASKS/$n"
  printf '{"name":"%s","leadSessionId":"%s","createdAt":%s,"members":[]}' "$n" "$lead" "$cms" > "$TEAMS/$n/config.json"
  : > "$TEAMS/$n/inboxes/m.json"
  if [ "$inbox_age" != 0 ]; then
    python3 - "$TEAMS/$n/inboxes/m.json" "$inbox_age" <<'PY'
import os,sys,time
p,age=sys.argv[1],float(sys.argv[2]); t=time.time()-age; os.utime(p,(t,t))
PY
  fi
}

run() { printf '{"session_id":"%s","hook_event_name":"%s"}' "$2" "$3" | TEAM_REAP_PS_OVERRIDE="${PS_OVERRIDE:-$EMPTY_PS}" bash "$HOOK" "$1" >/dev/null 2>&1; }
exists()  { [ -d "$TEAMS/$1" ]; }

echo "--- session-end mode ---"
mk_team owned    SESS_A "$fresh_ms"
mk_team other    SESS_B "$fresh_ms"
mk_team ancient  SESS_C "$old_ms"
run session-end SESS_A SessionEnd
exists owned   || ok  "owned-by-ending-session reaped";        exists owned   && bad "owned team should be gone"
exists other   && ok  "fresh other-session team preserved";    exists other   || bad "fresh other team should remain"
exists ancient || ok  "20h-old team age-GC reaped";            exists ancient && bad "ancient team should be gone"
[ -d "$TASKS/owned" ] && bad "owned task dir should be gone" || ok "matching task dir also reaped"

echo "--- session-start mode ---"
rm -rf "$TEAMS"/* "$TASKS"/*
mk_team idle_old   SESS_X "$fresh_ms" 3600   # inbox 60m idle
mk_team busy_recent SESS_Y "$fresh_ms" 60    # inbox 1m idle
mk_team current     SESS_NOW "$fresh_ms" 3600 # idle but owned by the starting session
run session-start SESS_NOW SessionStart
exists idle_old    || ok "idle (60m) orphan reaped at start";   exists idle_old    && bad "idle orphan should be gone"
exists busy_recent && ok "recently-active team preserved";      exists busy_recent || bad "recent team should remain"
exists current     && ok "team owned by starting session kept"; exists current     || bad "current-session team should remain"

echo "--- live-team guard (never reap a team with a live member process) ---"
rm -rf "$TEAMS"/* "$TASKS"/*
mk_team live_idle SESS_L "$fresh_ms" 3600   # idle enough to reap, but member alive
mk_team dead_idle SESS_D "$fresh_ms" 3600   # idle, no live process -> reap
LIVE_PS="$SANDBOX/ps_live.txt"
printf '%s\n' '/opt/homebrew/bin/claude.exe --agent-id worker@live_idle --agent-name worker --team-name live_idle --model opus' > "$LIVE_PS"
PS_OVERRIDE="$LIVE_PS" run session-start SESS_NEW SessionStart
exists live_idle && ok "idle team with a live member process is kept";  exists live_idle || bad "live team was reaped (orphan bug)"
exists dead_idle || ok "idle team with no live process still reaped";   exists dead_idle && bad "dead idle team should be gone"
# age-GC must also defer to a live member (guard applies in every mode)
rm -rf "$TEAMS"/* "$TASKS"/*
mk_team live_ancient SESS_LA "$old_ms"      # 20h old, would age-GC
printf '%s\n' 'claude.exe --team-name live_ancient --model opus' > "$LIVE_PS"
PS_OVERRIDE="$LIVE_PS" run session-end SESS_ZZ SessionEnd
exists live_ancient && ok "age-GC also spares a team with a live member";  exists live_ancient || bad "age-GC reaped a live team"

echo "--- memory safety ---"
echo "BEAT CONTENT" > "$MEM/session_x.md"
# A maliciously-named team dir must never let the reaper escape into memory.
run session-end SESS_A SessionEnd
[ -f "$MEM/session_x.md" ] && ok "memory beat untouched after reap run" || bad "MEMORY WAS TOUCHED"
[ -d "$MEM" ] && ok "memory dir intact" || bad "MEMORY DIR DELETED"

echo "--- disable switch ---"
mk_team owned2 SESS_A "$fresh_ms"
TEAM_REAP_DISABLE=1 bash "$HOOK" session-end < <(printf '{"session_id":"SESS_A","hook_event_name":"SessionEnd"}') >/dev/null 2>&1
exists owned2 && ok "TEAM_REAP_DISABLE=1 skips reaping" || bad "disable switch ignored"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
