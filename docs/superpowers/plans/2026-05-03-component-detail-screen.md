# Component Detail Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a detail screen to the returning-user component picker in install.sh that shows the component's description, files, and expanded action options before the activate/deactivate choice.

**Architecture:** Add two new parallel arrays (FILES, DIRS) alongside the existing KEYS/TITLES/DESCS. Replace the current direct-to-action-menu flow with a detail screen that renders title, status, description, file list, then an expanded action menu with "view in Finder" and "list files" options that loop back.

**Tech Stack:** Bash, gum (CLI TUI toolkit)

---

### Task 0: Add FILES and DIRS arrays

**Files:**
- Modify: `install.sh:53-93` (array declarations section)

- [ ] **Step 1: Add FILES array after DESCS (after line 77)**

Insert immediately after the closing `)` of the DESCS array (line 77) and before `PICKS=` (line 78):

```bash
FILES=(
  # brain
  "~/.claude/CLAUDE.md (marker block)"
  # config
  "~/.claude/settings.json (JSON merge)\n~/.claude/hooks/bash-guard.sh\n~/.claude/hooks/content-guard.sh\n~/.claude/hooks/memory-approve.sh"
  # memory
  "~/.claude/CLAUDE.md (memory discipline block)\n~/.claude/settings.json (3 hooks merged)\n~/.claude/startup-check.sh (symlink)"
  # skills
  "~/.claude/skills/tactical-polish/\n~/.claude/skills/component-gallery-reference/\n~/.claude/skills/social-media/\n~/.claude/skills/design-team/\n~/.claude/skills/visual-effects/\n~/.claude/skills/icon-source/"
  # statusline
  "~/.claude/statusline-command.sh (symlink)"
  # cmux
  "~/.config/cmux/settings.json (symlink)"
  # nvm
  "~/.zshrc (one-line addition)"
  # ampersand
  "~/.zshrc (ampersand function block)"
  # voice
  "~/.claude/transcribe (symlink)\n~/.cache/whisper/ggml-base.en.bin\nwhisper-cpp (brew)\nffmpeg (brew)"
  # discord
  "~/.claude/claude (wrapper symlink)\n~/.claude/discord-onboard.sh\n~/.claude/discord-setup.sh\n~/.claude/channels/discord/"
)
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

- [ ] **Step 2: Add PERSONAL_FILES and PERSONAL_DIRS after PERSONAL_DESCS (after line 92)**

Insert immediately after the closing `)` of PERSONAL_DESCS (line 92) and before `PERSONAL_PICKS=` (line 93):

```bash
PERSONAL_FILES=(
  "~/.config/ghostty/config (copy)"
  "~/.config/ghostty/shaders/ (symlinks)"
)
PERSONAL_DIRS=(
  "$REPO_DIR/ghostty"
  "$REPO_DIR/ghostty/shaders"
)
```

- [ ] **Step 3: Add personal arrays to the --personal merge block**

Find the block around line 184-186 that merges personal arrays:

```bash
  KEYS+=("${PERSONAL_KEYS[@]}")
  TITLES+=("${PERSONAL_TITLES[@]}")
  DESCS+=("${PERSONAL_DESCS[@]}")
```

Add two more lines:

```bash
  KEYS+=("${PERSONAL_KEYS[@]}")
  TITLES+=("${PERSONAL_TITLES[@]}")
  DESCS+=("${PERSONAL_DESCS[@]}")
  FILES+=("${PERSONAL_FILES[@]}")
  DIRS+=("${PERSONAL_DIRS[@]}")
