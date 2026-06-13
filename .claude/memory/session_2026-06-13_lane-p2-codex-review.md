---
name: Lane P2 plan - Codex review verdict NEEDS-FIXES (strong, grounded)
description: Codex secondary review of the P2 plan returned NEEDS-FIXES with 7 P0 + 8 P1 + 2 P2 findings; load-bearing ones verified true; key consequence = P2 should be sequence-only (lane_converge is the only loop, gate is P4)
type: project
relates_to: [session_2026-06-13_lane-p2-plan-drafted.md, feedback_multiagent_verified_implementation_mandate.md]
supersedes: 
---

Jonah said "draft the plan and then send it to Codex." Codex came back UP this
time (runtime cleared) and reviewed the P2 plan at high effort with the live
code. Verdict: **NEEDS-FIXES**.

Job: task-mqcsq8ko-3ibuit. Codex session: 019ec2a1-2088-79f3-bf29-433718c0e3a7
(resume: `codex resume 019ec2a1-2088-79f3-bf29-433718c0e3a7`).
Full review saved transiently to the task output; key findings transcribed here.

**This was a HIGH-VALUE review - it caught real misses, several mine to own:**

**P0 (must fix before executing):**
1. API shape contradicts spec sec 7 (lines 636-649, 737-768): I collapsed
   lifecycle+outcome into one `status` and closed sequence lanes as `converged`.
   Spec = two axes: lifecycle {in_progress|interrupted|closed} + outcome
   {completed|partial|stopped|converged}. Sequence closes completed|partial;
   only validated loops converge. VERIFIED against spec - correct.
2. Task 2 test rejects empty-flow verb steps, but first-owner derivation
   legitimately yields guidance-only empty-flow steps (lane_build/polish,
   lane_calm/distill). My own test would fail. Fix: permit empty-flow steps.
3. Task 10 caller-less: resolveSidecoachInput added but NOTHING calls it
   (process() at orchestrator:693-695 doesn't); the e2e calls resolver+engine
   separately. So `/sidecoach <phrase>` stays caller-less - I repeated the EXACT
   trap P1's resolveSidecoachPhrase fell into, one level up. The core item-2
   goal defeated. Fix: wire into process()/monitor dispatch, ROUTE->startLane.
4. Task 7 prereq algorithm inverted; I missed src/flow-prerequisites.ts entirely
   (FlowPrerequisiteValidator.getDependencies). prereqWaivers = exceptions, not
   the dep graph. My "red" test is already green (lane_build has empty waivers,
   so skip-shape wrongly succeeds; should be REJECTED since flowF needs flowA).
5. Interrupt semantics: spec (640-646) says resume is the ONLY action valid vs
   an interrupted checkpoint; interrupt must not rerun handlers. My advanceLane
   allowed complete/retry/skip/stop while interrupted + called serveStep on
   interrupt. VERIFIED - correct.
6. Real-handler dispatch unsound: handler.execute({utterance:''}) bypasses
   canExecute/enrichment/exception handling; reruns handlers on every
   retry/resume/dup/loop-reset (served output not persisted). Fix: guidance
   adapter OR persist served step output.
7. Validator/convergence deferral exposes forbidden behavior: P2 publicly starts
   lane_converge without its gate + falsely marks converged. Fix: reject/disable
   lane_converge until P4; close sequence as completed; keep final API shape now.

**P1:** 8 transition audit incomplete (retry report ignored, skip invents
report, stop/interrupt/resume not audited); 9 checkpoint-id path-join unsafe +
no project canonicalization (CHEAP safety belongs in P2, not deferred); 10
listLanes missing options?{all?} (default in-progress/interrupted); 11
start-request dedup serves with wrong lane object on lane mismatch; 12 CLI flags
wrong (spec wants --lane/--start-request-id, no buildEngine() exists); 13
run-tests.ts SUITES is explicitly enumerated - must add each suite required:true;
14 phrase regex over-broad (resolves non-/sidecoach input + breaks bare
/sidecoach menu) - gate on ^/sidecoach\s+(.+)$; 15 final `git add -A` would
sweep the dirty unrelated worktree - stage only owned files + cleanliness check.

**P2:** 16 lane_calm is NOT a loop - only lane_converge is (VERIFIED via
lanes.generated.ts). 17 e2e should require outcome:completed for routed sequence.

**Soft spots verdict:** (a) synthetic utterance - NOT acceptable; (b) dist
dependency - confirmed; (c) prereqWaivers-as-deps - invalid; (d) Task 5 stub -
ok only if immediately replaced.

**KEY SCOPE CONSEQUENCE (16 + 7 together):** lane_converge is the ONLY loop and
it needs the P4 gate -> **P2 should be SEQUENCE-ONLY**. Drop Task 6 (loop
boundary) entirely; defer all loop execution to P4 with the convergence floor.
Cleaner + more honest scope.

**STATE:** plan draft committed (c08fce1) on main working tree. NOT executed.
NEXT (pending Jonah's call): revise to a v2 plan folding all valid fixes + the
sequence-only scope + the lifecycle/outcome API, then optionally re-send to
Codex; OR Jonah runs his own review agent first. Self-analysis: the caller-less
repeat (P0-3) is the one that stings - the whole POINT of P1->P2 was to stop
building caller-less resolvers, and I did it again. The fix is to always trace
a new function to its live entrypoint in the SAME task that creates it.

Collaborator: Jonah.
