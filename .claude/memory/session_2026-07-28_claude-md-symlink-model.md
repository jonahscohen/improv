---
name: The ~/.claude/CLAUDE.md symlink is a LEGACY artifact the installer is designed to migrate away from
description: Traced how the symlink came to exist and what the current design intends. Nothing in install.sh symlinks CLAUDE.md today; an explicit legacy migration converts it to a real file. This machine never ran that migration, which is the mechanism that contaminated the repo source.
type: project
relates_to: [session_2026-07-28_zshrc-bak-missed-callsites.md, session_2026-07-28_audit-wave-committed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: git log -S archaeology on install.sh, grep of every make_symlink call site, stat on the live link
confidence: high
---

# Is the CLAUDE.md symlink intended? No. (2026-07-28)

Jonah ruled: investigate the model before cleaning the contaminated source. The answer is
unambiguous.

## What the archaeology shows

| commit | what it did |
|---|---|
| `6bea8872` initial commit | `make_symlink "$REPO_DIR/claude/CLAUDE.md"` - the symlink WAS the design |
| `a7effeab` | split RULES.md out of CLAUDE.md, still symlinked |
| `fab3cdc6` "Additive brain + config install" | **design changed.** CLAUDE.md becomes a REAL file with our block APPENDED between markers, and a legacy migration is added to convert an existing repo symlink into a real file |

**Nothing in install.sh symlinks CLAUDE.md today.** Every surviving `make_symlink` call
targets hud.sh, startup-check.sh, statusline-command.sh, toggle-resume.sh, cmux, and the
teams launcher. Confirmed by grepping every call site.

This machine's link was created **Jun 08 2026 21:50** and still exists, so the migration at
install.sh:4198 has never run here.

## Why that explains the contamination

While `~/.claude/CLAUDE.md` is a symlink into the repo, the two paths are the same file. So
the brain-install section appends its block into `claude/CLAUDE.md` - the repo's own tracked
source - and someone committed the result. That is the `improv:brain:begin/end` pair at
lines 134 and 443 and the nested `improv:rules` pair at 135 and 257.

It is a fossil of the legacy state, not a live defect: `strip_block_markers` now prevents a
block's payload from containing its own delimiters, and three consecutive real installs hold
at exactly one marker.

## The trade, which is a genuine decision rather than a cleanup

Migrating to the intended design (a real file) is not purely an improvement for this user:

- **Symlink, today's state:** `git pull` alone updates Jonah's global instructions, because
  the file IS the repo file. Editing `claude/CLAUDE.md` takes effect immediately - which is
  exactly what happened when the Teammate Spawn Shape section was added earlier today.
- **Real file, intended design:** the user's CLAUDE.md is their own, with our block appended
  between markers. Refreshing it requires `git pull` AND re-running the installer. Safer and
  additive, and it stops installs writing into tracked source, but it removes the one-step
  propagation Jonah currently relies on across machines.

## Not decided here

Left with Jonah. The relevant point for whoever picks it up: the markers in the source are a
SYMPTOM. Stripping them without deciding the symlink question removes the evidence and
leaves the mechanism, and the next install re-creates the contamination.

## Files touched

- none (investigation only)
