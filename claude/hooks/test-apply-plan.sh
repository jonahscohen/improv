#!/bin/bash
# test-apply-plan.sh - end-to-end verification of install.sh --apply-plan, the GUI
# server's production headless apply backend.
#
# --apply-plan reads {"install":[leafpaths],"uninstall":[leafpaths]} on stdin, validates
# every leaf against the loaded tree (allowlist = leaf_paths over all BR_BUCKETS), seeds
# PENDING_INSTALL/PENDING_UNINSTALL, and runs the SAME apply_pending executor that
# test-apply-pending.sh already proves end-to-end. This test covers the flag's own two
# jobs: (a) a valid plan installs, (b) an unknown/injection leaf is rejected fail-closed.
#
# Subject: chrome (Guardrails/chrome/* - 3 pure hooks, sandbox-safe, no daemon build).
#
# Chrome's leaf paths are DERIVED from browser-tree.json via browser-lib's OWN accessors
# (leaf_paths over the buckets, grep the chrome ones) - the exact source the --apply-plan
# allowlist compares against - so the path format cannot silently drift from what the
# allowlist accepts. Hand-rolling a separate path walk would risk a format mismatch that
# makes this test lie.
#
# Exit codes:
#   0  all assertions passed
#   1  one or more assertions failed
#   2  harness/setup error (repo layout wrong, python3 missing, chrome leaves unresolved)

set -u

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"
TREE="$REPO_DIR/claude/hooks/browser-tree.json"
LIB="$REPO_DIR/claude/hooks/browser-lib.sh"

PASS=0
FAIL=0

[ -f "$INSTALL" ] || { echo "SETUP-FAIL: install.sh not found at $INSTALL"; exit 2; }
[ -f "$TREE" ]    || { echo "SETUP-FAIL: browser-tree.json not found at $TREE"; exit 2; }
[ -f "$LIB" ]     || { echo "SETUP-FAIL: browser-lib.sh not found at $LIB"; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "SETUP-FAIL: python3 required"; exit 2; }

pass() { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# --- derive chrome's leaf paths from the tree via browser-lib's own accessors -----------
# Iterate BR_BUCKETS split TAB->newline (space-safe; bucket keys contain spaces), run
# leaf_paths per bucket, keep the chrome ones. This is the identical derivation the
# --apply-plan handler uses to build its allowlist, so the formats match by construction.
# shellcheck source=/dev/null
source "$LIB"
browser_load "$TREE" || { echo "SETUP-FAIL: browser_load failed"; exit 2; }

CHROME_LEAVES="$(
  while IFS= read -r _b; do
    [ -n "$_b" ] || continue
    leaf_paths "$_b"
  done < <(printf '%s\n' "${BR_BUCKETS//$'\t'/$'\n'}") | grep '/chrome/'
)"

_n_leaves="$(printf '%s\n' "$CHROME_LEAVES" | grep -c '/chrome/')"
[ "$_n_leaves" -eq 3 ] || { echo "SETUP-FAIL: expected 3 chrome leaves from tree, got $_n_leaves"; exit 2; }

# Build the plans with python3 so JSON quoting is correct regardless of path content.
PLAN_INSTALL="$(CHROME_LEAVES="$CHROME_LEAVES" python3 -c '
import os, json
leaves = [l for l in os.environ["CHROME_LEAVES"].splitlines() if l]
print(json.dumps({"install": leaves, "uninstall": []}))
')" || { echo "SETUP-FAIL: could not build install plan JSON"; exit 2; }

# A plan whose only install leaf is an unknown/injection string. The ";" and "rm -rf x"
# are inert: --apply-plan only ever compares the leaf as a literal against the allowlist
# (a quoted bash case), never evaluates it. Membership must fail -> the plan is rejected.
PLAN_BOGUS='{"install":["totally/bogus/leaf; rm -rf x"],"uninstall":[]}'

# A plan mixing the valid chrome leaves FIRST with the bogus leaf LAST. Proves validation
# is a gate BEFORE any install: even though the chrome leaves are valid and staged, the
# single unknown leaf must reject the whole plan with nothing installed.
PLAN_MIXED="$(CHROME_LEAVES="$CHROME_LEAVES" python3 -c '
import os, json
leaves = [l for l in os.environ["CHROME_LEAVES"].splitlines() if l]
leaves.append("totally/bogus/leaf; rm -rf x")
print(json.dumps({"install": leaves, "uninstall": []}))
')" || { echo "SETUP-FAIL: could not build mixed plan JSON"; exit 2; }

