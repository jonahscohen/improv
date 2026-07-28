#!/usr/bin/env bash
# Mutation controls for the 2026-07-28 Codex repair unit.
#
# For each fix: verify the mutation ANCHOR EXISTS (a mutation that silently fails to apply
# produces a fake "not caught" result), apply it, run the suite, require a SPECIFIC assertion
# to fail, then revert and confirm the file is byte-identical to where it started.
#
# Exit codes:
#   0  every mutation was caught by the assertion that is supposed to catch it
#   3  a mutation ANCHOR was missing (the mutation never applied - result is meaningless)
#   4  a mutation was NOT CAUGHT (an assertion does not actually constrain its fix)
#   5  a revert did not restore the original bytes
set -uo pipefail
cd "$(dirname "$0")"

SUITE=src/__tests__/flow-target-render.test.ts
LOG=/tmp/mutation-run.log
REAL_PW_CACHE="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"
declare -i FAILURES=0

# apply <file> <anchor> <replacement> ; run ; expect <substring of the failing assertion>
mutate() {
  local name="$1" file="$2" anchor="$3" repl="$4" expect="$5"
  local backup; backup=$(mktemp)
  cp "$file" "$backup"

  # ANCHOR CHECK - a mutation that does not apply proves nothing.
  local n; n=$(python3 - "$file" "$anchor" <<'PY'
import io,sys
print(io.open(sys.argv[1],encoding='utf-8').read().count(sys.argv[2]))
PY
)
  if [ "$n" != "1" ]; then
    echo "ANCHOR MISSING ($n matches) for mutation: $name"
    echo "  file=$file anchor=<<$anchor>>"
    rm -f "$backup"; exit 3
  fi

  python3 - "$file" "$anchor" "$repl" <<'PY'
import io,sys
p,a,r = sys.argv[1],sys.argv[2],sys.argv[3]
s = io.open(p,encoding='utf-8').read()
io.open(p,'w',encoding='utf-8').write(s.replace(a,r,1))
PY

  # RUN UNDER AN ISOLATED HOME, exactly as scripts/run-tests.ts does.
  #
  # The flowJ-seed mutation was first reported NOT CAUGHT purely because the harness inherited
  # the developer's warm ~/.claude/sidecoach-flow-history.json, where flowK already had its
  # prerequisite satisfied from earlier runs - so removing the seed changed nothing HERE while
  # genuinely breaking the suite on any cold machine. A mutation harness that runs in a richer
  # environment than CI reports false "not caught" results, which is the same class of lie as a
  # vacuous assertion. PLAYWRIGHT_BROWSERS_PATH is pinned to the real cache (also as run-tests
  # does) so the browser layer still runs rather than skipping.
  local iso; iso=$(mktemp -d "${TMPDIR:-/tmp}/sc-mut-home-XXXXXX")
  HOME="$iso" PLAYWRIGHT_BROWSERS_PATH="$REAL_PW_CACHE" npx ts-node "$SUITE" >"$LOG" 2>&1
  local rc=$?
  rm -rf "$iso"

  cp "$backup" "$file"
  if ! cmp -s "$backup" "$file"; then
    echo "REVERT FAILED for $name"; rm -f "$backup"; exit 5
  fi
  rm -f "$backup"

  if [ $rc -eq 0 ]; then
    echo "NOT CAUGHT: $name  (suite still passed with the fix reverted)"
    FAILURES+=1
    return
  fi
  # A MUTATION THAT DOES NOT COMPILE IS A FAKE CATCH. The first draft of the all-verb mutation
  # wrapped the condition in `false &&`, which destroyed TypeScript's narrowing of
  # commandMatch.command and killed the suite with TS2345 - reported as "caught" while no
  # assertion had run at all. A non-zero exit only counts when the code actually ran.
  if grep -qE "error TS[0-9]+|TSError" "$LOG"; then
    echo "FAKE CATCH (mutation did not COMPILE, no assertion ran): $name"
    echo "           $(grep -m1 -E 'error TS[0-9]+' "$LOG")"
    FAILURES+=1
    return
  fi
  if grep -qF "$expect" "$LOG"; then
    echo "CAUGHT   : $name"
    echo "           by: $(grep -oF -m1 "$expect" "$LOG")"
  else
    echo "CAUGHT BY THE WRONG ASSERTION: $name"
    echo "           expected to see: $expect"
    echo "           actual first failure: $(grep -m1 'FAIL:' "$LOG")"
    FAILURES+=1
  fi
}

echo "=== mutation controls: 2026-07-28 sidecoach repairs ==="

# --- Item 1: the panel must not receive the report when nothing rendered ---
mutate "item1 panel leak" src/sidecoach-orchestrator.ts \
  'report: unrenderedAuditTarget ? undefined : chainBuildReport,' \
  'report: chainBuildReport,' \
  'panel (a project directory): panel prints NO verdict line'

# --- Item 2: non-audit verbs must be captured ---
mutate "item2 all-verb capture" src/sidecoach-orchestrator.ts \
  '} else if (commandMatch.command && isPageShapedTarget(resolved, commandMatch.target as string)) {' \
  '} else if (commandMatch.command === '"'"'__mutation_disabled__'"'"' && isPageShapedTarget(resolved, commandMatch.target as string)) {' \
  'critique (a clean page)'

