---
name: Can a Sidecoach run hide all the bash/grep/narration noise? - honest answer
description: Jonah wants running Sidecoach to show ONLY a simple presentation - no bash commands, no internal dialogue, no greps. Honest breakdown of what's controllable (narration, extra calls) vs not (the single underlying tool call renders in the transcript - harness behavior, not a prompt switch).
type: feedback
relates_to: [session_2026-06-27_audit-panel-final-report-redesign.md]
---

Collaborator: Jonah. 2026-06-27. "I just want to see a simple presentation. Is that possible? Be honest."

## THE THREE KINDS OF NOISE (separate them)
1. My narration / internal dialogue ("let me grep", "now I'll check") - 100% controllable.
   I can go silent and surface only the panel. The skill already says "work quietly,
   surface the panel"; tighten it so a run is one call + panel, no prose.
2. The greps / codex / builds / "weird calls" - this session that was me DEVELOPING sidecoach
   (heavy dev), NOT the end-user flow. A normal sidecoach USE is ONE command (the monitor)
   -> the panel. No greps. The dev noise is not the product experience.
3. The single underlying tool call (the monitor command + its output) - HARNESS behavior.
   Claude Code renders tool calls in the transcript by default. I have NO mid-session switch
   to make that one call invisible. Best achievable from inside a session: make it ONE clean
   command whose output IS the panel, nothing around it.

## HONEST VERDICT
Mostly yes, with one caveat. Achievable now: no narration, one quiet command, the clean panel
as the only meaningful output. NOT achievable by prompt alone: hiding that one tool block
entirely. Going further needs a HARNESS/CONFIG change, not a prompt trick:
- Claude Code settings / output styles to collapse tool rendering.
- A surface OUTSIDE the transcript (the marketing demo already replays the panel in a browser;
  a TUI/preview pane is possible).
- A slash-command/skill configured to minimize tool-output display.

## WHAT I CAN DO
- Tighten the skill so a sidecoach invocation = exactly one quiet command + the panel (no
  narration, no greps, no extra calls). Behavioral, available now.
- Help set up the harness/output-style change if he wants the tool block itself hidden (config,
  with his involvement) - but I will not pretend a prompt can hide it.

## Files
- (no code yet; this is the honest scoping answer + the path forward)
</content>
