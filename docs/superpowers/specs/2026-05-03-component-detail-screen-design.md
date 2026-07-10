# Component Detail Screen

Enhance the returning-user action picker in install.sh to show a detail screen when selecting a component, instead of jumping straight to activate/deactivate.

## Current Behavior

Returning user picks a component from the list -> immediate `gum choose` with just "deactivate" or "activate" and "(back)". No context about what the component does or what files it touches.

## New Behavior

Returning user picks a component -> detail screen showing:

1. **Title** - component name + current status badge (active/inactive/not-installed)
2. **Subtitle** - the existing TITLES entry (one-line description)
3. **Description** - the existing DESCS entry, wrapped to terminal width via `gum style --width`
4. **Files list** - static paths the component installs/touches, from a new FILES parallel array
5. **Action menu** - the existing state-based actions (activate/deactivate/install) plus two new informational actions

## Data Changes

### New FILES Array

A parallel array alongside KEYS/TITLES/DESCS. Each entry is a newline-delimited string of paths the component installs or modifies, using `~` shorthand for readability.

```bash
FILES=(
  # brain
  "~/.claude/CLAUDE.md (marker block)"
  # config
  "~/.claude/settings.json (JSON merge)\n~/.claude/hooks/bash-guard.sh\n~/.claude/hooks/content-guard.sh\n~/.claude/hooks/memory-approve.sh"
  # memory
  "~/.claude/CLAUDE.md (memory discipline block)\n~/.claude/settings.json (3 hooks)\n~/.claude/startup-check.sh"
  # skills
  "~/.claude/skills/tactical-polish/\n~/.claude/skills/component-gallery-reference/\n~/.claude/skills/social-media/\n~/.claude/skills/design-team/\n~/.claude/skills/visual-effects/\n~/.claude/skills/icon-source/"
  # statusline
  "~/.claude/statusline-command.sh"
  # cmux
  "~/.config/cmux/settings.json"
  # nvm
  "~/.zshrc (one-line addition)"
  # ampersand
  "~/.zshrc (ampersand function)"
  # voice
  "~/.claude/transcribe (symlink)\n~/.cache/whisper/ggml-base.en.bin\nwhisper-cpp (brew)\nffmpeg (brew)"
  # discord
  "~/.claude/claude (wrapper symlink)\n~/.claude/discord-onboard.sh\n~/.claude/discord-setup.sh\n~/.claude/channels/discord/"
)
```

### New DIRS Array

Maps each component to its source directory in the repo (for "view in Finder").

```bash
DIRS=(
  "$REPO_DIR/claude"           # brain
  "$REPO_DIR/claude"           # config
  "$REPO_DIR/claude"           # memory
  "$REPO_DIR/claude/skills"    # skills
  "$REPO_DIR/claude"           # statusline
  "$REPO_DIR/cmux"             # cmux
  "$REPO_DIR"                  # nvm
  "$REPO_DIR"                  # ampersand
  "$REPO_DIR/bin"              # voice
  "$REPO_DIR/bin"              # discord
)
```

## Rendering (gum path)

After the user picks a component from the list and before the action `gum choose`:

```bash
clear
print_yes_and_banner

# Title + status badge
local idx; idx=$(key_index "$pick")
local status_label
case "$current" in
  active)        status_label="${GREEN}active${NC}" ;;
  inactive)      status_label="${YELLOW}inactive${NC}" ;;
  not-installed) status_label="${DIM}not installed${NC}" ;;
esac
printf "${ACCENT}%s${NC}  %b\n" "$pick" "$status_label"
printf "${DIM}%s${NC}\n\n" "${TITLES[$idx]}"

# Description (wrapped to terminal width)
printf '%s' "${DESCS[$idx]}" | gum style --faint --width "$(tput cols)" --padding "0 0 0 0"
printf "\n"

# Files list
printf "${ACCENT}Files:${NC}\n"
printf '%b\n' "${FILES[$idx]}" | while IFS= read -r line; do
  printf "  ${DIM}%s${NC}\n" "$line"
done
printf "\n"
```

## Action Menu Changes

Current actions by state:
- active: `deactivate`
- inactive: `activate`, `remove from state`
- not-installed: `install`

New actions added to ALL states (non-destructive, loop back to detail screen):
- `view in Finder` - runs `open "${DIRS[$idx]}"`, then loops back to the detail screen
- `list files` - prints the FILES entry with full expanded paths (`~` -> `$HOME`), waits for keypress, loops back

Order in menu:
1. State-specific action (activate/deactivate/install)
2. `view in Finder`
3. `list files`
4. `(back)` (or `remove from state` + `(back)` for inactive)

## Fallback (no gum)

Print title, status, description, and files as plain text. Show numbered action menu including the two new options. Same loop-back behavior.

## Personal Components

The PERSONAL_KEYS also need FILES and DIRS entries:
- ghostty: `~/.config/ghostty/config`
- shaders: `~/.config/ghostty/shaders/`

## Scope

- Only the returning-user action loop changes (lines ~820-920 of install.sh)
- Fresh-install flow is unchanged
- No changes to any SKILL.md, CLAUDE.md, or other files
- The FILES and DIRS arrays are defined alongside KEYS/TITLES/DESCS at the top of install.sh
