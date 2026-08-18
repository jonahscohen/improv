#!/usr/bin/env bash
# justify-watcher-shutdown - the ONE sanctioned way to stop a Justify-WATCHING AGENT.
#
# A Justify-watching agent (a teammate whose ROLE is watching the Justify daemon/queue,
# named `justify-*` by convention: justify-warden, justify-owner, justify-watch) must NOT
# be shut down by a managing / lead / peer agent. Only the human USER may stop it. Agents
# are categorically blocked from the two shutdown paths (SendMessage shutdown_request and
# Bash kill/pkill/tmux/cmux) by justify-watcher-guard.sh + bash-guard.sh. This CLI is the
# user's path, and it is a HUMAN gate:
#
#   1. stdin must be a TTY. An agent's shell (Claude's Bash tool, a headless worker, CI) is
#      not a TTY, so an agent cannot get past this - the same gate justify-watch-disarm uses.
#   2. the human types the confirmation phrase.
#   3. only then do we act: kill the watcher directly (default), or mint a single-use,
#      short-lived consent token (--authorize) that lets the user tell an agent to do it.
#
# The token is minted ONLY here. An agent cannot forge it: it needs a TTY (this refuses
# without one) and every agent write path to the token file is blocked by a hook. There is
# no --force and there will not be one.
#
# USAGE
#   justify-watcher-shutdown <name>              confirm, then kill the watcher directly
#   justify-watcher-shutdown --authorize <name>  confirm, then mint a 120s single-use consent
#                                                token so an agent-mediated shutdown of <name>
#                                                passes the guard ONCE (for "yes, agent, do it")
#   justify-watcher-shutdown --list              list the justify-* watcher agents seen running
#   <name> may be a specific watcher (justify-owner) or a glob (justify-*, *) with --authorize.
# Env: JUSTIFY_WATCHER_CONSENT_TTL (default 120), JUSTIFY_WATCHER_BY (default git user / $USER)
set -uo pipefail

TOKEN_PATH="$HOME/.claude/.justify-watcher-shutdown-consent"
CONSENT_HELPER="$HOME/.claude/hooks/justify-watcher-consent.py"
TTL="${JUSTIFY_WATCHER_CONSENT_TTL:-120}"
BY="${JUSTIFY_WATCHER_BY:-$(git config user.name 2>/dev/null || printf '%s' "${USER:-unknown}")}"
PHRASE="SHUTDOWN"

# Print every live justify-* watcher agent: pid + its --agent-name. Best-effort; ps format
# differs slightly across platforms but `pid,command` is portable.
list_watchers() {
  ps -Ao pid,command 2>/dev/null \
    | grep -E -- '--agent-(id|name) +justify' \
    | grep -v -E 'grep|justify-watcher-shutdown' || true
}

if [ "${1:-}" = "--list" ]; then
  echo "Justify watcher agents currently running (pid  command excerpt):"
  hits="$(list_watchers)"
  if [ -z "$hits" ]; then
    echo "  (none found)"
  else
    printf '%s\n' "$hits" | sed 's/^/  /'
  fi
  exit 0
fi

AUTHORIZE_ONLY=0
if [ "${1:-}" = "--authorize" ] || [ "${1:-}" = "--authorise" ]; then
  AUTHORIZE_ONLY=1
  shift
fi

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  cat >&2 <<EOF
usage: justify-watcher-shutdown <name>
       justify-watcher-shutdown --authorize <name|glob>
       justify-watcher-shutdown --list
A <name> is a justify watcher agent (e.g. justify-warden). With --authorize a glob is allowed.
EOF
  exit 2
fi

# ---- the human gate: no TTY => not a human. This is the line an agent hits. ----
if [ ! -t 0 ]; then
  cat >&2 <<EOF
REFUSED: justify-watcher-shutdown needs a human.

stdin is not a terminal, so this is an agent, a script, or a headless worker.
A Justify-watching agent may only be shut down by the USER's direct command - never by a
managing, lead, or peer agent. This has killed the watch by mistake before.

