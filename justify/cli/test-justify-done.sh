#!/bin/bash
# Test script for justify-done.sh - the Justify executive-report card renderer.
# Runs entirely offline: every case sets JUSTIFY_DRY_RUN=1 so the /respond and
# /prompts/clear network calls are skipped and only the printed card is checked.
#
# Verifies:
#   - a 2-change JUSTIFY_CHANGES fixture renders the Selector/Property/Before/After table
#   - the #### heading is derived from the summary argument
#   - the summary sentences print as-is under the table
#   - the completed status line renders ("N changes applied. Files: <list>. Sent for review.")
#   - singular vs plural change count ("1 change applied" vs "2 changes applied")
#   - the files list renders (single, multiple, and none)
#   - the needsInfo status swaps the status line for the question variant and drops the table
#   - usage error and dry-run exit codes are preserved (1 and 0)
#   - the source script is `bash -n` clean
#
# Exits 0 on all-pass, 1 on any failure.

set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DONE="$DIR/justify-done.sh"

PASS_COUNT=0
FAIL_COUNT=0
pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf "PASS  %s\n" "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf "FAIL  %s\n" "$1"; }

# contains <haystack> <needle> -> 0 if needle present
contains() {
  case "$1" in
    *"$2"*) return 0 ;;
    *) return 1 ;;
  esac
}

TWO_CHANGES='[{"selector":".hero h1","property":"font-size","oldValue":"32px","newValue":"40px"},{"selector":".hero p","property":"color","oldValue":"#888","newValue":"#333"}]'
ONE_CHANGE='[{"selector":".cta","property":"margin","oldValue":"0","newValue":"8px"}]'

# =============================================================================
# Case 1: 2-change fixture renders the full card
# =============================================================================
OUT="$(JUSTIFY_DRY_RUN=1 JUSTIFY_CHANGES="$TWO_CHANGES" \
  bash "$DONE" prompt-1 "Enlarged the hero heading and darkened the subhead for contrast." "hero.css")"

if contains "$OUT" "#### Enlarged the hero heading"; then
  pass "Case 1: heading derived from summary"
else
  fail "Case 1: heading missing. Got:
$OUT"
fi

if contains "$OUT" "| Selector | Property | Before | After |"; then
  pass "Case 1: table header present"
else
  fail "Case 1: table header missing. Got:
$OUT"
fi

if contains "$OUT" '| `.hero h1` | `font-size` | `32px` | `40px` |'; then
  pass "Case 1: first change row (before/after) present, cells code-wrapped"
else
  fail "Case 1: first change row missing. Got:
$OUT"
fi

if contains "$OUT" '| `.hero p` | `color` | `#888` | `#333` |'; then
  pass "Case 1: second change row present"
else
  fail "Case 1: second change row missing. Got:
$OUT"
fi

if contains "$OUT" "Enlarged the hero heading and darkened the subhead for contrast."; then
  pass "Case 1: summary sentences printed as-is"
else
  fail "Case 1: summary sentences missing. Got:
$OUT"
fi

if contains "$OUT" "2 changes applied. Files: hero.css. Sent for review."; then
  pass "Case 1: completed status line present"
else
  fail "Case 1: status line missing. Got:
$OUT"
fi

if contains "$OUT" $'\033['; then
  fail "Case 1: output contains ANSI escape (should be plain markdown). Got:
$OUT"
else
  pass "Case 1: no ANSI styling in card"
fi

# =============================================================================
# Case 2: needsInfo swaps status line and drops the table
# =============================================================================
OUT2="$(JUSTIFY_DRY_RUN=1 JUSTIFY_STATUS=needsInfo \
  bash "$DONE" prompt-2 "Which shade of blue did you mean for the primary button?")"

if contains "$OUT2" "Question sent back to the browser."; then
  pass "Case 2: needsInfo question status line present"
else
  fail "Case 2: needsInfo status line missing. Got:
$OUT2"
fi

if contains "$OUT2" "changes applied"; then
  fail "Case 2: completed status line must not appear for needsInfo. Got:
$OUT2"
else
  pass "Case 2: completed status line absent for needsInfo"
fi

if contains "$OUT2" "| Selector | Property |"; then
  fail "Case 2: table must not render with empty JUSTIFY_CHANGES. Got:
$OUT2"
else
  pass "Case 2: no table when no changes"
fi

if contains "$OUT2" "#### Which shade of blue"; then
  pass "Case 2: heading derived from question summary"
else
  fail "Case 2: heading missing. Got:
$OUT2"
fi

# =============================================================================
# Case 3: completed with no changes -> zero-count status line, no table
# =============================================================================
OUT3="$(JUSTIFY_DRY_RUN=1 bash "$DONE" prompt-3 "Renamed the CTA label copy." "buttons.css")"

if contains "$OUT3" "0 changes applied. Files: buttons.css. Sent for review."; then
  pass "Case 3: zero-change status line present"
else
  fail "Case 3: zero-change status line missing. Got:
$OUT3"
fi

if contains "$OUT3" "| Selector | Property |"; then
  fail "Case 3: table must not render with no changes. Got:
$OUT3"
else
  pass "Case 3: no table when no changes"
fi

