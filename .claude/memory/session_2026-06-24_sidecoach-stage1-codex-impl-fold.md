---
name: sidecoach-stage1-codex-impl-fold
description: Folded Codex's IMPLEMENTATION-gate review of Stage 1 (verdict = sound after one P1 fix). Fixed the abort-during-launch browser leak (P1), made rendered coverage precise per-family (P2), fixed stale comments from the color-contrast revert (P2). Re-verified green.
type: project
relates_to: [session_2026-06-24_sidecoach-stage1-built.md, session_2026-06-24_sidecoach-stage1-design-folded.md]
---

Collaborator: Jonah Cohen. Codex (GPT-5.4) implementation-gate review delivered via file handoff (scratchpad/stage1-codex-impl-findings.md). **Verdict: Stage 1 core semantics SOUND; not unconditional-ship until the P1 abort-race is fixed; after that, sound foundation for Stage 2. P2s non-blocking.** Codex confirmed sound: additive live bridge (goto vs setContent), eval untouched, hermetic routing, presence-based promotion, evidence/type/codegen plumbing.

## Folded all 3 findings
- **P1 (browser leak on abort-during-launch)** - rendered-live-scan.ts awaited the launcher only via `race(launch(),'launch')`; if the signal aborted before launch resolved, `browser` stayed undefined and the eventual browser was never closed (leaked Chromium across repeated cancels). FIX: retained `launchPromise` and, in finally, `if (!browser && launchPromise) void launchPromise.then(b=>b.close())` - mirrors browser-evidence-collector.ts:262-265 exactly.
- **P2 (coverage imprecision on partial family failure)** - run-validator non-static branch keyed rendered availability on the coarse `objective.available || subjective.available`, so a rule in the FAILED family still reported `inspected:[renderUrl]`/`['rendered-scan']`. Not a false-clean (the check returns inconclusive, which blocks), but imprecise. FIX: rendered evidenceAvailable now = `result.status !== 'inconclusive'` (the rendered checks return inconclusive IFF their own family scan is unavailable), so coverage is precise per-rule/family. Browser rules unchanged.
- **P2 (stale comments from the color-contrast revert)** - checks/index.ts wrongly said "a11y/color-contrast lives in RENDERED_CHECKS now"; product-rule-registry.ts header said "30 canonical rules" + "owner static-a11y (3)". FIXED all three to reflect the deferred-migration reality (color-contrast stays in A11Y_CHECKS/collector; 36 rules; static-a11y owns 7).

## Codex ENDORSED the color-contrast deferral
Codex's verdict implicitly accepts the deferral (it lists color-contrast remaining collector-backed under "Confirmed Sound Areas" and raised NO objection to shipping Stage 1 without the migration). The P1-1 re-point is now a documented Stage-3/4 (retire old mechanisms) item.

## Re-verification - GREEN, STAGE 1 DONE
tsc clean; integration test green; **full `npm test` = 61 suites passed, zero real failures** (the lone "Error:" is the known-benign `Failed to save flow history: ENOTDIR` - a test deliberately blocking HOME, present in the green baseline). **STAGE 1 COMPLETE + double-verified** (Codex design review pre-build + Codex impl review post-build, both folded; produce-and-verify mandate satisfied - Claude produced, a different model reviewed twice). Stage 2 (migrate the 12 static validateAll call sites to runValidator) now in_progress.

## Files touched (fold)
src/validators/rendered-live-scan.ts (launchPromise), src/validators/run-validator.ts (precise rendered coverage), src/validators/checks/index.ts (comment), src/product-rule-registry.ts (comments).
