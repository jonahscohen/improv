#!/usr/bin/env bash
# Mutation controls for the 2026-07-29 polish-craft wiring (the TEACH half of `/sidecoach polish`).
#
# Every load-bearing behaviour introduced by the wiring is broken in turn, and a NAMED assertion in
# src/__tests__/polish-craft.test.ts must fail. An assertion that survives its own mutation does not
# constrain the code it claims to cover - which is precisely how the previous unmeasured guidance
# shipped.
#
# WHAT THIS CHECKS
#   1. the named assertion is among the failures  - that behaviour is covered by that assertion
#   2. the TOTAL failure count equals the declared blast radius - a mutation that breaks far more or
#      far less than expected means the mutation or the suite drifted, not a pass
# It does NOT claim the named assertion is the only failure; several mutations legitimately break a
# family, and the declared count is how that stays honest.
#
# DIST IS FROZEN ON PURPOSE. bin/sidecoach-present.js requires ../dist/polish-craft (lazily), so the
# executive-report assertions read the COMPILED corpus. This script builds ONCE up front and then
# mutates src/ and bin/ without rebuilding, which means a src/polish-craft.ts mutation is deliberately
# OUTSIDE the blast radius of the section-5 report assertions. That is declared per mutation rather
# than hidden: rebuilding per mutation would add ~40s x 13 for no extra signal.
#
# Exit codes:
#   0  every mutation was caught by its named assertion at its declared blast radius
#   2  the pre-mutation build or the unmutated suite did not pass (nothing below would mean anything)
#   3  a mutation ANCHOR was missing or ambiguous (the mutation never applied - result is meaningless)
#   4  a mutation was NOT CAUGHT, caught by the wrong assertion, or had an unexpected blast radius
#   5  a revert did not restore the original bytes
set -uo pipefail
cd "$(dirname "$0")"

SUITE=src/__tests__/polish-craft.test.ts
LOG=/tmp/mutation-polish-craft.log
TARGETS=(src/polish-craft.ts src/flow-handler-tactical-polish.ts bin/sidecoach-present.js)
declare -i FAILURES=0

# Pristine copies taken ONCE up front and restored unconditionally on any exit, including
# SIGINT/SIGTERM, so an interrupted run cannot leave a mutated worktree behind.
declare -A PRISTINE=()
for t in "${TARGETS[@]}"; do
  p=$(mktemp)
  cp "$t" "$p"
  PRISTINE["$t"]=$p
done
restore_all() {
  for t in "${TARGETS[@]}"; do
    p=${PRISTINE["$t"]:-}
    [ -n "$p" ] && [ -f "$p" ] || continue
    if ! cmp -s "$p" "$t"; then
      cp "$p" "$t"
      echo "restored $t from pristine copy" >&2
    fi
    rm -f "$p"
    PRISTINE["$t"]=''
  done
}
trap restore_all EXIT
trap 'restore_all; exit 130' INT
trap 'restore_all; exit 143' TERM

echo "=== baseline: build once, then confirm the unmutated suite passes ==="
if ! npm run build > /tmp/mutation-polish-craft-build.log 2>&1; then
  echo "BASELINE-BUILD-FAILED: see /tmp/mutation-polish-craft-build.log"
  exit 2
fi
if ! npx ts-node "$SUITE" > "$LOG" 2>&1; then
  echo "BASELINE-SUITE-FAILED: the suite must pass before any mutation is meaningful"
  cat "$LOG"
  exit 2
fi
echo "baseline OK (dist frozen at this build)"
echo

