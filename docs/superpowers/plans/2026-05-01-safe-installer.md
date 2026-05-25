# Safe Installer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every installer component additive and every uninstall clean, split the monolithic `claude` component into `brain` + `config`, and add descriptions to the returning-user picker.

**Architecture:** All changes are in `install.sh`. The `claude` component splits into `brain` (marker-guarded append to CLAUDE.md) and `config` (JSON-merge into settings.json + hook file copies). Every deactivation function is rewritten to remove only what we installed, verified by marker or symlink target. The returning-user picker gets inline descriptions.

**Tech Stack:** Bash 3.2 (macOS compat), python3 stdlib (JSON manipulation), gum (TUI, optional)

---

### Task 0: Rebrand colors - red logo, dark cyan accents

**Files:**
- Modify: `install.sh` (PURPLE variable, print_yes_and_banner, print_title_animated, gum style calls)

- [ ] **Step 1: Change the yes& ASCII banner to red**

In `print_yes_and_banner`, change the PURPLE local variable to red:
```bash
local LOGO_RED='\033[38;2;220;38;38m'  # #dc2626
```
Replace all `$PURPLE` references within that function with `$LOGO_RED`.

- [ ] **Step 2: Change the global PURPLE variable to dark cyan**

At the top of the file, replace:
```bash
PURPLE='\033[38;2;124;58;237m'  # #7c3aed
```
with:
```bash
CYAN_DARK='\033[38;2;14;116;144m'  # #0e7490
```
Then rename all remaining `$PURPLE` references throughout the file to `$CYAN_DARK` (sidebar headings, status displays, gum style borders, section titles, picks summary, etc.).

- [ ] **Step 3: Update print_title_animated gradient**

Change the gradient endpoints from purple-to-periwinkle to dark-cyan-to-light-cyan:
- Start: `#0e7490` (14, 116, 144)
- End: `#67e8f9` (103, 232, 249)
- Shimmer: `#cffafe` (207, 250, 254)

- [ ] **Step 4: Update gum style border-foreground values**

Replace `"#7c3aed"` with `"#0e7490"` in all gum style calls.
Replace gum selected.background `"#7c3aed"` with `"#0e7490"`.

- [ ] **Step 5: Update the text-fallback shortcut box border**

The non-gum shortcut box uses hardcoded `\033[38;2;124;58;237m`. Replace with `$CYAN_DARK`.

- [ ] **Step 6: Verify syntax**

Run: `bash -n install.sh`

- [ ] **Step 7: Commit**

```bash
git add install.sh
git commit -m "Rebrand installer: red yes& logo, dark cyan accents"
```

---

### Task 1: Split component arrays (KEYS, TITLES, DESCS, PICKS)

**Files:**
- Modify: `install.sh:51-91`

- [ ] **Step 1: Replace the KEYS/TITLES/DESCS/PICKS arrays**

Replace `claude` with `brain` and `config`. Add a new SHORT_DESCS array for the picker display. Update PICKS to match the new count (10 items).

