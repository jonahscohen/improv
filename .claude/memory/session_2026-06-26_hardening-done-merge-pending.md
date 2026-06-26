---
name: hardening-done-merge-pending
description: Post-mission hardening complete + committed (watcher over-fire fix + RENDERED_BACKED inverse guard, both Codex-reviewed). Remaining natural next steps - the branch merge (126 commits to main = Jonah's strategic call, surfaced) and the side-stripe saturation gate (deferred - needs held-out rigor, low value given the huge precision margin).
type: project
relates_to: [session_2026-06-26_watcher-overfire-fix.md, session_2026-06-26_rendered-backed-inverse-guard.md, session_2026-06-26_MISSION-COMPLETE-stage5-6.md, session_2026-06-25_sidestripe-lead-ruling.md]
---

Collaborator: Jonah Cohen. 2026-06-26. Jonah: "Proceed with the natural next steps autonomously." Did the two clearly-safe ones; surfaced the high-impact one.

## DONE + COMMITTED (808613ad)
1. codex-failure-watcher over-fire fix: trip only on codex INVOKED as a command (not greps/cats mentioning it). Codex-reviewed, folded the residual paren-leak, accepted the path/backtick miss as a best-effort-nudge limit. Live (symlinked hook).
2. RENDERED_BACKED inverse-invariant guard in generate-validators --check: every rendered-scan rule must be in the allowlist (catches the marketing-buzzword-style un-promoted bug at build time). Verified catches a synthetic violation; 57 suites green.
Both Codex-reviewed (the watcher review even self-demonstrated: codex flaked on capacity but its internal retry got the verdict - the doctor treating itself).

## REMAINING NEXT STEPS
- **MERGE sidecoach-phase2-reimplement -> main** (126 commits ahead, 0 behind = clean fast-forward). Technically safe (green, no divergence) but STRATEGIC: it makes the ENTIRE phase-2 reimplementation canonical. Surfaced to Jonah as his call (timing/method - direct merge vs PR). NOT auto-merged (high-impact, outward-facing, multiple plausible interpretations).
- **side-stripe saturation gate** (precision lever from [[session_2026-06-25_sidestripe-lead-ruling]]): still DEFERRED. It needs the full dev-develop + fresh-held-out rigor (the frozen-90 has the 17 side-stripe FP, so tuning on it = training-on-test), and the precision margin is already enormous (0.40 vs 0.10), so it is low value. Not done autonomously.

## Files touched
- (wrap-up beat; hardening committed in 808613ad)
</content>
