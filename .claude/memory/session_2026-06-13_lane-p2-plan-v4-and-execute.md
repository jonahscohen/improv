---
name: Lane P2 plan v4 (Codex v3 fixes) - moving to EXECUTION
description: v4 fixes the v3-review critical bugs (false attestation, intra-step prereqs, handler try/catch, closed-checkpoint restart, NUL byte, honest CAS); per autonomous mandate, now executing P2 via subagent-driven-development with Codex as code reviewer
type: project
relates_to: [session_2026-06-13_lane-p2-plan-v3.md, feedback_autonomous_phases_codex_partner.md]
supersedes: session_2026-06-13_lane-p2-plan-v3.md
---

Codex v3 review (task-mqcu3h5z) was NEEDS-FIXES: closed P0-c/P1-9/P2-h, but P0-a/
P0-6/P0-b/P1-d/P1-f/P1-g still-open + new P0 (false attestation) + NUL byte. My
v3 fixes were partially incomplete. v4 folds the GENUINELY-CRITICAL ones (the
rest are implementer/code-review detail per the autonomous mandate's
"don't loop forever on plan prose").

**v4 changes (file unchanged name; git has v3 at 4f59079):**
- FALSE ATTESTATION (new P0, the big one): served cache now tracks
  successfulFlowIds (status==='success' only); advanceLane complete promotes ONLY
  those into completedFlowIds, never all step.flowIds. Degraded/skipped/errored
  flows are not attested -> can't falsely satisfy a later prereq. This is what
  makes lane_ship's DAG-violating order correct.
- INTRA-STEP PREREQS (P0-a pt1): serveStep feeds each flow completedFlowIds +
  successful-so-far-this-step.
- HANDLER try/catch (P0-6): execute() wrapped; throw -> 'error' result (not
  attested). Corrected the false "synthetic dispatch gone" claim to "guarded".
- CLOSED-CHECKPOINT RESTART (new P1): startLane dedups only on ACTIVE
  (in_progress/interrupted) checkpoints; closed -> fresh lane (kills the
  deterministic-id aliasing).
- NUL BYTE removed (was line 315, corrupted 'a\x00' bad-id literal -> 'a*').
- HONEST CAS wording (P0-b): transition type comment + changelog scrubbed to
  best-effort; true CAS=P3.
- Fuller --report validation + --report-file (P1-f). startRequestId
  validated/capped, "stored by hash" overclaim removed (P1-g).
- CLASSIFY round-trip test added (P1-d): murky phrase -> classify.laneId ->
  startLane(laneId) starts lane; no-classify branch hard-fails (implementer must
  use a verified-CLASSIFY phrase).

**Deferred (intentional):** true cross-process CAS/exactly-once/id-hashing = P3;
generator lane-sequence prereq validation = P4.

**DECISION: stop plan-review iteration, EXECUTE.** Per
[[feedback_autonomous_phases_codex_partner.md]] the goal is completing phases,
and Codex's highest value is on REAL CODE. 4 plan rounds is enough; the
remaining nits are implementation detail. Next: commit v4 -> TeamCreate +
subagent-driven-development to execute P2's 13 tasks (impl + per-task review) ->
Codex CODE review of the branch -> fix -> merge -> P3.

Self-analysis (P0-3/P0-a repeats): I twice shipped plan code that LOOKED fixed
but wasn't wired through (caller-less resolver; imported-but-unused validator;
attest-all-flows). Lesson reinforced: when I add a guard/validator, trace it to
the exact line that CONSUMES it and the exact line that would MISUSE it, in the
same edit - don't trust the import/declaration as proof of use.

Collaborator: Jonah.