```bash
# Public components - shipped to all users.
KEYS=(brain config memory skills statusline cmux nvm ampersand voice discord)
TITLES=(
  "Team rules + workflow (appended to CLAUDE.md)"
  "Hooks, plugins, permissions (merged into settings.json)"
  "Memory discipline rules + hooks"
  "UI polish + component gallery research"
  "Custom prompt bar"
  "cmux split-pane terminal"
  "Node version manager PATH fix"
  "Installer shortcut in terminal"
  "Voice transcription (whisper.cpp)"
  "Discord chat agent launcher"
)
DESCS=(
  "ADDITIVE: appends team rules (from RULES.md) and shared workflow (from CLAUDE.md) to your ~/.claude/CLAUDE.md between marker comments. Your existing CLAUDE.md content is preserved above and below the markers. If you have a claude/CLAUDE.local.md for personal overrides, those are appended in their own marker block too. Re-runs detect the markers and skip. Deactivation removes only the marked blocks."
  "ADDITIVE: JSON-merges safety hooks (bash-guard, content-guard, memory-approve), memory-write allow patterns, enabled plugins, and marketplace entries into your existing ~/.claude/settings.json. Does NOT touch your defaultMode, model, or other preferences. Copies hook scripts to ~/.claude/hooks/ alongside any hooks you already have. Deactivation removes only our entries by marker."
  "ADDITIVE: appends Memory Discipline rules to your CLAUDE.md between marker comments, JSON-merges three hooks (SessionStart loader, PreCompact reminder, PostCompact reload) into your settings.json, and symlinks the startup-check.sh loader. Does NOT replace or overwrite anything. Marker-guarded so re-runs are no-ops."
  "ADDITIVE: installs skills to ~/.claude/skills/. Bundles make-interfaces-feel-better (tactical UI polish via npx) and component-gallery-reference (researches component.gallery before building UI components). Does NOT touch your CLAUDE.md, settings.json, or hooks."
  "Symlinks statusline-command.sh into ~/.claude/. The settings.json statusLine command gracefully falls back if the script is missing, so unticking this just returns to Claude Code's default."
  "Symlinks cmux settings.json for the split-pane terminal browser preview. Skip if you don't use cmux."
  "Adds a one-liner to .zshrc that activates nvm's default Node so claude/node/npm are on PATH in new shells. Harmless no-op if nvm isn't installed. Skip if 'claude' already works in fresh terminals."
  "Adds the 'ampersand' function to .zshrc. Type 'ampersand' to re-launch the installer, 'ampersand --pull' to sync from GitHub first."
  "Brews whisper-cpp + ffmpeg, downloads the ggml-base.en model (~150 MB), symlinks ~/.claude/transcribe. Local voice-to-text, no cloud API. Deactivation removes the symlink but leaves brew packages alone."
  "Adds a smart 'Connect to Discord?' prompt to your 'claude' command. Symlinks onboarding and setup scripts to ~/.claude/. Tokens stored in macOS Keychain, never in the repo."
)
PICKS=(1 1 1 1 1 1 1 1 1 1)
```

- [ ] **Step 2: Update PERSONAL_KEYS**

No change needed - ghostty and shaders are independent of this split.

- [ ] **Step 3: Update apply_preset**

```bash
apply_preset() {
  case "$1" in
    all)     set_all 1 ;;
    none)    set_all 0 ;;
    minimal) set_all 0; set_pick brain 1; set_pick config 1; set_pick memory 1; set_pick skills 1; set_pick nvm 1 ;;
    *)       err "Unknown preset: $1 (valid: all, minimal, none)"; exit 2 ;;
  esac
}
```

- [ ] **Step 4: Update print_help valid keys list**

Replace `claude` with `brain, config` in the help text:
```
                                (brain, config, memory, skills, statusline, cmux, nvm, ampersand, voice, discord)
```

- [ ] **Step 5: Update the file header comment**

Replace `claude` line with:
```bash
#   brain       - Team rules + workflow (appended to CLAUDE.md) - ADDITIVE
#   config      - Hooks, plugins, permissions (merged into settings.json) - ADDITIVE
```

- [ ] **Step 6: Add backward compat for --only claude**

In `apply_only`, before the unknown-key error, add a migration:
```bash
    if [[ "$k" == "claude" ]]; then
      warn "'claude' has been split into 'brain' and 'config'. Selecting both."
      set_pick brain 1
      set_pick config 1
      continue
    fi
```

- [ ] **Step 7: Verify syntax**

Run: `bash -n install.sh`
Expected: no output (clean parse)

- [ ] **Step 8: Commit**

```bash
git add install.sh
git commit -m "Split claude component into brain + config in component arrays"
```

---

### Task 2: Rewrite detect_component and deactivation functions

**Files:**
- Modify: `install.sh:456-557`

- [ ] **Step 1: Rewrite detect_component**

Replace the `claude)` case with `brain)` and `config)`. Add `voice)` and `discord)`:

