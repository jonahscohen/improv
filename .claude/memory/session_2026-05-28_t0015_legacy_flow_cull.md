---
name: T-0015 legacy flow cull complete
description: 38 flows -> 26 flows. 12 legacy duplicates removed, 2 unique flows renamed (flow4 -> flowY, flow7 -> flowZ). Tests + tsc clean.
type: project
relates_to: [session_2026-05-28_t0010_cheatsheet.md, session_2026-05-28_t0013_bench_harness.md, session_2026-05-28_t0012_model_routing.md]
---

# T-0015 legacy flow cull complete (Jonah, 2026-05-28)

Surgical cull of the 14 number-prefixed legacy flows that survived from an earlier sidecoach iteration. The cheatsheet (T-0010) had to document all 38 honestly, inflating the registry; the cull brings the canonical flow count down to a clean 26.

## Per-flow classification table

| Legacy ID | Action | Canonical / New ID | Why |
|---|---|---|---|
| `flow1_clone_match` | DUPLICATE | `flowO_clone_match_special` | flowO is the "_special" refinement of flow1's pixel-perfect replication scope. |
| `flow2_polish_enhance` | DUPLICATE | `flowJ_tactical_polish` | flowJ absorbs the feel/animation/microinteraction matchers; flowH handles motion-specific work. |
| `flow3_audit_page` | DUPLICATE | `flowK_multi_lens_audit` | flowK is the 5-dimension technical audit; flow3's "report only" framing collapses into it. |
| `flow4_explore_discovery` | RENAME | `flowY_explore_discovery` | Unique - the only "no success criteria, generate ideas" flow. flowN is goal-driven iteration. |
| `flow5_review_qa` | DUPLICATE | `flowK_multi_lens_audit` | Same technical scan, with the fix-intent overlap handled by chaining flowL critique. |
| `flow6_constraint_design` | DUPLICATE | `flowP_constraint_design_special` | flowP is the "_special" refinement of flow6's constraint-based design scope. |
| `flow7_design_component` | RENAME | `flowZ_design_component` | Unique - "design from scratch" is distinct from flowG (implement-from-design) and flowO (clone-exactly). |
| `flow8_refactor_layout` | DUPLICATE | `flowR_layout_optimization` | flowR is the layout/spacing/rhythm canonical; absorbed cluttered/restructure/refactor-without-api matchers. |
| `flow9_accessible` | DUPLICATE | `flowI_accessibility` | flowI's own description literally said "same as flow9". |
| `flow10_implement_design` | DUPLICATE | `flowG_component_implementation` | flowG's own description literally said "replaces flow10". |
| `flow11_extract_tokens` | DUPLICATE | `flowF_design_tokens` | flowF is the full DESIGN.md workflow including token extraction. |
| `flow12_responsive_review` | DUPLICATE | `flowM_responsive_validation` | Same breakpoint validation, flowM adds the 40x40 touch-target check. |
| `flow13_rapid_iteration` | DUPLICATE | `flowN_rapid_iteration_refined` | flowN is the "_refined" goal-driven iteration with success criteria. |
| `flow14_migration` | DUPLICATE | `flowQ_migration_special` | flowQ is the "_special" refinement of flow14's API-migration scope. |

**Before:** 38 flows registered.
**After:** 26 flows (24 lettered A-X + 2 renamed Y, Z).

## Why this matters

- **T-0010 cheatsheet** had to honestly list all 38 flows including the legacy duplicates, padding the registry. The cheatsheet now reflects 24 lettered + 2 Y/Z entries.
- **T-0013 benchmark** runs flowJ/K/L only - unaffected by the cull (BENCH_FLOWS constant uses only lettered IDs already).
- **T-0012 model-routing** had 38 FLOW_MODELS entries; now has 26. Distribution: still 6 Haiku, 15 Sonnet, 5 Opus.
- **T-0009 retry-control** invariants preserved - 52/52 still pass.

## How the surgery propagated

Files touched (16 source + 4 test + 3 docs + 1 task):

