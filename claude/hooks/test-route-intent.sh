#!/bin/bash
# Regression tests for route-intent.sh and the agent roster.
# Run: bash claude/hooks/test-route-intent.sh
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

# python3 is this suite's only measuring instrument: every payload, every fixture and
# every assertion below is built with it. Without it the suite would not fail loudly -
# it would skip silently and still print a green summary, which is worse than no suite.
command -v python3 >/dev/null 2>&1 || {
  echo "FATAL: python3 not found - this suite cannot verify anything without it." >&2
  exit 2
}
REPO_DIR="$(cd "$HOOK_DIR/../.." && pwd)"
HOOK="$HOOK_DIR/route-intent.sh"
AGENTS_DIR="$REPO_DIR/claude/agents"

# Every assertion in this file that does not explicitly opt into cooldown
# (i.e. everything using the plain run_hook helper) must not be silenced by
# real cooldown state left over from prior runs of this suite, or from the
# live hook firing on real prompts during this same session. Isolate those
# calls onto a throwaway file with cooldown disabled; the cooldown-specific
# tests below override ROUTE_INTENT_COOLDOWN_FILE/ROUTE_INTENT_COOLDOWN per
# invocation, which takes precedence over this exported default.
export ROUTE_INTENT_COOLDOWN_FILE="$(mktemp -t routeintent-default)" || { echo "FATAL: mktemp failed - refusing to use an unset path" >&2; exit 2; }
rm -f "$ROUTE_INTENT_COOLDOWN_FILE"
export ROUTE_INTENT_COOLDOWN=0
trap 'rm -f "$ROUTE_INTENT_COOLDOWN_FILE"' EXIT

PASS=0
FAIL=0
FAIL_LABELS=()

pass() { echo "PASS: $1"; ((PASS++)); }
fail() { echo "FAIL: $1 ($2)"; FAIL_LABELS+=("$1"); ((FAIL++)); }

# Assert an agent file declares an exact `model:` value in its frontmatter.
assert_agent_model() {
  local label="$1" file="$2" expected="$3"
  if [ ! -f "$AGENTS_DIR/$file" ]; then
    fail "$label" "missing $AGENTS_DIR/$file"; return
  fi
  local got
  got=$(awk '/^---$/{n++; next} n==1 && /^model:/{print $2; exit}' "$AGENTS_DIR/$file")
  if [ "$got" = "$expected" ]; then
    pass "$label"
  else
    fail "$label" "expected model: $expected, got: ${got:-<none>}"
  fi
}

# Assert an agent file declares an exact `tools:` line in its frontmatter.
assert_agent_tools() {
  local label="$1" file="$2" expected="$3"
  if [ ! -f "$AGENTS_DIR/$file" ]; then
    fail "$label" "missing $AGENTS_DIR/$file"; return
  fi
  local got
  got=$(awk '/^---$/{n++; next} n==1 && /^tools:/{sub(/^tools:[[:space:]]*/,""); print; exit}' "$AGENTS_DIR/$file")
  if [ "$got" = "$expected" ]; then
    pass "$label"
  else
    fail "$label" "expected tools: $expected, got: ${got:-<none>}"
  fi
}

# Assert an agent file declares NO tools: key (the only way to grant all tools).
assert_agent_no_tools() {
  local label="$1" file="$2"
  if [ ! -f "$AGENTS_DIR/$file" ]; then
    fail "$label" "missing $AGENTS_DIR/$file"; return
  fi
  if awk '/^---$/{n++; next} n==1 && /^tools:/{found=1} END{exit !found}' "$AGENTS_DIR/$file"; then
    fail "$label" "has a tools: key; omit it to grant all tools"
  else
    pass "$label"
  fi
}

assert_agent_model "quick-answer is haiku"   quick-answer.md  haiku
assert_agent_model "sonnet-impl is sonnet"   sonnet-impl.md   sonnet
assert_agent_model "opus-executor is opus"   opus-executor.md opus
assert_agent_tools "quick-answer is read-only" quick-answer.md "Read, Grep, Glob"
assert_agent_no_tools "sonnet-impl grants all tools via omitted key"   sonnet-impl.md
assert_agent_no_tools "opus-executor grants all tools via omitted key" opus-executor.md

json_prompt() {
  python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$1"
}

# Run the hook and capture stdout, stderr, and rc SEPARATELY into globals.
#
# Why globals and not a command substitution: the callers need all three, and a
# `$(...)` capture runs in a subshell whose variables never reach the caller.
#
# Why stderr at all: the contract is "exit 0 with NO output on EITHER stream",
# because this hook sits in the prompt path. Every assertion here used to run
# `2>/dev/null`, so only rc and stdout were ever checked - a stderr regression
# passed the whole suite. That is not hypothetical: a paste past ARG_MAX made the
# python3 exec fail with "Argument list too long" on stderr while rc stayed 0 and
# stdout stayed empty, and the suite was green throughout.
#
# BOTH streams are file-backed, deliberately. A `$(...)` capture strips trailing
# newlines, so a hook emitting nothing but "\n" would read as empty and satisfy every
# "no output" assertion below. Reading the file with `wc -c` keeps that visible.
#
# Extra args are VAR=value overrides passed through env.
HOOK_OUT=""; HOOK_ERR=""; HOOK_RC=0; HOOK_OUT_BYTES=0; HOOK_ERR_BYTES=0
run_hook_raw() {
  local stdin_payload="$1"; shift
  local outfile errfile
  outfile=$(mktemp -t routeintent-out) || { echo "FATAL: mktemp failed - refusing to use an unset path" >&2; exit 2; }
  errfile=$(mktemp -t routeintent-err) || { echo "FATAL: mktemp failed - refusing to use an unset path" >&2; exit 2; }
  printf '%s' "$stdin_payload" | env "$@" bash "$HOOK" >"$outfile" 2>"$errfile"; HOOK_RC=$?
  HOOK_OUT=$(cat "$outfile"); HOOK_ERR=$(cat "$errfile")
  HOOK_OUT_BYTES=$(wc -c < "$outfile" | tr -d ' ')
  HOOK_ERR_BYTES=$(wc -c < "$errfile" | tr -d ' ')
  rm -f "$outfile" "$errfile"
}

# True when the hook wrote NOTHING to either stream - not even a bare newline.
hook_wrote_nothing() { [ "$HOOK_OUT_BYTES" -eq 0 ] && [ "$HOOK_ERR_BYTES" -eq 0 ]; }

