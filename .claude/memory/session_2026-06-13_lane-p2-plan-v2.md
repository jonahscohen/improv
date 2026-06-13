---
name: Lane P2 plan v2 - all Codex findings folded, about to re-send to Codex
description: revised the P2 plan to v2 addressing all 7 P0 + 8 P1 + 2 P2 Codex findings; sequence-only scope, lifecycle/outcome, live process() wiring, real prereq validator, persisted serve; re-sending to Codex
type: project
relates_to: [session_2026-06-13_lane-p2-codex-review.md, session_2026-06-13_lane-p2-plan-drafted.md]
supersedes: session_2026-06-13_lane-p2-plan-drafted.md
---

Jonah chose "revise to v2, then re-send to Codex." Rewrote the P2 plan
(docs/superpowers/plans/2026-06-13-lane-p2-execution.md, overwrote v1 - git has
v1 at c08fce1) folding EVERY valid Codex finding. Grounded the fixes by reading
the files Codex cited that I'd skipped: flow-prerequisites.ts, run-tests.ts,
sidecoach-monitor.js, the process() body (orchestrator:647-728), the
enrich->canExecute->execute pattern (:230-260), createExecutionEngine (:1646).

**Material grounding corrections (mine to own):**
- The monitor + factory use createExecutionEngine() (orchestrator:1646), NOT
  `new FlowExecutionEngine()` - the factory is what registers handlers. v1's
  Task 9/11/12 would have produced a handler-less engine. Fixed everywhere.
- run-tests.ts is an explicit SUITES array {rel,cwd?,required?} (not a glob) -
  every new suite registered with required:true in its task.
- process() checks parseSlashCommand at :694 and bare `/sidecoach`/empty ->
  showInteractiveMenu at :664. So phrase wiring goes right after the
  isCommand block, gated ^/sidecoach\s+(.+)$, and bare-/sidecoach menu is
  preserved for free.
- FlowPrerequisiteValidator.getDependencies(flowId) is the REAL dep graph
  (flowF requires flowA required:true, etc.) - so skipping lane_build/shape
  correctly REJECTS now (v1 wrongly allowed it).

**13 tasks in v2 (loop task deleted):** lifecycle/outcome types; verbSteps
(empty-flow allowed); LaneCheckpoint (validated id + realpath + servedSteps
cache + audit); startLane (sequence-only, loop rejected, idempotent w/
lane-mismatch reject, persisted serve); advanceLane complete (lifecycle/outcome,
CAS, dedup, audit); retry/interrupt/resume/stop (audited, NO handler re-run via
served cache); skip (real prereq validator + waived edges + failing unsafe-skip
test); laneStatus + listLanes(options?{all}); engine methods via factory w/
enrich+canExecute dispatch; wire into process() (ROUTE->startLane, tested THROUGH
process()); monitor CLI (--lane/--start-request-id, factory); e2e (routed
sequence -> outcome:completed); final integration (SUITES required, no git add
-A, deferral+worktree scope checks).

**Scope nailed down:** P2 = SEQUENCE ONLY. lane_converge (the only loop) is
rejected at startLane; ALL loop execution + the convergence floor -> P4.
Durability (leases/outbox/fencing/migration) -> P3. P2 keeps only cheap
in-process idempotency + persisted serve.

**3 residual reviewer flags left in the v2 self-review (honest, not hidden):**
(1) Task 9 depends on private enrichContextForHandler name at :241 - confirm
before editing; (2) CLASSIFY response is a plain confirm prompt (no
AskUserQuestion in engine; interview UI is P4 hook/MCP); (3) the additive `lane`
field on SidecoachResult - confirm no consumer asserts exact key sets.

**STATE:** v2 written, NOT yet committed. NEXT: commit v2, re-send to Codex
(same task-style review prompt), report verdict. Self-analysis carried from the
review beat: the P0-3 caller-less repeat is fixed by wiring into process() in the
SAME task and testing THROUGH the real entrypoint - the rule is "a new function
gets traced to its live caller in the task that creates it."

Collaborator: Jonah.
