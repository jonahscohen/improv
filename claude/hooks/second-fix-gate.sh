#!/bin/bash
# PostToolUse hook for Write|Edit|MultiEdit.
# Detects stacked fixes on the same area without verification between them.
#
# Origin (2026-05-19 reflection finding #3):
#   Three bugs lived in one code path. Fix A landed. Fix B landed on the same
#   file within minutes - BEFORE the external probe that would have found the
#   real root cause (missing WSS handler) ran. Fix B made the symptom worse
#   because it stacked on an unverified Fix A.
#
# v2 (2026-05-19, refinement after over-firing):
#   v1 warned on every chained edit. It fired 3 times during 5 sequential
#   additive edits to install.sh that were one coherent task. v2 changes:
#     1. WARN AT MOST ONCE per file per 10-min window (per-file flag).
#     2. SUPPRESS pure-additive Edit/MultiEdit calls (new_string contains
#        old_string as a substring => the old content was preserved AND new
#        content was wrapped around it).
#     3. MANUAL OVERRIDE: `touch ~/.claude/.suppress-fix-gate` silences the
#        gate for 30 minutes. Auto-clears via mtime.
#
# The hook continues to require `~/.claude/.needs-verification` to be set
# (i.e. an unverified code change is owed) before warning at all.

INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 <<'PYEOF'
import json, os, sys, time, hashlib

raw = os.environ.get("HOOK_INPUT", "")
try:
    data = json.loads(raw)
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
if tool not in ("Write", "Edit", "MultiEdit"):
    print("{}"); sys.exit(0)

ti = data.get("tool_input", {}) or {}
file_path = ti.get("file_path", "")
if not file_path:
    print("{}"); sys.exit(0)

# Exempt paths - memory writes, hook edits, skill edits do not count as fixes.
EXEMPT = [".claude/memory/", "MEMORY.md", ".claude/hooks/", ".claude/skills/"]
if any(e in file_path for e in EXEMPT):
    print("{}"); sys.exit(0)

WINDOW_SECONDS = 600      # 10 min "stacked edits" window
OVERRIDE_TTL = 1800       # 30 min manual-override TTL
HOME = os.path.expanduser("~")
last_fix_path = os.path.join(HOME, ".claude", ".last-fix-file")
verify_flag = os.path.join(HOME, ".claude", ".needs-verification")
override_flag = os.path.join(HOME, ".claude", ".suppress-fix-gate")

# 1. Manual override - silence gate entirely if user has set the flag.
#    Auto-expires after 30 min so it can't be left on accidentally.
if os.path.exists(override_flag):
    try:
        age = time.time() - os.path.getmtime(override_flag)
        if age <= OVERRIDE_TTL:
            # Still update the tracker so the window stays accurate
            try:
                with open(last_fix_path, "w") as f:
                    f.write(file_path)
                os.utime(last_fix_path, None)
            except Exception:
                pass
            print("{}"); sys.exit(0)
        else:
            try: os.remove(override_flag)
            except Exception: pass
    except Exception:
        pass

# Per-file "already warned" flag - one warning per file per window.
file_hash = hashlib.sha1(file_path.encode("utf-8")).hexdigest()[:12]
warned_flag = os.path.join(HOME, ".claude", ".fix-gate-warned-" + file_hash)

def is_additive_edit():
    """
    True if the current Edit/MultiEdit is purely additive - i.e. the new
    content contains the old content as a substring, meaning the previous
    code was preserved AND extra code was wrapped around it.

    For Write, we cannot tell (no diff in tool_input). Conservatively
    return False so Write keeps warning eligibility.
    """
    if tool == "Edit":
        old = ti.get("old_string", "")
        new = ti.get("new_string", "")
        if old and new and old in new:
            return True
        return False
    if tool == "MultiEdit":
        edits = ti.get("edits", []) or []
        if not edits:
            return False
        for e in edits:
            old = e.get("old_string", "")
            new = e.get("new_string", "")
            if not old or old not in new:
                return False
        return True
    return False  # Write tool

warn = False
prev_path = ""

if os.path.exists(last_fix_path) and os.path.exists(verify_flag):
    try:
        age = time.time() - os.path.getmtime(last_fix_path)
        if age <= WINDOW_SECONDS:
            with open(last_fix_path, "r") as f:
                prev_path = f.read().strip()
            if prev_path:
                same_file = (prev_path == file_path)
                same_dir = (os.path.dirname(prev_path) == os.path.dirname(file_path))
                if same_file or same_dir:
                    warn = True
    except Exception:
        pass

# 2. Suppress if we already warned for this file inside the window.
if warn and os.path.exists(warned_flag):
    try:
        age = time.time() - os.path.getmtime(warned_flag)
        if age <= WINDOW_SECONDS:
            warn = False
    except Exception:
        pass

# 3. Suppress if this is a pure-additive Edit/MultiEdit.
if warn and is_additive_edit():
    warn = False

# Always update the tracker.
try:
    with open(last_fix_path, "w") as f:
        f.write(file_path)
    os.utime(last_fix_path, None)
except Exception:
    pass

if warn:
    # Record that we warned for this file in this window.
    try:
        with open(warned_flag, "w") as f:
            f.write(file_path)
        os.utime(warned_flag, None)
    except Exception:
        pass

    relation = "same file" if prev_path == file_path else "same directory"
    lines = [
        "SECOND FIX DETECTED on the " + relation + " within 10 min, no verification cleared between them.",
        "Previous edit: " + prev_path,
        "Current edit:  " + file_path,
        "",
        "Today's 2026-05-19 lesson: three bugs in one symptom. Fix #2 made it WORSE because Fix #1 hadn't verified the root cause. Before this edit ships:",
        " 1. Run an external probe (curl, node test, separate process) confirming the symptom.",
        " 2. If the symptom still exists after Fix #1, you may have N>1 root causes. Widen the search rather than narrowing to the next likely line.",
        "",
        "If this is ONE coherent task (e.g. wiring one change into several files),",
        "silence the gate for 30 minutes:",
        "   touch ~/.claude/.suppress-fix-gate",
        "",
        "(I will only warn once per file per 10-minute window, regardless.)",
    ]
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": "\n".join(lines)
        }
    }))
else:
    print("{}")
PYEOF
