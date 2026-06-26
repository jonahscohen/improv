---
name: buzzword-v3-heldout-measure-running
description: Held-out labeling done (37/38, zendesk timed out once - being resumed). v3 head-to-head measurement running on the fresh 38-page held-out (ours scanSubjectiveRendered vs oracle runOracle, scored vs Codex held-out labels). The clean v3 precision verdict.
type: project
relates_to: [session_2026-06-25_buzzword-heldout-measure-plan.md, session_2026-06-25_buzzword-v3-codex-clean.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25).

## STATE
- Held-out labeling COMPLETE: 37 labeled / 1 failed (zendesk ETIMEDOUT, codex flakiness) -> resuming zendesk (1 page) then measuring; the measure script skips any still-unlabeled page so it's robust either way.
- v3 detector: Codex-clean (2 P2 comment fixes folded by buzzword, behaviorally inert), build+64 suites green, dist current.
- MEASUREMENT (bg b3u9kk9qx): eval/buzzword-heldout-measure.mjs - ours = shipping scanSubjectiveRendered (render+inPageBuzzword+threshold 0.75) fires marketing-buzzword?; oracle = runOracle detect.mjs fires marketing-buzzword?; both scored vs buzzword-heldout-labels.json. R/P/F1 + confusion for both.

## WHAT IT TESTS
v3 dev was R0.839/P0.839 (precision up from v2 0.806, recall held). Frozen v2 was r0.875/p0.333 (recall great, precision below oracle 0.4). The FRESH held-out is FP-mode-loaded (science/infra/gov using marketing vocab concretely) to test whether the vacuity-tier fix lifts precision past oracle's 0.4 WITHOUT losing the recall win. This is the clean, single measurement (frozen-90 untouched/spent). Whatever it shows is reported.

## Files touched
- (checkpoint beat; measurement running)
</content>
