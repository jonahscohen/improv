---
name: buzzword-v2-fold-verified
description: buzzword folded all 3 Codex v2 findings; lead verified the two critical fixes (single-source harness now imports shipping inPageBuzzword + its reimplemented copies deleted; QUALIFY guard kills the single-MILD short-page over-fire). Aggregate dev unchanged R0.806/P0.806 (guard protects held-out short-concrete pages dev lacks). Re-Codex + frozen-90 measure next.
type: project
relates_to: [session_2026-06-25_buzzword-v2-codex-harness-divergence.md, session_2026-06-25_buzzword-v2-calibrated-verified.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## FOLD VERIFIED (lead read the code)
- **P1 INTEGRITY (single source) - CONFIRMED FIXED.** eval/buzzword-calibrate.mjs:19 `await import(dist/.../subjective-rendered-scanner.js)` for inPageBuzzword + BUZZ_DENSITY_THRESHOLD; :43 `page.evaluate(inPageBuzzword)`; the harness's own `const PEAK=`/`const STRONG=`/`function densityOf` = grep count 0 (deleted, incl. the duplicated 'supercharged'). Harness now measures the EXACT shipping scorer. buzzword reports harness==production both R0.806/P0.806 (I'm reproducing).
- **P1 PRECISION (QUALIFY guard) - CONFIRMED FIXED.** inPageBuzzword (subjective-rendered-scanner.ts:211) returns BuzzwordScore{density, effectiveDensity, distinctTerms, hasStrongOrPeak,...}; :299 `qualifies = hasStrongOrPeak || distinctTerms >= 2`; :300 `effectiveDensity = qualifies ? density : 0`. A lone MILD term (distinctTerms=1, no strong/peak) -> eff=0 -> won't fire. Correct, principled.
- **P2 (regex) - reported fixed** (non-consuming lookarounds; verify in re-Codex).
- ARCHITECTURE: marketing-buzzword EXTRACTED out of inPageSubjective into the standalone exported inPageBuzzword; rendered-live-scan.ts evaluates+merges it; threshold applied Node-side. Single source for eval + live + harness.

## HONEST: aggregate dev UNCHANGED (R0.806/P0.806, TP25/FP6/FN6/TN11)
buzzword's reasoning (sound): the old reimplementation was close enough that no dev page crossed the 1.0 boundary, and the QUALIFY guard only zeroes pages already <1.0 on the (long) dev concrete pages. So dev didn't move - but the integrity is now real (measuring shipping code) and the guard+lookaround HARDEN the HELD-OUT short-concrete pages (which dev lacks). Threshold 1.0 confirmed on the corrected detector.

## GATE (last clean shot still ahead; frozen-90 untouched)
1. Lead build+test (running) + reproduce the corrected calibration (R0.806/P0.806 on shipping inPageBuzzword).
2. Re-Codex the fold diff (inPageBuzzword extraction self-containment + QUALIFY guard + lookaround).
3. ONE frozen-90 measure.

## Files touched
- (fold-verify beat; fold in subjective-rendered-scanner.ts + rendered-live-scan.ts + eval/buzzword-calibrate.mjs, uncommitted)
</content>
