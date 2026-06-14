---
name: P4f code review (Codex) NEEDS-FIXES - 2 P1 FlowHistory durability defects -> impl-p4f
description: Codex code review of lane-p4f = NEEDS-FIXES; core confirmed sound but 2 P1 durability holes in the FlowHistory persistence model (stale-snapshot lost-update clobbers acked lane entry; 20-run cap eviction forgets fencing -> stale replay resurrection); + the pre-existing P2 concurrency-test no-op deferred; routed to impl-p4f with fixes + a sync/async design decision
type: project
relates_to: [session_2026-06-14_p4f-impl-done-verified.md, session_2026-06-14_p4b1-lock-decision.md]
---

Codex code review (task-mqdt5x22; session 019ec646) of lane-p4f = NEEDS-FIXES.
No P0. Core CONFIRMED sound (retained-entry fencing logic, additive fields,
production path unchanged, publisher reload-inside-lock, per-publisher ack retains
record until all ack + no revision bump, both FINALIZE sites use committedStepOutbox
+ no EXECUTE-time write + boundary sink-only, post-commit publish-throw does NOT
break transition/replay, HOME isolation inherited by spawned suites, dist 15/16
correct, mcp/hooks untouched, tsc+git-diff-check pass). 2 P1 + 1 pre-existing P2:

**P1-1 LOST-UPDATE (stale snapshot clobbers an acked lane entry).** FlowHistory
loads the global file into a per-instance snapshot at construction
(flow-history.ts:67); save() overwrites the WHOLE file from that snapshot (:101).
The publisher uses a fresh instance under its lock, but existing recordFlow()
callers do NOT lock/reload (:160). Failure: long-lived singleton loads -> lane
publisher writes+acked (outbox removed) -> singleton later recordFlow() overwrites
from its stale snapshot -> lane entry GONE, unrecoverable. Realistic: orchestrator
builds the singleton early (sidecoach-orchestrator.ts:97), records flows later
(:186).

**P1-2 20-CAP FORGETS FENCING (stale resurrection).** New keys evict the oldest
run at 20 (flow-history.ts:149); upsertLaneFlow fencing scans only RETAINED runs
(:177); if the tagged run was evicted, same/lower token is treated as a new key
and appended (:198). So after 20 newer runs of the same lane:<laneId>:<stepId>,
replaying an old pending outbox appends the STALE result as latest - violates
same-token-noop / lower-token-reject / highest-token-persistence.

**P2-3 (pre-existing, DEFERRED):** lane-runner-concurrency.test.ts ends with an
unawaited run() (:285); run-tests counts exit-code only (:95) -> the suite can exit
0 without running its checkpoints. Byte-identical on main = latent, NOT a P4f
regression. Separate follow-up: run-tests should require a per-suite success marker.

**MY FIX DIRECTION to impl-p4f (lead decision on the sync/async tension):**
- P1-1: make EVERY FlowHistory mutation RELOAD-FRESH-FROM-DISK immediately before
  mutate+save (recordFlow via appendFlow, upsertLaneFlow, and any other saving
  mutator). Within ONE process a sync readFileSync->modify->atomic-write block is
  atomic (Node single-threaded; nothing interleaves mid-sync-block), which fully
  fixes the realistic stale-singleton clobber. upsertLaneFlow/publisher KEEP the
  async withCheckpointLock for cross-process best-effort. recordFlow stays SYNC
  (do NOT break its ~callers) but reloads-before-save; cross-process recordFlow vs
  publisher stays best-effort, consistent with the P4b-1 lock decision
  [[session_2026-06-14_p4b1-lock-decision]] - document that boundary. Regression
  test: construct an ordinary FlowHistory (stale snapshot) BEFORE a lane publish,
  recordFlow AFTER, assert the lane entry survives.
- P1-2: persist a SEPARATE logicalKey -> highest-accepted-token index (tombstone)
  in the flow-history file, NOT subject to the 20-run presentation cap.
  upsertLaneFlow consults the index for the fencing decision (reject lower, noop
  same) and updates it on accept, so eviction of the presentation run cannot
  resurrect a stale result. Tests: same/lower/higher-token delivery AFTER the
  tagged run is evicted by 20 newer same-flowId runs.
- P2-3: NOT in P4f; note as a follow-up.
Each fix failing-first. Re-verify (46 suites, real flow-history untouched), then
re-review (Codex) before merge.

Collaborator: Jonah.
