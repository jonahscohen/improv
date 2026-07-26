---
name: Routing consolidation - removed the last TRUE-duplicate router (flow-conditional-router, dead 3rd keyword mapper)
description: Mapped the live routing landscape at HEAD ba60fe33, found flow-conditional-router.ts was the sole remaining true-duplicate routing implementation (a dead third utterance-keyword->flow mapper, never called in the live dispatch), and removed it + its 2 dead orchestrator wrappers + its orphan-test coupling. Pure 377-line deletion, behavior-identical. Gate 88->88 (no drop), build clean, routing-snapshot golden green.
type: project
relates_to: [session_2026-07-24_simplification-plan.md, session_2026-07-24_simplification-phase1-deadcode.md, session_2026-07-24_simplification-phase2-deadcode.md, session_2026-07-24_vocab-collapse-phase-aliases.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: build clean + npm test 88 suites green (baseline 88, no drop) + routing-snapshot golden green; independent Codex (gpt-5.5, read-only) review DONE - no critical/high in src, 1 Medium re stale committed dist/ handed to lead
confidence: high
---

# Routing consolidation (mission-primary GAP3, verified increment)

Executes the still-open "6+ routing implementations" consolidation flagged by the
simplification audit. Prior waves already removed the 4 DEAD routers
(sidecoach-entry-point, command-routing-adapter, sidecoach-command,
mcp-server keyword-resolver) and collapsed the vocabulary into PHASE_ALIASES. This
increment removes the LAST remaining true-duplicate routing implementation.

Baseline probed FIRST at HEAD `ba60fe33`: `npm run build` clean, `run-tests: 88 suite(s) passed`.

## The routing landscape (enumerated with file:line evidence, deeper than the plan's static count)

SOURCE OF TRUTH
- **VERB_REGISTRY** (`verb-command-registry.ts:40`) - 21 verbs -> flowIds. Canonical. `getVerbEntry`/`getVerbList`.

LIVE resolution pipeline inside `FlowExecutionEngine.process()` (sidecoach-orchestrator.ts) - LAYERED by input shape, NOT duplicated:
- **parseSlashCommand** (`slash-command-router.ts:72`) - typed commands: verbs FIRST (getVerbEntry), then PHASE_ALIASES back-compat. Called at orchestrator L715.
- **resolveSidecoachInput/resolveSidecoachPhrase** (`slash-command-router.ts:365,402`) - `/sidecoach <phrase>` via the lane classifier. Called at orchestrator L1128.
- **IntentDetector.detect** (`intent-detector.ts:60`) - the NL tier: 27 hand-written `createFlow*Detector()` keyword-scoring detectors. Called at orchestrator L1178.

SUPPORTING (legitimately distinct, kept):
- **lane-classifier.ts** (`evaluateLane`/`loadRegistry`) - lane scoring engine; has a parity-tested Python twin (`claude/hooks/sidecoach_lanes.py`), cannot be merged (cross-language).
- **lane-derivation.ts** - build-time derivation of lane flow-sequences FROM VERB_REGISTRY (pure helper; used by validator-generation + generate-lanes). Not a router.
- **orchestrator.ts** (`SidecoachOrchestrator`, imported as `IntelligentOrchestrator`) - flow DEPENDENCY GRAPH + phase detection + next-flow recommendation. Live (orchestrator L1551 `getNextRecommendedFlow`; also used by intent-detector for prereq validation). A sequencing advisor, NOT command routing.
- **bin/sidecoach.js** (CLI) - thin resolver; routes through `parseSlashCommand` + `VERB_REGISTRY` (L327). NO parallel mapping (its own header says so). Verified clean - not a duplicate.

THE TRUE DUPLICATE (removed):
- **flow-conditional-router.ts** (`FlowConditionalRouter`) - a THIRD utterance-keyword->flow mapper (`determineRoute`: `utterance.includes('brand')`->flowA, `'font'`->flowC, ...) plus project-state/prereq conditions + `buildConditionalRoutes`. **DEAD in the live dispatch**: its only orchestrator consumers were two PRIVATE methods `determineConditionalFlow` (was orchestrator L658) and `getExecutablePath` (was L663) that were THEMSELVES never called anywhere (grep-proven: only their own defs). The sole other reference was `phase-iii-integration.test.ts` - a never-run orphan (NOT in scripts/run-tests.ts; uses an ambient `declare`d describe/test/expect with no jest installed, so it can only compile, never execute).

The Python hook (`sidecoach_lanes.py`) is the classifier's cross-language twin; out of scope (parity-maintained, cannot dedupe into TS).

## What I consolidated

Removed the dead duplicate keyword router, output-identically:
- **DELETED** `src/flow-conditional-router.ts` (-273 lines, whole `FlowConditionalRouter` class + `determineConditionalFlow`/`getExecutablePath` free fns).
- **sidecoach-orchestrator.ts** (-11): removed the `import { FlowConditionalRouter }` (L67) + the two dead private wrapper methods (`determineConditionalFlow`, `getExecutablePath`) that fronted it.
- **phase-iii-integration.test.ts** (-93): removed ONLY the FlowConditionalRouter coupling (the import + the `describe('Conditional Flow Routing')` block + the `test('Conditional routing performance')` benchmark). Left the orphan test's other blocks (FlowSpecificValidator/FlowMetricsTracker/FlowHandlerCache) intact - test-tree triage is the plan's separate Step 6, not this task.

Diff = **377 deletions, 0 insertions** across 3 files. A pure dead-code dedup.

## LEAD INTEGRATION (2026-07-26)
Re-verified on integration: rebuilt dist over the refactor (npm run build clean - this handles Codex's one Medium, the stale committed dist), re-ran the gate independently = 88 suites no-drop. Committed. The "6+ routing implementations" alarm is effectively CLOSED: the map proves the live pipeline is legitimately layered (one resolver per input shape), not duplicated; flow-conditional-router was the sole true dead duplicate and it is gone.

## Before/after implementation count

- Competing utterance->flow KEYWORD mappers: **2 -> 1** (was IntentDetector [live] + FlowConditionalRouter [dead-but-compiled]; now IntentDetector only).
- Total routing/command-resolution modules in src/: **9 -> 8** (removed flow-conditional-router; the remaining 8 are the source-of-truth + a legitimately layered pipeline + distinct supporting modules, per the map above).
- The live resolution path is now unambiguous: typed (parseSlashCommand/VERB_REGISTRY) -> phrase (lane classifier) -> NL (IntentDetector). One resolver per input shape, no dead competitor.

## Verification gate

- **Build**: `npm run build` clean (tsc 0 + generate-lanes/generate-lanes-data --check + generate-validators --check + generate-counter-rules --check all OK, NO drift). tsc's `include:["src/**/*"]` would have failed loudly on any dangling reference - it did not.
- **Tests**: `npx ts-node scripts/run-tests.ts` -> **88 suite(s) passed, 0 failed, exit 0**. Baseline was 88; count did NOT drop (removing an orphan test that was never in the gate cannot change the gate count).
- **Behavior unchanged**: `eval/migration-harness/routing-snapshot.mjs verify` (a gate suite among the 88) passed - flow routing goldens byte-identical. Dead-code removal cannot change output; the golden confirms it.
- **src/*.generated.ts**: zero drift (the deleted router is not an input to lane/validator/counter-rule generation).
- **Codex (independent cross-model review - real `codex exec` 0.142.5, model gpt-5.5, xhigh, --sandbox read-only)**: **No critical/high findings in src/.** Independently RE-DERIVED (not trusted) all four correctness claims: (1) FlowConditionalRouter was dead in the live path - its own `rg` across src/ finds ZERO remaining refs to FlowConditionalRouter/determineConditionalFlow/getExecutablePath/determineRoute/buildConditionalRoutes/ExecutionCondition/ConditionalFlowRoute; (2) no dangling import - `tsc --noEmit` passes; (3) routing behavior source-output-identical (process() still: parseSlashCommand@704 -> exec commandMatch.flowIds@924 -> resolveSidecoachInput@1118 -> intentDetector.detect@1168; parseSlashCommand uses VERB_REGISTRY-first then PHASE_ALIASES); (4) phase-iii-integration.test.ts brace-balanced, remaining validator/metrics/cache/benchmark/e2e blocks intact.
  - **ONE Medium (FOLDED as a lead-integration instruction, NOT a src change)**: the compiled `dist/flow-conditional-router.{js,d.ts,js.map,d.ts.map}` are still git-tracked and still export the dead router; package.json ships `dist/` (`files:["dist/"]`), so a stale committed dist would leave the compiled duplicate reachable to package consumers even though the source is deleted. `tsc` does NOT prune orphaned outputs, so a plain rebuild will NOT remove them. This is a `dist/` action, explicitly reserved to the lead (task boundary: "do NOT touch dist/"). **Lead integration MUST run: `git rm sidecoach/dist/flow-conditional-router.js sidecoach/dist/flow-conditional-router.d.ts sidecoach/dist/flow-conditional-router.js.map sidecoach/dist/flow-conditional-router.d.ts.map`** after the rebuild, or the dedup is incomplete at the package level. Did NOT execute it here (boundary), surfaced it as the one required integration step.

## Remaining plan (further consolidation - riskier / product calls, NOT done here)

Honest partial-with-plan. The pipeline is now clean; deeper collapses trade real risk and are lead/Jonah calls:
1. **Orphan-test triage (plan Step 6)** - `phase-iii-integration.test.ts` still cannot run (no jest) and now covers only 3 modules by compile-check. Either delete it or wire a runnable harness. Low risk, but it is test-tree triage, a distinct objective.
2. **IntentDetector keyword vocab vs VERB_REGISTRY** - the 27 NL detectors hard-code keyword lists independent of the registry. Unifying them (deriving NL hints from registry metadata) would collapse the last hand-maintained keyword surface, but it is a behavior-affecting redesign (NL scoring thresholds are calibrated), not a dedup - needs its own calibration + A-gate. Do NOT fold blindly.
3. **Classifier TS/Python twin** - irreducible floor (cross-language); leave parity-maintained.

## Constraints honored
- Did NOT touch scripts/run-tests.ts or dist/ (lead owns integration; the build regenerated dist/ locally but it is NOT committed).
- Did NOT commit.

## Files touched
- src/flow-conditional-router.ts (DELETED)
- src/sidecoach-orchestrator.ts (removed import + 2 dead private methods)
- src/phase-iii-integration.test.ts (removed FlowConditionalRouter import + 2 test blocks)
- .claude/memory/session_2026-07-25_routing-consolidation.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
