---
name: The craft floor is registered and firing live; and nothing in ~/.claude is symlinked from the repo
description: Deployed and registered sidecoach-craft-floor.sh so the floor actually loads before UI edits. Discovered en route that NOTHING in ~/.claude is a symlink to this repo, which contradicts a standing claim in the global instructions and means repo edits to hooks or settings do not go live.
type: project
relates_to: [session_2026-07-29_craft-floor-works-and-is-unregistered.md]
supersedes: session_2026-07-29_craft-floor-works-and-is-unregistered.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: hook invoked through the deployed live path and its raw output measured at 11875 bytes; negative control on a non-UI path returned 0 bytes; live settings integrity checked key-by-key after the edit; readlink run against every ~/.claude entry
confidence: high
---

# The floor fires now, and the propagation model is not what the docs say (2026-07-29)

Commit stamp at authoring: 5fcfdcee.

## The floor is live

Two steps were needed, and the first one alone would have been a broken hook.

1. Registered `~/.claude/hooks/sidecoach-craft-floor.sh` on `PreToolUse` with matcher
   `Write|Edit|MultiEdit` in the LIVE `~/.claude/settings.json`. Backed up first; verified
   afterwards that top-level keys were preserved, hook entries went 109 to 110, the
   `permissions` block survived, and all 3 `mcpServers` survived.
2. Deployed the hook FILE, which did not exist at that path. `install -m 755` from
   `claude/hooks/`, 6188 bytes.

PROOF, through the deployed path with the cooldown state cleared:

    bytes returned: 11875     (a .html write)
    bytes returned: 0         (a .txt write - negative control)

Cooldown is 900s per project via `SIDECOACH_FLOOR_COOLDOWN`, state in
`~/.claude/.sidecoach-floor`, and a second consecutive call on the same file returns 0 bytes.
It will not spam a build turn.

## THE MISTAKE I MADE IN THE MIDDLE OF THIS, worth more than the fix

I registered the hook first, pointing at `~/.claude/hooks/sidecoach-craft-floor.sh`, which did
not exist. For the minutes between those two commands, every `Write` and `Edit` in this session
was configured to invoke a missing file. That is the "command not found" hook-error class the
global instructions treat as a broken tool in the harness.

Root cause: I assumed the repo path and the live path were the same file. They are not, and that
assumption came from the global instructions rather than from the disk.

## NOTHING IN ~/.claude IS SYMLINKED FROM THIS REPO

    readlink ~/.claude/settings.json   -> not a symlink
    readlink ~/.claude/hooks           -> not a symlink
    readlink ~/.claude/skills          -> not a symlink
    readlink ~/.claude/CLAUDE.md       -> not a symlink

    claude/settings.json    4218 bytes
    ~/.claude/settings.json 24894 bytes

The global instructions state, about settings changes, that "both changes are local to
settings.json and propagate through the dotfiles symlink." **On this machine that is false.**
The two files have diverged by a factor of six. The installer COPIES; it does not link.

Consequences that matter to work in flight:

- An edit to `claude/hooks/*` or `claude/settings.json` does NOT take effect until the installer
  runs. Any teammate verifying a hook change by editing the repo copy and re-running is
  verifying a file the harness never loads.
- The live settings file is the larger and more current of the two, so the repo copy is not a
  superset and cannot be treated as the source of truth without a merge.
- This is a plausible partial explanation for how a hook can be documented as enforced and not
  actually fire, which is the open `marketing-buzzword` question `detector` is holding.

## Files touched

- `~/.claude/settings.json` (hook registration; backup at /tmp/live-settings-backup.json)
- `~/.claude/hooks/sidecoach-craft-floor.sh` (deployed, 755)
- `claude/settings.json` (same registration, so the installer carries it forward)
