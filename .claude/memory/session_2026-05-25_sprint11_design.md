---
name: session-2026-05-25-sprint11-design
description: Sprint 11 design - flowA reads brandPersonality cleanly (filtering empty arrays), craft chain expanded to include flowH motion + flowI accessibility. Autonomous execution per chief-architect directive.
type: project
relates_to: [session_2026-05-25_sprint10_closed.md, feedback_chief_architect_autonomous_dogfood_loop.md]
---

Human collaborator: Jonah. Executed autonomously.

## Trigger

Sprint 10 closed. Dogfood surfaced 2 remaining bugs in actual end-to-end use:

1. flowA `Personality: ` displays empty because `brand_personality = []` (empty array from existing section parser) is truthy and preempts `brandPersonality = 'real string'` in JS `||` chains. Two read sites in flow-handler-brand-verify.ts (line 120 display, line 222 pre-flight check).

2. Registry's craft chain has 4 flowIds (A/F/G/J). Per impeccable's craft.md skill, craft should cover shape -> tokens -> components -> motion -> accessibility -> polish. Missing flowH (motion) and flowI (accessibility) from the registry's flowIds array.

## Fixes

1. Add `nonEmptyStringOrNull(v)` helper in flow-handler-brand-verify.ts. Replace 2 read sites to prefer brandPersonality first AND filter out arrays/empty-strings.
2. Extend registry's `craft.flowIds` to include `flowH_motion_integration` and `flowI_accessibility`. Extend `guidanceAppend` and `parityChecklist` to reference them.

## Spec

`docs/superpowers/specs/2026-05-25-sidecoach-sprint11-brand-personality-truthy-and-craft-chain.md`

## Plan

About to write `docs/superpowers/plans/2026-05-25-sprint11-brand-personality-truthy-and-craft-chain.md`. 3 tasks: T1 nonEmptyStringOrNull helper + 2 read sites + test, T2 registry craft expansion + test, T3 re-dogfood + close.

## Mode

Skip user-review gates per chief-architect directive. Spec written. Plan next. Execute via Opus subagents. Commit + push. Re-dogfood. Loop until clean.

## Plan written

`docs/superpowers/plans/2026-05-25-sprint11-brand-personality-truthy-and-craft-chain.md`. 3 tasks. About to commit spec+plan together then dispatch T1.
