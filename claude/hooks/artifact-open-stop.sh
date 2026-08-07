#!/bin/bash
# Stop hook: BLOCK ending the turn while a self-created artifact is still unshown.
#
# artifact-open-mandate.sh records each in-scope artifact Claude creates into a
# per-session pending list; artifact-open-clear.sh strikes one off when it is surfaced
# (Read / Artifact publish). This hook is the teeth: while any path remains unshown it
# stops the assistant from ending the turn, listing every unshown path and how to
# surface it. This mirrors verify-before-done-stop.sh's discipline:
#   - FIRE ONCE per burst: if we already blocked once this cycle (stop_hook_active),
#     allow the stop so we never trap the turn in a loop.
#   - FAIL OPEN: any error (malformed stdin, unreadable state) prints {} and exits 0.
#   - SELF-HEAL: a pending path whose file no longer exists on disk cannot be shown, so
#     it is pruned rather than left to wedge the gate; when nothing real remains, the
#     stop is allowed and the pending file is removed. A clean stop re-arms silently.
#
# Key derivation (the `or ""` form) is byte-identical to artifact-open-mandate.sh and
# artifact-open-clear.sh.

INPUT=$(cat)

# DEFAULT ON; the disable marker turns the trio off. When disabled, never block.
[ -f "$HOME/.claude/.artifact-surface-disabled" ] && { echo '{}'; exit 0; }

printf '%s' "$INPUT" | python3 -c '
import json, sys, os, re

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

# Already continued once because of a stop hook - do not block again (no loops).
if d.get("stop_hook_active"):
    print("{}"); sys.exit(0)

sk = re.sub(r"[^A-Za-z0-9._-]", "_", str(d.get("session_id", "") or "")) or "global"
pf = os.path.expanduser("~/.claude/.artifact-pending." + sk)

try:
    lines = [ln.strip() for ln in open(pf) if ln.strip()]
except Exception:
    print("{}"); sys.exit(0)

# SELF-HEAL: a recorded artifact that has since been deleted cannot be surfaced, so it
# is not a live obligation. Keep only paths that still exist; rewrite (or remove) the
# pending file to match. This makes an unsatisfiable mandate impossible to wedge on.
alive = [p for p in lines if os.path.exists(os.path.expanduser(p))]
if alive != lines:
    try:
        if alive:
            with open(pf, "w") as f:
                f.write("\n".join(alive) + "\n")
        else:
            os.remove(pf)
    except Exception:
        pass

if not alive:
    print("{}"); sys.exit(0)

listing = "\n".join("  - " + p for p in alive)
reason = (
    "BLOCKED: you created " + str(len(alive)) + " artifact(s) this session that you "
    "never showed the user:\n" + listing + "\n"
    "Open each one before ending the turn: Read it (Read renders an image or PDF and "
    "surfaces a document or HTML file into the conversation), publish it with the "
    "Artifact tool, or screenshot it. Surfacing what you make is mandatory - a file "
    "left in a directory the user has to dig up does not count as shown. If a path is "
    "genuinely not meant to be shown, say so and ask the user to confirm."
)
print(json.dumps({"decision": "block", "reason": reason}))
'