```bash
detect_component() {
  local key="$1"
  case "$key" in
    brain)      grep -Fq "<!-- claude-dotfiles:brain:begin -->" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null && echo active || echo not-installed ;;
    config)     [ -f "$CLAUDE_DIR/hooks/bash-guard.sh" ] && echo active || echo not-installed ;;
    memory)     grep -Fq "<!-- claude-dotfiles:memory-discipline:begin -->" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null && echo active || echo not-installed ;;
    skills)     { [ -d "$CLAUDE_DIR/skills/make-interfaces-feel-better" ] || [ -d "$CLAUDE_DIR/skills/component-gallery-reference" ]; } && echo active || echo not-installed ;;
    statusline) [ -L "$CLAUDE_DIR/statusline-command.sh" ] && echo active || echo not-installed ;;
    cmux)       [ -L "$HOME/.config/cmux/settings.json" ] && echo active || echo not-installed ;;
    nvm)        grep -Fq "nvm use default --silent" "$ZSHRC" 2>/dev/null && echo active || echo not-installed ;;
    ampersand)  grep -Fq "# === claude-dotfiles:shortcuts:begin ===" "$ZSHRC" 2>/dev/null && echo active || echo not-installed ;;
    voice)      [ -L "$CLAUDE_DIR/transcribe" ] && echo active || echo not-installed ;;
    discord)    grep -Fq "discord-chat-launcher.sh" "$ZSHRC" 2>/dev/null && echo active || echo not-installed ;;
    *)          echo not-installed ;;
  esac
}
```

- [ ] **Step 2: Write deactivate_brain**

```bash
deactivate_brain() {
  if [ -f "$CLAUDE_DIR/CLAUDE.md" ] && [ ! -L "$CLAUDE_DIR/CLAUDE.md" ]; then
    if grep -Fq "<!-- claude-dotfiles:brain:begin -->" "$CLAUDE_DIR/CLAUDE.md"; then
      sed -i.bak '/<!-- claude-dotfiles:brain:begin -->/,/<!-- claude-dotfiles:brain:end -->/d' "$CLAUDE_DIR/CLAUDE.md"
      rm -f "$CLAUDE_DIR/CLAUDE.md.bak"
    fi
    if grep -Fq "<!-- claude-dotfiles:local:begin -->" "$CLAUDE_DIR/CLAUDE.md"; then
      sed -i.bak '/<!-- claude-dotfiles:local:begin -->/,/<!-- claude-dotfiles:local:end -->/d' "$CLAUDE_DIR/CLAUDE.md"
      rm -f "$CLAUDE_DIR/CLAUDE.md.bak"
    fi
    # If CLAUDE.md is now empty (only whitespace), remove it
    if [ ! -s "$CLAUDE_DIR/CLAUDE.md" ] || ! grep -q '[^[:space:]]' "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null; then
      rm -f "$CLAUDE_DIR/CLAUDE.md"
    fi
  fi
  # Legacy: if CLAUDE.md is a symlink to our repo (old install), remove it
  if [ -L "$CLAUDE_DIR/CLAUDE.md" ] && [[ "$(readlink "$CLAUDE_DIR/CLAUDE.md")" == "$REPO_DIR/"* ]]; then
    rm -f "$CLAUDE_DIR/CLAUDE.md"
  fi
}
```

- [ ] **Step 3: Write deactivate_config**

