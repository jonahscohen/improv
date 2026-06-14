---
name: P4b-1 v2 (Codex-authored) reviewed+APPROVED; executing
description: Codex authored P4b-1 v2 closing the P0 lock-ABA (rename-based atomic takeover) + 6 P1 + 3 P2; I reviewed (read the lock fix - genuinely race-safe) and approved; committing + executing the durability+gating build
type: project
relates_to: [session_2026-06-13_p4b1-codex-review-handoff.md, feedback_codex_takeover_on_round_fail.md]
supersedes: session_2026-06-13_lane-p4b1-plan.md
---

Role inversion: Codex authored P4b-1 v2 (task-mqd6zoh7; --write; session 019ec40e),
I reviewed. 1482 lines, 0 dashes/NUL/non-ascii, v2, 11 tasks.

**P0 lock fix VERIFIED race-safe (I read it):** stale takeover is atomic
fs.renameSync(lockPath, claimPath) - only ONE reclaimer wins the rename; the loser
gets ENOENT and CANNOT delete the winner's new lock (closing the ABA). Winner
verifies claimed.owner === info.owner (guards path-replaced-between-observe-and-
rename), unlinks ONLY the renamed claim, never blind-unlinks the shared lockPath;
identity-changed branch restores via no-replace linkSync + quarantine. Adversarial
barrier test (__beforeStaleTakeover forces both past the stale-check before rename)
asserts exactly one enters. Correct.

**Other fixes present (spot-checked):** first-step lease + unlocked serving (Task
3/7); continuous ownership-checking heartbeat loop (Task 8); full-identity
LIVE_OPERATIONS + replacement-abort test (Task 8/9); stale retry/resume fencing
(Task 9); post-FINALIZE publish-failure + replay + startup replay path (Task 7);
persisted gate status via LaneState.steps + 3 non-clean mapping tests (Task 1/6);
abort test co-located with impl (Task 9); executable serve-clobber/crash/
timeout-retry tests; LaneSideEffectSink documented authoritative this phase +
FlowHistory publisher scheduled for P4f.

**VERDICT: APPROVED** (I am the reviewer; my approval gates the plan). Committed;
executing P4b-1 via fresh team. Codex code-reviews the executed branch.

**Phase map:** P4f added (FlowHistory outbox publisher). Sequence now: P4b-1
(this), P4b-2 (browser collector), P4c (loops/convergence/lane_converge), P4d
(MCP), P4e (copy gating), P4f (FlowHistory publisher). Role inversion is the
reliable pattern for these spec-bound durability plans.

Collaborator: Jonah.
