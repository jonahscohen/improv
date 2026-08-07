#!/bin/bash
# Regression tests for cmux-team-config-heal.sh.
#
# The hook exists because a compaction-continued cmux session inherits a team
# name whose dir the harness never re-initialized, so named spawns dead-lock on
# `team file for "session-<SHORTID>" not found`. The hook heals that missing dir
# from two signals: the CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME env var at
# SessionStart (opportunistic) and the not-found error at PostToolUse
# (guaranteed). See reference_cmux_team_init_orphan_bug.md.
#
# Hermetic: HOME is sandboxed so the real ~/.claude/teams is NEVER touched. Every
# run asserts the hook exited 0 and emitted parseable JSON, so a crash can never
# satisfy a "must be a no-op" assertion vacuously.
#
# Run:  bash claude/hooks/test-cmux-team-config-heal.sh   (exit 0 = all pass)
set -u

HOOK="$(cd "$(dirname "$0")" && pwd)/cmux-team-config-heal.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf "  ok    %s\n" "$1"; }
bad() { FAIL=$((FAIL+1)); printf "  FAIL  %s\n" "$1"; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
export HOME="$SANDBOX"
TEAMS="$HOME/.claude/teams"
SOCK="/tmp/cmux-team-heal-test.sock"   # value is never dereferenced; only presence matters

reset() { rm -rf "$TEAMS"; mkdir -p "$TEAMS"; }

# hookrun <mode> <payload> [env-prefix]
# Runs the hook with CMUX_SOCKET_PATH set (a real cmux session) unless the
# env-prefix unsets it. Asserts exit 0 and JSON stdout; prints stdout.
hookrun() {
  local mode="$1" payload="$2" envp="${3:-}" out rc
  # $envp is a deliberately word-split env prefix (e.g. VAR=value); unquoted on purpose.
  # shellcheck disable=SC2086
  out=$(printf '%s' "$payload" \
    | env CMUX_SOCKET_PATH="$SOCK" $envp bash "$HOOK" "$mode" 2>"$SANDBOX/stderr")
  rc=$?
  [ "$rc" -eq 0 ] || bad "hook exited $rc (crash) [mode=$mode]"
  printf '%s' "$out" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null \
    || bad "hook stdout is not valid JSON [mode=$mode]: $out"
  printf '%s' "$out"
}

# cfg_ok <name> : config.json parses, names the team, has a team-lead member with
# backendType in-process, and both inboxes are the empty JSON array "[]".
cfg_ok() {
  local name="$1"
  HOME="$HOME" python3 - "$TEAMS" "$name" <<'PY'
import json, os, sys
teams, name = sys.argv[1], sys.argv[2]
d = os.path.join(teams, name)
cfg = os.path.join(d, "config.json")
try:
    c = json.load(open(cfg))
except Exception as e:
    print("config unreadable: %s" % e); sys.exit(1)
if c.get("name") != name:
    print("name mismatch: %r" % c.get("name")); sys.exit(1)
m = c.get("members")
if not isinstance(m, list) or not m:
    print("no members"); sys.exit(1)
lead = m[0]
if lead.get("name") != "team-lead" or lead.get("agentType") != "team-lead":
    print("member 0 is not team-lead"); sys.exit(1)
if lead.get("backendType") != "in-process":
    print("member backendType not in-process"); sys.exit(1)
if lead.get("agentId") != "team-lead@" + name:
    print("agentId mismatch"); sys.exit(1)
for inbox in ("team-lead.json", "descriptions.json"):
    p = os.path.join(d, "inboxes", inbox)
    if not os.path.isfile(p) or open(p).read().strip() != "[]":
        print("inbox %s not empty-array" % inbox); sys.exit(1)
sys.exit(0)
PY
}

exists() { [ -d "$TEAMS/$1" ]; }

now_ms() { python3 -c 'import time;print(int(time.time()*1000))'; }

# A healthy config a real spawn would accept, for the idempotency test.
write_healthy() {  # name leadSessionId
  local name="$1" lead="$2" ms; ms="$(now_ms)"
  mkdir -p "$TEAMS/$name/inboxes"
  cat > "$TEAMS/$name/config.json" <<EOF
{"name":"$name","createdAt":$ms,"leadAgentId":"team-lead@$name","leadSessionId":"$lead","members":[{"agentId":"team-lead@$name","name":"team-lead","agentType":"team-lead","joinedAt":$ms,"tmuxPaneId":"leader","cwd":"/tmp/repo","subscriptions":[],"backendType":"in-process"}]}
EOF
  printf '[]' > "$TEAMS/$name/inboxes/team-lead.json"
}

err_payload() {  # name  -> a PostToolUse Agent error payload naming that team
  printf '{"session_id":"a3a6e79a-998b-4506-b989-da15e05d64e4","cwd":"/tmp/repo","tool_name":"Agent","tool_response":"Error: Internal error: team file for \\"%s\\" not found. The session team should have been initialized at startup.","hook_event_name":"PostToolUse"}' "$1"
}

echo "--- ARM 2: PostToolUse error heals the missing dir ---"
reset
out="$(hookrun post-tool-use "$(err_payload session-820f1580)")"
if exists session-820f1580 && cfg_ok session-820f1580; then
  ok "missing dir healed to a valid, spawn-acceptable config"
else
  bad "missing dir NOT healed: $(cfg_ok session-820f1580)"
fi
case "$out" in *RE-ISSUE*) ok "post-tool-use heal nudges a re-issue" ;; *) bad "no re-issue nudge in: $out" ;; esac