```bash
deactivate_config() {
  # Remove hook scripts that are ours (check if they're symlinks to our repo OR contain our marker)
  local f
  for f in bash-guard.sh content-guard.sh memory-approve.sh; do
    if [ -L "$CLAUDE_DIR/hooks/$f" ] && [[ "$(readlink "$CLAUDE_DIR/hooks/$f")" == "$REPO_DIR/"* ]]; then
      rm -f "$CLAUDE_DIR/hooks/$f"
    elif [ -f "$CLAUDE_DIR/hooks/$f" ] && grep -Fq "claude-dotfiles" "$CLAUDE_DIR/hooks/$f" 2>/dev/null; then
      rm -f "$CLAUDE_DIR/hooks/$f"
    fi
  done

  # Remove startup-check.sh if ours
  if [ -L "$CLAUDE_DIR/startup-check.sh" ] && [[ "$(readlink "$CLAUDE_DIR/startup-check.sh")" == "$REPO_DIR/"* ]]; then
    rm -f "$CLAUDE_DIR/startup-check.sh"
  fi

  # Legacy: if settings.json is a symlink to our repo, remove it
  if [ -L "$CLAUDE_DIR/settings.json" ] && [[ "$(readlink "$CLAUDE_DIR/settings.json")" == "$REPO_DIR/"* ]]; then
    rm -f "$CLAUDE_DIR/settings.json"
  fi

  # JSON-remove our entries from settings.json (if it's a real file)
  if [ -f "$CLAUDE_DIR/settings.json" ] && [ ! -L "$CLAUDE_DIR/settings.json" ]; then
    python3 - "$CLAUDE_DIR/settings.json" <<'PYCONFIG'
import json, sys

path = sys.argv[1]
try:
    with open(path) as f:
        d = json.load(f)
except Exception:
    sys.exit(0)

# --- Hooks: remove entries containing our script names ---
OUR_HOOK_MARKERS = ["bash-guard.sh", "content-guard.sh", "memory-approve.sh"]
hooks = d.get("hooks", {})

for hook_type in ["PreToolUse"]:
    entries = hooks.get(hook_type, [])
    filtered = []
    for entry in entries:
        entry_str = json.dumps(entry)
        if not any(m in entry_str for m in OUR_HOOK_MARKERS):
            filtered.append(entry)
    if filtered:
        hooks[hook_type] = filtered
    elif hook_type in hooks:
        del hooks[hook_type]

# --- Permissions: remove our specific allow patterns ---
OUR_ALLOW_PATTERNS = [
    "Bash(npx create-next-app@latest:*)",
    "Bash(claude mcp:*)",
    "mcp__pencil",
]
# Also remove all memory-write patterns we add
MEMORY_PATTERN_PREFIXES = [
    "Write(**/.claude/memory/", "Edit(**/.claude/memory/", "MultiEdit(**/.claude/memory/",
    "Write(/Users/*/.claude/projects/", "Edit(/Users/*/.claude/projects/", "MultiEdit(/Users/*/.claude/projects/",
    "Write(/Users/**/memory/", "Edit(/Users/**/memory/", "MultiEdit(/Users/**/memory/",
    "Write(/home/**/memory/", "Edit(/home/**/memory/", "MultiEdit(/home/**/memory/",
    "Write(**/memory/", "Edit(**/memory/", "MultiEdit(**/memory/",
    "Write(**/MEMORY.md)", "Edit(**/MEMORY.md)", "MultiEdit(**/MEMORY.md)",
    "Write(.claude/memory/", "Edit(.claude/memory/", "MultiEdit(.claude/memory/",
    "Write(~/.claude/projects/", "Edit(~/.claude/projects/", "MultiEdit(~/.claude/projects/",
    "Write(**/*.md)", "Edit(**/*.md)", "MultiEdit(**/*.md)",
]

perms = d.get("permissions", {})
allow = perms.get("allow", [])
filtered_allow = []
for pat in allow:
    if pat in OUR_ALLOW_PATTERNS:
        continue
    if any(pat.startswith(prefix) for prefix in MEMORY_PATTERN_PREFIXES):
        continue
    filtered_allow.append(pat)
if filtered_allow:
    perms["allow"] = filtered_allow
elif "allow" in perms:
    del perms["allow"]

# --- Plugins: remove our specific plugins ---
OUR_PLUGINS = [
    "claude-md-management@claude-plugins-official",
    "figma@claude-plugins-official",
    "firebase@claude-plugins-official",
    "github@claude-plugins-official",
    "hookify@claude-plugins-official",
    "learning-output-style@claude-plugins-official",
    "semgrep@claude-plugins-official",
    "skill-creator@claude-plugins-official",
    "sentry@claude-plugins-official",
    "supabase@claude-plugins-official",
    "swift-lsp@claude-plugins-official",
    "superpowers@claude-plugins-official",
    "agent-sdk-dev@claude-plugins-official",
    "vercel@claude-plugins-official",
    "typescript-lsp@claude-plugins-official",
    "security-guidance@claude-plugins-official",
    "discord@claude-plugins-official",
    "feature-dev@claude-plugins-official",
    "ralph-loop@claude-plugins-official",
    "code-review@claude-plugins-official",
    "plugin-developer-toolkit@claude-plugins-official",
    "chrome-devtools@claude-plugins-official",
    "sidecoach",
]
plugins = d.get("enabledPlugins", {})
for p in OUR_PLUGINS:
    plugins.pop(p, None)
if not plugins and "enabledPlugins" in d:
    del d["enabledPlugins"]

# --- Marketplaces: remove ours ---
OUR_MARKETPLACES = ["sidecoach", "buildwithclaude"]
markets = d.get("extraKnownMarketplaces", {})
for m in OUR_MARKETPLACES:
    markets.pop(m, None)
if not markets and "extraKnownMarketplaces" in d:
    del d["extraKnownMarketplaces"]

# --- Clean up empty containers ---
if not hooks:
    d.pop("hooks", None)
if not perms.get("allow") and "defaultMode" not in perms:
    d.pop("permissions", None)

with open(path, "w") as f:
    json.dump(d, f, indent=2)
    f.write("\n")
PYCONFIG
  fi
}
```

