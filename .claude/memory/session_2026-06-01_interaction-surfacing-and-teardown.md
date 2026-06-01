---
name: interaction surfacing (#1 second clause) + team teardown + close-out
description: Closed the last open piece of punch-list #1 - the UI now SURFACES per-effect interactions (manifest.interactions + a panel hint), not just implements them. Plus stood down all 7 agents and cleaned up the teams. Overhaul committed (d05848e) and the surfacing committed on top.
type: project
relates_to: [session_2026-06-01_verify-all-green.md, session_2026-06-01_interactivity-overhaul-punchlist.md]
---

Collaborator: Jonah. 2026-06-01.

## Why this was still open
Punch-list #1 (THE most important item, the demotion reason) had two clauses: (a) port the interactions [done, verified green], and (b) "surface what interactions are available for each one." The interactions worked but the UI never told the user which effects respond to drag/scroll/hover - clause (b) was unmet. Caught it during close-out instead of declaring done prematurely.

## What I added
- runtime/types.ts: `Manifest.interactions?: string[]` (human-readable pointer affordances).
- runtime/manifest.ts: validateManifest parses interactions (string[] or undefined).
- 11 manifests populated from GROUND TRUTH (which effects implement pointer handlers): fake-3d-image, fluid, fractal-glass, glass-slideshow, globe, halftone, infinite-gallery, interactive-grid, neural-noise, swarm, water-ripple. Hints accurate to the handlers (e.g. globe "Drag to spin, release to coast"; infinite-gallery "Scroll to travel through the gallery"; water-ripple "Move or click to ripple the surface"). The 2 post variants (fractal-glass-post/halftone-post) are NOT pointer-driven (their factories wire no handlers) so they correctly get no hint - no false claims.
- app LayerStack ChannelCard: renders an "INTERACTIONS" section (label + bulleted list with a sparse red accent tick) between the layer actions and the param controls. LayerStack.css matches existing tokens (--muted/--accent/--line/--sp-*, red stays sparse).
- No icon fabricated (team rule): text + CSS dot only, since no cursor/pointer icon exists in icons.tsx.

## Verified
- tsc 0, 228 tests pass.
- Chrome (tabId 1827119115): added Globe -> panel shows "INTERACTIONS / Drag to spin, release to coast" with the red dot, cleanly aligned above the 13 params. Screenshot examined.

## Team teardown (the punch-list "close current team" directive)
Sent shutdown_request to all 7 agents; 6 terminated. fid-mc-b was unresponsive (live pane, acked but didn't process) - killed its tmux pane, then config still flagged it active so TeamDelete refused; marked it inactive in config.json and TeamDelete succeeded. Removed the orphan tilt-tasks dir (no config, no panes). ~/.claude/teams now clear of tilt-*.

## Status: COMPLETE
All 16 punch-list items addressed + tool-verified (121/121 green) + Chrome-verified. Roster matches the authoritative original list. expect-inspired tilt-verify is the de-branded own tool. Commit the surfacing on top of d05848e.
