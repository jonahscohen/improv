---
name: Lane P1 Task 1 - registry + Python loader/validator
description: Implemented Task 1 of the P1 classifier-tier plan via TDD - lane registry JSON + pure-stdlib load_registry/validator + test, all green
type: project
relates_to: [session_2026-06-13_lane-p1-plan-verifier-corrections.md, reference_lane_impl_grounding_v10.md]
---

Collaborator: Jonah

Implemented **Task 1 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. TDD, three files created, committed alone (repo has unrelated drift - not staged).

## What was done

- `claude/hooks/sidecoach-lanes.json` - declarative lane registry. 6 lane records in canonical order [lane_build, lane_ship, lane_delight, lane_live, lane_calm, lane_converge]. Each has lane/label/description/interviewLabel/executionKind/verbChain/prereqWaivers/lexicon. `scope` (ui_evidence + negative_filters), `scoring` (route_floor=3, route_margin=2, classify_floor=1), schemaVersion=1. Only lane_converge is executionKind "loop". Verbatim from plan Step 3a.
- `claude/hooks/sidecoach_lanes.py` - `load_registry(path)` + validation only (NO classifier - that is Tasks 2-5). Pure stdlib (`json`, `re`). Verbatim from plan Step 3b.
- `claude/hooks/test_sidecoach_lanes.py` - the plan's three test functions verbatim (six-lanes-required-fields, scope-and-scoring-present, only-converge-is-loop).

## Key decision: pytest-free test runner

**Why:** pytest is NOT installed on this machine (Python 3.14.5, bare stdlib). The plan's verbatim `__main__` block does `import pytest`, which would also fail.
**How:** kept the three test functions byte-for-byte from the plan; replaced only the `__main__` block with a try-pytest / else run-`test_*`-functions-directly fallback. The test stays runnable on bare Python 3 (matches the hook runtime, which is pure stdlib per model-router-guard). Team lead anticipated this ("python3 test_sidecoach_lanes.py if pytest is unavailable").

## Verification

- TDD red: `python3 test_sidecoach_lanes.py` -> `ModuleNotFoundError: No module named 'sidecoach_lanes'` (right reason).
- TDD green: `3 passed, 0 failed`, exit 0.
- Extra self-review (not in plan): all scope regex compile; all 6 verbChains match the golden lane table; loader validation branches genuinely reject empty-lanes / missing-scope / missing-scoring (no placeholder logic).
- model-router-guard: no LLM calls anywhere - pure JSON + Python stdlib.

## Files touched

- claude/hooks/sidecoach-lanes.json (new)
- claude/hooks/sidecoach_lanes.py (new)
- claude/hooks/test_sidecoach_lanes.py (new)
