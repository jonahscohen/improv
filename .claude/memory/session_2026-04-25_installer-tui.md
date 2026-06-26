---
name: Installer TUI rewrite (bootstrap.sh + gum-driven install.sh)
description: Rebuilt install.sh as a checkbox TUI with gum (text fallback) over six components, and added bootstrap.sh as a curl|bash entrypoint that re-execs with /dev/tty so the TUI works through a pipe.
type: project
---

Collaborator: Jonah Cohen

# What changed

- `install.sh` rewritten. Same end behavior, but now:
  - Six components addressable as keys: `claude`, `ghostty`, `shaders`, `cmux`, `discord`, `nvm`. Each has a title + description + default-on flag stored in parallel arrays (bash 3.2 compatible - macOS default bash has no associative arrays).
  - Interactive default: render gum checkbox with descriptions; if `gum` is missing, prompt to `brew install gum` (consent), else fall back to a numbered text menu.
  - Flags: `--yes` (full install), `--preset all|minimal|none` (minimal = `claude + nvm`), `--only csv` (explicit subset), `--dry-run` (print resolved picks and exit), `--help`.
  - Each apply section (Claude Code config, Ghostty shaders, Ghostty config, cmux, discord, nvm) wrapped in `if picked <key>; then ... fi`. All existing logic (`make_symlink`, `backup_if_exists`, marker-guarded zshrc appends, etc.) preserved verbatim.
  - Cross-component sanity warnings: ghostty without shaders -> warn that shader chain won't render; discord without claude -> warn that the source line points at an uninstalled file.
- `bootstrap.sh` (new). Tiny entrypoint for `curl -fsSL <url>/bootstrap.sh | bash`. Verifies macOS + git, clones or pulls into `~/Documents/Github/claude-dotfiles`, then re-execs `install.sh` with `</dev/tty` if stdin/stdout aren't TTYs (curl|bash trampoline). Falls back to `--yes` if no TTY at all.
- `README.md` install block rewritten: curl|bash one-liner, TUI table, non-interactive flag examples, behavior notes.

# Why

User wanted a fresh-machine setup that's a single-line invocation AND a real TUI with checkboxes / per-component descriptions / explicit choice over what installs. Previous `install.sh` ran linearly with no opt-out. Net effect: install.sh is no longer "install everything," it's "ask the user, then install."

# How to apply

- Run with no args for the interactive TUI.
- For CI / scripting, prefer `--preset` or `--only` over `--yes` so future component additions don't silently start installing.
- bootstrap.sh forwards args after `--`: `curl ... | bash -s -- --preset minimal`.

# Bug caught during dry-run testing

`key_index` returned `-1` for unknown keys via `printf "%s" "$idx"`. When the result was passed through `printf` again, `-1` was parsed as a flag and printf errored out. Fixed by using `printf -- '%s'` (explicit end-of-flags) at the source.

# Files touched

- `install.sh` (rewritten)
- `bootstrap.sh` (new)
- `README.md` (install section rewritten)
- `.claude/memory/session_2026-04-25_installer-tui.md` (this file)
- `.claude/memory/MEMORY.md` (index entry)

# Verified

- `./install.sh --dry-run --yes` -> all six picked, no writes
- `./install.sh --dry-run --preset minimal` -> claude + nvm only
- `./install.sh --dry-run --preset none` -> nothing picked
- `./install.sh --dry-run --only claude,ghostty` -> two picked
- `./install.sh --only nope,claude` -> exit 2 with "Unknown component" message
- `./install.sh --help` -> usage block prints
- `bash -n install.sh && bash -n bootstrap.sh` -> syntax clean
- Interactive TUI not exercised in this session (no TTY on the harness). User should run `./install.sh` once locally to confirm gum renders correctly.

# Follow-up: plain-English descriptions + connector clarity (2026-04-25)

User asked "does this factor in plugins I like? (oracle, clickup, claude in chrome)" and asked for plain-English component descriptions because terms like "nvm" meant nothing.

## What changed

