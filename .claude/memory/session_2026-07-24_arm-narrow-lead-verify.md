---
name: verify-before-done visual-arm eval/test/tmp narrowing lead-verified + committed
description: Lead confirmed arm-narrow's precision carve-out - test-verify-before-done 168/0 (was 145), stop-side byte-identical (arm-only fix), bash -n clean, predicates segment-anchored so recall is preserved (real product UI still arms visual). Fixes the 3rd-recurrence eval-fixture false-arm that pestered this session.
type: project
relates_to: [session_2026-07-24_verify-arm-eval-test-tmp-narrowed.md, session_2026-07-24_visual-gate-override-eval-fixtures.md, session_2026-07-23_verify-visual-arm-reference-narrowed.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - lead re-ran test-verify-before-done (168/0) + test-nudge-debounce (green), confirmed verify-before-done-stop.sh byte-identical, bash -n clean, predicates correctly anchored
confidence: high
---

Collaborator: Jonah. 2026-07-24. arm-narrow closed the eval-fixture/test-file/tmp visual-arm false positive that fired 3x this session; lead-verified and committed.

## The fix
A precision carve-out on the visual-arm CLASSIFIER in verify-before-done.sh (arm-side only), applied to the write TARGET, wired into the two lowest-level functions (is_exempt, is_visual_file) so both the Write branch and the Bash `_visual_write_target` inherit it:
- `_EVAL_DATA_RE = (^|/)eval/(fixtures|corpus)/` -> exempt. SEGMENT-anchored (the leading `^|/` catches the cwd-relative `eval/fixtures/x.html` the old `/eval/` substring missed, while `preeval/fixtures/` and `src/eval/Calculator.tsx` still arm).
- `_TEST_FILE_RE = \.(test|spec)\.[A-Za-z0-9]+$` (basename) -> declassify visual->code (a test file "runs its tests", never a screenshot).
- `_is_temp_target` -> declassify, but narrowed to a DIRECT scratch drop (immediate parent IS the temp root) after Codex caught that a full-subtree prefix match would miss the gate on a real repo checked out under /tmp (nested product paths keep arming visual).

## Lead verification (not the teammate's self-report)
- `test-verify-before-done.sh` 168/0 (was 145; +23 both-ways rows: eval/test/tmp NOT-arm + src/components/styles/app STILL-arm + anchor controls).
- `test-nudge-debounce.sh` green (arm-narrow's own mid-work regression there - an over-broad /tmp exempt - was self-caught, isolated against HEAD, root-caused, and fixed by moving tmp to declassify).
- `verify-before-done-stop.sh` BYTE-IDENTICAL to HEAD - the Stop gate is untouched; the fix is purely that the flag never becomes `visual` for these targets, so the gate never fires on them, while a real UI change still arms `visual`.
- `bash -n` clean; predicates verified segment-anchored (recall-preserving).

## RECALL preserved (the property that matters - this hook governs the live session)
Real product UI still arms: src/components/Foo.tsx, styles/app.css, app/page.tsx, and a NESTED repo path under /tmp (/tmp/my-app/src/App.tsx) all -> visual. Only a DIRECT eval-fixture / test-file / scratch-root drop declassifies. A silent recall loss here would have disabled my own verification gate; the suite proves it did not.

## Flagged (not fixed - separate unit)
The pre-existing `/eval/` substring in EXEMPT_PATHS is broader than this fix's anchored patterns - it exempts any path containing `/eval/` (e.g. a hypothetical real `src/eval/Calculator.tsx`). Pre-existing, NOT introduced/widened here; tightening the legacy substring is a separate unit.

## Committed
As its own unit (verify-before-done.sh + test-verify-before-done.sh + beats). Disjoint from modes-delete (sidecoach, still running) and the just-committed defaultoff-hook.

## Files touched
- this beat + MEMORY.md index. The commit: claude/hooks/{verify-before-done.sh, test-verify-before-done.sh}.
