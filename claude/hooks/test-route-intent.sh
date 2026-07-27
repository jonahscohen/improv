#!/bin/bash
# Regression tests for route-intent.sh and the agent roster.
# Run: bash claude/hooks/test-route-intent.sh
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$HOOK_DIR/../.." && pwd)"
HOOK="$HOOK_DIR/route-intent.sh"
AGENTS_DIR="$REPO_DIR/claude/agents"

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
