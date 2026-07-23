#!/bin/bash
# Stop hook: BLOCK the session from ending while the Justify daemon queue is
# non-empty. A prompt routed through justify-watch is only CLOSED when it is
# signalled back with ~/.claude/justify/justify-done.sh (which POSTs /respond +
# /prompts/clear). Reporting completion in chat does NOT close it - the Justify
# browser keeps showing it open and the queue never drains. This gate is the
# teeth: you cannot finish while Justify still has prompts it was never told the
# outcome of.
#
# Born 2026-07-19: prompts 36/37/38/39 were completed + reported in chat but never
# signalled done, so all four sat in the queue and the browser stayed in the dark.
# Jonah: "How do we prevent Justify from being left in the dark ... we need a real
# way to prevent the room for failure. Our agency depends on it."
#
# FAILS OPEN on every case that is not "the armed watcher is quitting on a live,
# non-empty queue", so it can neither trap a session nor misfire on unrelated ones:
#   - kill switch  ~/.claude/.justify-queue-gate-off present  -> allow
#   - this session is NOT the armed justify-watch owner        -> allow
#   - subagent / teammate session                              -> allow
#   - daemon down / unreachable / bad response                 -> allow
#   - queue empty                                              -> allow (reset breaker)
#   - 3-strike circuit breaker (stop_hook_active & 3 blocks)   -> allow + warn
# Only a live daemon with a non-empty queue, on the armed owner session, blocks.
#
# The drain is ALWAYS possible (justify-done, or JUSTIFY_STATUS=needsInfo), so a
# compliant session clears the block in one step; the breaker is insurance against
# a wedged daemon.
set -uo pipefail

INPUT=$(cat)
printf '%s' "$INPUT" | JUSTIFY_PORT="${JUSTIFY_PORT:-9223}" python3 -c '
import json, sys, os, re, urllib.request

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

home = os.path.expanduser("~")

# 0. explicit kill switch
if os.path.exists(os.path.join(home, ".claude", ".justify-queue-gate-off")):
    print("{}"); sys.exit(0)

# 1. only the armed justify-watch OWNER session polices the queue. The arm writes
#    ~/.claude/.justify-watch-standing-by.<session_id>; absent -> not our queue.
sid = str(d.get("session_id", "") or "")
if not sid:
    print("{}"); sys.exit(0)
if not os.path.exists(os.path.join(home, ".claude", ".justify-watch-standing-by." + sid)):
    print("{}"); sys.exit(0)

# 2. subagents / teammates never own the queue.
def is_subagent(path):
    if not path:
        return False
    try:
        with open(path) as fh:
            for i, line in enumerate(fh):
                if i > 20:
                    break
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                if r.get("isSidechain") is True:
                    return True
                if r.get("teamName"):
                    return True
    except Exception:
        return False
    return False

if is_subagent(d.get("transcript_path", "")):
    print("{}"); sys.exit(0)

# 3. ask the daemon what is queued. Any failure -> fail open (justify not in play).
port = os.environ.get("JUSTIFY_PORT", "9223")
try:
    raw = urllib.request.urlopen("http://localhost:%s/prompts" % port, timeout=2).read()
    q = json.loads(raw)
    if not isinstance(q, list):
        q = []
except Exception:
    print("{}"); sys.exit(0)

sk = re.sub(r"[^A-Za-z0-9._-]", "_", sid) or "global"
cnt_path = os.path.join(home, ".claude", ".justify-queue-stop-count." + sk)

# 4. empty queue -> nothing owed. Reset the breaker and allow.
if len(q) == 0:
    try:
        os.remove(cnt_path)
    except OSError:
        pass
    print("{}"); sys.exit(0)

ids = [str(p.get("id", "?")) for p in q]

# 5. circuit breaker: if we already blocked 3 times this cycle and it is STILL
#    non-empty, allow (a wedged daemon must not trap the session forever).
try:
    cnt = int(open(cnt_path).read().strip())
except Exception:
    cnt = 0
if d.get("stop_hook_active") and cnt >= 3:
    try:
        os.remove(cnt_path)
    except OSError:
        pass
    sys.stderr.write(
        "WARN justify-queue-gate: %d prompt(s) still queued after 3 blocks (%s); "
        "allowing stop to avoid a loop - the daemon on port %s may be wedged. "
        "Drain it manually with justify-done.\n" % (len(q), ", ".join(ids), port)
    )
    print("{}"); sys.exit(0)

with open(cnt_path, "w") as fh:
    fh.write(str(cnt + 1))

reason = (
    "BLOCKED (justify-queue): %d Justify prompt(s) are still in the queue and Justify "
    "was never told their outcome - its browser still shows them open: %s. Reporting in "
    "chat does NOT close a Justify prompt; you must signal it back. Before you finish, for "
    "EACH completed prompt run:\n"
    "  ~/.claude/justify/justify-done.sh <promptId> \"<one-line summary>\" \"<comma,files>\"\n"
    "or, only if you genuinely need the user, the same with JUSTIFY_STATUS=needsInfo. List "
    "live ids with:  curl -s http://localhost:%s/prompts . The queue must drain to 0 before "
    "this session ends."
) % (len(q), ", ".join(ids), port)

print(json.dumps({"decision": "block", "reason": reason}))
'