If you are an agent: do NOT try to stop the justify-* watcher. Leave it running and tell the
user that only they can stop it, by running 'justify-watcher-shutdown ${TARGET}' themselves.
The daemon and the hooks refuse any agent-issued shutdown anyway.
EOF
  exit 3
fi

if [ "$AUTHORIZE_ONLY" -eq 1 ]; then
  echo "This will MINT a single-use consent token authorising an agent to shut down: ${TARGET}"
  echo "The token is valid for ${TTL}s and is spent on the first matching shutdown."
else
  echo "This will SHUT DOWN the Justify watcher agent: ${TARGET}"
  echo "Matching processes:"
  hits="$(ps -Ao pid,command 2>/dev/null | grep -E -- "--agent-(id|name) +${TARGET}" | grep -v -E 'grep|justify-watcher-shutdown' || true)"
  if [ -z "$hits" ]; then
    echo "  (no running process matched '--agent-id/--agent-name ${TARGET}')"
  else
    printf '%s\n' "$hits" | sed 's/^/  /'
  fi
fi
echo
printf "Type %s to confirm (anything else cancels): " "$PHRASE"
read -r answer
if [ "$answer" != "$PHRASE" ]; then
  echo "Cancelled. The watcher is untouched."
  exit 4
fi

# ---- mint the single-use, short-TTL consent token ----
umask 077
if ! BY="$BY" TARGET="$TARGET" TTL="$TTL" TOKEN_PATH="$TOKEN_PATH" python3 - <<'PY'
import json, os, time, secrets
p   = os.environ["TOKEN_PATH"]
ttl = float(os.environ.get("TTL", "120") or "120")
tok = {
    "target":  os.environ["TARGET"],
    "expires": time.time() + ttl,
    "nonce":   secrets.token_hex(16),
    "by":      os.environ.get("BY", "unknown"),
    "created": time.time(),
}
tmp = p + ".tmp"
with open(tmp, "w") as f:
    json.dump(tok, f)
os.chmod(tmp, 0o600)
os.replace(tmp, p)
print("minted consent token for", tok["target"], "valid", int(ttl), "s")
PY
then
  echo "ERROR: could not mint the consent token." >&2
  exit 1
fi

if [ "$AUTHORIZE_ONLY" -eq 1 ]; then
  echo
  echo "Consent granted. An agent-issued shutdown of '${TARGET}' (SendMessage shutdown_request,"
  echo "or a Bash kill of its resolved pid) will now pass the guard ONCE, within ${TTL}s."
  echo "Tell the agent to proceed, or run this without --authorize to stop it yourself."
  exit 0
fi

# ---- default: stop it ourselves, here, in the user's own (unhooked) terminal ----
pids="$(ps -Ao pid,command 2>/dev/null | grep -E -- "--agent-(id|name) +${TARGET}" | grep -v -E 'grep|justify-watcher-shutdown' | awk '{print $1}')"
if [ -z "$pids" ]; then
  echo "No running watcher process matched '${TARGET}'. The consent token is minted, so if the"
  echo "watcher lives in another session you can now tell that session's agent to stand it down,"
  echo "or re-run --list to find the exact name."
  exit 0
fi
echo "Stopping ${TARGET} (pids: $(echo $pids | tr '\n' ' '))..."
for pid in $pids; do
  kill "$pid" 2>/dev/null && echo "  sent TERM to $pid" || echo "  could not TERM $pid"
done
sleep 1
still="$(ps -Ao pid,command 2>/dev/null | grep -E -- "--agent-(id|name) +${TARGET}" | grep -v -E 'grep|justify-watcher-shutdown' | awk '{print $1}')"
if [ -n "$still" ]; then
  echo "Still running after TERM: $still - sending KILL"
  for pid in $still; do kill -9 "$pid" 2>/dev/null && echo "  sent KILL to $pid"; done
fi
# The token was single-use and is spent by any guard it passed; remove it now that we acted
# directly so it does not linger authorising a second agent-mediated shutdown.
rm -f "$TOKEN_PATH" 2>/dev/null || true
echo "Done. '${TARGET}' has been stopped by you (the user). cmux will close its pane on exit."
exit 0
