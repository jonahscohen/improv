---
name: Sidecoach panel wired into orchestrator + lane engine (Step 3)
description: real runs now attach a rendered panel string - final card on every report seam, progressive snapshots on lane start/advance
type: project
relates_to: [session_2026-06-18_sidecoach-panel-renderer.md]
---

Collaborator: Jonah

Step 3 of the make-Sidecoach-real plan. The panel is now produced by the runtime.

- `SidecoachResult.panel?: string` added; set at all THREE generateBuildReport seams in
  sidecoach-orchestrator.ts (composite ~431, verb-chain ~1070, single-flow ~1518) via
  `renderSidecoachPanel(assemblePanelModel({ flowResults, report, confidence }))`. This is the
  final verdict card on any completed run.
- `LaneStepResult.panel?: string` added (lane-types.ts); the engine's `startLane` / `advanceLane`
  wrappers post-process the laneRunner result with
  `renderSidecoachPanel(laneStepToPanelModel(result))` (best-effort, try/catch). Progressive
  snapshots: route/flow/checklist build up; a terminal step that carries a validator `gate`
  populates gates + verdict from it. (laneStatus left untouched - different result shape, read-only.)
- `laneStepToPanelModel` (panel-model.ts) maps a LaneStepResult-like object (verb/flowIds/checklist,
  optional gate/convergence) into the panel model. `shortFlowLabel` now also derives a readable
  label from an id alone ("flowK_multi_lens_audit" -> "multi lens audit").

Test harness correction: I first wrote the test with vitest (tilt-lab's framework), which broke
`tsc`/`npm run build` (sidecoach has no vitest dep). Rewrote it to sidecoach's convention -
standalone ts-node script with assert + process.exit - and registered it in scripts/run-tests.ts
SUITES (note: the runner uses an EXPLICIT list, not a glob, so new tests MUST be added there).

Verified:
- `npx ts-node src/__tests__/panel-renderer.test.ts` -> "all checks passed".
- `npx tsc` -> 0 errors (the vitest error is gone); `npm run build` emits dist/panel-*.js.
- Rendered a live sample panel: matches the demo card 1:1 - orange accent + diamond header,
  route/flow(chevrons), orange ▰ checklist bar with N/M, green ◇ [done] phases + dims line,
  ✓ gates, "◆ verdict clean · grade A · 0 findings". Colors are the demo tokens (217;121;78 /
  143;181;115); glyphs render (content-guard Step-0 fix lets them through).
- NOT yet live-verified in a real Claude Code session: the sidecoach MCP server only loads the new
  dist on a Claude Code restart (Step 5 / user action).

Files: sidecoach/src/panel-model.ts, sidecoach/src/sidecoach-orchestrator.ts, sidecoach/src/lane-types.ts,
sidecoach/src/__tests__/panel-renderer.test.ts, sidecoach/scripts/run-tests.ts
