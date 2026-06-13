---
name: Lane P1 Task 4 - grouped-evidence scoring + clause-bound 3-state scope
description: Implemented Task 4 via TDD - evaluate_lane() does per-occurrence clause binding (negation discard -> negative-filter OOS -> ui IN/UNKNOWN), grouped max-weight scoring; 21/21 incl 2 adversarial edges.
type: project
relates_to: [session_2026-06-13_lane-p1-task3-sanitize-blanking.md, session_2026-06-13_lane-p1-task2-conjunction-boundary-fix.md]
---

Collaborator: Jonah

Implemented **Task 4 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. TDD; committed only the two modified files.

## What was done

- `claude/hooks/sidecoach_lanes.py` - appended (verbatim from plan Step 3):
  - `_NEGATORS`, `_wb(pattern)` (hyphen-aware word-boundary compile), `_compile_all` (isolates one bad regex), `_clause_bounds(pos, spans)`, `_has_negator(prefix)`.
  - `evaluate_lane(lane, prompt, reg)` - sanitize+blank, segment, then for each lexicon match: bind to its clause, DISCARD if a negator precedes it in-clause, mark OUT_OF_SCOPE-occurrence if a negative_filter shares the clause, else count IN (ui_evidence in clause) or UNKNOWN. Score = sum over groups of MAX weight per group. Scope: any IN -> IN_SCOPE; else (no unknown, some oos) -> OUT_OF_SCOPE (score 0); else SCOPE_UNKNOWN. Returns {lane,label,score,scope,evidenceIds[:3]}.
- `claude/hooks/test_sidecoach_lanes.py` - the plan's 5 tests + 2 adversarial (before `__main__`).

## Adversarial tests (the team-lead-called-out clause-binding edges)

Plan tests already cover: negation-then-route-second, negative-filter-shares-clause OOS, cross-sentence "landing page done. migration production-ready" OOS, grouped max-not-sum. Added the gaps:
- `test_bare_ui_noun_does_not_prove_scope_but_qualified_does` - bare "interface"/"header"/"layout" are NOT in the registry ui_evidence (only "user interface"/"page header"/"page layout" etc are), so a lexicon hit with only a bare noun is SCOPE_UNKNOWN, while the qualified phrase is IN_SCOPE. Built from the registry as source of truth (verified bare nouns absent, qualified present, and the bare strings dodge other bare ui words like hero/grid/responsive).
- `test_negator_alone_discards_to_not_in_scope` - a lone negated occurrence with no saving second clause -> NOT IN_SCOPE, score 0 (guards the pure-discard path; the plan only tested the "later clause saves it" path).

## Verification

- TDD red: 7 new tests FAIL with `AttributeError: ... no attribute 'evaluate_lane'` (right reason); 14 prior pass. (`14 passed, 7 failed`)
- TDD green: `21 passed, 0 failed`, exit 0.
- Extra cross-lane probe (not committed): lane_calm "too busy"+hero -> IN_SCOPE/3; lane_converge "loop until it passes" -> SCOPE_UNKNOWN/3 (grouped max, not sum); lane_ship backend "database migration" -> SCOPE_UNKNOWN/0 (no lexicon hit -> no occurrence -> lane silent); evidenceIds caps at 3. Confirmed lexicon is exact-phrase ("make the navbar pop" does NOT match "make it pop" -> no false fire), which is the intended design.
- Runner: `python3 test_sidecoach_lanes.py`. model-router-guard: pure stdlib (re), no LLM/network.

## Files touched

- claude/hooks/sidecoach_lanes.py (added _NEGATORS/_wb/_compile_all/_clause_bounds/_has_negator/evaluate_lane)
- claude/hooks/test_sidecoach_lanes.py (+7 tests)
