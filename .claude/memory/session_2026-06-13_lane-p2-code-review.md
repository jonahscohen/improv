---
name: Lane P2 code review (Codex + my verify) - NEEDS-FIXES, 6 defects routed to impl-p2
description: independent verification green (16 suites); Codex code review confirmed all critical invariants hold but found 6 fresh defects (3 P1/3 P2); routing fixes to impl-p2 before merge
type: project
relates_to: [session_2026-06-13_lane-p2-execution-progress.md, feedback_autonomous_phases_codex_partner.md]
---

P2 code built by impl-p2 (12 commits on lane-p2-execution, 13 tasks). My
INDEPENDENT verification (separate from impl-p2): build exit 0, npm test 16
suites pass, generate-lanes --check OK, P1 hooks 110/0 + 35/0, branch diff = only
22 plan-owned files, no deferred-scope leak. Matches impl-p2's report exactly.

**Codex code review (task-mqcvqsz6; session 019ec2ee-6bc3-7b51-8b8d-3601eb8f582c):**
CONFIRMED CORRECT in the code: false-attestation protection (only successfulFlowIds
-> completedFlowIds); intra-step prereqs; prereq-aware dispatch + waivers +
degraded needs_input + caught execute() errors; lane_ship does NOT attest
flowK/I/L/M; two-axis lifecycle/outcome + loop rejection; interrupt no-rerun;
dup rejects on closed; closed-restart; createExecutionEngine + CLI flags + size
cap + scoped required suites + no leak; bump() consistent with sequential
non-revision serve writes; test phrases resolve as claimed (backend->OUT_OF_SCOPE,
"make it pop"->CLASSIFY lane_delight). tsc --noEmit passed. (Codex sandbox
couldn't run 10 mkdtemp suites - my local run covers them: all green.)

**6 DEFECTS -> impl-p2 (verdict NEEDS-FIXES):**
- P1-1 CLI broken on clean checkout: bin/sidecoach-monitor.js loads ../dist/
  sidecoach-orchestrator but branch commits NO dist; clean checkout has no lane
  methods (dirty rebuilt dist masks it). FIX: commit lane-related dist artifacts.
- P1-2 interrupted+dup ordering: dup short-circuit (guarded !closed) still fires
  for INTERRUPTED lanes -> a non-resume action carrying a seen reportId is
  accepted as no-op instead of rejected. FIX: guard dup to lifecycle==='in_progress'
  only (same bug class as the closed fix, missed for interrupted).
- P1-3 partial-serve completion: serveStep persists partial flow output; complete
  doesn't verify all step.flowIds served -> after a mid-step crash a caller can
  complete a partial step, skipping remaining flows. FIX: reject completion unless
  served cache covers the full step (or finish serving first).
- P2-1 findByStartRequestId returns first match; closed+active sharing an id +
  timestamp tie can select the closed one. FIX: prefer in_progress/interrupted.
- P2-2 deriveVerbSteps: unknown verb (entry undefined) -> silent empty step. FIX:
  throw on undefined entry (but KEEP empty flowIds legal for first-owner-claimed
  verbs - don't conflate unknown-verb with legitimate empty-flow step).
- P2-3 CLI StepReport validation: accepts arbitrary evidence.kind, empty ids,
  malformed checklist. FIX: stricter shared validator.

Also noted (minor): deterministic start id hashes raw projectPath (not realpath'd
before hashing) - cheap consistency fix.

**Next:** impl-p2 fixes all 6 (+ the minor) -> re-verify (build + 16 suites +
clean-checkout CLI check) -> Codex re-review or my confirm -> merge to main -> P3.

Collaborator: Jonah.
