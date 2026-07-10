#!/bin/bash
# Echoes the current session's model id (e.g. "claude-fable-5", "claude-opus-4-8")
# to stdout, or nothing if it cannot be determined.
#
# Source of truth: the session transcript JSONL records .message.model on every
# assistant line. The LAST top-level assistant line's model == the current model.
# Callers pass what they read from the PreToolUse stdin:
#   $1 = transcript_path (may be empty)   $2 = session_id (may be empty)
# Only an ABSOLUTE transcript_path is trusted; otherwise we locate
# <session_id>.jsonl under ~/.claude/projects (session_id sanitized first).
# Detection uses a reverse, line-complete, JSON-aware scan (reads chunks from the
# END so it is fast on huge transcripts and never fragments the target line or
# false-matches a nested "type":"assistant" inside another record). Prints nothing
# (=> callers fail-open) on any uncertainty, so a non-Fable session is never
# wrongly gated. Added 2026-07-06 (Jonah); hardened after Codex review same day.
# See session_2026-07-06_fable-orchestrator-hook-conflict.md.

TP="$1"
SID="$2"

# Trust transcript_path only if absolute.
case "$TP" in
  /*) ;;
  *) TP="" ;;
esac

# Fallback: locate <session_id>.jsonl, but only for a safe (glob-free) id.
if [ -z "$TP" ] || [ ! -f "$TP" ]; then
  if printf '%s' "$SID" | grep -qE '^[A-Za-z0-9._-]+$'; then
    TP=$(find "$HOME/.claude/projects" -type f -name "${SID}.jsonl" 2>/dev/null | head -1)
  else
    TP=""
  fi
fi

[ -n "$TP" ] && [ -f "$TP" ] || exit 0

python3 - "$TP" <<'PY' 2>/dev/null
import sys, os, json

path = sys.argv[1]
CHUNK = 1 << 20  # 1 MiB per reverse-read step

try:
    size = os.path.getsize(path)
except OSError:
    print(""); sys.exit(0)

model = ""
try:
    with open(path, "rb") as f:
        pos = size
        carry = b""      # partial line at the front of the window
        found = False
        while pos > 0 and not found:
            step = CHUNK if pos >= CHUNK else pos
            pos -= step
            f.seek(pos)
            block = f.read(step) + carry
            lines = block.split(b"\n")
            if pos > 0:
                carry = lines[0]     # first segment may be a partial line
                complete = lines[1:]
            else:
                carry = b""
                complete = lines     # reached start of file: all complete
            for line in reversed(complete):
                line = line.strip()
                if not line:
                    continue
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                if isinstance(o, dict) and o.get("type") == "assistant":
                    m = (o.get("message") or {}).get("model") or ""
                    if m:
                        model = m
                        found = True
                        break
except Exception:
    model = ""

print(model)
PY
