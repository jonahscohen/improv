---
name: PR-opened
description: PR #1 opened for the Phase 2 reimplementation (sidecoach-phase2-reimplement -> main) after Jonah allowed the Stripe public-test-key push-protection detection. The reimplementation is now in review rather than auto-merged.
type: project
relates_to: [session_2026-06-26_pr-blocked-stripe-testkey.md, session_2026-06-26_MISSION-COMPLETE-stage5-6.md, session_2026-06-26_hardening-done-merge-pending.md]
---

Collaborator: Jonah Cohen. 2026-06-26.

## DONE
- Jonah allowed the Stripe public-test-key detection (sk_test_BQokik..., the docs example key in pr_stripe_2018.html) via the GitHub unblock URL.
- `git push -u origin sidecoach-phase2-reimplement` SUCCEEDED (131 commits, [new branch]).
- PR opened: https://github.com/jonahscohen/improv/pull/1 (base main, head sidecoach-phase2-reimplement). Title: "Sidecoach Phase 2: reimplement-and-own detection, converge to one engine, beat the oracle". Body summarizes the architecture (one engine, registry spine + rendered scanner, shims, low-contrast live), the head-to-head results vs the oracle, the eval rigor (frozen held-out, author!=labeler, cross-model Codex review, bootstrap CIs), the codex-doctor hooks, and the codegen guard. No AI attribution (per the invisibility rule).

## STATE
The phase-2 reimplementation is now IN REVIEW (PR #1), not merged to main - the chosen path (reviewable diff before canonical). Awaiting Jonah's review/merge.

## Files touched
- (PR beat; PR #1 on GitHub)
</content>
