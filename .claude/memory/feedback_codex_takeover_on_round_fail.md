---
name: Role inversion - if the P4a-1 round fails, Codex takes over authoring, I review
description: Jonah's directive - if the current (v4) P4a-1 round fails Codex review, hand authoring to Codex (codex task --write) and I become the reviewer; flips the produce/review roles that weren't converging
type: feedback
relates_to: [session_2026-06-13_p4a1-v3-review-fixspec.md, feedback_autonomous_phases_codex_partner.md]
---

Mid P4a-1 v4 round, Jonah: "If this round fails, hand it off to Codex to take
over and you become the reviewer."

**Why:** P4a-1's plan has not converged across 4 author-iterations (me/my agents
producing, Codex reviewing) - 3 Codex rounds, still NEEDS-FIXES. Codex's reviews
are surgical (it knows the spec deeply), so inverting the roles - Codex AUTHORS
the fix, I REVIEW - should converge faster than me interpreting its reviews and
patching.

**How to apply:**
- "This round" = the in-flight v4 (planner-p4a1-v4 -> my verify -> Codex v4
  review). If that Codex review returns NEEDS-FIXES, the round FAILED.
- On failure: hand authoring to Codex via `codex-companion task --write` (Codex
  CAN write files in --write mode) - have Codex directly produce the corrected
  P4a-1 plan from the spec + the open findings. Then I VERIFY + REVIEW Codex's
  output (independent checks: integrity, spec-fidelity, that the findings closed),
  rather than authoring. I commit + gate.
- If the v4 Codex review returns READY-TO-EXECUTE, the round SUCCEEDED - proceed
  to execute P4a-1 (no handoff needed).
- This role-inversion pattern can extend to later P4 sub-plans if they also fail
  to converge under me-authoring.

Collaborator: Jonah.