# Assert the hook fires, names the expected agent, and stays clean on rc + stderr.
assert_routes() {
  local label="$1" prompt="$2" expected_agent="$3"
  run_hook_raw "$(json_prompt "$prompt")"
  if [ -n "$HOOK_ERR" ]; then
    fail "$label" "wrote to stderr: $HOOK_ERR"
  elif [ "$HOOK_RC" -ne 0 ]; then
    fail "$label" "rc=$HOOK_RC"
  elif printf '%s' "$HOOK_OUT" | grep -qF "$expected_agent"; then
    pass "$label"
  else
    fail "$label" "expected agent '$expected_agent', got: ${HOOK_OUT:-<silent>}"
  fi
}

# Assert the hook produces no output at all, on EITHER stream, and exits 0.
assert_silent() {
  local label="$1" prompt="$2"
  run_hook_raw "$(json_prompt "$prompt")"
  if [ "$HOOK_RC" -eq 0 ] && hook_wrote_nothing; then
    pass "$label"
  else
    fail "$label" "rc=$HOOK_RC out=${HOOK_OUT:-<empty>}(${HOOK_OUT_BYTES}B) err=${HOOK_ERR:-<empty>}(${HOOK_ERR_BYTES}B)"
  fi
}

assert_routes "lookup routes to quick-answer" \
  "where is the cooldown seconds value set for the sidecoach intent hook" \
  "quick-answer"
assert_routes "sweep routes to Explore" \
  "find all the callers of detect-session-model across the hooks directory" \
  "Explore"
assert_routes "mechanical edit routes to sonnet-impl" \
  "rename the helper touch_cooldown to mark_cooldown across every hook that uses it" \
  "sonnet-impl"
assert_routes "build routes to opus-executor" \
  "implement a new caching layer for the flow handler results" \
  "opus-executor"

assert_silent "short prompt is answered inline, not routed" \
  "find all the callers"
assert_silent "informational framing does not route" \
  "what is the best way to find all the callers of detect-session-model in this repo"
# The BODY of this fence deliberately carries an ODD number of backticks, and the
# exempt phrase "does that look right" is deliberately absent. Both are load-bearing;
# do not "tidy" either one.
#
# The inline-backtick scrub pairs backticks left to right. A fence delimiter is three
# backticks, so open + close contribute an even six, and an EVEN number in the body
# leaves the whole fence perfectly paired - the inline scrub alone then eats the body
# and the triple-backtick scrub is never exercised. With an odd body count the routing
# phrase lands outside every pair and survives to the fence scrub, which is the line
# this assertion exists to cover.
#
# Mutation-proved: neutralize the triple-backtick scrub in a copy of the hook and this
# assertion FAILS (the prompt routes to sonnet-impl).
assert_silent "pattern inside a triple-backtick fence does not route" \
  'here is the exact wording from the ticket, read it back to me:
