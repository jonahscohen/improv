---
name: P4a-1 ROLE INVERSION - Codex authors v5, I review (v4 round failed)
description: v4 Codex review NEEDS-FIXES (round failed) -> per Jonah's directive, Codex now AUTHORS the plan fix via task --write and I am the REVIEWER; remaining findings = capability-test-derives-flowSequence, validateRegistry fixtures, empty-gating reject, fixture-exec contradiction, per-file coverage, generated-field consistency, scope check
type: project
relates_to: [feedback_codex_takeover_on_round_fail.md, session_2026-06-13_p4a1-v4-verified.md]
---

Codex v4 review (task-mqd0jv7g; session 019ec369) = NEEDS-FIXES -> the v4 round
FAILED. Per [[feedback_codex_takeover_on_round_fail.md]] the roles invert: CODEX
authors v5 (codex task --write), I REVIEW.

v4 CLOSED: TS6059, evidence-compat AND, 7-step order, fixture-manifest rejection,
requireAllDiscovered, discriminated union, ban aliases.

**Open findings Codex must fix in v5:**
- STILL-OPEN capability test: it tests a hard-coded map, not lane_converge's
  actual flowSequence - membership drift would pass. Derive from the lane data.
- STILL-OPEN validateRegistry completeness: ruleId/severity checked but their
  failing-first fixtures absent; sourceRuleAliases neither enforced non-empty nor
  fixtured.
- NEW P1 empty gating validator: validateRegistry skips registrations owning zero
  rules, so stripping all rules from a gating validator bypasses non-empty-policy
  rejection.
- NEW P1 fixture-execution contradiction: the v4 pointer says the suite executes
  fixtures, but Task 3 defers fixture files/execution to P4a-2 and Task 4 only
  validates manifest strings (changelog/body inconsistency again). Make consistent:
  P4a-1 checks manifest PRESENCE only; execution is P4a-2.
- NEW P1 coverage per-file: CoverageObservation stores only global
  evidenceKindsPresent; cannot prove each discovered applicable file maps to a
  compatible alternative (spec 526-533). Needs per-file evidence.
- NEW P2 generated-field body contradiction: File Structure says
  flow-validation-capabilities.ts imports generated fields/capabilities; the task
  body imports neither. Make consistent.
- NEW P2 scope check incomplete: blacklist can't verify "ONLY new files +
  run-tests.ts" and omits deferred domains/*.

**Reviewer protocol (me) on Codex's v5:** independent integrity (0 dashes - NOTE
Codex writes bypass the content-guard hook, so I MUST grep + strip any unicode
dash before committing; 0 NUL), spec-fidelity spot-checks of each finding above,
internal consistency (pointer matches task bodies), then commit + gate. If v5 is
clean -> execute P4a-1.

Collaborator: Jonah.