echo "--- idempotent: an existing healthy dir is left untouched ---"
reset
write_healthy session-cafe1234 cafe1234-0000-4000-8000-000000000000
before="$(cat "$TEAMS/session-cafe1234/config.json")"
before_mt="$(python3 -c 'import os,sys;print(os.path.getmtime(sys.argv[1]))' "$TEAMS/session-cafe1234/config.json")"
out="$(hookrun post-tool-use "$(err_payload session-cafe1234)")"
after="$(cat "$TEAMS/session-cafe1234/config.json")"
after_mt="$(python3 -c 'import os,sys;print(os.path.getmtime(sys.argv[1]))' "$TEAMS/session-cafe1234/config.json")"
if [ "$before" = "$after" ] && [ "$before_mt" = "$after_mt" ]; then
  ok "healthy config content + mtime unchanged"
else
  bad "healthy config was modified"
fi
case "$out" in "{}") ok "no heal notice emitted for a healthy dir" ;; *) bad "unexpected notice for healthy dir: $out" ;; esac

echo "--- config-less orphan gets a config, existing inbox preserved ---"
reset
mkdir -p "$TEAMS/session-beef5678/inboxes"
printf '[{"from":"x","body":"queued"}]' > "$TEAMS/session-beef5678/inboxes/team-lead.json"  # real queued msg
out="$(hookrun post-tool-use "$(err_payload session-beef5678)")"
if [ -f "$TEAMS/session-beef5678/config.json" ]; then
  ok "config-less orphan got a config.json written"
else
  bad "config-less orphan did NOT get a config"
fi
if [ "$(cat "$TEAMS/session-beef5678/inboxes/team-lead.json")" = '[{"from":"x","body":"queued"}]' ]; then
  ok "existing inbox with queued messages was NOT overwritten"
else
  bad "existing inbox was clobbered"
fi

echo "--- ARM 1: SessionStart inherited env var heals ---"
reset
out="$(hookrun session-start '{"session_id":"a3a6e79a-998b-4506-b989-da15e05d64e4","cwd":"/tmp/repo","hook_event_name":"SessionStart"}' "CLAUDE_INTERNAL_ASSISTANT_TEAM_NAME=session-1f1549bf")"
if exists session-1f1549bf && cfg_ok session-1f1549bf; then
  ok "inherited env var pre-created the team dir"
else
  bad "inherited env var did NOT heal: $(cfg_ok session-1f1549bf)"
fi

echo "--- SessionStart with NO env var (fresh session) is a no-op ---"
reset
out="$(hookrun session-start '{"session_id":"11111111-2222-3333-4444-555555555555","cwd":"/tmp/repo","hook_event_name":"SessionStart"}')"
if [ -z "$(ls -A "$TEAMS")" ]; then ok "fresh session created nothing"; else bad "fresh session created a dir"; fi
case "$out" in "{}") ok "fresh session emits {}" ;; *) bad "fresh session emitted: $out" ;; esac

echo "--- no-op outside a cmux session (CMUX_SOCKET_PATH unset) ---"
reset
out="$(printf '%s' "$(err_payload session-820f1580)" | env -u CMUX_SOCKET_PATH bash "$HOOK" post-tool-use 2>/dev/null)"
if [ -z "$(ls -A "$TEAMS")" ]; then ok "no cmux session: created nothing"; else bad "acted outside a cmux session"; fi
case "$out" in "{}") ok "no cmux session: emits {}" ;; *) bad "no cmux session emitted: $out" ;; esac

echo "--- PostToolUse on a NON-Agent tool is a no-op ---"
reset
out="$(hookrun post-tool-use '{"session_id":"s","cwd":"/tmp/repo","tool_name":"Bash","tool_response":"team file for \"session-820f1580\" not found","hook_event_name":"PostToolUse"}')"
if [ -z "$(ls -A "$TEAMS")" ]; then ok "non-Agent tool: created nothing"; else bad "healed on a non-Agent tool"; fi