```
` rename the flow handler to route handler across every call site
```
tell me if that is still what we agreed on last week'
# The tilde fence is a SEPARATE scrub line from the backtick fence, so it needs its
# own case. Mutation-proved against the tilde-fence scrub the same way.
assert_silent "pattern inside a tilde fence does not route" \
  'here is the exact wording from the ticket, read it back to me:
~~~
rename the flow handler to route handler across every call site
~~~
tell me if that is still what we agreed on last week'
assert_silent "pattern inside inline backticks does not route" \
  'the docs literally say `find all the callers` which I think is wrong, is it'
assert_silent "pattern inside an XML body does not route" \
  "<quote>find all the callers of detect-session-model</quote> was the wording in the old ticket we archived"

# A prompt matching BOTH sonnet_impl and opus_executor must resolve to the
# more capable tier. Routing too low produces work that has to be redone.
#
# "remaining" is load-bearing. The sonnet_impl pattern is
# `update (all|every) [a-z0-9_.\- ]{2,40}(reference|...)`, which needs 2-40 filler
# characters between the quantifier and the noun. "update every reference" supplies
# ZERO, so the earlier wording matched opus_executor ALONE and this assertion passed
# no matter which order the tiers were tried in.
#
# Mutation-proved: reverse escalation_order in a copy of the lexicon and this
# assertion FAILS (the answer changes to sonnet-impl).
assert_routes "multi-tier prompt escalates to opus-executor" \
  "refactor the flow handler and update every remaining reference to the old name" \
  "opus-executor"
assert_routes "sweep plus lookup escalates to Explore" \
  "find all the places where the cooldown value is set and tell me which file owns it" \
  "Explore"

# opus_executor is the most expensive tier to reach by mistake, and it used to hold
# two BARE word matches (\brefactor\b, \bredesign\b) that fired on any mention of the
# word - including a negation, a past-tense complaint, and an open question. Those
# verbs now require an IMPERATIVE shape: the verb at a clause boundary AND a
# determiner-led object.
#
# WHICH MECHANISM ACTUALLY HOLDS EACH ROW (measured 2026-07-28, not assumed). This
# comment used to claim "silence here can only come from the pattern shape itself"
# for all three rows. That was false for two of them, and it is the exact
# mechanism-fiction this suite elsewhere warns about: revert the verbs to the bare
# \brefactor\b / \bredesign\b form and only ONE of the three goes red. The other two
# carry a deliberation marker ("do not", "should we") and are held by
# suppress.deliberation_markers, so they stay green under that revert. They are
# DOUBLE-COVERED - real regression rows for real prompts, but not evidence about the
# pattern shape. Each row below says which mutation turns it red.
#
# bare-verb revert ONLY (no deliberation marker present, so the shape is the sole
# mechanism). This row and the redesign row are the pattern-shape evidence.
assert_silent "shape: a bare refactor mention with no determiner does not route" \
  "the ticket mentions refactor work across the parser but i only want triage notes today"
# double-covered: needs BOTH the bare-verb revert AND the markers removed.
assert_silent "a negated refactor mention does not route" \
  "do not refactor it, just explain why the current shape is so slow to run"
# bare-verb revert ONLY.
assert_silent "a past-tense redesign complaint does not route" \
  "i hate the redesign we shipped last quarter and it still bothers me today"
# double-covered: needs BOTH the bare-verb revert AND the markers removed.
assert_silent "deliberating about a refactor does not route" \
  "should we refactor this or leave it alone until the next release cycle"
# A softener ("please", "can you") is NOT a clause boundary of its own. Treating it as
# one let a deliberation through: "should we please refactor..." matched on `please`
# sitting mid-clause. The softeners are inside the optional group instead.
# Double-covered: "should we" is also a deliberation marker, so promoting the softener
# back to a boundary token alone does NOT turn this row red. It is a future-widening
# guard on the softener, not evidence about the shipped boundary alternation.
assert_silent "a softener does not make a deliberation imperative" \
  "should we please refactor the parser module or wait until the next cycle"
# ...while a real instruction still reaches the tier, including mid-sentence and
# behind a softener. "can you refactor X" is the single most common way this gets
# phrased, so the tightening must not swallow it.
assert_routes "an imperative refactor still routes to opus-executor" \
  "clean up the imports and refactor the parser module while you are in there" \
  "opus-executor"
assert_routes "a softened imperative still routes to opus-executor" \
  "can you refactor the parser module across every file that imports it" \
  "opus-executor"

# ---------------------------------------------------------------------------
# Real-traffic efficacy. The original "0% -> 22.2% recall over 627 prompts" claim
# is STRUCK: recall needs a labelled should-have-routed set, nothing of the kind was
# ever committed, and the labels came from the same agent that chose the split.
# What IS re-derivable, with `measure-hook-corpus.py --route`, is the fire rate and
# the envelope/genuine split - 2026-07-28 over 4021 real prompts: 22 routed, 11 of
# them envelopes; after the envelope exemption, 10 routed, 0 envelopes.
# (original note, kept for provenance: measured 2026-07-27 against 627 prompts mined
# from ~/.claude/projects transcripts). The suite was green while the hook was
# routing 0.37% of real prompts at 0% recall and 0% precision, so a green suite
# is not evidence the classifier works. These cases encode the four defects
# that measurement exposed.
#
# THE RULE THESE TESTS EXIST TO ENFORCE: when a matcher is widened, the
# negatives that matter are the ones built FROM THE TOKENS THE WIDENING ADDED,
# not the ones already in the suite. A prior widening passed every inherited
# negative and still reintroduced seven deliberation false positives, because
# no existing negative happened to contain a newly added token.
# ---------------------------------------------------------------------------

# Defect A - deictic objects. A dispatched subagent receives NONE of the
# conversation, so "this"/"that" has no resolvable referent. Not a narrow
# lookup; unroutable by construction.
assert_silent "a deictic object is not a narrow lookup" \
  "in the settings panel of justify, what does this actually do when you click it"
assert_silent "a deictic subject is not a narrow lookup" \
  "where is that set exactly, i cannot find it anywhere in the config files"

# Defect B - the identifier slot used to admit space and dot without limit
# ([a-z0-9_.\- ]{2,40}), so it bridged whole clauses. This exact string was
# observed routing on real traffic: "rename" and a "to" 30 characters later,
# with an entire unrelated clause in between.
assert_silent "an identifier slot does not bridge a clause boundary" \
  "or a stale orphan from a rename - i.e. this skill was renamed to something else"

# Defect C - dispatch briefs. The recipient of a brief IS the delegate, so
# nudging it to re-delegate is pure noise. 7 of the 9 fires on real traffic
# were briefs, matching numbered sub-steps inside them.
assert_silent "a teammate dispatch brief does not route" \
  "Teammate on the improv repo. TASK: find all the stale references. Do NOT commit."
assert_silent "a named-agent dispatch brief does not route" \
  'You are "stage2bd", finishing Stage 2. Collaborator is Jonah. First map the routing landscape.'
assert_silent "a research-unit brief does not route" \
  "RESEARCH unit 8 of the dispatch plan. Map the coupling of each of the six cmux hooks."
# DOUBLE, and deliberately so: a compaction summary is matched by BOTH the
# `envelope_exempt` anchor and the prose `exempt` list, so emptying either one alone
# leaves this row green. Only removing both turns it red. Belt and braces on the
# highest-volume envelope, not evidence about either mechanism on its own.
assert_silent "a compaction summary is not a user request" \
  "This session is being continued from a previous conversation that ran out of context. Summary: find all the callers."

# Defect D - register. The lexicon encoded a formal command register the user
# never actually types. These six phrasings are verbatim shapes from real
# transcripts that were silent before.
assert_routes "a conversational analysis request routes to Explore" \
  "need you to run an analysis on the four competitor repos and determine the gaps" \
  "Explore"
assert_routes "a breakdown request routes to Explore" \
  "i need a breakdown of all work completed across all projects last week" \
  "Explore"
assert_routes "a scan request routes to Explore" \
  "need to scan project folders for time spent in each project over the past week" \
  "Explore"
assert_routes "an explicit explore request routes to Explore" \
  "Explore /Users/spare3/Documents/Github/improv/sidecoach and report the rules" \
  "Explore"
assert_routes "a modify-X-to request routes to sonnet-impl" \
  "modify generator to support localstorage so it saves entries between reloads" \
  "sonnet-impl"
assert_routes "a build-me request routes to opus-executor" \
  "look at this design file, study all the artboards, and build me a design system" \
  "opus-executor"

# Defect D adversarial negatives - deliberation, negation and reported speech
# built from the SAME opener tokens the widening added (i/we, need to, want you
# to, can you, please) and the SAME verbs (run an analysis, scan, breakdown,
# explore, modify, build me). The openers are verb phrases, so they must sit
# inside an optional prefix group behind a real clause boundary, never as
# boundary tokens of their own.
#
# MECHANISM AUDIT (measured 2026-07-28, per-row mutation). These rows do NOT all
# prove the boundary rule the paragraph above describes. Three shapes are present
# and they are not interchangeable:
#   BOUNDARY  strip the imperative prefix group and the row goes red. Real evidence
#             about the shipped pattern shape. (the two reported-speech rows and the
#             rhetorical-question row below)
#   WIDENING  green under every revert of the SHIPPED lexicon; only goes red if the
#             openers are promoted INTO the boundary alternation, which is the
#             widening that was measured and reverted on 2026-07-27. A guard against
#             re-landing that, not evidence about what shipped. Labelled as such.
#   DOUBLE    held by suppress.deliberation_markers AND by the boundary rule, so
#             neither revert alone turns it red. Real regression rows, weak evidence.
# Do not read a green row here as proof the boundary rule works; read the label.
# WIDENING: only the opener-as-boundary-token widening turns this red.
assert_silent "deliberating about an analysis does not route" \
  "do we need to run an analysis on those four repos before the release, or not"
# DOUBLE: "dont" is also a deliberation marker, so neither revert alone turns it red.
assert_silent "negated scan intent does not route" \
  "i dont think we need to scan the project folders for time spent, it is fine"
# DOUBLE: "do not" is also a deliberation marker.
assert_silent "an explicit refusal to modify does not route" \
  "i do not want you to modify the generator to support localstorage; explain first"
# BOUNDARY: strip the imperative prefix group and these two go red.
assert_silent "reported speech about a build request does not route" \
  "the issue title says build me a dashboard for the metrics, but I need triage notes"
assert_silent "reported speech about exploring does not route" \
  "the proposal says explore the sidecoach directory next, but I only want risks"
# REPAIRED 2026-07-28 - this row was VACUOUS. Its prompt was "do we need a breakdown
# of every project last week...", and the breakdown matcher requires one of
# `give me|i need|i want|i'd like` before "a breakdown of". "we need" is in none of
# them, so the prompt matched NOTHING in any lexicon state: guards on, guards off,
# patterns reverted. It could not fail for the reason it names. Rebuilt from the
# matcher's OWN tokens ("i need a breakdown of") behind a deliberation, so removing
# suppress.deliberation_markers now turns it red.
assert_silent "deliberating about a breakdown does not route" \
  "do we need this at all; i need a breakdown of every project last week before the retro"
