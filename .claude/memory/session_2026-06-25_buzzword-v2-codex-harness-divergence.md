---
name: buzzword-v2-codex-harness-divergence
description: Codex v2 review caught an INTEGRITY-critical bug - the calibration harness reimplements the taxonomy/density (diverges from the shipping detector), so R0.81/P0.81 measured the wrong detector. Plus a MILD-alone-on-short-page over-fire. Caught BEFORE the last clean frozen-90 shot. Routed to buzzword for harness alignment + re-calibration.
type: project
relates_to: [session_2026-06-25_buzzword-v2-calibrated-verified.md, session_2026-06-25_buzzword-rebuild-mandate.md, feedback_multiagent_verified_implementation_mandate.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## CODEX V2 FINDINGS (review completed clean, 0 capacity error; full suite green 57)
- **P1 INTEGRITY (verified)** eval/buzzword-calibrate.mjs reimplements its OWN PEAK/STRONG arrays + its OWN HTML-based `densityOf` (lines 49-53), DIVERGENT from the shipping in-page detector (subjective-rendered-scanner.ts): different visibility handling, and 'supercharged' duplicated (1x shipping / 2x harness). => the R0.81/P0.81 (and my "independent reproduction", same harness) measured a DIFFERENT detector than ships. The threshold 1.0 was chosen on the divergent harness. MUST fix before the frozen-90 measure.
- **P1 PRECISION** subjective-rendered-scanner.ts:224 - a single MILD term (modern/advanced/robust/dynamic/smart) on a 40-100 word page fires (1 weight/40-100 words*100 = 1.0-2.5 >= 1.0 threshold). Real over-fire risk on the diverse short-concrete held-out pages. Fix: require >=2 weighted/distinct OR >=1 STRONG/PEAK for a MILD-only page, or a higher floor - on principle, not gap-hunted.
- **P2** :253 - space-consuming global regex undercounts adjacent repeats; use non-consuming lookarounds.

## WHY THIS IS GOOD PROCESS
The Codex gate runs BEFORE the frozen-90 measure precisely so a mis-calibrated detector doesn't waste the LAST clean held-out shot (v1 spent the first; this is the only remaining unbiased measurement). The frozen-90 is STILL untouched. We fix on dev, re-calibrate the SHIPPING detector, then measure once.

## ROUTED TO BUZZWORD (fold + re-calibrate)
1. Harness MUST measure the EXACT shipping detector: render each dev page + run the SHIPPING in-page density logic (export it / shared single source), NOT a reimplementation. Then re-sweep.
2. Fix the MILD-alone over-fire (principled floor).
3. Fix the regex undercount.
4. Re-calibrate the SHIPPING detector on the diverse dev set, re-freeze the threshold (confirm/adjust), report the corrected sweep + true dev R/P.
5. Build+test green. Then lead: re-Codex the fold + ONE frozen-90 measure.

## Files touched
- (finding beat; fold in flight by buzzword)
</content>
