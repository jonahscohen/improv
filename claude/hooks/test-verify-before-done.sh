#!/bin/bash
# Regression tests for verify-before-done.sh (T-0017).
# Run: bash ~/.claude/hooks/test-verify-before-done.sh
#
# Exercises the Bash-branch screenshot-mandate gate against verification-only
# commands (must NOT fire the mandate) and against real deploy/build commands
# (must STILL fire). Origin: 2026-05-28 roadmap session where the hook fired
# 4+ times on plain `npx ts-node ...test.ts` invocations and `npm run bench`
# runs - because `npx ` and `npm run build` were substrings in
# `write_indicators` with no offsetting test-command detector.
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK="$HOOK_DIR/verify-before-done.sh"

PASS=0
FAIL=0
FAIL_LABELS=()

# Run the hook with a Bash tool_input.command payload, return the JSON output.
run_hook() {
  local cmd="$1"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$cmd")
  echo "$input" | bash "$HOOK" 2>/dev/null
}

# Assert the hook silently allows the command (no CODE DEPLOYED mandate text).
assert_skips() {
  local label="$1"
  local cmd="$2"
  local out
  out=$(run_hook "$cmd")
  if echo "$out" | grep -q 'CODE DEPLOYED'; then
    echo "FAIL: $label  (expected SKIP, got mandate: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  else
    echo "PASS: $label"
    ((PASS++))
  fi
}

# Assert the hook fires the CODE DEPLOYED mandate for this command.
assert_fires() {
  local label="$1"
  local cmd="$2"
  local out
  out=$(run_hook "$cmd")
  if echo "$out" | grep -q 'CODE DEPLOYED'; then
    echo "PASS: $label"
    ((PASS++))
  else
    echo "FAIL: $label  (expected FIRE, got: $out)"
    FAIL_LABELS+=("$label")
    ((FAIL++))
  fi
}

echo "===== SKIP: test runners ====="
assert_skips "npm test"                   "npm test"
assert_skips "npm run test"               "npm run test"
assert_skips "npm run test:unit"          "npm run test:unit"
assert_skips "npm run test:e2e -- --watch" "npm run test:e2e -- --watch"
assert_skips "yarn test"                  "yarn test"
assert_skips "pnpm test"                  "pnpm test"
assert_skips "npx vitest"                 "npx vitest"
assert_skips "npx vitest run --reporter=verbose" "npx vitest run --reporter=verbose"
assert_skips "npx jest"                   "npx jest"
assert_skips "npx mocha"                  "npx mocha"
assert_skips "npx playwright test"        "npx playwright test"
assert_skips "npx ts-node test.ts"        "npx ts-node ./foo.test.ts"
assert_skips "npx ts-node test/helpers.ts" "npx ts-node test/helpers.ts"
assert_skips "npx ts-node spec/foo.ts"    "npx ts-node spec/foo.ts"
assert_skips "npx tsx test/spec.ts"       "npx tsx test/spec.ts"
assert_skips "node foo.test.ts"           "node foo.test.ts"
assert_skips "node bar.spec.js"           "node bar.spec.js"
assert_skips "bash test-foo.sh"           "bash test-foo.sh"
assert_skips "bash test-validation-guards.sh"  "bash test-validation-guards.sh"
assert_skips "bash claude/hooks/test-multiple-choice-enforce.sh" "bash claude/hooks/test-multiple-choice-enforce.sh"
assert_skips "cargo test"                 "cargo test"
assert_skips "cargo test --all"           "cargo test --all"
assert_skips "pytest"                     "pytest"
assert_skips "pytest tests/"              "pytest tests/"
assert_skips "python -m pytest"           "python -m pytest"
assert_skips "python3 -m pytest"          "python3 -m pytest tests/unit"
assert_skips "python -m unittest"         "python -m unittest"
assert_skips "go test ./..."              "go test ./..."
assert_skips "bun test"                   "bun test"
assert_skips "deno test"                  "deno test"
assert_skips "rspec spec/"                "rspec spec/"

