#!/usr/bin/env bash
# test-plan-consistency-lint.sh - regression suite for plan-consistency-lint.sh
#
# The linter under test catches recurring INTRA-unit consistency mistakes in
# dispatch-plan markdown docs:
#   - U7-class : a file in a unit's **Owns:** missing from that unit's dispatch
#                prompt ownership clause.
#   - U12-class: same in reverse (prompt clause names a file Owns omits).
#   - U10-class: a unit globally sequenced ("blocked by X") that also claims
#                "proceed immediately" with no local qualifier.
#
# Two entrypoints are exercised:
#   1. `plan-consistency-lint.sh --lint-file <doc>` -> prints `LEVEL: HIGH|LOW|CLEAN`
#      plus finding lines. Used to assert the detectors on individual fixtures.
#   2. stop-mode (stdin JSON + a synthesized transcript) -> prints the Stop
#      decision JSON. Used to assert the loop-guard, fail-open, plan-doc gate,
#      and an end-to-end block.
#
# Exit codes: 0 = all pass; 1 = an assertion failed; 2 = harness/setup error.
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
HOOK="$SCRIPT_DIR/plan-consistency-lint.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/plan-lint-test.XXXXXX")" || { echo "setup: mktemp failed"; exit 2; }
trap 'rm -rf "$WORK" 2>/dev/null || true' EXIT

if [ ! -f "$HOOK" ]; then
  echo "setup: hook not found at $HOOK"
  exit 2
fi

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); printf 'PASS: %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf 'FAIL: %s\n' "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; }

# lint_level <fixture-file> -> echoes HIGH|LOW|CLEAN (from the --lint-file entrypoint)
lint_level() {
  bash "$HOOK" --lint-file "$1" 2>/dev/null | sed -n 's/^LEVEL: //p' | head -1
}
# lint_out <fixture-file> -> full --lint-file stdout (for message inspection)
lint_out() { bash "$HOOK" --lint-file "$1" 2>/dev/null; }

# stop_decision <stdin-json> -> full stop-mode stdout
stop_decision() { printf '%s' "$1" | bash "$HOOK" 2>/dev/null; }

# synth_transcript <fixture-file> -> path to a one-line JSONL transcript that
# records a Write tool call whose file_path is the fixture.
synth_transcript() {
  local fx="$1" out
  out="$WORK/transcript.$RANDOM.jsonl"
  FX="$fx" python3 - "$out" <<'PY'
import json, os, sys
out = sys.argv[1]
rec = {"type": "assistant", "message": {"content": [
    {"type": "tool_use", "name": "Write",
     "input": {"file_path": os.environ["FX"], "content": "x"}}]}}
with open(out, "w") as f:
    f.write(json.dumps(rec) + "\n")
print(out)
PY
}

MARK='> **For agentic workers:** use subagent-driven-development to implement each unit.'

# ---------------------------------------------------------------------------
# Fixture 1: U7-class STALE -> BLOCK
#   Owns lists team-reaper.sh; the prompt ownership clause omits it.
# ---------------------------------------------------------------------------
F1="$WORK/f1_u7_stale.md"
cat > "$F1" <<EOF
# Debt Burndown Plan A
$MARK

