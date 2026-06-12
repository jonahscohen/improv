---
name: lane intent detection design v4 - execution truthfulness
description: Third review verified and folded into spec v4; transition contract, persisted convergence, three-state scope, prereq waivers; all claims confirmed at cited lines
type: decision
relates_to: [session_2026-06-12_lane-design-v3-action-model.md]
supersedes: session_2026-06-12_lane-design-v3-action-model.md
superseded_by: session_2026-06-12_lane-design-v5-complete.md
---

Spec revised to v4 after the third independent review. Every claim verified
before adoption - all confirmed, none rebutted. No new Jonah fork this round;
all resolutions fit the settled architecture (hybrid classifier +
model-driven state machine), so choices were stated, not interviewed.

**Verified review claims (file:line):**
- Prereqs make v3 lanes unexecutable: flowK requires flowJ, flowJ/flowI/flowM
  require flowG, flowF requires flowA (flow-prerequisites.ts:54-112) - so
  lane_ship/delight/converge fail on clean history.
- False convergence is real and test-enshrined: runner throw -> zero findings
  -> converged (ralph-loop.ts:265-303); t20 asserts "runner-throw: still
  converged because findings still total 0".
- Flow history is GLOBAL (~/.claude/sidecoach-flow-history.json, session key
  default "default") - empty-for-real-projects + cross-project contamination.
- My v3 hand-written verb-to-flow mapping had drifted from
  verb-command-registry.ts (critique = [flowL, flowK], polish = [flowJ,
  flowM]).

**v4 resolutions:**
- Full transition contract: advanceLane(checkpointId, {action:
  complete|retry|skip|interrupt|stop, report?, expectedRevision}). StepReport
  schema (evidence required); complete without valid report REJECTED;
  validators re-run where flows define them (validation_failed keeps the step
  current). Status precedence defined; interrupted = explicit durable
  transition; CAS revision prevents concurrent double-advance.
- Convergence sub-state persisted in checkpoint (iteration, signatures,
  no-progress count, limits, findings, validatorErrors); canonical finding
  adapter incl. memory-stored validations; validator error/skip/unsupported
  = inconclusive, NEVER converged (t20 expectation updated as part of the
  work); statuses reconciled via lane.convergence sub-state.
- Scope is three-state (IN_SCOPE | OUT_OF_SCOPE | SCOPE_UNKNOWN) with
  clause-level binding of lane/UI/negative evidence. Natural SCOPE_UNKNOWN ->
  CONTEXT-CHECK directive (model decides with conversation context);
  /sidecoach phrase SCOPE_UNKNOWN without negatives proceeds. Ambiguous
  tokens (interface/header/layout) need a design qualifier in-clause.
- Prereq policy: checkpoint-local intra-lane ordering; per-lane
  prereqWaivers (with reasons) for refinement lanes + project-state
  preflight; generate-lanes --check FAILS on unwaived unsatisfiable prereqs;
  flow-history becomes project-scoped.
- Lane JSON stores verbChain: string[] only; flows derived from
  verb-command-registry at generation; --check validates cross-registry.
- MCP classifier union completed (ROUTE | CLASSIFY | OUT_OF_SCOPE |
  CONTEXT_CHECK | VERB | NUDGE | SILENT); parser UNKNOWN kept separate.
- sidecoach/package.json added to blast radius: npm test becomes an
  enumerating runner with a manifest self-test (today it runs ONLY
  intent-detector.test.ts - the gate could pass without running any lane
  suite).
- Checkpoint/report hardening: projectPath in checkpoint, --project flag,
  JSON-only reports (project-root-restricted file or inline, 256KB cap).
- v3 internal inconsistencies fixed (runLane wording, monitor/MCP symmetry
  incl. listLanes, exact --check command).

**Why no interview this round:** the review's remaining findings were
contract completions inside the already-chosen architecture, not forks. The
one judgment call - step completion is model-attested-with-evidence,
engine-validated where flows define validators - is the only honest reading
of the chosen action model, stated explicitly in the spec.

**Revisit when:** implementation finds clause-level binding too coarse for
real prompts (sentence splitting is heuristic), or the waiver list starts
growing beyond lane-entry flows (signal the prereq graph itself needs
redesign rather than more waivers).

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (v4 rewrite)
