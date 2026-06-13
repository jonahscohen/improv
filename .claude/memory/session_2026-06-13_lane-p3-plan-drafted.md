---
name: Lane P3 durability plan drafted (lease/fencing/schema-v2) - to Codex
description: P3 plan written - at-most-one-committed-transition core (O_EXCL lock, lease CLAIM/FINALIZE, fencing token, schema v2 migration); outbox/AbortSignal/heartbeat deferred to P4; sending to Codex
type: project
relates_to: [session_2026-06-13_lane-p2-COMPLETE.md, feedback_autonomous_phases_codex_partner.md]
---

P2 merged; moving the autonomous loop to P3. Drafted
docs/superpowers/plans/2026-06-13-lane-p3-durability.md (7 tasks), grounded in
spec section 7 lines 651-730 (the lease protocol) + the current merged
lane-checkpoint-store.ts (schema v1) and lane-runner.ts.

**Scope decision (the load-bearing call):** the spec's full lease machinery
(outbox, AbortSignal, heartbeat) exists to protect ASYNC validator execution +
external side-effect publishing - which is P4. In P2/P3 advanceLane's EXECUTE is
SYNCHRONOUS (model-attested, no async work, no external side effects). So P3
builds the at-most-one-committed-transition CORE that is real + testable NOW and
forward-compatible: O_EXCL checkpoint lock (lane-lock.ts), lease CLAIM/FINALIZE
(claimLease/finalizeLease in the store), monotonic fencingToken/fencingCounter,
schema v2 + v1->v2 read migration, advanceLane CLAIM->EXECUTE->FINALIZE,
live-lease rejection, stale-lease (crash) reclaim, priority interrupt/stop
fencing. DEFERRED to P4 (where async validators live): side-effect outbox +
PUBLISH, AbortSignal propagation, heartbeat-during-long-EXECUTE. Building those
now = untestable machinery protecting nothing.

**Guarantee (honest):** AT-MOST-ONE COMMITTED TRANSITION (spec line 696), NOT
exactly-once execution.

**Applied P2 lessons in the plan's self-review:** trace every new fn to its
caller in the same task (the P0-3 caller-less trap); owner-checked commits +
keep successfulFlowIds-only attestation + the partial-serve/dup-on-in_progress
guards through the rewrite; ground against live code (dir() is private; schema
is v1; existing suites guard the P2 advanceLane behaviors that must survive).

**Process note:** content-guard blocked the first full Write on a stray
em/en-dash I couldn't see; bisected by writing in halves; the re-typed second
half came out dash-clean. Final file verified: 0 NUL, 0 unicode dashes, 491
lines, 7 tasks.

**Next:** commit P3 plan -> Codex plan review -> fold -> execute via fresh team
(lane-p3-exec) -> Codex code review -> merge -> P4 (the big one: validators +
rule registry + loops + convergence + MCP + cleanup).

Collaborator: Jonah.
