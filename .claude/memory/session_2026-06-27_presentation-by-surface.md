---
name: Presentation by surface - rich visualizer in desktop/web, text panel in terminal/cmux
description: Jonah wants reporting/charts/tables/graphs presented via Claude's visualizer (creatively) in surfaces that can render it (desktop/web/Cowork), and text/ASCII where they can't (terminal/cmux/mobile). Built surface-detection SessionStart hook + a CLAUDE.md rule; verified detection across all surfaces.
type: project
relates_to: [reference_claude_code_surface_detection.md, session_2026-06-27_audit-report-panel-built.md]
---

Collaborator: Jonah. 2026-06-27. Ref: support.claude.com "Visual and interactive content" + "Custom visuals in chat and Cowork".

## THE ASK
Detect desktop/web/mobile vs terminal/cmux; in the rich surfaces, present reporting/charts/
tables/graphs via Claude's visualizer (sometimes creatively), not ASCII.

## WHAT WAS BUILT
- claude/hooks/claude-surface.sh (SessionStart): reads CLAUDE_CODE_ENTRYPOINT + CMUX_* and
  injects "Claude Code SURFACE: <x> (RICH|TEXT-ONLY)" + a directive. RICH (desktop/web/vscode):
  prefer the visualizer / a visual artifact for data. TEXT-ONLY (terminal/cmux/mobile/sdk):
  clean text/markdown/ASCII (the sidecoach panel). Symlinked live to ~/.claude/hooks/.
- Wired into SessionStart in BOTH claude/settings.json (repo) AND ~/.claude/settings.json
  (the live copy - it is NOT symlinked to the repo, same drift that bit the lane tier).
- claude/CLAUDE.md (live via symlink): new "Presentation by Surface" section documenting the
  rule + the mechanism (HTML/SVG/React; custom-visuals ephemeral vs artifacts persistent).

## THE RESEARCH (the unknown, resolved)
The linked article is claude.ai CHAT's auto-visualizer. The KEY confirmation: Anthropic's
"Custom visuals in chat and Cowork" + the binary's own `remote_cowork` entrypoint value =>
the rich Claude Code surfaces (desktop, web/Cowork) DO render HTML-based custom visuals +
artifacts. NOT iOS/Android (mobile = remote_mobile = text-only, matches the hook). NOT terminal.
So Jonah's vision is valid on desktop/web; mobile and terminal stay text.

## VERIFIED
- Detection: current session = cmux (TEXT-ONLY) correct. Simulated: claude-desktop->desktop RICH,
  remote/remote_desktop->web RICH, remote_mobile->mobile text-only, claude-vscode->vscode RICH,
  sdk-ts->text-only, cli+no-cmux->terminal. All correct.
- Live hook fires from ~/.claude/hooks/ path; both settings.json files valid JSON; CLAUDE.md live.

## HONEST LIMITS (told Jonah)
- The hook takes effect NEXT session (SessionStart) - it cannot retro-fire into this one.
- I cannot RENDER an artifact from this terminal to eyeball it (no rich surface here); the
  visual mechanism is confirmed by Anthropic's docs + the entrypoint values, not by me rendering one.
- "Custom visuals" are beta + vary by question type (Anthropic). Fall back to markdown if a
  given visual does not render.

## Files touched
- claude/hooks/claude-surface.sh (new), claude/settings.json + ~/.claude/settings.json
  (SessionStart wiring), claude/CLAUDE.md (Presentation by Surface section).
</content>
