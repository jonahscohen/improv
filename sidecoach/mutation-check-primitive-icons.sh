#!/usr/bin/env bash
# Mutation controls for the 2026-07-28 fabricated-svg primitive-icon extension.
#
# Every guard clause in the new branch is disabled in turn, and a NAMED assertion must fail.
# An assertion that survives its own mutation does not constrain the code it claims to cover.
#
# WHAT THIS CHECKS, precisely (an earlier draft's comment overstated this and Codex called it):
#   1. the named assertion is among the failures  - the guard is covered by that specific assertion
#   2. the TOTAL failure count equals the declared blast radius - a mutation that breaks far more
#      (or less) than expected is a signal the mutation or the suite drifted, not a pass
# It does NOT assert the named assertion is the ONLY failure; several mutations legitimately break
# a family of related assertions, and the declared count is how that stays honest.
#
# The anchor is verified UNIQUE before each mutation: a mutation that silently fails to apply
# produces a fake result, which is the exact failure mode this exists to prevent.
#
# Exit codes:
#   0  every mutation was caught by its named assertion at its declared blast radius
#   3  a mutation ANCHOR was missing or ambiguous (the mutation never applied - result is meaningless)
#   4  a mutation was NOT CAUGHT, caught by the wrong assertion, or had an unexpected blast radius
#   5  a revert did not restore the original bytes
set -uo pipefail
cd "$(dirname "$0")"

TARGET=src/taste-validator.ts
SUITE=src/__tests__/taste-validator-primitive-icons.test.ts
LOG=/tmp/mutation-primitive-icons.log
declare -i FAILURES=0

# This script mutates a real tracked source file. If it is interrupted between the write and the
# restore, the worktree is left mutated - so the pristine copy is taken ONCE up front and restored
# unconditionally on any exit, including SIGINT/SIGTERM. (Raised by Codex in review.)
PRISTINE=$(mktemp)
cp "$TARGET" "$PRISTINE"
restore_target() {
  [ -f "$PRISTINE" ] || return 0   # idempotent: a second trap firing must be a no-op
  if ! cmp -s "$PRISTINE" "$TARGET"; then
    cp "$PRISTINE" "$TARGET"
    echo "restored $TARGET from pristine copy" >&2
  fi
  rm -f "$PRISTINE"
}
trap restore_target EXIT
trap 'restore_target; exit 130' INT
trap 'restore_target; exit 143' TERM

# mutate <name> <anchor> <replacement> <expected-failing-assertion> <expected-total-failures>
mutate() {
  local name="$1" anchor="$2" repl="$3" expect="$4" expect_n="$5"
  local backup
  backup=$(mktemp)
  cp "$TARGET" "$backup"

  local n
  n=$(python3 - "$TARGET" "$anchor" <<'PY'
import io, sys
print(io.open(sys.argv[1], encoding='utf-8').read().count(sys.argv[2]))
PY
)
  if [ "$n" != "1" ]; then
    echo "ANCHOR-MISSING [$name]: anchor occurs $n time(s), need exactly 1"
    rm -f "$backup"
    exit 3
  fi

  python3 - "$TARGET" "$anchor" "$repl" <<'PY'
import io, sys
p, a, r = sys.argv[1], sys.argv[2], sys.argv[3]
t = io.open(p, encoding='utf-8').read()
io.open(p, 'w', encoding='utf-8').write(t.replace(a, r, 1))
PY

  npx ts-node "$SUITE" > "$LOG" 2>&1
  local rc=$?

  cp "$backup" "$TARGET"
  if ! cmp -s "$backup" "$TARGET"; then
    echo "REVERT-FAILED [$name]"
    rm -f "$backup"
    exit 5
  fi
  rm -f "$backup"

  local actual_n
  actual_n=$(grep -c '^FAIL ' "$LOG")

  if [ $rc -eq 0 ]; then
    echo "NOT-CAUGHT [$name]: suite still passed with the guard disabled"
    FAILURES+=1
    return
  fi
  if ! grep -qF "FAIL $expect" "$LOG"; then
    echo "WRONG-ASSERTION [$name]: suite failed, but not at the named assertion"
    echo "  expected: FAIL $expect"
    grep '^FAIL ' "$LOG" | sed 's/^/    actual: /'
    FAILURES+=1
    return
  fi
  if [ "$actual_n" != "$expect_n" ]; then
    echo "BLAST-RADIUS [$name]: expected $expect_n failing assertion(s), got $actual_n"
    grep '^FAIL ' "$LOG" | sed 's/^/    /'
    FAILURES+=1
    return
  fi
  echo "CAUGHT [$name] (blast radius $actual_n) -> $expect"
}

