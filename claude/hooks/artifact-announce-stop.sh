#!/bin/bash
# Stop-event guard: OPEN WHAT YOU ANNOUNCE.
#
# The artifact-open trio (mandate/clear/stop) catches an artifact at CREATION time, but it
# can only harvest an office-doc deliverable when the output path is a LITERAL in the Bash
# command. A deliverable built by running a SCRIPT FILE (python3 build_guide.py) or via a
# variable path escapes harvesting entirely, so the Stop gate never forces it open. That is
# exactly how a 26-page .docx sat CLOSED on the Desktop while the assistant declared done
# (ppai-pm report, 2026-08-20).
#
# This hook closes that blind spot at ANNOUNCE time instead of creation time: it reads the
# assistant's own final message, and if that message tells the user a deliverable is at a
# location ("it's on your desktop", "saved to <path>", "the file is at <path>") while that
# file EXISTS on disk and was NEVER opened/surfaced this session, it BLOCKS the turn and
# tells the assistant to open it. Announcing a file's location is a promise the user will
# see it; a closed file is a broken promise.
#
# Discipline copied from the trio + content-guard-stop.sh:
#   - FIRE ONCE per burst (stop_hook_active) so the turn is never wedged.
#   - FAIL OPEN: any error (bad stdin, missing transcript, parse failure) exits 0 silently.
#   - The disable marker .artifact-surface-disabled turns the whole family off.
#   - It only blocks when a REAL, unopened, non-internal deliverable is named with delivery
#     framing - cue-only or path-only prose never blocks, so false positives are near zero.

STDIN_JSON=$(cat)

