#!/bin/bash
# Hook: Stop-event detector for multiple-choice deflection.
# Reads the last assistant message from the transcript_path supplied in stdin JSON.
# On detection, writes ~/.claude/.multiple-choice-violation with the matched line(s).
# UserPromptSubmit handler `multiple-choice-inject-prompt.sh` reads that flag on the
# next turn and injects a screaming reminder into the response context.
#
# Why Stop instead of PreResponse: Claude Code's hook taxonomy has no PreResponse
# event. Stop is the only event with access to the just-completed assistant text.
# This means detection is post-hoc; the bad response is already shown to the user.
# The injection-on-next-turn loop is the enforcement.
#
# 2026-05-27 (T-0005 hardening): three false-fire patterns documented:
#   (a) Binary "X or Y?" questions fired as deflections (Discord routing case).
#   (b) Numbered fact lists with no trailing question (Peekaboo capabilities,
#       audit-findings list) fired because option_count >= 2 alone triggered block.
#   (c) Numbered fact list + a tangential binary trailing question ("Want me to
#       queue any?") fired because trailing_deflection counted a yes/no as a
#       choice prompt.
# Fix: precondition `opt_count >= 3 AND (trailing_q == 1 OR trailing_deflection == 1)`
# guards the numbered/vocabulary path; bold_label_count >= 2 stays as an
# independent strong-signal override (preserves the original Failure 2 catch).
# Trailing-question detection now requires a `?` within ~250 chars of the last
# list item AND that question must not match the binary opener / "X or Y?" shape.
#
# 2026-07-12 (MANDATE CHANGE - Jonah): the binary exemption from T-0005(a)/(c) is
# REVOKED. Every question posed to the user must go through AskUserQuestion, and a
# yes/no is now a 2-option AskUserQuestion. A fire on a plain-text binary is
# INTENDED, not a false positive.
# New layer L6 (direct_question): fires on a plain-text question POSED TO THE USER,
# binary included, with no option list required. Two conditions must BOTH hold, and
# that conjunction is what keeps rhetorical prose and fact lists clean:
#   POSITION - the question sits in the trailing region (last 5 non-empty lines).
#              A rhetorical question the prose then answers is not there.
#   SHAPE    - the question is USER-DIRECTED: addresses the user ("you"), asks
#              permission for the agent's next action ("Should I", "Want me to",
#              "Should we"), seeks confirmation ("Sound good?"), poses a this-or-that
#              ("Ship now or wait?"), or prompts a pick ("Which one?"). A bare
#              interrogative with none of those markers ("Why did it break?", "What
#              changed?") is rhetorical prose and does NOT fire.
# The T-0005(b) carve-out SURVIVES intact: a factual enumeration with no trailing
# question has no "?" in the trailing region, so L6 cannot fire on it.
# This detection block is kept BYTE-FOR-BYTE in parity with its twin in
# multiple-choice-enforce.sh. Any divergence is a bug; test-multiple-choice-enforce.sh
# exercises both.

LOG_FILE="$HOME/.claude/.multiple-choice-blocks.log"

# Read stdin JSON (Claude Code passes session_id, transcript_path, cwd, hook_event_name).
STDIN_JSON=$(cat)

# The violation flag MUST be keyed per session. It used to be one global file at
# $HOME/.claude/.multiple-choice-violation, shared by every concurrent session on
# this machine. Two failures followed, both observed live 2026-07-10:
#   1. MISATTRIBUTION - whichever session submitted the next prompt was shown
#      another session's words and told "Do NOT continue with the work you were
#      doing". A watch owner was ordered to abandon a live watch on a false pretext.
#   2. SILENT NON-ENFORCEMENT - the injector rm -f's the flag, so the session that
#      actually violated never sees its own reminder. The mechanism built to stop
#      us silently skipping a rule silently skipped the rule.
# Fall back to the global path only when session_id is genuinely absent, so a
# single-session install cannot regress.
SESSION_ID=$(printf '%s' "$STDIN_JSON" | python3 -c "
import json, sys
try:
    print(json.load(sys.stdin).get('session_id', '') or '')
except Exception:
    pass
" 2>/dev/null)
SESSION_KEY=$(printf '%s' "$SESSION_ID" | tr -cd 'A-Za-z0-9._-')
case "$SESSION_KEY" in
  ""|"."|"..") SESSION_KEY="" ;;