- [ ] **Step 4: Write deactivate_voice**

```bash
deactivate_voice() {
  if [ -L "$CLAUDE_DIR/transcribe" ] && [[ "$(readlink "$CLAUDE_DIR/transcribe")" == "$REPO_DIR/"* ]]; then
    rm -f "$CLAUDE_DIR/transcribe"
  fi
}
```

- [ ] **Step 5: Write deactivate_discord**

```bash
deactivate_discord() {
  # Remove .zshrc launcher line
  if [ -f "$ZSHRC" ] && grep -Fq "discord-chat-launcher.sh" "$ZSHRC"; then
    sed -i.bak '/# Discord Chat Agent launcher/d; /discord-chat-launcher\.sh.*claude-dotfiles/d' "$ZSHRC"
    rm -f "$ZSHRC.bak"
  fi
  # Remove script symlinks if they point to our repo
  local f
  for f in discord-chat-launcher.sh discord-onboard.sh discord-setup.sh; do
    if [ -L "$CLAUDE_DIR/$f" ] && [[ "$(readlink "$CLAUDE_DIR/$f")" == "$REPO_DIR/"* ]]; then
      rm -f "$CLAUDE_DIR/$f"
    fi
  done
}
```

- [ ] **Step 6: Update deactivate_component dispatcher**

```bash
deactivate_component() {
  case "$1" in
    brain)      deactivate_brain ;;
    config)     deactivate_config ;;
    memory)     deactivate_memory ;;
    skills)     deactivate_skills ;;
    statusline) deactivate_statusline ;;
    cmux)       deactivate_cmux ;;
    nvm)        deactivate_nvm ;;
    ampersand)  deactivate_ampersand ;;
    voice)      deactivate_voice ;;
    discord)    deactivate_discord ;;
  esac
}
```

- [ ] **Step 7: Remove old deactivate_claude function entirely**

- [ ] **Step 8: Verify syntax**

Run: `bash -n install.sh`

- [ ] **Step 9: Commit**

```bash
git add install.sh
git commit -m "Rewrite detect and deactivate functions for additive components"
```

---

### Task 3: Rewrite install sections (brain + config replace claude)

**Files:**
- Modify: `install.sh:858-903` (old claude section)

- [ ] **Step 1: Replace the claude install section with brain**

Remove the old `# 1. Claude Code config` section (lines 858-903). Replace with:

