#!/bin/bash
# PostToolUse hook for Bash and chrome MCP computer screenshot.
# When a screenshot is captured to disk, REQUIRE the agent to Read the file
# before further validation progress. The screenshot itself doesn't reach the
# user's conversation surface unless it's loaded via Read - so describing a
# screenshot that was only captured (not opened) is hollow.
#
# Strategy:
#   1. Detect screenshot capture commands and extract the output path.
#   2. Write the path to a "pending screenshot" state file.
#   3. Inject a system reminder telling the agent to Read the path.
#   4. The companion hook screenshot-open-clear.sh fires on Read; if the path
#      matches a pending screenshot, the state is cleared.
#   5. A pre-completion gate (in bash-guard) blocks claims of validation if
#      there's an unread screenshot pending.

INPUT=$(cat)

# The pending state is keyed by SESSION and holds a LIST of paths.
#
# It used to be one global file, `$HOME/.claude/.screenshot-pending`, containing a
# single path. Two failures, both reproduced on 2026-07-10:
#   - a second screenshot OVERWROTE the first, so the first capture's obligation
#     to be Read silently evaporated;
#   - across concurrent cmux surfaces, one session's Read discharged ANOTHER
#     session's obligation - a session that never took that screenshot.
# Structurally identical to the multiple-choice violation flag, which was global
# across 24 sessions for the same reason.
# See reference_2026-07-10_screenshot-pending-is-global-and-arms-on-fiction.md.
#
# Key derivation is duplicated verbatim in screenshot-open-clear.sh and
# bash-guard.sh. If you change it, change all three.
SESSION_KEY=$(printf '%s' "$INPUT" | python3 -c '
import json, re, sys
try:
    s = str(json.load(sys.stdin).get("session_id", ""))
except Exception:
    s = ""
s = re.sub(r"[^A-Za-z0-9._-]", "_", s)
print(s or "global")
' 2>/dev/null)
[ -z "$SESSION_KEY" ] && SESSION_KEY=global
PENDING_FILE="$HOME/.claude/.screenshot-pending.$SESSION_KEY"

# Reap pending files from sessions that ended without discharging. Without this
# the per-session files accumulate forever, and a stale one from a dead session
# would block a fresh one that reuses its key.
find "$HOME/.claude" -maxdepth 1 -name '.screenshot-pending.*' -mtime +1 -delete 2>/dev/null
TOOL_NAME=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get("tool_name", ""))
except:
    print("")
' 2>/dev/null)

PATH_TO_READ=""

case "$TOOL_NAME" in
  Bash)
    # cmux screenshot writes to the path after --out
    CMD=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input", {}).get("command", ""))
except:
    print("")
' 2>/dev/null)
    if echo "$CMD" | grep -qE 'cmux\b[^|;&]*\bscreenshot\b'; then
      # Extract --out PATH (or --out=PATH)
      PATH_TO_READ=$(echo "$CMD" | python3 -c '
import re, sys
m = re.search(r"--out[= ]+([^\s;|&]+)", sys.stdin.read())
print(m.group(1) if m else "")
' 2>/dev/null)
    fi
    ;;
  mcp__claude-in-chrome__computer)
    # chrome MCP computer screenshot action with save_to_disk
    ACTION=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    inp = d.get("tool_input", {})
    print(inp.get("action", ""))
except:
    print("")
' 2>/dev/null)
    SAVE_TO_DISK=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    inp = d.get("tool_input", {})
    print("1" if inp.get("save_to_disk") else "0")
except:
    print("0")
' 2>/dev/null)
    if [ "$ACTION" = "screenshot" ] || [ "$ACTION" = "zoom" ]; then
      if [ "$SAVE_TO_DISK" != "1" ]; then
        # Block: chrome MCP screenshot without save_to_disk leaves the user
        # without a Readable artifact. Force save_to_disk.
        MSG="REMINDER: chrome MCP screenshot called without save_to_disk:true. The user cannot see the image as a Readable artifact. Re-take with save_to_disk: true so the path is returned, then Read that path before claiming validation."
        python3 -c "import json, sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PostToolUse','additionalContext':sys.argv[1]}}))" "$MSG"
        exit 0
      fi
      # save_to_disk: true was used. Parse the tool result to extract the path.
      # Tool result structure varies; check tool_response.content for a path string.
      PATH_TO_READ=$(printf '%s' "$INPUT" | python3 -c '
import json, sys, re
try:
    d = json.load(sys.stdin)
    resp = d.get("tool_response", d.get("tool_result", {}))
    if isinstance(resp, dict):
        # Look in any string field
        for v in resp.values():
            if isinstance(v, str):
                m = re.search(r"(/(?:tmp|var)/[\w./_-]+\.(?:png|jpg|jpeg|webp))", v)
                if m:
                    print(m.group(1)); break
            elif isinstance(v, list):
                for it in v:
                    s = it if isinstance(it, str) else json.dumps(it)
                    m = re.search(r"(/(?:tmp|var)/[\w./_-]+\.(?:png|jpg|jpeg|webp))", s)
                    if m:
                        print(m.group(1)); break
    elif isinstance(resp, str):
        m = re.search(r"(/(?:tmp|var)/[\w./_-]+\.(?:png|jpg|jpeg|webp))", resp)
        if m:
            print(m.group(1))
except Exception:
    pass
' 2>/dev/null)
    fi
    ;;
esac

# The extractor greps `--out <path>` out of the RAW command text, so it also
# matches a path inside a quoted string, a heredoc, or a printf template. On
# 2026-07-10 it scraped `%s"}}'` out of a probe's format string and wrote that
# into the pending file. Nothing could then discharge the obligation: bash-guard
# blocks further screenshots and commits until the pending path is Read, and that
# path was a fragment of shell syntax that had never existed. The guard wedged
# itself, and no Read could ever free it.
#
# This hook is PostToolUse: it runs AFTER the capture, so a real screenshot always
# has a real file on disk by now. Requiring the path to exist cannot suppress a
# genuine mandate, and it makes an unsatisfiable one impossible.
if [ -n "$PATH_TO_READ" ] && [ ! -e "$PATH_TO_READ" ]; then
  PATH_TO_READ=""
fi

if [ -n "$PATH_TO_READ" ]; then
  # APPEND, never overwrite. Overwriting is how the previous screenshot's
  # obligation used to disappear. Every outstanding capture stays outstanding
  # until its own path is Read.
  mkdir -p "$(dirname "$PENDING_FILE")"
  grep -qxF -- "$PATH_TO_READ" "$PENDING_FILE" 2>/dev/null \
    || printf '%s\n' "$PATH_TO_READ" >> "$PENDING_FILE"
  OUTSTANDING=$(wc -l < "$PENDING_FILE" 2>/dev/null | tr -d ' ')
  MSG="MANDATORY: a screenshot was just saved to $PATH_TO_READ. You MUST Read that path before composing your next text response, taking another screenshot, or claiming any validation result. Looking at the image is the validation - capturing it without opening it proves nothing."
  if [ "${OUTSTANDING:-1}" -gt 1 ]; then
    MSG="$MSG ($OUTSTANDING screenshots are now outstanding in this session; each one must be Read.)"
  fi
  python3 -c "import json, sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PostToolUse','additionalContext':sys.argv[1]}}))" "$MSG"
else
  echo '{}'
fi