echo "== Scenario A: valid plan installs chrome (exit 0, artifact lands) =="
SB="$(mktemp -d)"
printf '%s' "$PLAN_INSTALL" | _AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash "$INSTALL" --apply-plan >/dev/null 2>&1
rc=$?
[ "$rc" = "0" ] && pass "apply-plan exit 0" || fail "apply-plan exit was $rc (want 0)"
[ -f "$SB/.claude/hooks/chrome-tabgroup-track.sh" ] && pass "chrome-tabgroup-track.sh deployed" || fail "chrome-tabgroup-track.sh missing after apply"
[ -f "$SB/.claude/hooks/chrome-tabgroup-clear.sh" ] && pass "chrome-tabgroup-clear.sh deployed" || fail "chrome-tabgroup-clear.sh missing after apply"
[ -f "$SB/.claude/hooks/chrome-tabgroup-stop.sh" ]  && pass "chrome-tabgroup-stop.sh deployed"  || fail "chrome-tabgroup-stop.sh missing after apply"
rm -rf "$SB"

echo
echo "== Scenario B: unknown/injection leaf is rejected (non-zero, installs nothing) =="
SB="$(mktemp -d)"
printf '%s' "$PLAN_BOGUS" | _AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash "$INSTALL" --apply-plan >/dev/null 2>&1
rc=$?
[ "$rc" != "0" ] && pass "bogus-leaf plan rejected (exit $rc, non-zero)" || fail "bogus-leaf plan exit was 0 (want non-zero)"
[ ! -f "$SB/.claude/hooks/chrome-tabgroup-track.sh" ] && pass "bogus plan installed nothing" || fail "bogus plan installed chrome-tabgroup-track.sh"
rm -rf "$SB"

echo
echo "== Scenario C: mixed valid+unknown leaf -> whole plan rejected fail-closed =="
SB="$(mktemp -d)"
printf '%s' "$PLAN_MIXED" | _AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash "$INSTALL" --apply-plan >/dev/null 2>&1
rc=$?
[ "$rc" != "0" ] && pass "mixed plan rejected (exit $rc, non-zero)" || fail "mixed plan exit was 0 (want non-zero)"
[ ! -f "$SB/.claude/hooks/chrome-tabgroup-track.sh" ] && pass "mixed plan installed nothing (rejected before apply)" || fail "mixed plan installed chrome despite the unknown leaf"
rm -rf "$SB"

# reject_installs_nothing <label> <stdin-json> - asserts --apply-plan exits non-zero and
# deployed no chrome hook into a fresh sandbox. Used for every malformed/hostile plan.
reject_installs_nothing() {
  local label="$1" json="$2" sb rc
  sb="$(mktemp -d)"
  printf '%s' "$json" | _AMPERSAND_NO_SUMMARY=1 HOME="$sb" bash "$INSTALL" --apply-plan >/dev/null 2>&1
  rc=$?
  [ "$rc" != "0" ] && pass "$label rejected (exit $rc, non-zero)" || fail "$label exit was 0 (want non-zero)"
  [ ! -f "$sb/.claude/hooks/chrome-tabgroup-track.sh" ] && pass "$label installed nothing" || fail "$label installed chrome"
  rm -rf "$sb"
}

echo
echo "== Scenario D: install is a JSON object, not an array -> rejected =="
# A dict would iterate its KEYS if get() were trusted blindly; strict schema must reject it.
reject_installs_nothing "non-array install" '{"install":{"Guardrails/chrome/chrome-tabgroup-track":true},"uninstall":[]}'

echo
echo "== Scenario E: a leaf string with an embedded newline -> rejected =="
# Without the control-char ban, "a\nb" would split into two allowlist checks. It must be
# rejected outright so a single JSON string can never smuggle a second leaf line.
reject_installs_nothing "embedded-newline leaf" '{"install":["Guardrails/chrome/chrome-tabgroup-track\nGuardrails/chrome/chrome-tabgroup-clear"],"uninstall":[]}'

echo
echo "== Scenario F: uninstall is a non-array (malformed) -> rejected with the contract exit =="
# The uninstall field must be normalized into the same exit-2 contract as install, not left
# to a raw Python status. 42 is not an array.
reject_installs_nothing "non-array uninstall" '{"install":[],"uninstall":42}'

echo
echo "== Scenario G: same leaf in BOTH install and uninstall -> rejected, not silently resolved =="
reject_installs_nothing "install/uninstall conflict" "$(CHROME_LEAVES="$CHROME_LEAVES" python3 -c '
import os, json
leaves = [l for l in os.environ["CHROME_LEAVES"].splitlines() if l]
print(json.dumps({"install": leaves, "uninstall": leaves[:1]}))
')"

