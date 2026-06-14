---
name: P4b-1 code review - P0 lock race (3rd time) -> adopt proper-lockfile; 2 P1 + 1 P2 to impl
description: Codex code review NEEDS-FIXES with P0 - even rename-takeover has a 3-party window; the hand-rolled lock has failed correctness 3x; decision = adopt the vetted proper-lockfile lib; + P1 duplicate-start-handler-rerun, P1 heartbeat-blocked-by-sync-validators, P2 outbox per-publisher ack
type: project
relates_to: [session_2026-06-13_p4b1-v2-approved.md, session_2026-06-13_lane-p3-pivot-gutcheck.md, feedback_autonomous_phases_codex_partner.md]
---

Codex P4b-1 CODE review (task-mqda6pbq; session 019ec460) = NEEDS-FIXES. 33 suites
green + my independent verify, but a P0 + 2 P1 + 1 P2. CONFIRMED CORRECT: full
lease identity on FINALIZE+heartbeat; barrier concurrent-CLAIM proof; stale-owner
late-FINALIZE rejected; priority fencing + full-identity controller (no ABA);
gating union/worst-status/persisted-state/skip-bypass; unique-per-call op ids;
list exclusion+shape-guard; locked serve merge; scope boundaries.

**P0 - lock still loses mutual exclusion (3rd review of this lock).** Even the
rename-takeover renames whatever occupies lockPath BEFORE verifying ownership, so
a delayed stale reclaimer / old owner can rename away a NEWER live owner's lock; a
third process can acquire lockPath during the rename-to-verify/restore window;
restoration fails -> live owner runs without a shared lock -> overlapping
CLAIM/FINALIZE -> breaks at-most-one-committed. DECISION: stop hand-rolling.
Adopt the vetted proper-lockfile library (mkdir-atomic lock + mtime staleness
refresh + compromised callback) wrapped behind the existing withCheckpointLock
signature. Add the 3-contender test (stale observer pauses, replacement acquires,
observer resumes, third contender attempts). This is the same lock that failed in
P3 plan + P4b-1 plan; hand-rolled interprocess locking is a solved problem - use
the primitive.

**P1 - duplicate start re-runs first-step handler outside its lease**
(lane-runner.ts:190): startLane calls serveStep for an existing checkpoint even
when its first-step lease is LIVE and servedSteps is empty -> a retry during
first-step EXECUTE re-runs the handler via the unlocked-serving path. FIX: when an
existing start has a live lease, return in-flight/current-state WITHOUT invoking
handlers; reclaim a stale first-step lease via CLAIM/EXECUTE/FINALIZE.

**P1 - heartbeat can't stay continuous during SYNCHRONOUS validator work**
(run-validator.ts:164): collect()/rule-exec are synchronous -> a long pass blocks
the event loop -> heartbeat timer + abort can't fire -> another process could
reclaim. FIX: make collection/rule-exec cooperatively async (await a microtask +
abort-check between files/rules). (A worker/subprocess is the heavier alternative;
cooperative yields are the lighter fix and adequate - validator passes are fast.)

**P2 - outbox ack ignores pendingPublishers** (lane-checkpoint-store.ts:181):
removes the whole record after the sink entry even if other publishers pend. FIX:
ack publishers individually; delete only when pendingPublishers empty. (Safe now -
sink is sole publisher - but correct it for P4f's FlowHistory publisher.)

**Value note (honest, not relitigating):** cross-process durability for a
single-user tool is low practical value (the gut-check at P3 [[session_2026-06-13_
lane-p3-pivot-gutcheck.md]]); Jonah chose fold-and-drive. The lock recurrence
validates that concern. Pragmatic resolution: adopt the library (real fix, ends
the saga) + cheap cooperative yields, NOT a full worker architecture. Flagged to
Jonah in the status; continuing.

**Action:** route all 4 to impl-p4b1 (idle). After fixes: re-verify (33+ suites,
3-party lock test, checks, hooks), merge, P4b-2.

Collaborator: Jonah.