# DOUBLE: "should we" is also a deliberation marker.
assert_silent "an open question about exploring does not route" \
  "should we explore the parser directory or leave it alone until the release ships"
# BOUNDARY: strip the imperative prefix group and this goes red.
assert_silent "a rhetorical question about scanning does not route" \
  "why would i want you to scan the project folders when the report already exists"

# ---------------------------------------------------------------------------
# Findings from the cross-model (Codex) review of the widening above. Each of
# these fired on the first version of the fix; the exact strings are kept so a
# future edit cannot quietly reintroduce them.
# ---------------------------------------------------------------------------

# An opener is a VERB PHRASE, so after a bare conjunction it reads as continued
# deliberation, not instruction. Only string-start or sentence punctuation may
# introduce an opener; the conjunction branch admits softeners alone.
# DOUBLE, both rows: each also carries a deliberation marker ("should we", "do not"),
# so neither the boundary revert nor the marker removal alone turns them red. They
# are regression rows for two strings that really fired, not evidence that the
# conjunction branch is what holds them.
assert_silent "an opener after a conjunction is not an instruction" \
  "should we update the parser and need to scan project folders for time spent now"
assert_silent "an opener after a conjunction inside a negation does not route" \
  "i do not want this, and need to scan project folders for time spent is wrong"
# REPAIRED 2026-07-28 - this row was VACUOUS. Its prompt was "do we need to scan the
# repo and need a breakdown of the risks...". The scan matcher needs
# `for|folders|dirs|directories` after its object ("scan the repo and" supplies none),
# and the breakdown matcher needs "i need", not a bare "need". Neither could fire in
# ANY lexicon state, so the row asserted silence that nothing produced. Rebuilt on the
# scan matcher's conjunction branch, which does fire here, so the deliberation marker
# is what holds it and removing the markers turns it red.
assert_silent "a trailing deliberation clause does not route" \
  "do we need a cleanup pass and scan the project folders for time spent before the retro"

# Sentence punctuation only bounds a clause when whitespace follows it.
# Otherwise a dotted slug manufactures a boundary mid-token.
assert_silent "a dotted slug is not a clause boundary" \
  "the issue title says v2.build me a dashboard for metrics, but i need triage notes"
assert_silent "a dotted path fragment is not a clause boundary" \
  "the proposal slug is draft.explore /tmp/foo next, but i only want the risks"

# The deictic guard binds every token of an identifier slot, not just the head.
assert_silent "a deictic in a later slot token still blocks the lookup" \
  "where is the flag for that configured in this project, i cannot find it"
assert_silent "a deictic object in a whether-check still blocks the lookup" \
  "check whether the value for this exists before we change anything at all"

# The brief exemptions must not swallow genuine requests that merely open with
# brief-like words. A brief marker alone is not enough; a co-marker is required.
assert_routes "a real request opening with 'you are' still routes" \
  "You are an expert in this codebase; rename parser to lexer across every call site." \
  "sonnet-impl"
assert_routes "a real request mentioning a teammate still routes" \
  "Teammate asked me to find all the stale references in the hooks; can you do that?" \
  "Explore"

# --- second cross-model review pass -----------------------------------------

# A conjunction only bounds a clause when whitespace precedes it, or a dotted
# slug smuggles one in ("v2.then build me ...").
assert_silent "a dotted slug before a conjunction is not a clause boundary" \
  "the issue title says v2.then build me a dashboard for metrics, but i need notes"
assert_silent "a dotted slug before an adverb is not a clause boundary" \
  "the proposal slug is draft.now scan project folders for time spent, only triage"

# A bare first-person subject is not an opener. Without this, a declarative
# ("i scan project folders every friday") reads as a command.
assert_silent "a first-person declarative is not an instruction" \
  "i scan project folders for time spent every friday before the weekly report"
assert_silent "a first-person plural declarative is not an instruction" \
  "we run an analysis on the four repos every friday before the planning meeting"

# "i need"/"i want" live in the breakdown phrase itself, so no boundary rule
# reaches them; that shape is only accepted at the head of a request.
# REPAIRED 2026-07-28 - the prompt opened "should we update the parser and ...", and
# "should we" is a deliberation marker, so the row stayed green under the boundary
# revert it was named for: the marker was doing the work. The opener is dropped so
# the head-of-request rule is now the SOLE mechanism, and stripping the imperative
# prefix group turns this red.
assert_silent "a breakdown phrase after a conjunction does not route" \
  "update the parser and i need a breakdown of the risks before the retro today"

# The brief exemption keys off a brief HEAD (a named agent or a brief-shaped
# participle), not off any prompt that happens to say "do not commit".
assert_routes "a request that merely says do not commit still routes" \
  "You are right, rename parser to lexer across every call site, but do not commit." \
  "sonnet-impl"

# The opener group now carries refactor/redesign too - the phrasing the earlier
# reverted widening was trying to recover. It is safe here only because the
# openers sit behind a real clause boundary; the eleven deliberation probes
# above are what hold that down.
assert_routes "an opener-led refactor routes to opus-executor" \
  "need to refactor the parser module across every file that imports it today" \
  "opus-executor"
assert_routes "a first-person opener-led redesign routes to opus-executor" \
  "i want you to redesign the settings page so it matches the new flow exactly" \
  "opus-executor"

