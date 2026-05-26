#!/bin/bash
# Regression tests for bash-guard.sh (cmux-eval section) and validation-guard.sh
# Run: bash ~/.claude/hooks/test-validation-guards.sh
#
# Exercises both hooks against synthetic inputs covering:
#   - Each blocked pattern (must DENY)
#   - Each feature-detection carve-out (must ALLOW)
#   - Mixed feature-detection + blocked pattern (must DENY)
#
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
BASH_HOOK="$HOOK_DIR/bash-guard.sh"
VAL_HOOK="$HOOK_DIR/validation-guard.sh"

PASS=0
FAIL=0
FAIL_LABELS=()

# ---------- bash-guard helpers ----------

# Run bash-guard with a Bash tool_input.command JSON
run_bash_hook() {
  local cmd="$1"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$cmd")
  echo "$input" | bash "$BASH_HOOK" 2>/dev/null
}

bash_assert_blocks() {
  local label="$1"
  local cmd="$2"
  local out
  out=$(run_bash_hook "$cmd")
  if echo "$out" | grep -qE '"permissionDecision":[[:space:]]*"deny"'; then
    echo "PASS [bash]: $label"
    ((PASS++))
  else
    echo "FAIL [bash]: $label  (expected DENY, got: $out)"
    FAIL_LABELS+=("[bash] $label")
    ((FAIL++))
  fi
}

bash_assert_allows() {
  local label="$1"
  local cmd="$2"
  local out
  out=$(run_bash_hook "$cmd")
  # Allow = empty object or anything that doesn't have permissionDecision:deny
  if echo "$out" | grep -qE '"permissionDecision":[[:space:]]*"deny"'; then
    echo "FAIL [bash]: $label  (expected ALLOW, got DENY: $out)"
    FAIL_LABELS+=("[bash] $label")
    ((FAIL++))
  else
    echo "PASS [bash]: $label"
    ((PASS++))
  fi
}

# ---------- validation-guard helpers ----------

# Run validation-guard with a chrome MCP javascript_tool tool_input
run_val_hook() {
  local js="$1"
  local input
  input=$(python3 -c 'import json,sys; print(json.dumps({"tool_input":{"javascript":sys.argv[1]}}))' "$js")
  echo "$input" | bash "$VAL_HOOK" 2>/dev/null
}

val_assert_blocks() {
  local label="$1"
  local js="$2"
  local out
  out=$(run_val_hook "$js")
  if echo "$out" | grep -qE '"permissionDecision":[[:space:]]*"deny"'; then
    echo "PASS [val]: $label"
    ((PASS++))
  else
    echo "FAIL [val]: $label  (expected DENY, got: $out)"
    FAIL_LABELS+=("[val] $label")
    ((FAIL++))
  fi
}

val_assert_allows() {
  local label="$1"
  local js="$2"
  local out
  out=$(run_val_hook "$js")
  if echo "$out" | grep -qE '"permissionDecision":[[:space:]]*"deny"'; then
    echo "FAIL [val]: $label  (expected ALLOW, got DENY: $out)"
    FAIL_LABELS+=("[val] $label")
    ((FAIL++))
  else
    echo "PASS [val]: $label"
    ((PASS++))
  fi
}

echo "===== bash-guard cmux-eval BLOCK tests ====="

# Write/invoke shortcuts (pre-existing, regression coverage)
bash_assert_blocks "synthetic .click()"            "cmux browser eval \"document.querySelector('a').click()\""
bash_assert_blocks "dispatchEvent"                  "cmux browser eval \"el.dispatchEvent(new Event('click'))\""
bash_assert_blocks "private method invocation"     "cmux browser eval \"obj._privateMethod()\""
bash_assert_blocks "__improv namespace method"     "cmux browser eval \"window.__improv.activate()\""
bash_assert_blocks "private array push"            "cmux browser eval \"pm._changeQueue.push({x:1})\""

# Read shortcuts already covered before the fix
bash_assert_blocks "getComputedStyle"              "cmux browser eval \"getComputedStyle(el).color\""
bash_assert_blocks "getBoundingClientRect"          "cmux browser eval \"el.getBoundingClientRect()\""
bash_assert_blocks "scrollTop read"                "cmux browser eval \"document.body.scrollTop\""
bash_assert_blocks "textContent read"              "cmux browser eval \"el.textContent\""
bash_assert_blocks "innerHTML read"                "cmux browser eval \"document.body.innerHTML\""

