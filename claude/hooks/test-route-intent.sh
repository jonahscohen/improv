#!/bin/bash
# Regression tests for route-intent.sh and the agent roster.
# Run: bash claude/hooks/test-route-intent.sh
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
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
export ROUTE_INTENT_COOLDOWN_FILE="$(mktemp -t routeintent-default)"
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
  outfile=$(mktemp -t routeintent-out); errfile=$(mktemp -t routeintent-err)
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
# determiner-led object. These three cases hit no exempt pattern, so silence here can
# only come from the pattern shape itself.
assert_silent "a negated refactor mention does not route" \
  "do not refactor it, just explain why the current shape is so slow to run"
assert_silent "a past-tense redesign complaint does not route" \
  "i hate the redesign we shipped last quarter and it still bothers me today"
assert_silent "deliberating about a refactor does not route" \
  "should we refactor this or leave it alone until the next release cycle"
# A softener ("please", "can you") is NOT a clause boundary of its own. Treating it as
# one let a deliberation through: "should we please refactor..." matched on `please`
# sitting mid-clause. The softeners are inside the optional group instead.
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
# The clause-boundary alternation started as sentence punctuation plus and/then/now/
# also/next, which is how a boundary looks in WRITTEN prose but not in how people
# actually open an instruction. All four below were silent on a real multi-file
# refactor request, every one of them well past the length gate. "we need to" firing
# while "should we" stays silent above is the pair that keeps this honest: the added
# tokens commit to an action, they do not open a deliberation.
assert_routes "a want-you-to imperative routes to opus-executor" \
  "i want you to refactor the parser module across every call site" \
  "opus-executor"
assert_routes "a lets imperative routes to opus-executor" \
  "lets refactor the parser module across every call site in the repo" \
  "opus-executor"
assert_routes "a need-to imperative routes to opus-executor" \
  "we need to refactor the parser module across every call site" \
  "opus-executor"
assert_routes "a time-to imperative routes to opus-executor" \
  "time to refactor the parser module across every call site now" \
  "opus-executor"

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
cd_file=$(mktemp -t routeintent)
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
bad_lex=$(mktemp -t routelex); echo '{ this is not valid json' > "$bad_lex"
run_hook_raw '{"prompt":"find all the callers of detect-session-model in the hooks dir"}' \
  ROUTE_INTENT_LEXICON="$bad_lex"
if [ "$HOOK_RC" -eq 0 ] && hook_wrote_nothing; then
  pass "corrupt lexicon exits 0 silently"
else
  fail "corrupt lexicon exits 0 silently" "rc=$HOOK_RC out=${HOOK_OUT:-<empty>} err=${HOOK_ERR:-<empty>}"
fi
rm -f "$bad_lex"

# A lexicon with an invalid regex must skip that pattern, not crash.
bad_re=$(mktemp -t routelex2)
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
  lex=$(mktemp -t routetype)
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

assert_block_has "installer deploys route-intent.json"  "$route_deploy_block" "route-intent.json"
assert_block_has "installer deploys the agents roster"  "$route_deploy_block" "claude/agents"
# The lexicon and roster must follow the SAME symlink-vs-copy decision the hook made.
# A bare `ln -sf` dangles on every copy-mode install (the throwaway-clone case),
# leaving the hook alive but permanently lexicon-less and the roster unresolvable.
assert_block_has "data files deploy via the deploy-mode helper" "$route_deploy_block" "link_or_copy_data"
assert_block_lacks "data files do not deploy via a bare ln -sf" "$route_deploy_block" "ln -sf"

# cluster_hooks only knows .sh members, so removing the cluster leaves its data
# files behind unless deactivate_cluster names them explicitly.
assert_block_has "deactivate_cluster removes the lexicon" "$deactivate_block" "route-intent.json"
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