esac
CWD_VAL=$(printf '%s' "$STDIN_JSON" | python3 -c "
import json, sys
try:
    print(json.load(sys.stdin).get('cwd', '') or '')
except Exception:
    pass
" 2>/dev/null)

if [[ -n "$SESSION_KEY" ]]; then
  VIOLATION_FLAG="$HOME/.claude/.multiple-choice-violation.$SESSION_KEY"
else
  VIOLATION_FLAG="$HOME/.claude/.multiple-choice-violation"
fi

# Reap flags older than 24h so an abandoned session cannot ambush a future one.
find "$HOME/.claude" -maxdepth 1 -name '.multiple-choice-violation*' -type f -mtime +1 -delete 2>/dev/null

# Extract transcript_path with python (no jq dependency).
TRANSCRIPT=$(printf '%s' "$STDIN_JSON" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('transcript_path', ''))
except Exception:
    pass
" 2>/dev/null)

[[ -z "$TRANSCRIPT" ]] && exit 0
[[ ! -f "$TRANSCRIPT" ]] && exit 0

# Extract the LAST assistant message text content from the transcript jsonl.
# Each line is a JSON event; assistant messages have type=assistant and message.content
# which is an array of content blocks. We want the concatenated text from text blocks.
ASSISTANT_TEXT=$(python3 <<PYEOF 2>/dev/null
import json, sys
try:
    with open("$TRANSCRIPT") as f:
        last_text = ""
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("type") != "assistant":
                continue
            msg = e.get("message", {})
            content = msg.get("content", [])
            if not isinstance(content, list):
                continue
            texts = []
            for block in content:
                if isinstance(block, dict) and block.get("type") == "text":
                    texts.append(block.get("text", ""))
            joined = "\n".join(t for t in texts if t)
            if joined.strip():
                last_text = joined
        print(last_text)
except Exception:
    pass
PYEOF
)

# If no assistant text could be extracted, nothing to check.
[[ -z "$ASSISTANT_TEXT" ]] && exit 0

# Detection layers (same patterns as the original morning hardening, applied
# post-hoc against actual assistant text instead of phantom RESPONSE_TEXT).

OPTION_PATTERNS=(
  "^[[:space:]]*\*?\*?(Option|Approach|Path|Plan|Choice|Alternative|Strategy|Way|Route|Step)[[:space:]]+([A-Z]|[0-9]+)[[:space:]]*[:.-]"
  "^[[:space:]]*[0-9]+\.[[:space:]]+"
  "You can:"
  "You (could|should|might|may):"
  "Would you (like|prefer)"
  "Want me to"
  "What's your (choice|preference)"
)

BOLD_LABEL_PATTERN='^[[:space:]]*\*\*[A-Z][A-Za-z]+[[:space:]]+[A-Z0-9]'

# Pattern that marks an item-line for the trailing-q-window calculation.
# Matches numbered items, dashed bullets, and bold-label options.
LIST_ITEM_LINE_PATTERN='^[[:space:]]*([0-9]+\.[[:space:]]+|-[[:space:]]+|\*\*[A-Z][A-Za-z]+[[:space:]]+[A-Z0-9])'

# Interrogative-introducer pattern. A line ending in ":" that opens a list
# of options is functionally a trailing question even without a "?".
INTERROGATIVE_INTRO_PATTERN='^[[:space:]]*(Would you (like|prefer)|You (can|could|should|might|may)|Want me to|Should I|Do you want|What.s your).*:[[:space:]]*$'

# is_binary_question: returns 0 (true) if the question is a binary yes/no or
# a simple "X or Y?" form; 1 (false) if it has multi-choice indicators or is
# otherwise multi-option. Used to suppress trailing_q on tangential binaries.
is_binary_question() {
  local q="$1"
  # Lowercase + strip leading whitespace for matching.
  q=$(printf '%s' "$q" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//')

  # Multi-choice indicators: presence of any of these in the question text
  # means the question references multiple listed items -> NOT binary.
  if [[ "$q" =~ one[[:space:]]of[[:space:]](the[[:space:]])?(others|alternatives|options|plans|approaches|paths|choices|ones) ]]; then
    return 1
  fi
  if [[ "$q" =~ which[[:space:]](one|approach|plan|path|option|choice|alternative|way|route|step) ]]; then
    return 1
  fi
  if [[ "$q" =~ (prefer|pick|choose|select)[[:space:]](a|one|an|any|the) ]]; then
    return 1
  fi
  if [[ "$q" =~ any[[:space:]]of[[:space:]](these|those|them|the) ]]; then
    return 1
  fi

  # Multi-comma + "or" = enumerated alternatives ("A, B, or C?") -> NOT binary.
  local comma_count
  comma_count=$(printf '%s' "$q" | tr -cd ',' | wc -c | tr -d ' ')
  local has_or=0
  [[ "$q" =~ [[:space:]]or[[:space:]] ]] && has_or=1
  if [[ $comma_count -ge 2 ]] && [[ $has_or -eq 1 ]]; then
    return 1
  fi

  # Binary openers: yes/no question shape.
  if [[ "$q" =~ ^(should|shall|want|do|does|did|is|are|can|could|would|will|may|might|have|has|ok|okay|ready|sound|good|alright)[[:space:]] ]]; then
    return 0
  fi

  # Simple "X or Y?" form: exactly one "or", no commas.
  if [[ $comma_count -eq 0 ]] && [[ $has_or -eq 1 ]]; then
    return 0
  fi

  return 1
}

# ---- BEGIN L6 SHARED DETECTION (parity-checked against multiple-choice-detect-stop.sh
# ---- by test-multiple-choice-enforce.sh; keep the two copies byte-identical) ----

# L6 (2026-07-12): USER-DIRECTED question shapes. Matched against a single
# lowercased, left-trimmed question sentence. Any hit means the question is being
# POSED TO THE USER rather than used as rhetorical prose.
# Note "you're"/"you'd" need no pattern of their own: the bare `you` alternative
# already matches them, because the apostrophe is a non-[a-z] boundary char.
USER_DIRECTED_PATTERNS=(
  '(^|[^a-z])(you|your|yours)([^a-z]|$)'                       # addresses the user
  '^(should|shall|can|could|may|do|would|will|did|am)[[:space:]]+(i|we)([^a-z]|$)'  # "Should I", "Should we"
  '^(want|need)[[:space:]]+me[[:space:]]+to([^a-z]|$)'         # "Want me to ...?"
  '^(sound|sounds|look|looks|make|makes)[[:space:]]+(good|right|sense|ok|okay)'     # "Sound good?"
  '^(ok|okay|ready|alright|agreed|deal|fair|correct)([^a-z]|$)'                     # bare confirmation
  '^(which|pick|choose|select|confirm)([^a-z]|$)'              # explicit pick prompt
)

# Interrogative introducer that is itself a question to the user even with no "?"
# ("Want me to:" / "Should I:" opening a list). Deliberately EXCLUDES "You can:",
# which introduces a factual capability list, not a question - that stays gated
# behind the opt_count >= 3 option-list path so fact lists keep their carve-out.
QUESTION_INTRO_PATTERN='^[[:space:]]*(Would you (like|prefer)|Want me to|Should I|Should we|Do you want|What.s your)[^?]*:[[:space:]]*$'

# TERMINAL question: the "?" is the last non-whitespace character on its line.
TERMINAL_Q_PATTERN='\?[[:space:]]*$'

# is_user_directed_question: 0 (true) if this question sentence is aimed at the user.
is_user_directed_question() {
  local q="$1"
  q=$(printf '%s' "$q" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//')
  [[ -z "$q" ]] && return 1

  local p
  for p in "${USER_DIRECTED_PATTERNS[@]}"; do
    [[ "$q" =~ $p ]] && return 0
  done

  # This-or-that alternation ("Ship now or wait for review?"): exactly one " or "
  # and no commas. Commas + "or" is an enumerated 3+ list, already handled above.
  local comma_count or_count
  comma_count=$(printf '%s' "$q" | tr -cd ',' | wc -c | tr -d ' ')
  or_count=$(printf '%s' "$q" | grep -oE '[[:space:]]or[[:space:]]' | wc -l | tr -d ' ')
  if [[ $comma_count -eq 0 ]] && [[ $or_count -eq 1 ]]; then
    return 0
  fi

  return 1
}

# detect_direct_question: 0 (true) if the response poses a plain-text question to
# the user. THREE conditions must hold, and their conjunction is what keeps
# rhetorical prose and factual enumerations clean:
#   POSITION - the question sits in the trailing region (last 5 non-empty lines).
#   TERMINAL - the question ENDS its line. You ask, then you stop. A rhetorical
#              question is answered by the prose right after it ("Why did it
#              break? The key rolled."), so a "?" with prose trailing it on the
#              same line is narration, not an ask. This is the rule that keeps
#              self-answered rhetoric clean even when it contains "you" or "or".
#   SHAPE    - the question is user-directed (USER_DIRECTED_PATTERNS above).
# Known limitation: only unindented ``` fences and physical "> " lines are
# stripped, so an indented/tilde fence or a lazy blockquote continuation can leak.
detect_direct_question() {
  local text="$1"
  local non_code trailing line q

  # Strip fenced code (example questions) and blockquotes (quoting the user).
  non_code=$(printf '%s\n' "$text" | sed '/^```/,/^```/d' | grep -v '^[[:space:]]*>')

  # POSITION: only the trailing region can hold a question awaiting an answer.
  trailing=$(printf '%s\n' "$non_code" | grep -v '^[[:space:]]*$' | tail -5)

  # Colon-form introducer ("Want me to:") counts even with no "?", but it must
  # ALSO sit in the trailing region - POSITION applies to it like everything else.
  if printf '%s\n' "$trailing" | grep -qE "$QUESTION_INTRO_PATTERN"; then
    DIRECT_QUESTION_TEXT=$(printf '%s\n' "$trailing" | grep -E "$QUESTION_INTRO_PATTERN" | tail -1 | sed 's/^[[:space:]]*//')
    return 0
  fi

  [[ "$trailing" != *\?* ]] && return 1

  # TERMINAL + SHAPE, evaluated per line.
  while IFS= read -r line; do
    [[ "$line" =~ $TERMINAL_Q_PATTERN ]] || continue
    q=$(printf '%s' "$line" | python3 -c "
import re, sys
m = re.findall(r'[^.!?\n]*\?', sys.stdin.read())
print(m[-1].strip() if m else '')
" 2>/dev/null)
    [[ -z "$q" ]] && continue
    if is_user_directed_question "$q"; then
      DIRECT_QUESTION_TEXT="$q"
      return 0
    fi
  done <<< "$trailing"

  return 1
}

# ---- END L6 SHARED DETECTION ----

option_count=0
bold_label_count=0
matched_lines=""

while IFS= read -r line; do
  matched_this_line=0
  if [[ "$line" =~ $BOLD_LABEL_PATTERN ]]; then
    ((bold_label_count++))
    matched_this_line=1
  fi
  for pattern in "${OPTION_PATTERNS[@]}"; do
    if [[ "$line" =~ $pattern ]]; then
      ((option_count++))
      matched_this_line=1
      break
    fi
  done
  if [[ $matched_this_line -eq 1 ]]; then
    matched_lines="${matched_lines}${line}"$'\n'
  fi
done <<< "$ASSISTANT_TEXT"

# Effective opt_count = max(option_count, bold_label_count). The two counters
# overlap on bold-labeled vocabulary lines ("**Option A:"), so summing
# double-counts; max captures the strongest signal without inflation.
opt_count=$option_count
[[ $bold_label_count -gt $opt_count ]] && opt_count=$bold_label_count

# Strip fenced code blocks before any trailing-question analysis so example
# code containing "?" doesn't trip the detector.
non_code=$(printf '%s\n' "$ASSISTANT_TEXT" | sed '/^```/,/^```/d')

# Tightened trailing_q: locate the last list-item line, take a 250-char window
# from there to end-of-response, and require a "?" inside that window. Then
# verify the question isn't a binary yes/no or simple "X or Y?" shape.
# Newlines are PRESERVED in the window so sentence extraction stops at line
# boundaries (a bullet text + later question = two distinct sentences, not one
# concatenated phrase whose opener is the bullet word).
trailing_q=0
last_list_line_num=$(printf '%s\n' "$non_code" | grep -nE "$LIST_ITEM_LINE_PATTERN" | tail -1 | cut -d: -f1)
if [[ -n "$last_list_line_num" ]]; then
  window=$(printf '%s' "$non_code" | tail -n +"$last_list_line_num")
  window_short="${window:0:250}"
  if [[ "$window_short" == *\?* ]]; then
    # Extract the last `?`-terminated sentence from the window, with newlines
    # treated as sentence boundaries.
    last_q=$(python3 -c "
import re, sys
text = sys.argv[1]
matches = re.findall(r'[^.!?\n]*\?', text)
print(matches[-1].strip() if matches else '')
" "$window_short")
    if [[ -n "$last_q" ]] && ! is_binary_question "$last_q"; then
      trailing_q=1
    fi
  fi
fi

# Interrogative introducer ("Would you like me to:", "You can:") is treated
# as a trailing question even without a "?". This catches the historic
# "Failure 1" pattern (T3 / T21) where the question is implicit in the colon.
if [[ $trailing_q -eq 0 ]]; then
  has_intro=$(printf '%s\n' "$non_code" | grep -cE "$INTERROGATIVE_INTRO_PATTERN")
  [[ $has_intro -gt 0 ]] && trailing_q=1
fi

# trailing_deflection: trailing question + at least one option signal.
trailing_deflection=0
if [[ $trailing_q -eq 1 ]] && [[ $opt_count -ge 1 ]]; then
  trailing_deflection=1
fi

# L6: plain-text question posed to the user (binary included, no option list needed).
direct_question=0
DIRECT_QUESTION_TEXT=""
if detect_direct_question "$ASSISTANT_TEXT"; then
  direct_question=1
  # Surface the offending question so the injector can quote it back.
  matched_lines="${matched_lines}${DIRECT_QUESTION_TEXT}"$'\n'
fi

# Fire decision:
#   - bold_label_count >= 2 always fires (strong structural signal; covers the
#     "**Approach A/B/C**" deflection regardless of trailing-question shape).
#   - opt_count >= 3 AND a trailing-question signal (the T-0005 precondition that
#     keeps factual enumerations from false-firing).
#   - direct_question == 1 (2026-07-12 mandate: ANY question posed to the user,
#     binary included, must go through AskUserQuestion).
should_block=0
if [[ $bold_label_count -ge 2 ]]; then
  should_block=1
elif [[ $opt_count -ge 3 ]] && ( [[ $trailing_q -eq 1 ]] || [[ $trailing_deflection -eq 1 ]] ); then
  should_block=1
elif [[ $direct_question -eq 1 ]]; then
  should_block=1
fi

# Check if the response USED AskUserQuestion already - if so, allow.
# Scan transcript for AskUserQuestion tool_use in the same assistant turn.
used_ask=$(python3 <<PYEOF 2>/dev/null
import json
try:
    last_used = False
    with open("$TRANSCRIPT") as f:
        for line in f:
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("type") != "assistant":
                continue
            msg = e.get("message", {})
            content = msg.get("content", [])
            if not isinstance(content, list):
                continue
            turn_used = False
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("name") == "AskUserQuestion":
                    turn_used = True
                    break
            if any(isinstance(b, dict) and b.get("type") == "text" and b.get("text","").strip() for b in content):
                last_used = turn_used
    print("yes" if last_used else "no")
except Exception:
    print("no")
PYEOF
)

if [[ "$used_ask" == "yes" ]]; then
  exit 0
fi

if [[ $should_block -eq 1 ]]; then
  mkdir -p "$(dirname "$LOG_FILE")"
  reason="opt=$opt_count bold=$bold_label_count trailing_q=$trailing_q trailing_deflection=$trailing_deflection direct_q=$direct_question"
  echo "$(date '+%Y-%m-%d %H:%M:%S')  STOP-DETECT  $reason  session_id=${SESSION_ID:-none}  cwd=${CWD_VAL:-none}" >> "$LOG_FILE"

  # Write violation flag for next-turn injection.
  {
    echo "reason=$reason"
    echo "timestamp=$(date '+%Y-%m-%d %H:%M:%S')"
    echo "matched_lines<<MATCHEOF"
    printf '%s' "$matched_lines" | head -10
    echo "MATCHEOF"
  } > "$VIOLATION_FLAG"
fi

exit 0
