---
name: sidecoach-stage6-oneengine-audit
description: Read-only Stage 6 prep audit of the "ONE engine, no parallel detection, simpler" claim. Engine convergence CONFIRMED at the detector-function level (rendered via scanRenderedLive, anti-pattern via 5 scanX, taste via validateTaste - all shared eval<->live). Shims real, theater gone. TWO documented eval-only finding-classes flagged: low-contrast (40 TP, no live registry rule, deferred migration) and nested-cards (2 TP, deliberately deferred). Not parallel detectors - shared scanner computes them live but no live rule consumes them.
type: project
relates_to: [session_2026-06-24_sidecoach-option-B-convergence-PLAN.md, session_2026-06-25_stage4-absorption-review-folded.md, session_2026-06-24_sidecoach-nested-cards-precision-miss.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Builder teammate "sidestripe", Task #4 (lead-requested READ-ONLY audit; no edits, no Playwright, no frozen-90 touch). file:line evidence below.

## VERDICT: "ONE engine" is TRUE at the detector-function level. No parallel detection engines survive. Simpler confirmed. TWO documented eval-only finding-classes must be stated in the Stage 6 claim (not parallel detectors - asymmetric wiring of the SHARED engine).

## 1. ONE-ENGINE REALITY - eval and live bottom out in the SAME detector functions.
- **Rendered (objective 5 + subjective 2):** eval `eval/sidecoach-scan.mjs:52-67` calls `scanObjectiveRendered`/`scanSubjectiveRendered` -> `page.evaluate(inPageObjective)` / `inPageSubjective`. Live `run-validator.ts:308` calls `scanRenderedLive` -> `rendered-live-scan.ts:106,110` runs the SAME `inPageObjective`/`inPageSubjective`. Registry rendered rules read `ctx.renderedScan` via `rendered-checks.ts` (RENDERED_CHECKS map). SHARED in-page functions. CONFIRMED.
- **Anti-pattern (5 named bans):** eval `sidecoach-scan.mjs:44` calls `scanSideStripeBorders/scanGradientText/scanGlassmorphism/scanHeroMetricTemplate/scanModalAsFirstThought`. Live: registry rules `product-rule-registry.ts:655-724` (5 rules ownerValidatorId 'anti-pattern') bind `checkProduct` via `CHECKS[def.canonicalRuleKey]` (registry:746) -> `ANTI_PATTERN_CHECKS` (`anti-pattern-checks.ts:76-81`) -> `checkGradientText`/etc., which call the SAME 5 scanX (`anti-pattern-checks.ts:50-73`). 1:1 SHARED. CONFIRMED.
- **Taste:** eval `sidecoach-scan.mjs:43` calls `validateTaste(html)`. Live `sidecoach-orchestrator.ts:496` calls `validateTaste(html, css)` (the taste gate); `theming-checks.ts` reuses the same taste scanners. SAME function. CONFIRMED (note: taste runs as the orchestrator GATE, not a standalone registry "taste" rule - same detector, different host).

## 2. SHIMS ARE REAL - no surviving parallel rule arrays.
- `ExtendedDomainValidator` (239 lines, was 108KB): `validateAll` maps over `ABSORBED = RULES.filter(owner forms|page-quality && staticallySatisfiable && checkProduct)` (`extended-domain-validator.ts:147,180`) - registry-derived, calls `r.checkProduct`. No private rule loop.
- `PolishStandardValidator` (233 lines): "The private POLISH_RULES engine was DELETED" (`polish-standard-validator.ts:131`); `validateAll` runs registry rules carrying `polish-standard:N` aliases via lazy `require('./product-rule-registry')`. Registry-backed.
- `AntiPatternValidator` (237 lines): design-laws `ANTI_PATTERNS` detection engine RETIRED (`anti-pattern-validator.ts:8-10`); `validateCode` filters `RULES` for ownerValidatorId 'anti-pattern' and runs their checkProduct (same scanX). Registry-backed.
- grep for POLISH_RULES/DOMAIN_RULES/EXTENDED_RULES/TIER2 loops: none live. `design-laws.ts:7 ANTI_PATTERNS` is a DATA catalog (law descriptions for reference-loader), not a scanner. `flow-domain-integration.ts:8` imports ANTI_PATTERNS but NEVER USES it (dead import - minor cleanup, not detection).

## 3. SIMPLER - theater + ReDoS gone.
- 108KB ExtendedDomainValidator -> 239-line registry shim (~190 theater rules retired; 16 forms + 6 page-quality absorbed).
- `scanIdenticalCardGrids` (ReDoS) DELETED from product (`absolute-ban-detector.ts:148` deletion marker; registry entry deleted `product-rule-registry.ts:700`; check deleted `anti-pattern-checks.ts:64`). Only deletion-comments remain.

## TWO EVAL-ONLY FINDING-CLASSES (flag in the Stage 6 claim - documented, deliberate, NOT parallel detectors).
The shared scanner COMPUTES these live (inPageObjective/inPageSubjective run via scanRenderedLive), but NO live registry rule consumes the finding, so the live NL workflow never surfaces them to a user. Eval reads the scanner finding directly and scores them.
- **low-contrast (MATERIAL):** eval scores sidecoach tp=40/fp=5/recall=1.0/precision=0.889 (`scorecard.json:848`) - a LARGE part of the objective win. `inPageObjective` emits 'low-contrast' (`objective-rendered-scanner.ts:278`), mapped to GT class low-contrast. BUT `rendered-checks.ts:59-61` is explicit: "The rendered scanner's low-contrast finding therefore has no live consumer yet (eval-only) - by design." The only live contrast rule `a11y.color-contrast` is collector-backed and stays "owned non-required -> inconclusive until P4b" (`product-rule-registry.ts:394-399`). So: the eval credits 40 TP on a scanner capability that SHIPS and RUNS live, but is NOT wired to a user-facing live rule (deferred migration). Honest Stage 6 framing must say this, since 40 TP is not a rounding error.
- **nested-cards (small):** eval scores tp=2/fp=3/recall=0.286/precision=0.4 (`scorecard.json:1037`). `inPageSubjective` emits 'nested-cards' (`subjective-rendered-scanner.ts:171`) but there is NO registry rendered rule for it (RENDERED_CHECKS has only tiny-text for the subjective family). Consistent with the DELIBERATE non-ship decision (precision 0.267/0.4 < shippable; [[session_2026-06-24_sidecoach-nested-cards-precision-miss]] kept it as the honest eval measurement, not a live rule).

## Residual notes (minor, not parallel detection).
- `flow-handler-tactical-polish.ts:242` calls `scanForAbsoluteBans(projectPath)` DIRECTLY (not via run-validator/registry), pushing `absoluteBanToValidationResult` at :413. It uses the SAME 5 scanX, so it is NOT a parallel DETECTOR - just a second (non-registry) invocation site of the shared functions. The Option B Stage-2 intent was to route the validateAll sites through runValidator; the validateAll calls are now registry-shimmed, but this direct scanForAbsoluteBans call remains its own path. Detection-equivalent; flag only if "every detection routes through run-validator" is part of the literal claim.

## Honest one-line for Stage 6
"ONE shared detection engine (same in-page + scanX + validateTaste functions in eval and the live workflow); all standalone validators are registry-backed shims; theater + ReDoS deleted. Caveat: the shared scanner computes low-contrast (40 eval TP) and nested-cards (2) which run live but are not wired to a live user-facing rule (low-contrast = deferred migration; nested-cards = deliberate precision-deferral) - documented, not parallel detection."

## Constraints honored
Read-only; no edits; no Playwright; no frozen-90 candidates touched (only read committed eval/corpus/scorecard*.json + src). No Codex (lead runs it).

## Files touched
- (this beat + MEMORY.md index; audit only, zero src changes)
