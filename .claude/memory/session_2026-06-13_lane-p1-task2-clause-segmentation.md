---
name: Lane P1 Task 2 - clause segmentation (length-preserving)
description: Implemented Task 2 of the P1 classifier-tier plan via TDD - segment_clauses() splits on sentence terminators + comma-conjunction, abbreviation-safe, length-preserving; 7/7 tests green
type: project
relates_to: [session_2026-06-13_lane-p1-task1-registry-loader.md, session_2026-06-13_lane-p1-plan-verifier-corrections.md]
---

Collaborator: Jonah

Implemented **Task 2 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. TDD; appended one function + four tests; committed only the two modified files.

## What was done

- `claude/hooks/sidecoach_lanes.py` - added `segment_clauses(text)` (verbatim from plan Step 3) plus the `ABBREVIATIONS` / `CONJUNCTION_BOUNDARIES` / `_TERMINATORS` constants. Splits at sentence terminators (`.!?;\n`) and at a comma followed by a coordinating conjunction (`, but/, and/, or/, yet/, so`); abbreviation periods (e.g./i.e./vs./etc./Dr./Mr./Ms.) are masked with `\x00` so they don't split. Returns `[(start, end)]` spans that tile the whole string without changing length.
- `claude/hooks/test_sidecoach_lanes.py` - added the plan's 4 Task 2 tests (terminator split, comma-conjunction-only split, abbreviations-do-not-split, length-preserving).

## Note on test placement

Plan says "append" the new tests, but I inserted the 4 `test_*` functions BEFORE the `__main__` block, not literally at EOF. Why: the pytest-free fallback runner (added in Task 1) discovers tests via `globals()` at runtime; functions defined after the `__main__` block executes would not be registered. Inserting before the block keeps them discovered. Test bodies are byte-for-byte from the plan.

## Verification

- TDD red: `python3 test_sidecoach_lanes.py` -> 4 new tests FAIL with `AttributeError: module 'sidecoach_lanes' has no attribute 'segment_clauses'` (right reason); 3 Task 1 tests still pass.
- TDD green: `7 passed, 0 failed`, exit 0.
- Extra property check (not committed): spans tile every test input contiguously, non-overlapping, length-preserving; empty string -> `[]`. No failures.
- Runner standard: `python3 <file>.py` (pytest not installed); model-router-guard satisfied - pure stdlib (`re`, `json`), no LLM/network.

## Files touched

- claude/hooks/sidecoach_lanes.py (modified - added segment_clauses)
- claude/hooks/test_sidecoach_lanes.py (modified - added 4 tests)
