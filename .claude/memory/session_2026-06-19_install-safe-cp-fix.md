---
name: install.sh safe_cp helper - idempotent against pre-existing symlinks
description: Patched install.sh so `cp $REPO_DIR/... $CLAUDE_DIR/...` no longer dies when the destination is a stale symlink pointing back into the repo; then re-ran full install end-to-end.
type: project
---

Jonah ran `./install.sh --yes --personal` to install everything and repair what was out of date on his machine. The first run died at the config block:

    cp: /Users/jonah/.claude/hooks/bash-guard.sh and /Users/jonah/documents/github/claude-dotfiles/claude/hooks/bash-guard.sh are identical (not copied).

Root cause: an older install era left ~/.claude/hooks/bash-guard.sh (and ~13 other paths under ~/.claude) as symlinks pointing into the dotfiles repo. The current installer is a "copy real files" design - the `cp` from the same file to itself fails on BSD cp ("are identical"), set -e kills the script, install bails before reaching skills/voice/sidecoach/tilt-lab/etc.

**Why:** the installer needs to be idempotent against legacy installs that used symlinks, regardless of macOS BSD cp's no-self-copy behavior. The repair has to work even for users who set up the dotfiles before the symlink->copy migration.

**How:** added a `safe_cp` helper near the top of install.sh:

    safe_cp() { rm -f "$2"; cp "$1" "$2"; }

Then `sed -i '' 's|cp "\$REPO_DIR/|safe_cp "$REPO_DIR/|g'` swapped all 18 plain `cp "$REPO_DIR/...` call sites (hooks, startup-check, 8 design-skill SKILL.md copies, voice-output server, reflect-nudge, task-list skill, etc.) to use the helper. Continuation lines (`safe_cp ... \` newline `   "$dest"`) work fine because the helper takes two args.

After the patch:
- `bash -n install.sh` clean
- Re-ran `./install.sh --yes --personal` -> exit 0, "Installation complete."
- All 30 components installed (14 core + 11 design + 2 dev apps + 3 personal).
- Backups saved to .backups/20260619-023829.

Verified afterward: `~/.claude/hooks/bash-guard.sh` is now a regular file (no longer a symlink), `~/.claude/skills/` is populated, tilt-lab deps installed, sidecoach compiled, statusline + startup-check symlinks intact.

Files touched:
- install.sh: added `safe_cp` helper + bulk-swapped 18 `cp` calls to `safe_cp`.
- ~/.claude/CLAUDE.md, ~/.claude/settings.json, ~/.claude/hooks/*, ~/.claude/skills/*, ~/.claude/voice-output/*, ~/.claude/sidecoach/*, ~/.local/bin/tilt-lab, ~/.config/cmux/settings.json, ~/.zshrc - all touched by the installer per its normal contract.

Collaborator: Jonah Cohen.