## Unit 7: harness guardrails
**Owns:** \`claude/settings.json\`, \`claude/hooks/fable-orchestrator-guard.sh\`, \`claude/hooks/team-reaper.sh\` and their tests.

**Dispatch prompt:** "In your worktree, own only \`claude/settings.json\` and \`claude/hooks/fable-orchestrator-guard.sh\`. Implement the guardrails. Do not commit; report your diff."
EOF
L="$(lint_level "$F1")"
if [ "$L" = "HIGH" ]; then pass "1 U7-class stale (Owns file dropped from prompt) -> HIGH"; else fail "1 U7-class stale -> HIGH" "got LEVEL=$L; out=$(lint_out "$F1" | tr '\n' '|')"; fi

# ---------------------------------------------------------------------------
# Fixture 2: U12-class STALE -> BLOCK
#   Owns lists a .js.map and install.sh:203; prompt clause omits both.
# ---------------------------------------------------------------------------
F2="$WORK/f2_u12_stale.md"
cat > "$F2" <<EOF
# Debt Burndown Plan B
$MARK

## Unit 12: test-site-1 repoint
**Owns:** \`sidecoach/src/__tests__/sprint1-integration.test.ts\`, \`sidecoach/dist/__tests__/sprint1-integration.test.js.map\`, \`install.sh:203\`, \`test-site-1/\`.

**Dispatch prompt:** "In your worktree, own only \`sidecoach/src/__tests__/sprint1-integration.test.ts\` and \`test-site-1/\`. Relocate the fixture and report your diff."
EOF
L="$(lint_level "$F2")"
if [ "$L" = "HIGH" ]; then pass "2 U12-class stale (.js.map + install.sh:203 dropped) -> HIGH"; else fail "2 U12-class stale -> HIGH" "got LEVEL=$L; out=$(lint_out "$F2" | tr '\n' '|')"; fi

# ---------------------------------------------------------------------------
# Fixture 3: U10-class STALE -> BLOCK
#   "blocked by U3" globally + "proceed immediately" unqualified.
# ---------------------------------------------------------------------------
F3="$WORK/f3_u10_stale.md"
cat > "$F3" <<EOF
# Debt Burndown Plan C
$MARK

## Unit 10: beats cutover
**Owns:** \`CLAUDE.md\`, \`MEMORY.md\`.

**Blocking rule:** this whole unit is blocked by U3 until it is accepted.

**Dispatch prompt:** "In your worktree, own only \`CLAUDE.md\` and \`MEMORY.md\`. You may proceed immediately and start now. Do not commit."
EOF
L="$(lint_level "$F3")"
if [ "$L" = "HIGH" ]; then pass "3 U10-class stale (blocked-by + proceed-immediately) -> HIGH"; else fail "3 U10-class stale -> HIGH" "got LEVEL=$L; out=$(lint_out "$F3" | tr '\n' '|')"; fi

# ---------------------------------------------------------------------------
# Fixture 4: U6 read-only owns-nothing, prompt names test scripts to RUN -> CLEAN
# ---------------------------------------------------------------------------
F4="$WORK/f4_u6_readonly.md"
cat > "$F4" <<EOF
# Debt Burndown Plan D
$MARK

## Unit 6: test-suite baseline
**Owns:** nothing - runs existing suites read-only, before any edits.

**Dispatch prompt:** "In the repo, run (do not edit) the suites: \`test-bash-guard-commit.sh\`, \`test-cmux-close-guard.sh\`. Report one pass/fail line per suite. Do not fix anything."
EOF
L="$(lint_level "$F4")"
if [ "$L" != "HIGH" ]; then pass "4 U6 read-only owns-nothing (prompt names run-only scripts) -> not HIGH ($L)"; else fail "4 U6 read-only -> not HIGH" "got LEVEL=$L; out=$(lint_out "$F4" | tr '\n' '|')"; fi

# ---------------------------------------------------------------------------
# Fixture 5: U7 CONSISTENT (prompt clause == Owns; extra paths only in
#            `Do NOT edit` exclusions and instructions) -> CLEAN
# ---------------------------------------------------------------------------
F5="$WORK/f5_u7_consistent.md"
cat > "$F5" <<EOF
# Debt Burndown Plan E
$MARK

## Unit 7: harness guardrails
**Owns:** \`claude/settings.json\`, \`claude/hooks/fable-orchestrator-guard.sh\`, \`claude/hooks/team-reaper.sh\` plus new hook files it creates and their tests.

**Dispatch prompt:** "In your worktree, own EXACTLY these and no other existing hook: \`claude/settings.json\`, \`claude/hooks/fable-orchestrator-guard.sh\`, \`claude/hooks/team-reaper.sh\`, plus the new hook files you create and their tests. Do NOT edit \`resume-guard.sh\` or \`agent-teams-guard.sh\`. Implement the four guardrails. Do not commit; report your diff."
EOF
L="$(lint_level "$F5")"
if [ "$L" = "CLEAN" ]; then pass "5 U7 consistent (exclusions + instructions not owned) -> CLEAN"; else fail "5 U7 consistent -> CLEAN" "got LEVEL=$L; out=$(lint_out "$F5" | tr '\n' '|')"; fi

# ---------------------------------------------------------------------------
# Fixture 6: U10/P0a QUALIFIED (immediate phrase locally qualified) -> not BLOCK
# ---------------------------------------------------------------------------
F6="$WORK/f6_u10_qualified.md"
cat > "$F6" <<EOF
# Debt Burndown Plan F
$MARK

## Unit 10: beats cutover
**Owns:** \`CLAUDE.md\`, \`MEMORY.md\`.

**Blocking rule:** all of U10 except P0a is blocked by U3.

**Phases:**
- P0a is U3-independent and may run early relative to U3, but after U8/U9 integration.

**Dispatch prompt:** "In your worktree, own only \`CLAUDE.md\` and \`MEMORY.md\`. Do not commit."
EOF
L="$(lint_level "$F6")"
if [ "$L" != "HIGH" ]; then pass "6 U10/P0a qualified (may-run-early relative-to/but-after) -> not HIGH ($L)"; else fail "6 U10/P0a qualified -> not HIGH" "got LEVEL=$L; out=$(lint_out "$F6" | tr '\n' '|')"; fi

# ---------------------------------------------------------------------------
# Fixture 7: a NON-plan-doc .md is ignored -> CLEAN (detection gate)
#   Same U7-class inconsistency as fixture 1, but no `For agentic workers`
#   marker and not under docs/plans -> the linter must not treat it as a plan.
# ---------------------------------------------------------------------------
F7="$WORK/f7_not_a_plan.md"
cat > "$F7" <<EOF
# Some ordinary design note

## Unit 7: a heading that happens to say Unit
**Owns:** \`claude/settings.json\`, \`claude/hooks/team-reaper.sh\`.

**Dispatch prompt:** "own only \`claude/settings.json\`. Do not commit."
EOF
L="$(lint_level "$F7")"
if [ "$L" = "CLEAN" ]; then pass "7 non-plan-doc .md (no marker, not docs/plans) -> CLEAN/ignored"; else fail "7 non-plan-doc ignored -> CLEAN" "got LEVEL=$L; out=$(lint_out "$F7" | tr '\n' '|')"; fi

# stop-mode: same non-plan doc through a synthesized transcript must yield {}
T7="$(synth_transcript "$F7")"
D="$(stop_decision "{\"stop_hook_active\":false,\"transcript_path\":\"$T7\"}")"
if [ "$D" = "{}" ]; then pass "7b non-plan-doc via transcript -> {} (no block/warn)"; else fail "7b non-plan-doc via transcript -> {}" "got: $D"; fi

# ---------------------------------------------------------------------------
# Fixture 8: malformed/truncated doc does not crash -> exit 0, no block
# ---------------------------------------------------------------------------
F8="$WORK/f8_malformed.md"
printf '%s\n%s\n\n## Unit 3: hook fixes\n**Owns:** `claude/hooks/verify-before-done.sh' > "$F8" "# Truncated plan" "$MARK"
bash "$HOOK" --lint-file "$F8" >/dev/null 2>&1
RC=$?
L="$(lint_level "$F8")"
if [ "$RC" -eq 0 ] && [ "$L" != "HIGH" ]; then pass "8 malformed/truncated doc -> exit 0, not HIGH ($L)"; else fail "8 malformed doc -> exit 0 + not HIGH" "rc=$RC level=$L"; fi

