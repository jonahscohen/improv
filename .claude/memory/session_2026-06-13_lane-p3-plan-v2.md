---
name: Lane P3 durability plan v2 - all Codex findings folded - re-Codex
description: P3 v2 folds the 6 P1 + 3 P2 (race-safe lock, all-writes-under-lock incl serveStep locked-merge, full lease identity, barrier-seam concurrency tests, locked start mapping, outbox seed, NaN guard, fixtures, concrete tests); re-sending to Codex
type: project
relates_to: [session_2026-06-13_lane-p3-codex-review.md, feedback_autonomous_phases_codex_partner.md]
supersedes: session_2026-06-13_lane-p3-plan-drafted.md
---

Revised P3 to v2 (same file, git has v1 at daa36c2), folding all of Codex's
P3-plan findings.

**v2 changes (each maps to a Codex finding):**
- P1-1 lock: unique owner token; unparseable/empty lock not immediately stale
  (mtime-fallback grace for the create->write window); release unlinks only if
  still owned; checkpointId validated; +create-window/reclaimed-owner tests.
- P1-2 all-writes-under-lock: ordinary transitions rejected while a live lease
  exists (only interrupt/stop proceed over one); serveStep persists via LOCKED
  re-read+merge of just its servedSteps[key], never a stale whole-cp snapshot;
  +test that a serveStep write can't revert a committed complete.
- P1-3 full identity: finalizeLease matches the full {operationId,stepId,
  iteration,claimedCheckpointRevision,fencingToken} captured from claimLease's
  return (LeaseIdentity type), not operationId alone, not a post-lock re-read.
- P1-4 real concurrency proof: __claimBarrier seam in LaneRunnerDeps (awaited in
  advanceLane after the early read, before claimLease) forces two callers past
  their read at the same revision then races the claim -> exactly one commits.
  +stale-reclaim-then-rejected-late-FINALIZE; interrupt leases via claimLease.
- P1-5 locked start mapping: startLane's findByStartRequestId+create runs under a
  lock keyed sha256(startRequestId) (distinct key space from checkpointId locks,
  no self-deadlock).
- P1-6 outbox seed: migration seeds sideEffectOutbox: [] (P4-compat, no third
  migration).
- P2-1 fixtures: enumerated - lane-checkpoint-store.test.ts -> v2 literal +
  v3-reject; every LaneRunnerDeps fixture gains newOperationId; every v2 literal
  includes fencingCounter/lease/sideEffectOutbox.
- P2-2 leaseIsLive NaN guard.
- P2-3 concrete tests + no duplicate createHash import in orchestrator.

File verified: 570 lines, 0 NUL, 0 unicode dashes (the content-guard caught a
stray dash on v1's first full write; bisected + clean since).

**Next:** commit v2 -> ONE Codex confirm pass -> if converged, execute via fresh
team (lane-p3-exec) -> Codex code review -> merge -> P4. Per autonomous mandate,
don't loop forever on plan prose; P3 is the lowest-value phase (cross-process
durability for a single-user tool) - converge and move to P4 (the high-value one).

Collaborator: Jonah.
