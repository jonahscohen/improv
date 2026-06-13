#!/bin/bash
# Regression tests for sidecoach-keyword.sh
# Run: bash ~/.claude/hooks/test-sidecoach-keyword.sh
#
# Exercises the hook against synthetic UserPromptSubmit payloads covering:
#   - Each of the 22 sidecoach verbs fires in a real invocation context
#   - Code fences, inline backticks, URLs, XML tag bodies, and transcript
#     markers all suppress firing
#   - Informational framings ("what is X", "how to use X", "how do I X",
#     "tell me about X", "X is a", "explain X", "define X") suppress firing
#   - Word-boundary correctness (polished, audit-trail, extraction must NOT
#     fire)
#   - Multi-verb prompts tie-break to the first verb in registry order
#   - Zero-match prompts produce no output
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HOOK_DIR/sidecoach-keyword.sh"

PASS=0
FAIL=0
FAIL_LABELS=()

run_hook() {
  local prompt="$1"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$prompt")
  echo "$input" | bash "$HOOK" 2>/dev/null
}

# Run the hook and capture stderr too (used for tie-break warning checks).
run_hook_with_stderr() {
  local prompt="$1"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$prompt")
  echo "$input" | bash "$HOOK" 2>&1
}

assert_fires() {
  local label="$1"
  local prompt="$2"
  local expected_verb="$3"
  local out
  out=$(run_hook "$prompt")
  if echo "$out" | grep -q "<verb>${expected_verb}</verb>"; then
    echo "PASS: $label"
    ((PASS++))
  else
    echo "FAIL: $label (expected <verb>${expected_verb}</verb>, got: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  fi
}

assert_silent() {
  local label="$1"
  local prompt="$2"
  local out
  out=$(run_hook "$prompt")
  if [[ -z "$out" ]]; then
    echo "PASS: $label"
    ((PASS++))
  else
    echo "FAIL: $label (expected silent, got: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  fi
}

# Modes (T-0011) emit a <mode>NAME</mode> tag instead of <verb>NAME</verb>,
# plus a <chain>verb1,verb2,...</chain> tag listing the verb chain.
assert_mode_fires() {
  local label="$1"
  local prompt="$2"
  local expected_mode="$3"
  local expected_chain="$4"
  local out
  out=$(run_hook "$prompt")
  if echo "$out" | grep -q "<mode>${expected_mode}</mode>" && \
     echo "$out" | grep -q "<chain>${expected_chain}</chain>"; then
    echo "PASS: $label"
    ((PASS++))
  else
    echo "FAIL: $label (expected mode=${expected_mode} chain=${expected_chain}, got: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  fi
}

assert_tiebreak() {
  local label="$1"
  local prompt="$2"
  local expected_verb="$3"
  local out_combined
  out_combined=$(run_hook_with_stderr "$prompt")
  if echo "$out_combined" | grep -q "<verb>${expected_verb}</verb>" && \
     echo "$out_combined" | grep -q "tie-breaking to first in registry"; then
    echo "PASS: $label"
    ((PASS++))
  else
    echo "FAIL: $label (expected tie-break to ${expected_verb}, got: $out_combined)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  fi
}

echo "===== sidecoach-keyword: every verb fires in invocation context ====="

assert_fires "shape fires"      "shape this new dashboard"          "shape"
assert_fires "onboard fires"    "onboard a new user flow"           "onboard"
assert_fires "craft fires"      "craft a settings panel"            "craft"
assert_fires "animate fires"    "animate the toast component"       "animate"
assert_fires "bolder fires"     "make this hero bolder"             "bolder"
assert_fires "colorize fires"   "colorize the empty state"          "colorize"
assert_fires "delight fires"    "delight the success view"          "delight"
assert_fires "layout fires"     "layout the pricing section"        "layout"
assert_fires "overdrive fires"  "overdrive the launch banner"       "overdrive"
assert_fires "typeset fires"    "typeset the blog post template"    "typeset"
assert_fires "clarify fires"    "clarify this confusing form"       "clarify"
assert_fires "audit fires"      "audit this page"                   "audit"
assert_fires "critique fires"   "critique my settings panel"        "critique"
assert_fires "polish fires"     "polish the checkout button"        "polish"
assert_fires "harden fires"     "harden the error states"           "harden"
assert_fires "adapt fires"      "adapt this view for mobile"        "adapt"
assert_fires "optimize fires"   "optimize image loading"            "optimize"
assert_fires "quieter fires"    "make this hero quieter"            "quieter"
assert_fires "distill fires"    "distill this dashboard"            "distill"
assert_fires "document fires"   "document the design system"        "document"
assert_fires "extract fires"    "extract tokens from this CSS"      "extract"
assert_fires "live fires"       "live iterate on the nav"           "live"