# ---------------------------------------------------------------------------
# MID-SENTENCE DELIBERATION AND NEGATION (2026-07-28).
#
# The imperative shape anchored the verb to a clause boundary, but a SEMICOLON
# counts as one and the conjunction branch accepts any preceding whitespace, so
# ordinary deliberating prose reached the most expensive tier. Reproduced by the
# lead: "i wonder if we should; refactor the parser or leave it alone?" and
# "do not proceed; refactor the router is exactly what we must avoid." both
# routed. This is the same false-positive class that forced a revert earlier the
# same day - it had been relocated, not fixed.
#
# Two structural guards close it:
#   LOOKBEHIND - a negation/deliberation marker between the start of the SENTENCE
#                (split on . ! ? and newline only, NOT on ;) and the match.
#   NOMINAL    - the matched verb phrase is the SUBJECT of a copula
#                ("refactor the router IS exactly what we must avoid"), which is
#                a noun phrase, not an instruction.
#
# EVERY case below is labelled with the guard that UNIQUELY catches it, and that
# claim is mutation-proved: disable one guard and exactly its own group fails.
# The first draft of this block was not written that way - 8 of 12 cases carried
# both a marker AND a copula, so either guard alone kept them green and the
# labels were fiction. That is the vacuous-assertion shape this repo keeps
# finding; a test named for a mechanism must fail when that mechanism is removed.
# The two prompts the lead reproduced by hand are kept verbatim as regression
# rows even though they trip both guards, and are labelled as such rather than
# claiming a mechanism.

# -- the two hand-reproduced prompts (both guards apply; kept verbatim) --------
assert_silent "reproduced: a semicolon does not launder a deliberation" \
  "i wonder if we should; refactor the parser or leave it alone for now"
assert_silent "reproduced: a semicolon does not launder an explicit negation" \
  "do not proceed; refactor the router is exactly what we must avoid here"

# -- LOOKBEHIND only: a marker before the match, no copula after it ------------
assert_silent "lookbehind: a hedged plan is not an instruction" \
  "i am not sure yet; redesign the settings page before the holidays begin"
assert_silent "lookbehind: an explicit refusal survives a semicolon" \
  "we must avoid churn; refactor the parser module across every call site"
assert_silent "lookbehind: a maybe is not an instruction" \
  "maybe later; build me a dashboard for the quarterly metrics review"
assert_silent "lookbehind: a cannot-do report is not an instruction" \
  "we cannot ship that; modify generator to support localstorage for the demo"
assert_silent "lookbehind: a rather-than comparison is not an instruction" \
  "rather than that; scan the repo for dead code and report back to me"
assert_silent "lookbehind: an instead-of comparison is not an instruction" \
  "instead of a rewrite; explore the hooks directory and summarize the flow"
assert_silent "lookbehind: a wondering clause survives a conjunction" \
  "i wonder about the cost and refactor the parser module later this quarter"
assert_silent "lookbehind: a never-do rule is not an instruction" \
  "we never merge on fridays; migrate parser to lexer across the whole repo"

# -- NOMINAL only: no marker before the match, a copula after it ---------------
assert_silent "nominal: a gerund subject before a copula is not an instruction" \
  "the team argued and refactor the parser module is the wrong call here"
assert_silent "nominal: a past-tense copula tail is not an instruction" \
  "we reviewed the options and redesign the settings page was always a stretch"
assert_silent "nominal: a reported decision is not an instruction" \
  "the ticket says; refactor the router is exactly what the team decided on"
assert_silent "nominal: a scoping statement is not an instruction" \
  "the roadmap says; build me a design system is a next-quarter item now"

# The guards must not silence the imperatives they sit next to. Each of these
# carries a marker token in the SAME prompt, positioned so a sloppy prompt-wide
# scan would swallow it: after the match, or in a previous sentence.
assert_routes "a negation AFTER the imperative still routes" \
  "refactor the parser module across every file, but do not touch the tests" \
  "opus-executor"
assert_routes "a negation in a PREVIOUS sentence still routes" \
  "i was not sure about this yesterday. refactor the parser module today please" \
  "opus-executor"
assert_routes "a deliberation in a previous sentence still routes" \
  "i wonder how long this takes. build me a design system for the marketing site" \
  "opus-executor"

# ---------------------------------------------------------------------------
# AGENT/SYSTEM ENVELOPES MUST NEVER ROUTE (2026-07-28, measured not reasoned).
#
# `python3 claude/hooks/_tests/measure-hook-corpus.py --route` over 4021 real
# prompts: 22 routed, and ELEVEN of those 22 were envelopes - a task-notification
# body, a teammate brief, an injected skill body. Half of everything this hook
# said was spent on prompts no human wrote, and nudging a delegate to re-delegate
# is pure noise: the recipient IS the subagent.
#
# The prose-shaped brief markers in `exempt` never covered these, because an
# envelope is structural. Matched against the RAW prompt for the same reason
# grounding-gate does it: the scrub strips XML bodies, so a <task-notification>
# marker is gone before `exempt` could ever see it.
ENV_BODY="find all the callers of detect-session-model across the hooks directory"

assert_routes "control: the envelope BODY routes on its own" "$ENV_BODY" "Explore"

assert_silent "a bare teammate-message envelope does not route" \
  "<teammate-message teammate_id=\"team-lead\" color=\"green\"> $ENV_BODY"
assert_silent "a relayed teammate-message envelope does not route" \
  "Another Claude session sent a message: <teammate-message teammate_id=\"x\"> $ENV_BODY"
assert_silent "a task-notification envelope does not route" \
  "<task-notification> <task-id>a409fb</task-id> <status>completed</status> $ENV_BODY"
assert_silent "a system-reminder envelope does not route" \
  "<system-reminder> As you answer, use this context: $ENV_BODY"
assert_silent "an injected skill body does not route" \
  "Base directory for this skill: /Users/x/.claude/skills/icon-source

# Icon Source

$ENV_BODY"
assert_silent "a BOM does not smuggle an envelope past the anchor" \
  "$(printf '\xef\xbb\xbf')<task-notification> $ENV_BODY"

# Tightness, same rule as the grounding gate: the exemption keys on a STRUCTURAL
# marker, so a lookalike tag and ordinary prose must both still route.
assert_routes "tightness: a lookalike teammate tag still routes" \
  "<teammate-messages-digest> $ENV_BODY" "Explore"
assert_routes "tightness: prose about a task notification still routes" \
  "the task notification said it finished, so now $ENV_BODY" "Explore"

# CROSS-MODEL REVIEW ROUND 2 (Codex, 2026-07-28).
assert_silent "a dotted object inside the match does not collapse the lookbehind" \
  "i wonder if we should; migrate api. client to v2 or leave it alone for now"
