---
name: Lane P1 Task 2 fix - conjunction-prefix over-segmentation bug
description: Verifier-found bug in segment_clauses - comma-conjunction boundary used startswith (prefix), so ", butter" wrongly split. Fixed to a word-boundary regex; regression test added; plan source-of-truth synced.
type: project
relates_to: [session_2026-06-13_lane-p1-task2-clause-segmentation.md]
---

Collaborator: Jonah

Bugfix to Task 2's `segment_clauses` (originally committed in de653a6), found by the verifier before Task 4 (scope binding) could be corrupted by bad clause spans.

## The bug

Comma-conjunction boundary detection used `window.startswith(cb)` against `CONJUNCTION_BOUNDARIES = [", but", ", and", ...]`. `startswith` is a PREFIX match, so a comma followed by a word that merely STARTS with a conjunction also split. Probe: `"add salt, butter, and pepper to the gradient"` wrongly split at `", butter"` because `", butter".startswith(", but")`. Spec section 4 step 1 means the conjunction WORD, not a prefix.

## The fix (applied in 3 places for code/test/plan sync + Python/TS parity)

1. `claude/hooks/sidecoach_lanes.py` - replaced the `startswith` window check with a module-level compiled `_CONJUNCTION_RE` built from `CONJUNCTION_BOUNDARIES` with a trailing non-word lookahead: `(?:, but|, and|, or|, yet|, so)(?![\w])`, applied via `_CONJUNCTION_RE.match(masked, i)` anchored at the comma. Anchored match (not a fixed-size window slice) so the lookahead sees the real following char/EOL - strictly more robust than a 6-char window. Length-preserving and all prior behavior intact.
   - **Why match() over the verifier's "match the window" suggestion:** identical result, but anchoring at position `i` removes all window-truncation reasoning (max conjunction is 5 chars; a too-short window could mis-evaluate the lookahead). Built the regex FROM the word list so there is one source of truth.
2. `claude/hooks/test_sidecoach_lanes.py` - added `test_conjunction_boundary_is_word_not_prefix` (before `__main__`, like the others): asserts `"add salt, butter, and pepper..."` keeps "salt, butter" in one clause (no `", butter"` split) but DOES split at `", and"` (2 clauses, length-preserving), and that a real `", and "` still splits ("ship it, and call it done" -> 2). TDD: confirmed it FAILED against the buggy code first.
3. `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` - updated the Task 2 Step-3 code fence to the corrected `segment_clauses`, and added a REQUIRED parity note in Task 7 (TS keyword-resolver mirror) directing the TS `segmentClauses` to use the same conjunction-WORD-boundary rule (mirroring `_CONJUNCTION_RE`), since the Task 7 code fence still shows the prefix form and would diverge the Python/TS parity corpus.

## Self-analysis (why it happened, how it slipped through)

- **Why:** I implemented Task 2 verbatim from the plan, which itself used `startswith`. The bug originated in plan/spec authoring, but I propagated it without an adversarial test.
- **How it slipped:** my Task 2 tests covered the happy path (a real `", but"` boundary) and the negative (plain comma list) but NOT a near-miss input - a word that begins with a conjunction token (`butter`, `android`, `yetis`, `sodium`). Boundary/tokenization logic must be tested with prefix-collision adversarial inputs; "splits on `, but`" and "does not split on a word starting with `but`" are different assertions.
- **Lesson (now encoded):** the regression test includes the prefix-collision case, and an extra probe verified `butter/yetis/sodium/androids` do not split while genuine `and/but/or/yet/so` words do.

## Verification

- TDD red: regression test FAILED against buggy code (`7 passed, 1 failed`).
- TDD green: `8 passed, 0 failed`, exit 0.
- Extra probe (not committed): 11 strings incl. prefix traps - all correct; spans always length-preserving.
- model-router-guard: pure stdlib (re), no LLM/network.

## Files touched

- claude/hooks/sidecoach_lanes.py (conjunction boundary -> word-boundary regex)
- claude/hooks/test_sidecoach_lanes.py (+1 regression test)
- docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md (Task 2 fence corrected + Task 7 parity note)
