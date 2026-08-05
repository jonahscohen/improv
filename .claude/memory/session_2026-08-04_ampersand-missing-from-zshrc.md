---
name: ampersand not working traced to a missing marker block in ~/.zshrc
description: Jonah reported "ampersand command not working." Root cause found by reading ~/.zshrc directly - the marker-guarded ampersand block is genuinely absent (only claude-teams and voice-output blocks are present), so the shell command was never installed here, not broken. Worked around by launching `bash install.sh --gui` directly.
type: project
relates_to: [session_2026-08-03_gui-installer-becomes-default.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: grep confirmed no ampersand/SHORTCUT_BEGIN marker in ~/.zshrc; direct install.sh --gui launch confirmed live via curl /health (200, bind 127.0.0.1) and opened in the default browser
confidence: high
---

# ampersand was never a broken command - it was never installed here (2026-08-04)

Jonah: "ampersand command not working - can you spin up the gui"

## What actually happened, per the Debugging Protocol

Ran `type ampersand` first - it resolved to a function, but sourced from a stale
`~/.claude/shell-snapshots/snapshot-zsh-*.sh` file, not from the live shell. Read
`~/.zshrc` directly rather than trusting that snapshot: it has an
`improv:claude-teams` marker block and an `improv:voice-output` marker block, but
no `improv:ampersand` block at all, and no `SHORTCUT_BEGIN=`/`SHIM_MARKER=` line
either - the exact markers `install.sh`'s ampersand component writes. The command
was never a broken install; it was never installed on this machine's current
`.zshrc`, or its block was removed since the file was last touched (2026-08-02
23:43, well before any of this session's work).

## Worked around, not routed through the missing command

`ampersand --gui` couldn't run because `ampersand` doesn't exist yet, so launched
the installer directly instead: `bash install.sh --gui` in the background, read
its printed URL, confirmed the server live with `curl .../health` (200, `bind:
127.0.0.1`), then `open`ed the URL in the default browser.

## The actual fix

Once the browser opened, Foundation's `ampersand` row should show not-installed -
ticking it and applying writes the missing marker block and the fix is permanent
from then on. Did not do this unilaterally: it's a real, if small, action the user
should trigger themselves from the page that's now open, not something to stage
and apply on their behalf without being asked.

## Files touched

- none (diagnosis + a background server launch, no repo changes)