# --- Item 2b: the page-shaped predicate must stay NARROW (anti-over-capture) ---
mutate "item2 anti-over-capture" src/sidecoach-orchestrator.ts \
  '  return PAGE_SHAPED_EXT_RE.test(withoutQuery);' \
  '  return true;' \
  'no-regression (a prose build target)'

# --- Item 2c: query strings / fragments must be stripped before the extension test ---
mutate "item2 query-string hole" src/sidecoach-orchestrator.ts \
  '  const withoutQuery = String(target).split(/[?#]/)[0];' \
  '  const withoutQuery = String(target);' \
  'query-string (a query string): still recognised as a page target'

# --- Codex (d): the panel must SAY nothing was rendered, not merely omit the verdict ---
mutate "panel notice" src/sidecoach-orchestrator.ts \
  "          notice: unrenderedAuditTarget ? 'NO PAGE WAS RENDERED - nothing below is a measurement of a page.' : undefined," \
  '          notice: undefined,' \
  'the panel SAYS no page was rendered'

# --- Codex High: a SETUP command handed a page must carry the rendered:false signal ---
# (present.js no longer infers this; the orchestrator states it, so the mutation goes there.)
mutate "setup-command page signal" src/sidecoach-orchestrator.ts \
  '  if (!isPageShapedTarget(resolved, raw)) return null;' \
  '  if (true) return null;' \
  'exec-report (document, given a page): the run reports rendered:false'

# --- Item 3a: canExecute must reject an entry that rendered nothing ---
mutate "item3 prereq honours rendered" src/flow-prerequisites.ts \
  '.filter((entry) => entry.status === '"'"'success'"'"' && !scannedNothing(entry))' \
  '.filter((entry) => entry.status === '"'"'success'"'"')' \
  'prereq: a flowK that rendered NOTHING does not satisfy flowL'

# --- Item 3b: the field must actually be persisted ---
mutate "item3 rendered persisted" src/sidecoach-orchestrator.ts \
  'unrenderedAuditTarget && PAGE_SCANNING_FLOWS.has(String(flowId)) ? false : undefined,' \
  'undefined,' \
  'persist: that entry records rendered:false'

# --- Item 4a: present.js gates filter ---
mutate "item4 present gates filter" bin/sidecoach-present.js \
  '{ if (measuresArtifact(v)) gates.push(v); }' \
  '{ gates.push(v); }' \
  'present: its per-domain pass/fail mark is gone too'

# --- Item 4b: monitor --json sanitizer ---
mutate "item4 monitor json sanitizer" bin/sidecoach-present.js \
  '  if (Array.isArray(result.flowResults)) out.flowResults = result.flowResults.map(scrubFlow);' \
  '  if (Array.isArray(result.flowResults)) out.flowResults = result.flowResults;' \
  'monitor: --json carries no has_optimization_guidance'

# --- Item 7a: aggregator allowlist (findings) ---
mutate "item7 findings allowlist" src/build-report-aggregator.ts \
  "      if (vr.measures !== 'artifact') continue;
      // Round 2 fix: severity scales" \
  "      if (vr.measures === 'flow-output') continue;
      // Round 2 fix: severity scales" \
  'self-check: an UNDECLARED validator is suppressed (safe by default)'

# --- Item 7b: aggregator allowlist (grades) ---
mutate "item7 grades allowlist" src/build-report-aggregator.ts \
  "        if (vr.measures !== 'artifact') continue;" \
  "        if (vr.measures === 'flow-output') continue;" \
  'measures: an UNDECLARED validator contributes no domain grade'

# --- Item 7c: an artifact validator must keep its label ---
mutate "item7 taste keeps artifact label" src/taste-validator.ts \
  "    measures: 'artifact',
  };
}" \
  "  };
}" \
  'measures: taste declares artifact'

# --- Codex R2 Medium: the page-shaped extension list must be WIDER than the renderer's ---
mutate "shtml page-shaped hole" src/sidecoach-orchestrator.ts \
  'const PAGE_SHAPED_EXT_RE = /\.(html?|xhtml|shtml|xht)$/i;' \
  'const PAGE_SHAPED_EXT_RE = /\.(html?|xhtml)$/i;' \
  'extension (.shtml): recognised as a page target'

# --- Codex R2/R3: non-measuring commands must NOT be captured (over-capture guard) ---
mutate "non-measuring over-capture" src/sidecoach-orchestrator.ts \
  '  const raw = (target ?? '"'"''"'"').trim();
  if (!raw) return null;' \
  '  const raw = (target ?? '"'"''"'"').trim();' \
  'from a root containing index.html): still claims nothing about a page'

# --- Codex R2 Low: flowK must genuinely SUCCEED or the live-chain assertions prove nothing ---
mutate "flowJ seed (flowK non-vacuity)" "$SUITE" \
  "    ['flowJ_tactical_polish', 'tactical polish', 'so flowK_multi_lens_audit can execute']," \
  "    ['flowJ_unused_placeholder', 'tactical polish', 'so flowK_multi_lens_audit can execute']," \
  'chain: flowK_multi_lens_audit actually SUCCEEDED'

# --- Item 5: the browser-accounting reconciliation must detect drift ---
mutate "item5 accounting detects drift" "$SUITE" \
  'const BROWSER_ASSERTION_COUNT = 34;' \
  'const BROWSER_ASSERTION_COUNT = 33;' \
  'browser-assertion accounting drifted'

echo "=== $FAILURES mutation(s) NOT properly caught ==="
[ "$FAILURES" -eq 0 ] || exit 4
echo "ALL MUTATIONS CAUGHT"
