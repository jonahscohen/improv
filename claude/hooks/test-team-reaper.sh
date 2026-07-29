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
# Same reason for the lead-transcript grace window (production default 240):
# the "fresh" transcript fixtures below are 0m old and the "stale" ones 60m.
export TEAM_REAP_LEAD_TRANSCRIPT_MINUTES=30
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

# Every run asserts the hook exited 0 and emitted its {} payload. Without this,
# a hook that CRASHED would reap nothing and silently satisfy every "must be
# kept" assertion below - the tests would go green precisely when broken.
run() {
  local out rc
  out=$(printf '{"session_id":"%s","hook_event_name":"%s"}' "$2" "$3" \
        | TEAM_REAP_PS_OVERRIDE="${PS_OVERRIDE:-$EMPTY_PS}" bash "$HOOK" "$1" 2>/dev/null)
  rc=$?
  [ "$rc" -eq 0 ] || bad "hook exited $rc (crash) on: $1 $2 $3"
  [ "$out" = "{}" ] || bad "hook emitted '$out' not '{}' on: $1 $2 $3"
}
exists()  { [ -d "$TEAMS/$1" ]; }

# Same crash tripwires as run(), for rows that need extra env on the invocation.
# Without them a crashed hook reaps nothing and every "kept" row passes vacuously.
run_env() { # "VAR=x VAR2=y"  mode session event
  local envs="$1" out rc
  out=$(printf '{"session_id":"%s","hook_event_name":"%s"}' "$3" "$4" \
        | env $envs TEAM_REAP_PS_OVERRIDE="${PS_OVERRIDE:-$EMPTY_PS}" bash "$HOOK" "$2" 2>/dev/null)
  rc=$?
  [ "$rc" -eq 0 ] || bad "hook exited $rc (crash) on: $2 $3 $4 [$envs]"
  [ "$out" = "{}" ] || bad "hook emitted '$out' not '{}' on: $2 $3 $4 [$envs]"
}

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
# A LONGER team name must not keep a shorter, dead one alive: a bare substring
# test matched "session-abc" inside "worker@session-abc2" and pinned the dir for
# as long as the colliding process lived.
rm -rf "$TEAMS"/* "$TASKS"/*
mk_team session-abc SESS_C1 "$fresh_ms" 3600
printf '%s\n' 'claude.exe --agent-id worker@session-abc2 --team-name session-abc2 --model opus' > "$LIVE_PS"
PS_OVERRIDE="$LIVE_PS" run session-start SESS_NEW SessionStart
exists session-abc && bad "a longer team name kept a shorter dead team alive" || ok "member match is token-bounded, not substring"
# Each member marker needs a fixture carrying ONLY that marker, or a mutant that
# kills one clause is masked by the others matching the same process line.
rm -rf "$TEAMS"/* "$TASKS"/*
mk_team atonly SESS_C2 "$fresh_ms" 3600
printf '%s\n' 'claude.exe --agent-id worker@atonly --agent-name worker --model opus' > "$LIVE_PS"
PS_OVERRIDE="$LIVE_PS" run session-start SESS_NEW SessionStart
exists atonly && ok "agent-id @team marker alone keeps the team" || bad "@team marker alone was ignored"
rm -rf "$TEAMS"/* "$TASKS"/*
mk_team pathonly SESS_C3 "$fresh_ms" 3600
printf '%s\n' 'tail -f /Users/x/.claude/teams/pathonly/inboxes/worker.json' > "$LIVE_PS"
PS_OVERRIDE="$LIVE_PS" run session-start SESS_NEW SessionStart
exists pathonly && ok "/teams/<name> path marker alone keeps the team" || bad "/teams path marker alone was ignored"
# The matchers accept an equals-form flag as well as the space form; production
# support that no row exercises is support nobody can rely on.
rm -rf "$TEAMS"/* "$TASKS"/*
mk_team eqform SESS_C4 "$fresh_ms" 3600
printf '%s\n' 'claude.exe --team-name=eqform --model opus' > "$LIVE_PS"
PS_OVERRIDE="$LIVE_PS" run session-start SESS_NEW SessionStart
exists eqform && ok "equals-form --team-name=<name> keeps the team" || bad "equals-form team-name marker was ignored"

echo "--- config-less orphan reap (dir with inboxes/ but no config.json) ---"
# A broken orphan: inboxes/ present, NO config.json. The harness writes
# config.json only at startup, so this is a partial reap or a compaction-
# continued session whose new teamId was never initialized. The OLD reaper
# skipped any config-less dir forever, so it lingered and broke every subsequent
# named spawn (reference_cmux_team_init_orphan_bug.md). It must now be reaped.
mk_orphan() { mkdir -p "$TEAMS/$1/inboxes" "$TASKS/$1"; : > "$TEAMS/$1/inboxes/team-lead.json"; }
rm -rf "$TEAMS"/* "$TASKS"/*
mk_orphan orphan_dead
run session-start SESS_ANY SessionStart
exists orphan_dead && bad "config-less orphan (no live proc) should be reaped" || ok "config-less orphan reaped at session-start"
[ -d "$TASKS/orphan_dead" ] && bad "config-less orphan task dir should be gone" || ok "config-less orphan matching task dir also reaped"

# ...but NEVER while a live member process references it (it may be mid-init).
rm -rf "$TEAMS"/* "$TASKS"/*
mk_orphan orphan_live
LIVE_ORPHAN_PS="$SANDBOX/ps_live_orphan.txt"
printf '%s\n' 'claude.exe --team-name orphan_live --agent-id lead@orphan_live --model opus' > "$LIVE_ORPHAN_PS"
PS_OVERRIDE="$LIVE_ORPHAN_PS" run session-start SESS_ANY SessionStart
exists orphan_live || bad "config-less orphan with a live member was reaped (mid-init hazard)"
exists orphan_live && ok "config-less orphan with a live member is kept"

# Config-less orphans are broken in every mode, so session-end reaps them too.
rm -rf "$TEAMS"/* "$TASKS"/*
mk_orphan orphan_end
run session-end SESS_ANY SessionEnd
exists orphan_end && bad "config-less orphan should also reap in session-end mode" || ok "config-less orphan reaped at session-end"

# A HEALTHY team must still be governed by the normal rules, not the config-less
# path: a fresh other-session team with a live-ish (recent) inbox is preserved.
rm -rf "$TEAMS"/* "$TASKS"/*
mk_team healthy SESS_H "$fresh_ms" 60
run session-start SESS_OTHER SessionStart
exists healthy || bad "healthy recent team must not be swept up by config-less handling"
exists healthy && ok "healthy configured team untouched by config-less path"

echo "--- live-LEAD guard (never reap a team whose lead session is alive) ---"
# The 2026-07-28 defect: only TEAMMATE processes carry the team name in argv, so
# once the standing teardown rule stands them all down, the member scan sees
# nothing and an idle-but-live lead team gets rmtree'd out from under the
# running session. The lead's own argv carries --session-id <leadSessionId> and
# never the team name; these fixtures use the shapes measured on the live
# machine (pids 56383/56638 for the lead, 73001 for a teammate).
PROJ="$HOME/.claude/projects/proj"
mk_transcript() { # leadSessionId [age_seconds]
  mkdir -p "$PROJ"; : > "$PROJ/$1.jsonl"
  if [ "${2:-0}" != 0 ]; then
    python3 - "$PROJ/$1.jsonl" "$2" <<'PY'
import os,sys,time
p,age=sys.argv[1],float(sys.argv[2]); t=time.time()-age; os.utime(p,(t,t))
PY
  fi
}
clear_all() { rm -rf "$TEAMS"/* "$TASKS"/*; rm -f "$PROJ"/*.jsonl; }
LEAD_A="5b305128-2ba0-47f4-b090-5029c05fcc6c"
LEAD_PS="$SANDBOX/ps_lead.txt"

# 1. Lead alive in the process list, ZERO teammate markers -> must be kept.
clear_all
mk_team lead_alive "$LEAD_A" "$fresh_ms" 3600
printf '%s\n' "zsh /Users/spare3/.claude/cmux/cmux-claude-launch.sh --session-id $LEAD_A --settings {}" > "$LEAD_PS"
PS_OVERRIDE="$LEAD_PS" run session-start TEAMMATE_SESS SessionStart
exists lead_alive && ok "idle team with a live LEAD process is kept" || bad "LIVE LEAD TEAM REAPED (the 2026-07-28 defect)"

# 2. The other direction, so the guard cannot just pin every dir forever: a
#    genuinely dead lead (no process, no transcript) is still reaped.
clear_all
mk_team lead_dead "$LEAD_A" "$fresh_ms" 3600
run session-start TEAMMATE_SESS SessionStart
exists lead_dead && bad "dead lead's idle team should still be reaped (leak)" || ok "idle team with a dead lead still reaped"

# 1b. Equals-form of the lead flag, same reasoning as the member equals-form.
clear_all
mk_team lead_eq "$LEAD_A" "$fresh_ms" 3600
printf '%s\n' "claude --session-id=$LEAD_A --model opus" > "$LEAD_PS"
PS_OVERRIDE="$LEAD_PS" run session-start TEAMMATE_SESS SessionStart
exists lead_eq && ok "equals-form --session-id=<lead> keeps the team" || bad "equals-form lead marker was ignored"

# 2b. A resumed lead carries --resume <leadSessionId>.
clear_all
mk_team lead_resume "$LEAD_A" "$fresh_ms" 3600
printf '%s\n' "claude --resume $LEAD_A --model opus" > "$LEAD_PS"
PS_OVERRIDE="$LEAD_PS" run session-start TEAMMATE_SESS SessionStart
exists lead_resume && ok "--resume also proves the lead is alive" || bad "--resume lead marker missed"

# 3. A teammate's argv carries --parent-session-id <leadSessionId>.
clear_all
mk_team lead_parent "$LEAD_A" "$fresh_ms" 3600
printf '%s\n' "claude.exe --agent-id w@other-team --parent-session-id $LEAD_A --model opus" > "$LEAD_PS"
PS_OVERRIDE="$LEAD_PS" run session-start TEAMMATE_SESS SessionStart
exists lead_parent && ok "--parent-session-id also proves the lead is alive" || bad "parent-session-id lead marker missed"

# 4. Age-GC must defer to a live lead too (the guard is reason-independent).
clear_all
mk_team lead_ancient "$LEAD_A" "$old_ms" 3600
printf '%s\n' "claude --session-id $LEAD_A --model opus" > "$LEAD_PS"
PS_OVERRIDE="$LEAD_PS" run session-start TEAMMATE_SESS SessionStart
exists lead_ancient && ok "age-GC also spares a team whose lead is alive" || bad "age-GC reaped a live-lead team"

# 5. Transcript signal: lead absent from argv but its transcript was just
#    written (a lead mid-restart, or an argv shape this scan does not know).
clear_all
mk_team lead_tx "$LEAD_A" "$fresh_ms" 3600
mk_transcript "$LEAD_A" 0
run session-start TEAMMATE_SESS SessionStart
exists lead_tx && ok "fresh lead transcript keeps the team (process gone)" || bad "fresh lead transcript ignored"

# 6. ...and it is a BOUNDED window, not an existence test. Transcripts are never
#    deleted, so an existence test would be a permanent false-alive and would
#    leak the directory forever. A stale transcript must NOT save the team.
clear_all
mk_team lead_tx_stale "$LEAD_A" "$fresh_ms" 3600
mk_transcript "$LEAD_A" 3600
run session-start TEAMMATE_SESS SessionStart
exists lead_tx_stale && bad "stale transcript kept the team (permanent false-alive leak)" || ok "stale lead transcript does NOT keep the team"

# 7. A transcript belonging to a DIFFERENT session must not cross-protect.
clear_all
mk_team lead_other_tx "$LEAD_A" "$fresh_ms" 3600
mk_transcript "unrelated-session-id" 0
run session-start TEAMMATE_SESS SessionStart
exists lead_other_tx && bad "another session's transcript kept the team" || ok "unrelated transcript does not protect a team"

# 8. TEAM_REAP_LEAD_TRANSCRIPT_MINUTES=0 disables the transcript signal only.
#    Fixture is a FUTURE-dated transcript (clock skew, or a touched file). That
#    is the case that actually discriminates: for any PAST mtime a 0-minute
#    window already rejects the file by arithmetic, so only a future mtime can
#    tell an explicit disable apart from a zero-length window.
clear_all
mk_team lead_tx_off "$LEAD_A" "$fresh_ms" 3600
mk_transcript "$LEAD_A" -60
run_env "TEAM_REAP_LEAD_TRANSCRIPT_MINUTES=0" session-start TEAMMATE_SESS SessionStart
exists lead_tx_off && bad "transcript signal ignored the =0 disable switch" || ok "TEAM_REAP_LEAD_TRANSCRIPT_MINUTES=0 disables the transcript signal"

# 9. A corrupt leadSessionId must not aim the transcript probe outside the
#    projects tree. Fixture: the traversed path holds a FRESH file, so dropping
#    the SAFE-match guard would resolve it and wrongly keep the team.
clear_all
mkdir -p "$PROJ"; : > "$HOME/.claude/projects/evil.jsonl"
mkdir -p "$TEAMS/traversal_lead/inboxes" "$TASKS/traversal_lead"
printf '{"name":"traversal_lead","leadSessionId":"../evil","createdAt":%s,"members":[]}' "$fresh_ms" > "$TEAMS/traversal_lead/config.json"
: > "$TEAMS/traversal_lead/inboxes/m.json"
python3 - "$TEAMS/traversal_lead/inboxes/m.json" <<'PY'
import os,sys,time
t=time.time()-3600; os.utime(sys.argv[1],(t,t))
PY
run session-start TEAMMATE_SESS SessionStart
exists traversal_lead && bad "path-traversal leadSessionId resolved outside projects/" || ok "unsafe leadSessionId cannot aim the transcript probe"
rm -f "$HOME/.claude/projects/evil.jsonl"

echo "--- lead-guard false-alive hardening (nothing may pin a dir forever) ---"
# Every row here is a way the "bounded window" claim could have been false, so
# every one is a directory that would otherwise never be reclaimed.

# 10. A far-future mtime must NOT read as fresh. Left unbounded on the high
#     side, a file dated ahead stays "fresh" until that date arrives.
clear_all
mk_team lead_future "$LEAD_A" "$fresh_ms" 3600
mk_transcript "$LEAD_A" -864000        # dated 10 days ahead
run session-start TEAMMATE_SESS SessionStart
exists lead_future && bad "far-future transcript mtime kept the team (unbounded false-alive)" || ok "far-future transcript mtime is not fresh"

# 11. A non-finite window must be rejected: inf makes the cutoff -inf, so every
#     transcript that has ever existed reads as fresh, forever.
clear_all
mk_team lead_inf "$LEAD_A" "$fresh_ms" 3600
mk_transcript "$LEAD_A" 21600          # 6h stale, past the 240m fallback too
run_env "TEAM_REAP_LEAD_TRANSCRIPT_MINUTES=inf" session-start TEAMMATE_SESS SessionStart
exists lead_inf && bad "TEAM_REAP_LEAD_TRANSCRIPT_MINUTES=inf pinned the team forever" || ok "non-finite transcript window is rejected"

# 12. A typo'd tunable must not crash the hook (the float() calls run before the
#     JSON guard, so a crash here takes out reaping entirely and silently) AND
#     must fall back to the documented default, not to zero. The fixture is 60m
#     idle: under the 240m default it is KEPT, so "kept" proves the fallback
#     value, where a mere no-crash assertion would not.
clear_all
mk_team lead_badenv "$LEAD_A" "$fresh_ms" 3600
badout=$(printf '{"session_id":"TEAMMATE_SESS","hook_event_name":"SessionStart"}' \
  | TEAM_REAP_IDLE_MINUTES=abc TEAM_REAP_LEAD_TRANSCRIPT_MINUTES=abc TEAM_REAP_MAX_AGE_HOURS=abc \
    TEAM_REAP_PS_OVERRIDE="$EMPTY_PS" bash "$HOOK" session-start 2>/dev/null)
badrc=$?
[ "$badrc" -eq 0 ] && [ "$badout" = "{}" ] && ok "non-numeric tunables fall back instead of crashing" || bad "non-numeric tunables crashed the hook (rc=$badrc out='$badout')"
exists lead_badenv && ok "non-numeric tunable falls back to the DEFAULT (240m), not 0" || bad "non-numeric tunable did not fall back to the documented default"

# 12b. An empty tunable is the same story: default, no crash, no reap at 60m.
clear_all
mk_team lead_emptyenv "$LEAD_A" "$fresh_ms" 3600
run_env "TEAM_REAP_IDLE_MINUTES=" session-start TEAMMATE_SESS SessionStart
exists lead_emptyenv && ok "empty tunable falls back to the default" || bad "empty tunable did not fall back to the default"

# 12c. A NEGATIVE idle window would make every team instantly reapable. The
#      fixture is only 1m idle, so it survives only if the negative is rejected.
clear_all
mk_team lead_negenv "$LEAD_A" "$fresh_ms" 60
run_env "TEAM_REAP_IDLE_MINUTES=-1" session-start TEAMMATE_SESS SessionStart
exists lead_negenv && ok "negative idle window is rejected, not obeyed" || bad "negative idle window reaped a 1m-idle team"

# 12d. NaN silently poisons every comparison it touches (all of them return
#      False), so an idle team would never be reaped again. 300m idle must reap
#      under the 240m fallback.
clear_all
mk_team lead_nanenv "$LEAD_A" "$fresh_ms" 18000
run_env "TEAM_REAP_IDLE_MINUTES=nan" session-start TEAMMATE_SESS SessionStart
exists lead_nanenv && bad "NaN idle window disabled reaping entirely" || ok "NaN tunable falls back to a usable default"

# 12e. A merely LARGE finite window still overflows to inf once converted to
#      seconds (1e308 * 60 == inf), which would make every transcript that has
#      ever existed read as fresh, forever. The transcript here is 6h stale, so
#      it must not save the team under the 240m fallback.
clear_all
mk_team lead_hugeenv "$LEAD_A" "$fresh_ms" 3600
mk_transcript "$LEAD_A" 21600
run_env "TEAM_REAP_LEAD_TRANSCRIPT_MINUTES=1e308" session-start TEAMMATE_SESS SessionStart
exists lead_hugeenv && bad "huge finite window overflowed to inf (permanent false-alive)" || ok "huge finite window is rejected before it can overflow"

# 13. A transcript that is not a REGULAR FILE must not be trusted. The symlink
#     here points INSIDE the tree on purpose: an outside-pointing one is caught
#     by the realpath guard too, so it could not tell the two guards apart. A
#     freshly-made symlink carries a fresh mtime of its own, so dropping the
#     regular-file test alone is enough to fake a live lead.
clear_all
mk_team lead_symfile "$LEAD_A" "$fresh_ms" 3600
mkdir -p "$PROJ"; : > "$PROJ/real_target.jsonl"
ln -s "$PROJ/real_target.jsonl" "$PROJ/$LEAD_A.jsonl"
run session-start TEAMMATE_SESS SessionStart
exists lead_symfile && bad "symlinked transcript was trusted as a real transcript" || ok "a non-regular-file transcript is not trusted"
rm -f "$PROJ/$LEAD_A.jsonl"

# 13b. And the outside-pointing case, which both guards reject (defence in
#      depth, so this row discriminates neither guard on its own).
clear_all
mk_team lead_symout "$LEAD_A" "$fresh_ms" 3600
mkdir -p "$PROJ"; : > "$SANDBOX/outside_fresh.jsonl"
ln -s "$SANDBOX/outside_fresh.jsonl" "$PROJ/$LEAD_A.jsonl"
run session-start TEAMMATE_SESS SessionStart
exists lead_symout && bad "symlinked transcript was followed outside projects/" || ok "symlinked transcript cannot escape projects/"
rm -f "$PROJ/$LEAD_A.jsonl"

# 14. ...nor a symlinked PROJECT DIR, which realpath resolves just as happily.
clear_all
mkdir -p "$SANDBOX/outside_proj"; : > "$SANDBOX/outside_proj/$LEAD_A.jsonl"
ln -s "$SANDBOX/outside_proj" "$HOME/.claude/projects/linked"
mk_team lead_symdir "$LEAD_A" "$fresh_ms" 3600
run session-start TEAMMATE_SESS SessionStart
exists lead_symdir && bad "symlinked project dir was followed outside projects/" || ok "symlinked project dir is not trusted"
rm -f "$HOME/.claude/projects/linked"

# 15. A corrupt-typed config must not crash the hook. A non-string
#     leadSessionId reached string concatenation; a non-numeric createdAt
#     reaches the age arithmetic. Both used to raise and kill the whole run.
clear_all
mkdir -p "$TEAMS/lead_badtypes/inboxes" "$TASKS/lead_badtypes"
printf '{"name":"lead_badtypes","leadSessionId":123,"createdAt":"soon","members":[]}' > "$TEAMS/lead_badtypes/config.json"
: > "$TEAMS/lead_badtypes/inboxes/m.json"
python3 - "$TEAMS/lead_badtypes/inboxes/m.json" <<'PY'
import os,sys,time
t=time.time()-3600; os.utime(sys.argv[1],(t,t))
PY
run session-start TEAMMATE_SESS SessionStart
exists lead_badtypes && bad "badly-typed config kept the team (or crashed the hook)" || ok "badly-typed config neither crashes nor pins the team"

# 16. A corrupt SHORT lead id must not match an unrelated process token.
clear_all
mkdir -p "$TEAMS/lead_shortid/inboxes" "$TASKS/lead_shortid"
printf '{"name":"lead_shortid","leadSessionId":"a","createdAt":%s,"members":[]}' "$fresh_ms" > "$TEAMS/lead_shortid/config.json"
: > "$TEAMS/lead_shortid/inboxes/m.json"
python3 - "$TEAMS/lead_shortid/inboxes/m.json" <<'PY'
import os,sys,time
t=time.time()-3600; os.utime(sys.argv[1],(t,t))
PY
printf '%s\n' "claude --session-id abc123def456 --model opus" > "$LEAD_PS"
PS_OVERRIDE="$LEAD_PS" run session-start TEAMMATE_SESS SessionStart
exists lead_shortid && bad "short lead id substring-matched an unrelated session" || ok "lead argv match is token-bounded, not substring"

echo "--- session-end exemption (the lead's own SessionEnd still reaps) ---"
# Load-bearing: at the lead's own SessionEnd both liveness signals report alive
# by construction (the hook runs inside that very process). Honouring them there
# would disable the primary cleanup path and leak every team dir forever.
clear_all
mk_team ending_own "$LEAD_A" "$fresh_ms" 60
mk_transcript "$LEAD_A" 0
printf '%s\n' "claude --session-id $LEAD_A --model opus" > "$LEAD_PS"
PS_OVERRIDE="$LEAD_PS" run session-end "$LEAD_A" SessionEnd
exists ending_own && bad "owned-by-ending-session reap blocked by its own liveness (leak)" || ok "lead's own SessionEnd still reaps its team"
[ -d "$TASKS/ending_own" ] && bad "ending session's task dir should be gone" || ok "ending session's task dir also reaped"

# But a DIFFERENT session ending must not age-GC a team whose lead is alive.
clear_all
mk_team other_ancient "$LEAD_A" "$old_ms" 60
printf '%s\n' "claude --session-id $LEAD_A --model opus" > "$LEAD_PS"
PS_OVERRIDE="$LEAD_PS" run session-end SOME_OTHER_SESS SessionEnd
exists other_ancient && ok "session-end age-GC spares another live lead's team" || bad "age-GC reaped a live lead's team at another session's end"
clear_all

echo "--- memory safety ---"
echo "BEAT CONTENT" > "$MEM/session_x.md"
# The reaper must actually REAP during this run, or the memory assertions are
# just checking that a no-op left the tree alone. Give it a real team to delete
# (owned by the ending session) plus a beats dir alongside, and confirm the
# deletion happened while memory survived it.
mk_team mem_victim SESS_A "$fresh_ms"
run session-end SESS_A SessionEnd
exists mem_victim && bad "memory-safety run did not actually reap (assertions would be vacuous)" || ok "memory-safety run performed a real reap"
[ -f "$MEM/session_x.md" ] && ok "memory beat untouched after reap run" || bad "MEMORY WAS TOUCHED"
[ -d "$MEM" ] && ok "memory dir intact" || bad "MEMORY DIR DELETED"

echo "--- disable switch ---"
mk_team owned2 SESS_A "$fresh_ms"
# Assert exit status and payload too: without them a CRASH would reap nothing
# and satisfy "skips reaping" vacuously, which is the same trap run() closes.
disout=$(TEAM_REAP_DISABLE=1 bash "$HOOK" session-end < <(printf '{"session_id":"SESS_A","hook_event_name":"SessionEnd"}') 2>/dev/null)
disrc=$?
exists owned2 && ok "TEAM_REAP_DISABLE=1 skips reaping" || bad "disable switch ignored"
[ "$disrc" -eq 0 ] && [ "$disout" = "{}" ] && ok "disable switch exits 0 and emits {}" || bad "disable switch rc=$disrc out='$disout'"

echo ""
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