echo ""
echo "===== sidecoach-keyword: fenced code blocks suppress firing ====="

assert_silent "polish in fenced js"      "\`\`\`js
function polish(){}
\`\`\`"
assert_silent "audit in fenced bash"     "\`\`\`bash
npm run audit
\`\`\`"
assert_silent "extract in fenced py"     "\`\`\`python
def extract(x): return x
\`\`\`"
assert_silent "document in fenced ts"    "\`\`\`ts
const document = window.document
\`\`\`"

echo ""
echo "===== sidecoach-keyword: inline backticks suppress firing ====="

assert_silent "polish in inline ticks"   "the \`polish\` function returns void"
assert_silent "audit in inline ticks"    "run \`audit\` from the npm scripts"
assert_silent "live in inline ticks"     "see the \`live\` property on the object"
assert_silent "craft in inline ticks"    "the \`craft\` helper is deprecated"

echo ""
echo "===== sidecoach-keyword: URLs suppress firing ====="

assert_silent "polish in https url"      "see https://example.com/polish/docs"
assert_silent "audit in http url"        "look at http://example.com/audit-results"
assert_silent "layout in file url"       "file:///Users/me/layout/index.html"
assert_silent "document in https url"    "https://docs.example.com/document/api"

echo ""
echo "===== sidecoach-keyword: XML tag bodies suppress firing ====="

assert_silent "polish in example tag"    "<example>polish this</example>"
assert_silent "audit in code tag"        "<code>function audit() {}</code>"
assert_silent "craft in xml block"       "<sample>let me craft a thing</sample>"

echo ""
echo "===== sidecoach-keyword: transcript markers suppress firing ====="

assert_silent "polish under MAGIC tag"   "[MAGIC KEYWORD: polish the button]"
assert_silent "audit under TURN tag"     "[TURN 5: audit this page]"
assert_silent "live under TURN N tag"    "[TURN N: live iterate]"

echo ""
echo "===== sidecoach-keyword: informational framings suppress firing ====="

assert_silent "what is polish"           "what is polish in sidecoach"
assert_silent "what is the polish flow"  "what is the polish flow"
assert_silent "how to use craft"         "how to use craft for a feature"
assert_silent "how do I audit"           "how do I audit a page"
assert_silent "how do you extract"       "how do you extract design tokens"
assert_silent "tell me about layout"     "tell me about layout in sidecoach"
assert_silent "polish is a tactical"     "polish is a tactical refinement pass"
assert_silent "extract is an action"     "extract is an action that pulls tokens"
assert_silent "explain audit"            "explain audit and what it does"
assert_silent "define live"              "define live in the sidecoach context"
assert_silent "what does harden do"      "what does harden do for me"

echo ""
echo "===== sidecoach-keyword: word boundaries reject substring matches ====="

assert_silent "polished work"            "the polished work is done"
assert_silent "polishing the floor"      "polishing the floor today"
assert_silent "audit-trail"              "this audit-trail is messy"
assert_silent "extraction job"           "extraction job finished"
assert_silent "live-blog"                "the live-blog plugin failed"
assert_silent "alive note"               "I am alive and well today"
assert_silent "delivery service"         "the delivery service is slow"
assert_silent "documentation"            "read the documentation first"
assert_silent "adaptation report"        "adaptation report due Friday"
assert_silent "shaper tool"              "the shaper tool is broken"
assert_silent "crafted carefully"        "this was crafted carefully over time"
assert_silent "animated gif"             "render this as an animated gif"
assert_silent "layouts plural"           "we have many layouts to choose from"

echo ""
echo "===== sidecoach-keyword: multi-verb tie-break to first in registry ====="

# Registry order: ... audit (12), critique (13), polish (14) ...
# So "audit and polish" -> audit wins.
assert_tiebreak "audit + polish picks audit"        "please audit and polish this page"          "audit"
# craft (3) before animate (4)
assert_tiebreak "craft + animate picks craft"       "craft and animate the new modal"            "craft"
# shape (1) before everything
assert_tiebreak "shape + craft + polish picks shape" "shape, craft, and polish the new feature"   "shape"

echo ""
echo "===== sidecoach-keyword: zero matches pass through silently ====="

assert_silent "unrelated text"           "hello, how are you today?"
assert_silent "weather chat"             "is it going to rain tomorrow"
assert_silent "code question"            "what does typeof undefined return"

echo ""
echo "===== sidecoach-keyword: mixed sanitization scenarios ====="

# Verb only appears inside a code fence - prose has no verb. Should be silent.
assert_silent "verb only in fence"       "here is some code:
\`\`\`
function polish() {}
\`\`\`
that is all"

# Verb in inline ticks AND in real prose - the real-prose one should fire.
assert_fires  "prose audit, ticks polish" "please audit this page; the \`polish\` helper aside" "audit"

# Verb in URL AND in real prose - the real-prose one should fire.
assert_fires  "prose harden, URL polish"  "harden the API and ignore https://example.com/polish" "harden"

# Informational framing for one verb while invoking another - the invocation wins.
assert_fires  "what is polish + audit"    "what is polish? Also, audit this page."             "audit"

echo ""
echo "===== sidecoach-keyword: lane-active quoted-verb does NOT fire (P2-b) ====="

# When the lane tier is active, classify_intent is authoritative: a verb that
# appears only inside a blanked/quoted region returns SILENT and the hook must
# NOT fall through to the legacy verb tier (which matches on un-blanked text).
# This is the quoted/pasted false-fire the whole feature exists to prevent.
assert_silent "quoted polish stays silent" "the spec said \"polish it\""
# A genuine unquoted verb still routes (no regression in real-verb coverage).
assert_fires  "real polish still fires"    "polish the hero"                                    "polish"

echo ""
echo "===== sidecoach-keyword: T-0011 modes fire with chains ====="

# Every mode fires in invocation context and emits the right verb chain.
assert_mode_fires "forge fires"   "forge the homepage"                "forge"  "shape,craft,polish"
assert_mode_fires "kiln fires"    "kiln this release"                 "kiln"   "audit,critique,harden,adapt,polish"
assert_mode_fires "bloom fires"   "bloom the dashboard"               "bloom"  "colorize,delight,animate,polish"
assert_mode_fires "canvas fires"  "canvas mode for the pricing page"  "canvas" "live,colorize,polish,critique"
assert_mode_fires "trim fires"    "trim the settings panel"           "trim"   "quieter,distill,clarify,polish"
# T-0020: ralph mode fires (relentless cross-flow iteration). Chain is
# polish -> audit -> critique - the three validating verbs the loop drives.
assert_mode_fires "ralph fires"   "ralph the checkout flow"           "ralph"  "polish,audit,critique"

# Word-boundary correctness on modes - "forged" / "blooming" / "trimmed" do NOT fire.
assert_silent "forged in past tense"      "the steel was forged yesterday"
assert_silent "blooming gardens"          "the gardens are blooming this week"
assert_silent "trimmed hedges"            "I just trimmed the hedges"

# Informational framings suppress mode firing.
assert_silent "what is forge"             "what is forge in sidecoach"
assert_silent "how do I use kiln"         "how do I use kiln on a feature"
assert_silent "explain bloom"             "explain bloom and what it chains"
# T-0020: informational mention of ralph must not fire the mode.
assert_silent "what is ralph"             "what is ralph mode in sidecoach"
# T-0020: word-boundary correctness - "ralphing" / "ralpher" must NOT fire.
assert_silent "ralphing not a word"       "ralphing through the changelog feels noisy"

# Mode + verb in same prompt: mode wins (precedence).
out=$(run_hook "forge and polish the homepage" 2>/dev/null)
if echo "$out" | grep -q "<mode>forge</mode>" && \
   echo "$out" | grep -q "<chain>shape,craft,polish</chain>" && \
   ! echo "$out" | grep -q "<verb>"; then
  echo "PASS: forge + polish picks mode forge"
  ((PASS++))
else
  echo "FAIL: forge + polish picks mode forge (got: $out)"
  FAIL_LABELS+=("forge + polish picks mode forge")
  ((FAIL++))
fi

# Multi-mode tie-break: registry order is forge, kiln, bloom, canvas, trim.
out=$(run_hook_with_stderr "bloom and trim this view")
if echo "$out" | grep -q "<mode>bloom</mode>" && \
   echo "$out" | grep -q "tie-breaking to first in registry"; then
  echo "PASS: bloom + trim picks mode bloom (registry order)"
  ((PASS++))
else
  echo "FAIL: bloom + trim picks mode bloom (got: $out)"
  FAIL_LABELS+=("bloom + trim picks mode bloom (registry order)")
  ((FAIL++))
fi

# ---------------------------------------------------------------------------
# Intent tier (sidecoach-intent.json): natural front-end/design requests fire a
# light ADVISORY nudge; trivial tweaks / informational questions / backend work
# stay silent; the cooldown suppresses follow-ups. Each case uses an isolated
# cooldown file so cases never bleed into each other or the real state file.
# ---------------------------------------------------------------------------
intent_out() {
  local prompt="$1" cdfile="$2"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$prompt")
  echo "$input" | SIDECOACH_INTENT_COOLDOWN_FILE="$cdfile" bash "$HOOK" 2>/dev/null
}

assert_intent_fires() {
  local label="$1" prompt="$2"
  local cd; cd=$(mktemp -u /tmp/sc-cd-XXXXXX)
  local out; out=$(intent_out "$prompt" "$cd"); rm -f "$cd"
  if echo "$out" | grep -q "sidecoach flow or mode"; then
    echo "PASS: $label"; ((PASS++))
  else
    echo "FAIL: $label (expected intent nudge, got: $out)"; FAIL_LABELS+=("$label"); ((FAIL++))
  fi
}

assert_intent_silent() {
  local label="$1" prompt="$2"
  local cd; cd=$(mktemp -u /tmp/sc-cd-XXXXXX)
  local out; out=$(intent_out "$prompt" "$cd"); rm -f "$cd"
  if [ -z "$out" ]; then
    echo "PASS: $label"; ((PASS++))
  else
    echo "FAIL: $label (expected silence, got: $out)"; FAIL_LABELS+=("$label"); ((FAIL++))
  fi
}

assert_intent_fires  "intent: build a pricing page"   "can you build me a pricing page for the launch"
assert_intent_fires  "intent: design a landing page"  "design a landing page for the new product"
assert_intent_fires  "intent: redesign the nav"       "redesign the navigation, it feels clunky"
assert_intent_fires  "intent: aesthetic complaint"    "this dashboard looks dated and generic"
assert_intent_fires  "intent: standalone design sys"  "we need a design system for the app"
assert_intent_silent "intent: trivial color tweak"    "make the button blue"
assert_intent_silent "intent: trivial padding fix"    "fix the padding on the header"
assert_intent_silent "intent: rename label"           "rename the submit label to Save"
assert_intent_silent "intent: informational design"   "what is a design system"
assert_intent_silent "intent: backend task"           "add a database migration for the users table"

# Explicit verbs still hard-route even with the intent tier present.
assert_fires "verb routes alongside intent tier" "polish the checkout flow" "polish"

# Cooldown: a second intent prompt within the window is suppressed.
CDX=$(mktemp -u /tmp/sc-cd-XXXXXX)
intent_out "design a landing page" "$CDX" >/dev/null
cool_second=$(intent_out "build a hero section" "$CDX")
rm -f "$CDX"
if [ -z "$cool_second" ]; then
  echo "PASS: cooldown suppresses the second intent nudge"; ((PASS++))
else
  echo "FAIL: cooldown suppresses the second intent nudge (got: $cool_second)"
  FAIL_LABELS+=("cooldown suppresses second intent nudge"); ((FAIL++))
fi

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed cases:"
  for label in "${FAIL_LABELS[@]}"; do
    echo "  - $label"
  done
  exit 1
fi
echo "All tests pass."
exit 0