assert_routes "tightness: the skill marker needs a PATH, not just the phrase" \
  "Base directory for this skill: $ENV_BODY" "Explore"
assert_silent "a left-to-right mark does not smuggle an envelope past the anchor" \
  "$(printf '\xe2\x80\x8e')<task-notification> $ENV_BODY"

# Guard the lexicon's declared order against a silent reorder.
assert_escalation_order() {
  local got
  got=$(python3 -c 'import json;print(",".join(json.load(open("'"$HOOK_DIR"'/route-intent.json"))["escalation_order"]))')
  if [ "$got" = "opus_executor,sonnet_impl,explore,quick_answer" ]; then
    pass "escalation_order is most-capable-first"
  else
    fail "escalation_order is most-capable-first" "got: $got"
  fi
}
assert_escalation_order

# Cooldown: a second nudge inside the window must stay silent, so an active
# build does not get re-nagged on every prompt.
cd_file=$(mktemp -t routeintent) || { echo "FATAL: mktemp failed - refusing to use an unset path" >&2; exit 2; }
rm -f "$cd_file"

run_hook_cd() {
  run_hook_raw "$(json_prompt "$1")" \
    ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=900
}

run_hook_cd "find all the callers of detect-session-model in the hooks directory"
first="$HOOK_OUT"; first_err="$HOOK_ERR"
run_hook_cd "find all the callers of make_symlink in the installer script"
second="$HOOK_OUT"; second_err="$HOOK_ERR"

if [ -n "$first" ] && [ -z "$first_err" ]; then pass "first nudge fires"; else fail "first nudge fires" "out=${first:-<silent>} err=${first_err:-<empty>}"; fi
if [ -z "$second" ] && [ -z "$second_err" ]; then pass "second nudge suppressed by cooldown"; else fail "second nudge suppressed by cooldown" "out=${second:-<empty>} err=${second_err:-<empty>}"; fi

# A zero-second window disables cooldown entirely.
rm -f "$cd_file"
run_hook_raw '{"prompt":"find all the callers of detect-session-model in the hooks directory"}' \
  ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=0
z1="$HOOK_OUT"; z1_err="$HOOK_ERR"
run_hook_raw '{"prompt":"find all the callers of make_symlink in the installer script"}' \
  ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=0
z2="$HOOK_OUT"; z2_err="$HOOK_ERR"
if [ -n "$z1" ] && [ -n "$z2" ] && [ -z "$z1_err" ] && [ -z "$z2_err" ]; then
  pass "cooldown 0 disables suppression"
else
  fail "cooldown 0 disables suppression" "z1=${z1:-<silent>} z2=${z2:-<silent>} err1=${z1_err:-<empty>} err2=${z2_err:-<empty>}"
fi
rm -f "$cd_file"

# The hook sits in the prompt path. No input may make it fail loudly, emit
# junk, or return non-zero - any of those would break every turn.
assert_failopen() {
  local label="$1" stdin_payload="$2"
  run_hook_raw "$stdin_payload"
  if [ "$HOOK_RC" -eq 0 ] && hook_wrote_nothing; then
    pass "$label"
  else
    fail "$label" "rc=$HOOK_RC out=${HOOK_OUT:-<empty>}(${HOOK_OUT_BYTES}B) err=${HOOK_ERR:-<empty>}(${HOOK_ERR_BYTES}B)"
  fi
}

assert_failopen "malformed json exits 0 silently"   'not json at all {{{'
assert_failopen "empty stdin exits 0 silently"      ''
assert_failopen "null prompt exits 0 silently"      '{"prompt": null}'
assert_failopen "array payload exits 0 silently"    '[1,2,3]'
assert_failopen "whitespace prompt exits 0 silently" '{"prompt": "     "}'

# The prompt is handed to python3 through the ENVIRONMENT, and env counts against
# ARG_MAX (1 MB on macOS). A paste past that made exec fail with "Argument list too
# long" on STDERR while rc stayed 0 and stdout stayed empty - invisible to a suite
# that discards stderr. The in-python length bail cannot help here, because python3
# is never reached; the guard has to be in the bash wrapper.
assert_failopen "paste past ARG_MAX is silent on BOTH streams" \
  "$(python3 -c 'import json; print(json.dumps({"prompt": "please refactor the flow handler " + "x"*1200000}))')"

# A corrupt lexicon must degrade to silence, never to an error.
bad_lex=$(mktemp -t routelex) || { echo "FATAL: mktemp failed - refusing to use an unset path" >&2; exit 2; }
echo '{ this is not valid json' > "$bad_lex"
run_hook_raw '{"prompt":"find all the callers of detect-session-model in the hooks dir"}' \
  ROUTE_INTENT_LEXICON="$bad_lex"
if [ "$HOOK_RC" -eq 0 ] && hook_wrote_nothing; then
  pass "corrupt lexicon exits 0 silently"
else
  fail "corrupt lexicon exits 0 silently" "rc=$HOOK_RC out=${HOOK_OUT:-<empty>} err=${HOOK_ERR:-<empty>}"
fi
rm -f "$bad_lex"

# A lexicon with an invalid regex must skip that pattern, not crash.
bad_re=$(mktemp -t routelex2) || { echo "FATAL: mktemp failed - refusing to use an unset path" >&2; exit 2; }
python3 -c '
import json
lex = json.load(open("'"$HOOK_DIR"'/route-intent.json"))
lex["tiers"]["explore"]["patterns"] = ["([unclosed", "find (all|every|each) "]
json.dump(lex, open("'"$bad_re"'", "w"))
'
run_hook_raw '{"prompt":"find all the callers of detect-session-model in the hooks dir"}' \
  ROUTE_INTENT_LEXICON="$bad_re" ROUTE_INTENT_COOLDOWN=0
if [ "$HOOK_RC" -eq 0 ] && [ -z "$HOOK_ERR" ] && printf '%s' "$HOOK_OUT" | grep -qF "Explore"; then
  pass "invalid regex is skipped, valid one still matches"
else
  fail "invalid regex is skipped, valid one still matches" "rc=$HOOK_RC out=${HOOK_OUT:-<silent>} err=${HOOK_ERR:-<empty>}"
fi
rm -f "$bad_re"

