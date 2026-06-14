---
name: P4c plan review NEEDS-FIXES (6 P1 convergence-semantics) -> Codex authors v2
description: agent-drafted P4c hit 6 P1 + 1 P2 (preflight per-requirement, stall/cap don't bound iteration, signature gap-identities, truthful summary advisory/coverage, validator-throw lease, placeholder); role inversion - Codex authors v2, I review
type: project
relates_to: [session_2026-06-14_p4-resequence-convergence-first.md, feedback_codex_takeover_on_round_fail.md]
---

Codex P4c plan review (task-mqdepuvw; session 019ec4d4) = NEEDS-FIXES (no P0, 6 P1
+ 1 P2). CONFIRMED: no-double-run, final-step-skip-reaches-boundary, stop=stopped,
clean-boundary=converged, schema-v2 optional convergence backward-compat, ralph
rename + zero-findings-plus-error semantic fix, scope. Per the standing
role-inversion rule, Codex authors v2; I review.

**6 P1 + 1 P2 for Codex to close in v2:**
- P1-1 preflight (plan:1317): flattens evidence alternatives + passes when each
  validator has ANY compatible source. Spec 1001-1011 wants each
  requiredCoverageByScope record evaluated independently with
  AND-across-requirements / OR-within-requirement; report exact validator/rule/
  source gaps; mixed-source + Flow-J-supported/static-a11y-unsupported rejection
  tests; remove the deferral at plan:1714.
- P1-2 stall/cap don't bound (plan:1010): EVERY non-converged outcome (incl
  stalled/capped) resets cursor + serves next iteration; ordinary advances still
  allowed. FIX: reset/serve next ONLY when decision.outcome==='running'; define
  retry/resume for stalled/capped; reject ordinary complete/skip until resumed;
  tests proving stall AND cap stop auto-iteration.
- P1-3 signature gap-identities (plan:527): coverageGapIdentities omits stable
  skipped/unreadable/unsupported FILE identities -> different gaps -> identical
  signatures. Persist stable per-validator coverage-gap identities + the run
  coverage needed to reproduce the decision/summary.
- P1-4 truthful summary (plan:1057): omits coverage details + falsely says
  advisory "served each pass" without recording advisory statuses (deferral at
  1716 contradicts spec 1177-1193). FIX: persist advisory flow outcomes + actual
  run coverage; generate inspected/skipped/unsupported/unverified from data; clean
  validators + advisory ERRORS -> persisted outcome converged but DISPLAY
  'machine_checks_clean_with_advisory_warnings'.
- P1-5 validator throw (plan:1003): a thrown required validator escapes
  runStepValidators, leaves the boundary lease UNFINALIZED, persists no errored
  iteration. FIX: normalize required-validator throws to typed error results
  (stable category), then evaluate + FINALIZE the boundary (clear lease); test
  error persistence + non-convergence + cleared lease.
- P1-6 placeholder (plan:871): Task 5 lands a startable loop with a throwing
  boundary placeholder. FIX: combine Tasks 5+6 so advisory advance + the real
  boundary land atomically. ALSO fix the commit contradiction: plan:40 says
  "executor must not commit" but our process IS per-task path-specific commits by
  the implementer - REMOVE the erroneous :40 line, KEEP the commit steps.
- P2 e2e (plan:1460): bypasses orchestrator preflight, no mutation, no
  fresh-process persistence, writes artifacts under the tracked fixture. FIX: run
  against a TEMP fixture copy through the orchestrator; add fresh-store/process
  continuation + cap + stall + inconclusive/error boundary integration tests.

**Action:** codex task --write authors v2. Then I verify+review (integrity,
the stall/cap-bounding, per-requirement preflight, signature completeness,
truthful-summary, validator-throw finalization), commit, gate, execute.

Collaborator: Jonah.