echo "--- PostToolUse Agent success (no error) is a no-op ---"
reset
out="$(hookrun post-tool-use '{"session_id":"s","cwd":"/tmp/repo","tool_name":"Agent","tool_response":"Spawned successfully","hook_event_name":"PostToolUse"}')"
if [ -z "$(ls -A "$TEAMS")" ]; then ok "successful spawn: created nothing"; else bad "healed on a successful spawn"; fi

echo "--- unsafe / traversal names are rejected ---"
reset
# The error carries a name with path characters; the strict charset + child-of-teams
# realpath guard must refuse to create anything outside the teams dir.
out="$(hookrun post-tool-use '{"session_id":"s","cwd":"/tmp/repo","tool_name":"Agent","tool_response":"team file for \"session-../../evil\" not found","hook_event_name":"PostToolUse"}')"
if [ -z "$(ls -A "$TEAMS")" ] && [ ! -e "$SANDBOX/.claude/evil" ] && [ ! -e "$SANDBOX/evil" ]; then
  ok "traversal name created nothing"
else
  bad "traversal name was acted on"
fi
reset
out="$(hookrun post-tool-use '{"session_id":"s","cwd":"/tmp/repo","tool_name":"Agent","tool_response":"team file for \"session-..\" not found","hook_event_name":"PostToolUse"}')"
if [ -z "$(ls -A "$TEAMS")" ]; then ok "dot-dot name created nothing"; else bad "session-.. was acted on"; fi

echo "--- leadSessionId placeholder when session_id is absent ---"
reset
out="$(hookrun post-tool-use '{"cwd":"/tmp/repo","tool_name":"Agent","tool_response":"team file for \"session-820f1580\" not found","hook_event_name":"PostToolUse"}')"
lead="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["leadSessionId"])' "$TEAMS/session-820f1580/config.json" 2>/dev/null)"
case "$lead" in 820f1580-*) ok "placeholder leadSessionId derived from the short id ($lead)" ;; *) bad "unexpected leadSessionId: $lead" ;; esac

echo "--- crash tripwire: mangled JSON payload stays non-blocking ---"
reset
out="$(printf 'not json at all' | env CMUX_SOCKET_PATH="$SOCK" bash "$HOOK" post-tool-use 2>/dev/null)"
rc=$?
if [ "$rc" -eq 0 ]; then ok "mangled payload: exit 0"; else bad "mangled payload: exit $rc"; fi
if printf '%s' "$out" | python3 -c 'import json,sys;json.load(sys.stdin)' 2>/dev/null; then
  ok "mangled payload: JSON stdout"; else bad "mangled payload: non-JSON stdout ($out)"; fi
if [ -z "$(ls -A "$TEAMS")" ]; then ok "mangled payload: created nothing"; else bad "mangled payload: created a dir"; fi

echo "--- Agent error WITHOUT 'not found' does not mint a team ---"
reset
out="$(hookrun post-tool-use '{"session_id":"s","cwd":"/tmp/repo","tool_name":"Agent","tool_response":"note: session-deadbeef had an unrelated problem","hook_event_name":"PostToolUse"}')"
if [ -z "$(ls -A "$TEAMS")" ]; then ok "session name without the real error shape: created nothing"; else bad "minted a team from arbitrary text"; fi

echo "--- non-hex team name in the error is rejected ---"
reset
out="$(hookrun post-tool-use '{"session_id":"s","cwd":"/tmp/repo","tool_name":"Agent","tool_response":"team file for \"session-nothexxx\" not found","hook_event_name":"PostToolUse"}')"
if [ -z "$(ls -A "$TEAMS")" ]; then ok "non-hex name created nothing"; else bad "non-hex name was acted on"; fi

echo "--- a symlinked team dir is never written through ---"
reset
OUTSIDE="$SANDBOX/outside_team"; mkdir -p "$OUTSIDE"
ln -s "$OUTSIDE" "$TEAMS/session-5ymli0nk"   # a symlink sitting inside teams/
out="$(hookrun post-tool-use "$(err_payload session-5ymli0nk)")"
if [ ! -e "$OUTSIDE/config.json" ]; then
  ok "symlinked team dir: nothing written through the link"
else
  bad "wrote a config through a symlinked team dir"
fi

echo "--- real ~/.claude/teams was never touched ---"
# HOME is the sandbox for the whole run; this is a belt-and-suspenders check that
# the sandbox path is where writes landed, not the developer's home.
case "$TEAMS" in "$SANDBOX"/*) ok "all writes were confined to the sandbox" ;; *) bad "TEAMS escaped the sandbox: $TEAMS" ;; esac

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
