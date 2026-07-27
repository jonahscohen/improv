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
  local got
  got=$(awk '/^---$/{n++; next} n==1 && /^tools:/{sub(/^tools:[[:space:]]*/,""); print; exit}' "$AGENTS_DIR/$file")
  if [ "$got" = "$expected" ]; then
    pass "$label"
  else
    fail "$label" "expected tools: $expected, got: ${got:-<none>}"
  fi
}

assert_agent_model "quick-answer is haiku"   quick-answer.md  haiku
assert_agent_model "sonnet-impl is sonnet"   sonnet-impl.md   sonnet
assert_agent_model "opus-executor is opus"   opus-executor.md opus
assert_agent_tools "quick-answer is read-only" quick-answer.md "Read, Grep, Glob"

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
