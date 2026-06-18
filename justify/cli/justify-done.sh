#!/usr/bin/env bash
# justify-done - send a result back to the Justify browser and clear the queue,
# printing a clean confirmation card instead of raw curl /respond + /prompts/clear.
#
# Usage:  justify-done <promptId> <summary> [comma,separated,files]
# Env:
#   JUSTIFY_STATUS   completed | needsInfo   (default completed)
#   JUSTIFY_CHANGES  JSON array of {selector,property,oldValue,newValue} (default [])
#   JUSTIFY_DIFF     raw `git diff` output - parsed into real per-file diff hunks
#                    (with line numbers) so the Review Changes panel shows a
#                    standard code diff and can open each file at the exact line.
#   JUSTIFY_PORT     daemon port (default 9223)
#   NO_COLOR         disable color
set -uo pipefail

PID="${1:-}"
SUMMARY="${2:-}"
FILES="${3:-}"
if [ -z "$PID" ] || [ -z "$SUMMARY" ]; then
  echo "usage: justify-done <promptId> <summary> [comma,separated,files]" >&2
  exit 1
fi

if [ -z "${NO_COLOR:-}" ]; then
  O=$'\033[38;5;209m'; D=$'\033[38;5;245m'; B=$'\033[1m'; X=$'\033[0m'
else
  O='' ; D='' ; B='' ; X=''
fi
CHK=$'✓'; TL=$'┌'; BL=$'└'; DOT=$'·'

PORT="${JUSTIFY_PORT:-9223}" PID="$PID" SUMMARY="$SUMMARY" FILES="$FILES" \
STATUS="${JUSTIFY_STATUS:-completed}" CHANGES="${JUSTIFY_CHANGES:-[]}" \
JUSTIFY_DIFF="${JUSTIFY_DIFF:-}" \
O="$O" D="$D" B="$B" X="$X" CHK="$CHK" TL="$TL" BL="$BL" DOT="$DOT" python3 <<'PY'
import os, json, urllib.request, re
e = os.environ
base = f"http://localhost:{e['PORT']}"
files = [f.strip() for f in e.get("FILES", "").split(",") if f.strip()]
try:
    changes = json.loads(e.get("CHANGES") or "[]")
except Exception:
    changes = []

def parse_git_diff(text):
    """Parse `git diff` output into [{file, hunks:[{oldStart,newStart,header,
    lines:[{t,oldNo,newNo,text}]}]}]. t is ' '|'-'|'+'. Line numbers are 1-based
    file line numbers so the panel can render a gutter and open at an exact line."""
    diffs = []
    cur = None
    old_no = new_no = 0
    hunk = None
    for raw in text.splitlines():
        if raw.startswith('diff --git'):
            cur = {"file": None, "hunks": []}
            diffs.append(cur)
            hunk = None
            continue
        if cur is None:
            continue
        if raw.startswith('+++ '):
            p = raw[4:].strip()
            if p.startswith('b/'):
                p = p[2:]
            if p != '/dev/null':
                cur["file"] = p
            continue
        if raw.startswith('--- '):
            continue
        m = re.match(r'^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$', raw)
        if m:
            old_no = int(m.group(1)); new_no = int(m.group(2))
            hunk = {"oldStart": old_no, "newStart": new_no,
                    "header": m.group(3).strip(), "lines": []}
            cur["hunks"].append(hunk)
            continue
        if hunk is None:
            continue
        if raw.startswith('+'):
            hunk["lines"].append({"t": "+", "oldNo": None, "newNo": new_no, "text": raw[1:]})
            new_no += 1
        elif raw.startswith('-'):
            hunk["lines"].append({"t": "-", "oldNo": old_no, "newNo": None, "text": raw[1:]})
            old_no += 1
        elif raw.startswith(' '):
            hunk["lines"].append({"t": " ", "oldNo": old_no, "newNo": new_no, "text": raw[1:]})
            old_no += 1; new_no += 1
        # '\ No newline at end of file' and other markers are ignored
    return [d for d in diffs if d.get("file") and d.get("hunks")]

diffs = []
raw_diff = e.get("JUSTIFY_DIFF", "")
if raw_diff.strip():
    try:
        diffs = parse_git_diff(raw_diff)
    except Exception:
        diffs = []

payload = {
    "promptId": e["PID"], "summary": e["SUMMARY"], "filesChanged": files,
    "changes": changes, "diffs": diffs, "status": e["STATUS"],
}
body = json.dumps(payload).encode()

def post(path, data=b""):
    req = urllib.request.Request(base + path, data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    return urllib.request.urlopen(req, timeout=5).read()

O, D, B, X = e["O"], e["D"], e["B"], e["X"]
CHK, TL, BL, DOT = e["CHK"], e["TL"], e["BL"], e["DOT"]
try:
    post("/respond", body)
    # Issue #3: clear ONLY the task we just answered, by id. A blanket clear
    # erased every prompt that arrived in the queue while this one was being
    # worked - they were silently forgotten. Id-aware clear leaves them queued.
    post("/prompts/clear", json.dumps({"ids": [e["PID"]]}).encode())
    print(f"  {O}{CHK}{X} justify  {B}{DOT}  sent to browser{X}")
    print(f"  {O}{TL}{X} {e['SUMMARY']}")
    tail = ", ".join(files) if files else "no files changed"
    nh = sum(len(d["hunks"]) for d in diffs)
    diffnote = f"  ({len(diffs)} file diff(s), {nh} hunk(s))" if diffs else ""
    print(f"  {O}{BL}{X} {D}{tail}{diffnote}{X}")
except Exception as ex:
    print(f"  {O}{CHK}{X} justify  {B}{DOT}  respond FAILED{X}")
    print(f"  {O}{BL}{X} {D}{ex}{X}")
    raise SystemExit(1)
PY