# NEW: read shortcuts the prior bash-guard let slip
bash_assert_blocks "getAttribute"                   "cmux browser eval \"el.getAttribute('aria-label')\""
bash_assert_blocks "hasAttribute"                   "cmux browser eval \"el.hasAttribute('disabled')\""
bash_assert_blocks "element.style read"            "cmux browser eval \"el.style.color\""
bash_assert_blocks "classList check"               "cmux browser eval \"el.classList.contains('active')\""
bash_assert_blocks "className read"                "cmux browser eval \"el.className\""
bash_assert_blocks ".matches selector"             "cmux browser eval \"el.matches('.foo')\""
bash_assert_blocks ".closest traversal"            "cmux browser eval \"el.closest('section')\""
bash_assert_blocks "querySelectorAll length"       "cmux browser eval \"document.querySelectorAll('li').length\""
bash_assert_blocks "querySelectorAll forEach"      "cmux browser eval \"Array.from(document.querySelectorAll('li')).forEach(x=>x)\""
bash_assert_blocks "window.innerWidth"             "cmux browser eval \"window.innerWidth\""
bash_assert_blocks "existence: !!querySelector"    "cmux browser eval \"!!document.querySelector('.x')\""
bash_assert_blocks "form .disabled read"           "cmux browser eval \"btn.disabled\""
bash_assert_blocks "form .checked read"            "cmux browser eval \"box.checked\""

echo ""
echo "===== bash-guard cmux-eval ALLOW tests (feature detection) ====="

bash_assert_allows "typeof feature check"          "cmux browser eval \"typeof document.startViewTransition === 'function'\""
bash_assert_allows "CSS.supports"                  "cmux browser eval \"CSS.supports('display: grid')\""
bash_assert_allows "'feat' in window"              "cmux browser eval \"'IntersectionObserver' in window\""
bash_assert_allows "'feat' in document"            "cmux browser eval \"'startViewTransition' in document\""
bash_assert_allows "navigator.userAgent"           "cmux browser eval \"navigator.userAgent\""
bash_assert_allows "window.matchMedia call"        "cmux browser eval \"window.matchMedia('(prefers-reduced-motion: reduce)').matches\""

echo ""
echo "===== bash-guard cmux-eval ALLOW tests (legitimate setup) ====="

bash_assert_allows "bundle injection appendChild"  "cmux browser eval \"var s=document.createElement('script');s.src='x.js';document.head.appendChild(s)\""
bash_assert_allows "non-cmux command unrelated"    "ls -la /tmp"
bash_assert_allows "cmux but no eval"              "cmux browser screenshot --out /tmp/x.png"

echo ""
echo "===== bash-guard cmux-eval mixed DENY (feature-detect + blocked) ====="

bash_assert_blocks "matchMedia + getAttribute mix" "cmux browser eval \"window.matchMedia('(min-width: 800px)').matches; el.getAttribute('x')\""
bash_assert_blocks "typeof + .click() mix"          "cmux browser eval \"typeof X; btn.click()\""

echo ""
echo "===== validation-guard BLOCK tests (regression) ====="

val_assert_blocks "getComputedStyle"               "getComputedStyle(el).color"
val_assert_blocks "getAttribute"                   "el.getAttribute('href')"
val_assert_blocks "classList"                      "el.classList.contains('x')"
val_assert_blocks ".click() synthetic"             "document.querySelector('a').click()"
val_assert_blocks "window.innerWidth"              "window.innerWidth"

echo ""
echo "===== validation-guard ALLOW tests (feature detection) ====="

val_assert_allows "typeof startViewTransition"     "typeof document.startViewTransition === 'function'"
val_assert_allows "CSS.supports"                   "CSS.supports('color', 'oklch(0 0 0)')"
val_assert_allows "'IntersectionObserver' in win"  "'IntersectionObserver' in window"
val_assert_allows "navigator.userAgent"            "navigator.userAgent"
val_assert_allows "matchMedia prefers-color"       "window.matchMedia('(prefers-color-scheme: dark)').matches"

echo ""
echo "===== validation-guard mixed DENY (feature-detect + blocked) ====="

val_assert_blocks "matchMedia + getAttribute mix"  "window.matchMedia('(min-width: 800px)'); el.getAttribute('x')"
val_assert_blocks "typeof + .click() mix"          "typeof X; btn.click()"

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
