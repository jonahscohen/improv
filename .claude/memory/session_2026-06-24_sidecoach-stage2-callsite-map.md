---
name: sidecoach-stage2-callsite-map
description: Accurate Stage-2 call-site map (corrects the PLAN's "12" to ~22 sites across 17 flow-handlers) + the material discovery that these validateAll calls produce a pass-rate CHECKLIST model, not the registry's clean-policy GATE - so the migration is a semantic bridge, not a mechanical find-replace. Designed BEFORE building, pending Codex review.
type: project
relates_to: [session_2026-06-24_sidecoach-option-B-convergence-PLAN.md, session_2026-06-24_sidecoach-stage1-codex-impl-fold.md]
---

Collaborator: Jonah Cohen. Stage 1 DONE + verified ([[session_2026-06-24_sidecoach-stage1-codex-impl-fold]]). Mapping Stage 2 (migrate static validateAll -> registry runValidator). Mapped directly via grep (the stage2-mapper teammate is read-only + its detailed relay dropped; its high-level summary corroborated). 

## SCOPE CORRECTION: ~22 call sites, not 12 (PLAN undercount)
- **1x** `PolishStandardValidator.validateAll(domainCheckContext)` - flow-handler-tactical-polish.ts:211
- **18x** `ExtendedDomainValidator.validateAll(domainCheckContext)` - IDENTICAL pattern (`const extendedValidationReport = ExtendedDomainValidator.validateAll(domainCheckContext)`) across: constraint-design:31, component-implementation:98, motion-patterns:163, tactical-polish:212, layout-optimization:33, design-references:120, accessibility:202, font-research:84, typography-excellence:32, ambitious-motion:31, motion-integration:175, component-research:128, clone-match:30, migration:31, design-tokens:198, all-seven-qa:37
- **3x** `new AntiPatternValidator()` - flow-handlers-tier3-tier4.ts:200, 470, 607
- (anti-pattern-validator.ts:287 `return new AntiPatternValidator()` is the FACTORY, not a consumer - exclude.)
GOOD NEWS: the 18 Extended sites are uniform (one migration pattern fits all). The PLAN's "x9" / "12 total" was an undercount; real total ~22 across 17 flow-handler files.

## MATERIAL DISCOVERY: checklist model != clean-policy gate (the real impedance)
The validateAll calls do NOT feed a hard gate. At tactical-polish.ts:214-218 the flow reads `polishReport.totalRules/.passed/.violations` + `extendedReport.{totalRules,passed,violations}`, sums them, and computes `combinedPassRate = (totalPassed/totalRules)*100` - a PERCENTAGE shown in a human-readable CHECKLIST (createChecklist, ~245-266). The output model is **aggregate score + checklist lines**.
runValidator returns a **ProductValidationResult**: per-rule four-status (pass/fail/inconclusive/n-a) + clean-policy verdict (clean/blocked) + coverage. A different model entirely.
=> Stage 2 is a SEMANTIC BRIDGE, not a find-replace. A naive swap would replace the per-flow pass-rate checklist (what users see across 17 handlers) with a clean/blocked gate - a user-facing behavior change. The migration must EITHER (a) derive the existing checklist/passRate FROM the ProductValidationResult (preserve the display), or (b) deliberately change the output model (needs a decision). This is exactly what the Codex adversarial design review must pressure-test before any build.

## Validator classes (from the mapper summary, to verify at design time)
- PolishStandardValidator: 24 rules, returns PolishValidationReport {totalRules, passed, violations, ...}.
- ExtendedDomainValidator: 112 rules (90 domain + 22 polish dups), returns DomainValidationReport {totalRules, passed, violations, violationsByDomain}.
- AntiPatternValidator: 27 patterns, returns ValidationResult {score 0-100, ...}.
Registry RULES = 36 (incl Stage-1 rendered). OVERLAP: the 22 polish dups in Extended already map to registry polish rules; the 90 domain extensions (forms/gesture/animation/viz/i18n) are the Stage-3 absorb/retire target. So Stage 2 (route through runValidator) and Stage 3 (absorb ExtendedDomainValidator) are coupled - Stage 2 may only be a CLEAN migration for the rules the registry already covers; the 90 domain rules have no registry home YET.

## Tests to preserve (C)
validator-integration.test.ts (testPolishStandardValidator ~85, testExtendedDomainValidator ~120, testCombinedValidation ~187-188), sprint7-polish-validator-result.test.ts (~8-9, 28, 47, 65). The migration must keep these green or update them faithfully to a preserved-behavior contract.

## OPEN QUESTION for the design (surface to Jonah / Codex)
Because Stage 2 (route to runValidator) and Stage 3 (absorb the 90 ExtendedDomainValidator domain rules into the registry) are coupled - the registry can't yet produce findings for the 90 domain rules - a clean Stage-2 migration of the Extended sites may REQUIRE Stage-3's absorption first, OR Stage 2 must keep ExtendedDomainValidator alive as a runValidator-wrapped step until Stage 3 retires it. Sequencing decision needed. Leaning: re-sequence so Stage 2 migrates only what the registry covers + wraps the rest, with the checklist display derived from the merged result (display-preserving).

## CONSUMPTION HETEROGENEITY (stage2-mapper full analysis, 2026-06-24) - reshapes the scope
The 19 sites CALL validateAll uniformly but CONSUME results HETEROGENEOUSLY (detail: scratchpad/stage2-consumption-map.md):
- tactical-polish (SITE 1+2): simple totalRules/passed/violations sum -> combinedPassRate%.
- motion sites (ambitious-motion, motion-patterns, motion-integration): read `violationsByDomain['motion']` / `passRateByDomain['motion']`, filter MOTION_*/MOTION_GESTURE_*.
- all-seven-qa: `passRateByDomain` across 7 domains -> scorecard.
- accessibility/font/typography/layout/design-tokens/design-references: filter by domain or rule-id prefix (TYPO_*, SPACE_*, RESPOND_*, color domain).
- AntiPattern (tier3-tier4 x3): validateBatch/validateCSS -> per-file {score 0-100, violations[]}, filter by patternName, gate on avgScore/totalScore thresholds.
KEY: these reads (`violationsByDomain`, `passRateByDomain`, rule-id-prefix filters) come from the 90 ExtendedDomainValidator DOMAIN rules that have NO registry home (Stage 3's target) and ProductValidationResult has NO per-domain breakdown. So a wrap-then-retire facade that keeps ExtendedDomainValidator intact and only swaps the call site leaves flows still reading its domain breakdowns => the "migration" is largely INDIRECTION; the real convergence for these 18 flows IS Stage 3.
=> OPEN to Codex (sharpened question 2): is wrap-then-retire meaningful Stage 2, or should Stage 2 be RESCOPED to migrate only registry-covered sites (polish/anti-pattern overlap) and explicitly DEFER the 18 domain-breakdown sites to Stage 3? Codex design review in flight with this grounding.
CAVEAT: mapper is an Explore agent; some consumption specifics (gate thresholds, exact domain reads) are inferential - VERIFY against real flow-handler code at build time.

## NEXT
Await Codex's Stage-2 design verdict (meaningful vs rescope) -> fold -> build the chosen scope -> verify. Per the loop.
