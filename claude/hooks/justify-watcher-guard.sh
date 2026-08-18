#!/usr/bin/env bash
# justify-watcher-guard.sh - a Justify-WATCHING AGENT may only be shut down by the human
# USER's direct command. Never by a managing / lead / peer agent.
#
# WHY (Jonah, 2026-08-17 - recurring failure, mechanical prevention mandated)
# A Justify-watching agent is any teammate whose ROLE is watching the Justify daemon/queue.
# By convention they are named `justify-*` (justify-warden, justify-owner, justify-watch).
# They must survive across sessions and must NOT be autonomously stood down by another
# agent:
#   - 2026-07-12: a managing agent killed the justify-watch daemon because it rendered as
#     an unnamed general-purpose pane and it assumed "the other pane must be my leftover".
#   - Most recently a lead agent stood down a `justify-owner` watcher it had spawned.
# There is already a human-gated DISARM for the daemon WATCH (TTY + single-use consent
# token, ~4 layers). Jonah now wants the same unbreakable human-gate on SHUTTING DOWN THE
# WATCHER AGENT (the process/pane), not just disarming the daemon.
#
# THIS HOOK covers the two agent-driven shutdown paths that flow through tools:
#   1. SendMessage  - DENY a {"type":"shutdown_request"} (or any terminate payload) whose
#      `to` is a justify-* watcher. This is the MAIN path a managing agent uses.
#   2. Write|Edit|MultiEdit|NotebookEdit - DENY forging the USER consent token file, so an
#      agent cannot self-authorise. (The Bash forge/kill paths live in bash-guard.sh, which
#      already special-cases justify - kept in parity there.)
#
# THE ONLY authorisation is the human USER's DIRECT command, expressed as a single-use,
# TTY-minted consent token (see justify-watcher-consent.py and the `justify-watcher-shutdown`
# CLI). An agent cannot forge it: every agent write path to it is blocked by a hook, and the
# CLI refuses unless stdin is a TTY. The hook ignores any token an agent could have created
# because an agent cannot create one. There is no env-var bypass and no --force.
#
# Registered PreToolUse for matchers "SendMessage" and "Write|Edit|MultiEdit|NotebookEdit".
# Reads hook JSON on stdin, emits a PreToolUse permissionDecision JSON on stdout. Fails OPEN
# (prints {} ) on any malformed input or missing python3 - a broken guard must never wedge a
# legitimate tool call; the categorical kill-block still lives in bash-guard.sh as a backstop.
set -uo pipefail

