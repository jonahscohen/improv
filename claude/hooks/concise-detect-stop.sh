#!/usr/bin/env bash
#
# concise-detect-stop.sh - Stop hook. Mechanical enforcement for concise mode.
#
# concise-mandate.sh injects the brevity ruleset at SessionStart. Measured result
# (2026-07-26, from this harness's own transcripts): the ruleset reliably shapes
# STRUCTURE (verdict first, numbered steps, closing action) but does NOT control
# VOLUME. Two drift modes were observed in real output:
#
#   1. POST-CONCLUSION TANGENT. The response reaches its closing action line, then
#      appends a new subject the user never asked about. Real openers pulled from
#      the transcript: "Two side notes from the same check:", "Still unconfirmed:",
#      "Separately,", "One loose end holds up teardown". This breaks ruleset rule 3
#      (the response ENDS at the next-action line) and rule 4 (finish the current
#      thread before raising tangents).
#   2. ITEM-CAP SATURATION. Lists run past the cap because the cap reads as a
#      target. Rule 7: five is a ceiling, not a target.
#
# WHAT THIS HOOK DELIBERATELY DOES NOT DO: gate on word or token count. A length
# gate false-fires on every legitimate deep dive, and that failure mode is already
# documented in this repo - the visual-verification gate earned four distinct
# false-fire classes by classifying too broadly (session_2026-07-26_visual-gate-
# narrowed.md). Both detections here are STRUCTURAL and narrow: a named opener in a
# trailing block, or a countable list overrun. Prose that is merely long passes.
#
# ANTI-LOOP (a Stop hook that blocks on prose shape can deadlock a session):
#   Layer 1  stop_hook_active - never block a stop that is already a hook continuation.
#   Layer 2  once-per-burst flag keyed by session id. If it exists we ALLOW, no
#            matter what we detected. It is cleared only by a CLEAN stop, so at most
#            one block lands per violation burst and a second block can never
#            immediately follow the first.
#   Layer 3  atomic claim (noclobber) on the flag, so two concurrent Stop processes
#            cannot both block.
#   Layer 4  every failure path exits 0 (fail-open) via the EXIT trap below.
# When in doubt this hook ALLOWS. A missed violation costs one verbose paragraph;
# a block loop costs the session.
#
# SKIPS ENTIRELY when: concise mode is off (~/.claude/.concise-disabled), the user's
# last prompt asked for depth (the ruleset's own override conditions), or the
# response is predominantly code / file content / command output.
#
# The opener lexicon lives INLINE below (TANGENT_OPENER_RE). It is not a sibling
# data file on purpose: the grounding cluster deploys .sh files only, so a .txt
# lexicon would install inert on any other machine - the same trap that forced the
# concise ruleset itself to be inlined.

set -euo pipefail
# Fail-open, always. The block signal for a Stop hook is the stdout JSON decision,
# never the exit code, so forcing exit 0 on every path (including a strict-mode
# abort) cannot suppress a legitimate block - it can only prevent a hook error.
trap 'exit 0' EXIT

LOG_FILE="$HOME/.claude/.concise-blocks.log"

STDIN_JSON=$(cat)

# Layer 1: never block a stop that is itself a hook continuation.
ACTIVE=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, sys
try:
    print("1" if json.load(sys.stdin).get("stop_hook_active") else "0")
except Exception:
    print("0")
' 2>/dev/null || echo 0)
[ "$ACTIVE" = "1" ] && exit 0

# Concise mode off -> this gate has nothing to enforce.
[ -f "$HOME/.claude/.concise-disabled" ] && exit 0

SESSION_KEY=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, re, sys
try:
    s = str(json.load(sys.stdin).get("session_id", ""))
except Exception:
    s = ""
s = re.sub(r"[^A-Za-z0-9._-]", "_", s)
print(s if s not in ("", ".", "..") else "global")
' 2>/dev/null || echo global)
[ -z "$SESSION_KEY" ] && SESSION_KEY=global