Source files (sidecoach/src/):
- `flows.ts` - rewrote registry. 12 legacy entries removed, 2 renamed (flow4 -> flowY, flow7 -> flowZ). Their `patterns` and `intentMarkers` were folded into the matching canonical entry's trigger arrays so existing user phrasings still resolve.
- `types.ts` - FlowId union: removed 14 legacy IDs, added flowY/flowZ.
- `sidecoach-orchestrator.ts` - handler imports + handler map + `HTML_PRODUCING_FLOWS` set + `getAvailableFlows` list.
- `flow-handlers-core.ts` - Flow2/Flow5/Flow10 handler classes deleted; Flow7DesignHandler renamed to FlowZDesignHandler.
- `flow-handlers-extended.ts` - Flow1/Flow3/Flow6/Flow8/Flow9/Flow11/Flow12/Flow13/Flow14 handler classes deleted; Flow4ExploreHandler renamed to FlowYExploreHandler.
- `intent-detector.ts` - 14 `createFlowN*Detector()` methods replaced with `createFlowYDetector()` + `createFlowZDetector()`. The lettered detectors (J, K, R, Q, G in particular) were extended to absorb the keyword matchers from their legacy counterparts so existing test utterances still route correctly.
- `model-routing.ts` - FLOW_MODELS: 14 legacy entries removed, flowY/flowZ added.
- `flow-prerequisites.ts` - FLOW_DEPENDENCIES: same.
- `flow-handler.ts` - name map: same.
- `slash-command-router.ts` - SLASH_COMMANDS: legacy IDs stripped from each verb's flow chain.

Test files:
- `intent-detector.test.ts` - 8 test expectations updated to use canonical lettered IDs.
- `__tests__/t12-model-routing.test.ts` - `allFlowIds` array slimmed from 38 to 26.
- `__tests__/sprint5-disambiguation-silent-tiebreak.test.ts` - flow11 replaced with flowS as synthetic disambiguation candidate.
- `__tests__/orchestrator-slash-command.test.ts` - implementFlows array stripped of flow9/flow10/flow11.

Docs:
- `claude/skills/sidecoach/SKILL.md` - "36 flows" updated to "26 flows" with T-0015 note.
- `claude/skills/sidecoach/CHEATSHEET.md` - the Legacy flows table replaced with a Tier 7 table listing only flowY/flowZ.
- `marketing-site/cheatsheet.html` - same Tier 7 swap in the marketing surface.

Tasks:
- `TASKS.md` - T-0015 filed and marked [x] DONE.

## Test pass results

```
t9-retry-control: 52/52 passed
t12-model-routing: 54/54 passed
t13-bench-harness: 46/46 passed
intent-detector: 8/8 passed (100%)
sprint3-process-path: PASS
sprint5-disambiguation-silent-tiebreak: PASS
orchestrator-slash-command: PASS
npx tsc --noEmit: clean (only pre-existing T-0016 rootDir warnings unrelated to T-0015)
```

## Why I made the keep-or-cull calls the way I did

The framing in the task ticket suggested some of the 14 legacy flows might be "dead code" or "genuinely separate flows that just need renaming." Audit found:

- Zero were dead - every handler had real checklist content and was wired into the registry, intent-detector, model-routing, prerequisites, and slash-command-router.
- Twelve were duplicates - either explicitly self-identified (flowI "same as flow9"; flowG "replaces flow10"), or sharing the same scope under a "_special" / "_refined" suffix (flow1 vs flowO; flow6 vs flowP; flow13 vs flowN), or filling overlapping verb chains with no meaningful behavioral delta (flow8 vs flowR; flow11 vs flowF; flow12 vs flowM).
- Two were genuinely unique: flow4 (open-ended exploration with no success criteria, distinct from flowN's goal-driven iteration) and flow7 (design new component from scratch, distinct from flowG implement-from-design and flowO clone-exactly).

Picking flowY and flowZ for the renames preserved the letter-prefix convention without colliding with any existing letter.

## Why I extended several lettered detectors

The legacy detectors had specific matchers that the lettered counterparts didn't fully cover (e.g. `flow8` matched "cluttered" and bare "refactor"; `flowR` didn't). Without these absorptions, the 8 existing intent-detector test cases would have lost coverage. Conservative extensions to flowG (build-from-source), flowJ (feel/animation/janky/life with layout-exclusion), flowQ (refactor+api carve-out for migrations), and flowR (cluttered/restructure/refactor-without-api) restored full test coverage while keeping the detectors mutually exclusive.

## Files touched

- sidecoach/src/flows.ts
- sidecoach/src/types.ts
- sidecoach/src/sidecoach-orchestrator.ts
- sidecoach/src/flow-handlers-core.ts
- sidecoach/src/flow-handlers-extended.ts
- sidecoach/src/intent-detector.ts
- sidecoach/src/intent-detector.test.ts
- sidecoach/src/model-routing.ts
- sidecoach/src/flow-prerequisites.ts
- sidecoach/src/flow-handler.ts
- sidecoach/src/slash-command-router.ts
- sidecoach/src/__tests__/t12-model-routing.test.ts
- sidecoach/src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts
- sidecoach/src/__tests__/orchestrator-slash-command.test.ts
- claude/skills/sidecoach/SKILL.md
- claude/skills/sidecoach/CHEATSHEET.md
- marketing-site/cheatsheet.html
- TASKS.md
- .claude/memory/session_2026-05-28_t0015_legacy_flow_cull.md (this beat)
- .claude/memory/MEMORY.md (index entry)