```bash
# ============================================================
# 1. Brain (team rules + workflow, appended to CLAUDE.md)
# ============================================================

if picked brain; then
  echo ""
  info "--- Brain (team rules + workflow) ---"
  mkdir -p "$CLAUDE_DIR"

  BRAIN_BEGIN='<!-- claude-dotfiles:brain:begin -->'
  BRAIN_END='<!-- claude-dotfiles:brain:end -->'
  LOCAL_BEGIN='<!-- claude-dotfiles:local:begin -->'
  LOCAL_END='<!-- claude-dotfiles:local:end -->'
  TARGET_MD="$CLAUDE_DIR/CLAUDE.md"

  # Legacy migration: if CLAUDE.md is a symlink to our repo (old install), break it
  if [ -L "$TARGET_MD" ] && [[ "$(readlink "$TARGET_MD")" == "$REPO_DIR/"* ]]; then
    warn "Migrating legacy symlinked CLAUDE.md to a real file..."
    cp -L "$TARGET_MD" "$TARGET_MD.migrated"
    rm -f "$TARGET_MD"
    mv "$TARGET_MD.migrated" "$TARGET_MD"
  fi

  if [ ! -f "$TARGET_MD" ]; then
    touch "$TARGET_MD"
    info "Created $TARGET_MD"
  fi

  if grep -Fq "$BRAIN_BEGIN" "$TARGET_MD" 2>/dev/null; then
    # Update: remove old block and re-append (picks up RULES.md/CLAUDE.md changes)
    sed -i.bak "/$BRAIN_BEGIN/,/$BRAIN_END/d" "$TARGET_MD"
    rm -f "$TARGET_MD.bak"
  fi

  {
    printf '\n%s\n' "$BRAIN_BEGIN"
    cat "$REPO_DIR/claude/RULES.md"
    printf '\n'
    cat "$REPO_DIR/claude/CLAUDE.md"
    printf '\n%s\n' "$BRAIN_END"
  } >> "$TARGET_MD"
  ok "Team rules + workflow appended to $TARGET_MD (marker-guarded)"

  # CLAUDE.local.md - personal overrides in their own marker block
  if [ -f "$REPO_DIR/claude/CLAUDE.local.md" ]; then
    if grep -Fq "$LOCAL_BEGIN" "$TARGET_MD" 2>/dev/null; then
      sed -i.bak "/$LOCAL_BEGIN/,/$LOCAL_END/d" "$TARGET_MD"
      rm -f "$TARGET_MD.bak"
    fi
    {
      printf '\n%s\n' "$LOCAL_BEGIN"
      cat "$REPO_DIR/claude/CLAUDE.local.md"
      printf '\n%s\n' "$LOCAL_END"
    } >> "$TARGET_MD"
    info "Appended CLAUDE.local.md (personal overrides, marker-guarded)"
  fi
fi
```

- [ ] **Step 2: Add the config install section**

Insert after the brain section:

```bash
# ============================================================
# 2. Config (hooks, plugins, permissions merged into settings.json)
# ============================================================

if picked config; then
  echo ""
  info "--- Config (hooks, plugins, permissions) ---"
  mkdir -p "$CLAUDE_DIR/hooks"

  USER_SETTINGS="$CLAUDE_DIR/settings.json"

  # Legacy migration: if settings.json is a symlink to our repo, break it
  if [ -L "$USER_SETTINGS" ] && [[ "$(readlink "$USER_SETTINGS")" == "$REPO_DIR/"* ]]; then
    warn "Migrating legacy symlinked settings.json to a real file..."
    cp -L "$USER_SETTINGS" "$USER_SETTINGS.migrated"
    rm -f "$USER_SETTINGS"
    mv "$USER_SETTINGS.migrated" "$USER_SETTINGS"
  fi

  if [ ! -f "$USER_SETTINGS" ]; then
    echo '{}' > "$USER_SETTINGS"
    info "Created $USER_SETTINGS"
  fi

  # Copy hook scripts (not symlink - avoids runtime repo dependency)
  for f in bash-guard.sh content-guard.sh memory-approve.sh; do
    if [ -f "$REPO_DIR/claude/hooks/$f" ]; then
      cp "$REPO_DIR/claude/hooks/$f" "$CLAUDE_DIR/hooks/$f"
      chmod +x "$CLAUDE_DIR/hooks/$f"
      ok "hooks/$f"
    fi
  done

  # Copy startup-check.sh
  cp "$REPO_DIR/claude/startup-check.sh" "$CLAUDE_DIR/startup-check.sh"
  chmod +x "$CLAUDE_DIR/startup-check.sh"
  ok "startup-check.sh"

  # JSON-merge our entries into settings.json
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$USER_SETTINGS" "$REPO_DIR/claude/settings.json" <<'PYMERGE'
import json, sys

user_path = sys.argv[1]
repo_path = sys.argv[2]

with open(user_path) as f:
    user = json.load(f)
with open(repo_path) as f:
    repo = json.load(f)

# --- Hooks: merge by marker (script name in command string) ---
user_hooks = user.setdefault("hooks", {})
repo_hooks = repo.get("hooks", {})

for hook_type, repo_entries in repo_hooks.items():
    existing = user_hooks.get(hook_type, [])
    for repo_entry in repo_entries:
        repo_str = json.dumps(repo_entry)
        # Check if this entry (by its command strings) already exists
        already = False
        for ex in existing:
            # Match on the primary command string
            for rh in repo_entry.get("hooks", []):
                cmd = rh.get("command", "")
                if cmd and cmd in json.dumps(ex):
                    already = True
                    break
            if already:
                break
        if not already:
            existing.append(repo_entry)
    user_hooks[hook_type] = existing

# --- Permissions: merge allow patterns ---
user_perms = user.setdefault("permissions", {})
user_allow = user_perms.setdefault("allow", [])
repo_allow = repo.get("permissions", {}).get("allow", [])
for pat in repo_allow:
    if pat not in user_allow:
        user_allow.append(pat)
# Do NOT touch defaultMode - that's the user's choice

# --- Plugins: merge (add ours, don't remove theirs) ---
repo_plugins = repo.get("enabledPlugins", {})
user_plugins = user.setdefault("enabledPlugins", {})
for name, val in repo_plugins.items():
    if name not in user_plugins:
        user_plugins[name] = val

# --- Marketplaces: merge ---
repo_markets = repo.get("extraKnownMarketplaces", {})
user_markets = user.setdefault("extraKnownMarketplaces", {})
for name, val in repo_markets.items():
    if name not in user_markets:
        user_markets[name] = val

# --- StatusLine: merge only if user doesn't have one ---
if "statusLine" not in user and "statusLine" in repo:
    user["statusLine"] = repo["statusLine"]

with open(user_path, "w") as f:
    json.dump(user, f, indent=2)
    f.write("\n")
PYMERGE
    ok "Hooks, plugins, permissions merged into $USER_SETTINGS"
  else
    warn "python3 not found - cannot merge settings.json. Install python3 and re-run."
  fi
fi
```