BLOCKED_FLAG="$HOME/.claude/.concise-stop-blocked.$SESSION_KEY"

# Reap flags older than 24h so an abandoned session cannot mute (or ambush) a future one.
find "$HOME/.claude" -maxdepth 1 -name '.concise-stop-blocked.*' -type f -mtime +1 -delete 2>/dev/null || true

TRANSCRIPT=$(printf '%s' "$STDIN_JSON" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("transcript_path", "") or "")
except Exception:
    pass
' 2>/dev/null || true)
[ -z "$TRANSCRIPT" ] && exit 0
[ -f "$TRANSCRIPT" ] || exit 0

# ---------------------------------------------------------------------------
# Detection. Emits three lines: SKIP=<reason|empty>, TANGENT=<opener|empty>,
# LIST=<count>. Any parse failure prints nothing, which bash reads as "skip".
# ---------------------------------------------------------------------------
DETECT=$(TRANSCRIPT_PATH="$TRANSCRIPT" python3 <<'PYEOF' 2>/dev/null || true
import json, os, re, sys

# --- TUNABLE LEXICON --------------------------------------------------------
# Line-opening phrases that introduce a NEW subject. Every entry was taken from
# observed drift or is a direct sibling of one. Anchored at line start, so the same
# words mid-sentence ("we also fixed the test") never match.
TANGENT_OPENER_RE = re.compile(r"""^\s*(?:[*_]{1,2})?(
      also\b
    | separately\b
    | meanwhile\b
    | unrelated\b
    | incidentally\b
    | one\s+more\s+thing\b
    | one\s+other\s+thing\b
    | one\s+last\s+thing\b
    | (?:a|one|two|three|a\s+few|some|several)?\s*(?:quick\s+)?side\s+notes?\b
    | (?:two|three|a\s+few|several|some)\s+(?:other\s+|further\s+|additional\s+)?(?:notes|things|asides|caveats)\b
    | still\s+(?:unconfirmed|open|outstanding|pending|unresolved)\b
    | (?:one|a)\s+loose\s+end\b
    | (?:also\s+)?worth\s+noting\b
    | for\s+the\s+record\b
    | p\.?\s?s\.?[\s:,-]
    | as\s+an\s+aside\b
    | on\s+(?:another|a\s+separate)\s+note\b
    | while\s+i(?:'m|\s+am)\s+(?:here|at\s+it)\b
)""", re.IGNORECASE | re.VERBOSE)

# Phrases in the user's LAST prompt that invoke the ruleset's own depth override.
DEPTH_REQUEST_RE = re.compile(r"""(
      \bexplain\b | \bexplanation\b | \bgo\s+deep\b | \bdeep\s+dive\b
    | \bverbose\b | \bwalk\s+me\s+through\b | \bin\s+detail\b | \bmore\s+detail\b
    | \bfull\s+(?:breakdown|detail|explanation|writeup|write-up)\b
    | \bwhy\s+exactly\b | \belaborate\b | \bstep\s+by\s+step\b
    | \bthorough\b | \bcomprehensive\b | \bat\s+length\b | \blong[-\s]form\b
    | \bdon'?t\s+(?:be\s+)?(?:brief|concise|terse)\b
)""", re.IGNORECASE | re.VERBOSE)

ITEM_RE = re.compile(r"^(\s*)(?:\d+[.)]|[-*+])\s+\S")
FENCE_RE = re.compile(r"(?ms)^[ \t]{0,3}(?:```|~~~).*?(?:^[ \t]{0,3}(?:```|~~~)[ \t]*$|\Z)")


def emit(skip="", tangent="", list_count=0, words=0, sections=0):
    print("SKIP=" + skip.replace("\n", " "))
    print("TANGENT=" + tangent.replace("\n", " ")[:120])
    print("LIST=" + str(list_count))
    print("WORDS=" + str(words))
    print("SECTIONS=" + str(sections))
    sys.exit(0)


def block_text(blocks):
    if not isinstance(blocks, list):
        return ""
    return "\n".join(
        b.get("text", "") for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    )


last_assistant = ""
user_texts = []
# Parse-failure bookkeeping (Codex 2026-07-26, High). An unparseable line is not
# uniformly fatal - transcripts carry records this hook does not model, and one
# corrupt line early must not disable the gate forever. What IS fatal is a parse
# failure AFTER the assistant turn we are about to judge: that means the final
# response may be truncated or missing, so we would be grading the wrong text.
last_ok_assistant_line = -1
last_bad_line = -1
line_no = 0
try:
    with open(os.environ["TRANSCRIPT_PATH"], errors="replace") as f:
        for line in f:
            line_no += 1
            try:
                e = json.loads(line)
            except Exception:
                if line.strip():
                    last_bad_line = line_no
                continue
            if not isinstance(e, dict):
                continue
            # A sidechain entry is a subagent's turn, not this session's response.
            # Judging the lead's stop by a teammate's prose would be a false fire.
            if e.get("isSidechain"):
                continue
            msg = e.get("message", {})
            if not isinstance(msg, dict):
                continue
            content = msg.get("content", [])
            if e.get("type") == "assistant":
                text = block_text(content)
                if text.strip():
                    last_assistant = text
                    last_ok_assistant_line = line_no
            elif e.get("type") == "user":
                # A real prompt is a string or carries text blocks. A tool_result
                # echo has neither, so it never counts as the user's last word.
                text = content if isinstance(content, str) else block_text(content)
                if text.strip():
                    user_texts.append(text)
except Exception:
    emit(skip="unreadable-transcript")

if not last_assistant.strip():
    emit(skip="no-assistant-text")

if last_bad_line > last_ok_assistant_line:
    emit(skip="unparseable-line-after-response")

# The last TWO user texts, not just one: a UserPromptSubmit hook's injected
# context can land as its own user entry after the real prompt, and losing sight
# of the prompt would cost the depth override. Over-skipping is the safe direction.
if DEPTH_REQUEST_RE.search("\n".join(user_texts[-2:])):
    emit(skip="user-asked-for-depth")

# "Predominantly code" counts BOTH fence styles: a ``` block and a markdown
# indented block (4+ spaces), which is how pasted command output usually arrives
# (Codex 2026-07-26, Medium - an indented output dump was reaching list counting).
total_chars = len(last_assistant)
fenced_chars = sum(len(m.group(0)) for m in FENCE_RE.finditer(last_assistant))
unfenced = FENCE_RE.sub("", last_assistant)
indented_chars = sum(
    len(ln) + 1 for ln in unfenced.split("\n")
    if ln.strip() and len(ln[:len(ln) - len(ln.lstrip())].expandtabs(4)) >= 4
)
if total_chars and (fenced_chars + indented_chars) * 2 >= total_chars:
    emit(skip="predominantly-code")

# Prose view: fenced code and quoted material are not the response's own prose.
prose = FENCE_RE.sub("", last_assistant)
lines = [ln for ln in prose.split("\n") if not ln.lstrip().startswith(">")]
nonempty = [i for i, ln in enumerate(lines) if ln.strip()]
# This used to skip on line count alone, which exempted the single worst shape:
# one unbroken paragraph of any length. A 480-word wall of text is exactly one
# non-empty line and was waved through as "too little prose" (found 2026-07-31
# while testing the volume gate). The skip is meant for a genuinely short answer,
# so it now needs BOTH: too few lines to analyse AND too few words to matter.
if len(nonempty) < 2 and len(prose.split()) < 40:
    emit(skip="too-little-prose")


def sentence_count(text):
    """Sentences in a block. A list item or fragment with 3+ words counts as one."""
    n = 0
    for raw in text.split("\n"):
        s = re.sub(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)", "", raw).strip()
        if not s:
            continue
        n += len(re.findall(r"[^.!?]+[.!?]", s))
        tail = re.sub(r"^.*[.!?]", "", s).strip()
        if len(tail.split()) >= 3:
            n += 1
    return n


# --- Detection 1: post-conclusion tangent ----------------------------------
# Three conditions must ALL hold, and their conjunction is what keeps a normal
# answer clean:
#   LEXICON  the line opens with a named new-subject opener.
#   POSITION the opener sits in the trailing half of the response and has a real
#            body (3+ non-empty lines) ahead of it - i.e. it follows a conclusion
#            rather than being part of the answer's own opening.
#   VOLUME   2+ sentences follow from that opener to the end. A single trailing
#            sentence is a clause, not a tangent, and is left alone.
tangent = ""
for rank, idx in enumerate(nonempty):
    if not TANGENT_OPENER_RE.match(lines[idx]):
        continue
    if rank < 3:
        continue
    if rank * 2 < len(nonempty):
        continue
    if sentence_count("\n".join(lines[idx:])) >= 2:
        tangent = lines[idx].strip()
        break

# --- Detection 2: over-cap list --------------------------------------------
# Longest run of items at ONE indent level. Blank lines and deeper-indented
# continuation text keep a run open; any line at or left of the run's indent
# closes it, so two separate 4-item lists never sum to 8.
open_runs = {}
worst = 0
for ln in lines:
    if not ln.strip():
        continue
    m = ITEM_RE.match(ln)
    if m:
        indent = len(m.group(1).expandtabs(4))
        # An item-shaped line 4+ spaces in with NO shallower list open is not a
        # list level at all - in markdown that is an indented code block, i.e.
        # pasted output whose lines happen to start with "-" (Codex, Medium).
        if indent >= 4 and not any(k < indent for k in open_runs):
            continue
        for k in [k for k in open_runs if k > indent]:
            del open_runs[k]
        open_runs[indent] = open_runs.get(indent, 0) + 1
        if open_runs[indent] > worst:
            worst = open_runs[indent]
    else:
        indent = len(ln[:len(ln) - len(ln.lstrip())].expandtabs(4))
        open_runs = {k: v for k, v in open_runs.items() if k < indent}

# --- Detection 3: volume -----------------------------------------------------
# Added 2026-07-31 after Jonah: "modify the conciseness guard to actually work."
# MEASURED on 232 real assistant responses from this session's own transcript: the
# two structural detections above fired on 13 (5.6%), while 94 (40.5%) were long
# multi-section answers. The lexicon can only ever catch a tangent that opens with
# one of its named phrases, and the observed drift mostly does not.
#
# The header above says a length gate is deliberately absent because it false-fires
# on legitimate deep dives. That reasoning still stands, and it is why this gate is
# NOT a raw length check: it sits BEHIND the same user-asked-for-depth skip as
# everything else (emit(skip="user-asked-for-depth") above returns before this
# runs), and its thresholds were chosen from the measured distribution rather than
# picked. Reversing a documented decision is worth stating plainly: the decision was
# right about raw length and wrong about leaving volume unguarded entirely.
#
# Distribution over those 232 responses, prose only (code fences and table rows
# excluded, since neither is prose the reader has to wade through):
#   p50 191 words | p75 269 | p90 313 | p99 362 | max 397
#   3+ bold-led sections: 11 responses (4.7%)
# Chosen: words > 300 OR sections >= 3, which fires on 36 (15.5%) - roughly triple
# the current coverage, all of it in the genuine long tail, and well short of the
# 40% band that would start catching ordinary answers.
#
# Both thresholds are tunable, same pattern as CHROME_TABGROUP_IDLE_SECONDS.
WORD_CAP = int(os.environ.get("CONCISE_WORD_CAP", "300"))
SECTION_CAP = int(os.environ.get("CONCISE_SECTION_CAP", "3"))

# Table rows are data, not prose - a wide comparison table is the concise way to
# present numbers and must never be what trips a verbosity gate.
prose_only = "\n".join(ln for ln in lines if not re.match(r"^\s*\|", ln))
word_count = len(prose_only.split())
sections = len([
    p for p in prose_only.split("\n\n")
    if p.strip().startswith("**")
])

emit(
    tangent=tangent,
    list_count=(worst if worst > 5 else 0),
    words=(word_count if word_count > WORD_CAP else 0),
    sections=(sections if sections >= SECTION_CAP else 0),
)
PYEOF
)

