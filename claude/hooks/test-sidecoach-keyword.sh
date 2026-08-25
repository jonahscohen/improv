#!/bin/bash
# Regression tests for sidecoach-keyword.sh
# Run: bash ~/.claude/hooks/test-sidecoach-keyword.sh
#
# Exercises the hook against synthetic UserPromptSubmit payloads covering:
#   - Each of the 21 sidecoach verbs fires in a real invocation context
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

# Assert the hook output CONTAINS a substring (label-first, mirrors assert_fires).
assert_contains() {
  local label="$1" prompt="$2" needle="$3"
  local out; out=$(run_hook "$prompt")
  if echo "$out" | grep -qF "$needle"; then
    echo "PASS: $label"; ((PASS++))
  else
    echo "FAIL: $label (expected to contain '$needle', got: $out)"
    FAIL_LABELS+=("$label"); ((FAIL++))
  fi
}

# Assert the hook output does NOT contain a substring (e.g. a forbidden route).
assert_not_contains() {
  local label="$1" prompt="$2" needle="$3"
  local out; out=$(run_hook "$prompt")
  if echo "$out" | grep -qF "$needle"; then
    echo "FAIL: $label (expected NOT to contain '$needle', got: $out)"
    FAIL_LABELS+=("$label"); ((FAIL++))
  else
    echo "PASS: $label"; ((PASS++))
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
assert_silent "what does harden do"      "what does harden do for me"

echo ""
echo "===== sidecoach-keyword: word boundaries reject substring matches ====="

assert_silent "polished work"            "the polished work is done"
assert_silent "polishing the floor"      "polishing the floor today"
assert_silent "audit-trail"              "this audit-trail is messy"
assert_silent "extraction job"           "extraction job finished"
assert_silent "documentation"            "read the documentation first"
assert_silent "adaptation report"        "adaptation report due Friday"
assert_silent "shaper tool"              "the shaper tool is broken"
assert_silent "crafted carefully"        "this was crafted carefully over time"
assert_silent "animated gif"             "render this as an animated gif"
assert_silent "layouts plural"           "we have many layouts to choose from"

echo ""
echo "===== sidecoach-keyword: multi-verb picks first verb in registry order ====="

# The classifier picks the FIRST verb in registry order and emits it. It no
# longer prints the legacy "tie-breaking to first in registry" stderr warning
# (the VERB branch is a single emit), so we assert the chosen verb fires.
# Registry order: ... audit (12), critique (13), polish (14) ...
assert_fires "audit + polish picks audit"         "please audit and polish this page"          "audit"
# craft (3) before animate (4)
assert_fires "craft + animate picks craft"        "craft and animate the new modal"            "craft"
# shape (1) before everything
assert_fires "shape + craft + polish picks shape" "shape, craft, and polish the new feature"   "shape"

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
echo "===== sidecoach-keyword: retired mode words no longer route (v10) ====="

# The MODE tier was removed in P1 (the lane classifier replaced it). The old
# mode words (forge/kiln/bloom/trim/ralph) are not verbs and carry no
# lane lexicon, so they no longer emit a <mode>/<chain>. Where a real verb
# co-occurs, that verb still routes (the mode word is simply ignored now).
assert_fires "forge+polish routes the polish verb" "forge and polish the homepage" "polish"

# Word-boundary correctness still holds - "forged" / "blooming" / "trimmed" never fire.
assert_silent "forged in past tense"      "the steel was forged yesterday"
assert_silent "blooming gardens"          "the gardens are blooming this week"
assert_silent "trimmed hedges"            "I just trimmed the hedges"

# Informational framings stay silent.
assert_silent "what is forge"             "what is forge in sidecoach"
assert_silent "how do I use kiln"         "how do I use kiln on a feature"
assert_silent "explain bloom"             "explain bloom and what it chains"
assert_silent "what is ralph"             "what is ralph mode in sidecoach"
assert_silent "ralphing not a word"       "ralphing through the changelog feels noisy"

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
  if echo "$out" | grep -q "reads as front-end"; then
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

# "build me a ..." now carries lane_build evidence; with no domain word it is a
# CONTEXT-CHECK (lane tier), not the generic intent nudge.
assert_contains      "build pricing -> context-check" "can you build me a pricing page for the launch" "without domain evidence"
assert_intent_fires  "intent: design a landing page"  "design a landing page for the new product"
assert_intent_fires  "intent: redesign the nav"       "redesign the navigation, it feels clunky"
assert_intent_fires  "intent: aesthetic complaint"    "this dashboard looks dated and generic"
assert_intent_fires  "intent: standalone design sys"  "we need a design system for the app"
assert_intent_silent "intent: trivial color tweak"    "make the button blue"
assert_intent_silent "intent: trivial padding fix"    "fix the padding on the header"
assert_intent_silent "intent: rename label"           "rename the submit label to Save"
assert_intent_silent "intent: informational design"   "what is a design system"
assert_intent_silent "intent: backend task"           "add a database migration for the users table"

# DIAGNOSE tier: pure read-only diagnosis is the canonical /sidecoach audit case
# but carries no BUILD action. Before this tier these went silent even though the
# nudge text routes them to audit (the 2026-06-29 invocation-gap stress finding).
# It must fire on a diagnosis verb + a substantive UI target, and on the "fluff"
# copy-quality standalone, while staying silent on non-UI diagnosis.
assert_intent_fires  "diag: what's wrong + page"      "what's wrong with the homepage"
assert_intent_fires  "diag: what's wrong + dashboard" "what is wrong with the dashboard"
assert_intent_fires  "diag: diagnose + target"        "diagnose the pricing page"
assert_intent_fires  "diag: take a look at + target"  "take a look at the landing page"
assert_intent_fires  "diag: check + navbar"           "check the navbar for me"
assert_intent_fires  "diag: copy real or fluff"       "is the copy on the homepage real or fluff"
# Gated by a substantive UI target -> non-UI diagnosis stays silent.
assert_intent_silent "diag: non-UI db query"          "what's wrong with the database query"
assert_intent_silent "diag: non-UI deployment"        "diagnose the deployment failure"
assert_intent_silent "diag: non-UI logs"              "take a look at the server logs"
# The DIAGNOSE path uses a positive UI-target allowlist (NOT the full target list)
# so engineering prose with overloaded nouns does not trip the nudge (folded from
# Codex review, two rounds: header/table/view/grid + site/interface/component).
assert_intent_silent "diag: HTTP header"              "inspect the packet header"
assert_intent_silent "diag: response header"          "check the response header"
assert_intent_silent "diag: DB table"                 "look at the users table"
assert_intent_silent "diag: SQL view"                 "review the materialized view"
assert_intent_silent "diag: call site"                "look at the call site for this error"
assert_intent_silent "diag: TS interface"             "review the TypeScript interface"
assert_intent_silent "diag: sw component"             "inspect the auth component"
# But the specific 'pricing table' UI target still fires (not a cross-domain word).
assert_intent_fires  "diag: pricing table fires"      "what's wrong with the pricing table"
# Design-canonical targets stay in the allowlist and still fire under diagnosis.
assert_intent_fires  "diag: layout fires"             "what's wrong with the layout"
assert_intent_fires  "diag: form fires"               "take a look at the signup form"
assert_intent_fires  "diag: screen fires"             "what's wrong with the login screen"

# Explicit verbs still hard-route even with the intent tier present.
assert_fires "verb routes alongside intent tier" "polish the checkout flow" "polish"

echo ""
echo "===== sidecoach-keyword: lane classifier corpus (v10) ====="

# ROUTE: in-scope, route-grade
assert_contains     "ship route"            'make the landing page production-ready'                            'release-readiness pass'
# CONTEXT-CHECK: lane evidence, no domain evidence (NOT out-of-scope)
assert_contains     "ship context-check"    'make this production-ready'                                        'without domain evidence'
# Clause binding: ship evidence bound to "migration" in its own sentence -> no route
assert_not_contains "migration not routed"  'The landing page is done. Make the migration production-ready.'    'release-readiness pass'
# Negator discards first occurrence, routes the second clause
assert_contains     "negator then route"    "Don't make the API production-ready; make the landing page production-ready." 'release-readiness pass'
# Bare ambiguous tokens never prove scope (no lane lexicon match -> silent)
assert_silent       "ts interface silent"   'I have a TypeScript interface I need to refactor'
assert_silent       "packet header silent"  'fix the packet header parsing in the network layer'
# (NOTE: the plan's "rework the memory layout of the struct" case is omitted -
#  "layout" is a registered sidecoach VERB, so that prompt fires VERB(layout),
#  not silence. Same plan-corpus bug corrected in the Task 7 parity corpus;
#  lexicon/verb calibration of common words like layout/live is out of P1 scope.)
# Quoted/pasted-doc suppression: quoted lane evidence does not fire
assert_not_contains "quoted not routed"     'the reviewer wrote "make it production-ready" - thoughts?'          'release-readiness pass'
# Explicit verb beats scope outcome -> VERB primary, lane is a diagnostic only
assert_contains     "verb beats scope"      'audit this and make it production-ready'                            '<verb>audit</verb>'
assert_contains     "verb diagnostic shown" 'audit this and make it production-ready'                            'non-routing diagnostic'
# Tone-down lane
assert_contains     "calm route"            "tone the hero down, it's too busy"                                 'tone-down pass'
# Converge lane (route-grade lane competing with the explicit 'audit' verb -> the
# lane label still surfaces in the CLASSIFY prompt)
assert_contains     "converge surfaced"     'keep iterating on the card until it passes the audit'              'iterate-until-it-passes'
# /sidecoach prefix is owned by the slash router, hook stays silent
assert_silent       "slash prefix silent"   '/sidecoach make this production-ready'

echo ""
echo "===== sidecoach-keyword: NUDGE cooldown mapping (v10) ====="

# Cooldown INACTIVE (absent file) -> NUDGE_ELIGIBLE becomes a nudge.
CDN=$(mktemp -u /tmp/sc-cd-XXXXXX)
nudge_out=$(intent_out 'restyle the navbar' "$CDN")
if echo "$nudge_out" | grep -qF 'reads as front-end'; then
  echo "PASS: navbar nudge fires when cooldown inactive"; ((PASS++))
else
  echo "FAIL: navbar nudge fires when cooldown inactive (got: $nudge_out)"
  FAIL_LABELS+=("navbar nudge inactive"); ((FAIL++))
fi

# Cooldown ACTIVE (file timestamped 'now') -> suppressed to silence.
date +%s > "$CDN"
cool_out=$(intent_out 'restyle the navbar' "$CDN")
rm -f "$CDN"
if [ -z "$cool_out" ]; then
  echo "PASS: navbar nudge suppressed when cooldown active"; ((PASS++))
else
  echo "FAIL: navbar nudge suppressed when cooldown active (got: $cool_out)"
  FAIL_LABELS+=("navbar nudge active"); ((FAIL++))
fi

# ---------------------------------------------------------------------------
# DEPLOY-COMPLETENESS GUARD (regression for the 2026-06-26 dead-NL-tier bug).
# The lane/intent tier silently died for ~13 days because sidecoach_lanes.py was
# never deployed next to the live hook -> `import sidecoach_lanes` failed -> the
# whole tier was skipped with NO signal, and unit tests stayed green because they
# run against the repo copy (module present). These cases pin both halves of the fix:
#   (1) a genuine broken deploy (module absent) must warn LOUD on stderr and degrade
#       to verb-only (no nudge), not fail silently.
#   (2) a healthy deploy must fire the diagnosis-aware nudge with NO stderr noise.
# ---------------------------------------------------------------------------
deploy_input=$(python3 -c 'import json; print(json.dumps({"prompt": "Something about the marketing homepage feels off. Take a look at the page and tell me what is wrong with it."}))')

# (1) BROKEN deploy: a hook dir WITHOUT sidecoach_lanes.py
broke_dir=$(mktemp -d)
cp "$HOOK" "$broke_dir/"
for j in sidecoach-verbs.json sidecoach-lanes.json sidecoach-intent.json; do
  cp -L "$HOOK_DIR/$j" "$broke_dir/" 2>/dev/null
done
# (intentionally omit sidecoach_lanes.py to simulate the stale deploy)
broke_cd=$(mktemp -u)
broke_err=$(echo "$deploy_input" | SIDECOACH_INTENT_COOLDOWN_FILE="$broke_cd" bash "$broke_dir/sidecoach-keyword.sh" 2>&1 >/dev/null)
broke_out=$(echo "$deploy_input" | SIDECOACH_INTENT_COOLDOWN_FILE="${broke_cd}.2" bash "$broke_dir/sidecoach-keyword.sh" 2>/dev/null)
if echo "$broke_err" | grep -qF "sidecoach_lanes.py is NOT deployed"; then
  echo "PASS: broken deploy warns LOUD (missing sidecoach_lanes.py)"; ((PASS++))
else
  echo "FAIL: broken deploy warns LOUD (got stderr: $broke_err)"; FAIL_LABELS+=("broken deploy loud"); ((FAIL++))
fi
if [ -z "$broke_out" ]; then
  echo "PASS: broken deploy degrades to verb-only (no nudge)"; ((PASS++))
else
  echo "FAIL: broken deploy degrades to verb-only (got: $broke_out)"; FAIL_LABELS+=("broken deploy degrade"); ((FAIL++))
fi
rm -rf "$broke_dir" "$broke_cd" "${broke_cd}.2" 2>/dev/null

# (1b) STRAY-COPY MASK (Codex P2): the sibling is absent next to the hook but IS
# importable via PYTHONPATH. Python's sys.path search would import the stray copy
# and the tier would "work", silently masking the incomplete deploy. The proactive
# (import-independent) on-disk check must STILL warn here.
stray_dir=$(mktemp -d)
cp "$HOOK" "$stray_dir/"
for j in sidecoach-verbs.json sidecoach-lanes.json sidecoach-intent.json; do
  cp -L "$HOOK_DIR/$j" "$stray_dir/" 2>/dev/null
done
# (no sidecoach_lanes.py in stray_dir; PYTHONPATH exposes the repo copy)
stray_cd=$(mktemp -u)
stray_err=$(echo "$deploy_input" | PYTHONPATH="$HOOK_DIR" SIDECOACH_INTENT_COOLDOWN_FILE="$stray_cd" bash "$stray_dir/sidecoach-keyword.sh" 2>&1 >/dev/null)
if echo "$stray_err" | grep -qF "sidecoach_lanes.py is NOT deployed"; then
  echo "PASS: stray-copy deploy still warns (no silent mask via PYTHONPATH)"; ((PASS++))
else
  echo "FAIL: stray-copy deploy still warns (got stderr: $stray_err)"; FAIL_LABELS+=("stray copy mask"); ((FAIL++))
fi
rm -rf "$stray_dir" "$stray_cd" 2>/dev/null

# (2) HEALTHY deploy: the real repo hook dir (module present)
healthy_cd=$(mktemp -u)
healthy_err=$(echo "$deploy_input" | SIDECOACH_INTENT_COOLDOWN_FILE="$healthy_cd" bash "$HOOK" 2>&1 >/dev/null)
healthy_out=$(echo "$deploy_input" | SIDECOACH_INTENT_COOLDOWN_FILE="${healthy_cd}.2" bash "$HOOK" 2>/dev/null)
if echo "$healthy_out" | grep -qF "/sidecoach audit" && echo "$healthy_out" | grep -qF "DIAGNOSE"; then
  echo "PASS: healthy deploy fires diagnosis-aware nudge"; ((PASS++))
else
  echo "FAIL: healthy deploy fires diagnosis-aware nudge (got: $healthy_out)"; FAIL_LABELS+=("healthy nudge framing"); ((FAIL++))
fi
if [ -n "$healthy_err" ]; then
  echo "FAIL: healthy deploy must emit NO stderr noise (got stderr: $healthy_err)"; FAIL_LABELS+=("healthy no-noise"); ((FAIL++))
else
  echo "PASS: healthy deploy emits no stderr noise"; ((PASS++))
fi
rm -f "$healthy_cd" "${healthy_cd}.2" 2>/dev/null

echo ""
echo "===== sidecoach-keyword: MAX-close - natural-language self-start emits an ACTIONABLE route directive ====="
# ITEM 10 (PARTIAL-HARNESS): a UserPromptSubmit hook cannot call the Skill tool, so
# true self-start (a raw prompt auto-running the flow) is NOT achievable - the model
# must still choose to invoke. The MAX close is that a natural design/diagnosis prompt
# injects a strong, imperative ROUTE DIRECTIVE naming a concrete first step, not a soft
# "would it help?" self-question. These pin that stronger shape (the proof of the MAX
# close, not of autonomy).
assert_intent_contains() {
  local label="$1" prompt="$2" needle="$3"
  local cd; cd=$(mktemp -u /tmp/sc-cd-XXXXXX)
  local out; out=$(intent_out "$prompt" "$cd"); rm -f "$cd"
  if echo "$out" | grep -qF "$needle"; then
    echo "PASS: $label"; ((PASS++))
  else
    echo "FAIL: $label (expected to contain '$needle', got: $out)"; FAIL_LABELS+=("$label"); ((FAIL++))
  fi
}
# BUILD prompt -> an imperative route directive, not a soft nudge.
assert_intent_contains "build: routes imperatively"    "design a landing page for the new product" "ROUTE it through sidecoach now"
assert_intent_contains "build: not an optional nudge"  "design a landing page for the new product" "route directive, not an optional"
assert_intent_contains "build: names the load step"    "redesign the navigation, it feels clunky"   "load the sidecoach skill and run the flow"
# DIAGNOSE prompt -> an audit-first directive.
assert_intent_contains "diag: audit is the FIRST step" "what's wrong with the homepage" "/sidecoach audit <target> as the FIRST step"

echo ""
echo "===== sidecoach-keyword: MAX-close - verb match emits a concrete run directive ====="
# The verb-match injection is now an actionable route directive: it names the flow to
# load and run and forbids hand-coding, replacing the old terse "Route accordingly.".
assert_contains     "verb: names the run step"        "polish the hero" "Load the sidecoach skill and run its 'polish' flow now"
assert_contains     "verb: forbids hand-coding"       "polish the hero" "Do not hand-code this or ask which flow"
assert_not_contains "verb: no soft route accordingly" "polish the hero" "Route accordingly."

echo ""
echo "===== sidecoach-keyword: MAX-close - broadened lexicon fires on natural design phrasings ====="
assert_intent_fires  "lex: modernize + design target" "modernize the dashboard"
assert_intent_fires  "lex: beautify + design target"  "beautify the hero"
assert_intent_fires  "lex: spruce up + design target" "spruce up the landing page"
assert_intent_fires  "lex: modernize the homepage"    "modernize the homepage"
assert_intent_fires  "lex: beautify pricing section"  "beautify the pricing section"
assert_intent_fires  "lex: look and feel"             "improve the look and feel of the app"
assert_intent_fires  "lex: visual hierarchy"          "the visual hierarchy is off"
assert_intent_fires  "lex: design language"           "we need a consistent design language"

# COSMETIC-VERB TARGET GATING (Codex 2026-08-25, findings 2+3). The clean fix: the
# cosmetic verbs (modernize/beautify/spruce up/facelift) are ALL target-gated to a
# POSITIVE design-surface allowlist (page/screen/hero/button/component/layout/ui/...).
# 'facelift' is NOT a standalone any more - it fires only with a design target present.
# There is NO prompt-wide backend blocklist (that over-suppressed legit UI prompts that
# merely mention a backend word). A design target present = fire; a backend object = no
# design target = no fire.
# FIRE - the object is a design surface (button/hero/page/... are all in the allowlist):
assert_intent_fires  "gate: facelift + button"        "give the button a facelift"
assert_intent_fires  "gate: facelift + hero"          "give the hero a facelift"
assert_intent_fires  "gate: modernize landing page"   "modernize the landing page"
assert_intent_fires  "gate: beautify hero"            "beautify the hero"
assert_intent_fires  "gate: modernize guide page"     "modernize the migration guide page"
assert_intent_fires  "gate: settings page + ds"       "modernize the settings page and align it with the design system"
# SILENT - the object is a backend surface, so no design target is present:
assert_intent_silent "gate: facelift API endpoint"    "give the API endpoint a facelift"
assert_intent_silent "gate: facelift graphql resolver" "give the GraphQL resolver a facelift"
assert_intent_silent "gate: facelift auth flow"       "give the auth flow a facelift"
assert_intent_silent "gate: facelift CLI parser"      "give the CLI command parser a facelift"
assert_intent_silent "gate: modernize db table schema" "modernize the database table schema"
assert_intent_silent "gate: modernize TS interface"   "modernize the TypeScript interface definitions"
# Carve-out guards: design-overloaded UI nouns still fire; a design action with no design
# target is simply silent.
assert_intent_fires  "gate: pricing table is UI"      "modernize the pricing table"
assert_intent_fires  "gate: user interface is UI"     "modernize the user interface"
assert_intent_silent "gate: no design target"         "modernize the auth token refresh logic"

echo ""
echo "===== sidecoach-keyword: MAX-close - input sanitizer is LINEAR (tag-flood ReDoS guard) ====="
# Codex 2026-08-25 finding 1: the XML tag-body strip was quadratic - a flood of open tags
# with no close made re.sub rescan to EOF from every open-tag position (N=8000 -> 19s,
# N=16000 -> timeout). Bounding the body to [^<]*? linearizes it. A quadratic regression
# would blow far past this ceiling (>30s / timeout); a linear hook finishes in well under
# a second on the 16k-tag flood.
FLOOD_PROMPT=$(python3 -c 'print("<tag>"*16000 + " modernize the database table schema")')
FLOOD_INPUT=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$FLOOD_PROMPT")
FLOOD_CD=$(mktemp -u /tmp/sc-cd-XXXXXX)
FLOOD_ELAPSED=$(python3 -c '
import subprocess, sys, time, os
inp = sys.argv[1]; hook = sys.argv[2]; cd = sys.argv[3]
env = dict(os.environ); env["SIDECOACH_INTENT_COOLDOWN_FILE"] = cd
t = time.time()
subprocess.run(["bash", hook], input=inp.encode(), stdout=subprocess.DEVNULL,
               stderr=subprocess.DEVNULL, env=env)
print("%.3f" % (time.time() - t))
' "$FLOOD_INPUT" "$HOOK" "$FLOOD_CD")
rm -f "$FLOOD_CD"
if python3 -c "import sys; sys.exit(0 if float('$FLOOD_ELAPSED') < 3.0 else 1)"; then
  echo "PASS: tag-flood x16000 sanitizes in ${FLOOD_ELAPSED}s (linear, < 3s ceiling)"; ((PASS++))
else
  echo "FAIL: tag-flood x16000 took ${FLOOD_ELAPSED}s (quadratic ReDoS regression)"; FAIL_LABELS+=("tag-flood redos"); ((FAIL++))
fi
# Structural guard: the tag-body strip must use the bounded [^<] body, never a [\s\S]/[^]
# any-char body (which reintroduces the quadratic rescan).
if grep -qF '[^<]*?</\1' "$HOOK"; then
  echo "PASS: tag-body strip uses the bounded [^<] body"; ((PASS++))
else
  echo "FAIL: tag-body strip is not the bounded [^<] form (ReDoS risk)"; FAIL_LABELS+=("tag-body bound"); ((FAIL++))
fi
if grep -qF '[\s\S]*?</\1' "$HOOK"; then
  echo "FAIL: tag-body strip still contains the quadratic [\\s\\S] any-char body"; FAIL_LABELS+=("tag-body quadratic"); ((FAIL++))
else
  echo "PASS: no quadratic [\\s\\S] any-char tag body remains"; ((PASS++))
fi

# Codex 2026-08-25 finding 1 (second vector): MALFORMED UNCLOSED open tags ("<tag<tag...")
# were superlinear because the tag-open matcher [^>]* scanned to EOF from every '<' (8k=3.5s,
# 16k=12s). Bounding it to [^<>]* (stops at the next '<' or '>') makes each position O(1).
UFLOOD_PROMPT=$(python3 -c 'print("<tag"*16000 + " modernize the database table schema")')
UFLOOD_INPUT=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$UFLOOD_PROMPT")
UFLOOD_CD=$(mktemp -u /tmp/sc-cd-XXXXXX)
UFLOOD_ELAPSED=$(python3 -c '
import subprocess, sys, time, os
inp, hook, cd = sys.argv[1], sys.argv[2], sys.argv[3]
env = dict(os.environ); env["SIDECOACH_INTENT_COOLDOWN_FILE"] = cd
t = time.time()
subprocess.run(["bash", hook], input=inp.encode(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
print("%.3f" % (time.time() - t))
' "$UFLOOD_INPUT" "$HOOK" "$UFLOOD_CD")
rm -f "$UFLOOD_CD"
if python3 -c "import sys; sys.exit(0 if float('$UFLOOD_ELAPSED') < 3.0 else 1)"; then
  echo "PASS: unclosed-tag flood x16000 in ${UFLOOD_ELAPSED}s (linear, < 3s ceiling)"; ((PASS++))
else
  echo "FAIL: unclosed-tag flood x16000 took ${UFLOOD_ELAPSED}s (superlinear regression)"; FAIL_LABELS+=("unclosed-tag flood"); ((FAIL++))
fi
# Codex 2026-08-25 finding 2 (final): the tag OPENER had adjacent overlapping quantifiers -
# the name capture ([a-zA-Z][\w:-]*) and the following [^<>]* both consume word chars, so a
# long mismatched close ("<"+a*N+">x</"+a*N+"b>") had O(N) name/attr splits and backtracked
# catastrophically (pattern-level 32k=2.4s). The non-overlapping form (?:[\s/][^<>]*)? makes
# the split unique. Assert the 64k mismatched-close input stays fast (a quadratic would be
# ~9s pattern-level alone, far past this whole-hook ceiling).
MISCLOSE_PROMPT=$(python3 -c 'print("<" + "a"*64000 + ">x</" + "a"*64000 + "b> modernize the dashboard")')
MISCLOSE_INPUT=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$MISCLOSE_PROMPT")
MISCLOSE_CD=$(mktemp -u /tmp/sc-cd-XXXXXX)
MISCLOSE_ELAPSED=$(python3 -c '
import subprocess, sys, time, os
inp, hook, cd = sys.argv[1], sys.argv[2], sys.argv[3]
env = dict(os.environ); env["SIDECOACH_INTENT_COOLDOWN_FILE"] = cd
t = time.time()
subprocess.run(["bash", hook], input=inp.encode(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
print("%.3f" % (time.time() - t))
' "$MISCLOSE_INPUT" "$HOOK" "$MISCLOSE_CD")
rm -f "$MISCLOSE_CD"
if python3 -c "import sys; sys.exit(0 if float('$MISCLOSE_ELAPSED') < 3.0 else 1)"; then
  echo "PASS: 64k mismatched-close in ${MISCLOSE_ELAPSED}s (linear, no name/attr backtracking)"; ((PASS++))
else
  echo "FAIL: 64k mismatched-close took ${MISCLOSE_ELAPSED}s (catastrophic backtracking regression)"; FAIL_LABELS+=("mismatched-close redos"); ((FAIL++))
fi
# Structural guard: the tag matchers must be the LINEAR, NON-OVERLAPPING forms.
# (a) stray-tag + open matchers are [^<>]-bounded (not [^>]); (b) the tag-body opener is the
# non-overlapping (?:[\s/][^<>]*)? form; (c) the ambiguous name+attr overlap is GONE.
if grep -qF '(?:[\s/][^<>]*)?>[^<]*?</\1' "$HOOK" && grep -qF '<[a-zA-Z!/][^<>]*>' "$HOOK"; then
  echo "PASS: tag-body opener is the non-overlapping [\\s/]-separated form; stray tag is [^<>]-bounded"; ((PASS++))
else
  echo "FAIL: tag matchers are not the non-overlapping linear form"; FAIL_LABELS+=("tag matcher bound"); ((FAIL++))
fi
if grep -qF '[\w:-]*)[^<>]*>[^<]*?</\1' "$HOOK"; then
  echo "FAIL: ambiguous name+attr overlap ([\\w:-]*)[^<>]*> still present (backtracking ReDoS)"; FAIL_LABELS+=("tag opener overlap"); ((FAIL++))
else
  echo "PASS: no ambiguous name+attr quantifier overlap in the tag opener"; ((PASS++))
fi

echo ""
echo "===== sidecoach-keyword: MAX-close - sanitizer is behavior-preserving on NESTED XML ====="
# Codex 2026-08-25 finding 2: a single [^<]*? body pass leaked the OUTER body of a nested
# tag - "<example><code>x</code> polish the hero</example>" left "polish the hero" and fired
# the verb route on pasted XML. The fixpoint blanks the whole construct, so nested pasted XML
# never leaks a verb/design signal into intent-matching, while plain prose still routes.
assert_silent "nested xml: verb does not leak"   "<example><code>x</code> polish the hero</example>"
assert_intent_silent "nested xml: design nudge does not leak" "<example><code>x</code> modernize the dashboard</example>"
# Control: the same verb/design phrasings with NO surrounding tags still route (not over-blanked).
assert_fires  "control: plain verb still routes"  "polish the hero"                                   "polish"
assert_intent_fires "control: plain design still nudges" "modernize the dashboard"

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