- TITLES + DESCS rewritten in plain English. No more "symlinks settings.json into ~/.claude/" - now "Your global Claude Code brain: instructions, settings, safety hooks..." Same six components. Each description ends with when to skip.
- The `claude` component description now lists representative plugins (Oracle, Figma, Sentry, Supabase, Discord, hookify, superpowers) so users see the plugin layer is bundled in.
- New post-install section: "Connectors and MCP servers (NOT installed by this script)". Distinguishes:
  - **Plugins** (oracle + 13 others): enabled via settings.json's `enabledPlugins`, auto-installed by Claude Code on first launch. Portable through dotfiles.
  - **Connectors** (ClickUp): OAuth in claude.ai -> Settings -> Connectors. Per-account, not portable.
  - **Chrome extensions** (Claude in Chrome): installed in browser. Per-browser, not portable.
- README install section gets the same component table (now with two columns: plain-English + "what changes on disk") and a new "Plugins vs. connectors vs. extensions" subsection.

## Why this distinction matters

User reasonably assumed "things I use with Claude" all live in the same config. They don't. ClickUp lives behind claude.ai's OAuth flow; Claude in Chrome lives in the Chrome extension store. Trying to install them from a shell script would require browser automation and OAuth dances that aren't worth the complexity. The right move is to acknowledge them in the post-install summary so a fresh-machine setup is honest about what the dotfiles can and can't restore.

## nvm description softened (2026-04-25 follow-up)

User flagged that the "claude not found in PATH" issue was likely isolated to their machine setup and shouldn't be sold as universally necessary. Reworded the nvm component's TITLE/DESC and the README table row to frame it as "an optional fix for a specific symptom" rather than "strongly recommended." Mechanically nothing changed: the apply-phase logic still no-ops if zsh config doesn't source `nvm.sh`. Default-on is fine because it's a no-op on most machines; users can untoggle in the TUI if they prefer.

## yesplease vanity command (2026-04-25 follow-up)

Added a 7th component, `yesplease`, default-on. Appends a `function yesplease()` definition to ~/.zshrc that does `cd $REPO_DIR && git pull --ff-only && ./install.sh "$@"`. So users can type `yesplease` in any terminal to sync the dotfiles repo and re-launch the installer (TUI re-fires, can re-pick components or change toggles).

**Heredoc quoting trick:** the section uses an unquoted `<<EOF` so `$REPO_DIR` expands at install time (function bakes in the absolute path), but `\$@` is escaped so it survives literal into the function body and forwards installer args at call time. Verified by piping the heredoc through bash and inspecting the rendered output.

**Idempotency:** marker grep is `^(function[[:space:]]+yesplease|alias[[:space:]]+yesplease=)` so re-runs detect both function and alias forms but don't false-positive on comments mentioning "yesplease."

## Multi-location support (2026-04-25 follow-up)

User clones the dotfiles in different paths on different machines and asked for the installer to be sensitive to that. Removed the hardcoded `~/Documents/Github/claude-dotfiles` assumption from three places:

1. `ghostty/config.ghostty` now uses `__DOTFILES_DIR__/shaders/*.glsl` instead of literal paths. install.sh renders the config via `sed "s|__DOTFILES_DIR__|$REPO_DIR|g"` at copy time, so the deployed Ghostty config gets absolute paths baked in based on wherever the repo actually lives. Repo file stays portable.
2. install.sh dropped the `EXPECTED_REPO` warning about the clone needing to be at the canonical path. No longer relevant.
3. install.sh `yesplease` block now self-heals: detects our marker comment, checks whether the baked path matches current `$REPO_DIR`, and if not, sed-deletes the old function block and appends a fresh one. Lets users move the dotfiles dir on a machine and have `yesplease` re-point automatically the next time install.sh runs from the new location. If the user has manually defined `yesplease` (no marker), we leave it alone and warn.

`bootstrap.sh` gained a `--dir PATH` flag (in addition to the existing `CLAUDE_DOTFILES_DIR` env var) so curl|bash invocations can target a custom location:

```bash
curl ... | bash -s -- --dir ~/code/dots
```

The flag-parsing loop peels `--dir` off the front and forwards everything else to install.sh. Used `INSTALLER_ARGS=()` array; protected empty-array expansion under `set -u` with the bash-3.2-safe `"${INSTALLER_ARGS[@]+"${INSTALLER_ARGS[@]}"}"` idiom.

README install section updated: new "Cloning to a custom location" subsection, plus the "How it works" Ghostty paragraph rewritten to describe the placeholder substitution rather than the old "byte-identical repo file" claim.
