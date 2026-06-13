---
name: P3 gut-check - durability is premature/coupled to P4; pivot decision
description: After 3 Codex P3 rounds, the findings show the lease/lock machinery is coupled to P4's async model (lock-held-across-async, first-step-lease) and is near-zero practical value for single-process use; recommending fold-durability-into-P4
type: decision
relates_to: [session_2026-06-13_lane-p3-plan-v2.md, feedback_autonomous_phases_codex_partner.md]
---

Codex P3 v2 (task-mqcxko96; session 019ec31d) NEEDS-FIXES. CLOSED: P1-3 (full
identity), P1-5 (locked start mapping), P1-6 (outbox seed). STILL-OPEN: P1-1 lock
ABA race (stale-reclaim unlink + release read-owner-then-unlink TOCTOU - genuinely
hard without rename/mkdir-atomic or a daemon), P1-2 retry's unlocked normal path +
dup-return-before-live-lease-check, P1-4 missing tests (stale-reclaim-late-FINALIZE,
retry-vs-live-lease, interrupt-via-claimLease), P2-1 fixtures not enumerated in
tasks (5 LaneRunnerDeps fixtures + revision assertions: CLAIM+FINALIZE double-bumps
revision), P2-2 staleMs unvalidated, P2-3 concrete stop/skip tests + the createHash
dup STILL in Task 6. NEW P1: start should use the first-step lease (CLAIM/EXECUTE/
FINALIZE) per spec 286, not lease:null+serveStep; start lock is held ACROSS async
serveStep (can age stale during EXECUTE). NEW P2: serveStep same-key merge can lose
concurrent same-step progress.

**The signal (decision):** the two NEW findings (lock-held-across-async,
first-step-lease) prove P3's durability cannot be fully correct WITHOUT P4's async
execution model. The lease/lock/outbox machinery EXISTS to protect async validator
execution + external side-effect publishing - both P4. Building ABA-safe
cross-process locking now = high-effort, low-value (single-user tool, lanes driven
by one session sequentially - true cross-process contention ~never happens),
protecting work that doesn't exist, and untestable in its real mode.

**Recommendation:** stop grinding standalone P3; FOLD durability into P4, built
alongside the async validators that give the lease/lock its purpose and
testability. The P3 v2 plan doc becomes P4's durability sub-plan input (not wasted).
P1+P2 (the user-facing value: NL lane detection + lanes that run + /sidecoach
phrase) are DONE and merged. Remaining = P4 (validators + rule registry + loops +
convergence + MCP + cleanup + folded durability) - the largest phase, to be split
into sub-plans.

**Action:** offering Jonah a gut check (3 options: keep grinding all phases as
instructed / fold P3 into P4 and continue / bank P1+P2 and pause) despite the
autonomous mandate, because the cost-value calculus shifted materially and this is
a high-impact structural call (the gut-check rule applies). NOT a lazy
"should I continue" - it's signal + a recommendation; will proceed on their steer.

Collaborator: Jonah.
