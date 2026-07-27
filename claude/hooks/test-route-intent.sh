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

run_hook() {
  local prompt="$1" input
  input=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$prompt")
  echo "$input" | bash "$HOOK" 2>/dev/null
}

# Assert the hook fires and names the expected agent.
assert_routes() {
  local label="$1" prompt="$2" expected_agent="$3" out
  out=$(run_hook "$prompt")
  if echo "$out" | grep -qF "$expected_agent"; then
    pass "$label"
  else
    fail "$label" "expected agent '$expected_agent', got: ${out:-<silent>}"
  fi
}

# Assert the hook produces no output at all.
assert_silent() {
  local label="$1" prompt="$2" out
  out=$(run_hook "$prompt")
  if [ -z "$out" ]; then
    pass "$label"
  else
    fail "$label" "expected silence, got: $out"
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
assert_silent "pattern inside a code fence does not route" \
  'here is the snippet I mean:
```
rename foo to bar across every call site in the repo
```
does that look right to you or not'
assert_silent "pattern inside inline backticks does not route" \
  'the docs literally say `find all the callers` which I think is wrong, is it'
assert_silent "pattern inside an XML body does not route" \
  "<quote>find all the callers of detect-session-model</quote> was the wording in the old ticket we archived"

# A prompt matching BOTH sonnet_impl and opus_executor must resolve to the
# more capable tier. Routing too low produces work that has to be redone.
assert_routes "multi-tier prompt escalates to opus-executor" \
  "refactor the flow handler and update every reference to the old name" \
  "opus-executor"
assert_routes "sweep plus lookup escalates to Explore" \
  "find all the places where the cooldown value is set and tell me which file owns it" \
  "Explore"

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
  local prompt="$1" input
  input=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$prompt")
  echo "$input" | ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=900 bash "$HOOK" 2>/dev/null
}

first=$(run_hook_cd "find all the callers of detect-session-model in the hooks directory")
second=$(run_hook_cd "find all the callers of make_symlink in the installer script")

if [ -n "$first" ]; then pass "first nudge fires"; else fail "first nudge fires" "got silence"; fi
if [ -z "$second" ]; then pass "second nudge suppressed by cooldown"; else fail "second nudge suppressed by cooldown" "got: $second"; fi

# A zero-second window disables cooldown entirely.
rm -f "$cd_file"
z1=$(echo '{"prompt":"find all the callers of detect-session-model in the hooks directory"}' | ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=0 bash "$HOOK" 2>/dev/null)
z2=$(echo '{"prompt":"find all the callers of make_symlink in the installer script"}' | ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=0 bash "$HOOK" 2>/dev/null)
if [ -n "$z1" ] && [ -n "$z2" ]; then pass "cooldown 0 disables suppression"; else fail "cooldown 0 disables suppression" "z1=${z1:-<silent>} z2=${z2:-<silent>}"; fi
rm -f "$cd_file"

# The hook sits in the prompt path. No input may make it fail loudly, emit
# junk, or return non-zero - any of those would break every turn.
assert_failopen() {
  local label="$1" stdin_payload="$2" out rc
  out=$(printf '%s' "$stdin_payload" | bash "$HOOK" 2>/dev/null); rc=$?
  if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
    pass "$label"
  else
    fail "$label" "rc=$rc out=${out:-<empty>}"
  fi
}

assert_failopen "malformed json exits 0 silently"   'not json at all {{{'
assert_failopen "empty stdin exits 0 silently"      ''
assert_failopen "null prompt exits 0 silently"      '{"prompt": null}'
assert_failopen "array payload exits 0 silently"    '[1,2,3]'
assert_failopen "whitespace prompt exits 0 silently" '{"prompt": "     "}'

# A corrupt lexicon must degrade to silence, never to an error.
bad_lex=$(mktemp -t routelex); echo '{ this is not valid json' > "$bad_lex"
out=$(echo '{"prompt":"find all the callers of detect-session-model in the hooks dir"}' | ROUTE_INTENT_LEXICON="$bad_lex" bash "$HOOK" 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && [ -z "$out" ]; then pass "corrupt lexicon exits 0 silently"; else fail "corrupt lexicon exits 0 silently" "rc=$rc out=$out"; fi
rm -f "$bad_lex"

# A lexicon with an invalid regex must skip that pattern, not crash.
bad_re=$(mktemp -t routelex2)
python3 -c '
import json
lex = json.load(open("'"$HOOK_DIR"'/route-intent.json"))
lex["tiers"]["explore"]["patterns"] = ["([unclosed", "find (all|every|each) "]
json.dump(lex, open("'"$bad_re"'", "w"))
'
out=$(echo '{"prompt":"find all the callers of detect-session-model in the hooks dir"}' | ROUTE_INTENT_LEXICON="$bad_re" ROUTE_INTENT_COOLDOWN=0 bash "$HOOK" 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && echo "$out" | grep -qF "Explore"; then pass "invalid regex is skipped, valid one still matches"; else fail "invalid regex is skipped, valid one still matches" "rc=$rc out=${out:-<silent>}"; fi
rm -f "$bad_re"

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
