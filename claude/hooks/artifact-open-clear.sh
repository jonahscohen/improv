#!/bin/bash
# PostToolUse hook for Read, the Artifact tool, and Bash (matcher: Read|Artifact|Bash).
# When Claude SURFACES a file that is outstanding in THIS session's pending list, strike
# that one path off. An obligation is met three ways:
#   - a SUCCESSFUL Read of the path renders an image or PDF and surfaces a document or
#     HTML file into the conversation. A FAILED read (e.g. a .docx that "cannot be read"
#     as text) shows nothing, so it must NOT discharge - the reader saw no content.
#   - an Artifact publish of that same file_path shows it to the user directly.
#   - `open` / `xdg-open` / `start <path>` in Bash opens the file in its native app,
#     which is how a human is shown a document Read cannot render inline (a .docx).
#
# The pending state is per-session and holds a LIST. Key derivation (the `or ""` form)
# and the path canonicalization are byte-identical to artifact-open-mandate.sh and
# artifact-open-stop.sh; if you change either, change all three or a surfaced path will
# no longer compare equal to the recorded one.

INPUT=$(cat)

# DEFAULT ON; the disable marker turns the trio off. When disabled, do nothing.
[ -f "$HOME/.claude/.artifact-surface-disabled" ] && { echo '{}'; exit 0; }

SESSION_KEY=$(printf '%s' "$INPUT" | python3 -c '
import json, re, sys
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
s = str(d.get("session_id", "") or "")
s = re.sub(r"[^A-Za-z0-9._-]", "_", s)
print(s or "global")
' 2>/dev/null)
[ -z "$SESSION_KEY" ] && SESSION_KEY=global
PENDING_FILE="$HOME/.claude/.artifact-pending.$SESSION_KEY"
# Shown ledger: every path discharged here is appended so artifact-open-mandate.sh will
# not re-record it later this session (the re-flag-loop fix). Key byte-identical to PENDING_FILE.
SHOWN_FILE="$HOME/.claude/.artifact-shown.$SESSION_KEY"

[ ! -f "$PENDING_FILE" ] && echo '{}' && exit 0

SURFACED_PATH=$(printf '%s' "$INPUT" | python3 -c '
import json, sys, os, re
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit(0)
tool = d.get("tool_name", "")
ti = d.get("tool_input", {}) or {}
resp = d.get("tool_response", d.get("tool_result", None))

def resp_errored(r):
    # Conservative: only treat a result as failed on a clear error signal. A false
    # "errored" here would wedge a real Read; a missed error just falls back to the
    # old discharge-on-attempt behavior, which is the safe direction.
    if isinstance(r, dict):
        if r.get("error") or r.get("is_error") or r.get("isError"):
            return True
        for k in ("status", "result", "type"):
            v = r.get(k)
            if isinstance(v, str) and v.strip().lower() in ("error", "failed", "failure"):
                return True
    if isinstance(r, str):
        low = r.lstrip().lower()
        # Only ERROR FRAMING counts, never a content phrase - a successful Read of a
        # note whose text happens to say "cannot be read as text" or "does not exist"
        # must still discharge. A real Read failure surfaces as a dict error (handled
        # above) or a string that BEGINS with an error marker; anything else falls back
        # to discharging, which is the safe direction.
        if low.startswith("error") or low.startswith("<tool_use_error>"):
            return True
    return False

p = ""
if tool in ("Read", "Artifact"):
    # A Read/Artifact discharges only when it actually surfaced content (succeeded).
    if not resp_errored(resp):
        p = ti.get("file_path", "") or ""
elif tool == "Bash":
    # Opening a file in its native app is how a human is shown a document Read cannot
    # render inline. To discharge, the command must BE - in its entirety - a bare
    # `open <path>` (or xdg-open/start) invocation: opener, optional flags, one path,
    # nothing else. This deliberately rejects every chained/quoted/echoed form
    # (`echo ";" open X`, `echo "; open X"`, `cd /tmp && open X`, `open X; rm Y`):
    # trying to decide "did open actually run" from arbitrary shell text is a parsing
    # problem with endless quoting bypasses, and the SAFE direction is to leave the
    # artifact flagged rather than risk a FALSE discharge that hides it from the user.
    # When you actually want to show a document, run `open <path>` on its own. An
    # unquoted flag/path token may contain NO whitespace and NO shell metacharacter, so
    # a matched command cannot smuggle an operator, redirect, substitution, or glob past
    # the whole-command anchor - e.g. `open -R;true X` fails because ";" is not allowed
    # inside the flag token, and bash would actually run `open -R` then `true X`.
    cmd = (ti.get("command", "") or "").strip()
    _bad = ";&|<>$(){}[]*?" + chr(92) + chr(96) + chr(34) + chr(39)  # ; & | < > $ ( ) { } [ ] * ? \ ` " (squote)
    SAFE = "[^\\s" + re.escape(_bad) + "]"
    # The double-quoted path branch also forbids $ and backtick so a quoted command
    # substitution (open "/tmp/$(echo other)") cannot appear; even though the pending
    # exact-match gate already blocks a false discharge, this removes the vector outright.
    QSAFE = "[^\"$" + chr(96) + "]"
    m = re.match(
        "(?:open|xdg-open|start)\\b(?:\\s+-{1,2}" + SAFE + "+)*\\s+"
        "(?:\"(" + QSAFE + "+)\"|(" + SAFE + "+))\\s*$", cmd)
    if m:
        p = m.group(1) or m.group(2) or ""

if p:
    p = os.path.normpath(os.path.expanduser(p))
print(p)
' 2>/dev/null)

# Strike off exactly the path that was surfaced. Any other outstanding artifact stays
# outstanding: discharging one obligation must never discharge another.
if [ -n "$SURFACED_PATH" ] && grep -qxF -- "$SURFACED_PATH" "$PENDING_FILE" 2>/dev/null; then
  TMP=$(mktemp)
  grep -vxF -- "$SURFACED_PATH" "$PENDING_FILE" > "$TMP" 2>/dev/null
  if [ -s "$TMP" ]; then
    mv "$TMP" "$PENDING_FILE"
  else
    rm -f "$PENDING_FILE" "$TMP"
  fi
  # Record path + its mtime-ns AT SHOW TIME (one entry per path, latest wins), so the
  # mandate skips a later MENTION only while the file is UNCHANGED since it was shown; a
  # re-created artifact (newer mtime) is re-flagged rather than hidden (Codex P1). SURFACED_PATH
  # is already canonical. Fail-open: any error leaves the ledger untouched.
  mkdir -p "$(dirname "$SHOWN_FILE")"
  python3 - "$SHOWN_FILE" "$SURFACED_PATH" <<'PY' 2>/dev/null
import os, sys
shown, path = sys.argv[1], sys.argv[2]
try:
    mt = os.stat(path).st_mtime_ns
except Exception:
    sys.exit(0)
try:
    lines = [ln.rstrip("\n") for ln in open(shown) if ln.strip()]
except Exception:
    lines = []
kept = [ln for ln in lines if ln.split("\t", 1)[0] != path]
kept.append("%s\t%d" % (path, mt))
try:
    with open(shown, "w") as f:
        f.write("\n".join(kept) + "\n")
except Exception:
    pass
PY
fi

echo '{}'
