---
name: Sidecoach panel - model + renderer (Steps 1-2)
description: pure view-model + compact terminal-card renderer that mirror the demo, from real run data
type: project
relates_to: [session_2026-06-18_content-guard-emoji-presentation.md]
---

Collaborator: Jonah

Steps 1-2 of the make-Sidecoach-real plan (~/.claude/plans/swirling-napping-stonebraker.md).

- `sidecoach/src/panel-model.ts` (pure): `SidecoachPanelModel` + `assemblePanelModel()`. Turns
  real run data into the card's view-model - headline flow + chain from `FlowExecutionResult[]`,
  per-phase checklist (done = status success/skipped), dims from the headline flow's checklist,
  gates (taste / claudemd / polish) derived from `BuildReport.findings` (a gate fails if a
  blocking/warning finding matches its name; null = not run yet for progressive snapshots), and
  verdict/grade/findings straight from the `BuildReport`.
- `sidecoach/src/panel-renderer.ts` (pure): `renderSidecoachPanel(model, {color?, width?})`.
  Reproduces the demo `.scd-sc` layout - header, route, flow chain (chevrons), checklist progress
  bar, per-phase rows with [running]/[done] + the headline dims line, gates row with check/cross,
  verdict line (only once a verdict exists). ANSI truecolor from the demo tokens (orange #D9794E,
  green #8FB573, fg/dim/faint); `NO_COLOR` / `color:false` -> plain copy-safe card. The card uses
  real terminal glyphs (diamonds, bar, chevron, check/ballot-x) - now allowed by the Step-0
  content-guard fix.

Verified: `npx vitest run src/__tests__/panel-renderer.test.ts` -> 9 passed (clean/warnings-only/
blocked verdicts, grade letters, 0/1/N findings with correct singular/plural, partial snapshot
omitting the verdict + showing [running], gate-fail from a finding source, and ANSI present/absent
under color on/off). panel-model.ts + panel-renderer.ts typecheck clean (only tsc noise is the
test's vitest import, shared by all existing tests).

Next: Step 3 - wire into sidecoach-orchestrator.ts (final card where generateBuildReport runs;
progressive snapshots on the lane engine start/advance/status results).

Files: sidecoach/src/panel-model.ts, sidecoach/src/panel-renderer.ts,
sidecoach/src/__tests__/panel-renderer.test.ts
