---
name: sidecoach-stage1-built
description: Stage-1 convergence IMPLEMENTED (rendered scanner wired into the live run-validator path as registry rules). tsc clean, codegen+--check clean, golden green. Full-suite detection-preserving gate running. Records exactly what was built across 11 files.
type: project
relates_to: [session_2026-06-24_sidecoach-stage1-design-folded.md, session_2026-06-24_sidecoach-stage1-integration-surface.md]
---

Collaborator: Jonah Cohen. Built the folded Stage-1 design ([[session_2026-06-24_sidecoach-stage1-design-folded]]). Status at write time: tsc --noEmit clean, generate-validators --check clean (registry valid, no drift), golden product-rule-registry.test green (36 rules). Full `npm test` running (the detection-preserving gate).

## What was built (11 files)
1. **product-rule-types.ts** - new `'rendered-scan'` EvidenceKind + `'rendered-scanner'` SourceVocabulary + `'rendered-scan': []` in EVIDENCE_SOURCE_COMPATIBILITY (empty -> non-static -> runs via the run-validator non-static branch).
2. **validators/source-support-matrix.ts** - `'rendered-scan'` support block (browser-only shape: rendered-scan@full + tsx/html@none).
3. **validators/subjective-rendered-scanner.ts** - EXPORTED `inPageSubjective` (was module-local) so the live bridge can run it.
4. **validators/rendered-live-scan.ts (NEW)** - `scanRenderedLive(renderUrl, signal?, opts?)` -> `RenderedScanCollection {objective, subjective}`. Launches ONE browser, `page.goto(renderUrl)` (live basis: same-origin app scripts RUN), same-origin hermetic routing (reuses `isSubresourceAllowed`), WS blocked, 1280x800, reducedMotion. Runs inPageObjective + inPageSubjective in ONE page. FAIL-CLOSED (both families available:false on launch/nav error; a single detector throw fails only its family). AbortSignal-raced like browser-evidence-collector. Does NOT import eval/.
5. **validators/check-context.ts** - `ProductCheckContext.renderedScan?: RenderedScanCollection` (import type only - no playwright coupling).
6. **validators/run-validator.ts** - `ValidatorRuntimeDeps.scanRenderedLive?` seam; `toCheckContext`+`executeRule` thread `rendered`; non-static branch is evidence-aware (rendered-scan coverage keys on scan availability, browser rules unchanged); `runDetailed` awaits ONE scan after collectBrowserEvidence; new `activateRenderedPolicy(base, gen, hasRenderUrl)` promotes rendered rules to required IFF renderUrl present (the P0-3 refinement: fail-closed on attempted render, dormant when no renderUrl).
7. **validator-generation.ts** - `a11y.color-contrast` REMOVED from BROWSER_BACKED_RULE_IDS; new `RENDERED_BACKED_RULE_IDS` (6 ids) + `RENDERED_EVIDENCE_KINDS`; GeneratedValidator gains `renderedRuleIds`/`renderedCoverageByScope`; `browserCoverageRecord` renamed `evidenceKindCoverageRecord` (shared by both paths); deriveValidator derives renderedRequired; validateRegistry gains a `renderedBackedRuleIds` param + parallel allowlist validation (non-static, rendered-scan-only, not in both allowlists).
8. **scripts/generate-validators.ts** - import + pass RENDERED_BACKED_RULE_IDS; inline GeneratedValidator interface string extended.
9. **product-rule-registry.ts** - `a11y.color-contrast` re-pointed contrast -> rendered-scan; 5 NEW rules: a11y.broken-image/skipped-heading/gray-on-color/justified-text (owner static-a11y, findingClass a11y) + polish.tiny-text (owner polish-standard, findingClass polish). All evidenceRequirements ['rendered-scan'], distinct registryScope (rendered-*), vocab rendered-scanner, severities mapped to existing SEVERITY_TABLE keys (high->major, medium->minor; no overrides needed).
10. **validators/checks/rendered-checks.ts (NEW)** - 6 checks reading ctx.renderedScan (5 new + re-pointed checkColorContrast -> low-contrast finding). Fail-closed to inconclusive when family unavailable. RENDERED_CHECKS map.
11. **validators/checks/a11y-checks.ts** - removed checkColorContrast (moved to rendered-checks); **checks/index.ts** - spreads RENDERED_CHECKS.
+ **validators.generated.ts** regenerated: static-a11y renderedRuleIds=[color-contrast, broken-image, skipped-heading, gray-on-color, justified-text], polish-standard renderedRuleIds=[tiny-text].
+ **__tests__/product-rule-registry.test.ts** golden updated (re-point + 5 rows; counts 31->36, static-a11y 3->7, polish-standard 21->22).

