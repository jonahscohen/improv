---
name: session-2026-05-25-sprint12-closed
description: Sprint 12 closed - 6 tasks (chain expansion + history reset + 3 orchestrator/loader fixes). FIRST CLEAN DOGFOOD - 8/8 flows successful on marketing-site.
type: project
relates_to: [session_2026-05-25_sprint12_design.md, session_2026-05-25_sprint12_execution.md, session_2026-05-25_sprint12_t3_dogfood_surfaces_t4_t5.md, feedback_chief_architect_autonomous_dogfood_loop.md, session_2026-05-25_sprint11_closed.md]
---

Human collaborator: Jonah. Executed autonomously per chief-architect directive.

## What Sprint 12 landed (6 tasks)

- **T1** (`8aa2bd6`): craft chain expanded 6 -> 8. Added flowB_component_research and flowE_motion_patterns in research positions (after A, before F). guidanceAppend + parityChecklist extended. sprint12 chain test (13 assertions) added; sprint11 length-6 assertion loosened to `>= 6`.
- **T2** (`6558f26`): dogfood-craft-step2 clears `~/.claude/sidecoach-flow-history.json` at start so latent prereq gaps surface instead of being masked by stale state from prior sprints.
- **T3**: re-dogfood revealed two further bugs - tasks T4 + T5 + T6 added inline per chief-architect loop.
- **T4** (this commit): orchestrator chain executor refreshes `historyEntries = flowHistory.getFlowSequence()` per iteration. Pre-T4 it was a single snapshot taken before the loop, so chain-mates that recorded mid-chain were invisible to subsequent prereq checks.
- **T5** (this commit): orchestrator always runs `buildProjectContext()` then overlays caller-passed projectContext on top. Pre-T5 a partial caller-passed value (e.g. `{ register: 'brand' }`) caused auto-build to be skipped entirely, so handlers never saw `product.brandPersonality` etc.
- **T6** (this commit): `context-loader.ts:buildProjectContext` now also delegates to `project-context.ts:ContextLoader.load()` and merges parsed `product` + `design` onto the returned object. Pre-T6 the two loaders had divergent shapes (raw strings vs parsed objects) and handlers reading `product.brandPersonality` always saw undefined.

## Dogfood progression across Sprint 12

| State | Flows ran | Successful |
|---|---|---|
| Sprint 11 close (stale history) | 6 | 5 |
| Sprint 12 T1+T2 (cleared history) | 8 | 1 |
| Sprint 12 T1+T2+T4+T5 | 8 | 2 |
| **Sprint 12 T1+T2+T4+T5+T6 (FINAL)** | **8** | **8** |

## Loop termination

Per chief-architect directive: "Loop terminates when one complete run produces zero unexpected errors."

Re-dogfood after T6: `flows executed: 8, flows successful: 8`. ALL 8 craft chain flows succeed (A, B, E, F, G, H, I, J) on the marketing-site project. Output 1146 lines (was 140 at Sprint 11 close).

## Regression tests

All 9 Sprint 9-12 tests PASS. Sprint 1 integration PASS. Sprint 8 parity 201/201 PASS. Zero TypeScript errors.

## What's now unblocked

The marketing-site build (original chief-architect task on 2026-05-23 brief). Sidecoach `/sidecoach craft marketing-site` now produces a complete 8-flow output the user can hand-execute against the actual marketing landing page.

## Next session

- Use the dogfood output (`/tmp/sidecoach-craft-output.md`, 1146 lines) as the design+implementation brief for the marketing-site landing page + improv subpage + sidecoach subpage.
- Original brief: brand-new landing page for claude-dotfiles, mentioning improv/sidecoach/memory + sub-pages for improv and sidecoach. Use existing DESIGN.md color tokens, new fonts selected by Sidecoach.

## Files touched

- `sidecoach/src/oracle-command-registry.ts` (T1)
- `sidecoach/src/dogfood-craft-step2.ts` (T2)
- `sidecoach/src/sidecoach-orchestrator.ts` (T4, T5)
- `sidecoach/src/context-loader.ts` (T6)
- `sidecoach/src/__tests__/sprint12-craft-chain-includes-research.test.ts` (T1)
- `sidecoach/src/__tests__/sprint11-craft-chain-includes-motion-a11y.test.ts` (T1, length-6 loosened to `>= 6`)
- `~/.claude/.suppress-fix-gate` (temp suppression for multi-fix work; can rm when this session ends)

## Notes for future work

- Two parallel project-context modules still exist (`project-context.ts` and `context-loader.ts`). T6 made them interoperate but didn't merge them. A future cleanup sprint could collapse them into one module.
- FlowHistory persists to disk; dogfood now clears it but normal runs persist (correct for cross-session continuity). Worth thinking about whether the chain executor should also clear/scope history per-chain to avoid accidental cross-chain leakage.
