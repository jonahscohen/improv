---
name: sidecoach-closure-fold-verified
description: Codex fold-verification re-review confirmed closure findings 1/3/4/5 folded correctly, and CAUGHT a real sub-bug in fold #3 (wrappedByLabel matched custom elements like <label-tooltip>). Fixed with a real-tag-boundary regex + regression test; Codex targeted re-check returned WRAPFIX: VERIFIED. 64 suites green. All closure findings resolved except #2 (Stage 4). Commit-boundary decision open for Jonah.
type: project
relates_to: [session_2026-06-25_sidecoach-stage2-closure-fold.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## RE-REVIEW OUTCOME (produce-and-verify, cross-model)
Codex fold-verification re-review of the post-fold diff:
- Fold #1 (passRateByDomain owner+findingClass keying): OK.
- Fold #3 (image per-img lazy-load): OK.
- Fold #4 (model-routing count-free): OK.
- Fold #2 (forms per-control labelling): STILL-BROKEN - `wrappedByLabel` used `lastIndexOf('<label')`, which ALSO matches custom elements (`<label-tooltip>`, `<labelgroup>`, `<labelled-x>`), so an unlabelled control inside such a tag could falsely pass.

## SUB-BUG FIXED + RE-VERIFIED
- Fix: `wrappedByLabel` now matches a REAL `<label>` start tag only via `/<label[\s>/]/` (label followed by whitespace/`>`/`/`), found with a `lastReIndex` helper, compared against `lastIndexOf('</label>')` (which does not match `</label-x>`).
- Added regression test: `<label-tooltip>Help</label-tooltip><input>` -> fail.
- Verified: build clean, 64 suites green (forms-checks + page-quality-checks OK with new cases). Targeted Codex re-check returned **WRAPFIX: VERIFIED** (walked the regex against each custom-element case; no ReDoS/off-by-one; `</label>` close-tag safe).
- Note: the `git diff` for the targeted check came out empty (pathspec quirk under the repo-root cwd), but Codex read the source directly + the green `<label-tooltip>`-fail regression test proves the fix is live on disk.

## STATE: ALL CLOSURE FINDINGS RESOLVED EXCEPT #2
Findings 1/3/4/5 folded + verified + Codex-clean. Finding #2 (retired-domain 0/0 handler coupling) deferred to Stage 4 (pervasive: checklist + guidance + memory.addRule + customData; a row-guard would be a throwaway half-fix). Stage 1+2 convergence remains UNCOMMITTED on 774ab884.

## OPEN: commit-boundary decision put to Jonah
(A) commit Stage 1+2 now with #2 tracked as Stage 4's first task; (B) hold commit, fix #2 in Stage 4, then one clean converged-milestone commit; (C) protective WIP checkpoint commit now + clean milestone after Stage 4. Recommended C (the work has been uncommitted across multiple sessions = real loss risk the beats have repeatedly flagged; a WIP checkpoint protects it without claiming milestone quality, and honors the DO-NOT-COMMIT-for-#2 verdict).
