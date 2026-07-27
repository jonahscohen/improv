---
name: Agent routing Task 4 complete (escalate-up tie-break regression lock)
description: Three assertions appended to test-route-intent.sh proving multi-tier prompts resolve to the most capable tier, plus a direct check on escalation_order in route-intent.json. No production code changed. Suite 18/18.
type: project
relates_to: [session_2026-07-26_agent-routing-task3.md]
author_human: Jonah
source: session
verified: bash claude/hooks/test-route-intent.sh, 18 passed 0 failed
confidence: high
---

# Task 4: escalate-up tie-break

Collaborator: Jonah. Commit (test-only): "test: lock route-intent
escalate-up tie-break".

## What shipped

This task added no production code, as the brief stated up front. The
escalate-up behavior it covers was already implemented in Task 2 (the match
loop iterates `escalation_order` and returns the first hit), so this task's
job was purely to regression-lock it before a future contributor could
silently invert the order by reordering the lexicon.

Three assertions appended immediately before the RESULTS block:

1. `multi-tier prompt escalates to opus-executor` - a prompt containing both
   `refactor` (opus_executor) and an `update every ... reference` shape
   (sonnet_impl) must resolve to opus-executor, since opus_executor is
   checked first in `escalation_order`.
2. `sweep plus lookup escalates to Explore` - a prompt containing both a
   `find all` shape (explore) and a `which file owns` shape (quick_answer)
   must resolve to Explore, checked before quick_answer.
3. `assert_escalation_order` - reads `route-intent.json`'s
   `escalation_order` directly via python3/json and asserts it equals
   `opus_executor,sonnet_impl,explore,quick_answer` verbatim. This is the
   actual regression lock: assertions 1 and 2 prove behavior today, this one
   guards the lexicon data that produces it.

## Verification that this was a real test, not a vacuous one

All three passed on first run, exactly as the brief predicted. Given the
Task 1 and Task 3 history in this project (tests whose pass condition was
"nothing happened," true regardless of the code under test), I did not
accept a first-pass green as sufficient on its own. I confirmed:

- `route-intent.json`'s `escalation_order` was already
  `["opus_executor", "sonnet_impl", "explore", "quick_answer"]` before this
  task touched anything, so assertion 3 has a real thing to check (it is not
  vacuously true because the field is absent).
- Assertion 1's prompt genuinely matches an opus_executor pattern
  (`\brefactor\b`) independent of whether it also matches sonnet_impl, so
  the result is not an artifact of only one tier matching.
- Assertion 2's prompt genuinely matches an explore pattern
  (`find (all|every|each) `) independent of whether it also matches
  quick_answer's `which file (owns|holds|defines|contains)` pattern.

This is a positive assertion of a specific match result (not "silence"), so
the vacuous-test shape from Tasks 1 and 3 does not apply here directly - but
verifying that both tiers in each multi-tier prompt actually match was the
relevant analogue for this task, and it held.

## Files touched
- `claude/hooks/test-route-intent.sh` (3 assertions appended before RESULTS)
- `.claude/memory/session_2026-07-26_agent-routing-task4.md` (this beat)