# ---------------------------------------------------------------------------
# Lexicon TYPE validation. A string where a list belongs iterates character by
# character, and every single character is a valid regex - so a malformed
# opus_executor tier would match nearly every prompt and route the whole session
# to the most expensive model. The same shape applies to `exempt`, where it
# silences the hook entirely instead.
# ---------------------------------------------------------------------------
assert_type_guard() {
  local label="$1" mutation="$2" expect="$3" lex
  lex=$(mktemp -t routetype) || { echo "FATAL: mktemp failed - refusing to use an unset path" >&2; exit 2; }
  MUT="$mutation" OUT="$lex" python3 -c '
import json, os
lex = json.load(open("'"$HOOK_DIR"'/route-intent.json"))
exec(os.environ["MUT"], {"lex": lex})
json.dump(lex, open(os.environ["OUT"], "w"))
'
  run_hook_raw '{"prompt":"find all the callers of detect-session-model in the hooks dir"}' \
    ROUTE_INTENT_LEXICON="$lex" ROUTE_INTENT_COOLDOWN=0
  if [ "$HOOK_RC" -eq 0 ] && [ -z "$HOOK_ERR" ] && printf '%s' "$HOOK_OUT" | grep -qF "$expect"; then
    pass "$label"
  else
    fail "$label" "expected '$expect', rc=$HOOK_RC out=${HOOK_OUT:-<silent>} err=${HOOK_ERR:-<empty>}"
  fi
  rm -f "$lex"
}

assert_type_guard "a string patterns value does not hijack routing to opus" \
  'lex["tiers"]["opus_executor"]["patterns"] = "refactor"' "Explore"
assert_type_guard "a string exempt value does not silence every prompt" \
  'lex["exempt"] = "abc"' "Explore"

# ---------------------------------------------------------------------------
# Latency. The XML scrub uses a BACKREFERENCE, which defeats the regex engine's
# prefix optimization: an unbounded lazy gap makes every opening tag with no
# matching close walk to end of string. Void markup (<br>, <img>) is the common
# case in a pasted HTML snippet. Measured through the live hook before the fix:
# 5k <br> 0.33s, 20k <br> 3.82s, 40k <br> (156 KB) 14.94s - against the
# `timeout: 5` this hook is wired with in cluster-wirings.json.
# ---------------------------------------------------------------------------
assert_fast_and_silent() {
  local label="$1" payload="$2" budget="$3" t0 t1 elapsed
  t0=$(python3 -c 'import time; print(time.time())')
  run_hook_raw "$payload"
  t1=$(python3 -c 'import time; print(time.time())')
  elapsed=$(python3 -c "print('%.2f' % ($t1 - $t0))")
  if [ "$HOOK_RC" -ne 0 ] || [ -n "$HOOK_ERR" ]; then
    fail "$label" "rc=$HOOK_RC err=${HOOK_ERR:-<empty>}"
  elif python3 -c "import sys; sys.exit(0 if $elapsed < $budget else 1)"; then
    pass "$label (${elapsed}s)"
  else
    fail "$label" "took ${elapsed}s, budget ${budget}s"
  fi
}

# There are THREE size bands, each protected by a different guard, and each needs its
# own case. A single large payload proves whichever guard happens to fire first and
# says nothing about the others.
#
#   > 100000 chars   the bash-side ARG_MAX guard   (1.2 MB case above, ~line 304)
#   > 20000 chars    the in-python length bail     (78 KB case,  was  3.82s)
#   <= 20000 chars   the bounded scrub span        (19.6 KB case, was  0.27s)
#
# The 156 KB case below sits above BOTH of the first two guards, so it discriminates
# neither: delete the bash guard and the in-python bail keeps it silent, delete the
# bail and the bash guard does. What it does hold down is wall clock - it was 14.94s
# against a 5s timeout before the scrub span was bounded. The bash ARG_MAX guard is
# proved by the 1.2 MB assertion instead, which is the one that actually goes loud
# ("Argument list too long" on stderr) when that guard is removed.
assert_fast_and_silent "a 156 KB markup paste is handled quickly and silently" \
  "$(python3 -c 'import json; print(json.dumps({"prompt": "please refactor the flow handler " + "<br>"*40000}))')" \
  1.0
# Between the two guards: over the in-python bail, under the bash one.
assert_fast_and_silent "a 78 KB markup paste is handled quickly and silently" \
  "$(python3 -c 'import json; print(json.dumps({"prompt": "please refactor the flow handler " + "<br>"*20000}))')" \
  1.0
# Under both guards, where only the bounded scrub span applies.
assert_fast_and_silent "dense markup just under the length bail is still fast" \
  "$(python3 -c 'import json; print(json.dumps({"prompt": "please refactor the flow handler " + "<br>"*4900}))')" \
  1.0

# The two guards MASK EACH OTHER in wall-clock terms, so each one also gets a
# structural assertion. This is deliberate, and worth stating plainly because it is
# the kind of thing a later reader will try to "simplify" away.
#
# Measured on the 78 KB payload above: intact 0.06s; length bail removed but span
# still bounded 0.27s; span unbounded but bail still present 0.06s; BOTH removed
# ~3.8s. So a timing test catches the pair but neither half alone - remove either
# one and the other keeps the clock under any threshold a non-flaky test could use.
# The timing cases above stay as the behavioral backstop against a future regression
# by any mechanism; these two catch the individual halves going missing.
assert_bounded_scrub() {
  local label="the XML scrub quantifier stays bounded" line
  line=$(grep -F 'a-zA-Z' "$HOOK" | grep -F '</\1>')
  if [ -z "$line" ]; then
    fail "$label" "could not find the XML scrub line in $HOOK"
  elif printf '%s' "$line" | grep -qE '\.\{0,[0-9]+\}\?'; then
    pass "$label"
  else
    fail "$label" "unbounded quantifier in the XML scrub: $line"
  fi
}
assert_bounded_scrub

# The length bail gets a BEHAVIORAL assertion rather than a structural one, because a
# structural check ("a line shaped like `if len(prompt) > N:` exists") would still
# pass if the body stopped exiting. This payload is over the in-python bail and under
# the bash-side guard, and its opening words route to opus-executor on their own - so
# silence here can only mean the bail fired.
assert_silent "a prompt over the length bail is not routed" \
  "refactor the flow handler and $(python3 -c 'print("x"*25000)')"

# The hook must be registered in cluster-wirings.json so `install.sh` can
# deploy it on a fresh machine, not just on the machine that authored it.
assert_wired() {
  local label="$1"
  if python3 -c '
import json,sys
w = json.load(open("'"$HOOK_DIR"'/cluster-wirings.json"))
entry = w.get("route-intent.sh")
sys.exit(0 if entry and any(e.get("event")=="UserPromptSubmit" or "UserPromptSubmit" in json.dumps(e) for e in (entry if isinstance(entry,list) else [entry])) else 1)
' 2>/dev/null; then
    pass "$label"
  else
    fail "$label" "route-intent.sh missing or not UserPromptSubmit in cluster-wirings.json"
  fi
}
assert_wired "route-intent.sh is wired in cluster-wirings.json"