echo
echo "== Scenario H: a real personal-bucket leaf is rejected, even under --personal =="
# Personal/ghostty is a genuine tree leaf, but the apply_pending executor cannot faithfully
# apply personal components (its child --only pass drops --personal; deactivate_component
# has no ghostty/shaders case). So apply-plan must reject personal leaves fail-closed at the
# allowlist, NOT accept them and fail/no-op deeper. This must hold WITH --personal too.
reject_installs_nothing "personal leaf (no --personal)" '{"install":["Personal/ghostty"],"uninstall":[]}'
# --personal variant: reuse the same assertion shape but pass the flag through.
SB="$(mktemp -d)"
printf '%s' '{"install":["Personal/ghostty"],"uninstall":[]}' | _AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash "$INSTALL" --apply-plan --personal >/dev/null 2>&1
rc=$?
[ "$rc" != "0" ] && pass "personal leaf (--personal) rejected (exit $rc, non-zero)" || fail "personal leaf (--personal) exit was 0 (want non-zero)"
[ ! -f "$SB/.claude/hooks/chrome-tabgroup-track.sh" ] && pass "personal leaf (--personal) installed nothing" || fail "personal leaf (--personal) installed chrome"
rm -rf "$SB"

echo
echo "== Scenario I: the top-level key set must be EXACTLY install+uninstall -> rejected otherwise =="
# The contract is {"install":[...],"uninstall":[...]}. A missing key, an empty object, or an
# UNKNOWN extra key (e.g. a client typo like "remove") must all be rejected, never silently
# ignored - so a client bug fails loud instead of no-op'ing.
reject_installs_nothing "missing uninstall key" '{"install":[]}'
reject_installs_nothing "empty object plan" '{}'
reject_installs_nothing "unknown extra key" '{"install":[],"uninstall":[],"remove":["Guardrails/chrome/chrome-tabgroup-track"]}'

echo
echo "== Scenario J: a PINNED hook leaf is not installer-toggleable -> rejected =="
# Pinned hooks (e.g. Beats/Hooks/beats-rebuild) are always-on and non-toggleable. The
# browser no-ops any attempt to stage them; apply_plan's hooks_owned_by omits them. If the
# allowlist accepted one, seeding it would trigger an unfaithful whole-owner install rather
# than toggling the pinned hook. Derive a real pinned leaf from the tree and assert reject.
PINNED_LEAF="$(
  while IFS= read -r _b; do
    [ -n "$_b" ] || continue
    leaf_paths "$_b"
  done < <(printf '%s\n' "${BR_BUCKETS//$'\t'/$'\n'}") | while IFS= read -r _lf; do
    _k="${_lf##*/}"; _p="${_lf%/*}"
    if [ "$(node_kind "$_p")" = "hooks" ] && hook_pinned "$_k"; then printf '%s\n' "$_lf"; fi
  done | head -1
)"
if [ -n "$PINNED_LEAF" ]; then
  reject_installs_nothing "pinned leaf $PINNED_LEAF" "$(PINNED_LEAF="$PINNED_LEAF" python3 -c '
import os, json
print(json.dumps({"install": [os.environ["PINNED_LEAF"]], "uninstall": []}))
')"
else
  echo "  SKIP: no pinned leaf found in tree (nothing to assert)"
fi

echo
echo "== Scenario K: the explicit both-empty plan is a valid no-op (exit 0) =="
SB="$(mktemp -d)"
printf '%s' '{"install":[],"uninstall":[]}' | _AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash "$INSTALL" --apply-plan >/dev/null 2>&1
rc=$?
[ "$rc" = "0" ] && pass "both-empty plan is a no-op (exit 0)" || fail "both-empty plan exit was $rc (want 0)"
[ ! -f "$SB/.claude/hooks/chrome-tabgroup-track.sh" ] && pass "no-op installed nothing" || fail "no-op installed chrome"
rm -rf "$SB"

echo
echo "== Scenario L: --dry-run validates but touches no files =="
# The global dry-run invariant: print resolved picks and exit, touching no files. A VALID
# plan under --dry-run must exit 0 with nothing installed; an INVALID one still exits 2
# (validation is read-only), so --dry-run doubles as plan validation.
SB="$(mktemp -d)"
printf '%s' "$PLAN_INSTALL" | _AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash "$INSTALL" --apply-plan --dry-run >/dev/null 2>&1
rc=$?
[ "$rc" = "0" ] && pass "valid plan --dry-run exit 0" || fail "valid plan --dry-run exit was $rc (want 0)"
[ ! -f "$SB/.claude/hooks/chrome-tabgroup-track.sh" ] && pass "valid plan --dry-run installed nothing" || fail "valid plan --dry-run WROTE files (dry-run violated)"
rm -rf "$SB"
SB="$(mktemp -d)"
printf '%s' "$PLAN_BOGUS" | _AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash "$INSTALL" --apply-plan --dry-run >/dev/null 2>&1
rc=$?
[ "$rc" != "0" ] && pass "invalid plan --dry-run still rejected (exit $rc)" || fail "invalid plan --dry-run exit was 0 (want non-zero)"
rm -rf "$SB"

echo
echo "TALLY: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
echo "ALL APPLY-PLAN CHECKS PASSED"
exit 0
