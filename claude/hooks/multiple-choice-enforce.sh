#!/bin/bash
# Hook: Enforce multiple choice rule - block text-form options, require AskUserQuestion
# Runs on: PreResponse (before text is sent to user)
# Blocks: Any response offering 2+ distinct options without using AskUserQuestion tool
#
# Hardened 2026-05-24 after two failures showed the patterns were too narrow:
#  Failure 1 (numbered list): hook SHOULD have caught but anchoring was off
#  Failure 2 (bold-prefixed "Approach A" with long-dash): hook didn't match - vocabulary too narrow
#
# Hardening layers:
#  L1: broadened label vocabulary (Option/Approach/Path/Plan/Choice/Alternative/Strategy/Way/Route/Step)
#      plus colon/hyphen/period separators (long-dash handled via L2 structural heuristic)
#  L2: structural heuristic - 2+ paragraphs starting with **CapitalizedWord <Letter|Digit>
#      catches the "**Approach A long-dash" pattern regardless of which noun is used
#  L4: logging on every BLOCK to ~/.claude/.multiple-choice-blocks.log
#  L5: stderr breadcrumb on hook entry so silent-no-RESPONSE_TEXT failures surface
#
# 2026-05-27 (T-0005): false-fire fix. Three patterns now PASS that previously blocked:
#  (a) Binary "X or Y?" questions (no list, just a yes/no).
#  (b) Numbered fact lists with no trailing question (opt_count >= 3 alone is not enough).
#  (c) Numbered list followed by a binary trailing question ("Want me to queue any?").
# Mechanism: precondition `opt_count >= 3 AND (trailing_q == 1 OR trailing_deflection == 1)`
# guards the option-vocabulary path; bold_label_count >= 2 stays as an independent
# strong-signal override so the original Failure 2 catch is preserved. The trailing_q
# detector now requires a "?" within ~250 chars of the last list item, and the
# question must not match a binary opener / simple "X or Y?" shape.
#
# 2026-07-12 (MANDATE CHANGE - Jonah): the binary exemption from T-0005(a)/(c) is
# REVOKED. Every question posed to the user must go through AskUserQuestion, and a
# yes/no is now a 2-option AskUserQuestion. A hook fire on a plain-text binary is
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
# Blockquoted lines are stripped before analysis: "> ..." is quoting the user, not
# asking them something.

LOG_FILE="$HOME/.claude/.multiple-choice-blocks.log"

# L5 breadcrumb
echo "[multiple-choice-enforce] entry: RESPONSE_TEXT len=${#RESPONSE_TEXT}, TOOL_LOG=${TOOL_LOG:-unset}" >&2

# L1: Patterns that indicate deflection (offering labeled options in text form).
# Broadened from the original to cover synonyms for "option" and multiple separator chars.
OPTION_PATTERNS=(
  "^[[:space:]]*\*?\*?(Option|Approach|Path|Plan|Choice|Alternative|Strategy|Way|Route|Step)[[:space:]]+([A-Z]|[0-9]+)[[:space:]]*[:.-]"
  "^[[:space:]]*[0-9]+\.[[:space:]]+"
  "You can:"
  "You (could|should|might|may):"
  "Would you prefer"
  "What's your (choice|preference)"
)

# L2: Structural heuristic - count repeated bold-label paragraphs (regardless of word after **).
# Pattern: lines starting with **<CapitalizedWord>\s+<UpperLetterOrDigit>
# Catches **Approach A, **Plan 1, **Path B, **Choice C - the repeated bold-label pattern IS the signal.
BOLD_LABEL_PATTERN='^[[:space:]]*\*\*[A-Z][A-Za-z]+[[:space:]]+[A-Z0-9]'

# T-0005 additions: list-item line pattern (for trailing-q window calculation) and
# interrogative-introducer pattern (for implicit-question recognition).
LIST_ITEM_LINE_PATTERN='^[[:space:]]*([0-9]+\.[[:space:]]+|-[[:space:]]+|\*\*[A-Z][A-Za-z]+[[:space:]]+[A-Z0-9])'
INTERROGATIVE_INTRO_PATTERN='^[[:space:]]*(Would you (like|prefer)|You (can|could|should|might|may)|Want me to|Should I|Do you want|What.s your).*:[[:space:]]*$'

