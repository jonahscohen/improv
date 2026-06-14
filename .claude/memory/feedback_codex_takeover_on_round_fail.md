---
name: Role inversion - when I struggle to author, Codex writes it and I review
description: Jonah's STANDING directive (generalized 2026-06-14) - whenever I am struggling/stalling to author something correctly, hand it to Codex to write (codex task --write) and I review the result; do NOT grind on it myself
type: feedback
relates_to: [session_2026-06-13_p4a1-v3-review-fixspec.md, feedback_autonomous_phases_codex_partner.md]
---

## GENERALIZED (2026-06-14): "If you're having trouble writing something, give it
to Codex to fix and then review it after."

This is now a STANDING rule, not just a round-fail fallback. The moment I am
struggling to author something correctly (a plan that won't converge, an
intricate piece of code, a subtle algorithm) - hand the WRITING to Codex via
`codex-companion task --write` and become the REVIEWER. Do not burn rounds
grinding it myself. I default to authoring; I flip to Codex the instant it's not
converging cleanly. Proven: Codex authored P4a-1 v5 (after 4 stalled me-rounds),
P4a-2 v2, P4b-1 v2 + the proper-lockfile lock fix - each in ~1 pass; I reviewed.

Reviewer protocol on Codex-authored output: independent integrity (0 unicode
dashes - Codex writes BYPASS the content-guard hook, so I grep+strip myself; 0
NUL), spec-fidelity spot-checks of the load-bearing logic (read it, don't
rubber-stamp), internal consistency, then commit + gate.

## Original (round-fail trigger):


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
