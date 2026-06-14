---
name: P4f COMPLETE (merged) - FlowHistory outbox publisher; Codex SHIP after 3 durability fix rounds
description: P4f (second outbox publisher 'flow-history' - committed lane STEP results durably written to flow history, fencing-conditional + idempotent via the P4b-1 replay path) built + verified + Codex-reviewed (4 findings across 3 fix rounds, all durability correctness) + SHIP; merged to main (NOT pushed)
type: project
relates_to: [session_2026-06-14_p4f-fixes-verified.md, session_2026-06-14_p4f-rereview2-index-invariant.md, session_2026-06-14_p4b1-COMPLETE.md]
supersedes: session_2026-06-14_p4f-fixes-verified.md
---

P4f COMPLETE and merged to main. Lane step completions now publish DURABLY to flow
history via the P4b-1 outbox replay path (second declared publisher 'flow-history'),
fencing-token-conditional + idempotent, with NO EXECUTE-time write.

**Deliverable:** OUTBOX_PUBLISHERS=[lane-side-effect-sink, flow-history]; generalized
publishOutbox dispatch + per-publisher ack (record removed only when all ack, no
semantic-revision bump); committedStepOutbox helper at BOTH STEP FINALIZE sites
(convergence boundary stays sink-only); FlowHistory gained a fencing-conditional
upsertLaneFlow + a persistent laneFencing index (logicalKey -> highest token)
invariant-maintained (>= every retained run's token, backfilled on every reload,
persisted by every saving mutation); recordFlow + 20-run cap + public API preserved
for existing callers (additive optional fields). lead-directed HOME-isolation in
run-tests.ts so tests never pollute the real ~/.claude/sidecoach-flow-history.json.

**Process:** Codex-authored plan (role inversion) -> I reviewed+approved with a
HOME-isolation correction -> impl-p4f executed 6 tasks TDD -> Codex code review = 4
durability findings across 3 fix rounds, ALL real correctness issues:
  1. stale-snapshot lost-update (recordFlow clobbers acked lane entry)
  2. 20-cap forgets fencing (eviction -> stale resurrection)
  3. migration gap (retained run w/o index entry -> lower token overwrites)
  4. migration seed not durably persisted (in-memory seed evaporates -> eviction
     writes stale token)
Findings 2-4 traced to me repeatedly under-specifying the index DURABILITY; round 3
switched from point-patches to the enforced INVARIANT (backfill-on-reload +
persist-on-every-save), which closed the whole class. Final Codex re-review = SHIP,
zero defects.

**Verification (each round):** impl per-task green + MY independent re-run (scope
only sidecoach/src+scripts+dist, 0 dashes/NUL/emoji, build exit 0, 46 engine suites,
real flow-history md5 03ad42c4 byte-identical before+after EVERY run, dist carries
changes, fix code read line-by-line) + Codex review/re-reviews.

**Commit chain (14 on main, FF from the P4f-plan commit):** d21c5e2 HOME-isolation,
bb2ce93/528014e/6d873df/c90f3c2/4824644 (T2-T6), dfe1285/5eb962e/82da4c1 (round-1
P1s), cea63b5/a86d479/c7484ff (round-2 migration+setContext), d8fa61d/a859ea7
(round-3 invariant). lane dist committed (explicit allowlist; runtime loads it).

**NOT pushed** to origin (Jonah's standing call).

**Lane build work COMPLETE** (P1, P2, P4a-1, P4a-2, P4b-1, P4c, P4d, P4f all merged).
Remaining: P4b-2 (browser-evidence collector - engine-driven Playwright per
[[session_2026-06-14_p4b2-playwright-decision]], NEXT) + P4e (copy gating, deferred)
+ 2 deferred follow-ups: (a) the pre-existing lane-runner-concurrency.test.ts silent
no-op (run-tests should require a per-suite success marker), (b) bidirectional
eligibility parity (extract the hook's _intent_eligible into sidecoach_lanes.py).

Collaborator: Jonah.
