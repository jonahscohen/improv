---
name: Self-analysis - I used Codex as first-line QA instead of self-reviewing first (messy first drafts)
description: Jonah called out that Codex kept catching my mistakes and asked if he should switch to Codex entirely. Root cause - I inverted the produce-verify order, treating Codex as my first quality filter instead of self-reviewing to the bar FIRST and using Codex as second-line verification. Fix - run and SHOW an explicit self-review pass before handing to Codex or dispatching.
type: feedback
relates_to: [session_2026-07-14_parallel-dispatch-plan.md, feedback_multiagent_verified_implementation_mandate.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-14. Jonah, frustrated: "Is there a reason you're being so messy and Codex is catching all your mistakes? ... Should I switch to Codex and never use Claude for code? How do I prevent you from being so messy and lazy?"

## The honest analysis (Self-Analysis Protocol)
Two buckets of Codex catches this session:
1. **Legit hard edge cases** (the produce-verify system working as designed): the cross-hook compile race, the multi-hop broken symlink, the space-in-path state write. A second model SHOULD catch these; not laziness.
2. **Things I should have self-caught** (the actual mess): the U11/U12 state-collision - which violates my OWN stated "disjoint files = parallel-safe" model; the U10 "blocked by U3" vs "proceed immediately" self-contradiction in the first plan; and the body-vs-prompt spec DRIFT where I folded a fix into a unit's body but left its dispatch-prompt duplicate stale (Codex Wave-2 round 2 was entirely this class).

**Root cause:** I inverted the order. I used Codex as my FIRST-line quality check instead of my SECOND-line verification. Produce a draft -> throw it at Codex -> fold what comes back. The produce-and-verify mandate (feedback_multiagent_verified_implementation_mandate) intends Codex as verification of ALREADY-self-reviewed work, not as the first filter. I even invoked the writing-plans skill, which has an explicit Self-Review step (spec coverage, placeholder scan, type/consistency), and did not run it - I let Codex be that pass. That is the "lazy" Jonah named: outsourcing my own first-pass rigor.

**Specific tells I ignored:** duplicated spec (unit body + dispatch prompt) that I edited in one place and not the other = a DRY violation I did not reconcile; a "disjoint FILES" collision model I applied mechanically without checking STATE/content coupling (U11 documents test-site-1 live while U12 deletes it).

## The fix (mechanism, not a promise)
1. Run and SHOW an explicit self-review pass BEFORE handing to Codex or dispatching: spec coverage, internal consistency (including body-vs-prompt drift), no self-contradictions. Surfaced so Jonah can hold me to "where's your self-review?" - a one-line check.
2. Candidate hook: a plan-doc consistency linter that flags (a) dispatch-prompt vs body spec drift and (b) self-contradictory sequencing ("blocked by X" + "proceed immediately"). Mechanizes the dumb-consistency catches so Codex is spent only on hard problems.

**Calibration for future me:** the WORK held up (5 units TDD'd, 14/14 suites green, concurrency correct, clean integration). The failure was planning-consistency in first drafts, caught before execution. The bar to raise is my own first-pass rigor, not the model's coding ability. When Codex's findings are dominated by bucket-2 (my own inconsistencies), that is the signal I skipped self-review.

## Files touched
- .claude/memory/feedback_self_review_before_codex.md (this beat) + MEMORY.md
