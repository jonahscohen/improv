---
name: pr-blocked-stripe-testkey
description: The PR push for sidecoach-phase2-reimplement is BLOCKED by GitHub secret-scanning push protection - a Stripe PUBLIC TEST key (sk_test_BQokik..., the example key from Stripe's docs) is embedded in a captured corpus page (pr_stripe_2018.html). Zero real risk; resolution is Jonah's call (allow via the unblock URL vs scrub history). Scrubbing would corrupt the SHA-locked frozen corpus.
type: reference
relates_to: [session_2026-06-26_hardening-done-merge-pending.md, session_2026-06-26_MISSION-COMPLETE-stage5-6.md]
---

Collaborator: Jonah Cohen. 2026-06-26. Jonah asked to open a PR; the push is blocked.

## THE BLOCKER
`git push -u origin sidecoach-phase2-reimplement` -> GH013 Repository rule violations / GITHUB PUSH PROTECTION: "Push cannot contain secrets."
- Detected: "Stripe Test API Secret Key" at sidecoach/eval/corpus/candidates/pr_stripe_2018.html:621, commit 71c8b58c (an EARLY corpus commit in the branch, NOT this session's work).
- The key is `sk_test_BQokik...` = Stripe's FAMOUS PUBLIC TEST KEY (the literal example secret key in Stripe's documentation). Zero actual credential risk - it is captured as part of the real-world Stripe page in the frozen eval corpus.
- Verified: NO live keys anywhere in the corpus (grep sk_live/rk_live = empty). Only this one public test key.

## RESOLUTION OPTIONS (Jonah's call - I will NOT unilaterally bypass a secret-scanning gate)
1. **ALLOW it (recommended)** via the per-detection unblock URL GitHub printed:
   https://github.com/jonahscohen/improv/security/secret-scanning/unblock-secret/3FevNQA36LWacai9DPmNEhheBmY
   It is a public test key; allowing it is safe and PRESERVES the content-SHA-locked frozen corpus integrity (candidates.json records each page's SHA; the eval's disjointness/reproducibility depend on the captured HTML being byte-stable). After allowing, re-run `git push -u origin sidecoach-phase2-reimplement` and open the PR.
2. SCRUB the key from pr_stripe_2018.html - REJECTED-as-default: the file is in the SHA-locked claim-bearing held-out corpus; editing it changes its content SHA and would break the corpus lock + disjointness records, and it lives in commit 71c8b58c so it needs a history rewrite (destructive on a 131-commit branch).
3. Enable repo Secret Scanning + manage via settings (broader change).

## STATE
PR NOT opened (push blocked). gh authed as jonahscohen; base = main; branch 131 commits ahead of origin/main; all this session's work committed locally. Waiting on Jonah's allow/scrub decision.

## Files touched
- (blocker beat; no code)
</content>