echo ""
echo "===== SKIP: type checks ====="
assert_skips "npx tsc --noEmit"           "npx tsc --noEmit"
assert_skips "tsc --noEmit"               "tsc --noEmit"
assert_skips "npx tsc -p tsconfig.json"   "npx tsc -p tsconfig.json"
assert_skips "npm run typecheck"          "npm run typecheck"
assert_skips "npm run type-check"         "npm run type-check"
assert_skips "npm run check"              "npm run check"

echo ""
echo "===== SKIP: lint runs ====="
assert_skips "npm run lint"               "npm run lint"
assert_skips "npx eslint src/"            "npx eslint src/"
assert_skips "eslint ."                   "eslint ."
assert_skips "npx prettier --check ."     "npx prettier --check ."
assert_skips "prettier --check src"       "prettier --check src"
assert_skips "npx prettier --list-different src" "npx prettier --list-different src"
assert_skips "npx @google/design.md lint" "npx @google/design.md lint DESIGN.md"
assert_skips "npx stylelint"              "npx stylelint src/**/*.css"

echo ""
echo "===== SKIP: benchmark runs ====="
assert_skips "npm run bench"              "npm run bench"
assert_skips "npm run bench:compare"      "npm run bench:compare"
assert_skips "npm run bench:save-baseline" "npm run bench:save-baseline"
assert_skips "yarn bench"                 "yarn bench"
assert_skips "pnpm bench:compare"         "pnpm bench:compare"

echo ""
echo "===== SKIP: pure introspection ====="
# (Most go through is_read_only_command, but verify a chained git in middle.)
assert_skips "git status"                 "git status"
assert_skips "git log --oneline -10"      "git log --oneline -10"
assert_skips "git diff HEAD"              "git diff HEAD"
assert_skips "ls -la"                     "ls -la"
assert_skips "cat foo.txt"                "cat foo.txt"
assert_skips "grep -r foo src/"           "grep -r foo src/"
assert_skips "find . -name foo"           "find . -name foo"
assert_skips "head -20 file.log"          "head -20 file.log"
assert_skips "wc -l file"                 "wc -l file"
assert_skips "which node"                 "which node"

echo ""
echo "===== FIRE: actual deploy/build paths ====="
assert_fires "npm run build"              "npm run build"
assert_fires "npm run build --watch"      "npm run build --watch"

echo ""
echo "===== FIRE: write redirects + sed -i ====="
# These pre-existed in write_indicators - regression coverage.
assert_fires "cp src/foo.ts dest/"        "cp src/foo.ts dest/"
assert_fires "mv old.ts new.ts"           "mv old.ts new.ts"
assert_fires "sed -i 's/x/y/' src/foo.ts" "sed -i 's/x/y/' src/foo.ts"

echo ""
echo "===== EDGE CASES: chained commands ====="
# Verification-only command CHAINED with build - the build half must win
# (verified by `is_verification_only` returning False when ANY segment
# matches a deploy pattern, then falling through to write_indicators).
assert_fires "npx ts-node test.ts && npm run build"  "npx ts-node ./foo.test.ts && npm run build"
assert_fires "npx tsc --noEmit && npm run build"     "npx tsc --noEmit && npm run build"
assert_fires "npm run bench && npm run build"        "npm run bench && npm run build"
# Verification-only commands chained together - still skip.
assert_skips "npm test && npx tsc --noEmit"          "npm test && npx tsc --noEmit"
assert_skips "npx eslint . && npx prettier --check ." "npx eslint . && npx prettier --check ."
# Piped: lint output filtered through grep - still verification-only.
assert_skips "npx eslint . | grep error"             "npx eslint . | grep error"
# Semicolon-joined verification commands.
assert_skips "npm test; npx tsc --noEmit"            "npm test; npx tsc --noEmit"
# Known limitation (out of scope for T-0017): chains that START with a
# read-only command (git diff && X, ls && X) are intercepted by
# is_read_only_command's startswith() check before the deploy-pattern
# fallthrough can run. Fixing it requires chain-aware tokenization in
# is_read_only_command, separate task.