# stop-mode on the malformed doc: must not block
T8="$(synth_transcript "$F8")"
D="$(stop_decision "{\"stop_hook_active\":false,\"transcript_path\":\"$T8\"}")"
if printf '%s' "$D" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
  fail "8b malformed doc via transcript -> no block" "got: $D"
else
  pass "8b malformed doc via transcript -> no block"
fi

# ---------------------------------------------------------------------------
# Pipeline: loop guard - stop_hook_active true -> {} exit 0
# ---------------------------------------------------------------------------
T1="$(synth_transcript "$F1")"
D="$(stop_decision "{\"stop_hook_active\":true,\"transcript_path\":\"$T1\"}")"
RC=$?
if [ "$D" = "{}" ] && [ "$RC" -eq 0 ]; then pass "loop-guard (stop_hook_active=true) -> {} exit 0"; else fail "loop-guard -> {} exit 0" "rc=$RC got: $D"; fi

# ---------------------------------------------------------------------------
# Pipeline: fail-open - non-JSON stdin -> {} exit 0
# ---------------------------------------------------------------------------
D="$(printf 'this is not json' | bash "$HOOK" 2>/dev/null)"
RC=$?
if [ "$D" = "{}" ] && [ "$RC" -eq 0 ]; then pass "fail-open (non-JSON stdin) -> {} exit 0"; else fail "fail-open non-JSON -> {} exit 0" "rc=$RC got: $D"; fi