```

- [ ] **Step 4: Verify syntax**

Run: `bash -n install.sh`
Expected: no output (clean syntax).

- [ ] **Step 5: Commit**

```bash
git add install.sh
git commit -m "feat: add FILES and DIRS arrays for component detail screen"
```

---

### Task 1: Replace action flow with detail screen

**Files:**
- Modify: `install.sh:872-924` (the action picker section inside the returning-user while loop)

- [ ] **Step 1: Read the current action section**

Read `install.sh` lines 870-925 to confirm the exact code to replace.

- [ ] **Step 2: Replace the action section**

Replace the block from `local current; current=$(effective_state "$pick")` (line 872) through the end of the `case "$action"` block (line 924, the line with `esac`) with the new detail screen + action loop.

The new code:

```bash
    local current; current=$(effective_state "$pick")
    local idx; idx=$(key_index "$pick")

    # Detail screen + action loop (loops back for non-destructive actions)
    while true; do
      clear
      print_yes_and_banner

      # Status badge
      local status_label
      case "$current" in
        active)        status_label="${GREEN}active${NC}" ;;
        inactive)      status_label="${YELLOW}inactive${NC}" ;;
        not-installed) status_label="${DIM}not installed${NC}" ;;
      esac

      # Title + status
      printf "${ACCENT}%s${NC}  %b\n" "$pick" "$status_label"
      printf "${DIM}%s${NC}\n\n" "${TITLES[$idx]}"

      # Description (wrapped to terminal width)
      local term_width
      term_width=$(tput cols 2>/dev/null || echo 80)
      if command -v gum >/dev/null 2>&1; then
        printf '%s' "${DESCS[$idx]}" | gum style --faint --width "$((term_width - 4))"
      else
        printf "${DIM}%s${NC}\n" "${DESCS[$idx]}" | fold -s -w "$((term_width - 4))"
      fi
      printf "\n"

      # Files list
      printf "${ACCENT}Files:${NC}\n"
      printf '%b\n' "${FILES[$idx]}" | while IFS= read -r fline; do
        printf "  ${DIM}%s${NC}\n" "$fline"
      done
      printf "\n"

      # Build action list
      local actions=()
      case "$current" in
        active)        actions=("deactivate") ;;
        inactive)      actions=("activate" "remove from state") ;;
        not-installed) actions=("install") ;;
      esac
      actions+=("view in Finder" "list files" "(back)")

      local action=""
      if command -v gum >/dev/null 2>&1; then
        action=$(printf '%s\n' "${actions[@]}" | \
          gum choose --header "Actions" \
            --header.foreground "#0e7490" \
            --cursor.foreground "#67e8f9" \
            --selected.foreground "#67e8f9" \
            --item.foreground "#ffffff") || break
      else
        printf "Actions:\n"
        local ai
        for ai in "${!actions[@]}"; do
          printf "  %d) %s\n" "$((ai+1))" "${actions[$ai]}"
        done
        printf "Pick: "
        local action_num=""
        [ -r /dev/tty ] && read -r action_num </dev/tty || break
        if [[ "$action_num" =~ ^[0-9]+$ ]] && [ "$action_num" -ge 1 ] && [ "$action_num" -le "${#actions[@]}" ]; then
          action="${actions[$((action_num-1))]}"
        else
          continue
        fi
      fi
      [[ -z "$action" || "$action" == "(back)" ]] && break

      case "$action" in
        "view in Finder")
          open "${DIRS[$idx]}" 2>/dev/null || warn "Could not open directory"
          sleep 0.3
          ;;
        "list files")
          printf "\n${ACCENT}Installed paths for %s:${NC}\n\n" "$pick"
          printf '%b\n' "${FILES[$idx]}" | while IFS= read -r fline; do
            local expanded="${fline/#\~/$HOME}"
            if [ -e "$expanded" ] || [ -L "$expanded" ]; then
              printf "  ${GREEN}%s${NC}\n" "$fline"
            else
              printf "  ${DIM}%s${NC}\n" "$fline"
            fi
          done
          printf "\n${DIM}(green = exists on this machine)${NC}\n"
          printf "\nPress enter to continue..."
          [ -r /dev/tty ] && read -r </dev/tty
          ;;
        install|activate)
          local logfile; logfile=$(mktemp)
          printf "\nInstalling %s...\n" "$pick"
          if _AMPERSAND_NO_SUMMARY=1 bash "$0" --only "$pick" --yes >"$logfile" 2>&1; then
            ok "$pick installed."
            current="active"
          else
            err "$pick install failed. Last 20 lines:"
            tail -20 "$logfile"
          fi
          rm -f "$logfile"
          sleep 1.0
          ;;
        deactivate)
          deactivate_component "$pick"
          state_set "$pick" "inactive"
          ok "$pick deactivated."
          current="inactive"
          sleep 0.8
          ;;
        "remove from state")
          state_set "$pick" "not-installed"
          ok "$pick cleared from state."
          current="not-installed"
          sleep 0.8
          ;;
      esac
    done
```

Key differences from the old code:
- The action section is now wrapped in its own `while true` loop so "view in Finder" and "list files" loop back to the detail screen
- The detail screen (title + description + files) renders before the action menu
- `current` is updated after activate/deactivate so the status badge refreshes without leaving the detail screen
- "list files" expands `~` to `$HOME` and color-codes paths that exist on the machine (green) vs not (dim)
- "view in Finder" calls `open` on the repo source directory from DIRS

- [ ] **Step 3: Verify syntax**

Run: `bash -n install.sh`
Expected: no output (clean syntax).

- [ ] **Step 4: Manual test - run the installer as a returning user**

Run: `bash install.sh`
Expected: pick a component, see the detail screen with title + description + files + action menu. Test:
1. "view in Finder" opens the directory and returns to detail screen
2. "list files" shows paths with green/dim coloring and waits for enter
3. "(back)" returns to the component picker
4. "deactivate"/"activate" works and updates the status badge

- [ ] **Step 5: Commit**

```bash
git add install.sh
git commit -m "feat: component detail screen with description, files, and expanded actions"
```

---

### Task 2: Update session memory

**Files:**
- Modify: `.claude/memory/session_2026-05-03_design-skills-suite.md`

- [ ] **Step 1: Add entry for the component detail screen work**

Append to the session memory file:

```markdown
## Component detail screen (install.sh)

Added detail screen to returning-user component picker. When selecting a component, users now see: title + status badge, the existing DESCS text (wrapped to terminal width), a file listing from new FILES array, and an expanded action menu with "view in Finder" and "list files" options that loop back to the detail screen.

New arrays: FILES (paths each component installs), DIRS (source directories for Finder). Personal components (ghostty, shaders) also get FILES/DIRS entries. --personal merge block updated to include both.

Files: install.sh
```

- [ ] **Step 2: Commit**

```bash
git add .claude/memory/session_2026-05-03_design-skills-suite.md
git commit -m "memory: component detail screen"
```
