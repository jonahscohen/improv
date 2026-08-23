#!/usr/bin/env bash
# justify-done - send a result back to the Justify browser and clear the queue,
# then print the EXECUTIVE REPORT card for the completed task as plain markdown.
# The card is code-rendered here (deterministic), not agent-composed, so the
# conversation-facing output for a finished task always comes from this script.
#
# Usage:  justify-done <promptId> <summary> [comma,separated,files]
# Env:
#   JUSTIFY_STATUS   completed | needsInfo   (default completed)
#   JUSTIFY_CHANGES  JSON array of {selector,property,oldValue,newValue} (default [])
#                    Rendered as a | Selector | Property | Before | After | table.
#   JUSTIFY_DIFF     raw `git diff` output - parsed into real per-file diff hunks
#                    (with line numbers) so the Review Changes panel shows a
#                    standard code diff and can open each file at the exact line.
#                    EXPLICIT OVERRIDE ONLY (Jonah 2026-08-22): normally leave this
#                    unset. The daemon captures a per-task baseline at prompt creation
#                    and computes the diff itself, which is the only way to isolate a
#                    single task's edit; a `git diff HEAD` here would show the whole
#                    uncommitted tree and would wrongly override that correct diff.
#                    Set it only to force a specific diff.
#   JUSTIFY_PORT     daemon port (default 9223)
#   JUSTIFY_DRY_RUN  when set (non-empty), skip the /respond + /prompts/clear
#                    network calls and just render the card (offline testing).
#   NO_COLOR         accepted for compatibility. The card is always plain
#                    markdown with no ANSI styling, so no color is ever emitted.
set -uo pipefail

PID="${1:-}"
SUMMARY="${2:-}"
FILES="${3:-}"
if [ -z "$PID" ] || [ -z "$SUMMARY" ]; then
  echo "usage: justify-done <promptId> <summary> [comma,separated,files]" >&2
  exit 1
fi

# JUSTIFY_DIFF is an EXPLICIT override only. The daemon now captures a per-task
# baseline at prompt creation and computes the diff itself in emitResponse (the ONLY
# way to isolate a task's edit correctly - a `git diff HEAD` here would show the whole
# accumulated working tree in a repo whose app is uncommitted, and would wrongly
# OVERRIDE that correct daemon diff since an explicit diffs array wins). So do not
# auto-capture here; pass JUSTIFY_DIFF yourself only when you truly want to override.
PORT="${JUSTIFY_PORT:-9223}" PID="$PID" SUMMARY="$SUMMARY" FILES="$FILES" \
STATUS="${JUSTIFY_STATUS:-completed}" CHANGES="${JUSTIFY_CHANGES:-[]}" \
JUSTIFY_DIFF="${JUSTIFY_DIFF:-}" JUSTIFY_DRY_RUN="${JUSTIFY_DRY_RUN:-}" \
python3 <<'PY'
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
            # Fallback filename for a DELETION (+++ is /dev/null). git emits --- before
            # +++, so +++ overrides this for a normal edit; a deletion keeps this path
            # instead of being dropped for having no filename.
            p = raw[4:].strip()
            if p.startswith('a/'):
                p = p[2:]
            if p != '/dev/null' and not cur.get("file"):
                cur["file"] = p
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

status = e["STATUS"]
summary = e["SUMMARY"]

payload = {
    "promptId": e["PID"], "summary": summary, "filesChanged": files,
    "changes": changes, "diffs": diffs, "status": status,
}
body = json.dumps(payload).encode()

def post(path, data=b""):
    req = urllib.request.Request(base + path, data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    return urllib.request.urlopen(req, timeout=5).read()

# ---- Executive report card (plain markdown, code-rendered) -----------------
# This card IS the conversation-facing executive report for the finished task,
# so it is emitted deterministically here rather than composed by the agent.
# Plain markdown only: renders in any terminal, no ANSI (NO_COLOR is moot).
def md_cell(v):
    # Selector/property/before/after values come from the page and computed CSS,
    # so wrap each in an inline code span: inside code, markdown/HTML metachars
    # (*, _, [], (), <>, etc.) are inert, which neutralizes cell injection. Two
    # chars still need care: a backtick would close the span (replace it), and a
    # pipe breaks a table cell even inside code under GFM (escape it as \|).
    if v is None:
        return ""
    s = str(v).replace("\r", " ").replace("\n", " ").strip()
    if s == "":
        return ""
    s = s.replace("`", "'").replace("|", "\\|")
    return f"`{s}`"

def short_heading(text):
    s = text.strip().split("\n")[0].strip()
    for term in (". ", "! ", "? "):
        i = s.find(term)
        if i != -1:
            s = s[:i]
            break
    s = s.rstrip(".!?").strip()
    words = s.split()
    if len(words) > 8:
        words = words[:8]
        # never end a heading on a dangling connective - trim back to a word
        # that can close a phrase, so truncation reads deliberate
        connectives = {"and", "or", "but", "so", "to", "the", "a", "an",
                       "of", "for", "with", "in", "on", "at", "by", "that"}
        while len(words) > 3 and words[-1].lower().strip(",;:") in connectives:
            words.pop()
        s = " ".join(words).rstrip(",;:")
    return s or "Task complete"

def render_card():
    out = [f"#### {short_heading(summary)}", ""]
    rows = [c for c in changes if isinstance(c, dict)]
    if rows:
        out.append("| Selector | Property | Before | After |")
        out.append("| --- | --- | --- | --- |")
        for c in rows:
            out.append("| {} | {} | {} | {} |".format(
                md_cell(c.get("selector")),
                md_cell(c.get("property")),
                md_cell(c.get("oldValue")),
                md_cell(c.get("newValue")),
            ))
        out.append("")
    body_text = summary.strip()
    if body_text:
        out.append(body_text)
        out.append("")
    if status == "needsInfo":
        out.append("Question sent back to the browser.")
    else:
        n = len(rows)
        noun = "change" if n == 1 else "changes"
        filelist = ", ".join(files) if files else "none"
        out.append(f"{n} {noun} applied. Files: {filelist}. Sent for review.")
    # Diff summary: proves a real per-file diff was captured and is flowing to the
    # panel (which renders the line-by-line view from it). Only shown when a diff
    # was actually parsed, so tasks with no code diff read unchanged.
    if diffs:
        nf = len(diffs)
        adds = dels = 0
        for d in diffs:
            for h in d.get("hunks", []):
                for ln in h.get("lines", []):
                    if ln.get("t") == "+":
                        adds += 1
                    elif ln.get("t") == "-":
                        dels += 1
        fnoun = "file" if nf == 1 else "files"
        out.append(f"Diff: {nf} {fnoun} (+{adds} / -{dels}).")
    return "\n".join(out)

if e.get("JUSTIFY_DRY_RUN", "").strip():
    # Offline path: skip the network calls, just render the card.
    print(render_card())
    raise SystemExit(0)

try:
    post("/respond", body)
    # Issue #3: clear ONLY the task we just answered, by id. A blanket clear
    # erased every prompt that arrived in the queue while this one was being
    # worked - they were silently forgotten. Id-aware clear leaves them queued.
    post("/prompts/clear", json.dumps({"ids": [e["PID"]]}).encode())
    print(render_card())
except Exception as ex:
    print("#### justify - respond failed")
    print("")
    print(f"Could not reach the Justify daemon on port {e['PORT']}: {ex}")
    raise SystemExit(1)
PY
