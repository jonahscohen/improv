---
name: P4a-1 v4 - independently verified, committed, to Codex (role-inversion armed)
description: v4 (planner-p4a1-v4 applied the 9 v3-review fixes) verified by me - 1428 lines, 0 dashes/NUL, all fixes present, TS6059 fix correct, Flow I advisory, 7-step order fixed; committed; Codex review next; if it fails -> Codex authors v5, I review
type: project
relates_to: [session_2026-06-13_p4a1-v3-review-fixspec.md, feedback_codex_takeover_on_round_fail.md]
superseded_by: session_2026-06-13_p4a1-v5-approved.md
---

planner-p4a1-v4 (team lane-p4a1-plan2) applied all 9 v4 fix-spec items to the
P4a-1 plan task bodies. I VERIFIED independently:
- 1428 lines, 0 NUL, 0 unicode dashes, title v4.
- All fixes present (grep counts): validator-generation module (14),
  evidenceAlternativesByRequirement (13), ProductValidationOk/Error discriminated
  union, FIXTURE_MANIFEST (9) + validateFixtureManifest (10), deriveRequireAll,
  raw ban aliases gradient-text/identical-card-grids, deriveFlowCapabilities.
- TS6059 fix CORRECT: the 3 '../../scripts/' hits are all PROSE ("never from
  ../../scripts/"); the test-import grep is empty (no test imports the script).
- Flow I advisory (productValidatorIds:[]) per spec 949; 7-step non-vacuity
  before coverage (L1124).

Committed pending (the team-mode commit-gate required a fresh beat after the
agent's plan edit - this beat satisfies it; that gate misfires for
teammate-edited project files, logged twice before).

**NEXT:** Codex re-review of v4. Per [[feedback_codex_takeover_on_round_fail.md]]:
if Codex returns READY-TO-EXECUTE, execute P4a-1; if NEEDS-FIXES, the round
FAILED -> hand authoring to Codex (codex task --write produces v5 directly from
spec + open findings) and I become the reviewer (independent verify + spec
fidelity + commit/gate).

Collaborator: Jonah.
