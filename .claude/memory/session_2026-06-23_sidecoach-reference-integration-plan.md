---
name: PLAN - wire reference skills into Sidecoach (execute in a FRESH cmux-teams session)
description: Forward handoff. The routing map (gaps) is done; the implementation never landed (prior teammate black-boxed). This is the exact plan to resume in a new session - spawn recipe, teammate brief A-D, the reporting contract that was missing, the verification bar, and the files.
type: project
relates_to: [reference_sidecoach_reference_routing_map.md, session_2026-06-22_sidecoach-reference-integration-deploy.md, session_2026-06-22_cmux-teams-break-and-guard-fix.md]
---

Collaborator: Jonah Cohen

Handoff written at Jonah's request before he starts a fresh session. He will start a NEW cmux claude-teams session and have the assistant deploy an agent in a new pane to do this.

## Goal
Make Sidecoach's reference systems actually fire during builds ("more aggressive"): wire the orphaned reference flows into lanes/verbs + an auto-inject reference preflight, WITHOUT breaking direct skill use.

## State (as of 2026-06-23)
- DONE - the map: [[reference_sidecoach_reference_routing_map.md]]. Gaps: flowC (fontshare) + flowD (live design-references) are orphaned from every lane and every verb; only `lane_build` pulls any references and it still skips fonts + the design-refs catalog; the `typeset` verb lists "fontshare reference" in text but never runs flowC.
- NOT DONE - the implementation: a teammate (`sidecoach-reference-integrator`) was spawned post-restart but ran fire-and-forget as a black box - zero tasks/messages/file changes. Confirmed still true: `sidecoach/` has no uncommitted changes, no completion beat, no process. The wiring was never made.

## cmux-teams spawn status (the reason for a new session)
- FIXED in a fresh session; DEAD in the originating session e784956f (its `~/.claude/teams/` was never initialized; no mid-session fix - no TeamCreate tool).
- A new session re-creates the implicit per-session team at startup -> spawn works.
- SPAWN RECIPE (what passes agent-teams-guard + the harness): `Agent({ subagent_type: "general-purpose", name: "<name>", prompt: "<brief>" })`. NO `team_name` (deprecated; passing it errors "session team not found"), NO model override (forbidden), foreground (NOT run_in_background - Jonah wants a visible pane).

## The missing piece that killed the last attempt: a REPORTING CONTRACT
Deploying is NOT done at spawn. The orchestrator MUST:
1. Require the teammate to break work into `TaskCreate` tasks and `TaskUpdate` as it progresses.
2. Require a per-phase `SendMessage` status back to the spawner, and a plan-pause for approval before large edits.
3. Stay in a watch loop (poll `TaskList` / await messages) and confirm the teammate surfaced as a watchable cmux pane.
Do NOT fire-and-forget. If no task/message appears within a short window, intervene.

## Teammate brief (deliverables A-D)
- A. Routing: wire `flowC_font_research` + `flowD_reference_inspiration` into `lane_build` (craft step), and `lane_delight`/`lane_live` where relevant; wire flowC into the `typeset` verb. Edit SOURCE (`claude/hooks/sidecoach-lanes.json` + `sidecoach/src/verb-command-registry.ts`) then REGENERATE - never hand-edit `lanes.generated.ts`.
- B. Auto-inject preflight: any build/refinement lane auto-queries the relevant reference systems and injects results as artifacts regardless of verb (component patterns; LIVE design-references catalog matched vs PRODUCT.md voice; font candidates; motion patterns; icon-source). Soft-fail / additive.
- C. Depth audit: enrich thin bundles from the standalone skills' real content (`reference-update-service`); extend to reference-dependent skills (visual-effects, tilt-lab, icon-source) as attached artifacts.
- D. Preserve direct use: the standalone skills stay auto-triggering AND directly invocable (HARD requirement).

## Verification bar (hand to the teammate)
Plan-first (each step as `<step> -> verify: <runnable check>`); `cd sidecoach && npm run build` exits 0; `npm test` green; PROVE references now fire via real engine output (before/after on `/sidecoach craft ...` showing font + design-ref + component artifacts that were ABSENT before); confirm skills still auto-trigger + invoke directly; optional Codex (`codex:rescue`) cross-model review of the diff.

## Key files
`sidecoach/src/{flows.ts, flow-composition.ts, lanes.generated.ts, verb-command-registry.ts, reference-systems.ts, reference-data.ts, *-reference.ts, reference-loader.ts, reference-system-preflight.ts}`; `claude/hooks/sidecoach-lanes.json`; `sidecoach/bundles/*.json`.

## Open questions Jonah may resolve at kickoff (don't block on them - sensible defaults noted)
- Scope: full brief (A+B+C) vs core routing only (A). Default: A first, then B, then C.
- "Preserve direct skill use" still a hard requirement? Default: YES.
- Dig the teammate-stall root cause before trusting a re-deploy? Default: the reporting contract above is the fix; proceed and watch.

## Safety net now in place
The new api-drift guard ([[session_2026-06-22_api-drift-guard.md]]) will flag (and block on) a breaking change in the Agent/teams/MCP tool contract, so a future teams-API shift won't silently break the spawn the way it did this round.