echo "=== mutation controls: fabricated-svg primitive/compound branch ==="

mutate "primitive trigger disabled" \
  "if (drawingCount >= 2) {" \
  "if (drawingCount >= 9999) {" \
  "primitive icon: 3-line hamburger from reference/index.html IS flagged" \
  "${M1:-18}"

mutate "primitive trigger over-fires (>= 1)" \
  "if (drawingCount >= 2) {" \
  "if (drawingCount >= 1) {" \
  "sparkline: single polyline on an icon grid is NOT flagged" \
  "${M2:-3}"

mutate "compound-subpath trigger disabled" \
  "} else if (subpaths >= 2) {" \
  "} else if (subpaths >= 9999) {" \
  'compound path: 3 subpaths in one d="" on an icon grid IS flagged' \
  "${M3:-2}"

mutate "primitive tag list loses <line>" \
  "/<(?:line|rect|circle|polyline|polygon|ellipse)\\b/gi" \
  "/<(?:rect|circle|polyline|polygon|ellipse)\\b/gi" \
  "primitive icon: 3-line hamburger from reference/index.html IS flagged" \
  "${M4:-9}"

mutate "illustration exclusion disabled" \
  "if (SVG_NON_ICON_CONTENT_PATTERN.test(svgBlock)) return false;" \
  "if (false) return false;" \
  "animation: <animate> child is NOT flagged" \
  "${M5:-2}"

mutate "currentColor requirement dropped" \
  "if (!/currentColor/i.test(svgBlock)) return false;" \
  "if (false) return false;" \
  "scope limit: icon-grid primitives painted with literal colors are NOT flagged" \
  "${M6:-1}"

mutate "decorative-chrome (aria-hidden) requirement dropped" \
  "if (!isDecorativeChrome(svgBlock)) return false;" \
  "if (false) return false;" \
  "codex FP 4 (round 2): rounded-cap sparkline is NOT flagged" \
  "${M7:-8}"

mutate "aria-hidden read from the whole block, not the root tag" \
  "test(openTag);" \
  "test(svgBlock);" \
  "root scope: aria-hidden on a DESCENDANT does not make the graphic chrome" \
  "${M12:-3}"

mutate "square-grid requirement dropped" \
  "return w === h && w > 0 && w <= ICON_GRID_MAX;" \
  "return w > 0 && w <= ICON_GRID_MAX;" \
  "scope limit: a small non-square 24x12 box is NOT flagged" \
  "${M8:-1}"

mutate "grid ceiling raised" \
  "const ICON_GRID_MAX = 48;" \
  "const ICON_GRID_MAX = 100000;" \
  "scope limit: a 200x200 square canvas is NOT flagged" \
  "${M9:-2}"

mutate "viewBox comma parsing removed" \
  "([-+\\d.,\\seE]+?)" \
  "([-+\\d.\\seE]+?)" \
  'parsing: comma-separated viewBox="0,0,24,24" is recognised as an icon grid' \
  "${M10:-1}"

mutate "marker check bypassed" \
  "if (hasClassMarker || hasDataAttr || hasSourceComment) continue;" \
  "if (false) continue;" \
  "primitive icon with data-icon-source marker is NOT flagged" \
  "${M11:-4}"

echo
if [ $FAILURES -gt 0 ]; then
  echo "MUTATION CONTROL FAILED: $FAILURES mutation(s) not caught as declared"
  exit 4
fi
echo "MUTATION CONTROL PASS: every guard is constrained by its own assertion"
exit 0
