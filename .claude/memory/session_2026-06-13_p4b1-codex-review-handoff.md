---
name: P4b-1 plan review NEEDS-FIXES (P0 lock ABA) -> Codex authors v2, I review
description: agent-drafted P4b-1 hit a P0 (stale-lock reclaim ABA race - the same one P3 never fully fixed) + 6 P1 + 3 P2; deepest distributed-systems sub-plan; hand authoring to Codex; I made the LaneSideEffectSink scope call (authoritative-this-phase, document it)
type: project
relates_to: [session_2026-06-13_lane-p4b1-plan.md, session_2026-06-13_p4a2-COMPLETE.md, feedback_codex_takeover_on_round_fail.md]
---

Codex P4b-1 plan review (task-mqd6tool; session 019ec40a) = NEEDS-FIXES. P0 + 6 P1
+ 3 P2. Deepest sub-plan (lease durability folded into async validator gating).
Per role-inversion: Codex authors v2, I review.

CONFIRMED defensible: validator union/dedup, error>findings>inconclusive>clean
precedence, loop/browser/MCP/copy deferrals.

**P0 (must fix): lock stale-reclaim ABA race.** The reused P3 lock does a
non-atomic stale check then blind unlinkSync - two contenders both see the old
lock stale; A unlinks+acquires; B's already-decided unlink deletes A's NEW lock
and B acquires concurrently. Owner-checked release does NOT prevent it. This is
the EXACT race Codex flagged in P3 v2 (P1-1) that was never fixed (P3 folded
before converging). Breaks at-most-one-commit. FIX: race-safe takeover -
rename-based atomic claim (reclaimer renames stale lock to a unique name; only one
wins the atomic rename; then proceeds) OR an established lock library
(proper-lockfile). Adversarial test: two simultaneous stale reclaimers never
overlap critical sections. (Also: the current lock tests don't actually test
reclaimed-owner release.)

**P1:** 2 startLane first-step-lease: serveStep runs async handlers while the
start lock is held (can age stale -> duplicate checkpoint); use start lock only
for idempotent mapping + checkpoint/lease creation, release before serving,
execute first-step under the lease+FINALIZE. 3 heartbeat: only before each
validator -> one slow validator looks dead/reclaimable + cross-process interrupt
unobserved until it finishes; run an ownership-checking heartbeat LOOP throughout
EXECUTE (stop in finally); add an independent-store ownership-loss test during one
long validator. 4 LIVE_OPERATIONS ABA: A's unconditional delete(checkpointId)
removes B's controller after B reclaimed; key by full lease identity or delete
only if get()===controller; test. 5 retry over stale lease: retry mutates without
fencing a stale lease -> stale op can FINALIZE after; fence/clear stale lease
before retry/resume (or route via CLAIM/FINALIZE). 6 outbox crash recovery not
implemented/tested: the crash-after-FINALIZE test publishes normally; need to
leave a pending record + replay via production publishOutbox + a startup/
advance-time replay path. 7 validation status not applied: outcome.stepStatus
unused; persist latest gate/status on the step + expose via LaneState.steps; test
all 3 non-clean mappings + later reads.

**P2:** 8 Task 8 abort test depends on Task 9 impl (move test to Task 9 or impl
to Task 8). 9 several concurrency/recovery tests are prose not executable. 10
LaneSideEffectSink vs spec naming FlowHistory/session-memory as publishers.

**SCOPE DECISION (mine):** keep the dedicated LaneSideEffectSink authoritative
FOR THIS PHASE (retrofitting fencing onto the shared FlowHistory risks regressing
the non-lane engine + the 27 suites, and lane exec writes no flow-history today).
The plan must EXPLICITLY document this (lane sink authoritative in P4b-1) and
SCHEDULE a FlowHistory conditional publisher reading the same committed outbox
record in a named later phase. Not implement the FlowHistory retrofit now.

**Action:** codex task --write authors v2 closing the P0 + 6 P1 + 3 P2 + the scope
documentation. Then I verify+review (integrity, the lock-ABA fix correctness,
heartbeat loop, full identity, outbox replay), commit, gate, execute.

Collaborator: Jonah.
