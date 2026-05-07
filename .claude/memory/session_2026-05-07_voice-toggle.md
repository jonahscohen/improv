---
name: Voice toggle hook + dotfiles sync
description: UserPromptSubmit hook for voice on/off; synced all missing hooks (resume + voice) into dotfiles repo with installer wiring
type: project
---
## What
Built a voice on/off toggle system mirroring the resume-guard toggle pattern. Then synced all 5 missing hooks into the dotfiles repo.

## How it works
- Voice-output MCP server uses `~/.claude/.voice-enabled` flag file (present = ON, absent = muted)
- `~/.claude/hooks/voice-toggle.sh` - UserPromptSubmit hook catches chat commands
- `~/.claude/toggle-voice.sh` - standalone toggle script

## Chat commands
- `voice on` - enable voice (creates flag file)
- `voice off` - mute voice (removes flag file)
- `voice toggle` - flip current state
- `voice status` - report current state

## Shell fallback
`! ~/.claude/toggle-voice.sh [on|off]`

## Dotfiles sync
All 5 missing scripts (3 hooks + 2 toggle scripts) added to the repo and deployed as symlinks:
- `claude/hooks/resume-guard.sh` - SessionEnd hook (deletes nyx session files when blocked)
- `claude/hooks/resume-toggle.sh` - UserPromptSubmit hook for `resume on/off/toggle/status`
- `claude/hooks/voice-toggle.sh` - UserPromptSubmit hook for `voice on/off/toggle/status`
- `claude/toggle-resume.sh` - standalone resume toggle
- `claude/toggle-voice.sh` - standalone voice toggle

Deployed copies in `~/.claude/` replaced with symlinks to repo.

## Files touched
- `claude/hooks/voice-toggle.sh` (new)
- `claude/hooks/resume-guard.sh` (new, was only in ~/.claude)
- `claude/hooks/resume-toggle.sh` (new, was only in ~/.claude)
- `claude/toggle-voice.sh` (new)
- `claude/toggle-resume.sh` (new, was only in ~/.claude)
- `~/.claude/settings.json` - wired voice-toggle hook into UserPromptSubmit array

## Improv: broke dist, recovered, hardened, root-caused
- Edited toolbar.ts and ran `node build.js`, which overwrote the 146KB working dist with a 47KB file
- Recovered the real dist from the dishplayscapes project copy (146KB, May 5)
- Root cause investigation: source files on disk are NOT stale - source map proves every .ts file matches exactly what built the 146KB dist. The size difference was caused by esbuild producing different output (version or config), not missing source. All three copies (dishplayscapes, blueprint-tracker, current dist) are byte-identical at 146,333 bytes.
- Initialized git in `~/.claude/improv/` so this never happens without recovery
- Added bash-guard rule: blocks `node build.js` + `improv` pattern and `cd.*/improv.*&&.*build`
- Added content-guard rule: blocks Write/Edit/MultiEdit to any path matching `improv` + `/dist/`
- All four hook test cases pass

## Improv: tooltip added (patched dist directly)
- Source files are stale - they're missing all v2 work (property panel, icons, annotate rewrite, etc.)
- The 146KB dist is the real codebase; source produces only 48KB (missing ~100KB of v2 features)
- Patched the tooltip directly into the minified dist using string replacement
- Added: tooltip div creation in constructor, show/hide in mouseenter/mouseleave, removed native title
- Dist went from 146,333 to 147,290 bytes (957 bytes added)
- Syntax verified, committed in improv git, deployed to all three projects
- Removed the knee-jerk build guard hooks from bash-guard and content-guard; git is the real protection
- Source file reconstruction from dist is still needed as a future task

## Improv: prompt mode enhancements (patched dist)
- Added drag-to-select (lasso) from annotate mode - reuses the Re class already in the dist
- Hovering elements shows a floating label near cursor (tagName + role attribute)
- Marker color from settings panel now applies to prompt mode selection highlights
- Color changes update existing selections in real-time via toolbar.onMarkerColorChange
- Selection overlays: marker color + 26 (15%) fill, + 66 (40%) border
- All new elements cleaned up on deactivate
- Dist went from 147,290 to 149,378 bytes

## Improv: prompt tooltip icons + smart lasso (patched dist)
- Hover tooltip now shows [icon][label] format with 16 tag-specific SVG icons
- Icon categories: img, link, button, input, heading, text, list, list-item, nav, header, footer, section, form, table, flex, grid, generic box
- Also detects flex/grid from computed display style when tag isn't semantic
- Label shows tagName + first CSS class, or #id, or (role) for identification
- Lasso filters to most specific (innermost) elements - ancestors that contain other selected elements are removed
- Dist at 151,927 bytes
- blueprint-tracker is NOT Vite - it's `npx serve` on port 3002, so `/public/improv-core.js` path is correct
- Previous patches were going to manipulate mode mousemove instead of prompt mode - fixed by finding unique anchor after `_lasso.enable`
- Lasso handler rewritten: filters to innermost, clears lasso count badge after select, shows labeled overlays
- _showSelOverlays now renders [icon][label] badge next to each selected element (top-right)
- Dist at 157,850 bytes

## Improv: full prompt mode rewrite (stolen from annotate pattern)
Root cause of all lasso/tooltip failures: prompt mode used inline arrow functions for events, had no drag detection, and onClick always fired after lasso drags.
- Complete class replacement with annotate-style event pattern
- Added isDragging flag with mousedown/mousemove/mouseup tracking (4px threshold)
- onClick guards against isDragging - lasso drags no longer trigger single-click
- Hover tooltip moved to separate _onHover handler (not in click path)
- All events use bound methods + capture:true (matching annotate)
- Dist at 159,033 bytes

## Improv: annotate mode removed
- Killed entirely: mode array, icon map, label map, class property, switchMode branch, deactivation, getTotalPendingCount, sendAnnotations
- Zero annotateMode references remain
- Only manipulate + prompt modes in toolbar
- Dist at 157,756 bytes

## Claude Code Teams launcher
- `bin/claude-teams-launcher.sh` - zsh wrapper that prompts "Enable Claude Code Teams?" when inside cmux
- Detects cmux via CMUX_WORKSPACE_ID / CMUX_PANE_ID env vars
- If yes, runs `cmux claude-teams` instead of plain `claude`
- Four choices: y (this time), n (skip), a (always, creates ~/.claude/.teams-default-on), x (never, creates ~/.claude/.skip-teams-launcher)
- Chains with Discord launcher - wraps whatever `claude` function already exists
- Installed under cmux component in installer, with zshrc source block + deactivation cleanup
- Deployed: symlink + zshrc block on this machine
- Bug fix: zsh doesn't close over locals - `_prev_claude` was empty when `claude()` ran. Replaced with named functions (`_claude_teams_prev` + `_claude_teams_passthrough`) so the Discord wrapper chain survives

## cmux drag-drop hijack fix
- cmux intercepts file drops on terminal and opens them in its browser pane instead of passing to Claude input
- No explicit drag-drop setting exists in cmux schema
- Disabled `interceptTerminalOpenCommandInCmuxBrowser` and `openTerminalLinksInCmuxBrowser` in `~/.config/cmux/cmux.json`
- If this doesn't fix it, the file drop behavior may be hardcoded in cmux and need a feature request

## Collaborator
Jonah
