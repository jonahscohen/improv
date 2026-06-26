---
name: buzzword-heldout-measure-plan
description: How the lead measures the v3 marketing-buzzword head-to-head on the fresh 38-page held-out - ours via shipping inPageBuzzword (effectiveDensity >= BUZZ_DENSITY_THRESHOLD), oracle via oracle-comparator runOracle (rule=='marketing-buzzword'), scored against the held-out Codex labels. Same methodology as the frozen-90, focused on the one class.
type: reference
relates_to: [session_2026-06-25_buzzword-v3-fix-and-heldout.md, session_2026-06-25_buzzword-v3-codex-clean.md]
---

Collaborator: Jonah Cohen. 2026-06-26 (EDT 2026-06-25).

## MEASUREMENT MECHANICS (lead-held)
buzzword-calibrate.mjs is DEV-hardcoded; the scorecard pipeline is candidates-hardcoded. So a focused held-out head-to-head script (eval/buzzword-heldout-measure.mjs):
- OURS: render each held-out page (1280x800 hermetic, abort-external, strip-scripts - same as the detector) + `page.evaluate(inPageBuzzword)` from dist; FIRE iff `effectiveDensity >= BUZZ_DENSITY_THRESHOLD` (both imported from dist = SINGLE SOURCE / shipping).
- ORACLE: `runOracle(file)` from oracle-comparator.mjs (invokes oracle detect.mjs headless); FIRE iff any finding `rule === 'marketing-buzzword'` (confirmed oracle's rule name from the .scorecard-cache).
- GT: buzzword-heldout-labels.json marketing-buzzword `present` per page (Codex, author!=labeler).
- Compute R/P/F1 + confusion for BOTH tools. This is the v3 precision test + the head-to-head, same methodology as the frozen-90, on the one class.

## DISCIPLINE
This is a FRESH held-out (disjoint from dev + frozen-90, externally sourced, FP-mode-loaded). Measuring v3 here once = clean (the frozen-90 stays spent/untouched). buzzword never ran the detector on it. Whatever it shows is reported.

## STATE
held-out labeling running (~8-15/38); v3 Codex clean (2 P2 comment fixes routed); build green. Script written, runs once labels land.

## Files touched
- eval/buzzword-heldout-measure.mjs (lead measurement tool, being written)
</content>
