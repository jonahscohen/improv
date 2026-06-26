---
name: sidecoach-lowcontrast-live-wiring
description: Stage 6 Task #5 - wired the rendered scanner's low-contrast finding into the LIVE path, closing the eval-only hole the one-engine audit found (low-contrast = 40 frozen-90 TP, the biggest objective class, previously had no live consumer). Migrated a11y.color-contrast off the orphaned collector contrast probe onto the rendered scan (checkLowContrast). Detection-preserving for eval (eval calls the scanner directly). Build clean, tests updated.
type: project
relates_to: [session_2026-06-25_stage6-oneengine-audit-and-lowcontrast-hole.md, session_2026-06-24_sidecoach-option-B-convergence-PLAN.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Builder teammate "sidestripe", Task #5. Investigate-first (blast radius reported to lead before committing), then implemented; ORPHAN path chosen (lead's first-listed option).

## What + Why
The one-engine audit found a11y.color-contrast was the live path's ONLY contrast rule but was collector-backed + inconclusive/non-required, so the rendered scanner's low-contrast finding (40 frozen-90 TP, recall 1.0 / precision 0.889 = biggest objective class) had NO live consumer - eval-only. This is the "green eval is not a shipped feature" failure the mission exists to fix. Closed it by re-pointing a11y.color-contrast onto the rendered scan (the SAME detector the eval scores), mirroring its gray-on-color sibling.

## How (4 source files)
- `validator-generation.ts`: moved 'a11y.color-contrast' from BROWSER_BACKED_RULE_IDS to RENDERED_BACKED_RULE_IDS. The --check gate enforces rendered rules declare only ['rendered-scan'].
- `product-rule-registry.ts`: a11y.color-contrast evidenceRequirements ['contrast']->['rendered-scan'], supportedSourceKinds -> supportedKindsFor('rendered-scan'). Kept severity blocker, registryScope 'contrast-floor', aliases (polish-standard:20). Now promoted-required on renderUrl (activateRenderedPolicy), inconclusive when no scan (fail-closed) - exactly like gray-on-color.
- `validators/checks/rendered-checks.ts`: added checkLowContrast (mirror checkGrayOnColor, filter objective 'low-contrast'); RENDERED_CHECKS['a11y/color-contrast'] = checkLowContrast.
- `validators/checks/a11y-checks.ts`: removed checkColorContrast + its A11Y_CHECKS entry (no other importers; avoids a duplicate CHECKS key now that RENDERED_CHECKS owns it).
- The collector contrast probe is ORPHANED (not deleted): browser-evidence-collector still measures + emits the 'contrast' kind, but no live rule reads ctx.contrast. Lower-risk, reversible; collector still produces computed-style/dom.

## DETECTION-PRESERVING (the gate)
eval/sidecoach-scan.mjs:52-53 imports objective-rendered-scanner DIRECTLY and calls scanObjectiveRendered - it never touches the registry. So re-pointing the registry rule changes ONLY the live path; frozen-90 numbers are UNCHANGED. Generation verified: static-a11y browserRuleIds=['a11y.min-hit-area'], renderedRuleIds now includes 'a11y.color-contrast'.

## Tests updated (the old collector wiring) - 9 files
a11y-checks (color-contrast no longer in A11Y_CHECKS), generate-validators (browserRuleIds->renderedRuleIds), browser-evidence-rules (dropped from collector keys + trusted-contrast blocks), product-rule-registry (static-a11y snapshot row ['contrast']->['rendered-scan'] + comment + non-static assertion), lane-render-url (BROWSER_RULES), product-validator-pipeline (dropped from collector-promote loop), browser-evidence-contrast (decoupled from color-contrast; keeps the collector measurement-gate assertions), browser-evidence-collector (dropped the rule-consumption assertion; keeps collector measurement), rendered-scan-integration (ADDED: low-contrast surfaces live -> color-contrast fail+promoted+blocks; + color-contrast in the clean-pass loop = the behavioral proof).

## Verification (ALL GREEN)
- `npm run build`: generate-validators + --check + tsc CLEAN (no drift). Confirmed static-a11y browserRuleIds=['a11y.min-hit-area'], renderedRuleIds includes 'a11y.color-contrast'.
- `npm test`: 64 suites passed, 0 failed (COMBINED tree - my low-contrast wiring + buzzword's marketing-buzzword). Golden RULES count stays 59 (re-point, not removal); static-a11y owns 7.
- BEHAVIORAL SMOKE (both states proven, lead's guardrails, rendered-scan-integration via the scanRenderedLive deps seam):
  (a) renderUrl + low-contrast finding -> a11y.color-contrast REQUIRED FAIL carrying the selector + blocks clean (case 1b). PASS.
  (b) no renderUrl -> a11y.color-contrast inconclusive + NON-required (dormant, no live regression on non-rendering flows) (case 4). PASS.
- EVAL-UNCHANGED: objective-rendered-scanner.ts AND eval/sidecoach-scan.mjs are git-UNTOUCHED. One-page smoke `node eval/sidecoach-scan.mjs clerk.html objective` = 26 low-contrast findings via the scanner directly (registry-independent). Zero eval numbers change.
- gray-on-color kept SEPARATE (distinct class, no double-count).
- HANDOFF: handed to lead for the Codex adversarial review (producer != certifier). Did NOT commit (lead commits after Codex + milestone). Future cleanup noted: the orphaned collector contrast probe (browser-evidence-collector still emits the unconsumed 'contrast' kind) can be removed later if desired.

## CODEX P1 FOLD (live double-count) - 2026-06-25
Codex cross-model review found one real issue: objective-rendered-scanner.ts:277-282 emits 'low-contrast' AND 'gray-on-color' for the SAME element (same selector; gray-on-color is a documented PRODUCT SUBTYPE of low-contrast). Pre-migration only a11y.gray-on-color consumed its finding live; post-migration a11y.color-contrast also consumes low-contrast, so a gray-on-color element tripped BOTH live rules = one defect double-reported/double-blocked.
FIX (LIVE-PATH-ONLY, scanner untouched = eval still frozen): checkLowContrast now suppresses low-contrast hits whose selector is ALSO a gray-on-color hit in the same scan (the subtype wins); a11y.color-contrast fires only on PURE low-contrast. Selector-less low-contrast hits are kept (never silently drop a real defect). Verified: scanner emits both via the same add(rule, el) -> identical sel(el), so selector-equality dedup is sound.
TEST: rendered-scan-integration case 1c - a gray-on-color element (low-contrast + gray-on-color on 'p.gray') + a pure low-contrast element ('p.pure') -> a11y.gray-on-color fails on p.gray; a11y.color-contrast fails on p.pure ONLY, does NOT include p.gray.
RE-VERIFY (ALL GREEN): integration test green standalone; full `npm run build` clean (--check no drift) + `npm test` 64 suites passed / 0 failed; both smoke states (renderUrl->required-fail, no-url->dormant) + case-1c de-dup all hold; eval-unchanged still holds (objective-rendered-scanner.ts untouched - only rendered-checks.ts live file changed). Re-handed to lead.

## Files touched
- src/validator-generation.ts, src/product-rule-registry.ts, src/validators/checks/rendered-checks.ts, src/validators/checks/a11y-checks.ts
- src/__tests__/{a11y-checks,generate-validators,browser-evidence-rules,product-rule-registry,lane-render-url,product-validator-pipeline,browser-evidence-contrast,browser-evidence-collector,rendered-scan-integration}.test.ts
- (regenerated src/validators.generated.ts via build)