# Whole-family disable + loop guard.
[ -f "$HOME/.claude/.artifact-surface-disabled" ] && exit 0
ACTIVE=$(printf '%s' "$STDIN_JSON" | python3 -c "import json,sys
try:
    print('1' if json.load(sys.stdin).get('stop_hook_active') else '0')
except Exception:
    print('0')" 2>/dev/null)
[ "$ACTIVE" = "1" ] && exit 0

TRANSCRIPT=$(printf '%s' "$STDIN_JSON" | python3 -c "import json,sys
try:
    print(json.load(sys.stdin).get('transcript_path',''))
except Exception:
    pass" 2>/dev/null)
[ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ] && exit 0

RESULT=$(TRANSCRIPT_PATH="$TRANSCRIPT" python3 <<'PYEOF' 2>/dev/null
import json, os, re

# Deliverables a human opens in an app. Source-code/config is intentionally out (announcing
# "I updated the script" is not a broken promise to SEE a file).
EXT = r"docx?|xlsx?|pptx?|pdf|od[tsp]|rtf|csv|png|jpe?g|gif|webp|svg|html?"

# DELIVERY FRAMING - the message says a file was PLACED somewhere for the user. Required, but
# never sufficient on its own (a real unopened file must also be extractable).
DELIVERY = re.compile(
    r"(?:on|to|onto)\s+(?:your|the)\s+desktop"
    r"|(?:in|to)\s+(?:your|the)\s+downloads"
    r"|sav(?:e|ed|ing)\s+(?:it\s+|them\s+|the\s+\w+\s+|this\s+)?(?:to|at|as|in)\b"
    r"|wr(?:ote|itten)\s+(?:it\s+)?to\b"
    r"|export(?:ed)?\s+(?:it\s+)?to\b"
    r"|output\s+(?:it\s+)?to\b"
    r"|\bfile\s+is\s+(?:at|on|in|ready|now)\b"
    r"|you(?:'ll|\s+will|\s+can)\s+find\s+(?:it|them)\s+(?:at|on|in)\b"
    r"|(?:created|generated|placed|put|dropped)\b[^.\n]{0,60}?\b(?:at|on|to|in)\b"
    r"|is\s+ready\s+(?:at|on|in)\b"
    r"|(?:available|located|saved)\s+(?:at|on|in)\b"
    r"|download\s+it\b",
    re.I,
)
DESKTOP_CUE = re.compile(r"desktop", re.I)
DOWNLOADS_CUE = re.compile(r"downloads", re.I)

# Explicit absolute or ~ path with a deliverable extension.
# Body length BOUNDED ({1,200}) so the greedy run cannot backtrack superlinearly on long
# slash-heavy text (an unbounded `+` stalls the Stop hook on a huge message). This excludes
# whitespace, so an UNQUOTED absolute path WITH SPACES is not matched here - that is a deliberate
# safe-direction miss: a bare spaced path has no decidable end in prose, and guessing one risks a
# wrong-path resolution or a false block. Quoted/backticked spaced paths ARE caught by QPATH_RE.
PATH_RE = re.compile(r"(~?/[^\s'\"`)>\]}|]{1,200}\.(?:" + EXT + r"))", re.I)
# Quoted or backticked path: the delimiters make the end unambiguous, so spaces inside are safe.
QPATH_RE = re.compile(r"[`\"'](~?/[^`\"'\n]{1,220}\.(?:" + EXT + r"))[`\"']", re.I)
# Bare filename (no dir) - only trusted when a desktop/downloads cue tells us where it is.
# Body length is BOUNDED ({0,120}) and this is only ever run over short cue windows, never the
# whole message: unbounded `*?` here is superlinear on long text and can stall the Stop hook.
FILE_RE = re.compile(r"(?<![\w./~-])([A-Za-z0-9][\w .-]{0,120}?\.(?:" + EXT + r"))(?![\w/])", re.I)

# Internal locations that are never a "show the user" deliverable, even if announced.
EXCLUDE = re.compile(
    r"(^|/)\.(claude|design|git|next)(/|$)|(^|/)(node_modules|dist|build|coverage)/", re.I
)
EXCLUDED_BASENAMES = {
    "tasks.md", "memory.md", "claude.md", "readme.md", "changelog.md",
    "product.md", "design.md",
}

def canon(p):
    return os.path.normpath(os.path.expanduser(p))

def is_deliverable(cp):
    if EXCLUDE.search(cp):
        return False
    if os.path.basename(cp).lower() in EXCLUDED_BASENAMES:
        return False
    return os.path.isfile(cp)

# Bash `open <path>` detection, using artifact-open-clear.sh's HARDENED whole-command anchor:
# a flag/path token may contain NO whitespace and NO shell metacharacter, so a chained or
# substituted command (open --x;true /f  |  open "$(...)") cannot be credited as an open.
_OPEN_BAD = ";&|<>$(){}[]*?" + chr(92) + chr(96) + chr(34) + chr(39)
_OPEN_SAFE = "[^\\s" + re.escape(_OPEN_BAD) + "]"
_OPEN_QSAFE = "[^\"$" + chr(96) + "]"
OPEN_RE = re.compile(
    "^\\s*(?:open|xdg-open|start)\\b(?:\\s+-{1,2}" + _OPEN_SAFE + "+)*\\s+"
    "(?:\"(" + _OPEN_QSAFE + "+)\"|(" + _OPEN_SAFE + "+))\\s*$")

# PRESENTED = paths actually shown to the USER: an `open` in its app, or an Artifact publish.
# A Read is deliberately NOT a discharge here - Rule 11 draws exactly that line (a Read is a
# verification render for the assistant; opening the file is for the user), and it also avoids
# crediting a FAILED Read that surfaced nothing.
surfaced = set()   # canonical paths PROVEN presented this session (success-checked)
last_asst = ""     # text of the FINAL assistant message (the announcement candidate)
pending = {}       # tool_use_id -> canonical path, for each open/publish ATTEMPT
errored = {}       # tool_use_id -> bool, from the matching tool_result

try:
    with open(os.environ["TRANSCRIPT_PATH"]) as f:
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            typ = e.get("type")
            content = e.get("message", {}).get("content", [])
            if not isinstance(content, list):
                continue
            if typ == "assistant":
                text = "\n".join(
                    b.get("text", "") for b in content
                    if isinstance(b, dict) and b.get("type") == "text"
                )
                if text.strip():
                    last_asst = text
                # An Artifact publish, or a bare `open <path>` Bash, is a presentation ATTEMPT.
                # Record it by tool_use_id; whether it actually surfaced depends on its result.
                for b in content:
                    if not (isinstance(b, dict) and b.get("type") == "tool_use"):
                        continue
                    tid = b.get("id", "")
                    name = b.get("name", "")
                    inp = b.get("input", {}) or {}
                    p = ""
                    if name == "Artifact":
                        fp = inp.get("file_path", "")
                        if isinstance(fp, str) and fp:
                            p = canon(fp)
                    elif name == "Bash":
                        cmd = inp.get("command", "")
                        if isinstance(cmd, str):
                            m = OPEN_RE.match(cmd.strip())
                            if m:
                                g = m.group(1) or m.group(2) or ""
                                if g:
                                    p = canon(g)
                    if p and tid:
                        pending[tid] = p
            elif typ == "user":
                # tool_result carries is_error for the tool_use it answers.
                for b in content:
                    if isinstance(b, dict) and b.get("type") == "tool_result":
                        tid = b.get("tool_use_id", "")
                        if tid:
                            errored[tid] = bool(b.get("is_error"))
except Exception:
    last_asst = ""

# A presentation counts only if its result was NOT an explicit error. A FAILED open/publish
# (is_error True) does not surface the file. A missing result - which should not occur at Stop,
# since the turn has ended - credits the attempt, to avoid over-blocking a real open we could
# not correlate (the fire-once block already makes an over-block recoverable).
for _tid, _p in pending.items():
    if errored.get(_tid) is not True:
        surfaced.add(_p)

reason = ""
# A file only counts as ANNOUNCED when it sits NEAR a delivery cue - not merely somewhere in
# a message that also contains a cue. This stops "I built the report by comparing it to
# /Desktop/reference.pdf" (cue "built ... to" + an unrelated input path) from blocking the
# reference. WINDOW is the max gap, in chars, between a cue and the file, in either order.
WINDOW = 90
cue_spans = [m.span() for m in DELIVERY.finditer(last_asst)] if last_asst else []

def near_cue(a, b):
    for cs, ce in cue_spans:
        if a - ce <= WINDOW and cs - b <= WINDOW:
            return True
    return False

if cue_spans:
    cands = []
    # Explicit paths carry their own folder; scan the whole message (both regexes are bounded,
    # not superlinear) and keep only those NEAR a cue. QPATH_RE additionally catches a quoted
    # path with spaces.
    for m in PATH_RE.finditer(last_asst):
        if near_cue(*m.span()):
            cands.append(m.group(1))
    for m in QPATH_RE.finditer(last_asst):
        if near_cue(*m.span()):
            cands.append(m.group(1))
    # Bare filenames resolve only when a known folder is named. Run the (heavier) FILE_RE ONLY
    # inside each bounded cue window - that both binds proximity AND keeps the scan linear in the
    # message length regardless of how long the message is.
    for cs, ce in cue_spans:
        w = last_asst[max(0, cs - WINDOW):min(len(last_asst), ce + WINDOW)]
        wl = w.lower()
        if "desktop" in wl:
            for m in FILE_RE.finditer(w):
                cands.append("~/Desktop/" + m.group(1))
        if "downloads" in wl:
            for m in FILE_RE.finditer(w):
                cands.append("~/Downloads/" + m.group(1))
    seen = set()
    for raw in cands:
        cp = canon(raw)
        if cp in seen:
            continue
        seen.add(cp)
        if is_deliverable(cp) and cp not in surfaced:
            reason = cp
            break

print(reason)
PYEOF
)

[ -z "$RESULT" ] && exit 0

REASON="$RESULT" python3 -c "import json, os
p = os.environ['REASON']
print(json.dumps({
    'decision': 'block',
    'reason': (
        'BLOCKED: your message tells the user a deliverable is at ' + p + ', but you never '
        'opened it this session - it is sitting closed where they have to dig it up. '
        'Announcing a file location is a promise the user will SEE it; a closed file breaks '
        'that promise. Open it now in its app (run: open \"' + p + '\") so it is actually on '
        'screen, then end the turn. Verification renders you Read are for YOU; opening the '
        'real file is for the USER. If it genuinely must stay closed, say so explicitly.'
    )
}))"
exit 0
