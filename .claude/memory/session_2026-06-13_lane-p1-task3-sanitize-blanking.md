---
name: Lane P1 Task 3 - sanitize + occurrence-aware informational blanking
description: Implemented Task 3 via TDD - length-preserving sanitize() (code/URL/XML/transcript) + blank_informational() (info frames + quoted spans); 14/14 green incl. 3 adversarial quote-boundary tests.
type: project
relates_to: [session_2026-06-13_lane-p1-task2-clause-segmentation.md, session_2026-06-13_lane-p1-task2-conjunction-boundary-fix.md]
---

Collaborator: Jonah

Implemented **Task 3 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. TDD; committed only the two modified files.

## What was done

- `claude/hooks/sidecoach_lanes.py` - appended (verbatim from plan Step 3):
  - `_blank(match)` - returns same-length spaces for a match.
  - `sanitize(text)` - length-preserving strip of code fences, inline backticks, URLs, XML element bodies + bare tags, and transcript markers (`[TURN n: ...]` / `[MAGIC KEYWORD ...]`). Each region -> equal-length spaces so segmentation offsets stay valid.
  - `_INFO_FRAMES` (what/how/tell me about/explain/define, each consuming `[^.!?;\n]*` to the sentence terminator), `_QUOTE_FRAME` (`["“]...["”]`, <=400 non-quote chars), and `blank_informational(text)` applying both, length-preserving.
- `claude/hooks/test_sidecoach_lanes.py` - the plan's 3 tests + 3 adversarial tests (before `__main__`).

## Adversarial tests (carry the prefix-collision lesson)

The quoted-span frame is Task 3's analogue of Task 2's over-consuming boundary, so I added:
- `test_blank_informational_quote_does_not_eat_following_intent` - quote blanked but real intent AFTER the closing quote survives.
- `test_blank_informational_unclosed_quote_preserves_intent` - an opening quote with no close must NOT blank downstream intent (the regex requires a close, so it doesn't match - confirmed).
- `test_sanitize_length_preserving_on_combined_regions` - code fence + inline code + URL + XML + transcript marker in one string: all blanked, trailing real intent survives, length preserved.

## Known/intended behavior surfaced (NOT a bug, flagged for Task 4/5 + verifier)

Informational frames are SENTENCE-scoped, not comma-clause-scoped: they consume to the next `.!?;\n`, so `"explain the dashboard, then build a hero from scratch"` (one sentence, comma only) is ENTIRELY blanked, suppressing the lane_build "from scratch" evidence. This matches the design comment ("terminators stop them... never crosses a sentence boundary") and the spec's anti-false-fire motivation (favor suppress over false-fire). Left as-is - changing frame scope to comma-clauses would exceed Task 3 and contradict the documented design. Worth a spec note if false-negatives on mixed "explain X, do Y" prompts become a problem.

## Verification

- TDD red: 6 new tests FAIL with `AttributeError: ... no attribute 'sanitize'`/`'blank_informational'` (right reason); 8 prior pass. (`8 passed, 6 failed`)
- TDD green: `14 passed, 0 failed`, exit 0.
- Extra pipeline probe (not committed): `blank_informational(sanitize(t))` is length-preserving and `segment_clauses` tiles it with spans covering to len(t) across 5 nasty inputs - confirms downstream (Task 4) clause offsets remain valid.
- Runner: `python3 test_sidecoach_lanes.py` (pytest not installed). model-router-guard: pure stdlib (re), no LLM/network.

## Follow-up: test-hardening (verifier note)

`test_blank_informational_unclosed_quote_preserves_intent` was a weak guard - its protected token ("production-ready") sat BEFORE the unclosed quote, so it would pass even against a hypothetical blank-to-EOL bug. Rearranged per the verifier: `t='the memo said "ship it then polish the hero from scratch'` with `assert "polish the hero from scratch" in out` (protected intent AFTER the opening quote, where a blank-to-EOL impl would wrongly eat it). Production code was already correct; this just makes the guard match its name. Still 14/14. Test-only commit (separate SHA).

## Files touched

- claude/hooks/sidecoach_lanes.py (added _blank/sanitize/_INFO_FRAMES/_QUOTE_FRAME/blank_informational)
- claude/hooks/test_sidecoach_lanes.py (+6 tests; later: strengthened unclosed-quote guard)
