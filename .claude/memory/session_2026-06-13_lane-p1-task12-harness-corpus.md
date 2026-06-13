---
name: Lane P1 Task 12 - v10 lane classifier corpus in test-sidecoach-keyword.sh
description: Rewrote the bash hook harness to assert v10 LANE behavior - flipped/removed the 13 obsolete mode-tier + tie-break + old-intent assertions, added assert_contains/assert_not_contains + the v10 lane corpus + NUDGE cooldown mapping. Harness now 110 passed, 0 failed.
type: project
relates_to: [session_2026-06-13_lane-p1-task6-hook-wiring.md]
---

Collaborator: Jonah

Implemented **Task 12 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. Committed 1 file (the harness). This is the task that flips the 13 Task-6 obsolete failures green.

## What was done (5 surgical edits to claude/hooks/test-sidecoach-keyword.sh)

1. Added `assert_contains` / `assert_not_contains` helpers (label-first, mirror assert_fires; reuse assert_silent for empty-output).
2. Flipped the 3 tie-break tests: assert_tiebreak -> assert_fires (the FIRST verb still fires; dropped the obsolete "tie-breaking to first in registry" stderr-warning assertion, which the single-emit VERB branch no longer prints).
3. Replaced the T-0011 modes section: deleted the 6 assert_mode_fires + the 2 mode-combo blocks (mode tier removed); KEPT the word-boundary ("forged"/"blooming"/"trimmed") + informational ("what is forge" etc) silent guards; flipped "forge + polish" to assert the polish VERB routes (mode word ignored now).
4. Flipped "intent: build a pricing page": now CONTEXT_CHECK (lane_build "build me a" evidence, no domain word) -> assert_contains "without domain evidence" via run_hook (CONTEXT_CHECK is not cooldown-gated).
5. Replaced the broken old cooldown test (its 2nd prompt "build a hero section" now CLASSIFYs, not nudge) with: the v10 lane corpus (Step 2) + the navbar NUDGE cooldown mapping (Step 3, via intent_out: inactive->nudge, active->silent).

## Deviation: omitted the plan's "struct layout silent" corpus case

The plan's Step 2 included `assert_silent "struct layout silent" 'rework the memory layout of the struct'`. That FAILS: "layout" is a registered sidecoach VERB, so the prompt fires VERB(layout), not silence. Same plan-corpus bug I corrected in the Task 7 parity corpus (dropped the identical case there). Omitted it + left an inline NOTE in the harness. Kept the other two bare-token silent cases (ts interface, packet header) which are genuinely silent. (Heads-up: layout/live/audit being both verbs AND common English words is a latent false-fire surface - calibration is out of P1 scope.)

## Determinism note

assert_contains/assert_not_contains/assert_silent use run_hook (no cooldown env). The lane corpus outcomes (ROUTE/CONTEXT_CHECK/CLASSIFY/OUT_OF_SCOPE/VERB) are NOT cooldown-gated, so they're deterministic. NUDGE cases (the only cooldown-gated outcome) are driven through intent_out with an explicit cooldown file (Step 3), so inactive->nudge / active->silent is deterministic too. The "converge surfaced" case is CLASSIFY (the 'audit' verb competes with the route-grade lane), but the lane label "iterate-until-it-passes" still appears in the CLASSIFY prompt, so the substring assertion passes.

## Verification (REAL run)

- `bash claude/hooks/test-sidecoach-keyword.sh` -> "RESULTS: 110 passed, 0 failed", "All tests pass.", exit 0. The 13 obsolete assertions are gone/flipped; nothing new fails.
- Retained guards confirmed present + green: all 22 verb-fires, sanitization (code/backtick/URL/XML/transcript), informational suppression, word-boundary, the Task-6 quoted-verb-SILENT guard, the NUDGE cooldown cases.
- Unchanged elsewhere: `cd sidecoach && npm test` -> 5 suite(s) passed (exit 0); `python3 test_sidecoach_lanes.py` -> 35 passed, 0 failed.
- model-router-guard: pure bash/regex harness, no LLM/network.
- Note: the assert_mode_fires / assert_tiebreak helper FUNCTION definitions are now unused (their calls were removed/flipped). Left in place (harmless dead code) to minimize churn; a future cleanup can drop them.

## Files touched

- claude/hooks/test-sidecoach-keyword.sh (v10 lane corpus + cooldown mapping; obsolete mode/tie-break/old-intent assertions removed or flipped)