# No output at all -> detection failed -> allow.
[ -z "${DETECT:-}" ] && exit 0

field() { printf '%s\n' "$DETECT" | grep "^$1=" | head -1 | cut -d= -f2-; }

SKIP_REASON=$(field SKIP || true)
TANGENT=$(field TANGENT || true)
LIST_COUNT=$(field LIST || true)
case "$LIST_COUNT" in ''|*[!0-9]*) LIST_COUNT=0 ;; esac
WORD_COUNT=$(field WORDS || true)
case "$WORD_COUNT" in ''|*[!0-9]*) WORD_COUNT=0 ;; esac
SECTION_COUNT=$(field SECTIONS || true)
case "$SECTION_COUNT" in ''|*[!0-9]*) SECTION_COUNT=0 ;; esac

[ -n "$SKIP_REASON" ] && exit 0

# Clean stop -> re-arm the gate for the next burst.
if [ -z "$TANGENT" ] && [ "$LIST_COUNT" -eq 0 ] && [ "$WORD_COUNT" -eq 0 ] && [ "$SECTION_COUNT" -eq 0 ]; then
  rm -f "$BLOCKED_FLAG" 2>/dev/null || true
  exit 0
fi

# Layer 2: a block already landed in this burst. Allow, and keep the flag - the
# gate stays quiet until a clean stop re-arms it. Never two blocks in a row.
[ -f "$BLOCKED_FLAG" ] && exit 0

