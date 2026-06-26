---
name: stage4-polish-absorbed
description: PolishStandardValidator absorbed onto the registry (Stage 4) - the right way this time. Deleted the private 400-line POLISH_RULES engine; validateAll now runs the 24 registry rules carrying polish-standard:N aliases via lazy require (breaks the cycle); KEPT all ~25 exported helper predicates the registry imports. totalRules=24, combined=46 contract holds, 64 suites green, no circular break.
type: project
relates_to: [session_2026-06-25_stage4-absorption-scope.md, session_2026-06-25_stage4-agent-integration-and-gaming-catch.md]
---

Collaborator: Jonah Cohen. 2026-06-25. The PolishStandard half of the last Stage 4 piece - done correctly (the absorb agent broke this by gutting the helpers; I preserved them).

## WHAT I DID (src/polish-standard-validator.ts: 570 -> ~230 lines)
- DELETED the private POLISH_RULES array (400 lines, the duplicate engine) via a boundary-matched script (top-level `const POLISH_RULES` .. `^];`).
- KEPT lines 1-126: all TYPES + the ~25 exported helper predicates (hasFocusVisible/hasFontSmoothing/hasKeyframe.../etc.) that checks/polish-checks.ts + checks/a11y-checks.ts import. NOT gutting these is the whole point.
- REWROTE validateAll to run the REGISTRY rules: filter RULES for a `polish-standard:N` sourceRuleAlias (yields exactly the 24 polish rules - 21 under owner polish-standard + 3 under static-a11y ids 5/18/20), parse N as the numeric ruleId, run rule.checkProduct over a PolishCheckContext->ProductCheckContext, shape the PolishValidationReport. totalRules DERIVED (=24). criticalViolations = registry 'blocker' severity (== legacy critical). getRules() synthesizes PolishValidationRule[] from the same 24 (no consumers, kept honest). getSummary/toValidationResult kept.
- CIRCULAR IMPORT solved: RULES is `require()`d LAZILY inside a memoized polishRegistryRules() (NOT a top import), because the registry's checks import the helpers from this file. type-only imports (ProductCheckContext, CanonicalSeverity) are fine (erased).

## VERIFIED
- build clean (generate --check no drift, tsc green). Behavioral probe: validateAll totalRules=24, getRules length=24, toValidationResult OK, NO circular break (lazy require works). npm test 64/64 green.
- Pass counts SHIFTED (Polish 16/24 -> 20/24, Flow J 35/46 -> 41/46, combined 38->42/46) because the registry checks are sync cssText/markup-only and differ slightly from the old POLISH_RULES (the absorb agent's noted behavior change - correct convergence). Tests assert the COUNT contract (totalRules 24, combined 46), not exact pass numbers, so they pass.

## NEXT: AntiPattern absorption (delete anti-pattern-validator.ts; adapter over the registry anti-pattern owner; route flow-handlers-tier3-tier4.ts:200/470/607; honest inconclusive-not-false-pass). Then one Codex review of the whole absorption.
