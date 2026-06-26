---
name: stage6-oneengine-audit-and-lowcontrast-hole
description: Stage 6 one-engine audit CONFIRMED (live+eval bottom out in the same detector functions; shims real; simpler) but surfaced a MATERIAL convergence hole - low-contrast (40 TP, the biggest objective class) is eval-only, not wired to the live NL path. Lead verified + decided to CLOSE it as the highest-value Stage 6 item.
type: decision
relates_to: [session_2026-06-25_sidecoach-stage6-oneengine-audit.md, session_2026-06-24_sidecoach-S5-integration-gap-and-plan.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## ONE-ENGINE AUDIT (sidestripe teammate, lead-verified by reading rendered-checks.ts)
"ONE engine, no parallel detection, simpler" = TRUE at the detector-function level:
- Rendered (broken-image/skipped-heading/gray-on-color/justified + tiny-text + marketing-buzzword): live `scanRenderedLive` and eval `scanObjectiveRendered/scanSubjectiveRendered` run the SAME inPageObjective/inPageSubjective; registry rules read ctx.renderedScan via rendered-checks.ts (RENDERED_CHECKS map). VERIFIED in rendered-checks.ts:35-90.
- Anti-pattern (5 bans): registry checkProduct -> ANTI_PATTERN_CHECKS -> the SAME 5 scanX the eval calls. 1:1.
- Taste: eval + live both call validateTaste (live = orchestrator gate). Same function.
- Shims real: ExtendedDomain/PolishStandard/AntiPattern filter RULES from the registry, no surviving parallel rule arrays. scanIdenticalCardGrids (ReDoS) + 108KB theater gone.

## THE MATERIAL HOLE: low-contrast is EVAL-ONLY (lead VERIFIED)
rendered-checks.ts:59-61 + product-rule-registry.ts:394-398 EXPLICITLY left low-contrast unwired: "the rendered scanner's low-contrast finding has no live consumer yet (eval-only) - by design." The only live contrast rule a11y.color-contrast (id 20) is collector-backed + applicability inconclusive + evidenceRequirements ['contrast'] (non-required). So:
- The scorecard credits sidecoach low-contrast tp=40/recall=1.0/precision=0.889 (the SINGLE biggest objective class, ~half the objective TP) - but the LIVE natural-language workflow NEVER surfaces it.
- This is the EXACT failure the mission's S5-integration-gap revelation named: "a green eval is not a shipped feature." Leaving the biggest objective win eval-only contradicts Jonah's core intent (NL is the driver, must surface the oracle-beating detection).

## DECISION: CLOSE IT (Task #5, sidestripe building, lead gates)
Wire low-contrast into the live path: add checkLowContrast to rendered-checks.ts (mirror checkGrayOnColor), re-point a11y.color-contrast id-20 to read ctx.renderedScan.objective low-contrast (evidenceRequirements ['contrast']->['rendered-scan'], promoted-required on renderUrl like the other 4 objective rendered rules), retire the orphaned collector contrast probe. Keep gray-on-color separate (distinct class).
- **DETECTION-PRESERVING confirmed:** the eval (eval/sidecoach-scan.mjs) gets low-contrast from objective-rendered-scanner DIRECTLY, not through the registry rule - so re-pointing the LIVE rule changes ZERO eval/frozen-90 numbers. The prior note's "breaks detection-preserving" caution was overcautious (it conflated live-gate behavior with eval measurement). The change is a LIVE-behavior addition (the live path can now block on contrast) + a simplification (orphan the collector probe).
- Investigate-first: sidestripe reports blast radius (tests asserting old collector behavior; collector-probe consumers) before committing; lead gates approach + Codex-reviews the diff.

## OTHER AUDIT CAVEATS (minor, documented not fixed)
- nested-cards: also live-unwired (tp=2) - consistent with the deliberate precision-miss non-ship. Leave.
- flow-handler-tactical-polish.ts:242 calls scanForAbsoluteBans directly (2nd invocation site of the SAME shared functions) - not a parallel detector, only matters if "every detection routes through run-validator" is the literal claim. Note, don't fix.

## Files touched
- (decision beat; Task #5 implementation by sidestripe)
</content>