# =============================================================================
# Case 4: singular change count
# =============================================================================
OUT4="$(JUSTIFY_DRY_RUN=1 JUSTIFY_CHANGES="$ONE_CHANGE" \
  bash "$DONE" prompt-4 "Nudged the CTA spacing." "a.css")"

if contains "$OUT4" "1 change applied. Files: a.css. Sent for review."; then
  pass "Case 4: singular 'change' for a single change"
else
  fail "Case 4: singular status line missing. Got:
$OUT4"
fi

# =============================================================================
# Case 5: multiple files render comma-separated
# =============================================================================
OUT5="$(JUSTIFY_DRY_RUN=1 JUSTIFY_CHANGES="$TWO_CHANGES" \
  bash "$DONE" prompt-5 "Two edits across two files." "a.css,b.css")"

if contains "$OUT5" "2 changes applied. Files: a.css, b.css. Sent for review."; then
  pass "Case 5: multiple files listed in status line"
else
  fail "Case 5: multiple-file status line missing. Got:
$OUT5"
fi

# =============================================================================
# Case 6: no files argument -> "Files: none."
# =============================================================================
OUT6="$(JUSTIFY_DRY_RUN=1 JUSTIFY_CHANGES="$ONE_CHANGE" \
  bash "$DONE" prompt-6 "One edit, no files reported.")"

if contains "$OUT6" "1 change applied. Files: none. Sent for review."; then
  pass "Case 6: 'Files: none' when no files argument"
else
  fail "Case 6: 'Files: none' status line missing. Got:
$OUT6"
fi

# =============================================================================
# Case 6b: table-cell injection is neutralized (pipe escaped, code-wrapped)
# =============================================================================
INJECT='[{"selector":".x | .y","property":"content","oldValue":"<b>bold</b>","newValue":"*em* `code`"}]'
OUT6B="$(JUSTIFY_DRY_RUN=1 JUSTIFY_CHANGES="$INJECT" \
  bash "$DONE" prompt-6b "Injection fixture." "z.css")"

if contains "$OUT6B" '`.x \| .y`'; then
  pass "Case 6b: pipe in selector escaped and cell code-wrapped"
else
  fail "Case 6b: pipe not escaped/wrapped. Got:
$OUT6B"
fi

if contains "$OUT6B" '`<b>bold</b>`'; then
  pass "Case 6b: raw HTML value wrapped in inert code span"
else
  fail "Case 6b: HTML value not wrapped. Got:
$OUT6B"
fi

if contains "$OUT6B" '`code`'; then
  fail "Case 6b: stray backtick pair leaked (injection). Got:
$OUT6B"
else
  pass "Case 6b: backtick in value neutralized (no stray code span)"
fi

# =============================================================================
# Case 6c: an EXPLICIT JUSTIFY_DIFF is parsed and surfaced as the card diff line
# (Jonah 2026-08-22). justify-done no longer auto-captures a diff - the daemon does
# that from a per-task baseline - but an explicitly passed diff is still honored.
# =============================================================================
EXPLICIT_DIFF='diff --git a/style.css b/style.css
--- a/style.css
+++ b/style.css
@@ -1 +1 @@
-.dot { color: white; }
+.dot { color: yellow; }'
OUT6C="$(JUSTIFY_DRY_RUN=1 JUSTIFY_DIFF="$EXPLICIT_DIFF" bash "$DONE" prompt-6c "Made the dot yellow." "style.css")"

if contains "$OUT6C" "Diff: 1 file (+1 / -1)."; then
  pass "Case 6c: explicit JUSTIFY_DIFF parsed and surfaced (+1/-1, 1 file)"
else
  fail "Case 6c: explicit diff not surfaced. Got:
$OUT6C"
fi

# =============================================================================
# Case 6d: no JUSTIFY_DIFF -> no auto-capture, so the Diff line is absent (the
# daemon supplies the panel diff; justify-done stays quiet unless overridden).
# =============================================================================
OUT6D="$(JUSTIFY_DRY_RUN=1 bash "$DONE" prompt-6d "No explicit diff." "style.css")"

if contains "$OUT6D" "Diff:"; then
  fail "Case 6d: Diff line must be absent without an explicit JUSTIFY_DIFF. Got:
$OUT6D"
else
  pass "Case 6d: no Diff line when no explicit diff is passed"
fi

# =============================================================================
# Case 7: exit codes preserved
# =============================================================================
bash "$DONE" >/dev/null 2>&1
RC=$?
if [ "$RC" -eq 1 ]; then
  pass "Case 7: missing args exits 1"
else
  fail "Case 7: expected usage exit 1, got $RC"
fi

JUSTIFY_DRY_RUN=1 bash "$DONE" prompt-7 "Dry run should succeed." >/dev/null 2>&1
RC=$?
if [ "$RC" -eq 0 ]; then
  pass "Case 7: dry-run exits 0"
else
  fail "Case 7: expected dry-run exit 0, got $RC"
fi

# =============================================================================
# Case 8: source script is bash -n clean
# =============================================================================
if bash -n "$DONE" 2>/dev/null; then
  pass "Case 8: justify-done.sh is 'bash -n' clean"
else
  fail "Case 8: justify-done.sh failed 'bash -n'"
fi

# =============================================================================
# Summary
# =============================================================================
printf "\n----- Summary -----\n"
printf "Passed: %d\n" "$PASS_COUNT"
printf "Failed: %d\n" "$FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
