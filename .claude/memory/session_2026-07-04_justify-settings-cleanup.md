---
name: Justify settings panel cleanup - verbosity dropdown + connection section removed
description: Removed the dead Verbosity dropdown (UI stub wired to nothing) and the Connection port/status rows from the justify toolbar settings panel; deployed and visually verified in-browser; pre-existing justify test/tsc failures documented as NOT from this change
type: project
relates_to: []
---

Collaborator: Jonah. 2026-07-04.

Jonah asked what the settings-panel Verbosity dropdown does. Traced: nothing - the toolbar stored the pick and never sent/read it; the four-tier formatter it was meant to drive (output-formatter.ts) sits orphaned since the MCP watch path was retired for HTTP polling. Jonah: delete the dropdown, and remove the connection status messaging in that panel too.

## Changes (justify/core/toolbar.ts only)
- Deleted VERBOSITY_OPTIONS, the verbosity field, and the settings-panel Verbosity dropdown block.
- Deleted the Connection section (Port row + Connected/Disconnected status row). Read "connection status messaging" as the whole section; the port row is one Edit away from restoration if Jonah meant status only.
- KEPT: connected field + setConnected() (4 live callers in core/index.ts track transport state); the orphaned output-formatter.ts + its passing tests (deletion not requested); buildKVRow helper now unused-dead.
- Deployed via npm run deploy (dist rebuilt, synced to ~/.claude/justify + improv/public marker project).

## Verification
- Visual, real inputs (chrome MCP on localhost:4830): clicked the justify pill -> toolbar expanded -> clicked the gear -> Settings panel shows ONLY Hints and Selection Labels toggles, cleanly laid out - no Verbosity dropdown, no Connection/Port/Status rows, no gaps where they were. Screenshot examined.
- grep zero for the deleted symbols.

## Pre-existing failures documented (NOT from this change - verified: the files are unmodified in the tree, so these exist in committed code)
- npx tsc --noEmit in justify/: 2 errors in core/index.ts (~line 344/349) - ChangeEntry not assignable to Record<string, unknown> in change-callback signatures.
- npm test in justify/: selection.test.ts 6 failures - it imports isDynamicClassName/filterClasses which DO NOT EXIST in core/selection.ts (dropped in the endow/improv -> justify rename commit 18a82d59); ws-server.test.ts "tries next port" times out (likely collides with the live daemon on 9223).
- The justify suite was already red before this session. Candidates for a repair task.

Files touched: justify/core/toolbar.ts; deployed bundles; this beat + MEMORY.md.
