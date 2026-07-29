---
name: DECISION - install to the live machine once the justify HOME-escape fix lands
description: Jonah approved deploying today's 23 commits to his machine, gated on the justify/install.sh shared-bin fix. Records the delta, the preconditions, and the rollback so the deploy survives a context change.
type: decision
relates_to: [session_2026-07-28_install-rehearsal.md, session_2026-07-28_repair-wave-committed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: rehearsal delta measured in a sandbox; live shims and preservation directory checked by the lead
confidence: high
---

# Deploy decision (2026-07-28)

**Jonah chose: apply, but AFTER the justify HOME-escape fix lands.** Not before.

## The problem this solves

23 commits landed today and essentially none of it is live. `design-build` and
`design-references` are still installed, `curate` has none of its new recall behaviour,
and 16 of 17 installed skills are drifted - one by a month. Every agent was correctly told
to sandbox, so the installer never ran. The work is real and inert.

## Preconditions, all three required

1. **The justify fix must land first.** `justify/install.sh` escaped its overridden `$HOME`
   and planted 8 shims into the live `/opt/homebrew/bin` pointing into a sandbox. Its guard
   only refuses TEMP roots; an existing symlink falls through to `ln -sfn` silently; and the
   verification loop then PASSED because the links resolved inside the sandbox. Detected,
   restored, and independently re-verified by the lead: all 10 shims resolve to
   `~/.claude/justify`.
2. **`skills` must be in the picked set** (or use `--yes`). `install_bundled_skill
   voice-output` appears in exactly one place, inside the loop gated on `picked skills`, so
   picking the ten individual design keys refreshes nine and leaves voice-output stale with
   no flag that fixes it. One-shot: once deployed as a symlink there is no second copy to
   drift.
3. **Must be online.** justify and lotus rebuild unconditionally with `|| exit 4` per step,
   and justify's chain includes a fetching step. Offline, a re-install of this
   already-complete machine exits 1 having changed nothing.

## The delta, measured

- 2 skills REMOVED (`design-build`, `design-references`). No installer backup taken.
- 54 skill files: real file -> symlink into the repo, across 14 skills.
- Hooks: zero created or changed; TWO wired (`codex-failure-watcher`, `codex-rescue-guard`).
- `~/.claude/CLAUDE.md` 443 -> 451 lines, and its two marker blocks SWAP ORDER.
- `~/.zshrc` +5 lines, one marker-guarded block (`voice-on` / `voice-off`).
- `~/.claude.json`: lotus MCP command path changes.
- `~/.local/bin/sidecoach` created; justify's full source tree lands.

## Rollback, verified not assumed

`backup_if_exists` writes to `$REPO_DIR/.backups/<ts>/` and SKIPS SYMLINKS. It captured 54
files and 52 of 52 skill files restore byte-identical - the restore was tested.

NOT covered: the two deleted skills, `CLAUDE.md`, `.zshrc`, `.claude.json`, and anything the
delegated installers write. The deleted skills' only copy is
`/Users/spare3/Documents/improv-preserved-skills-20260728/` (dir + tarball, verified
byte-identical twice with a comparator negative control). **`design-build` is not in git at
all.** `CLAUDE.md` and `.zshrc` blocks are marker-guarded, so deleting the block is the undo.

## Why the gate on the fix

The escape only triggers under a redirected HOME, which a real install does not use, so a
normal run is not exposed. Jonah still chose to wait, which is the right instinct: running
the corrected path costs an hour and removes the only known way this installer can reach
outside its own scope.

## Files touched

- none (decision record only)
