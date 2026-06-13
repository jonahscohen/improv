---
name: Lane P2 plan v2 - Codex re-review (14/17 closed, 8 new, NEEDS-FIXES)
description: Codex v2 review closed 14 of 17 prior findings; 2 still-open (handler dispatch P0-6, realpath fallback P1-9) + 8 new (3 P0/4 P1/1 P2); drives the v3 revision
type: project
relates_to: [session_2026-06-13_lane-p2-plan-v2.md, session_2026-06-13_lane-p2-codex-review.md]
---

Codex re-reviewed P2 v2 (task-mqctksof; session 019ec2b6-e26e-73b2-aced-f4396c6bb8fd).
14/17 prior findings CLOSED. Verdict NEEDS-FIXES. Drives v3.

**Still-open from v1 review:**
- P0-6: Task 9 runFlow still synthesizes utterance:'' and persisted serve does
  not prevent all retry/concurrency re-exec.
- P1-9: realpathSync failure falls back to path.resolve (not true realpath).

**New (verified accurate - Codex grounding has been reliable all along):**
- P0-a: runFlow imports FlowPrerequisiteValidator but never uses it; only checks
  handler.canExecute, NOT the prereq graph that process() uses
  (orchestrator:917-948). CONFIRMED REAL + load-bearing: lane_ship flowSequence
  = [flowK, flowI, flowL, flowV, flowM, flowJ] but flowK requires flowJ (LAST)
  and flowI requires flowG (ABSENT; only waiver is flowJ<-flowG). So the lane
  sequence violates the prereq DAG -> execution MUST serve degraded guidance for
  unmet prereqs. (Lane sequence ordering itself is a P1-derivation artifact;
  P2 fix = degraded guidance; generator-level prereq validation = P4 note.)
- P0-b: expectedRevision is read-check-then-blind-write, not atomic CAS; two
  concurrent advances both commit; concurrent starts both pass
  findByStartRequestId. (This is the P3-deferred concurrency safety; v2
  OVERCLAIMED "CAS"/"idempotency guarantees" -> v3 must relabel best-effort +
  add re-read-before-write guard; true CAS via lease = P3.)
- P0-c: serveStep runs all handlers before persisting -> partial-failure /
  interruption re-runs. (P2 handlers are PURE GUIDANCE -> re-exec benign;
  exactly-once outbox = P3. v3: persist incrementally + state the rationale.)
- P1-d: CLASSIFY is a dead end - returns a confirm message but NO
  selection/confirm-to-start dispatch. Spec (263-266, 812-813) wants a
  one-question interview whose selected lane dispatches identically to ROUTE.
  v3: add a real confirm->startLane path.
- P1-e: process() mints a fresh PID/time startRequestId each call -> retries
  double-start. v3: derive deterministically from hash(utterance+projectPath).
- P1-f: CLI --report JSON.parse lacks size cap / shape validation / file-input
  (spec 790-794). v3: add cheap validation.
- P1-g: startRequestId not validated/capped/hashed (spec 787-788, 1464-1466).
- P2-h: OUT_OF_SCOPE test phrase "/sidecoach optimize..." is a known verb
  (verb-command-registry:529-535) so it routes before phrase classification.
  v3: use a non-command backend phrase.

**Residual flags adjudicated:** enrichContextForHandler exists at :507-510
(callable); plain CLASSIFY confirm NOT acceptable (no dispatch path); additive
`lane?` field safe (CommandRoutingAdapter spreads unknown fields :113-116).

**v3 plan:** fold all of the above. Per Jonah's autonomous mandate
[[feedback_autonomous_phases_codex_partner.md]], after v3 do ONE confirming
Codex pass then EXECUTE - don't loop forever on plan prose.

Collaborator: Jonah.