- [ ] **Step 3: Renumber subsequent section comments**

Old section 2 (memory) becomes 3, old 3 (skills) becomes 4, etc. through the file.

- [ ] **Step 4: Move Discord script symlinks from old claude section to discord section**

In the discord install section, add after the .zshrc source line:

```bash
  # Symlink Discord scripts
  for f in discord-chat-launcher.sh discord-onboard.sh discord-setup.sh; do
    if [ -f "$REPO_DIR/claude/$f" ]; then
      make_symlink "$REPO_DIR/claude/$f" "$CLAUDE_DIR/$f"
      chmod +x "$REPO_DIR/claude/$f"
    fi
  done
```

Remove the warning about "claude component is unselected" since discord now self-installs its scripts.

- [ ] **Step 5: Remove shared memory file symlinks from old claude section**

Memory file symlinks stay in the memory component section (they're already there via the `memory` component flow). The old claude section's `for f in claude/memory/*.md` loop is deleted.

- [ ] **Step 6: Verify syntax**

Run: `bash -n install.sh`

- [ ] **Step 7: Commit**

```bash
git add install.sh
git commit -m "Additive brain + config install sections, Discord scripts moved"
```

---

### Task 4: Add descriptions to returning-user picker

**Files:**
- Modify: `install.sh:683-713` (returning_flow action loop)

- [ ] **Step 1: Update the status table to show descriptions**

Replace the component status display loop:

```bash
    printf "${PURPLE}Components${NC}\n"
    local i status display
    for i in "${!KEYS[@]}"; do
      status=$(effective_state "${KEYS[$i]}")
      case "$status" in
        active)        display="${GREEN}active${NC}" ;;
        inactive)      display="${YELLOW}inactive${NC}" ;;
        not-installed) display="${DIM}not installed${NC}" ;;
      esac
      printf "  %-12s %-20b ${DIM}%s${NC}\n" "${KEYS[$i]}" "$display" "${TITLES[$i]}"
    done
```

- [ ] **Step 2: Update the gum choose picker to show descriptions**

Replace the picker item generation to include titles:

```bash
    local pick=""
    if command -v gum >/dev/null 2>&1; then
      local picker_items=()
      for k in "${KEYS[@]}"; do
        local idx; idx="$(key_index "$k")"
        picker_items+=("$k - ${TITLES[$idx]}")
      done
      picker_items+=("(quit)")
      local raw_pick
      raw_pick=$(printf '%s\n' "${picker_items[@]}" | \
        gum choose --header "Pick a component, or quit" \
          --cursor.foreground "#a5b4fc" \
          --selected.foreground "#a5b4fc" \
          --item.foreground "#ffffff") || break
      # Extract just the key (before the " - ")
      pick="${raw_pick%% - *}"
      pick="${pick%% *}"
    else
      printf "Components: %s\nPick (or 'quit'): " "${KEYS[*]}"
      [ -r /dev/tty ] && read -r pick </dev/tty || break
    fi
```

- [ ] **Step 3: Verify syntax**

Run: `bash -n install.sh`

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "Add descriptions to returning-user component picker"
```

---

### Task 5: Update post-install summary and state migration

**Files:**
- Modify: `install.sh:1346-1508`

- [ ] **Step 1: Update "What was installed" summary lines**

Replace `picked claude` lines with `picked brain` and `picked config`:

```bash
picked brain    && echo "  - Brain: team rules + workflow appended to CLAUDE.md (marker-guarded, your existing content preserved)"
picked config   && echo "  - Config: hooks, plugins, permissions merged into settings.json (your existing settings preserved)"
```

- [ ] **Step 2: Update NEED_CC / NEED_PLUGINS logic**

```bash
picked brain     && NEED_CC=1
picked config    && { NEED_CC=1; NEED_PLUGINS=1; }
```

- [ ] **Step 3: Update Sidecoach workflow section**

Change `picked claude` to `picked config` (sidecoach is a plugin, lives in config).

- [ ] **Step 4: Add state-file migration for legacy claude -> brain + config**

In the bootstrap-from-disk section (around line 793), add migration logic:

```bash
  # Migrate legacy 'claude' state to brain + config
  if [ -f "$STATE_FILE" ]; then
    local legacy_claude
    legacy_claude=$(state_get "claude")
    if [ -n "$legacy_claude" ]; then
      state_set "brain" "$legacy_claude"
      state_set "config" "$legacy_claude"
      python3 -c "
import json
with open('$STATE_FILE') as f: d = json.load(f)
d.get('components', {}).pop('claude', None)
with open('$STATE_FILE', 'w') as f: json.dump(d, f, indent=2)
"
    fi
  fi
```

- [ ] **Step 5: Verify syntax**

Run: `bash -n install.sh`

- [ ] **Step 6: Commit**

```bash
git add install.sh
git commit -m "Update summary, state migration for brain + config split"
```

---

### Task 6: Final verification and integration commit

**Files:**
- Modify: `install.sh`

- [ ] **Step 1: Full syntax check**

Run: `bash -n install.sh`
Expected: clean (no output)

- [ ] **Step 2: Dry-run test**

Run: `bash install.sh --dry-run --yes`
Expected: shows all 10 components selected, no files touched

- [ ] **Step 3: Test --only backward compat**

Run: `bash install.sh --dry-run --only claude`
Expected: deprecation warning, brain + config selected

- [ ] **Step 4: Test --only with new names**

Run: `bash install.sh --dry-run --only brain,config`
Expected: brain + config selected, no warning

- [ ] **Step 5: Test --preset minimal**

Run: `bash install.sh --dry-run --preset minimal`
Expected: brain, config, memory, skills, nvm selected

- [ ] **Step 6: Write memory update**

Update `.claude/memory/session_2026-05-01_safe-installer.md` with what was built.

- [ ] **Step 7: Final commit and push**

```bash
git add install.sh docs/
git commit -m "Safe installer: all components additive, clean uninstall, informed picks

Splits monolithic claude component into brain (marker-guarded CLAUDE.md
append) and config (JSON-merge into settings.json). Every component is
now additive - nothing is replaced or overwritten. Every deactivation
removes only what we installed, verified by marker or symlink target.
Returning-user picker shows descriptions alongside component names.
Discord scripts moved to discord component. Voice and discord get
proper deactivation functions. Legacy claude state migrates to
brain + config automatically."
git push origin main
```
