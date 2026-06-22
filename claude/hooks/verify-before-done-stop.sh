#!/bin/bash
# Stop hook: BLOCK ending the turn while a VISUAL change is unverified.
#
# verify-before-done.sh writes "visual" into ~/.claude/.needs-verification when a
# .css/.html/.jsx/etc. file changes, and only a REAL screenshot clears it
# (Chrome computer screenshot / cmux screenshot / Read a .png). curl, navigate,
# and tests do NOT clear a visual flag. This hook is the teeth: it stops the
# assistant from reporting "done" on a visual change it never looked at.
#
# Safety valves (never trap permanently):
#   - stop_hook_active: if we already blocked once this cycle, allow the stop
#     (surface, do not loop forever).
#   - subagent/teammate sessions are exempt.
#   - the user can say "verified" / "looks good" / "bypass verification"
#     (verify-manual.sh clears the flag).

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

# Already continued once because of a stop hook - do not block again (no loops).
if d.get("stop_hook_active"):
    print("{}"); sys.exit(0)

flag = os.path.expanduser("~/.claude/.needs-verification")
try:
    content = open(flag).read().strip()
except Exception:
    content = ""

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

if content == "visual" and not is_subagent(d.get("transcript_path", "")):
    reason = (
        "BLOCKED: a visual file changed and was never visually verified. "
        "Capture a REAL screenshot of the rendered result (Chrome computer "
        "screenshot, cmux browser screenshot, or Playwright then Read the .png) "
        "and examine it before reporting done. curl, navigate, and tests do NOT "
        "count for visual changes. If verification is genuinely impossible, say "
        "so explicitly and ask the user - they can reply verified or looks good "
        "to override."
    )
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)

print("{}")
'
