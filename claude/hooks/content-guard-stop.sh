#!/bin/bash
# Stop-event guard for assistant PROSE.
#
# content-guard.sh (PreToolUse on Write|Edit|MultiEdit) only ever sees file
# content. Conversational output to the terminal is not a tool call, so it passes
# through NO PreToolUse gate -- that is the blind spot through which emojis reached
# the user's terminal on 2026-06-17. This hook closes it by scanning the last
# assistant message in the transcript for the same forbidden characters CLAUDE.md
# bans on disk: emojis and emdashes ("we're professionals").
#
# Claude Code has no PreResponse event, so detection is necessarily post-hoc (the
# text is already on screen). Enforcement is two-pronged:
#   1. Immediate: emit a Stop "block" decision so Claude must re-send the message
#      cleaned, in the same turn. stop_hook_active is honored to avoid a loop.
#   2. Durable: write a violation flag + append to a log for visibility.
#
# Scope: only emoji + emdash/endash are checked here -- NOT attribution lines or
# legacy model IDs -- because those have legitimate discussion contexts in prose
# (e.g. quoting the CLAUDE.md rule that bans old model names). File writes still
# get the full set via content-guard.sh.
#
# All forbidden characters are matched by CODEPOINT (no literal glyphs in this
# file), both for clarity and so the file itself passes content-guard.
# KEEP the emoji ranges IN SYNC with content-guard.sh.

LOG_FILE="$HOME/.claude/.content-guard-blocks.log"
VIOLATION_FLAG="$HOME/.claude/.content-guard-violation"

STDIN_JSON=$(cat)

# Loop guard: if we already blocked this stop-cycle, do not block again.
ACTIVE=$(printf '%s' "$STDIN_JSON" | python3 -c "import json,sys
try:
    print('1' if json.load(sys.stdin).get('stop_hook_active') else '0')
except Exception:
    print('0')" 2>/dev/null)
[[ "$ACTIVE" == "1" ]] && exit 0

TRANSCRIPT=$(printf '%s' "$STDIN_JSON" | python3 -c "import json,sys
try:
    print(json.load(sys.stdin).get('transcript_path',''))
except Exception:
    pass" 2>/dev/null)
[[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]] && exit 0

# Extract the last assistant text message and run detection in one pass.
RESULT=$(TRANSCRIPT_PATH="$TRANSCRIPT" python3 <<'PYEOF' 2>/dev/null
import json, os

# Emoji by EMOJI-PRESENTATION, not by block: terminal typography (check U+2713,
# ballot-x U+2717, stars, arrows, box-drawing, dingbat asterisks) is allowed; only
# genuine color pictographs are flagged - supplementary planes, a VS16 (U+FE0F) or
# keycap (U+20E3), or the BMP Emoji_Presentation=Yes set. KEEP IN SYNC with content-guard.sh.
_EMOJI_PRES = (
    (0x231A, 0x231B), (0x23E9, 0x23EC), (0x23F0, 0x23F0), (0x23F3, 0x23F3),
    (0x25FD, 0x25FE), (0x2614, 0x2615), (0x2648, 0x2653), (0x267F, 0x267F),
    (0x2693, 0x2693), (0x26A1, 0x26A1), (0x26AA, 0x26AB), (0x26BD, 0x26BE),
    (0x26C4, 0x26C5), (0x26CE, 0x26CE), (0x26D4, 0x26D4), (0x26EA, 0x26EA),
    (0x26F2, 0x26F3), (0x26F5, 0x26F5), (0x26FA, 0x26FA), (0x26FD, 0x26FD),
    (0x2705, 0x2705), (0x270A, 0x270B), (0x2728, 0x2728), (0x274C, 0x274C),
    (0x274E, 0x274E), (0x2753, 0x2755), (0x2757, 0x2757), (0x2795, 0x2797),
    (0x27B0, 0x27B0), (0x27BF, 0x27BF), (0x2B1B, 0x2B1C), (0x2B50, 0x2B50),
    (0x2B55, 0x2B55),
)

def violation(s):
    for ch in s:
        cp = ord(ch)
        if cp == 0x2014 or cp == 0x2013:          # emdash, endash
            return ("Emdash/endash", ch)
        if cp == 0xFE0F or cp == 0x20E3:          # VS16 / combining keycap -> emoji
            return ("Emoji", ch)
        if 0x1F000 <= cp <= 0x1FAFF:              # supplementary emoji planes
            return ("Emoji", ch)
        for lo, hi in _EMOJI_PRES:
            if lo <= cp <= hi:
                return ("Emoji", ch)
    return (None, None)

last = ""
try:
    with open(os.environ["TRANSCRIPT_PATH"]) as f:
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("type") != "assistant":
                continue
            content = e.get("message", {}).get("content", [])
            if not isinstance(content, list):
                continue
            text = "\n".join(
                b.get("text", "") for b in content
                if isinstance(b, dict) and b.get("type") == "text"
            )
            if text.strip():
                last = text
except Exception:
    pass

kind, bad = violation(last)
reason = ""
if kind:
    reason = kind + " (" + repr(bad) + ") in assistant prose"
print(reason)
PYEOF
)

[[ -z "$RESULT" ]] && exit 0

mkdir -p "$(dirname "$LOG_FILE")"
echo "$(date '+%Y-%m-%d %H:%M:%S')  PROSE-BLOCK  $RESULT" >> "$LOG_FILE"
printf 'reason=%s\ntimestamp=%s\n' "$RESULT" "$(date '+%Y-%m-%d %H:%M:%S')" > "$VIOLATION_FLAG"

# Block the stop so Claude re-sends the message cleaned, immediately.
REASON="$RESULT" python3 -c "import json, os
print(json.dumps({
    'decision': 'block',
    'reason': 'BLOCKED (' + os.environ['REASON'] + '). CLAUDE.md forbids emojis and emdashes - we are professionals. Re-send your entire previous message verbatim with the offending character removed or rewritten in plain ASCII (use a hyphen instead of a dash). Do not add any commentary about this block.'
}))"
exit 0
