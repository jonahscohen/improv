---
name: P4 reality check - what is actually real vs plumbing-without-consumer/activation
description: Skeptical end-to-end audit of the lane phases per Jonah's directive; mechanisms are real+tested but P4f flow-history write has no lane-specific consumer (prereqs run off the checkpoint) and P4b-2 browser collector only fires when the lane target is a literal URL (dormant for free-text targets); + validator-signal-quality and lived-use caveats
type: project
relates_to: [feedback_post_phase_reality_check.md, session_2026-06-14_p4f-COMPLETE.md, session_2026-06-14_p4b2-code-review.md]
---

Per Jonah's "is it real or fluff" directive, audited the lane phases by tracing
consumers/activation concretely (grep), not assumption.

**P4f (flow-history outbox publisher) - CORRECT but no lane-specific consumer.**
- The lane cross-flow PREREQUISITE observation (flowK sees flowJ succeeded) runs
  through the CHECKPOINT: lane-runner.ts:173/329 flowCtx.completedFlowIds =
  [...cp.completedFlowIds, ...acc.successfulFlowIds] (P4c, checkpoint store). NOT
  through the flow-history file P4f writes.
- The ONLY 'lane:' occurrence in source is lane-runner.ts:138 - where P4f WRITES
  `lane:${laneId}:${stepId}`. NO consumer reads/branches on lane-prefixed entries.
- The global flow-history consumers (orchestrator, session-memory-writer,
  flow-conditional-router, deterministic-validator, phase-ii-verification) iterate
  getFlowSequence()/getLatestRun() generically, so lane entries DO appear in the
  session flow record they summarize/route on - but generically, with zero
  lane-aware logic.
- VERDICT: P4f is spec-correct (durable, idempotent, fencing-safe lane records in
  flow history, published from the committed outbox - exactly the spec's
  durability requirement) and robust (4 review rounds). But its lane records are a
  DURABILITY/OBSERVABILITY record feeding generic consumers, NOT the mechanism
  behind lane prerequisites (that is the checkpoint) and have no lane-specific
  reader today. Real + correct, but not load-bearing for any lane behavior yet.

**P4b-2 (browser collector) - REAL but dormant for normal targets.**
- lane-runner.ts:516/821 derive renderUrl = renderUrlFromContext({ target:
  cp.target }). renderUrlFromContext returns a URL ONLY if cp.target is a valid
  http/https/file/data URL.
- Normal lane targets are free-text ("the landing page", "make X production-ready"),
  NOT URLs -> renderUrl undefined -> collector degrades to inconclusive -> the 4
  browser rules NEVER activate.
- VERDICT: the collector + 4 rules are real, tested, and (after the in-flight
  fixes) correct - but they only FIRE when the lane target is literally a URL. In
  normal usage they stay inconclusive (dormant). To make P4b-2 actually fire,
  callers need an explicit renderUrl path (e.g. sidecoach_lane MCP input carrying
  a renderUrl distinct from the free-text target, threaded into validation). That
  wiring does NOT exist yet -> CONCRETE FOLLOW-UP.

**Broader caveats (apply to the whole stack):**
- Validators (P4a) are heuristic (ast-grep/regex over CSS/markup); tests use
  crafted fixtures and prove the MECHANISM, NOT the false-positive/negative rate on
  real codebases. Real-world signal quality is unmeasured.
- Lanes (P2/P4d) are tested end-to-end in TEMP projects with the real engine, and
  the MCP tools register + pass stdio/in-memory tests - but a real model driving a
  real lane against a real project in a LIVE session has not been observed. Plumbing
  tested; lived use unproven.

**Proposed actions:** (1) P4b-2: add an explicit renderUrl input path
(sidecoach_lane MCP arg + thread through lane-runner) so the collector actually
fires - otherwise mark the browser rules as "fire only with a URL target" so they
are not overclaimed. (2) P4f: keep it (spec-required durability) but describe it as
a durable lane-completion RECORD, not an active prereq signal; a lane-aware consumer
(or removing it if never needed) is a follow-up. (3) Consider one real lived
end-to-end lane run via the MCP against a served project to prove the whole chain.

Collaborator: Jonah.
