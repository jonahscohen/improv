---
name: stage4-absorption-scope
description: Precise turnkey scope for the LAST Stage 4 piece - retire PolishStandardValidator + AntiPatternValidator onto the registry WITHOUT gutting the shared exported predicates (the mistake that broke the absorb agent's attempt). Exact line ranges + circular-import handling mapped.
type: decision
relates_to: [session_2026-06-25_stage4-finding2-COMPLETE.md, session_2026-06-25_stage4-agent-integration-and-gaming-catch.md]
---

Collaborator: Jonah Cohen. 2026-06-25. The last Stage 4 piece after finding-2 (DONE). This beat makes it turnkey so it can be done carefully (fresh context recommended - it couples to the registry's critical helper module; the absorb agent broke exactly this by gutting the helpers).

## POLISH-STANDARD ABSORPTION (src/polish-standard-validator.ts, 570 lines)
Structure mapped:
- Lines 1-58: TYPES (PolishValidationRule/PolishCheckContext/PolishCheckResult/PolishValidationReport etc.) - KEEP (imported by flow-handler-tactical-polish + validator-integration.test as PolishCheckContext/PolishValidationReport).
- Lines 66-126: ~25 EXPORTED HELPER PREDICATES (joinCssRules, hasScaleOnPress, hasCompoundIconTransition, hasImageOutlineRule, hasNoImages, hasTransitionAll, hasTabularNums, hasDynamicNumberSelectors, hasTextWrapBalance, hasStaggerDelay, hasExitOpacity, hasExitScale, hasAnyMotion, hasFontSmoothing, hasFramerSignal, hasWillChangeAll, hasBoxShadowElevation, hasShadowTokenTiers, countBoxShadowRules, hasOpticalPadding, POLISH_STATES, countDefinedStates, hasFocusVisible, hasReducedMotion, hasKeyframeAnimationOnInteractiveState, hasEntranceKeyframe). **KEEP ALL** - the registry's checks/polish-checks.ts AND checks/a11y-checks.ts import these. Gutting them is what broke the absorb agent (TS2305 in polish-checks.ts).
- Lines 128-527: private `POLISH_RULES: PolishValidationRule[]` (22 rules, checkFunctions use the helpers) = the DUPLICATE ENGINE to DELETE.
- Lines 529-570: class PolishStandardValidator { static validateAll (runs POLISH_RULES), getRules (returns POLISH_RULES), toValidationResult }.

THE ABSORPTION: make validateAll run the REGISTRY's polish-standard + static-a11y owned rules (the absorb agent verified all 22 POLISH_RULES already exist there: 19 polish-standard + 3 static-a11y ids 5/18/20) instead of the local POLISH_RULES array; then DELETE the POLISH_RULES array. totalRules DERIVED (=22), not literal. Keep getRules/toValidationResult shapes.
- CIRCULAR IMPORT: the registry (product-rule-registry -> checks/*) imports the helpers from THIS file, so validateAll importing the registry is circular. Handle with LAZY memoized import inside validateAll (require/dynamic-import the registry registration at call time, not module top). The absorb agent did this correctly ("fixed a circular import via lazy memoization") - it was the helper-gutting, not the lazy import, that broke it.
- CONSUMERS to keep green: flow-handler-tactical-polish.ts:211 (validateAll) + :407 (toValidationResult); validator-integration.test.ts (asserts extendedReport===22, totalRules===46, and PolishStandardValidator/PolishCheckContext/PolishValidationReport imports); sprint7-polish-validator-result.test.ts (toValidationResult mapping); a11y-checks.ts (hasFocusVisible); polish-checks.ts (the ~12 helpers).
- BEHAVIOR-CHANGE caveat (absorb agent, valid): the registry checks are sync cssText/markup-only, so legacy ad-hoc computedStyle/contrast paths no longer force a pass, and markup-only AnimatePresence can't pass through the sync shim. That's correct convergence (the registry is the engine), note it.

## ANTI-PATTERN ABSORPTION
- Delete src/anti-pattern-validator.ts (27 ANTI_PATTERNS; only 6 named bans anti_001-006 are real = already the registry's anti-pattern owner backed by absolute-ban-detector; the other 21 are presence-of-CSS theater / 3 hardcoded false - DROP, do not absorb).
- New src/anti-pattern-registry-adapter.ts: runs getValidatorRegistration('anti-pattern').validateProduct({projectPath}) and reshapes to the handlers' display fields; score is number|null with an explicit "inconclusive" path (NOT a false Pass on empty input - the Codex-flagged bug).
- Re-route the 3 sites: flow-handlers-tier3-tier4.ts Flow K:200, M:470, N:607; corrected the dishonest "27/28-rule" labels to registry-derived counts.
- design-laws.ts left intact.

## VERIFY: npm run build (generate --check = no drift), npm test 64/64, the standalone polish/sprint7 tests, behavioral smoke (Flow K/M/N detect a real finding + honest inconclusive on empty), then Codex review. The absorb agent's (broken-helpers) reference impl is on worktree branch worktree-agent-aa807216b1407a939.