echo ""
echo "===== NEGATIVE: build look-alikes that should NOT skip ====="
# build:prod is a real build; write_indicators substring match on
# 'npm run build' still triggers, so this fires regardless of T-0017.
assert_fires "npm run build:prod"  "npm run build:prod"

echo ""
echo "===== ARM-SIDE FILE-TYPE FILTER (bug a): a .md-only Bash write must not re-arm ====="
# The flag-SET (arm) side of the Bash branch used to skip the file-type filter
# that the Write/Edit branch already applies via is_code_file. A .md-only write
# (cp/mv/sed/tee touching only markdown) therefore re-armed ~/.claude/.needs-verification
# right after a browser verification cleared it. These cases assert the arm flag
# directly (the stdout mandate is debounce-suppressible, so it is not a reliable
# signal for the arm side). Save + restore the real flag so a live session is safe.
VFLAG="$HOME/.claude/.needs-verification"
__VFLAG_EXISTED=no; __VFLAG_SAVED=""
if [ -f "$VFLAG" ]; then __VFLAG_EXISTED=yes; __VFLAG_SAVED="$(cat "$VFLAG" 2>/dev/null)"; fi
restore_vflag() { if [ "$__VFLAG_EXISTED" = yes ]; then printf '%s' "$__VFLAG_SAVED" > "$VFLAG"; else rm -f "$VFLAG"; fi; }

# Start from a CLEARED flag (a browser verification just cleared it), run the hook,
# report whether the arm flag is now present.
arm_state() { rm -f "$VFLAG"; run_hook "$1" >/dev/null 2>&1; [ -f "$VFLAG" ] && echo armed || echo clear; }
assert_no_rearm() {
  local got; got="$(arm_state "$2")"
  if [ "$got" = clear ]; then echo "PASS: $1"; ((PASS++));
  else echo "FAIL: $1  (expected clear, flag=$got)"; FAIL_LABELS+=("$1"); ((FAIL++)); fi
}
assert_arms() {
  local got; got="$(arm_state "$2")"
  if [ "$got" = armed ]; then echo "PASS: $1"; ((PASS++));
  else echo "FAIL: $1  (expected armed, flag=$got)"; FAIL_LABELS+=("$1"); ((FAIL++)); fi
}

assert_no_rearm "sed -i on a .md does not re-arm"   "sed -i 's/a/b/' README.md"
assert_no_rearm "cp .md to .md does not re-arm"     "cp draft.md final.md"
assert_no_rearm "tee into a .md does not re-arm"    "tee notes.md < input.txt"
assert_no_rearm "mv a .md does not re-arm"          "mv old.md new.md"
# Controls: a code-file write and a real build MUST still arm.
assert_arms     "cp a .ts (code) still arms"        "cp src/foo.ts dest/app.ts"
assert_arms     "sed -i a .ts (code) still arms"    "sed -i 's/a/b/' src/app.ts"
assert_arms     "npm run build still arms"          "npm run build"
# Intentional PREFERRED false-positive: a code file present only as a READ source
# still arms. We never risk UNDER-arming a real code write, even at the cost of a
# spurious prompt when the actual write target is markdown (feedback_hooks_prefer_false_positives).
assert_arms     "code file as a read source still arms (preferred FP)" "cp src/foo.ts README.md"

# Headline: browser verification clears the flag, a subsequent .md-only write
# must NOT re-arm it (the exact bug).
rm -f "$VFLAG"
run_hook "sed -i 's/a/b/' src/app.ts" >/dev/null 2>&1                                  # code change arms
run_hook "cmux browser --surface surface:01 screenshot --out /tmp/v.png" >/dev/null 2>&1 # verification clears
run_hook "sed -i 's/a/b/' CHANGELOG.md" >/dev/null 2>&1                                 # .md-only write
if [ ! -f "$VFLAG" ]; then echo "PASS: post-clear .md write leaves the flag CLEAR (headline)"; ((PASS++));
else echo "FAIL: post-clear .md write RE-ARMED the flag (headline)"; FAIL_LABELS+=("headline re-arm"); ((FAIL++)); fi

restore_vflag

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