# Layer 3: atomic claim. Exactly one concurrent Stop can create the flag.
mkdir -p "$HOME/.claude" 2>/dev/null || true
if ! (set -o noclobber; : > "$BLOCKED_FLAG") 2>/dev/null; then
  exit 0
fi

REASON="BLOCKED (concise mode)."
if [ -n "$TANGENT" ]; then
  REASON="$REASON Rule 3 (the response ENDS at the next-action line) and rule 4 (finish the current thread before raising tangents): your response continued past its closing line with a new subject opening \"$TANGENT\"."
fi
if [ "$LIST_COUNT" -gt 0 ]; then
  REASON="$REASON Rule 7 (five is a ceiling, not a target): $LIST_COUNT items at one list level - cut to what changes the reader's next move, or split into priority tiers."
fi
if [ "$WORD_COUNT" -gt 0 ]; then
  REASON="$REASON Rule 10 (prefer short - if a sentence can go, cut it): $WORD_COUNT words of prose, against a median of about 190 for this harness. Code blocks and tables are already excluded from that count, so this is prose the reader has to wade through. Lead with the answer and cut the supporting narration."
fi
if [ "$SECTION_COUNT" -gt 0 ]; then
  REASON="$REASON Rule 4 (finish the current thread before raising tangents): $SECTION_COUNT bold-led sections - that is a briefing, not an answer. Keep the section that answers what was asked and drop the rest, or hold them until the user asks."
fi
REASON="$REASON Re-send your previous message with that removed - the trimmed answer only, nothing added. If the cut material matters, hold it until the user asks. Do not comment on this block. This gate fires once, then stays quiet until a clean response."

mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
printf '%s  CONCISE-BLOCK  tangent=%s list=%s  session=%s\n' \
  "$(date '+%Y-%m-%d %H:%M:%S')" "${TANGENT:-none}" "$LIST_COUNT" "$SESSION_KEY" >> "$LOG_FILE" 2>/dev/null || true

REASON="$REASON" python3 -c '
import json, os
print(json.dumps({"decision": "block", "reason": os.environ["REASON"]}))
'
exit 0
