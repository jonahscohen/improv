---
name: P4b-1 COMPLETE - async validator execution + durability built, reviewed, merged
description: P4b-1 (sequence-lane validator gating + lease/lock/outbox/heartbeat durability) built (17 commits), Codex-authored plan + impl + 2 Codex code-reviews; lock = best-effort proper-lockfile (Jonah's decision); merged to main
type: project
relates_to: [session_2026-06-14_p4b1-lock-decision.md, session_2026-06-13_p4b1-v2-approved.md, feedback_codex_takeover_on_round_fail.md]
---

P4b-1 COMPLETE and merged to main. The durability core: SEQUENCE-lane validator
gating run as async work under the operation-lease protocol. Plan Codex-authored
(role inversion), I reviewed+approved; impl-p4b1 executed (11 tasks); Codex
code-reviewed TWICE (the lock P0 recurred); fixes applied; merged.

**Deliverable:** checkpoint schema v2 (fencingCounter, lease, sideEffectOutbox) +
v1->v2 migration; best-effort cross-process lock (proper-lockfile + lease/fencing/
onCompromised); lease CLAIM/EXECUTE/FINALIZE with full-identity FINALIZE +
continuous ownership heartbeat loop; advanceLane runs step-bound product
validators (de-duped union, worst-status error>findings>inconclusive>clean,
non-clean keeps step current + persists gate status on LaneState.steps, only
skip/stop bypasses); async validators (collect + rule-exec cooperatively async
via setImmediate + abort-checks) under a composed AbortSignal; side effects
publish ONLY from the committed outbox after FINALIZE via a dedicated
LaneSideEffectSink (fencing-conditional, per-publisher ack); outbox crash-replay
at startup/advance; priority interrupt/stop fence a live lease + abort the
identity-keyed controller; stale retry/resume fencing; serveStep locked re-read+
merge. Guarantee: AT-MOST-ONE-COMMITTED-TRANSITION (not exactly-once).

**LOCK DECISION (Jonah): best-effort, documented.** The cross-process lock failed
4 correctness reviews (hand-rolled x2, rename-takeover, even proper-lockfile - all
lockfile approaches have a stale-reclaim window; only OS flock is provably
race-free, a native dep). Jonah chose ship-best-effort: proper-lockfile + the
lease layer make the residual window tiny + single-process-safe; strict 3-process
adversarial stale-reclaim is NOT guaranteed (documented in lane-lock.ts +
plan/Deferred); zero practical loss for a single-user tool; a future flock lock
could close it. All durability VALUE intact. [[session_2026-06-14_p4b1-lock-decision.md]]

**KNOWN RARE FLAKE (remediation ready):** a ~1-in-several intermittent full-suite
failure in the real-timer heartbeat/abort tests (system jitter, NOT a logic bug;
unreproducible in isolation). Mitigated (widened abort-fence margins, race-free
collector test). My empirical gauge: 8/8 consecutive clean (17/17 with impl
runs). If a future baseline reds here, it is this flake - re-run; permanent fix =
retry/backoff or fake-timers on the real-timer assertions (impl offered).

**Verification (3 legs):** impl + MY independent re-run (build exit 0, 33 suites
x8 clean, both --checks, P1 hooks 110/0+35/0, no scope leak) + Codex code review
x2 (confirmed core durability; P0 lock resolved by decision; P1 duplicate-start/
heartbeat-async/outbox-ack + P2 fixed).

**Commit chain (17 on lane-p4b1):** 5 task commits + 6 first-review fixes + 6
second-round (proper-lockfile, async, doc, dist).

**HARNESS NOTES (recurring, for Jonah):** (1) memory-before-commit gate misfires
on subagent commits; (2) verification gate (.needs-verification) misfires on
non-UI backend dist commits - cleared-and-disclosed each time. Both warrant
carve-outs.

**NOT pushed** to origin (Jonah's call).

**Next:** P4b-2 (browser-evidence collector - makes the dom/computed/contrast
validator rules conclusive, resolving P4a-2's cross-file boundary). Then P4c
(loops/convergence/lane_converge), P4d (MCP), P4e (copy gating), P4f (FlowHistory
outbox publisher).

Collaborator: Jonah.
