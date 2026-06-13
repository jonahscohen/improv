---
name: Lane P2 execution plan DRAFTED (pre-Codex-review)
description: Phase 2 plan written (lane execution state machine + /sidecoach phrase wiring); scoped as ONE coherent slice, durability->P3, validators/convergence/MCP->P4; about to send to Codex for review
type: project
relates_to: [session_2026-06-13_lane-p1-COMPLETE.md, feedback_multiagent_verified_implementation_mandate.md]
---

Jonah asked "what is in phase 2", then "draft the plan and then send it to Codex"
(re-engaging Codex after waiving it for P1). Drafted the P2 plan following the
writing-plans skill, grounded in the FROZEN v10 spec (section 7 lane execution,
section 10 phrase resolution) + the live code.

**Artifact:** docs/superpowers/plans/2026-06-13-lane-p2-execution.md (13 tasks +
Setup + final integration check + self-review).

**Scope decision (the load-bearing call):** the spec's section 7 is several
independent subsystems; per writing-plans "one shippable subsystem per plan" I
scoped P2 to "lanes execute + /sidecoach <phrase> reaches them" and DEFERRED:
- P3 = durability hardening (cross-process leases/operationId, fencing tokens,
  side-effect outbox, checkpoint schema migration, realpath canonicalization,
  AbortSignal). P2 does only CHEAP in-process idempotency (startRequestId dedup,
  expectedRevision compare-and-swap, reportId/seenReportIds) so the API
  SIGNATURES match the spec and P3 adds machinery without changing them.
- P4 = validators + convergence floor + MCP migration + cleanup
  (product-rule-registry, flow-validation-capabilities, validator gating,
  lane_converge truthful convergence, ralph-loop->convergence-loop,
  classify-intent/list-lanes/sidecoach_lane MCP tools, modes.ts/dist deletion,
  SKILL/CHEATSHEET/marketing regen). In P2 completion is purely model-attested
  (valid StepReport advances; no validator can block); loop lanes iterate until
  explicit `stop`.

**Grounding facts confirmed from live code (so the plan is no-placeholder):**
- FlowExecutionEngine (sidecoach-orchestrator.ts:77) is one-shot today:
  process(utterance,context) at :647 runs a composite chain, checkpoints via
  CheckpointStore (:671 lazy boot, :318 write, :1108 resume). Lane API is net-new.
- CheckpointStore (checkpoint-store.ts) = schemaVersion 1, SidecoachCheckpoint
  {cursor, completedStepIds, flowResults...}, atomic tmp+rename, project-scoped.
  NO revision/lease/idempotency yet. -> P2 adds a SEPARATE LaneCheckpointStore
  (new file, .claude/lane-checkpoints/) so the pinned flow checkpoint is untouched.
- flow-handler.ts: FlowExecutionResult {flowId,status,message,guidance?,
  checklist?(completed:false)...}; FlowHandler.execute(context). A lane step
  serves these.
- lanes.generated.ts (P1): GeneratedLane {lane,label,executionKind:
  sequence|loop, verbChain, flowSequence, verbGuidance, prereqWaivers}. Spec
  models execution as VERB steps -> Task 2 adds a derived verbSteps
  {verb,flowIds,guidance}[] to the generator (--check guarded).
- slash-command-router.ts: resolveSidecoachPhrase EXISTS (P1) returning
  ROUTE|CLASSIFY|OUT_OF_SCOPE|UNKNOWN but has ZERO callers -> Task 10 wires
  resolveSidecoachInput() (parseSlashCommand for known verbs first, phrase
  resolver on fallthrough). parseSlashCommand stays byte-stable.
- bin/sidecoach-monitor.js: thin, argv[2]->engine.process() at :53 -> Task 11
  adds `lane start|advance|status|list` subcommands (P2 surface; MCP is P4).

**Process notes:**
- Agent() call BLOCKED inside cmux (must use TeamCreate+named teammate); did the
  grounding reads myself instead of spawning an Explore teammate.
- NOT yet committed (plan is a draft on main working tree). NOT yet executed.
- NEXT: re-probe Codex; if ready, send the plan for review; if still EPERM-wedged,
  report and offer my own verifier-agent leg as fallback (Jonah's call).

**Self-flagged soft spots for the reviewer:** (1) runFlow dispatching the
registered handler with synthetic utterance:'' for guidance; (2) monitor
dist/-vs-src build dependency in Task 11; (3) the P2 prereqWaivers-as-waiver-list
approximation in Task 7 vs the spec's richer prerequisite model.

Collaborator: Jonah.
