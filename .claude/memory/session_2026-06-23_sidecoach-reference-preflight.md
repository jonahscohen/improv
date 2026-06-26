---
name: Sidecoach reference integration - Deliverable B (auto-inject reference preflight) + Codex folds
description: Build/refinement lanes auto-query all 5 reference systems at lane start regardless of verb; plus production enrichContextForHandler fix so flowC actually fires
type: project
relates_to: [session_2026-06-23_sidecoach-reference-routing.md, session_2026-06-23_sidecoach-reference-integration-plan.md, session_2026-06-23_codex-review-mandated-protocol.md]
---

Collaborator: Jonah Cohen

Deliverable B of the "make Sidecoach reference systems fire more aggressively" task: any build/refinement lane auto-queries the reference systems at lane START and injects results as artifacts, REGARDLESS of which verbs the chain routes. Additive + soft-fail. Plus the Codex-review folds, including a real production bug Codex surfaced.

## What changed
- NEW `sidecoach/src/reference-preflight-artifacts.ts`: `gatherReferencePreflightArtifacts({projectPath, register, target})` queries all 5 systems via the existing `ReferenceSystemPreFlight` fallback getters under `Promise.allSettled` (component patterns, font candidates, LIVE `~/.claude/design-references` matched to PRODUCT.md voice, motion easings, icon-source via `buildIconSourceArtifactContent`). Soft-fails each system to a warning; bounded by a 5s timeout so it can never hang lane start. Returns `{artifacts[], warnings[]}`.
- `sidecoach/src/lane-types.ts`: added optional `referencePreflight?: {artifacts; warnings}` to `LaneStepResult` (optional -> existing callers/tests unaffected).
- `sidecoach/src/sidecoach-orchestrator.ts`: `startLane` calls the gatherer for build/refinement lanes (`REFERENCE_PREFLIGHT_LANES` = all 6 lanes) and attaches the bundle, wrapped in try/catch (never blocks lane start). Fires at lane START before verb routing -> "regardless of verb".
- `sidecoach/src/phase3-reference-integration-test.ts`: EXTENDED with a preflight-bundle test (asserts >=4 artifact kinds incl component/fonts/motion/icon-source; asserts soft-fail on a bogus path returns a bundle, no throw).

## Why this is structured this way
- A dedicated consumer module (`reference-preflight-artifacts.ts`) keeps `reference-system-preflight.ts` factory-injected and free of concrete composition imports (ReferenceSystemsFactoryImpl, context-loader, icon-source-reference) - removes the import-cycle hazard Codex flagged.

## Codex cross-model review (rule #8) - run via `codex exec review`, ALL findings folded
1. HIGH (hang): preflight awaited with no timeout -> added a 5s `Promise.race` bound returning the partial bundle + warning.
2. MEDIUM (real production bug): `enrichContextForHandler` set `product: { content }` and DISCARDED the structured product, so `product.brandPersonality` was undefined in production - SIX handlers gate on it (flowC font, flowB component, flowE motion, copywriting, motion-integration, brand-verify). flowC would have degraded to needs_input in production even after routing. Fix: enrich the structured `loaded.product` (with brandPersonality), keeping `content` for any raw reader. `sidecoach/src/sidecoach-orchestrator.ts` enrichContextForHandler.
3. MEDIUM (import cycle): no actual cycle today, but extracted the gatherer to its own module (above) to remove the structural hazard.
4. LOW (proof overstatement): harness rewritten to DERIVE projectContext from the seeded PRODUCT.md via `buildProjectContext` (same loader production uses) instead of hardcoding it - proving flowC fires from real PRODUCT.md parsing, not an injected object.

## Proof (before/after, current harness, baseline-via-git-stash vs final)
- ROUTING all false -> true (also covers deliverable A).
- FIRING: craft step gained flowC_font_research + flowD_reference_inspiration; `flowC_font_research success artifacts=1 [Font Candidates]`, `flowD_reference_inspiration success`. flowC fires because brandPersonality "clean, editorial, precise" was parsed from PRODUCT.md (production-faithful).
- PREFLIGHT: `referencePreflight: ABSENT` -> 4 artifacts [component, fonts, motion, icon-source] + 1 honest warning (live design-references catalog had no entry matching the temp project's voice; on a real project with matching entries the design-references artifact surfaces too).

## Gates
`npm run build` exit 0; `npm test` = 56/56 suites; extended phase3 integration test passes (>=4 kinds + soft-fail). Constraint D verified: standalone skills under ~/.claude/skills/{component-gallery-reference,fontshare-reference,design-references,motion-reference,icon-source} untouched (mtimes unchanged, no repo changes).

## Note (pre-existing, not in scope)
`buildProjectContext().register` returns `[]` (empty array, truthy) rather than a string - a pre-existing quirk. flowD's `!!register` check passes on it; my change did not touch register. Flagged for a future cleanup, not addressed here.

## Files touched
- sidecoach/src/reference-preflight-artifacts.ts (new)
- sidecoach/src/reference-system-preflight.ts (gatherer reverted out - factory-injected again)
- sidecoach/src/lane-types.ts
- sidecoach/src/sidecoach-orchestrator.ts (preflight wiring + enrichContextForHandler product fix)
- sidecoach/src/phase3-reference-integration-test.ts
- sidecoach/scripts/prove-references-fire.ts (production-faithful harness)
- sidecoach/src/lanes.generated.ts, LANES.generated.md, dist/* (regenerated/build output)
