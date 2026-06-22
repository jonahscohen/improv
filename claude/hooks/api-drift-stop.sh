#!/bin/bash
# Stop hook: BLOCK ending the turn while API drift is unresolved (the teeth for
# api-drift-detector.sh). Cleared by accommodating (edit a guard/wrapper/config)
# or by saying "drift handled" (api-drift-ack.sh).
#
# Safety: stop_hook_active short-circuit (block once per cycle, never loop
# forever); subagent/teammate sessions exempt.

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

if d.get("stop_hook_active"):
    print("{}"); sys.exit(0)

pending = os.path.expanduser("~/.claude/.api-drift-pending")
try:
    det = open(pending).read().strip()
except Exception:
    print("{}"); sys.exit(0)

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

reason = ("BLOCKED: unresolved API drift (" + det + "). A tool returned a breaking-contract signal and "
          "no accommodation was written. Investigate what changed in that tool API and update the "
          "affected guard / launcher / settings to match it (that clears this), or say \"drift handled\" "
          "if it is a false positive. Details in ~/.claude/.api-drift.log.")
print(json.dumps({"decision": "block", "reason": reason}))
'