# ---------------------------------------------------------------------------
# The installer must actually DEPLOY the cluster.
#
# This was `grep -q 'agent-routing' install.sh`, which cannot fail: the word appears
# in a DESCS paragraph, in a comment, and in the --help text. Deleting the real
# `agent-routing)` case from cluster_hooks() left it green, and nothing covered the
# lexicon or roster deploy at all.
#
# So: run the REAL cluster_hooks() function, and read the REAL deploy block.
# ---------------------------------------------------------------------------

# Extract one shell function body from install.sh by name. install.sh is `set -euo
# pipefail` top to bottom and cannot be sourced, so the function is lifted out and
# eval'd on its own.
extract_fn() {
  awk -v want="$1() {" 'index($0, want) == 1 { f = 1 } f { print } f && /^\}$/ { exit }' \
    "$REPO_DIR/install.sh"
}

assert_cluster_hooks_case() {
  local label="cluster_hooks() returns route-intent.sh for agent-routing" fn got
  fn=$(extract_fn cluster_hooks)
  if [ -z "$fn" ]; then
    fail "$label" "could not extract cluster_hooks() from install.sh"; return
  fi
  got=$(bash -c "$fn"$'\n''cluster_hooks agent-routing' 2>/dev/null)
  if [ "$got" = "route-intent.sh" ]; then
    pass "$label"
  else
    fail "$label" "expected 'route-intent.sh', got: ${got:-<empty>}"
  fi
}
assert_cluster_hooks_case

# Strip shell comments. Without this every assertion below is satisfiable by a
# COMMENT - including the comments in install.sh that name the very bug being
# guarded against ("a bare `ln -sf` here dangled..."). Comment-only matches are the
# same class of vacuous assertion this whole section exists to replace.
code_only() { sed 's/[[:space:]]#.*$//; /^[[:space:]]*#/d'; }

# The route-intent arm of the cluster deploy loop, and the agent-routing arm of
# deactivate_cluster. Both are read as BLOCKS so a match cannot come from prose
# elsewhere in the file.
route_deploy_block=$(awk '/route-intent\.sh" \]; then/ { f = 1 } f { print } f && /^[[:space:]]*fi[[:space:]]*$/ { exit }' "$REPO_DIR/install.sh" | code_only)
deactivate_block=$(extract_fn deactivate_cluster | code_only)

assert_block_has() {
  local label="$1" block="$2" needle="$3"
  if [ -z "$block" ]; then
    fail "$label" "could not extract the block from install.sh"
  elif printf '%s' "$block" | grep -qF "$needle"; then
    pass "$label"
  else
    fail "$label" "block does not mention '$needle'"
  fi
}
assert_block_lacks() {
  local label="$1" block="$2" needle="$3"
  if [ -z "$block" ]; then
    fail "$label" "could not extract the block from install.sh"
  elif printf '%s' "$block" | grep -qF "$needle"; then
    fail "$label" "block still uses '$needle'"
  else
    pass "$label"
  fi
}

# The lexicon deploy moved OUT of this per-hook block and into the shared
# hook_data_files()/install_hook_data() table (2026-07-27), because the same
# silent-fail-open bug had to be fixed a second time for grounding-intent.json.
# So this is no longer a substring check on the block - it EXECUTES the real
# functions, which is strictly stronger: it proves the file actually lands, not
# merely that install.sh mentions its name somewhere.
route_data_probe() {
  local sb; sb="$(mktemp -d)" || { echo "FATAL: mktemp -d failed - refusing to use an unset path" >&2; exit 2; }
  (
    CLAUDE_DIR="$sb/claude"; REPO_DIR="$REPO_DIR"
    mkdir -p "$CLAUDE_DIR/hooks"
    # Real function text, extracted verbatim rather than paraphrased.
    eval "$(awk '/^hook_data_files\(\) \{/,/^\}/'   "$REPO_DIR/install.sh")"
    eval "$(awk '/^install_hook_data\(\) \{/,/^\}/' "$REPO_DIR/install.sh")"
    link_or_copy_data() { ln -sf "$1" "$2"; }
    install_hook_data "route-intent.sh"
    [ -e "$CLAUDE_DIR/hooks/route-intent.json" ] && echo LANDED
  )
  rm -rf "$sb"
}
if [ "$(route_data_probe)" = "LANDED" ]; then
  pass "installer deploys route-intent.json (via hook_data_files, executed)"
else
  fail "installer deploys route-intent.json" "install_hook_data route-intent.sh did not produce the lexicon"
fi
assert_block_has "installer deploys the agents roster"  "$route_deploy_block" "claude/agents"
# The lexicon and roster must follow the SAME symlink-vs-copy decision the hook made.
# A bare `ln -sf` dangles on every copy-mode install (the throwaway-clone case),
# leaving the hook alive but permanently lexicon-less and the roster unresolvable.
assert_block_has "data files deploy via the deploy-mode helper" "$route_deploy_block" "link_or_copy_data"
assert_block_lacks "data files do not deploy via a bare ln -sf" "$route_deploy_block" "ln -sf"

# cluster_hooks only knows .sh members, so removing the cluster leaves its data
# files behind unless deactivate_cluster names them explicitly.
# Removal is now table-driven too: deactivate_cluster loops hook_data_files over each
# cluster member. Assert the LOOP is there AND that the table still maps this hook -
# together those are equivalent to the old literal check, and they also cover every
# other companion rather than just this one.
assert_block_has "deactivate_cluster removes companion data" "$deactivate_block" "hook_data_files"
assert_block_has "deactivate_cluster removes it via rm_data_if_ours" "$deactivate_block" "rm_data_if_ours"
if [ "$(bash -c "eval \"\$(awk '/^hook_data_files\(\) \{/,/^\}/' '$REPO_DIR/install.sh')\"; hook_data_files route-intent.sh")" = "route-intent.json" ]; then
  pass "hook_data_files maps route-intent.sh -> route-intent.json"
else
  fail "hook_data_files maps route-intent.sh -> route-intent.json" "table lookup returned the wrong value"
fi
assert_block_has "deactivate_cluster removes the roster"  "$deactivate_block" "claude/agents"

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