# is_binary_question: returns 0 (true) if the question is a yes/no or simple
# "X or Y?" form; returns 1 (false) if it has multi-choice indicators or is
# otherwise multi-option.
is_binary_question() {
  local q="$1"
  q=$(printf '%s' "$q" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//')

  # Multi-choice indicators -> NOT binary.
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

  local comma_count
  comma_count=$(printf '%s' "$q" | tr -cd ',' | wc -c | tr -d ' ')
  local has_or=0
  [[ "$q" =~ [[:space:]]or[[:space:]] ]] && has_or=1

  # Enumerated alternatives ("A, B, or C?") -> NOT binary.
  if [[ $comma_count -ge 2 ]] && [[ $has_or -eq 1 ]]; then
    return 1
  fi

  # Binary openers: yes/no question shape.
  if [[ "$q" =~ ^(should|shall|want|do|does|did|is|are|can|could|would|will|may|might|have|has|ok|okay|ready|sound|good|alright)[[:space:]] ]]; then
    return 0
  fi

  # Simple "X or Y?" form.
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

check_for_deflection() {
  local text="$1"
  local option_count=0
  local bold_label_count=0

  while IFS= read -r line; do
    # L2: count bold-label paragraphs
    if [[ "$line" =~ $BOLD_LABEL_PATTERN ]]; then
      ((bold_label_count++))
    fi
    # L1: check option vocabulary
    for pattern in "${OPTION_PATTERNS[@]}"; do
      if [[ "$line" =~ $pattern ]]; then
        ((option_count++))
        break
      fi
    done
  done <<< "$text"

  # Effective opt_count = max(option_count, bold_label_count).
  local opt_count=$option_count
  [[ $bold_label_count -gt $opt_count ]] && opt_count=$bold_label_count

  # Strip fenced code blocks before trailing-question analysis.
  local non_code
  non_code=$(printf '%s\n' "$text" | sed '/^```/,/^```/d')

  # Tightened trailing_q: locate the last list-item line and require a "?"
  # within ~250 chars of that line, AND the question must not be binary.
  # Newlines are PRESERVED in the window so sentence extraction stops at line
  # boundaries; otherwise a bullet's text concatenates with a later question
  # and the binary-opener check sees the wrong starting word.
  local trailing_q=0
  local last_list_line_num
  last_list_line_num=$(printf '%s\n' "$non_code" | grep -nE "$LIST_ITEM_LINE_PATTERN" | tail -1 | cut -d: -f1)
  if [[ -n "$last_list_line_num" ]]; then
    local window window_short last_q
    window=$(printf '%s' "$non_code" | tail -n +"$last_list_line_num")
    window_short="${window:0:250}"
    if [[ "$window_short" == *\?* ]]; then
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

  # Interrogative introducer is treated as a trailing question.
  if [[ $trailing_q -eq 0 ]]; then
    local has_intro
    has_intro=$(printf '%s\n' "$non_code" | grep -cE "$INTERROGATIVE_INTRO_PATTERN")
    [[ $has_intro -gt 0 ]] && trailing_q=1
  fi

  local trailing_deflection=0
  if [[ $trailing_q -eq 1 ]] && [[ $opt_count -ge 1 ]]; then
    trailing_deflection=1
  fi

  # L6: plain-text question posed to the user (binary included, no list required).
  local direct_question=0
  DIRECT_QUESTION_TEXT=""
  if detect_direct_question "$text"; then
    direct_question=1
  fi

  # Fire decision:
  #   - bold_label_count >= 2 is always a block (strong structural signal).
  #   - opt_count >= 3 AND a trailing-question signal (option-list deflection).
  #   - direct_question == 1 (2026-07-12 mandate: ANY question to the user, binary
  #     included, must go through AskUserQuestion).
  if [[ $bold_label_count -ge 2 ]]; then
    DETECTED_REASON="opt=$opt_count bold=$bold_label_count trailing_q=$trailing_q trailing_deflection=$trailing_deflection direct_q=$direct_question (bold-heuristic)"
    return 0  # BLOCK
  fi
  if [[ $opt_count -ge 3 ]] && ( [[ $trailing_q -eq 1 ]] || [[ $trailing_deflection -eq 1 ]] ); then
    DETECTED_REASON="opt=$opt_count bold=$bold_label_count trailing_q=$trailing_q trailing_deflection=$trailing_deflection direct_q=$direct_question"
    return 0  # BLOCK
  fi
  if [[ $direct_question -eq 1 ]]; then
    DETECTED_REASON="opt=$opt_count bold=$bold_label_count trailing_q=$trailing_q trailing_deflection=$trailing_deflection direct_q=1 (direct-question: \"$DIRECT_QUESTION_TEXT\")"
    return 0  # BLOCK
  fi

  return 1  # ALLOW
}

# Check if AskUserQuestion was already used in this response
response_has_askuserquestion() {
  local response_log="$1"
  [[ -n "$response_log" ]] || return 1
  grep -q "AskUserQuestion" "$response_log" 2>/dev/null
  return $?
}

# L4: log every BLOCK
log_block() {
  local reason="$1"
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "$(date '+%Y-%m-%d %H:%M:%S')  BLOCK  $reason" >> "$LOG_FILE"
}

# Main check
if [[ -n "$RESPONSE_TEXT" ]]; then
  if check_for_deflection "$RESPONSE_TEXT"; then
    if ! response_has_askuserquestion "$TOOL_LOG"; then
      log_block "$DETECTED_REASON"
      cat >&2 <<EOF
BLOCKED: Plain-text question or option deflection detected ($DETECTED_REASON)

You posed a question to the user in plain text, or offered options in text form,
without using the AskUserQuestion tool.

RULE (revised 2026-07-12): EVERY question to the user goes through AskUserQuestion.
  - Binary (yes/no, X or Y) questions are NOT exempt. A yes/no is a 2-option
    AskUserQuestion. A fire on a binary is INTENDED, not a false positive.
  - Mark the recommended option with "(Recommended)" when using the tool.
  - Hook detects: Option/Approach/Path/Plan/Choice/Alternative/Strategy/Way/Route/Step
  - Hook detects: 2+ paragraphs starting with **CapitalizedWord (regardless of which word)
  - Hook detects: a user-directed question in the trailing region ("Should I...?",
    "Want me to...?", "Ship now or wait?", "Sound good?")

NOT detected (still fine in plain text): factual enumerations with no question
attached, and rhetorical questions inside prose ("Why did it break? The key rolled.").

Detected lines (first 5):
$(printf '%s' "$RESPONSE_TEXT" | grep -E "^[[:space:]]*\*\*[A-Z][A-Za-z]+[[:space:]]+[A-Z0-9]|^[[:space:]]*(Option|Approach|Path|Plan|Choice|Alternative|Strategy|Way|Route|Step)[[:space:]]+[A-Z0-9]|\?" | head -5)

FIX: Use AskUserQuestion with your options (two options for a binary), then compose
a text response acknowledging their choice.
EOF
      exit 1
    fi
  fi
fi

exit 0
