---
name: The craft floor is packaged, not just locally wired
description: A Stop hook caught that sidecoach-craft-floor.sh was deployed live but never packaged, so it would install nowhere else and the component browser could not show or toggle it. Wired into browser-tree.json, app-wirings.json and install.sh; component-browser suite back to 139 passed, 0 failed.
type: project
relates_to: [session_2026-07-29_craft-floor-is-live-and-nothing-is-symlinked.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: test-component-browser.sh run before and after - 136 passed 3 failed, then 139 passed 0 failed
confidence: high
---

# Live is not the same as shipped (2026-07-29)

Commit stamp at authoring: f1b6fe7e.

`hook-registry-stop.sh` blocked and was correct. I had deployed
`sidecoach-craft-floor.sh` to `~/.claude/hooks/` and registered it in live settings, so it
worked ON THIS MACHINE and nowhere else. Unpackaged means: no other install gets it, and the
component browser can neither show nor toggle it.

This is the SAME class as the finding one commit earlier - a thing verified at the live path
while the repo path is what propagates - arriving from the opposite direction. There are three
distinct places a hook has to exist and I had two of them.

Wired into all three:

- `claude/hooks/browser-tree.json` - added to the sidecoach hooks list, plus `hook_desc` and
  `hook_owner`
- `claude/hooks/app-wirings.json` - `PreToolUse`, matcher `Write|Edit|MultiEdit`
- `install.sh` - both the file-copy list and the `install_app_hooks` line for owner `sidecoach`

The suite went 136 passed / 3 failed to **139 passed / 0 failed**. The three failures were mine
and they were the right kind: the tests hard-code the sidecoach hook roster and its off-list
strings, so adding a hook broke exactly the assertions that exist to notice a roster change.
Updated the expectations rather than loosening them, and corrected the header comment that still
said SEVEN hooks.

## Files touched

- `claude/hooks/browser-tree.json`, `claude/hooks/app-wirings.json`, `install.sh`, `claude/hooks/test-component-browser.sh`
