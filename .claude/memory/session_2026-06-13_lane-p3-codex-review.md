---
name: Lane P3 plan - Codex review NEEDS-FIXES (no P0, 6 P1, 3 P2) - drives v2
description: Codex P3 plan review found the O_EXCL lock racy, unlocked serveStep/retry writes, partial lease identity, weak concurrency tests, missing start mapping, missing outbox field; split is coherent once all writes locked + outbox seeded
type: project
relates_to: [session_2026-06-13_lane-p3-plan-drafted.md, feedback_autonomous_phases_codex_partner.md]
---

Codex P3 plan review (task-mqcx5yfz; session 019ec312-d727-7042-a58e-018e7acbedd3).
NEEDS-FIXES. No P0. Confirmed the plan correctly describes live schema-v1 store,
private dir(), the P2 guards, and honestly claims at-most-one-committed (not
exactly-once). Codex ACCEPTS the P3/P4 split IF all checkpoint writes are locked
AND schema-v2 includes the outbox field.

**P1 (fold into v2):**
1. O_EXCL lock races: (a) empty-lockfile window between openSync('wx') and write
   -> a reader parse-fails -> treats live lock as stale -> unlinks it; (b) finally
   unconditionally unlinks even a REPLACEMENT owner's lock. FIX: unique owner
   token; never treat newly-created/unparseable as immediately stale; release only
   if I still own it; validate checkpointId before lock path.
2. Unlocked writes: retry mutates revision/report/audit while a live lease exists
   (not wrapped); serveStep writes revision-neutral snapshots AFTER finalize -> a
   concurrent stop/interrupt/empty-flow completion can commit then be clobbered by
   a stale serveStep snapshot. FIX: reject ordinary transitions while a live lease
   exists; EVERY checkpoint write under lock; serveStep persists via locked
   re-read+merge, not a stale snapshot.
3. FINALIZE identity: spec (709) requires {operationId,stepId,iteration,
   claimedCheckpointRevision,fencingToken}; plan checks only operationId. Also
   advanceLane makes opId inline then re-reads lease OUTSIDE the lock (priority
   transition can clear it between). FIX: capture full claimed identity from
   claimLease's return; compare every field in finalizeLease.
4. Concurrency tests don't prove it: first invocation writes before yielding ->
   second rejects on revision = the OLD best-effort guard, not simultaneous CLAIM.
   interrupt test installs an invalid lease manually; no timeout-retry/late-FINALIZE
   test. FIX: barrier seam (inject afterClaimRead hook) or child processes to force
   interleaving; test stale-reclaim-then-rejected-late-FINALIZE; build interrupt
   leases via claimLease; test retry-vs-live-lease + stale serveStep writes.
5. startLane durability omitted: spec (286) wants locked startRequestId->checkpoint
   mapping + first-step lease; concurrent starts can map one id to multiple
   checkpoints. FIX: include locked start claiming in P3 (under a project/checkpoint
   lock), OR explicitly defer with a named task + narrow the guarantee. -> v2
   INCLUDES locked start mapping.
6. Schema v2 missing sideEffectOutbox[] (spec 770) -> P4 would re-migrate. FIX:
   seed sideEffectOutbox: [] in P3 migration now (forward-compat; P3 doesn't use it).

**P2:** (1) sequence leaves build/tests red - existing lane-checkpoint-store.test.ts
writes v1+expects v2-reject; LaneRunnerDeps fixtures lack newOperationId; enumerate
ALL fixture/test updates in the contract-changing task. (2) leaseIsLive fails open
on NaN timestamp -> validate timestamps + staleMs. (3) hand-waved steps (skip wrap,
priority impl, crash recovery, engine round-trip, hook regression, CLI verify) need
concrete tests + exact commands; createHash already imported in orchestrator (the
instructed import would duplicate).

**v2 approach:** fold all 6 P1 + 3 P2. The lock rewrite (owner token + safe stale +
owned-release), all-writes-under-lock incl serveStep locked-merge, full lease
identity, locked start mapping, outbox-field seed, NaN guard, enumerated fixture
updates, and barrier-seam concurrency tests are the substantive changes. Then
re-Codex. Per autonomous mandate, aim to converge then execute.

Collaborator: Jonah.
