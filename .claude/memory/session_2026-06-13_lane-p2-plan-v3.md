---
name: Lane P2 plan v3 - all v2-review findings folded; confirming Codex pass then EXECUTE
description: v3 folds Codex's 8 v2-review findings (prereq-aware dispatch, best-effort CAS, incremental persist, CLASSIFY dispatch path, deterministic id, CLI/id hardening, realpath, test phrase); one confirming Codex pass then execute per autonomous mandate
type: project
relates_to: [session_2026-06-13_lane-p2-codex-review-v2.md, feedback_autonomous_phases_codex_partner.md]
---

Revised the P2 plan to v3 (same file, git has v2 at 01ec4e5), folding all 8 of
Codex's v2-review findings + closing the 2 still-opens. Targeted edits, not a
rewrite.

**v3 changes (each maps to a Codex v2 finding):**
- runFlow (Task 9) now USES FlowPrerequisiteValidator: builds history from
  context.completedFlowIds + the lane's waived edges for the flow, serves
  degraded coaching-only guidance when a required prereq is unmet (matches
  process():917-948). Closes P0-a/P0-6. serveStep passes
  {completedFlowIds, waivers} into runFlow.
- bump() (Task 5) re-reads on-disk revision before write, throws on mismatch =
  best-effort in-process guard; plan no longer claims hard CAS (true CAS = P3).
  Closes P0-b.
- serveStep (Task 4) persists after EACH flow + resumes from acc.flowIds.length;
  handlers are pure guidance so re-run is benign. Closes P0-c.
- CLASSIFY (Task 10) surfaces {laneId,label,interviewLabel} + message; model
  confirms by calling engine.startLane(laneId) = same terminal path as ROUTE.
  Added classify? field to SidecoachResult. Closes P1-d.
- process() ROUTE uses laneStartRequestId = hash(utterance+project) so retries
  don't double-start. Closes P1-e.
- CLI --report (Task 11): 64KB cap + StepReport shape validation. Closes P1-f.
- startLane (Task 4) validates+caps startRequestId (<=256). Closes P1-g.
- LaneCheckpointStore ctor (Task 3): mkdir then realpathSync (genuine
  canonicalization, no path.resolve fallback). Closes P1-9.
- OUT_OF_SCOPE wiring test phrase changed off "optimize" (a known verb) to a
  non-command backend phrase. Closes P2-h.

**Documented intentional P2 limitations:** best-effort (not hard) CAS -> P3;
lane sequences that violate the prereq DAG (P1 derivation artifact) handled by
degraded guidance, generator validation -> P4.

**STATE:** v3 written, NOT committed yet (about to). NEXT per autonomous mandate
[[feedback_autonomous_phases_codex_partner.md]]: commit v3 -> ONE confirming
Codex pass -> if READY or only-minor, EXECUTE P2 via TeamCreate +
subagent-driven-development -> Codex code review -> merge -> P3.

Collaborator: Jonah.