# Resolve this script's real directory (follow the ~/.claude/hooks symlink into the repo) so
# the sibling consent helper is found whether run deployed or from the checkout.
_self="${BASH_SOURCE[0]}"
_hops=0
while [ -L "$_self" ] && [ "$_hops" -lt 40 ]; do
  _link="$(readlink "$_self")"
  case "$_link" in
    /*) _self="$_link" ;;
    *)  _self="$(dirname "$_self")/$_link" ;;
  esac
  _hops=$((_hops + 1))
done
_HOOK_DIR="$(cd -P "$(dirname "$_self")" 2>/dev/null && pwd -P)"

command -v python3 >/dev/null 2>&1 || { echo '{}'; exit 0; }

INPUT="$(cat 2>/dev/null)"

printf '%s' "$INPUT" | HOOK_DIR="$_HOOK_DIR" python3 -c '
import json, sys, os, re, subprocess, fnmatch

def allow():
    print("{}"); sys.exit(0)

def deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}))
    sys.exit(0)

try:
    data = json.load(sys.stdin)
except Exception:
    allow()

tool = data.get("tool_name", "") or ""
inp  = data.get("tool_input", {}) or {}
if not isinstance(inp, dict):
    allow()

home = os.path.expanduser("~")
TOKEN_PATH = os.path.join(home, ".claude", ".justify-watcher-shutdown-consent")
HOOK_DIR = os.environ.get("HOOK_DIR", "")
CONSENT = os.path.join(HOOK_DIR, "justify-watcher-consent.py")

# --- who is a justify WATCHER ------------------------------------------------------------
# Primary signal: the `justify-*` name convention (case-insensitive on the justify prefix).
# Additionally honour a durable registry the watcher may write: ~/.claude/.justify-watchers,
# one name or glob per line (# comments allowed). A target matching any line is a watcher too.
def _registry_patterns():
    pats = []
    try:
        with open(os.path.join(home, ".claude", ".justify-watchers")) as f:
            for ln in f:
                ln = ln.strip()
                if ln and not ln.startswith("#"):
                    pats.append(ln)
    except Exception:
        pass
    return pats

def is_watcher(name):
    if not name:
        return False
    n = str(name).strip()
    # A cmux agent address can carry an @session / [ref] suffix; judge on the leading name.
    base = re.split(r"[@\s]", n, 1)[0].strip().strip("\"\x27")
    low = base.lower()
    if low.startswith("justify-") or low == "justify" or low.startswith("justify_"):
        return True
    for p in _registry_patterns():
        try:
            if fnmatch.fnmatch(base, p) or base == p:
                return True
        except Exception:
            continue
    return False

def has_user_consent_and_consume(target):
    if not os.path.exists(CONSENT):
        return False
    try:
        r = subprocess.run([sys.executable, CONSENT, "consume", str(target)],
                           stdin=subprocess.DEVNULL, timeout=5)
        return r.returncode == 0
    except Exception:
        return False

# --- path 2: forging the consent token via a file-writing tool ---------------------------
if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
    fp = inp.get("file_path", "") or inp.get("notebook_path", "") or ""
    try:
        ap = os.path.abspath(os.path.expanduser(str(fp)))
    except Exception:
        ap = ""
    token_abs = os.path.abspath(TOKEN_PATH)

    def _aliases(p):
        """Every path that actually resolves to p, so a SYMLINK alias to the token (created to
        dodge a literal-path compare, Codex finding 2026-08-17) is still caught. realpath()
        follows links; resolving the PARENT + basename separately catches a symlinked DIRECTORY
        even when the leaf file does not exist yet (realpath of a missing leaf still resolves
        its dir)."""
        out = set()
        if not p:
            return out
        out.add(p)
        try:
            out.add(os.path.realpath(p))
        except Exception:
            pass
        try:
            out.add(os.path.join(os.path.realpath(os.path.dirname(p)), os.path.basename(p)))
        except Exception:
            pass
        return out

    if ap and (_aliases(ap) & _aliases(token_abs)):
        deny("BLOCKED: this is the Justify-watcher SHUTDOWN consent token. An agent may not "
             "create or edit it - that would be self-authorising the shutdown of a justify-* "
             "watcher, which only the USER may do. The token is minted solely by the "
             "`justify-watcher-shutdown` CLI, which requires a real terminal (TTY). If the user "
             "wants a watcher shut down, they run that command themselves.")
    allow()

# --- SendMessage paths ----------------------------------------------------------------------
# Match the SendMessage tool by name, tolerant of any MCP namespacing (mcp__x__SendMessage).
if "sendmessage" not in tool.lower():
    allow()

to = inp.get("to", "") or ""
msg = inp.get("message", None)

def _msg_field(m, field):
    """Return message[field] whether the message is a dict or a JSON string."""
    if isinstance(m, dict):
        return m.get(field)
    if isinstance(m, str) and m.strip().startswith("{"):
        try:
            d = json.loads(m)
            if isinstance(d, dict):
                return d.get(field)
        except Exception:
            return None
    return None

def self_watcher_name():
    """Return THIS session\x27s own justify-* watcher name, or None. Walks up the process tree
    from this hook to the nearest ACTUAL claude session process and reads its --agent-id.

    RECEIVER-SIDE identity: it closes the hole where a shutdown_request is addressed to the
    watcher by its opaque agentId (which the sender-side is_watcher(to) check cannot see) - the
    watcher still cannot APPROVE its own shutdown here, whatever address the request used.

    CRITICAL: we identify the session by the EXECUTABLE (argv[0] or argv[1] basename is
    claude.exe / claude), NOT by matching `--agent-id justify` anywhere in a command line. A
    shell command that merely MENTIONS that string as text (a script, a beat, this test suite)
    must not be mistaken for the session process - that was a real false-positive."""
    def _claude_agent(command):
        # Return (is_claude_proc, agent_name_or_None) for one ps command line.
        toks = command.split()
        if not toks:
            return (False, None)
        def _is_claude(t):
            b = os.path.basename(t)
            return b in ("claude.exe", "claude") or b.endswith("/claude.exe")
        # The claude binary is argv[0], or argv[1] when launched as `node .../claude.exe`.
        if not (_is_claude(toks[0]) or (len(toks) > 1 and _is_claude(toks[1]))):
            return (False, None)
        m = re.search(r"--agent-(?:id|name)\s+([^\s@\"\x27]+)", command)
        name = m.group(1) if m else None
        return (True, name)
    try:
        pid = os.getpid()
        for _ in range(20):
            out = subprocess.run(["ps", "-o", "ppid=,command=", "-p", str(pid)],
                                 capture_output=True, text=True, timeout=3).stdout.strip()
            if not out:
                break
            ppid, _, command = out.partition(" ")
            is_claude, name = _claude_agent(command)
            if is_claude:
                # This is the session process. Decide here and STOP - do not walk past it.
                if name and (name.lower().startswith("justify-") or name.lower().startswith("justify_")
                             or name.lower() == "justify"):
                    return name
                return None
            ppid = ppid.strip()
            if not ppid or ppid in ("0", "1", str(pid)):
                break
            pid = int(ppid)
    except Exception:
        return None
    return None

# RECEIVER-SIDE gate: a justify-* watcher session must not APPROVE its own shutdown. The
# shutdown_response with approve:true is what actually terminates the process (per the
# SendMessage protocol), so blocking it here stops the watcher dying no matter how the
# request reached it (by name OR by raw agentId). Only a USER consent token lifts it.
if str(_msg_field(msg, "type") or "").strip().lower() == "shutdown_response" \
   and _msg_field(msg, "approve") is True:
    me = self_watcher_name()
    if me and not has_user_consent_and_consume(me):
        deny("BLOCKED: you are a Justify-watching agent (\"" + me + "\") and may NOT approve your "
             "own shutdown. Only the human USER may stop a justify-* watcher - respond with "
             "approve:false and keep running. If the user truly wants you stopped they run "
             "`justify-watcher-shutdown " + me + "` in their own terminal, or authorise it once with "
             "`justify-watcher-shutdown --authorize " + me + "`. There is no env-var bypass.")
    allow()

# SENDER-SIDE gate: block a shutdown_request aimed at a justify-* watcher.
if not is_watcher(to):
    allow()   # not aimed at a justify watcher - none of our business

def is_terminating(m):
    # Structured protocol object: {"type":"shutdown_request", ...}. This is the sanctioned
    # teardown message and the reliable signal.
    if isinstance(m, dict):
        return str(m.get("type", "")).strip().lower() in ("shutdown_request", "shutdown", "terminate", "kill")
    if isinstance(m, str):
        s = m.strip()
        # An agent may hand the object as a JSON string; parse and re-check.
        if s.startswith("{"):
            try:
                return is_terminating(json.loads(s))
            except Exception:
                pass
        # Defensive: a stringified shutdown_request that did not parse.
        if re.search(r"[\"\x27]?type[\"\x27]?\s*:\s*[\"\x27]?shutdown_request", s, re.I):
            return True
    return False

if not is_terminating(msg):
    allow()   # a normal message to a watcher is fine - only shutdowns are gated

target = str(to).strip()
if has_user_consent_and_consume(target):
    allow()   # the USER minted a single-use consent token in their TTY - honour it once

deny("BLOCKED: a Justify-watching agent (\"" + target + "\") may NOT be shut down by another "
     "agent - only the human USER may stop it. A managing / lead / peer agent must never send "
     "a shutdown_request to a justify-* watcher (this has killed the watch by mistake before). "
     "The watcher survives across sessions on purpose. If it genuinely must be stopped, the USER "
     "runs `justify-watcher-shutdown " + target + "` in their own terminal (it needs a TTY and a "
     "typed confirmation; the daemon/hook layer refuses any agent-issued shutdown). Do not work "
     "around this - there is no env-var bypass and no --force.")
'