## SUITE RESULT (first run) + DECISION: defer the color-contrast re-point
First full run: **7 suites failed, and ALL 7 were the a11y.color-contrast RE-POINT** (generate-validators, product-validator-pipeline, a11y-checks, browser-evidence-rules, browser-evidence-collector, browser-evidence-degradation, browser-evidence-contrast). The 5 NEW rendered rules broke NOTHING - lane-render-url and every renderUrl test stayed green. That clean signal means the promotion mechanism + injectable seam + no-renderUrl-dormant policy all work, and only the color-contrast MIGRATION caused churn.

**Decision: DEFER the color-contrast re-point out of Stage 1.** Reverted it (color-contrast stays collector/contrast-backed); kept the 5 new rules.
**Alternatives considered:**
- Keep the re-point + update all 7 tests to the new contract: rejected - re-pointing color-contrast is a MIGRATION of existing detection (collector engine -> rendered engine), it breaks the detection-preserving gate, and it ORPHANS the collector contrast probe (nothing else consumes ctx.contrast). That cleanup belongs in the later "retire old mechanisms" stage (3/4), not the "add new detection" Stage 1.
- Dual-source (rendered-primary, collector-fallback): rejected - muddies "one engine", complicates the AND-based evidence model (would need OR-satisfaction), and Codex's caution was about contradictory contrast sources.
**Why defer:** Stage 1's job is to ADD the oracle-beating detection that had ZERO live presence (the 5 new classes). color-contrast ALREADY had live detection; migrating its engine is a separate, deliberate unit. Codex P1-1's actual concern (no DUPLICATE low-contrast rule) is still honored - I add no duplicate; the rendered scanner's low-contrast finding simply stays eval-only until the migration stage. Net: Stage 1 = pure, detection-preserving addition. Re-running the suite to confirm green.
**Revisit when:** doing the "retire old mechanisms" stage - migrate a11y.color-contrast to rendered low-contrast, remove the orphaned collector contrast probe, and migrate the 7 contrast tests then.

## VERIFICATION (S7) - GREEN
- **Full suite: 60 suites passed** after the color-contrast revert (was 7-failed). referee-independence green.
- **Eval objective findings IDENTICAL by construction**: `git diff` on the two eval-facing scanners shows the ONLY change is `function inPageSubjective` -> `export function inPageSubjective` (objective-rendered-scanner.ts has ZERO changes). Detection logic byte-identical -> the 0.894/0.936 eval numbers cannot move. The 34 objective + 21 subjective calibration assertions pass, confirming it. (Full frozen-90 scorecard re-run is the Stage-6 gate, not Stage-1.)
- **NEW committed integration test** `src/__tests__/rendered-scan-integration.test.ts` (registered in run-tests.ts) PROVES the live wiring end-to-end via injected deterministic scanRenderedLive: (1) broken-image finding -> a11y.broken-image FAILS with selector + PROMOTED + blocks clean; (2) available scan no findings -> rendered rules PASS + covered; (3) scan unavailable + renderUrl -> required inconclusive -> blocks (fail-closed); (4) no renderUrl -> NOT promoted (dormant, baseline preserved); (5) subjective tiny-text fails via polish-standard; (6) objective/subjective family independence. PASSES.
- Re-running full suite to confirm 61 green (60 + the new integration test).

## NEXT
S8: send the diff to codex-arch-review teammate (implementation-gate review per mandate item 8) -> fold findings -> Stage 1 DONE -> Stage 2.
