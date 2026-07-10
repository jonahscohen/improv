# Safe Installer Redesign

Every component additive. Every uninstall clean. Every pick informed.

## Problem

1. The `claude` component is a monolith that replaces CLAUDE.md, settings.json, hooks, and memory files. One wrong pick destroys a teammate's existing config.
2. The returning-user picker shows bare component names with no descriptions. Users can't make informed decisions.
3. Several deactivation functions are incomplete or destructive (delete entire files instead of removing only our additions, nuke all symlinks instead of just ours).

## Design Principles

- **Additive only**: every install appends, merges, or creates new files. Nothing is replaced or overwritten.
- **Clean uninstall**: every deactivation removes exactly what we put there, verified by marker or symlink target. Nothing else is touched.
- **Informed decisions**: every component shows a short description in the picker so users know what they're getting.

## Component Split

`claude` splits into `brain` and `config`:

| Component | What it installs | Method | Destructive? |
|---|---|---|---|
| brain | Team rules + workflow instructions into CLAUDE.md | Marker-guarded append | No |
| config | Hooks, allow patterns, plugins, marketplaces into settings.json + hook scripts | JSON-merge + file copy | No |
| memory | Memory discipline rules + memory hooks + loader | Marker-guarded append + JSON-merge (unchanged) | No |
| skills | tactical-polish + component-gallery-reference | npx + file copy (unchanged) | No |
| statusline | statusline-command.sh | Symlink (unchanged) | No |
| cmux | cmux settings.json | Symlink (unchanged) | No |
| nvm | .zshrc one-liner | Marker-guarded append (unchanged) | No |
| ampersand | .zshrc function | Marker-guarded append (unchanged) | No |
| voice | whisper-cpp + ffmpeg + transcribe | Brew + symlink (unchanged) | No |
| discord | .zshrc launcher + Discord scripts | Marker-guarded append + symlink | No |

Total: 10 public components (was 9).

### brain component (new, replaces half of old `claude`)

**Install:**
```
Marker: <!-- claude-dotfiles:brain:begin --> / <!-- claude-dotfiles:brain:end -->

1. If ~/.claude/CLAUDE.md doesn't exist, create it
2. If markers already present, skip (idempotent)
3. Append RULES.md + CLAUDE.md content between markers
4. If claude/CLAUDE.local.md exists, append it between its own markers:
   <!-- claude-dotfiles:local:begin --> / <!-- claude-dotfiles:local:end -->
```

**Deactivate:**
```
1. sed-delete between brain markers in CLAUDE.md
2. sed-delete between local markers in CLAUDE.md
3. If CLAUDE.md is now empty, remove it
```

User's own content above/below markers is untouched.

### config component (new, replaces other half of old `claude`)

**Install:**
```
1. If ~/.claude/settings.json doesn't exist, create {}
2. If it's a symlink to our repo (legacy install), break it:
   copy file contents, remove symlink, write copy as real file
3. JSON-merge via python3:
   - hooks.PreToolUse: append our bash-guard + content-guard + memory-approve entries
     (marker: command string contains "claude-dotfiles" or specific script names)
   - hooks.SessionStart: append startup-check.sh entry (marker: "startup-check.sh")
   - hooks.PreCompact: append memory-flush entry (marker: "PreCompact: flushing")
   - hooks.PostCompact: append reload entry (marker: "startup-check.sh")
   - permissions.allow: append our memory-write allow patterns
     (marker: each pattern tagged with "# claude-dotfiles" comment, or matched by exact string)
   - enabledPlugins: merge our plugin list (by plugin name, don't duplicate)
   - extraKnownMarketplaces: merge our marketplace list (by URL, don't duplicate)
4. Copy hook scripts to ~/.claude/hooks/ (not symlink - avoids repo dependency at runtime):
   - bash-guard.sh, content-guard.sh, memory-approve.sh
   Or symlink if we want live updates from repo pulls.
5. Copy/symlink startup-check.sh to ~/.claude/
```

**What we do NOT merge:**
- `defaultMode` - user's permission posture, their choice
- `skipDangerousModePermissionPrompt` - same
- `model` - user's model preference
- `verbose` - user's preference
- `alwaysThinkingEnabled` - user's preference
- `statusLine` - handled by statusline component
- `env` - user's environment variables

**Deactivate:**
```
1. Python3 script: filter settings.json to remove entries containing our markers
   - For each hook type: remove entries where command contains our script names
   - For permissions.allow: remove our specific patterns (exact match list)
   - For enabledPlugins: remove our specific plugin names
   - For extraKnownMarketplaces: remove our specific entries
   - Clean up empty arrays/objects left behind
2. Remove hook scripts: only if they are our files
   (check file content for a marker comment, or readlink if symlinked)
3. Remove startup-check.sh: same check
```

### discord component (updated)

**Install (additions):**
```
1. Symlink discord-chat-launcher.sh, discord-onboard.sh, discord-setup.sh
   (moved FROM old claude component)
2. .zshrc source line (unchanged)
```

**Deactivate (new):**
```
1. sed-delete .zshrc launcher block
2. Remove script symlinks (only if pointing to our repo)
```

### voice component (deactivate added)

**Deactivate (new):**
```
1. Remove ~/.claude/transcribe symlink (only if pointing to our repo)
2. Leave brew packages alone (user may have them for other purposes)
```

## Returning-User Picker: Descriptions

The `gum choose` picker and status table in `returning_flow` currently show bare key names. Change to show a short description alongside each component.

**Status table (top of returning flow):**
```
Components
  brain         active       Team rules + workflow (appended to CLAUDE.md)
  config        active       Hooks, plugins, permissions (merged into settings.json)
  memory        active       Memory discipline rules + hooks
  skills        active       UI polish + component gallery research
  statusline    active       Custom prompt bar
  cmux          not installed  cmux split-pane terminal
  nvm           active       Node version manager PATH fix
  ampersand     active       Installer shortcut in terminal
  voice         not installed  Voice transcription (whisper.cpp)
  discord       not installed  Discord chat agent launcher
```

**Picker items:** Each option shows `key - short description` so gum renders it with context.

## Short Descriptions (for picker display)

| Key | Short description (shown inline) |
|---|---|
| brain | Team rules + workflow (appended to CLAUDE.md) |
| config | Hooks, plugins, permissions (merged into settings.json) |
| memory | Memory discipline rules + hooks |
| skills | UI polish + component gallery research |
| statusline | Custom prompt bar |
| cmux | cmux split-pane terminal |
| nvm | Node version manager PATH fix |
| ampersand | Installer shortcut in terminal |
| voice | Voice transcription (whisper.cpp) |
| discord | Discord chat agent launcher |

## Migration: Legacy `claude` Component

Users who have the old `claude` component active (state file says `claude: active`) need a migration path:

1. On first run after the split, detect `claude: active` in state file
2. Map it to `brain: active` + `config: active`
3. The old symlinked settings.json gets detected and converted to a real file during config's next install/activate
4. Remove `claude` from state file

## Backward Compatibility

- `--only claude` should still work as an alias for `--only brain,config` with a deprecation notice
- `--preset minimal` updates to `brain,config,memory,skills,nvm`
- `--help` shows the new component names

## Files Changed

- `install.sh` - component split, additive install, clean deactivation, picker descriptions, migration