# Pipeline: fail-open - transcript_path missing file -> {} exit 0
D="$(stop_decision '{"stop_hook_active":false,"transcript_path":"/no/such/transcript.jsonl"}')"
RC=$?
if [ "$D" = "{}" ] && [ "$RC" -eq 0 ]; then pass "fail-open (missing transcript) -> {} exit 0"; else fail "fail-open missing transcript -> {} exit 0" "rc=$RC got: $D"; fi

# ---------------------------------------------------------------------------
# Pipeline: end-to-end BLOCK - a plan doc detected by PATH (docs/plans/) with a
# U7-class HIGH finding, reached via a synthesized transcript -> decision block.
# ---------------------------------------------------------------------------
mkdir -p "$WORK/docs/plans"
FP="$WORK/docs/plans/p.md"
# No marker; relies on the docs/plans/*.md path route for detection.
cat > "$FP" <<EOF
# Plan by path

## Unit 7: harness guardrails
**Owns:** \`claude/settings.json\`, \`claude/hooks/team-reaper.sh\`.

**Dispatch prompt:** "own only \`claude/settings.json\`. Implement it. Do not commit."
EOF
TP="$(synth_transcript "$FP")"
D="$(stop_decision "{\"stop_hook_active\":false,\"transcript_path\":\"$TP\"}")"
if printf '%s' "$D" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
  pass "end-to-end block (docs/plans path detection + HIGH) -> decision block"
else
  fail "end-to-end block -> decision block" "got: $D"
fi

# ---------------------------------------------------------------------------
# Pipeline: warn-only - a LOW-only doc (qualified sequencing) -> systemMessage,
# never a block.
# ---------------------------------------------------------------------------
TQ="$(synth_transcript "$F6")"
# fixture 6 lacks the docs/plans path; give it the marker route via its content.
D="$(stop_decision "{\"stop_hook_active\":false,\"transcript_path\":\"$TQ\"}")"
if printf '%s' "$D" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"'; then
  fail "warn-only (qualified) -> no block" "got: $D"
else
  pass "warn-only (qualified sequencing) -> no block decision"
fi

# ---------------------------------------------------------------------------
# Bonus: an explicit sequencing-ok suppression comment disables detector B.
# ---------------------------------------------------------------------------
F9="$WORK/f9_suppressed.md"
cat > "$F9" <<EOF
# Debt Burndown Plan G
$MARK

## Unit 10: beats cutover
<!-- plan-lint: sequencing-ok P0a is intentionally early -->
**Owns:** \`CLAUDE.md\`, \`MEMORY.md\`.

**Blocking rule:** blocked by U3.

**Dispatch prompt:** "own only \`CLAUDE.md\` and \`MEMORY.md\`. You may proceed immediately. Do not commit."
EOF
L="$(lint_level "$F9")"
if [ "$L" != "HIGH" ]; then pass "9 sequencing-ok suppression comment -> detector B silenced ($L)"; else fail "9 sequencing-ok suppression -> not HIGH" "got LEVEL=$L; out=$(lint_out "$F9" | tr '\n' '|')"; fi

# ===========================================================================
# Regression cases for findings folded from the cross-model (Codex) review.
# ===========================================================================

# R1 (Codex High #2): install.sh:203 is the ONLY dropped token - the :NN locator
# must not make looks_like_file() reject it. Isolated so the .js.map cannot mask it.
R1="$WORK/r1_locator.md"
cat > "$R1" <<EOF
# Plan R1
$MARK

## Unit 12: install mention
**Owns:** \`test-site-1/\`, \`install.sh:203\`.

**Dispatch prompt:** "own only \`test-site-1/\`. Relocate the fixture and report your diff."
EOF
L="$(lint_level "$R1")"
if [ "$L" = "HIGH" ]; then pass "R1 install.sh:203 locator is the sole drop -> HIGH (looks_like_file strips :NN)"; else fail "R1 install.sh:203 sole drop -> HIGH" "got LEVEL=$L; out=$(lint_out "$R1" | tr '\n' '|')"; fi

# R2 (Codex Medium #3): a ### subheading inside a unit must NOT close it; the
# drift after the subheading is still detected.
R2="$WORK/r2_subheading.md"
cat > "$R2" <<EOF
# Plan R2
$MARK

## Unit 7: harness guardrails
### Scope
Some scoping prose under a subheading.

**Owns:** \`claude/settings.json\`, \`claude/hooks/team-reaper.sh\`.

**Dispatch prompt:** "own only \`claude/settings.json\`. Implement it. Do not commit."
EOF
L="$(lint_level "$R2")"
if [ "$L" = "HIGH" ]; then pass "R2 ### subheading inside unit does not skip it -> HIGH still detected"; else fail "R2 subheading -> HIGH" "got LEVEL=$L; out=$(lint_out "$R2" | tr '\n' '|')"; fi

# R3 (Codex Medium #4): "change only" IS an ownership clause. A dropped Owns file
# under a change-only prompt is a real HIGH, not a no-clause LOW.
R3="$WORK/r3_changeonly_high.md"
cat > "$R3" <<EOF
# Plan R3
$MARK

## Unit 8 (research): cmux
**Owns:** \`.claude/memory/decision_cmux.md\`, \`.claude/memory/decision_extra.md\`.

**Dispatch prompt:** "change only \`.claude/memory/decision_cmux.md\`. Investigate and report."
EOF
L="$(lint_level "$R3")"
if [ "$L" = "HIGH" ]; then pass "R3 change-only clause + dropped Owns file -> HIGH"; else fail "R3 change-only drop -> HIGH" "got LEVEL=$L; out=$(lint_out "$R3" | tr '\n' '|')"; fi

# R4 (Codex Medium #4): a CONSISTENT change-only unit is CLEAN, not a LOW no-clause.
R4="$WORK/r4_changeonly_clean.md"
cat > "$R4" <<EOF
# Plan R4
$MARK

## Unit 9 (research): mcp fate
**Owns:** \`.claude/memory/decision_fate.md\` only.

**Dispatch prompt:** "change only \`.claude/memory/decision_fate.md\`. Do NOT edit \`MEMORY.md\`. Confirm and report."
EOF
L="$(lint_level "$R4")"
if [ "$L" = "CLEAN" ]; then pass "R4 consistent change-only unit -> CLEAN (clause recognized, MEMORY.md excluded)"; else fail "R4 consistent change-only -> CLEAN" "got LEVEL=$L; out=$(lint_out "$R4" | tr '\n' '|')"; fi

# R5 (Codex Medium #4 guard): a clause that names NO files ("change only the
# wording") must WARN, never HIGH-block every Owns token.
R5="$WORK/r5_empty_clause.md"
cat > "$R5" <<EOF
# Plan R5
$MARK

## Unit 5: dogfood
**Owns:** \`reference/serve.py\`.

**Dispatch prompt:** "change only the wording in the docs and report your diff."
EOF
L="$(lint_level "$R5")"
if [ "$L" != "HIGH" ]; then pass "R5 clause with no file tokens -> not HIGH ($L)"; else fail "R5 empty clause -> not HIGH" "got LEVEL=$L; out=$(lint_out "$R5" | tr '\n' '|')"; fi

# R6 (Codex Medium #7): "Do NOT edit \`MEMORY.md\`" must be parsed despite the dot
# inside the filename, so an excluded file is not reported as a prompt-owned extra.
R6="$WORK/r6_exclusion_dot.md"
cat > "$R6" <<EOF
# Plan R6
$MARK

## Unit 7: harness guardrails
**Owns:** \`claude/settings.json\`.

**Dispatch prompt:** "own only \`claude/settings.json\`. Do NOT edit \`MEMORY.md\` or any index. Implement it and report."
EOF
L="$(lint_level "$R6")"
if [ "$L" = "CLEAN" ]; then pass "R6 Do-NOT-edit MEMORY.md (dotted) parsed as exclusion -> CLEAN"; else fail "R6 dotted exclusion -> CLEAN" "got LEVEL=$L; out=$(lint_out "$R6" | tr '\n' '|')"; fi

# R7 (Codex Low #8): a unit that owns REAL files but has a "read-only" caveat in
# prose is NOT exempted - its drift is still linted.
R7="$WORK/r7_readonly_with_files.md"
cat > "$R7" <<EOF
# Plan R7
$MARK

## Unit 3: hook fixes
**Owns:** \`claude/hooks/verify-before-done.sh\`, \`claude/hooks/team-reaper.sh\` (treat the reference doc as read-only).

**Dispatch prompt:** "own only \`claude/hooks/verify-before-done.sh\`. Implement it and report."
EOF
L="$(lint_level "$R7")"
if [ "$L" = "HIGH" ]; then pass "R7 owns real files + read-only caveat -> still linted (HIGH)"; else fail "R7 read-only caveat with files -> HIGH" "got LEVEL=$L; out=$(lint_out "$R7" | tr '\n' '|')"; fi

# R8 (Codex Medium #5): "blocked until" is a blocking phrase for detector B.
R8="$WORK/r8_blocked_until.md"
cat > "$R8" <<EOF
# Plan R8
$MARK

## Unit 10: beats cutover
**Owns:** \`CLAUDE.md\`, \`MEMORY.md\`.

**Blocking rule:** this unit is blocked until Unit 3 is accepted.

**Dispatch prompt:** "own only \`CLAUDE.md\` and \`MEMORY.md\`. You may proceed immediately. Do not commit."
EOF
L="$(lint_level "$R8")"
if [ "$L" = "HIGH" ]; then pass "R8 'blocked until' + 'proceed immediately' -> HIGH"; else fail "R8 blocked-until sequencing -> HIGH" "got LEVEL=$L; out=$(lint_out "$R8" | tr '\n' '|')"; fi

# R9 (Codex round-2 Medium): a content-reference clause ("change only references
# to `install.sh` in `TASKS.md`") must NOT flag install.sh as prompt-owned - it is
# content being edited, not an owned file.
R9="$WORK/r9_content_ref.md"
cat > "$R9" <<EOF
# Plan R9
$MARK

## Unit 5: dogfood
**Owns:** \`TASKS.md\`.

**Dispatch prompt:** "change only references to \`install.sh\` in \`TASKS.md\`. Report your diff."
EOF
L="$(lint_level "$R9")"
if [ "$L" != "HIGH" ]; then pass "R9 content-reference clause (references to X) -> not HIGH ($L)"; else fail "R9 content-reference -> not HIGH" "got LEVEL=$L; out=$(lint_out "$R9" | tr '\n' '|')"; fi

# R10 (Codex round-2 Low): a repo-relative docs/plans path (no leading slash, no
# marker) is still detected as a plan doc.
mkdir -p "$WORK/docs/plans"
cat > "$WORK/docs/plans/rel.md" <<EOF
# Markerless plan reached by relative path

## Unit 7: harness guardrails
**Owns:** \`claude/settings.json\`, \`claude/hooks/team-reaper.sh\`.

**Dispatch prompt:** "own only \`claude/settings.json\`. Implement it and report."
EOF
L="$(cd "$WORK" && bash "$HOOK" --lint-file "docs/plans/rel.md" 2>/dev/null | sed -n 's/^LEVEL: //p' | head -1)"
if [ "$L" = "HIGH" ]; then pass "R10 repo-relative docs/plans path detected (markerless) -> HIGH"; else fail "R10 relative docs/plans detection -> HIGH" "got LEVEL=$L"; fi

# R11 (Codex round-2 Medium): a normal run emits NOTHING on stderr - the group
# stderr redirect keeps internal errors from surfacing (quiet fail-open).
ERRF="$WORK/stderr.$$"
printf '{"stop_hook_active":false,"transcript_path":"/no/such.jsonl"}' | bash "$HOOK" >/dev/null 2>"$ERRF"
RC=$?
ESZ=$(wc -c < "$ERRF" 2>/dev/null | tr -d ' ')
if [ "$RC" -eq 0 ] && [ "${ESZ:-0}" -eq 0 ]; then pass "R11 stop-mode run is quiet on stderr (exit 0, 0 bytes stderr)"; else fail "R11 quiet stderr" "rc=$RC stderr_bytes=$ESZ"; fi
rm -f "$ERRF"

echo "----------------------------------------"
echo "plan-consistency-lint: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