# mutate <file> <name> <anchor> <replacement> <expected-failing-assertion> <expected-total-failures> [rebuild]
# Passing `rebuild` as the 7th argument runs `npm run build` after applying the mutation and again
# after reverting it, so the mutation reaches the COMPILED corpus that bin/sidecoach-present.js loads.
# That is the one gap the frozen-dist speed tradeoff leaves open, named by the cross-model review, and
# section E below closes it with one measurement rather than by rebuilding on all seventeen.
mutate() {
  local file="$1" name="$2" anchor="$3" repl="$4" expect="$5" expect_n="$6" rebuild="${7:-}"
  local backup
  backup=$(mktemp)
  cp "$file" "$backup"

  local n
  n=$(python3 - "$file" "$anchor" <<'PY'
import io, sys
print(io.open(sys.argv[1], encoding='utf-8').read().count(sys.argv[2]))
PY
)
  if [ "$n" != "1" ]; then
    echo "ANCHOR-MISSING [$name]: anchor occurs $n time(s) in $file, need exactly 1"
    rm -f "$backup"
    exit 3
  fi

  python3 - "$file" "$anchor" "$repl" <<'PY'
import io, sys
p, a, r = sys.argv[1], sys.argv[2], sys.argv[3]
t = io.open(p, encoding='utf-8').read()
io.open(p, 'w', encoding='utf-8').write(t.replace(a, r, 1))
PY

  if [ "$rebuild" = "rebuild" ] && ! npm run build > /tmp/mutation-polish-craft-build.log 2>&1; then
    echo "MUTATED-BUILD-FAILED [$name]: the mutation did not compile - see /tmp/mutation-polish-craft-build.log"
    cp "$backup" "$file"; npm run build > /dev/null 2>&1; rm -f "$backup"
    exit 3
  fi

  npx ts-node "$SUITE" > "$LOG" 2>&1
  local rc=$?

  cp "$backup" "$file"
  if ! cmp -s "$backup" "$file"; then
    echo "REVERT-FAILED [$name]"
    rm -f "$backup"
    exit 5
  fi
  rm -f "$backup"
  if [ "$rebuild" = "rebuild" ] && ! npm run build > /tmp/mutation-polish-craft-build.log 2>&1; then
    echo "REVERT-BUILD-FAILED [$name]: dist could not be restored - see /tmp/mutation-polish-craft-build.log"
    exit 5
  fi

  local actual_n
  actual_n=$(grep -c '^FAIL ' "$LOG")

  if [ $rc -eq 0 ]; then
    echo "NOT-CAUGHT [$name]: suite still passed with the behaviour broken"
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

echo "=== A. the corpus ==="

mutate src/polish-craft.ts "a rule loses its craft note" \
  "  'polish/scale-on-press': {" \
  "  'polish/scale-on-press-RETIRED': {" \
  "every polish-standard rule has a craft note" \
  "${M1:-8}"

mutate src/polish-craft.ts "a note's fix reverts to the template" \
  "    fix: 'Add \`transition-property: scale; transition-duration: 150ms; transition-timing-function: ease-out\` to the control and \`scale: 0.96\` on \`:active\`. Use exactly 0.96; never go below 0.95, which feels exaggerated. Skip it on controls where the motion would distract.'," \
  "    fix: 'resolve the scale on press issue on the affected element'," \
  "note polish/scale-on-press: fix is not the template" \
  "${M2:-3}"

echo
echo "=== B. selection and proportionality ==="

mutate src/polish-craft.ts "selection ignores what actually failed" \
  "  for (const rule of rules) {" \
  "  for (const rule of Object.keys(POLISH_CRAFT)) {" \
  "two failing rules select two notes" \
  "${M3:-9}"

mutate src/polish-craft.ts "severity ordering dropped" \
  "  picked.sort((a, b) => a.rank - b.rank || a.n - b.n);" \
  "  picked.sort((a, b) => a.n - b.n);" \
  "blocker sorts before major" \
  "${M4:-1}"

mutate src/polish-craft.ts "the taught-note cap is removed" \
  "export const MAX_TAUGHT_NOTES = 8;" \
  "export const MAX_TAUGHT_NOTES = 100;" \
  "all 24 failing rules select exactly MAX_TAUGHT_NOTES notes" \
  "${M5:-2}"

mutate src/polish-craft.ts "the example budget is removed" \
  "    if (note.example && examplesUsed < exampleBudget) {" \
  "    if (note.example) {" \
  "at most 3 examples emitted" \
  "${M6:-1}"

mutate src/polish-craft.ts "a clean page still gets a brief" \
  "  if (notes.length === 0) return [];" \
  "  if (notes.length === -1) return [];" \
  "a page with no failures gets no brief" \
  "${M7:-1}"

echo
echo "=== C. the executive report ==="

mutate bin/sidecoach-present.js "the After column reverts to the template" \
  "  return craftLookup('craftRemediation', rule) || RULE_FIX[rule] ||" \
  "  return RULE_FIX[rule] ||" \
  "polish report: no templated After cell" \
  "${M8:-5}"

mutate bin/sidecoach-present.js "the why clause reverts to the template" \
  "  return RULE_WHY[rule] || craftLookup('craftReason', rule) || 'it undercuts the finished result';" \
  "  return RULE_WHY[rule] || 'it undercuts the finished result';" \
  "polish report: no templated why clause" \
  "${M9:-2}"

mutate bin/sidecoach-present.js "the corpus outranks a measured remediation" \
  "  if (fix && String(fix).trim()) return String(fix).trim();" \
  "  if (false && String(fix).trim()) return String(fix).trim();" \
  "a measured fix outranks the corpus" \
  "${M10:-1}"

mutate bin/sidecoach-present.js "the template fallback is deleted outright" \
  "    ('resolve the ' + (humRule(rule) || 'flagged') + ' issue on the affected element');" \
  "    'no fix recorded';" \
  "unknown rule keeps the fix template fallback" \
  "${M11:-1}"

mutate src/polish-craft.ts "named bans stop resolving from the ban reference" \
  "export const BAN_RULE_PREFIX = 'anti-patterns:ban-';" \
  "export const BAN_RULE_PREFIX = 'anti-patterns-retired:';" \
  "ban side-stripe-borders: resolves a craft note" \
  "${M16:-6}"

mutate src/polish-craft.ts "a ban note drops its prescribed rewrites" \
  "ban.rewriteOptions.join('; ')" \
  "[].join('; ')" \
  "ban side-stripe-borders: fix carries the prescribed rewrite" \
  "${M17:-5}"

echo
echo "=== D. the live payload: teach present, check preserved, teach first ==="

mutate src/flow-handler-tactical-polish.ts "the craft brief is not built" \
  "      const craftBrief = craftBriefLines(craftSubjects);" \
  "      const craftBrief: string[] = [];" \
  "live payload teaches what good looks like" \
  "${M12:-1}"

mutate src/flow-handler-tactical-polish.ts "check is emitted before teach" \
  "        ...(craftBrief.length ? craftBrief : ['CRAFT BRIEF: nothing to teach - every checked rule passed on this page.', '']),
        'FINDINGS - what was actually measured on this page.'," \
  "        'FINDINGS - what was actually measured on this page.',
        ...(craftBrief.length ? craftBrief : ['CRAFT BRIEF: nothing to teach - every checked rule passed on this page.', ''])," \
  "craft brief precedes the findings" \
  "${M13:-1}"

mutate src/flow-handler-tactical-polish.ts "the detector half is replaced by prose" \
  "        ...absoluteBanGuidance," \
  "        ...[]," \
  "live payload keeps the absolute-ban finding" \
  "${M14:-1}"

mutate src/flow-handler-tactical-polish.ts "the per-rule failing lines are dropped" \
  "          ? [\`- \${polishFindingLines.length} failing, each with the measured message and its fix:\`, ...polishFindingLines]" \
  "          ? [\`- \${polishFindingLines.length} failing.\`]" \
  "live payload names the failing rule by key" \
  "${M15:-2}"

mutate src/polish-craft.ts "the why clause is handed over as a raw sentence" \
  "  return keepCase ? first : first.charAt(0).toLowerCase() + first.slice(1);" \
  "  return why;" \
  "clause violation-count: no trailing period" \
  "${M19:-7}"

echo
echo "=== E. the SOURCE-TO-BUILT path, rebuilt (closes the frozen-dist gap) ==="

# Every mutation above leaves dist frozen at the baseline build for speed, so a src/polish-craft.ts
# mutation cannot reach the executive-report assertions that read the COMPILED corpus. This one
# rebuilds, proving the wired path really runs end to end from source to the rendered report rather
# than the two halves passing independently.
mutate src/polish-craft.ts "corpus fix reverts to the template, rebuilt into dist" \
  "    fix: 'Add \`transition-property: scale; transition-duration: 150ms; transition-timing-function: ease-out\` to the control and \`scale: 0.96\` on \`:active\`. Use exactly 0.96; never go below 0.95, which feels exaggerated. Skip it on controls where the motion would distract.'," \
  "    fix: 'resolve the scale on press issue on the affected element'," \
  "polish report: no templated After cell" \
  "${M18:-5}" \
  rebuild

echo
if [ $FAILURES -gt 0 ]; then
  echo "MUTATION CONTROL FAILED: $FAILURES mutation(s) not caught as declared"
  exit 4
fi
echo "MUTATION CONTROL PASS: every new behaviour is constrained by its own assertion"
exit 0
