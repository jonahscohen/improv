#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Improv installer
# Interactive TUI over twelve components:
#   brain        - Team rules + workflow (appended to CLAUDE.md) - ADDITIVE
#   config       - Hooks, plugins, permissions (merged into settings.json) - ADDITIVE
#   memory       - Additive memory subsystem (rules + 3 hooks + startup-check.sh loader)
#   skills       - Anthropic Skills (tactical-polish + component-gallery-reference + fontshare-reference + curate + design-references + motion-reference + design-build)
#   statusline   - Custom prompt-bar render (~/.claude/statusline-command.sh)
#   cmux         - cmux settings.json symlink
#   nvm          - .zshrc auto-activate of nvm default (so claude/node/npm land on PATH)
#   ampersand    - .zshrc 'ampersand' shell shortcut
#   discord      - smart Discord-launcher source line in .zshrc + onboarding script
#   voice-input  - whisper.cpp + ffmpeg + transcribe CLI for voice-message input
#   voice-output - OpenAI TTS MCP server for spoken responses
#   reflect      - Memory corpus analysis (reflect skill + nudge hook)
#   task-list    - Global /task-list slash command + TASKS.md at dotfiles root
#
# Flags:
#   --yes              non-interactive, pick all components
#   --only KEYS        non-interactive, pick comma-separated keys (e.g. brain,config,memory)
#   --preset NAME      non-interactive preset: all | minimal | none
#                      minimal = brain + config + memory + skills + nvm
#   --dry-run          print picks and exit; touches no files
#   --help             print usage
#
# Idempotent. Safe to re-run.
# ============================================================

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$REPO_DIR/.backups/$(date +%Y%m%d-%H%M%S)"
BACKED_UP=0
SHORTCUTS_NEW=0  # Set to 1 when the .zshrc shortcut block is newly written/migrated/refreshed this run

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
ACCENT='\033[38;2;14;116;144m'  # #0e7490 - matches header box border + gradient start
DIM='\033[2m'
NC='\033[0m'

info()  { printf "${CYAN}[info]${NC}  %s\n" "$1"; }
ok()    { printf "${GREEN}[ok]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[warn]${NC}  %s\n" "$1"; }
err()   { printf "${RED}[error]${NC} %s\n" "$1"; }
log()   { printf "${CYAN}[info]${NC}  %s\n" "$1"; }  # alias for info (used by sidecoach block)

# Bucket-browser accessor library (pure functions over claude/hooks/browser-tree.json).
# Sourcing only defines functions - browser_load is invoked later, inside the browser
# flow, never at top level. Guarded so a missing file never aborts the installer.
if [ -f "$REPO_DIR/claude/hooks/browser-lib.sh" ]; then
  source "$REPO_DIR/claude/hooks/browser-lib.sh"
else
  warn "browser-lib.sh not found - bucket browser accessors unavailable"
fi

# Copy from repo to ~/.claude, clearing any pre-existing destination first.
# Without this, an old install that symlinked the destination back to the same
# source file would cause `cp` to bail with "are identical (not copied)" under
# `set -e`. Use everywhere we copy a tracked file from $REPO_DIR into the user dir.
safe_cp() { rm -f "$2"; cp "$1" "$2"; }

# ------------------------------------------------------------
# link_or_copy: how a HOOK reaches ~/.claude/hooks.
#
# SYMLINK when this install is running from a git checkout that will stay put (a dev
# machine), COPY when it is not (someone who ran the installer from a throwaway clone
# and deleted it - a symlink would dangle and every hook would be dead).
#
# Why this is not cosmetic: a hook deployed as a real FILE is pinned to whatever it
# was on the day it was copied, forever, with no signal that it has gone stale. That
# is not hypothetical - justify-source-guard.sh sat frozen at a pre-rename source path
# for a month, printing a directory that no longer existed, while its repo source was
# correct the entire time. Its four siblings were frozen the same way. Copy-deployment
# is what made a `git pull` silently not reach the code that actually runs.
#
# Idempotent by design: an already-correct symlink is LEFT ALONE, never recreated. The
# previous behavior (safe_cp = `rm -f` then `cp`) would happily delete a good symlink
# and write a frozen copy over it, so merely re-running the installer on a dev machine
# re-introduced the bug across every hook at once.
#
# Override: IMPROV_HOOK_DEPLOY=symlink|copy|auto  (default auto).
hook_deploy_mode() {
  case "${IMPROV_HOOK_DEPLOY:-auto}" in
    symlink) printf 'symlink' ;;
    copy)    printf 'copy' ;;
    *)
      # A .git checkout is necessary but NOT sufficient. `git clone /tmp/improv &&
      # ./install.sh && rm -rf /tmp/improv` has a .git too, and linking into it would
      # leave all 65 hooks dangling the moment the clone is deleted - a dead harness,
      # which is worse than a frozen one. So a repo sitting in a TEMP location is
      # treated as throwaway and gets copies.
      local tmp_root="${TMPDIR:-/nonexistent}"
      tmp_root="${tmp_root%/}"
      # /private/* variants matter: on macOS /var and /tmp are symlinks INTO /private,
      # so a resolved physical path lands on /private/var/folders/... and would slip a
      # pattern that only knew the logical name.
      case "$REPO_DIR" in
        /tmp/*|/private/tmp/*|/var/tmp/*|/private/var/tmp/*|\
        /var/folders/*|/private/var/folders/*|"$tmp_root"/*)
          printf 'copy'
          return 0
          ;;
      esac
      if [ -d "$REPO_DIR/.git" ] || [ -f "$REPO_DIR/.git" ]; then
        printf 'symlink'
      else
        printf 'copy'
      fi
      ;;
  esac
}

link_or_copy() {
  local src="$1" dst="$2"

  # A missing source must FAIL, loudly. safe_cp would have died here under `set -e`;
  # returning 0 instead would print "ok hooks/x.sh" while the destination stayed
  # missing or stale, which is the quietest possible way to ship a broken harness.
  if [ ! -f "$src" ]; then
    err "hook source missing: $src"
    return 1
  fi

  local mode
  mode="$(hook_deploy_mode)"

  # settings.json invokes every hook DIRECTLY (~/.claude/hooks/x.sh, no `bash` in
  # front), so the exec bit is load-bearing. The old copy path ran chmod +x on the
  # DESTINATION, which quietly rescued any source that was missing it. A symlink has no
  # mode of its own - it inherits the SOURCE's - so in symlink mode that guarantee has
  # to move to the source. If the source cannot be made executable (a read-only
  # checkout), fall back to COPY: a working copy beats a dead link.
  if [ "$mode" = "symlink" ] && [ ! -x "$src" ]; then
    if ! chmod +x "$src" 2>/dev/null; then
      warn "cannot chmod +x $src - deploying a copy instead so the hook still runs"
      mode="copy"
    fi
  fi

  if [ "$mode" = "symlink" ]; then
    if [ -L "$dst" ] && [ "$(readlink "$dst")" = "$src" ]; then
      return 0                       # already linked correctly - do not churn it
    fi
    # Only a REAL file gets backed up; backup_if_exists already ignores symlinks.
    if declare -f backup_if_exists >/dev/null 2>&1; then
      backup_if_exists "$dst"
    fi
    mkdir -p "$(dirname "$dst")"
    rm -f "$dst"
    ln -s "$src" "$dst"
  else
    mkdir -p "$(dirname "$dst")"
    # Back up a DIFFERENT real file before overwriting (e.g. a user's same-named
    # hook) - but do not churn our own byte-identical re-install.
    if [ -e "$dst" ] && ! cmp -s "$dst" "$src" 2>/dev/null && declare -f backup_if_exists >/dev/null 2>&1; then
      backup_if_exists "$dst"
    fi
    rm -f "$dst"                     # clears a stale symlink, so nothing dangles
    cp "$src" "$dst"
    chmod +x "$dst" 2>/dev/null || true
  fi
}

# ------------------------------------------------------------
# prune_broken_skill_symlinks: remove DEAD skill symlinks under ~/.claude/skills.
#
# A skill deployed as a symlink into this repo dangles the moment the repo stops
# shipping that skill (renamed, retired, path changed). Those broken links pile up
# in ~/.claude/skills and Claude Code still tries to load them. This clears them -
# but only the ones THIS repo is responsible for, and only once the target is gone.
#
# HARD SAFETY RULES (all enforced, none optional):
#   - Symlinks only. A real file or real directory is never touched.
#   - Broken only. A link whose target still EXISTS (a live skill) is never touched.
#   - Repo-owned only. A link whose resolved target is OUTSIDE $REPO_DIR is never
#     touched - that is someone else's link, not part of our deploy footprint.
#   - Direct children of skills/ only - exactly where install.sh deploys skills.
#   - DRY RUN by default. It prints what it WOULD remove and mutates nothing. A real
#     removal happens only in "apply" mode, which the CLI reaches only via the
#     explicit --prune-skills-apply flag (human approval). An unattended
#     --yes / --only / --preset install never invokes this, so it never mutates
#     ~/.claude on its own.
#
# Args:  $1 = mode: "dryrun" (default) or "apply".
# Reads: $HOME (-> ~/.claude/skills) and $REPO_DIR (the footprint boundary).
# Returns: 0 on success; 5 if $REPO_DIR cannot be resolved (footprint unknown -
#          refuse to prune rather than guess); 6 if an apply-mode removal fails.
prune_broken_skill_symlinks() {
  local mode="${1:-dryrun}"
  local skills_dir="$HOME/.claude/skills"

  # The footprint boundary. If the repo path cannot be canonicalized we cannot
  # PROVE a target lives inside it, so we prune nothing and say so. Guessing the
  # boundary is exactly how you delete a link you never deployed.
  local repo_canon
  if ! repo_canon="$(cd "$REPO_DIR" 2>/dev/null && pwd -P)"; then
    err "prune: cannot resolve REPO_DIR ($REPO_DIR) - refusing to prune"
    return 5
  fi

  if [ ! -d "$skills_dir" ]; then
    info "prune: no skills directory at $skills_dir - nothing to prune"
    return 0
  fi

  local found=0 removed=0
  local link tgt tgt_abs tgt_dir tgt_base canon_dir canon inside
  for link in "$skills_dir"/*; do
    # Symlinks only. Skips real dirs/files AND the un-expanded glob when the dir is
    # empty (that literal is neither a symlink nor extant).
    if [ ! -L "$link" ]; then continue; fi
    # Broken only. -e follows the link, so a live target makes this true -> skip.
    if [ -e "$link" ]; then continue; fi

    tgt="$(readlink "$link")" || continue
    # Resolve to an absolute path (install writes absolute targets, but be safe).
    case "$tgt" in
      /*) tgt_abs="$tgt" ;;
      *)  tgt_abs="$(cd "$(dirname "$link")" 2>/dev/null && pwd -P)/$tgt" ;;
    esac
    # Multi-hop chains are unprovable: if the immediate target is ITSELF a symlink,
    # this broken link's ULTIMATE residence cannot be proven in-repo (the next hop can
    # point anywhere - e.g. an in-repo proxy that itself points outside), so fail SAFE
    # and skip. We only prune when the immediate target is a real, non-symlink path
    # whose parent canonicalizes inside the repo.
    if [ -L "$tgt_abs" ]; then continue; fi
    tgt_dir="$(dirname "$tgt_abs")"
    tgt_base="$(basename "$tgt_abs")"

    # "Inside repo?" The leaf is gone, so canonicalize the PARENT (physical, which
    # also collapses /tmp -> /private/tmp the way $REPO_DIR already is) and re-append
    # the leaf. If the parent CANNOT be canonicalized (its subtree is gone too) we
    # cannot PROVE the target resolves inside the repo - a lexical prefix match is not
    # proof, because an intermediate symlink on the vanished path could have pointed
    # out of the repo - so we fail SAFE and skip it. Only a canonically-proven in-repo
    # target is ever pruned.
    inside=0
    if canon_dir="$(cd "$tgt_dir" 2>/dev/null && pwd -P)"; then
      canon="$canon_dir/$tgt_base"
      case "$canon" in "$repo_canon"/*) inside=1 ;; esac
    fi
    if [ "$inside" != "1" ]; then continue; fi

    found=$((found + 1))
    if [ "$mode" = "apply" ]; then
      if rm -f "$link"; then
        removed=$((removed + 1))
        ok "prune: removed dead skill link $link -> $tgt"
      else
        err "prune: failed to remove $link"
        return 6
      fi
    else
      warn "prune: would remove dead skill link $link -> $tgt"
    fi
  done

  if [ "$found" -eq 0 ]; then
    info "prune: no dead repo-sourced skill links under $skills_dir"
  elif [ "$mode" = "apply" ]; then
    ok "prune: removed $removed dead skill link(s)"
  else
    info "prune: $found dead skill link(s) would be removed (dry run) - re-run with --prune-skills-apply to remove"
  fi
  return 0
}

# Sourcing this file with IMPROV_INSTALL_LIB_ONLY=1 defines the helpers above and
# returns WITHOUT running the installer. test-install-hook-deploy.sh uses this to
# exercise link_or_copy against temp directories - the installer writes into
# ~/.claude, so a test that actually ran it could destroy every live hook.
#
# Matched against exactly "1", not merely non-empty: an inherited IMPROV_INSTALL_LIB_ONLY=0
# from some parent shell would otherwise make a normal `./install.sh` exit 0 having
# silently installed nothing, and report success doing it.
if [ "${IMPROV_INSTALL_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || exit 0
fi

# ============================================================
# Component catalogue (parallel arrays for bash 3.2 compatibility)
# ============================================================

# Public components - shipped to all users.
KEYS=(brain config memory skills statusline cmux nvm ampersand discord voice-input voice-output reflect sidecoach task-list)
TITLES=(
  "Team rules + workflow (appended to CLAUDE.md)"
  "Hooks, plugins, permissions (merged into settings.json)"
  "Memory discipline rules + hooks"
  "Design pipeline (research, typography, motion, references) + 4 peer skills"
  "Custom prompt bar"
  "cmux split-pane terminal"
  "Node version manager PATH fix"
  "Installer shortcut in terminal"
  "Discord chat agent launcher"
  "Voice transcription (whisper.cpp)"
  "Voice output (OpenAI TTS)"
  "Memory corpus analysis (reflect)"
  "Sidecoach workflow automation (14 design/dev flows)"
  "Dotfiles task list (/task-list + TASKS.md)"
)
DESCS=(
  "ADDITIVE: appends team rules (from RULES.md) and shared workflow (from CLAUDE.md) to your ~/.claude/CLAUDE.md between marker comments. Your existing CLAUDE.md content is preserved above and below the markers. If you have a claude/CLAUDE.local.md for personal overrides, those are appended in their own marker block too. Re-runs detect the markers and skip. Deactivation removes only the marked blocks."
  "ADDITIVE: JSON-merges safety hooks (bash-guard, content-guard, memory-approve), memory-write allow patterns, enabled plugins, and marketplace entries into your existing ~/.claude/settings.json. Does NOT touch your defaultMode, model, or other preferences. Copies hook scripts to ~/.claude/hooks/ alongside any hooks you already have. Deactivation removes only our entries by marker."
  "ADDITIVE memory subsystem: appends our Memory Discipline rules (loading order, per-task updates, file format) to your CLAUDE.md between marker comments, JSON-merges three hooks (SessionStart loader, PreCompact reminder, PostCompact reload) into your settings.json, and symlinks the startup-check.sh loader. Does NOT replace or overwrite anything - all changes are marker-guarded so re-runs are no-ops, and the markers can be removed cleanly if you ever want to undo. Pick this if your team wants to beef up an existing Claude Code with persistent memory capability without losing their config."
  "Adds skills to ~/.claude/skills/, fully additive. Bundles tactical-polish (tactical UI polish, bundled file), component-gallery-reference (researches component.gallery before building UI components), fontshare-reference (researches fontshare.com before picking typefaces), motion-reference (canonical GSAP + Lenis patterns for animation/scroll/transition work), design-build (the design pipeline orchestrator - one command runs strategy/research/typography/motion/build/QA in sequence with gate checkpoints), and a personal design-reference system: curate (capture wizard via /curate) + design-references (auto-consults your personal catalog of one-off patterns at ~/.claude/design-references/). Does NOT touch your CLAUDE.md, settings.json, hooks, or statusline. Safe to pick standalone if you have your own Claude Code config and just want the skill capability."
  "Symlinks our statusline-command.sh into ~/.claude/. The settings.json statusLine command is tolerant of a missing script, so unticking this cleanly falls back to no custom statusline (Claude Code's default takes over). Pick this if you like our prompt-bar render; skip if you prefer Claude Code's default or a different statusline you've configured yourself."
  "Settings for cmux, the split-pane terminal that hosts the in-app browser preview Claude uses to verify your UI work. Skip if you don't use cmux."
  "A small one-line addition to your zsh config that fixes a specific issue some setups hit: opening a new terminal and getting 'claude not found in PATH' even though Claude is installed. The fix only activates if your zsh config already loads nvm (Node Version Manager) - on most machines this is a harmless no-op, so it's safe to leave on. If 'claude' already runs fine in fresh terminals on your machine, you can skip this."
  "Adds the 'ampersand' zsh function to your .zshrc. Type 'ampersand' from any terminal to re-launch this installer; type 'ampersand --pull' to pull the latest from GitHub first. Forwards every other flag ('ampersand --preset minimal', 'ampersand --pull --yes'). bootstrap.sh pre-installs this for new users so the curl one-liner is enough."
  "Adds a smart 'Connect to Discord?' prompt to your 'claude' command. Three states: cold (no bot configured) offers the interactive onboarding walkthrough or 'never ask again'; mid (bot configured but no users paired) jumps you to the pairing flow; warm (paired) shows the familiar 5-second connect prompt with default Yes. The walkthrough handles both 'I have a bot, just paste the token' and 'walk me through making a new bot in the Developer Portal'. Skip this if you don't use Discord with Claude. Tokens are stored in macOS Keychain, never in the repo."
  "Adds local voice-to-text so Claude can answer Discord voice messages and any other audio attachment. Brews whisper-cpp and ffmpeg, downloads the ggml-base.en model (~150 MB) into ~/.cache/whisper, and symlinks bin/transcribe to ~/.claude/transcribe. Local-only (no cloud, no API key). Calls: '~/.claude/transcribe path/to/audio.ogg' prints the transcript on stdout."
  "Gives Claude a voice via OpenAI text-to-speech API. Claude speaks short verbal summaries while keeping code and technical detail as text. Requires your own OpenAI API key stored in macOS Keychain (see docs). Starts muted - enable with voice-on in any terminal. Three mute controls: in-session (mute yourself), terminal alias (voice-on/voice-off), or manual file toggle. Does NOT work without an API key - this is not optional, it is required."
  "Adds the reflect skill and nudge hook. The reflect skill spawns 5 parallel analysis agents against your accumulated .claude/memory/ files to surface patterns, tensions, and gaps nobody explicitly noticed. Triggers naturally from conversation ('what patterns are you seeing?') or via /reflect. A SessionStart hook nudges you when enough new memories have accumulated since the last reflection. No external dependencies."
  "Sidecoach: invisible workflow automation triggered by natural conversation. No slash commands. Instead of slash commands, simply write naturally about your work ('make this feel better', 'design a component', 'review this') and Sidecoach detects your intent and guides you through the appropriate workflow. Daemon launches at session start and monitors messages silently. Provides 14 design/development flows covering polish, review, design, implementation, accessibility, refactoring, and iteration. Each flow returns tailored guidance, checklists (6-14 items), and next steps. Built via SessionStart hook (daemon launcher), PostUserPrompt hook (message intake), and PostResponse hook (result injection). Symlinks hooks into ~/.claude/hooks/ and compiles TypeScript orchestrator + 14 handlers."
  "Adds the /task-list slash-command skill at ~/.claude/skills/task-list/. Manages a single TASKS.md at the dotfiles repo root, organized by area (sidecoach, justify, marketing-site, dotfiles) with Active/Blocked/Done sub-sections. Verbs: add, list, done, edit, remove, block, unblock, show. Area inferred from cwd; IDs monotonic T-NNNN. Always operates on the dotfiles TASKS.md regardless of where you invoke it from. No hooks, no external deps."
)
FILES=(
  # brain
  "~/.claude/CLAUDE.md (marker block)"
  # config
  "~/.claude/settings.json (JSON merge)\n~/.claude/hooks/bash-guard.sh\n~/.claude/hooks/content-guard.sh\n~/.claude/hooks/memory-approve.sh"
  # memory
  "~/.claude/CLAUDE.md (memory discipline block)\n~/.claude/settings.json (3 hooks merged)\n~/.claude/startup-check.sh (symlink)"
  # skills
  "~/.claude/skills/tactical-polish/\n~/.claude/skills/component-gallery-reference/\n~/.claude/skills/fontshare-reference/\n~/.claude/skills/motion-reference/\n~/.claude/skills/design-build/\n~/.claude/skills/curate/\n~/.claude/skills/design-references/\n~/.claude/design-references/ (personal catalog directory)\n~/.claude/skills/social-media/\n~/.claude/skills/design-team/\n~/.claude/skills/visual-effects/\n~/.claude/skills/icon-source/"
  # statusline
  "~/.claude/statusline-command.sh (symlink)"
  # cmux
  "~/.config/cmux/settings.json (symlink)\n~/.claude/hooks/resume-guard.sh\n~/.claude/hooks/resume-toggle.sh\n~/.claude/toggle-resume.sh\n~/.claude/claude-teams-launcher.sh\n~/.zshrc (teams launcher block)"
  # nvm
  "~/.zshrc (one-line addition)"
  # ampersand
  "~/.zshrc (ampersand function block)"
  # discord
  "~/.claude/claude (wrapper symlink)\n~/.claude/discord-onboard.sh\n~/.claude/discord-setup.sh\n~/.claude/channels/discord/"
  # voice-input
  "~/.claude/transcribe (symlink)\n~/.cache/whisper/ggml-base.en.bin\nwhisper-cpp (brew)\nffmpeg (brew)"
  # voice-output
  "~/.claude/voice-output/server.js\n~/.claude/tts-generate (symlink)\n~/.claude/.voice-config\n~/.claude/.voice-enabled (toggle)\n~/.claude/hooks/voice-mandate.sh\n~/.claude/hooks/voice-toggle.sh\n~/.claude/toggle-voice.sh\n~/.zshrc (voice-on/voice-off aliases)"
  # reflect
  "~/.claude/skills/reflect/SKILL.md\n~/.claude/hooks/reflect-nudge.sh\n~/.claude/hooks/beats-reflect-weekly.sh\n~/.claude/last-reflect-timestamp\n~/Library/LaunchAgents/com.yesand.beats-reflect-weekly.plist (templated, macOS)"
  # sidecoach
  "~/.claude/hooks/sidecoach-sessionstart.sh\n~/.claude/hooks/sidecoach-postuserp.sh\n~/.claude/hooks/sidecoach-postresponse.sh\n~/.claude/sidecoach/ (compiled handlers + daemon)\n~/.local/bin/sidecoach (CLI symlink)"
  # task-list
  "~/.claude/skills/task-list/SKILL.md"
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
  "$REPO_DIR/bin"              # discord
  "$REPO_DIR/bin"              # voice-input
  "$REPO_DIR/claude/voice-output"  # voice-output
  "$REPO_DIR/claude"           # reflect
  "$REPO_DIR"                  # sidecoach
  "$REPO_DIR/claude"           # task-list
)
PICKS=(1 1 1 1 1 1 1 1 1 1 1 1 1 1)

# ------------------------------------------------------------
# Design peer skills - a la carte.
# Every skill below is ALSO installed by the `skills` bundle above. These
# entries make each one individually selectable (e.g. `--only icon-source`)
# without having to take the whole pipeline. Appended (not spliced into the
# literals above) so the parallel arrays stay aligned by construction.
# Keys map to ~/.claude/skills/<dir>; the bundle and these share one source.
# ------------------------------------------------------------
DESIGN_SKILL_KEYS=(tactical-polish component-gallery fontshare motion design-build curate design-references social-media design-team visual-effects icon-source)
KEYS+=("${DESIGN_SKILL_KEYS[@]}")
TITLES+=(
  "Tactical UI polish (tactical-polish)"
  "Component research (component.gallery)"
  "Typeface research (fontshare.com)"
  "GSAP + Lenis motion patterns"
  "Design pipeline orchestrator (/design-build)"
  "Design-reference capture wizard (/curate)"
  "Personal design-reference catalog"
  "Social platform specs (13 platforms)"
  "Multi-agent design sprints + CD review"
  "Shaders + FX + post-processing"
  "Icon sourcing (8-library protocol)"
)
DESCS+=(
  "Installs the tactical-polish skill into ~/.claude/skills/. Tactical UI-polish checklist that auto-triggers on UI work. Bundled file, no npx. Also included in the 'skills' bundle - pick this alone for just the polish skill."
  "Installs component-gallery-reference into ~/.claude/skills/. Researches component.gallery before building/naming/extracting UI components. Bundled file, no npx. Also part of the 'skills' bundle."
  "Installs fontshare-reference into ~/.claude/skills/. Researches fontshare.com's curated catalog before recommending or implementing typefaces. Bundled file. Also part of the 'skills' bundle."
  "Installs motion-reference into ~/.claude/skills/. Canonical GSAP + Lenis glue patterns for animation, scroll-driven effects, and page transitions. Bundled file. Also part of the 'skills' bundle."
  "Installs design-build into ~/.claude/skills/. The design pipeline orchestrator - /design-build runs strategy/research/typography/motion/build/QA in sequence with gate checkpoints. Bundled file. Also part of the 'skills' bundle."
  "Installs curate into ~/.claude/skills/. Interactive 5-step wizard (/curate) that captures one-off design references into your personal catalog at ~/.claude/design-references/. Bundled file. Also part of the 'skills' bundle."
  "Installs design-references into ~/.claude/skills/ and seeds the personal catalog directory at ~/.claude/design-references/ (with a starter category vocabulary). Auto-consults your curated catalog on UI builds. Deactivation removes the SKILL but preserves your catalog data. Also part of the 'skills' bundle."
  "Installs social-media into ~/.claude/skills/. Platform-specific sizing, safe zones, and content rules for 13 social platforms. Bundled file. Also part of the 'skills' bundle."
  "Installs design-team into ~/.claude/skills/. Orchestrates multi-agent design sprints with 16 roles across research/build/CD-review/revise phases. Bundled file. Also part of the 'skills' bundle."
  "Installs visual-effects into ~/.claude/skills/ (recursive - ships 35 files of shader source). 14 generative shader backgrounds + 25 transformative FX + 17 post-process effects. Also part of the 'skills' bundle."
  "Installs icon-source into ~/.claude/skills/. Rigorous protocol for sourcing icons verbatim from 8 approved libraries (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols, plus animated variants). Bundled file. Also part of the 'skills' bundle."
)
FILES+=(
  "~/.claude/skills/tactical-polish/ (bundled)"
  "~/.claude/skills/component-gallery-reference/SKILL.md"
  "~/.claude/skills/fontshare-reference/SKILL.md"
  "~/.claude/skills/motion-reference/SKILL.md"
  "~/.claude/skills/design-build/SKILL.md"
  "~/.claude/skills/curate/SKILL.md"
  "~/.claude/skills/design-references/SKILL.md\n~/.claude/design-references/ (personal catalog)"
  "~/.claude/skills/social-media/SKILL.md"
  "~/.claude/skills/design-team/SKILL.md"
  "~/.claude/skills/visual-effects/ (recursive)"
  "~/.claude/skills/icon-source/SKILL.md"
)
DIRS+=(
  "$REPO_DIR/claude/skills/tactical-polish"
  "$REPO_DIR/claude/skills/component-gallery-reference"
  "$REPO_DIR/claude/skills/fontshare-reference"
  "$REPO_DIR/claude/skills/motion-reference"
  "$REPO_DIR/claude/skills/design-build"
  "$REPO_DIR/claude/skills/curate"
  "$REPO_DIR/claude/skills/design-references"
  "$REPO_DIR/claude/skills/social-media"
  "$REPO_DIR/claude/skills/design-team"
  "$REPO_DIR/claude/skills/visual-effects"
  "$REPO_DIR/claude/skills/icon-source"
)
PICKS+=(1 1 1 1 1 1 1 1 1 1 1)

# ------------------------------------------------------------
# Dev apps - a la carte.
# tilt-lab is a runnable Vite + React + TS app, NOT a dotfile-style symlink.
# "Installing" it means: npm-install its deps and put a `tilt-lab` launcher on
# PATH. Nothing is symlinked into ~/.claude beyond the launcher. Appended so
# the parallel arrays stay aligned by construction.
# ------------------------------------------------------------
KEYS+=(tilt-lab)
TITLES+=("tilt-lab visual-effects playground (dev server)")
DESCS+=("Installs the tilt-lab visual-effects playground (Vite + React + TypeScript) as a runnable dev app. npm-installs its dependencies in <repo>/tilt-lab and symlinks a 'tilt-lab' launcher onto ~/.local/bin so you can start the playground from any shell. Does NOT auto-start a server during install. After installing, run 'tilt-lab' (or 'cd tilt-lab && npm run dev') to serve it at http://localhost:5180. This is an app, not a dotfile - the only thing placed in your home dir is the launcher symlink on PATH.")
FILES+=("~/.local/bin/tilt-lab (launcher symlink)\n<repo>/tilt-lab/node_modules/ (npm install)")
DIRS+=("$REPO_DIR/tilt-lab")
PICKS+=(1)

# lotus - Jonah's AI Figma plugin + MCP bridge, vendored into <repo>/lotus.
# Built in place (webpack plugin + tsc mcp-server), MCP registered in
# ~/.claude.json (NOT settings.json). Appended to keep the parallel arrays
# aligned by construction. Defaults OFF (Figma-specific; opt-in like a tool).
KEYS+=(lotus)
TITLES+=("Lotus AI Figma plugin (MCP bridge)")
DESCS+=("Installs Lotus (Jonah's AI Figma plugin, formerly Chiaroscuro) vendored at <repo>/lotus. npm-installs and builds both halves in place - the Figma plugin (webpack -> dist/code.js) and the MCP bridge server (tsc -> mcp-server/dist/server.js, which exposes MCP tools over stdio to Claude Code AND a WebSocket on port 9527 to the plugin running inside Figma). Registers the 'lotus' MCP server in ~/.claude.json and installs the /lotus skill. Restart Claude Code once after install for the lotus tools to load, then run /lotus to connect Figma. Requires the Lotus plugin imported into Figma via <repo>/lotus/manifest.json.")
FILES+=("<repo>/lotus/dist/ + mcp-server/dist/ (build)\n<repo>/lotus/node_modules/ (npm install)\n~/.claude/skills/lotus/SKILL.md\n~/.claude.json (MCP registration)")
DIRS+=("$REPO_DIR/lotus")
PICKS+=(0)

# fable - orchestrator-only guard for the Fable model (cost control, Jonah
# 2026-07-06). Opt-in; a no-op for every non-Fable session. One PreToolUse hook
# + its shared detect-session-model dependency. No repo dir (hook-only).
KEYS+=(fable)
TITLES+=("Fable orchestrator-only guard")
DESCS+=("Installs the fable-orchestrator-guard hook. When your SESSION model is Fable (claude-fable-5), Fable is orchestrator-only: its own Write/Edit/MultiEdit/NotebookEdit/Bash are blocked and it is directed to delegate production to an Opus teammate and review to Codex (cost control, authorized 2026-07-06). A complete no-op for every other model (Opus/Sonnet/Haiku) - your model choice is honored. Opt-in; wires one PreToolUse hook into settings.json and needs detect-session-model.sh (shared with the model-router).")
FILES+=("~/.claude/hooks/fable-orchestrator-guard.sh\n~/.claude/hooks/detect-session-model.sh\n~/.claude/settings.json (1 PreToolUse hook)")
DIRS+=("")
PICKS+=(0)

# ============================================================
# QA-hook clusters (Stage 2) - the standalone guard/QA suite, now selectable.
# Each cluster is a KEY (TUI row + --only). Individual member hooks are NOT keys;
# they live in HOOK_ON / HOOK_OFF and install via the standalone-hooks pass.
# cluster_hooks() is the membership source of truth. Default-on but removable.
# ============================================================
KEYS+=(safety verification question-discipline grounding api-drift planning-git surface model-routing)
TITLES+=(
  "Safety guards (bash/content/destructive)"
  "Verification discipline (verify-before-done)"
  "Question discipline (AskUserQuestion)"
  "Grounding (anti-hallucination)"
  "API-drift detection"
  "Planning + git hygiene"
  "Surface presentation (rich vs text)"
  "Model routing (cost control)"
)
DESCS+=(
  "Safety guards: block forbidden bash commands, forbidden file content (emojis, emdashes, AI-attribution), and destructive infra ops. The core guardrails - default on, removable."
  "Verification discipline: enforce verify-before-you-claim-done - visual/screenshot checks, real-input validation, the second-fix debugging gate. Blocks ending a turn on unverified UI work."
  "Question discipline: route every user-facing question through AskUserQuestion instead of plain-text option lists."
  "Grounding: anti-hallucination gates that require citing a source before asserting."
  "API-drift detection: catch breaking API / tool-contract drift in tool outputs and block ending a turn while it is unresolved."
  "Planning + git hygiene: plan-doc consistency lint (dispatch ownership + sequencing) plus a surfacing of committed-but-unpushed work at session start."
  "Surface presentation: detect the Claude Code surface (rich vs text-only) and enforce presenting data visually on rich surfaces."
  "Model routing: govern which model runs which tool (cost control). Installs detect-session-model alongside."
)
FILES+=(
  "~/.claude/hooks/ (5 safety hooks)\n~/.claude/settings.json (wiring)"
  "~/.claude/hooks/ (8 verification hooks)\n~/.claude/settings.json (wiring)"
  "~/.claude/hooks/ (4 question-discipline hooks)\n~/.claude/settings.json (wiring)"
  "~/.claude/hooks/ (2 grounding hooks)\n~/.claude/settings.json (wiring)"
  "~/.claude/hooks/ (3 api-drift hooks)\n~/.claude/settings.json (wiring)"
  "~/.claude/hooks/ (2 planning-git hooks)\n~/.claude/settings.json (wiring)"
  "~/.claude/hooks/ (2 surface hooks)\n~/.claude/settings.json (wiring)"
  "~/.claude/hooks/model-router-guard.sh + detect-session-model.sh\n~/.claude/settings.json (wiring)"
)
DIRS+=("" "" "" "" "" "" "" "")
PICKS+=(1 1 1 1 1 1 1 1)

# App components (Stage 3) - hook-owning apps. Their hooks wire from app-wirings.json
# in section 16e. Default-off, opt-in.
KEYS+=(clickup visualizer codex justify)
TITLES+=(
  "ClickUp write-guard"
  "Visualizer guard (show_widget)"
  "Codex integration guards"
  "Justify visual design tool"
)
DESCS+=(
  "ClickUp: blocks writes to ClickUp via the MCP unless confirmed. Opt-in; installs block-clickup-writes."
  "Visualizer: gates the mcp__visualize__show_widget tool (surface + quality checks). Opt-in; installs visualizer-guard."
  "Codex: guards for the Codex integration - watches codex CLI failures and governs codex-rescue agent spawns, plus the codex-review.py cross-model review tool (self-resolves a node>=16). Opt-in; installs codex-failure-watcher + codex-rescue-guard + codex-review.py."
  "Justify: in-browser visual micro-adjustment tool (server + core + adapters + MCP + /justify skill) plus its source-guard and watch hooks. Was personal; now public."
)
FILES+=(
  "~/.claude/hooks/block-clickup-writes.sh\n~/.claude/settings.json (1 PreToolUse hook)"
  "~/.claude/hooks/visualizer-guard.sh\n~/.claude/settings.json (1 PreToolUse hook)"
  "~/.claude/hooks/codex-failure-watcher.sh + codex-rescue-guard.sh + codex-review.py\n~/.claude/settings.json (2 hooks)"
  "~/.claude/justify/ + ~/.claude/skills/justify/ + ~/.claude.json (MCP)\n~/.claude/hooks/justify-source-guard.sh + justify-watch-guard.sh + justify-watch-standing-by.sh"
)
DIRS+=("" "" "" "$REPO_DIR/justify")
PICKS+=(0 0 0 0)

# App components (Stage 3b) - browser/design hooks that were hand-added to the
# live settings.json but never installer-managed. Now packaged as opt-in
# components on the same app-wirings.json pattern. Default-off.
KEYS+=(chrome figma)
TITLES+=(
  "Chrome tab-group hygiene"
  "Figma fidelity guard"
)
DESCS+=(
  "Chrome: tracks the Claude-in-Chrome MCP tab groups you open and, once the browser is idle and the work is plainly done, blocks the Stop once to remind you to close the group before the session ends (a shell hook cannot close a tab itself). Opt-in; installs chrome-tabgroup-track + chrome-tabgroup-clear + chrome-tabgroup-stop."
  "Figma: a Stop hook that blocks 'done' on UI built from a Figma source until MEASURED property parity is proven (Figma value == implementation value == verbatim browser reading). Inert unless armed by .figma-fidelity.pending at the repo root. Opt-in; installs figma-fidelity-stop."
)
FILES+=(
  "~/.claude/hooks/chrome-tabgroup-track.sh + chrome-tabgroup-clear.sh + chrome-tabgroup-stop.sh\n~/.claude/settings.json (2 PostToolUse + 1 Stop hook)"
  "~/.claude/hooks/figma-fidelity-stop.sh\n~/.claude/settings.json (1 Stop hook)"
)
DIRS+=("" "")
PICKS+=(0 0)

# Personal components - hidden from public TUI and --help. Surfaced only when
# the maintainer passes --personal (undocumented, undocumented-on-purpose).
# Lets one human keep cross-machine sync for ghostty and shaders without exposing
# them as Yes&-team defaults.
PERSONAL_KEYS=(ghostty shaders)
PERSONAL_TITLES=(
  "Ghostty terminal look"
  "Ghostty visual effects (shaders)"
)
PERSONAL_DESCS=(
  "Personal: Ghostty terminal appearance (PolySans Neutral Mono font, custom 256-color palette, transparency, blur)."
  "Personal: cinematic Ghostty effects (CRT curvature, TFT pixel grid, blazing cursor trail). Also clones the wider community shader library."
)
PERSONAL_FILES=(
  "~/.config/ghostty/config (copy)"
  "<repo>/shaders/*.glsl (loaded by Ghostty)\n~/Documents/Github/ghostty-shaders/ (community library clone)"
)
PERSONAL_DIRS=(
  "$REPO_DIR/ghostty"
  "$REPO_DIR/shaders"
)
PERSONAL_PICKS=(1 1)

key_index() {
  local target="$1" i
  for i in "${!KEYS[@]}"; do
    if [[ "${KEYS[$i]}" == "$target" ]]; then printf -- '%s' "$i"; return 0; fi
  done
  printf -- '%s' "-1"
}

picked() {
  local idx; idx="$(key_index "$1")"
  [[ "$idx" != "-1" && "${PICKS[$idx]}" == "1" ]]
}

set_pick() {
  local idx; idx="$(key_index "$1")"
  [[ "$idx" == "-1" ]] && return 0
  PICKS[$idx]="$2"
}

set_all() {
  local v="$1" i
  for i in "${!PICKS[@]}"; do PICKS[$i]="$v"; done
}

# --- Stage 2: QA-hook cluster membership + per-hook selection state ---
CLUSTER_KEYS=(safety verification question-discipline grounding api-drift planning-git surface model-routing)
HOOK_ON=""   # scripts explicitly requested via --only <hook>
# Seed from a DEDICATED sentinel (not the bare HOOK_OFF env) so the returning-flow
# cluster drill-in can pass deselections into a recursive --only, WITHOUT a user's
# stray exported HOOK_OFF leaking into an install. Same _AMPERSAND_ namespace as
# _AMPERSAND_NO_SUMMARY.
HOOK_OFF="${_AMPERSAND_HOOK_OFF:-}"  # scripts deselected in the TUI drill-in

cluster_hooks() {
  case "$1" in
    safety)              echo "bash-guard.sh content-guard.sh content-guard-stop.sh destructive-ops-guard.sh destructive-confirm-detect.sh" ;;
    verification)        echo "verify-before-done.sh verify-before-done-stop.sh verify-clear.sh verify-manual.sh screenshot-open-mandate.sh screenshot-open-clear.sh second-fix-gate.sh validation-guard.sh" ;;
    question-discipline) echo "multiple-choice-detect-stop.sh multiple-choice-inject-prompt.sh multiple-choice-enforce.sh question-enforcement.sh" ;;
    grounding)           echo "grounding-gate.sh grounding-guard.sh" ;;
    api-drift)           echo "api-drift-detector.sh api-drift-stop.sh api-drift-ack.sh" ;;
    planning-git)        echo "plan-consistency-lint.sh push-ahead-check.sh" ;;
    surface)             echo "claude-surface.sh surface-visual-gate.sh" ;;
    model-routing)       echo "model-router-guard.sh" ;;
    *)                   echo "" ;;
  esac
}

# True if the token (with or without .sh) names a hook in any cluster.
is_cluster_hook() {
  local want="$1" c
  [[ "$want" != *.sh ]] && want="${want}.sh"
  for c in "${CLUSTER_KEYS[@]}"; do
    case " $(cluster_hooks "$c") " in *" $want "*) return 0 ;; esac
  done
  return 1
}

# True if the deployed hook is OURS: a repo symlink, or a copy byte-identical to the
# repo source. A user's different same-named file returns false.
is_our_hook() {
  local h="$CLAUDE_DIR/hooks/$1" src="$REPO_DIR/claude/hooks/$1"
  { [ -L "$h" ] && [[ "$(readlink "$h")" == "$REPO_DIR/"* ]]; } && return 0
  [ -f "$h" ] && [ -f "$src" ] && cmp -s "$h" "$src" && return 0
  return 1
}

# A cluster is "installed" iff ANY member hook is OURS on disk (ownership-aware: a
# user's different same-named hook does not keep the cluster showing active).
cluster_detect() {
  local h
  for h in $(cluster_hooks "$1"); do
    is_our_hook "$h" && { echo active; return; }
  done
  echo not-installed
}

# Remove a repo-owned hook symlink / Improv-marked file only - never a user's
# same-named hook.
rm_hook_if_ours() {
  # Remove only OUR deployment; a user's different same-named file is left intact.
  # Best-effort: ALWAYS returns 0 (nothing-to-remove is not an error), so callers
  # in `set -e` for-loops (deactivate_cluster, deactivate_app_hooks, the cluster
  # HOOK_OFF reconcile) don't abort when a target hook is already absent.
  is_our_hook "$1" && rm -f "$CLAUDE_DIR/hooks/$1"
  return 0
}

# If settings.json is a legacy symlink into the repo, convert to a real file before
# mutating it (else edits would hit the repo's source settings).
ensure_real_settings() {
  if [ -L "$SETTINGS_JSON" ] && [[ "$(readlink "$SETTINGS_JSON")" == "$REPO_DIR/"* ]]; then
    cp -L "$SETTINGS_JSON" "$SETTINGS_JSON.mig" && rm -f "$SETTINGS_JSON" && mv "$SETTINGS_JSON.mig" "$SETTINGS_JSON"
  fi
}

# Remove a cluster's member hooks: symlinks + their settings.json entries (all
# events, empty-group cleanup). detect-session-model is shared with fable - left.
deactivate_cluster() {
  local name="$1" h
  for h in $(cluster_hooks "$name"); do
    rm_hook_if_ours "$h"
  done
  if command -v python3 >/dev/null 2>&1 && [ -f "$SETTINGS_JSON" ]; then
    ensure_real_settings
    NAMES="$(cluster_hooks "$name")" python3 -c "
import json, os
p = '$SETTINGS_JSON'
wp = '$REPO_DIR/claude/hooks/cluster-wirings.json'
names = set(os.environ['NAMES'].split())
wir = json.load(open(wp)) if os.path.exists(wp) else {}
cmds = set(e['hook'].get('command') for s in names for e in wir.get(s, []))
with open(p) as f: d = json.load(f)
hooks = d.get('hooks', {})
for ev in list(hooks.keys()):
    ng = []
    for g in hooks[ev]:
        g['hooks'] = [h for h in g.get('hooks', []) if h.get('command') not in cmds]
        if g.get('hooks'): ng.append(g)
    if ng: hooks[ev] = ng
    else: del hooks[ev]
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
}

# Generic app-hook installer (Stage 3): symlink + wire the given scripts from
# app-wirings.json. Standalone-safe. A component block calls this to own its hooks.
install_app_hooks() {
  mkdir -p "$CLAUDE_DIR/hooks"
  ensure_real_settings
  [ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"
  # Honor the per-hook off-list (HOOK_OFF, seeded from _AMPERSAND_HOOK_OFF), mirroring
  # the QA-hook cluster pass: split the requested hooks into KEEP (deploy + wire) and
  # DROP (reconcile-remove). HOOK_OFF entries are hook FILENAMES WITH .sh; an entry
  # naming a DIFFERENT component's hook won't match this call's args, so it is inert.
  local h keep="" drop=""
  for h in "$@"; do
    case " $HOOK_OFF " in
      *" $h "*) drop="$drop $h" ;;
      *)        keep="$keep $h" ;;
    esac
  done
  local okh=""
  for h in $keep; do
    [ -f "$REPO_DIR/claude/hooks/$h" ] || { warn "app hook missing in repo: $h"; continue; }
    chmod +x "$REPO_DIR/claude/hooks/$h"
    link_or_copy "$REPO_DIR/claude/hooks/$h" "$CLAUDE_DIR/hooks/$h"
    [ -e "$CLAUDE_DIR/hooks/$h" ] && okh="$okh $h"
  done
  if [ -n "${okh// /}" ] && command -v python3 >/dev/null 2>&1; then
    OKH="$okh" python3 -c "
import json, os
p='$SETTINGS_JSON'; wp='$REPO_DIR/claude/hooks/app-wirings.json'
okh=set(os.environ['OKH'].split())
d=json.load(open(p)); hooks=d.setdefault('hooks',{})
wir=json.load(open(wp)) if os.path.exists(wp) else {}
def add(event, matcher, hookobj):
    groups=hooks.setdefault(event,[])
    if matcher is not None:
        g=next((x for x in groups if x.get('matcher')==matcher),None)
        if g is None: g={'matcher':matcher,'hooks':[]}; groups.append(g)
    else:
        g=next((x for x in groups if 'matcher' not in x),None)
        if g is None: g={}; groups.append(g)
    hl=g.setdefault('hooks',[])
    if not any(x.get('command')==hookobj.get('command') for x in hl): hl.append(hookobj)
for s,entries in wir.items():
    if s in okh:
        for e in entries: add(e['event'], e.get('matcher'), e['hook'])
with open(p,'w') as f: json.dump(d,f,indent=2); f.write('\n')
"
  fi
  # Reconcile: any requested hook that is off-listed gets removed (its deployed file
  # + its EXACT app-wirings.json commands), so re-running --only <comp> with a hook
  # toggled off REMOVES a previously-installed hook. DRY reuse of the tested
  # deactivator; DROP and KEEP are distinct hooks with distinct wiring commands, so
  # stripping DROP's commands cannot touch KEEP's.
  if [ -n "${drop// /}" ]; then
    deactivate_app_hooks $drop
  fi
}

# Generic app-hook deactivator (Stage 3): rm_hook_if_ours + strip the EXACT
# app-wirings.json commands (ownership-aware, empty-group cleanup).
deactivate_app_hooks() {
  local h
  for h in "$@"; do rm_hook_if_ours "$h"; done
  if command -v python3 >/dev/null 2>&1 && [ -f "$SETTINGS_JSON" ]; then
    ensure_real_settings
    NAMES="$*" python3 -c "
import json, os
p='$SETTINGS_JSON'; wp='$REPO_DIR/claude/hooks/app-wirings.json'
names=set(os.environ['NAMES'].split())
wir=json.load(open(wp)) if os.path.exists(wp) else {}
cmds=set(e['hook'].get('command') for s in names for e in wir.get(s,[]))
d=json.load(open(p)); hooks=d.get('hooks',{})
for ev in list(hooks.keys()):
    ng=[]
    for g in hooks[ev]:
        g['hooks']=[x for x in g.get('hooks',[]) if x.get('command') not in cmds]
        if g.get('hooks'): ng.append(g)
    if ng: hooks[ev]=ng
    else: del hooks[ev]
with open(p,'w') as f: json.dump(d,f,indent=2); f.write('\n')
"
  fi
}

# New hook-only app components (Stage 3): remove their hooks via the generic helper.
deactivate_clickup()    { deactivate_app_hooks block-clickup-writes.sh; }
deactivate_visualizer() { deactivate_app_hooks visualizer-guard.sh; }
deactivate_codex()      { deactivate_app_hooks codex-failure-watcher.sh codex-rescue-guard.sh; rm_hook_if_ours codex-review.py; }
deactivate_chrome()     { deactivate_app_hooks chrome-tabgroup-track.sh chrome-tabgroup-clear.sh chrome-tabgroup-stop.sh; }
deactivate_figma()      { deactivate_app_hooks figma-fidelity-stop.sh; }

apply_only() {
  local csv="$1"
  set_all 0
  local IFS=','
  local k
  for k in $csv; do
    k="${k// /}"
    [[ -z "$k" ]] && continue
    if [[ "$k" == "claude" ]]; then
      warn "'claude' has been split into 'brain' and 'config'. Selecting both."
      set_pick brain 1
      set_pick config 1
      continue
    fi
    if [[ "$k" == "voice" ]]; then
      warn "'voice' has been renamed to 'voice-input'. Selecting voice-input."
      k="voice-input"
    fi
    if [[ "$(key_index "$k")" == "-1" ]]; then
      if is_cluster_hook "$k"; then
        local hk="$k"; [[ "$hk" != *.sh ]] && hk="${hk}.sh"
        HOOK_ON="$HOOK_ON $hk"
        continue
      fi
      err "Unknown component in --only: $k"
      err "Valid keys: ${KEYS[*]}"
      exit 2
    fi
    set_pick "$k" 1
  done
}

apply_preset() {
  case "$1" in
    all)     set_all 1 ;;
    none)    set_all 0 ;;
    minimal) set_all 0; set_pick brain 1; set_pick config 1; set_pick memory 1; set_pick skills 1; set_pick nvm 1; set_pick reflect 1 ;;
    *)       err "Unknown preset: $1 (valid: all, minimal, none)"; exit 2 ;;
  esac
}

# ============================================================
# Flag parsing
# ============================================================

NONINTERACTIVE=0
DRY_RUN=0

print_help() {
  cat <<'EOF'
Improv installer

Usage:
  ./install.sh                  Interactive checkbox TUI (gum or text fallback)
  ./install.sh --yes            Non-interactive, install everything
  ./install.sh --preset NAME    Non-interactive preset: all | minimal | none
  ./install.sh --only KEYS      Non-interactive, comma-separated keys
  ./install.sh --dry-run        Print resolved picks and exit
  ./install.sh --prune-skills   List dead repo skill symlinks (dry run), then exit
  ./install.sh --prune-skills-apply
                                Remove those dead skill symlinks (explicit approval)
  ./install.sh --help           Show this help

Components (for --only KEYS):
  Core:     brain, config, memory, statusline, nvm, ampersand
  Channels: discord, voice-input, voice-output
  Tools:    cmux, fable, sidecoach, reflect, task-list, tilt-lab, lotus
  Apps:     clickup, visualizer, codex, justify, chrome, figma (opt-in
            hook-owning components; each wires only its own hooks into settings.json)
  Clusters: safety, verification, question-discipline, grounding, api-drift,
            planning-git, surface, model-routing (each a QA-hook bundle; every
            member hook is also --only-able, e.g. --only bash-guard)
  Skills:   skills (bundle), tactical-polish, component-gallery, fontshare,
            motion, design-build, curate, design-references, social-media,
            design-team, visual-effects, icon-source

  'skills' installs the whole design pipeline + peer skills as a bundle; the
  individual skill keys let you take just one (e.g. --only icon-source).
  'config' installs CORE only (permissions/plugins/statusline + startup-check + hud).
  The QA-hook suite is the 8 clusters above; app hooks belong to their own apps.
EOF
}

# Personal flag: undocumented on purpose. Adds three components (ghostty,
# shaders, discord) to the active KEYS set. When unset, those components
# are entirely invisible: not in TUI, not in --help, not valid in --only.
# Pre-pass to capture --personal before --only/--preset run their validation.
PERSONAL=0
for arg in "$@"; do
  case "$arg" in
    --personal) PERSONAL=1 ;;
  esac
done
if [[ "$PERSONAL" == "1" ]]; then
  KEYS+=("${PERSONAL_KEYS[@]}")
  TITLES+=("${PERSONAL_TITLES[@]}")
  DESCS+=("${PERSONAL_DESCS[@]}")
  FILES+=("${PERSONAL_FILES[@]}")
  DIRS+=("${PERSONAL_DIRS[@]}")
  PICKS+=("${PERSONAL_PICKS[@]}")
fi

HAS_ONLY=0
HAS_PRESET=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)       NONINTERACTIVE=1; shift ;;
    --only)         NONINTERACTIVE=1; HAS_ONLY=1; apply_only "${2:-}"; shift 2 ;;
    --preset)       NONINTERACTIVE=1; HAS_PRESET=1; apply_preset "${2:-}"; shift 2 ;;
    --dry-run|-n)   DRY_RUN=1; shift ;;
    --prune-skills)       PRUNE_SKILLS=dryrun; shift ;;
    --prune-skills-apply) PRUNE_SKILLS=apply;  shift ;;
    --help|-h)      print_help; exit 0 ;;
    --personal)     shift ;;  # already consumed in pre-pass, just shift past it
    *)              err "Unknown flag: $1"; print_help; exit 2 ;;
  esac
done

# Standalone maintenance action: prune dead skill symlinks under ~/.claude/skills
# and exit, without running the installer. --prune-skills is a DRY RUN (prints only);
# the destructive form needs the explicit --prune-skills-apply flag (human approval).
# Neither is reachable from an unattended --yes/--only/--preset run, so those never
# mutate ~/.claude via the prune.
if [ -n "${PRUNE_SKILLS:-}" ]; then
  # A global --dry-run overrides an apply request: dry-run always wins, so
  # `--dry-run --prune-skills-apply` reports without ever destroying anything.
  _prune_mode="$PRUNE_SKILLS"
  if [ "${DRY_RUN:-0}" = "1" ]; then _prune_mode=dryrun; fi
  prune_broken_skill_symlinks "$_prune_mode"
  exit $?
fi

# --yes without --only/--preset means "install everything"
# --yes WITH --only/--preset defers to their selection
if [[ "$NONINTERACTIVE" == "1" && "$HAS_ONLY" == "0" && "$HAS_PRESET" == "0" ]]; then
  set_all 1
fi

# ============================================================
# Pre-flight
# ============================================================

if [[ "$(uname)" != "Darwin" ]]; then
  err "This installer is built for macOS. Some target paths used here are macOS-specific."
  exit 1
fi

USER_HOME="$HOME"
ZSHRC="$HOME/.zshrc"
CLAUDE_DIR="$HOME/.claude"
# Canonical path to the user's Claude Code settings.json. Several component
# install/deactivate blocks (cmux, voice-output, sidecoach) reference this; it
# must be defined before they run or `set -u` aborts with an unbound variable.
SETTINGS_JSON="$CLAUDE_DIR/settings.json"

# ============================================================
# TUI
# ============================================================

ensure_gum() {
  command -v gum >/dev/null 2>&1 && return 0
  if ! command -v brew >/dev/null 2>&1; then
    return 1
  fi
  printf "${CYAN}[info]${NC}  gum (TUI library) is not installed. Install via Homebrew? [Y/n] "
  local reply=""
  if [ -r /dev/tty ]; then read -r reply </dev/tty || true; fi
  reply="${reply:-Y}"
  case "$reply" in
    [Nn]*) return 1 ;;
  esac
  brew install gum >/dev/null 2>&1 || return 1
  command -v gum >/dev/null 2>&1
}

show_picks_summary() {
  printf "\n${ACCENT}Selected components${NC}\n"
  local i mark
  for i in "${!KEYS[@]}"; do
    if [[ "${PICKS[$i]}" == "1" ]]; then mark="${ACCENT}[x]${NC}"; else mark="${DIM}[ ]${NC}"; fi
    printf "  %b %-9s ${DIM}%s${NC}\n" "$mark" "${KEYS[$i]}" "${TITLES[$i]}"
  done
  printf "\n"
}

# Print a string with a one-shot shimmer reveal that settles into a static
# dark-cyan-to-light-cyan gradient. Replaces `gum style --foreground 212` for
# component titles in the TUI. Endpoints: dark cyan (#0e7490 = 14,116,144)
# -> light cyan (#67e8f9 = 103,232,249), with a brighter shimmer band
# (#cffafe = 207,250,254) that sweeps left-to-right once.
# Requires a 24-bit-color-capable terminal; falls back gracefully (text still
# prints, just without the gradient) if escape codes are stripped.
print_title_animated() {
  local text="$1"
  local len=${#text}
  [ "$len" -eq 0 ] && return

  local frames=6 frame i pos d intensity divisor
  local shimmer_width=5
  local r g b char
  divisor=$(( len > 1 ? len - 1 : 1 ))

  for ((frame=0; frame<frames; frame++)); do
    pos=$(( -shimmer_width + (len + 2 * shimmer_width) * frame / (frames - 1) ))
    printf '\r\033[K'
    for ((i=0; i<len; i++)); do
      char="${text:$i:1}"
      r=$(( 14  + (103 -  14) * i / divisor ))
      g=$(( 116 + (232 - 116) * i / divisor ))
      b=$(( 144 + (249 - 144) * i / divisor ))
      d=$(( i - pos ))
      [ "$d" -lt 0 ] && d=$(( -d ))
      if [ "$d" -lt "$shimmer_width" ]; then
        intensity=$(( (shimmer_width - d) * 100 / shimmer_width ))
        r=$(( r + (207 - r) * intensity / 100 ))
        g=$(( g + (250 - g) * intensity / 100 ))
        b=$(( b + (254 - b) * intensity / 100 ))
      fi
      printf '\033[38;2;%d;%d;%dm%s' "$r" "$g" "$b" "$char"
    done
    printf '\033[0m'
    sleep 0.03
  done

  # Settle: pure static gradient, no shimmer.
  printf '\r\033[K'
  for ((i=0; i<len; i++)); do
    char="${text:$i:1}"
    r=$(( 14  + (103 -  14) * i / divisor ))
    g=$(( 116 + (232 - 116) * i / divisor ))
    b=$(( 144 + (249 - 144) * i / divisor ))
    printf '\033[38;2;%d;%d;%dm%s' "$r" "$g" "$b" "$char"
  done
  printf '\033[0m\n'
}

# yes& brand banner. Hand-shaded ASCII; @/%/-/: outline 'yes', #/*/+/. shade '&'.
# Rendered in a single red (#dc2626) because the two letterforms interleave
# (the y-descender curls into the & loop on row 11), so column-bisection would
# clip wrong. Single color reads as a logo, not as two competing shapes.
print_yes_and_banner() {
  local LOGO_RED='\033[38;2;220;38;38m'
  local NC='\033[0m'
  printf '\n'
  printf '%b%s%b\n' "$LOGO_RED" "                                                         **  *  " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "                                                 ####   ####*   " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "                                              #*  *   + ####  ##" "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "                                            ###  ##       -#####" "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "                                           :####  .-  ######### " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" " @@@@@@     @@@   @@@   @@@@    @@@   @@@@  ######   #######    " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "   @@@@     @@  @@@      @@@@  @@@      @@      ##  *##       # " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "    @@@@   @@  @@@@@@@@@@@@@@  @@@@@@@@       ###   -# *####   +" "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "    %@@@@  @   @@@@              @@@@@@@@@   ####*   # ######  -" "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "     @@@@ @    @@@@@                  @@@@@ .#####:    #-##   # " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "      @@@@.     @@@@@+    #@@ @@@@     @@@%  #######        #   " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "       @@@        @@@@@@@@@     @@@@@@@@@      ##########.      " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "       @@                                                       " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" " @@- :@@                                                        " "$NC"
  printf '%b%s%b\n' "$LOGO_RED" "-@@@@@                                                          " "$NC"
  printf '\n'
}

run_tui_gum() {
  print_yes_and_banner
  gum style --border double --margin "1 0" --padding "1 2" --border-foreground "#0e7490" \
    "Improv installer" "Pick what to install on this machine."

  local i
  for i in "${!KEYS[@]}"; do
    print_title_animated "${KEYS[$i]} - ${TITLES[$i]}"
    gum style --faint "  ${DESCS[$i]}"
  done
  printf "\n"

  # Default-selected list = currently picked keys (CSV for gum --selected)
  local sel=""
  for i in "${!KEYS[@]}"; do
    if [[ "${PICKS[$i]}" == "1" ]]; then
      [[ -n "$sel" ]] && sel="${sel},"
      sel="${sel}${KEYS[$i]}"
    fi
  done

  local chosen
  chosen="$(printf '%s\n' "${KEYS[@]}" \
    | gum choose --no-limit --selected "$sel" \
        --header "Space to toggle, enter to confirm" \
        --cursor.foreground "#67e8f9" \
        --selected.foreground "#67e8f9" \
        --item.foreground "#ffffff" \
        --cursor-prefix "[ ] " \
        --selected-prefix "[✓] " \
        --unselected-prefix "[ ] ")" || return 1

  set_all 0
  local k
  while IFS= read -r k; do
    [[ -z "$k" ]] && continue
    set_pick "$k" 1
  done <<< "$chosen"

  # Phase 2 (nested drill-in): for each picked cluster, optionally edit which of
  # its hooks install. Default is all; deselecting a hook adds it to HOOK_OFF.
  HOOK_OFF=""
  local _c _members _keepcsv _keep _m
  for _c in "${CLUSTER_KEYS[@]}"; do
    picked "$_c" || continue
    _members="$(cluster_hooks "$_c")"
    if gum confirm "Customize the hooks in '$_c'? (default: install all)" --default=false \
         --selected.background "#0e7490" --selected.foreground "#ffffff" 2>/dev/null; then
      _keepcsv="$(printf '%s\n' $_members | paste -sd, -)"
      _keep="$(printf '%s\n' $_members \
        | gum choose --no-limit --selected "$_keepcsv" \
            --header "'$_c' hooks - space to toggle off, enter to confirm" \
            --cursor.foreground "#67e8f9" --selected.foreground "#67e8f9" \
            --item.foreground "#ffffff" \
            --cursor-prefix "[ ] " --selected-prefix "[✓] " --unselected-prefix "[ ] ")" || _keep="$_members"
      for _m in $_members; do
        case $'\n'"$_keep"$'\n' in *$'\n'"$_m"$'\n'*) ;; *) HOOK_OFF="$HOOK_OFF $_m" ;; esac
      done
    fi
  done

  clear
  show_picks_summary
  gum confirm "Proceed with these components?" \
    --selected.background "#0e7490" \
    --selected.foreground "#ffffff" || return 1
  return 0
}

run_tui_fallback() {
  printf "\n${CYAN}Improv installer${NC}\n"
  printf "Pick what to install. Default is everything on.\n\n"
  local i
  for i in "${!KEYS[@]}"; do
    printf "  ${GREEN}%d)${NC} %s ${DIM}- %s${NC}\n" "$((i+1))" "${TITLES[$i]}" "${KEYS[$i]}"
    printf "     ${DIM}%s${NC}\n" "${DESCS[$i]}"
  done
  printf "\n"
  printf "Enter the numbers to toggle off (space-separated), or press Enter to keep all: "

  local toggles=""
  if [ -r /dev/tty ]; then read -r toggles </dev/tty || true; fi

  local n
  for n in $toggles; do
    [[ "$n" =~ ^[0-9]+$ ]] || continue
    local idx=$((n-1))
    if [[ "$idx" -ge 0 && "$idx" -lt "${#KEYS[@]}" ]]; then
      PICKS[$idx]=0
    fi
  done

  clear
  show_picks_summary
  printf "Proceed? [Y/n] "
  local reply=""
  if [ -r /dev/tty ]; then read -r reply </dev/tty || true; fi
  reply="${reply:-Y}"
  case "$reply" in
    [Nn]*) return 1 ;;
  esac
  return 0
}

# ============================================================
# State file infrastructure (JSON, ~/.claude/.dotfiles-state)
# ============================================================
# Tracks per-component status (active / inactive / not-installed) so the
# installer can branch on fresh-vs-returning and offer the right actions.

STATE_FILE="$HOME/.claude/.dotfiles-state"

state_init_if_missing() {
  if [ ! -f "$STATE_FILE" ]; then
    mkdir -p "$(dirname "$STATE_FILE")"
    python3 - <<PY
import json, os, time
data = {
  "version": 1,
  "first_install_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "last_run_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "last_install_sha": "",
  "components": {}
}
with open("$STATE_FILE", "w") as f:
    json.dump(data, f, indent=2)
PY
  fi
}

state_get() {
  local key="$1"
  [ -f "$STATE_FILE" ] || { echo ""; return 0; }
  python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('components',{}).get('$key',''))" 2>/dev/null
}

state_set() {
  local key="$1" val="$2"
  state_init_if_missing
  python3 - <<PY
import json, time
with open("$STATE_FILE") as f: d = json.load(f)
d.setdefault("components", {})["$key"] = "$val"
d["last_run_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
with open("$STATE_FILE", "w") as f: json.dump(d, f, indent=2)
PY
}

state_record_sha() {
  state_init_if_missing
  local sha
  sha=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
  python3 - <<PY
import json, time
with open("$STATE_FILE") as f: d = json.load(f)
d["last_install_sha"] = "$sha"
d["last_run_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
with open("$STATE_FILE", "w") as f: json.dump(d, f, indent=2)
PY
}

# ============================================================
# Per-component disk-based state detection
# ============================================================

detect_component() {
  local key="$1"
  case "$key" in
    brain)      grep -Fq "<!-- improv:brain:begin -->" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null && echo active || echo not-installed ;;
    config)     [ -e "$CLAUDE_DIR/hud.sh" ] && echo active || echo not-installed ;;
    memory)     grep -Fq "<!-- improv:memory-discipline:begin -->" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null && echo active || echo not-installed ;;
    skills)     { [ -d "$CLAUDE_DIR/skills/tactical-polish" ] || [ -d "$CLAUDE_DIR/skills/component-gallery-reference" ]; } && echo active || echo not-installed ;;
    statusline) [ -L "$CLAUDE_DIR/statusline-command.sh" ] && echo active || echo not-installed ;;
    cmux)       [ -L "$HOME/.config/cmux/settings.json" ] && echo active || echo not-installed ;;
    nvm)        grep -Fq "nvm use default --silent" "$ZSHRC" 2>/dev/null && echo active || echo not-installed ;;
    ampersand)  grep -Fq "# === improv:shortcuts:begin ===" "$ZSHRC" 2>/dev/null && echo active || echo not-installed ;;
    discord)    grep -Fq "discord-chat-launcher.sh" "$ZSHRC" 2>/dev/null && echo active || echo not-installed ;;
    voice-input) [ -L "$CLAUDE_DIR/transcribe" ] && echo active || echo not-installed ;;
    voice-output) [ -d "$CLAUDE_DIR/voice-output" ] && echo active || echo not-installed ;;
    reflect)    [ -f "$CLAUDE_DIR/skills/reflect/SKILL.md" ] && echo active || echo not-installed ;;
    task-list)  [ -f "$CLAUDE_DIR/skills/task-list/SKILL.md" ] && echo active || echo not-installed ;;
    sidecoach)  [ -f "$CLAUDE_DIR/skills/sidecoach/SKILL.md" ] && echo active || echo not-installed ;;
    tilt-lab)   [ -L "$HOME/.local/bin/tilt-lab" ] && echo active || echo not-installed ;;
    justify)     [ -d "$CLAUDE_DIR/justify" ] && echo active || echo not-installed ;;
    lotus)       [ -f "$CLAUDE_DIR/skills/lotus/SKILL.md" ] && [ -f "$REPO_DIR/lotus/mcp-server/dist/server.js" ] && echo active || echo not-installed ;;
    fable)      [ -L "$CLAUDE_DIR/hooks/fable-orchestrator-guard.sh" ] && echo active || echo not-installed ;;
    # Design peer skills (a la carte). Each detects its own ~/.claude/skills/ dir.
    tactical-polish)   { [ -d "$CLAUDE_DIR/skills/tactical-polish" ] || compgen -G "$CLAUDE_DIR/skills/*interfaces*" >/dev/null; } && echo active || echo not-installed ;;
    component-gallery) [ -d "$CLAUDE_DIR/skills/component-gallery-reference" ] && echo active || echo not-installed ;;
    fontshare)         [ -d "$CLAUDE_DIR/skills/fontshare-reference" ] && echo active || echo not-installed ;;
    motion)            [ -d "$CLAUDE_DIR/skills/motion-reference" ] && echo active || echo not-installed ;;
    design-build)      [ -d "$CLAUDE_DIR/skills/design-build" ] && echo active || echo not-installed ;;
    curate)            [ -d "$CLAUDE_DIR/skills/curate" ] && echo active || echo not-installed ;;
    design-references) [ -d "$CLAUDE_DIR/skills/design-references" ] && echo active || echo not-installed ;;
    social-media)      [ -d "$CLAUDE_DIR/skills/social-media" ] && echo active || echo not-installed ;;
    design-team)       [ -d "$CLAUDE_DIR/skills/design-team" ] && echo active || echo not-installed ;;
    visual-effects)    [ -d "$CLAUDE_DIR/skills/visual-effects" ] && echo active || echo not-installed ;;
    icon-source)       [ -d "$CLAUDE_DIR/skills/icon-source" ] && echo active || echo not-installed ;;
    safety|verification|question-discipline|grounding|api-drift|planning-git|surface|model-routing) cluster_detect "$key" ;;
    clickup)    is_our_hook block-clickup-writes.sh && echo active || echo not-installed ;;
    visualizer) is_our_hook visualizer-guard.sh && echo active || echo not-installed ;;
    codex)      { is_our_hook codex-failure-watcher.sh || is_our_hook codex-rescue-guard.sh; } && echo active || echo not-installed ;;
    chrome)     { is_our_hook chrome-tabgroup-track.sh || is_our_hook chrome-tabgroup-clear.sh || is_our_hook chrome-tabgroup-stop.sh; } && echo active || echo not-installed ;;
    figma)      is_our_hook figma-fidelity-stop.sh && echo active || echo not-installed ;;
    *)          echo not-installed ;;
  esac
}

# Combine disk truth with state-file annotation. Disk wins; state file
# disambiguates "inactive" (was installed, then deactivated) from "never installed".
effective_state() {
  local key="$1"
  local disk; disk=$(detect_component "$key")
  if [ "$disk" = "active" ]; then echo "active"; return; fi
  local stored; stored=$(state_get "$key")
  if [ "$stored" = "inactive" ]; then echo "inactive"; return; fi
  echo "not-installed"
}

# ============================================================
# Update check (git fetch + git log HEAD..origin/main)
# ============================================================

check_updates() {
  cd "$REPO_DIR" || return 1
  git fetch origin main >/dev/null 2>&1 || return 1
  local commits
  commits=$(git log HEAD..origin/main --pretty=format:'%s' 2>/dev/null | head -10)
  [ -n "$commits" ] && printf '%s\n' "$commits"
}

apply_update() {
  cd "$REPO_DIR" || return 1
  git pull --ff-only
}

# ============================================================
# Deactivation functions (per-component undo)
# ============================================================
# Each function removes the on-disk artifacts for one component while
# leaving the dotfiles repo source intact. Safe to call when a component
# is already inactive (no-op).

deactivate_brain() {
  if [ -f "$CLAUDE_DIR/CLAUDE.md" ] && [ ! -L "$CLAUDE_DIR/CLAUDE.md" ]; then
    if grep -Fq "<!-- improv:brain:begin -->" "$CLAUDE_DIR/CLAUDE.md"; then
      sed -i.bak '/<!-- improv:brain:begin -->/,/<!-- improv:brain:end -->/d' "$CLAUDE_DIR/CLAUDE.md"
      rm -f "$CLAUDE_DIR/CLAUDE.md.bak"
    fi
    if grep -Fq "<!-- improv:local:begin -->" "$CLAUDE_DIR/CLAUDE.md"; then
      sed -i.bak '/<!-- improv:local:begin -->/,/<!-- improv:local:end -->/d' "$CLAUDE_DIR/CLAUDE.md"
      rm -f "$CLAUDE_DIR/CLAUDE.md.bak"
    fi
    if [ ! -s "$CLAUDE_DIR/CLAUDE.md" ] || ! grep -q '[^[:space:]]' "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null; then
      rm -f "$CLAUDE_DIR/CLAUDE.md"
    fi
  fi
  if [ -L "$CLAUDE_DIR/CLAUDE.md" ] && [[ "$(readlink "$CLAUDE_DIR/CLAUDE.md")" == "$REPO_DIR/"* ]]; then
    rm -f "$CLAUDE_DIR/CLAUDE.md"
  fi
}

deactivate_config() {
  # Stage 3: config is core-only. Every hook moved to its app component and is
  # removed by that component's deactivate, NOT here.
  # startup-check.sh is shared with - and owned by - the memory component (memory
  # symlinks + wires it too). Do NOT remove it on config deactivate, or an active
  # memory install would be left wiring a missing loader.
  # hud.sh is config-unique (the config-core marker + read-only viewer)
  [ -L "$CLAUDE_DIR/hud.sh" ] && [[ "$(readlink "$CLAUDE_DIR/hud.sh")" == "$REPO_DIR/"* ]] && rm -f "$CLAUDE_DIR/hud.sh"
  if [ -L "$CLAUDE_DIR/settings.json" ] && [[ "$(readlink "$CLAUDE_DIR/settings.json")" == "$REPO_DIR/"* ]]; then
    rm -f "$CLAUDE_DIR/settings.json"
  fi
  if [ -f "$CLAUDE_DIR/settings.json" ] && [ ! -L "$CLAUDE_DIR/settings.json" ]; then
    python3 - "$CLAUDE_DIR/settings.json" <<'PYCONFIG'
import json, sys
path = sys.argv[1]
try:
    with open(path) as f:
        d = json.load(f)
except Exception:
    sys.exit(0)
# Stage 3: config is core-only - it owns NO hooks now, so nothing to strip from
# hooks here. App hooks are removed by their own components' deactivate.
OUR_ALLOW = [
    "Bash(npx create-next-app@latest:*)", "Bash(claude mcp:*)", "mcp__pencil",
]
MEMORY_PREFIXES = [
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
filtered_allow = [p for p in allow if p not in OUR_ALLOW and not any(p.startswith(pfx) for pfx in MEMORY_PREFIXES)]
if filtered_allow:
    perms["allow"] = filtered_allow
elif "allow" in perms:
    del perms["allow"]
OUR_PLUGINS = [
    "claude-md-management@claude-plugins-official", "figma@claude-plugins-official",
    "firebase@claude-plugins-official", "github@claude-plugins-official",
    "hookify@claude-plugins-official", "learning-output-style@claude-plugins-official",
    "semgrep@claude-plugins-official", "skill-creator@claude-plugins-official",
    "sentry@claude-plugins-official", "supabase@claude-plugins-official",
    "swift-lsp@claude-plugins-official", "superpowers@claude-plugins-official",
    "agent-sdk-dev@claude-plugins-official", "vercel@claude-plugins-official",
    "typescript-lsp@claude-plugins-official", "security-guidance@claude-plugins-official",
    "discord@claude-plugins-official", "feature-dev@claude-plugins-official",
    "ralph-loop@claude-plugins-official", "code-review@claude-plugins-official",
    "plugin-developer-toolkit@claude-plugins-official", "chrome-devtools@claude-plugins-official",
    "sidecoach",
]
plugins = d.get("enabledPlugins", {})
for p in OUR_PLUGINS:
    plugins.pop(p, None)
if not plugins and "enabledPlugins" in d:
    del d["enabledPlugins"]
OUR_MARKETS = ["buildwithclaude"]
markets = d.get("extraKnownMarketplaces", {})
for m in OUR_MARKETS:
    markets.pop(m, None)
if not markets and "extraKnownMarketplaces" in d:
    del d["extraKnownMarketplaces"]
if not d.get("hooks"):
    d.pop("hooks", None)
if not perms.get("allow") and "defaultMode" not in perms:
    d.pop("permissions", None)
with open(path, "w") as f:
    json.dump(d, f, indent=2)
    f.write("\n")
PYCONFIG
  fi
}

deactivate_memory() {
  deactivate_app_hooks memory-approve.sh memory-nudge.sh memory-compact.sh consolidate-nudge.sh
  [ -L "$CLAUDE_DIR/startup-check.sh" ] && rm -f "$CLAUDE_DIR/startup-check.sh"
  if [ -f "$CLAUDE_DIR/CLAUDE.md" ] && [ ! -L "$CLAUDE_DIR/CLAUDE.md" ] \
      && grep -Fq "<!-- improv:memory-discipline:begin -->" "$CLAUDE_DIR/CLAUDE.md"; then
    sed -i.bak '/<!-- improv:memory-discipline:begin -->/,/<!-- improv:memory-discipline:end -->/d' "$CLAUDE_DIR/CLAUDE.md"
    rm -f "$CLAUDE_DIR/CLAUDE.md.bak"
  fi
  if [ -f "$CLAUDE_DIR/settings.json" ] && [ ! -L "$CLAUDE_DIR/settings.json" ]; then
    python3 - <<'PY'
import json, os
path = os.path.expanduser("~/.claude/settings.json")
try:
    with open(path) as f: d = json.load(f)
except Exception:
    raise SystemExit(0)
hooks = d.get("hooks", {})
LOADER = "startup-check.sh"
PRECOMPACT_MARK = "PreCompact: flushing pending memory"
def filt(entries, marker):
    return [e for e in entries if marker not in json.dumps(e)]
if "SessionStart" in hooks:
    hooks["SessionStart"] = filt(hooks["SessionStart"], LOADER)
    if not hooks["SessionStart"]: del hooks["SessionStart"]
if "PreCompact" in hooks:
    hooks["PreCompact"] = filt(hooks["PreCompact"], PRECOMPACT_MARK)
    if not hooks["PreCompact"]: del hooks["PreCompact"]
if "PostCompact" in hooks:
    hooks["PostCompact"] = filt(hooks["PostCompact"], LOADER)
    if not hooks["PostCompact"]: del hooks["PostCompact"]
if not hooks: d.pop("hooks", None)
with open(path, "w") as f:
    json.dump(d, f, indent=2)
    f.write("\n")
PY
  fi
}

deactivate_skills() {
  [ -d "$CLAUDE_DIR/skills/tactical-polish" ] && rm -rf "$CLAUDE_DIR/skills/tactical-polish"
  # Also purge the legacy pre-rename skill dir. Its name is intentionally not
  # spelled out (banned from this repo); the *interfaces* glob is unique among
  # skill dirs and matches only the legacy install (dir or symlink).
  for _legacy in "$CLAUDE_DIR"/skills/*interfaces*; do
    [ -e "$_legacy" ] && rm -rf "$_legacy"
  done
  [ -d "$CLAUDE_DIR/skills/component-gallery-reference" ] && rm -rf "$CLAUDE_DIR/skills/component-gallery-reference"
  [ -d "$CLAUDE_DIR/skills/fontshare-reference" ] && rm -rf "$CLAUDE_DIR/skills/fontshare-reference"
  [ -d "$CLAUDE_DIR/skills/motion-reference" ] && rm -rf "$CLAUDE_DIR/skills/motion-reference"
  [ -d "$CLAUDE_DIR/skills/design-build" ] && rm -rf "$CLAUDE_DIR/skills/design-build"
  [ -d "$CLAUDE_DIR/skills/curate" ] && rm -rf "$CLAUDE_DIR/skills/curate"
  [ -d "$CLAUDE_DIR/skills/design-references" ] && rm -rf "$CLAUDE_DIR/skills/design-references"
  # NOTE: ~/.claude/design-references/ is the user's personal catalog (data, not code).
  # Deactivation removes the SKILLS but preserves the catalog so the user does not lose curated references.
}

deactivate_voice() {
  if [ -L "$CLAUDE_DIR/transcribe" ] && [[ "$(readlink "$CLAUDE_DIR/transcribe")" == "$REPO_DIR/"* ]]; then
    rm -f "$CLAUDE_DIR/transcribe"
  fi
}

deactivate_discord() {
  if [ -f "$ZSHRC" ] && grep -Fq "discord-chat-launcher.sh" "$ZSHRC"; then
    sed -i.bak '/# Discord Chat Agent launcher/d; /discord-chat-launcher\.sh.*improv/d' "$ZSHRC"
    rm -f "$ZSHRC.bak"
  fi
  local f
  for f in discord-chat-launcher.sh discord-onboard.sh discord-setup.sh; do
    if [ -L "$CLAUDE_DIR/$f" ] && [[ "$(readlink "$CLAUDE_DIR/$f")" == "$REPO_DIR/"* ]]; then
      rm -f "$CLAUDE_DIR/$f"
    fi
  done
}

deactivate_voice_output() {
  deactivate_app_hooks voice-gate.sh
  rm -rf "$CLAUDE_DIR/voice-output"
  rm -f "$CLAUDE_DIR/tts-generate"
  rm -f "$CLAUDE_DIR/.voice-enabled"
  rm -f "$CLAUDE_DIR/.voice-config"
  # Remove voice hook symlinks
  [ -L "$CLAUDE_DIR/hooks/voice-mandate.sh" ] && rm -f "$CLAUDE_DIR/hooks/voice-mandate.sh"
  [ -L "$CLAUDE_DIR/hooks/voice-toggle.sh" ] && rm -f "$CLAUDE_DIR/hooks/voice-toggle.sh"
  [ -L "$CLAUDE_DIR/toggle-voice.sh" ] && rm -f "$CLAUDE_DIR/toggle-voice.sh"
  if [ -f "$ZSHRC" ] && grep -Fq "# === improv:voice-output:begin ===" "$ZSHRC"; then
    sed -i.bak '/# === improv:voice-output:begin ===/,/# === improv:voice-output:end ===/d' "$ZSHRC"
    rm -f "$ZSHRC.bak"
  fi
  # Remove MCP server from ~/.claude.json
  if command -v python3 >/dev/null 2>&1 && [ -f "$HOME/.claude.json" ]; then
    python3 -c "
import json
p = '$HOME/.claude.json'
with open(p) as f: d = json.load(f)
d.get('mcpServers', {}).pop('voice-output', None)
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
  # Remove voice-mandate hook from settings.json SessionStart + PostCompact
  if command -v python3 >/dev/null 2>&1 && [ -f "$SETTINGS_JSON" ]; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.get('hooks', {})
VOICE_CMD = '~/.claude/hooks/voice-mandate.sh'
VTOGGLE_CMD = '~/.claude/hooks/voice-toggle.sh'
for event in ['SessionStart', 'PostCompact']:
    for entry in hooks.get(event, []):
        hl = entry.get('hooks', [])
        entry['hooks'] = [h for h in hl if h.get('command') != VOICE_CMD]
for entry in hooks.get('UserPromptSubmit', []):
    hl = entry.get('hooks', [])
    entry['hooks'] = [h for h in hl if h.get('command') != VTOGGLE_CMD]
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
}

deactivate_justify() {
  deactivate_app_hooks justify-source-guard.sh justify-watch-guard.sh justify-watch-standing-by.sh
  rm -rf "$CLAUDE_DIR/justify"
  rm -rf "$CLAUDE_DIR/skills/justify"
  # Remove MCP server from ~/.claude.json
  if command -v python3 >/dev/null 2>&1 && [ -f "$HOME/.claude.json" ]; then
    python3 -c "
import json
p = '$HOME/.claude.json'
with open(p) as f: d = json.load(f)
d.get('mcpServers', {}).pop('justify', None)
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
}

deactivate_lotus() {
  # Remove the skill and the MCP registration. Leave <repo>/lotus source and its
  # build/node_modules intact - it is vendored repo content, not a generated
  # install artifact, and a teammate may re-enable it without a rebuild.
  rm -rf "$CLAUDE_DIR/skills/lotus"
  if command -v python3 >/dev/null 2>&1 && [ -f "$HOME/.claude.json" ]; then
    python3 -c "
import json
p = '$HOME/.claude.json'
with open(p) as f: d = json.load(f)
d.get('mcpServers', {}).pop('lotus', None)
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
}

deactivate_statusline() {
  [ -L "$CLAUDE_DIR/statusline-command.sh" ] && rm -f "$CLAUDE_DIR/statusline-command.sh"
}

deactivate_cmux() {
  deactivate_app_hooks agent-teams-guard.sh node-shim-heal.sh
  [ -L "$HOME/.config/cmux/settings.json" ] && rm -f "$HOME/.config/cmux/settings.json"
  # Remove Claude Teams launcher
  [ -L "$CLAUDE_DIR/claude-teams-launcher.sh" ] && rm -f "$CLAUDE_DIR/claude-teams-launcher.sh"
  rm -f "$CLAUDE_DIR/.skip-teams-launcher" "$CLAUDE_DIR/.teams-default-on"
  if [ -f "$ZSHRC" ] && grep -Fq "# === improv:claude-teams:begin ===" "$ZSHRC"; then
    sed -i.bak '/# === improv:claude-teams:begin ===/,/# === improv:claude-teams:end ===/d' "$ZSHRC"
    rm -f "$ZSHRC.bak"
  fi
  # Remove cmux hook symlinks + the teammate tmux-shim dir
  local f
  for f in resume-guard.sh resume-toggle.sh cmux-close-guard.sh cmux-teammate-shim-heal.sh team-reaper.sh teammate-relay-stop.sh; do
    rm -f "$CLAUDE_DIR/hooks/$f"
  done
  [ -L "$CLAUDE_DIR/toggle-resume.sh" ] && rm -f "$CLAUDE_DIR/toggle-resume.sh"
  rm -f "$CLAUDE_DIR/.no-auto-resume"
  [ -L "$CLAUDE_DIR/cmux" ] && rm -f "$CLAUDE_DIR/cmux"
  # Remove ALL cmux hooks from settings.json (strip by basename across every event)
  if command -v python3 >/dev/null 2>&1 && [ -f "$SETTINGS_JSON" ]; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.get('hooks', {})
NAMES = ['resume-guard.sh', 'resume-toggle.sh', 'cmux-close-guard.sh', 'cmux-teammate-shim-heal.sh', 'team-reaper.sh', 'teammate-relay-stop.sh']
for ev in list(hooks.keys()):
    for g in hooks.get(ev, []):
        g['hooks'] = [h for h in g.get('hooks', []) if not any(n in h.get('command', '') for n in NAMES)]
    hooks[ev] = [g for g in hooks[ev] if g.get('hooks')]
    if not hooks[ev]: del hooks[ev]
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
}

deactivate_nvm() {
  if [ -f "$ZSHRC" ] && grep -Fq "nvm use default --silent" "$ZSHRC"; then
    sed -i.bak '/# Auto-activate nvm default so claude\/node\/npm are on PATH in new shells/d; /^nvm use default --silent 2>\/dev\/null$/d' "$ZSHRC"
    rm -f "$ZSHRC.bak"
  fi
}

deactivate_ampersand() {
  if [ -f "$ZSHRC" ] && grep -Fq "# === improv:shortcuts:begin ===" "$ZSHRC"; then
    sed -i.bak '/# === improv:shortcuts:begin ===/,/# === improv:shortcuts:end ===/d' "$ZSHRC"
    rm -f "$ZSHRC.bak"
  fi
}

deactivate_reflect() {
  [ -d "$CLAUDE_DIR/skills/reflect" ] && rm -rf "$CLAUDE_DIR/skills/reflect"
  # Unconditional `rm -f`, not `[ -f x ] && rm -f x`: now that these hooks deploy as
  # SYMLINKS, `[ -f ]` follows the link and is FALSE for a dangling one, so a broken
  # link (repo moved or deleted) would survive deactivation forever. `rm -f` removes a
  # dangling link and still exits 0 when the path is absent.
  rm -f "$CLAUDE_DIR/hooks/reflect-nudge.sh"
  # Strip reflect-nudge from settings.json SessionStart (block-wired now).
  if command -v python3 >/dev/null 2>&1 && [ -f "$SETTINGS_JSON" ]; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.get('hooks', {})
for entry in hooks.get('SessionStart', []):
    entry['hooks'] = [h for h in entry.get('hooks', []) if 'reflect-nudge' not in h.get('command', '')]
if 'SessionStart' in hooks:
    hooks['SessionStart'] = [g for g in hooks['SessionStart'] if g.get('hooks')]
    if not hooks['SessionStart']: del hooks['SessionStart']
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
  [ -f "$CLAUDE_DIR/last-reflect-timestamp" ] && rm -f "$CLAUDE_DIR/last-reflect-timestamp"
  # Scheduled weekly reflect (T-0045): unload the user agent if loaded, then
  # remove the templated plist and the hook. bootout is user-initiated teardown
  # here (deactivation), mirroring the plist's documented unload command.
  if [ "$(uname)" = "Darwin" ]; then
    launchctl bootout "gui/$(id -u)/com.yesand.beats-reflect-weekly" 2>/dev/null || true
    # Unconditional, same reason as the hooks above: [ -f ] is FALSE for a dangling
    # symlink, so a broken plist link would survive deactivation.
    rm -f "$HOME/Library/LaunchAgents/com.yesand.beats-reflect-weekly.plist"
  fi
  rm -f "$CLAUDE_DIR/hooks/beats-reflect-weekly.sh"   # dangling-link safe, see above
}

deactivate_task_list() {
  [ -d "$CLAUDE_DIR/skills/task-list" ] && rm -rf "$CLAUDE_DIR/skills/task-list"
}

deactivate_sidecoach() {
  [ -d "$CLAUDE_DIR/skills/sidecoach" ] && rm -rf "$CLAUDE_DIR/skills/sidecoach"
  local f
  for f in sidecoach-sessionstart.sh sidecoach-postuserp.sh sidecoach-postresponse.sh sidecoach-keyword.sh sidecoach-preamble.sh sidecoach-taste-gate.sh sidecoach-verbs.json sidecoach-lanes.json sidecoach-intent.json sidecoach_lanes.py; do
    [ -L "$CLAUDE_DIR/hooks/$f" ] && rm -f "$CLAUDE_DIR/hooks/$f"
  done
  [ -L "$HOME/.local/bin/sidecoach" ] && rm -f "$HOME/.local/bin/sidecoach"
  # Remove sidecoach hook entries from settings.json
  if command -v python3 >/dev/null 2>&1 && [ -f "$SETTINGS_JSON" ]; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.get('hooks', {})
for event in ['SessionStart', 'UserPromptSubmit', 'Stop', 'PostCompact', 'PostToolUse']:
    out = []
    for entry in hooks.get(event, []):
        hl = [h for h in entry.get('hooks', []) if 'sidecoach' not in h.get('command', '')]
        if hl:
            entry['hooks'] = hl
            out.append(entry)
    if out:
        hooks[event] = out
    elif event in hooks:
        del hooks[event]
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
  # Remove the sidecoach MCP server registration from ~/.claude.json
  if command -v python3 >/dev/null 2>&1 && [ -f "$HOME/.claude.json" ]; then
    python3 -c "
import json
p = '$HOME/.claude.json'
with open(p) as f: d = json.load(f)
d.get('mcpServers', {}).pop('sidecoach', None)
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
}

deactivate_tilt_lab() {
  # Remove only the PATH launcher. Leave <repo>/tilt-lab/node_modules intact -
  # it's repo-local build state, cheap to keep and expensive to reinstall.
  [ -L "$HOME/.local/bin/tilt-lab" ] && rm -f "$HOME/.local/bin/tilt-lab"
}

deactivate_fable() {
  # Remove the guard symlink + its PreToolUse wiring. Leave detect-session-model
  # (shared with the base model-router-guard).
  rm -f "$CLAUDE_DIR/hooks/fable-orchestrator-guard.sh"
  if command -v python3 >/dev/null 2>&1 && [ -f "$SETTINGS_JSON" ]; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.get('hooks', {})
for entry in hooks.get('PreToolUse', []):
    entry['hooks'] = [h for h in entry.get('hooks', []) if 'fable-orchestrator-guard' not in h.get('command', '')]
if 'PreToolUse' in hooks:
    hooks['PreToolUse'] = [g for g in hooks['PreToolUse'] if g.get('hooks')]
    if not hooks['PreToolUse']: del hooks['PreToolUse']
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
  fi
}

# Design peer skills: each removes only its own ~/.claude/skills/ dir.
# design-references deliberately preserves the user's ~/.claude/design-references/ catalog.
deactivate_design_skill() {
  local dir="$1"
  [ -d "$CLAUDE_DIR/skills/$dir" ] && rm -rf "$CLAUDE_DIR/skills/$dir"
}

# 2026-06 rename migration (improv -> improv): pre-rename installs wrote
# marker tokens "claude-dotfiles:" into ~/.zshrc and ~/.claude/CLAUDE.md; the
# renamed installer manages "improv:" markers, so rewrite any legacy tokens in
# the user's installed files before detect/install/deactivate act on them.
migrate_legacy_markers() {
  local f
  for f in "$ZSHRC" "$CLAUDE_DIR/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.local.md"; do
    [ -f "$f" ] || continue
    if grep -q "claude-dotfiles:" "$f" 2>/dev/null; then
      sed -i.bak -E 's/(=== |<!-- )claude-dotfiles:/\1improv:/g' "$f" && rm -f "$f.bak"
    fi
  done
}

deactivate_component() {
  migrate_legacy_markers
  case "$1" in
    brain)      deactivate_brain ;;
    config)     deactivate_config ;;
    memory)     deactivate_memory ;;
    skills)     deactivate_skills ;;
    statusline) deactivate_statusline ;;
    cmux)       deactivate_cmux ;;
    fable)      deactivate_fable ;;
    safety|verification|question-discipline|grounding|api-drift|planning-git|surface|model-routing) deactivate_cluster "$1" ;;
    clickup)    deactivate_clickup ;;
    visualizer) deactivate_visualizer ;;
    codex)      deactivate_codex ;;
    chrome)     deactivate_chrome ;;
    figma)      deactivate_figma ;;
    nvm)        deactivate_nvm ;;
    ampersand)  deactivate_ampersand ;;
    discord)    deactivate_discord ;;
    voice-input) deactivate_voice ;;
    voice-output) deactivate_voice_output ;;
    reflect)    deactivate_reflect ;;
    task-list)  deactivate_task_list ;;
    sidecoach)  deactivate_sidecoach ;;
    tilt-lab)   deactivate_tilt_lab ;;
    justify) deactivate_justify ;;
    lotus)   deactivate_lotus ;;
    tactical-polish)   deactivate_design_skill tactical-polish; for _legacy in "$CLAUDE_DIR"/skills/*interfaces*; do [ -e "$_legacy" ] && rm -rf "$_legacy"; done ;;
    component-gallery) deactivate_design_skill component-gallery-reference ;;
    fontshare)         deactivate_design_skill fontshare-reference ;;
    motion)            deactivate_design_skill motion-reference ;;
    design-build)      deactivate_design_skill design-build ;;
    curate)            deactivate_design_skill curate ;;
    design-references) deactivate_design_skill design-references ;;
    social-media)      deactivate_design_skill social-media ;;
    design-team)       deactivate_design_skill design-team ;;
    visual-effects)    deactivate_design_skill visual-effects ;;
    icon-source)       deactivate_design_skill icon-source ;;
  esac
}

# ============================================================
# Fresh-install flow: logo + 2 options (whole / a la carte)
# ============================================================

fresh_flow() {
  clear
  print_yes_and_banner

  local choice
  if command -v gum >/dev/null 2>&1; then
    choice=$(printf '%s\n' "Install the whole thing" "Install à la carte" | \
      gum choose --header "Welcome. Two ways to do this:" \
        --cursor.foreground "#67e8f9" \
        --selected.foreground "#67e8f9" \
        --item.foreground "#ffffff") || { warn "Aborted."; exit 0; }
  else
    printf "\nWelcome. Two ways to do this:\n  1) Install the whole thing\n  2) Install à la carte\n\nEnter 1 or 2 [1]: "
    local n=""
    [ -r /dev/tty ] && read -r n </dev/tty
    case "${n:-1}" in
      2) choice="Install à la carte" ;;
      *) choice="Install the whole thing" ;;
    esac
  fi

  if [[ "$choice" == "Install the whole thing" ]]; then
    set_all 1
    clear
    show_picks_summary
    if command -v gum >/dev/null 2>&1; then
      gum confirm "Install all of these?" \
        --selected.background "#0e7490" \
        --selected.foreground "#ffffff" || { warn "Aborted."; exit 0; }
    else
      printf "Install all of these? [Y/n] "
      local r=""
      [ -r /dev/tty ] && read -r r </dev/tty
      case "$r" in [Nn]*) warn "Aborted."; exit 0 ;; esac
    fi
  else
    if command -v gum >/dev/null 2>&1; then
      run_tui_gum || { warn "Aborted at confirmation."; exit 0; }
    else
      run_tui_fallback || { warn "Aborted at confirmation."; exit 0; }
    fi
  fi
}

# ============================================================
# Returning-user flow: update check + per-component action loop
# ============================================================

returning_flow() {
  clear
  print_yes_and_banner

  printf "Checking for updates...\n\n"
  local updates
  updates=$(check_updates 2>/dev/null || true)
  if [ -n "$updates" ]; then
    printf "${GREEN}Updates available:${NC}\n"
    printf "%s\n" "$updates" | sed 's/^/  + /'
    printf "\n"

    local apply_choice="no"
    if command -v gum >/dev/null 2>&1; then
      gum confirm "Pull updates now?" \
        --selected.background "#0e7490" \
        --selected.foreground "#ffffff" \
        && apply_choice=yes || apply_choice=no
    else
      printf "Pull updates now? [Y/n] "
      local r=""
      [ -r /dev/tty ] && read -r r </dev/tty
      case "$r" in [Nn]*) apply_choice=no ;; *) apply_choice=yes ;; esac
    fi

    if [[ "$apply_choice" == "yes" ]]; then
      apply_update
      ok "Updates applied."
      printf "\n${ACCENT}Restart 'ampersand' to pick up the new version.${NC}\n\n"
      exit 0
    fi
  else
    ok "Up to date."
  fi

  # Action loop
  local did_install=0
  while true; do
    clear
    print_yes_and_banner
    printf "${ACCENT}Components${NC}\n"
    local i status display
    for i in "${!KEYS[@]}"; do
      status=$(effective_state "${KEYS[$i]}")
      case "$status" in
        active)        display="${GREEN}active${NC}" ;;
        inactive)      display="${YELLOW}inactive${NC}" ;;
        not-installed) display="${DIM}not installed${NC}" ;;
      esac
      printf "  %-14s %-20b ${DIM}%s${NC}\n" "${KEYS[$i]}" "$display" "${TITLES[$i]}"
    done
    printf "\n"

    local options=()
    options+=("(quit)")
    for i in "${!KEYS[@]}"; do
      options+=("$(printf '%-14s %s' "${KEYS[$i]}" "${TITLES[$i]}")")
    done

    local pick=""
    if command -v gum >/dev/null 2>&1; then
      local raw_pick
      raw_pick=$(printf '%s\n' "${options[@]}" | \
        gum choose --header "Pick a component, or quit" \
          --height 15 \
          --header.foreground "#0e7490" \
          --cursor.foreground "#67e8f9" \
          --selected.foreground "#67e8f9" \
          --item.foreground "#ffffff") || break
      # Extract just the key (first word)
      pick="${raw_pick%% *}"
    else
      printf "\nComponents:\n"
      for i in "${!KEYS[@]}"; do
        printf "  %-12s %s\n" "${KEYS[$i]}" "${TITLES[$i]}"
      done
      printf "\nPick (or 'quit'): "
      [ -r /dev/tty ] && read -r pick </dev/tty || break
    fi
    [[ -z "$pick" || "$pick" == "(quit)" || "$pick" == "quit" ]] && break

    if [[ "$(key_index "$pick")" == "-1" ]]; then
      warn "Unknown component: $pick"
      continue
    fi

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
          # Cluster picks get the same phase-2 member drill-in the fresh install
          # offers: optionally deselect member hooks. Deselected members ride to the
          # recursive install as HOOK_OFF via env (the child's HOOK_OFF init respects
          # an inherited value; apply_only leaves it intact; the install pass subtracts
          # it). Non-cluster picks leave _hook_off empty, so behavior is unchanged.
          local _hook_off=""
          if [[ " ${CLUSTER_KEYS[*]} " == *" $pick "* ]] && command -v gum >/dev/null 2>&1; then
            local _members _keepcsv _keep _m
            _members="$(cluster_hooks "$pick")"
            if gum confirm "Customize the hooks in '$pick'? (default: install all)" --default=false \
                 --selected.background "#0e7490" --selected.foreground "#ffffff" 2>/dev/null; then
              _keepcsv="$(printf '%s\n' $_members | paste -sd, -)"
              _keep="$(printf '%s\n' $_members \
                | gum choose --no-limit --selected "$_keepcsv" \
                    --header "'$pick' hooks - space to toggle off, enter to confirm" \
                    --cursor.foreground "#67e8f9" --selected.foreground "#67e8f9" \
                    --item.foreground "#ffffff" \
                    --cursor-prefix "[ ] " --selected-prefix "[✓] " --unselected-prefix "[ ] ")" || _keep="$_members"
              for _m in $_members; do
                case $'\n'"$_keep"$'\n' in *$'\n'"$_m"$'\n'*) ;; *) _hook_off="$_hook_off $_m" ;; esac
              done
            fi
          fi
          printf "\nInstalling %s...\n" "$pick"
          if _AMPERSAND_HOOK_OFF="$_hook_off" _AMPERSAND_NO_SUMMARY=1 bash "$0" --only "$pick" --yes >"$logfile" 2>&1; then
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
  done

  if [ "$did_install" -eq 0 ]; then
    state_record_sha
    printf "\n"
    exit 0
  fi
  # else: fall through to existing apply phase, which will install the picked component
}

# ============================================================
# Entry point: dispatch to fresh, returning, or non-interactive flag path
# ============================================================

if [[ "$NONINTERACTIVE" == "0" ]]; then
  ensure_gum >/dev/null 2>&1 || true

  # If any component is already active on disk but the state file is missing,
  # the user is a returning user from before the state file was introduced.
  # Bootstrap the state file from on-disk reality before dispatching.
  if [ ! -f "$STATE_FILE" ]; then
    any_active=0
    for k in "${KEYS[@]}"; do
      [ "$(detect_component "$k")" = "active" ] && { any_active=1; break; }
    done
    if [ "$any_active" -eq 1 ]; then
      info "First run with state-file tracking - detecting existing components..."
      state_init_if_missing
      for k in "${KEYS[@]}"; do
        state_set "$k" "$(detect_component "$k")"
      done
      state_record_sha
    fi
  fi

  # Migrate legacy 'claude' state entry to brain + config
  if [ -f "$STATE_FILE" ]; then
    _legacy_claude=$(state_get "claude" 2>/dev/null || true)
    if [ -n "$_legacy_claude" ]; then
      state_set "brain" "$_legacy_claude"
      state_set "config" "$_legacy_claude"
      python3 -c "
import json
with open('$STATE_FILE') as f: d = json.load(f)
d.get('components', {}).pop('claude', None)
with open('$STATE_FILE', 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
" 2>/dev/null || true
      info "Migrated legacy 'claude' state to 'brain' + 'config'"
    fi
  fi

  if [ -f "$STATE_FILE" ]; then
    returning_flow
  else
    fresh_flow
  fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
  show_picks_summary
  info "--dry-run: no files were touched."
  exit 0
fi

# ============================================================
# Helpers (apply phase)
# ============================================================

backup_if_exists() {
  local target="$1"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    mkdir -p "$BACKUP_DIR"
    local rel="${target#$HOME/}"
    local backup_path="$BACKUP_DIR/$rel"
    mkdir -p "$(dirname "$backup_path")"
    cp -a "$target" "$backup_path"
    BACKED_UP=1
    warn "Backed up $target"
  fi
}

make_symlink() {
  local source="$1"
  local target="$2"

  if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
    ok "$target (already linked)"
    return
  fi

  backup_if_exists "$target"

  if [ -e "$target" ] || [ -L "$target" ]; then
    rm "$target"
  fi

  mkdir -p "$(dirname "$target")"
  ln -s "$source" "$target"
  ok "$target -> $source"
}

# ============================================================
# 1. Brain (team rules + workflow, appended to CLAUDE.md)
# ============================================================

migrate_legacy_markers

if picked brain; then
  echo ""
  info "--- Brain (team rules + workflow) ---"
  mkdir -p "$CLAUDE_DIR"

  BRAIN_BEGIN='<!-- improv:brain:begin -->'
  BRAIN_END='<!-- improv:brain:end -->'
  LOCAL_BEGIN='<!-- improv:local:begin -->'
  LOCAL_END='<!-- improv:local:end -->'
  TARGET_MD="$CLAUDE_DIR/CLAUDE.md"

  # Legacy migration: if CLAUDE.md is a symlink to our repo, convert to real file
  if [ -L "$TARGET_MD" ] && [[ "$(readlink "$TARGET_MD")" == "$REPO_DIR/"* ]]; then
    warn "Migrating legacy symlinked CLAUDE.md to a real file..."
    cp -L "$TARGET_MD" "$TARGET_MD.migrated"
    rm -f "$TARGET_MD"
    mv "$TARGET_MD.migrated" "$TARGET_MD"
  fi

  [ -f "$TARGET_MD" ] || touch "$TARGET_MD"

  # Remove old block if present (so re-runs pick up content changes)
  if grep -Fq "$BRAIN_BEGIN" "$TARGET_MD" 2>/dev/null; then
    sed -i.bak "/$BRAIN_BEGIN/,/$BRAIN_END/d" "$TARGET_MD"
    rm -f "$TARGET_MD.bak"
  fi

  # Also handle legacy marker from the old claude component
  if grep -Fq "<!-- improv:rules:begin -->" "$TARGET_MD" 2>/dev/null; then
    sed -i.bak '/<!-- improv:rules:begin -->/,/<!-- improv:rules:end -->/d' "$TARGET_MD"
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

  # CLAUDE.local.md personal overrides in their own marker block
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

# ============================================================
# 2. Config (hooks, plugins, permissions merged into settings.json)
# ============================================================

if picked config; then
  echo ""
  info "--- Config (hooks, plugins, permissions) ---"
  mkdir -p "$CLAUDE_DIR/hooks"

  USER_SETTINGS="$CLAUDE_DIR/settings.json"

  # Legacy migration: if settings.json is a symlink to our repo, convert to real file
  if [ -L "$USER_SETTINGS" ] && [[ "$(readlink "$USER_SETTINGS")" == "$REPO_DIR/"* ]]; then
    warn "Migrating legacy symlinked settings.json to a real file..."
    cp -L "$USER_SETTINGS" "$USER_SETTINGS.migrated"
    rm -f "$USER_SETTINGS"
    mv "$USER_SETTINGS.migrated" "$USER_SETTINGS"
  fi

  [ -f "$USER_SETTINGS" ] || echo '{}' > "$USER_SETTINGS"

  # Copy hook scripts. This is the full guard/QA/enforcement suite that our
  # claude/settings.json wires into PreToolUse / Stop / UserPromptSubmit /
  # SessionStart events. The settings.json JSON-merge below references every
  # one of these by command path, so they must all land on disk or the wired
  # hooks dangle (command-not-found at runtime). App-owned hooks (resume-*,
  # team-reaper, teammate-relay-stop, cmux-close-guard, cmux-teammate-shim-heal,
  # voice-mandate/voice-toggle, reflect-nudge, sidecoach-*) are wired AND deployed
  # by their own components and are intentionally excluded here. detect-session-model
  # is a shared library (model-router-guard + fable-orchestrator-guard exec it).
  # Stage 2 dissolved the QA suite into selectable clusters (safety, verification,
  # question-discipline, grounding, api-drift, planning-git, surface, model-routing)
  # - those hooks + detect-session-model now deploy+wire via the cluster pass, NOT
  # here. What remains is the app-owned residue that Stage 3 will move to its apps
  # (memory / cmux / voice / clickup / justify / visualizer / codex).
  # Stage 3: config is now CORE-ONLY. Every app hook moved to its component (section
  # 16e wires each from app-wirings.json). CONFIG_HOOKS is empty; config deploys only
  # startup-check + hud + the permissions/plugins/statusLine merge.
  CONFIG_HOOKS=()
  # link_or_copy, not safe_cp: on a dev checkout these become SYMLINKS so a git pull
  # reaches the hook that actually runs. safe_cp would delete an existing correct
  # symlink and freeze a copy over it on every re-run.
  for f in ${CONFIG_HOOKS[@]+"${CONFIG_HOOKS[@]}"}; do   # +expansion: safe when empty under set -u
    if [ -f "$REPO_DIR/claude/hooks/$f" ]; then
      link_or_copy "$REPO_DIR/claude/hooks/$f" "$CLAUDE_DIR/hooks/$f"
      ok "hooks/$f"
    fi
  done

  # Copy startup-check.sh
  safe_cp "$REPO_DIR/claude/startup-check.sh" "$CLAUDE_DIR/startup-check.sh"
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

# Hooks: merge by checking if command string already present
user_hooks = user.setdefault("hooks", {})
repo_hooks = repo.get("hooks", {})
for hook_type, repo_entries in repo_hooks.items():
    existing = user_hooks.get(hook_type, [])
    for repo_entry in repo_entries:
        already = False
        for rh in repo_entry.get("hooks", []):
            cmd = rh.get("command", "")
            if cmd and any(cmd in json.dumps(ex) for ex in existing):
                already = True
                break
        if not already:
            existing.append(repo_entry)
    user_hooks[hook_type] = existing

# Permissions: merge allow patterns (don't touch defaultMode)
user_perms = user.setdefault("permissions", {})
user_allow = user_perms.setdefault("allow", [])
repo_allow = repo.get("permissions", {}).get("allow", [])
for pat in repo_allow:
    if pat not in user_allow:
        user_allow.append(pat)

# Plugins: merge (add ours, keep theirs)
repo_plugins = repo.get("enabledPlugins", {})
user_plugins = user.setdefault("enabledPlugins", {})
for name, val in repo_plugins.items():
    if name not in user_plugins:
        user_plugins[name] = val

# Marketplaces: merge
repo_markets = repo.get("extraKnownMarketplaces", {})
user_markets = user.setdefault("extraKnownMarketplaces", {})
for name, val in repo_markets.items():
    if name not in user_markets:
        user_markets[name] = val

# StatusLine: only set if user doesn't have one
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

  # T-0021: HUD monitoring pane. Symlink claude/hud.sh -> ~/.claude/hud.sh
  # so `bash ~/.claude/hud.sh` works from any cwd. Read-only viewer; no
  # state changes, no port binding, no node deps.
  if [ -f "$REPO_DIR/claude/hud.sh" ]; then
    chmod +x "$REPO_DIR/claude/hud.sh"
    make_symlink "$REPO_DIR/claude/hud.sh" "$CLAUDE_DIR/hud.sh"
  fi
fi

# ============================================================
# 3. Memory subsystem (additive: rules + hooks + loader)
# ============================================================
# Three surgical, idempotent operations:
#   (a) Symlink startup-check.sh into ~/.claude/ (no-op if already linked)
#   (b) Append the Memory Discipline section from our CLAUDE.md (extracted
#       between marker comments) to the user's ~/.claude/CLAUDE.md.
#       Marker-guarded so re-runs detect presence and skip.
#   (c) JSON-merge three hooks (SessionStart, PreCompact, PostCompact) into
#       the user's ~/.claude/settings.json without disturbing their other
#       config. Marker strings in the hook commands make this idempotent.
# All three are no-ops if the user already picked `claude` (which symlinked
# our full CLAUDE.md and settings.json).

if picked memory; then
  echo ""
  info "--- Memory subsystem ---"
  mkdir -p "$CLAUDE_DIR"

  # (a) startup-check.sh symlink
  make_symlink "$REPO_DIR/claude/startup-check.sh" "$CLAUDE_DIR/startup-check.sh"
  chmod +x "$REPO_DIR/claude/startup-check.sh"

  # (b) CLAUDE.md memory-discipline section append
  MEMORY_BEGIN_MARKER='<!-- improv:memory-discipline:begin -->'
  MEMORY_END_MARKER='<!-- improv:memory-discipline:end -->'
  USER_CLAUDE_MD="$CLAUDE_DIR/CLAUDE.md"

  if [ -f "$USER_CLAUDE_MD" ] && grep -Fq "$MEMORY_BEGIN_MARKER" "$USER_CLAUDE_MD"; then
    ok "$USER_CLAUDE_MD already contains the Memory Discipline section"
  else
    if [ ! -e "$USER_CLAUDE_MD" ]; then
      info "$USER_CLAUDE_MD does not exist - creating with just the Memory Discipline section"
      touch "$USER_CLAUDE_MD"
    else
      info "Appending Memory Discipline section to $USER_CLAUDE_MD"
    fi
    { printf '\n'; cat "$REPO_DIR/claude/memory-discipline-section.md"; } >> "$USER_CLAUDE_MD"
    ok "Memory Discipline section added to $USER_CLAUDE_MD"
  fi

  # (c) settings.json hook JSON-merge (Python: stdlib only)
  USER_SETTINGS="$CLAUDE_DIR/settings.json"
  if [ ! -e "$USER_SETTINGS" ]; then
    info "$USER_SETTINGS does not exist - creating with just the memory hooks"
    echo '{}' > "$USER_SETTINGS"
  fi

  if command -v python3 >/dev/null 2>&1; then
    if [ ! -L "$USER_SETTINGS" ]; then
      backup_if_exists "$USER_SETTINGS"
    fi
    python3 - "$USER_SETTINGS" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    data = json.load(f)
hooks = data.setdefault('hooks', {})
LOADER_MARKER = 'startup-check.sh'
PRECOMPACT_MARKER = 'PreCompact: flushing pending memory'

def already_present(entries, marker):
    return any(marker in json.dumps(e) for e in entries)

ss = hooks.setdefault('SessionStart', [])
if not already_present(ss, LOADER_MARKER):
    ss.append({'hooks': [{
        'type': 'command',
        'command': 'SESSION_CWD="$(pwd)" ~/.claude/startup-check.sh',
        'timeout': 10,
        'statusMessage': 'Loading memory...'
    }]})

pc = hooks.setdefault('PreCompact', [])
if not already_present(pc, PRECOMPACT_MARKER):
    pc.append({'hooks': [{
        'type': 'command',
        'command': "printf '%s' '{\"systemMessage\":\"PreCompact: flushing pending memory\",\"hookSpecificOutput\":{\"hookEventName\":\"PreCompact\",\"additionalContext\":\"PRE-COMPACT: Before this context compresses, write any pending session memory entries to .claude/memory/ per CLAUDE.md memory discipline. Do this NOW.\"}}'",
        'timeout': 5,
        'statusMessage': 'Flushing memory before compact...'
    }]})

poc = hooks.setdefault('PostCompact', [])
if not already_present(poc, LOADER_MARKER):
    poc.append({'hooks': [{
        'type': 'command',
        'command': 'SESSION_CWD="$(pwd)" ~/.claude/startup-check.sh',
        'timeout': 10,
        'statusMessage': 'Reloading memory after compaction...'
    }]})

with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
PY
    ok "Memory hooks merged into $USER_SETTINGS"
  else
    warn "python3 not found - skipping settings.json hook merge."
    warn "Add SessionStart, PreCompact, PostCompact hooks manually using $REPO_DIR/claude/settings.json as a reference."
  fi

  # Optional: the read-only beats MCP server (T-0046). Deliberately NOT built by
  # default - it is an opt-in surface that a user registers in an MCP client
  # manually (see beats/mcp-server/README.md), so the memory component stays
  # pure-python with no forced Node dependency. Lazy-build note, shown only when
  # the server exists in the repo but has not been built yet.
  if [ -d "$REPO_DIR/beats/mcp-server" ] && [ ! -f "$REPO_DIR/beats/mcp-server/dist/server.js" ]; then
    info "beats MCP server available (read-only search/get/related/status). To build it:"
    info "  cd $REPO_DIR/beats/mcp-server && npm install && npm run build"
    info "  then register it per beats/mcp-server/README.md"
  fi
fi

# ============================================================
# 4. Anthropic Skills (additive, no config touched)
# ============================================================
# Skills install into ~/.claude/skills/ via the npx skills CLI. They do not
# replace or modify your CLAUDE.md, settings.json, hooks, or statusline -
# Claude Code reads skills from ~/.claude/skills/ regardless of whose
# config is active. Safe to install alongside an existing Claude Code setup.

if picked skills; then
  echo ""
  info "--- Anthropic Skills ---"
  # Bundled skill: tactical-polish (shipped with dotfiles, no npx needed)
  info "Installing tactical-polish (tactical UI polish)..."
  mkdir -p "$CLAUDE_DIR/skills/tactical-polish"
  for tp_file in SKILL.md typography.md surfaces.md animations.md performance.md motion-review.md; do
    safe_cp "$REPO_DIR/claude/skills/tactical-polish/$tp_file" \
       "$CLAUDE_DIR/skills/tactical-polish/$tp_file"
  done
  ok "tactical-polish installed"

  # Bundled skill: component-gallery-reference (shipped with dotfiles, no npx needed)
  info "Installing component-gallery-reference (UI component research via component.gallery)..."
  mkdir -p "$CLAUDE_DIR/skills/component-gallery-reference"
  safe_cp "$REPO_DIR/claude/skills/component-gallery-reference/SKILL.md" \
     "$CLAUDE_DIR/skills/component-gallery-reference/SKILL.md"
  ok "component-gallery-reference installed"

  # Bundled skill: fontshare-reference (shipped with dotfiles, no npx needed)
  info "Installing fontshare-reference (typeface research via fontshare.com)..."
  mkdir -p "$CLAUDE_DIR/skills/fontshare-reference"
  safe_cp "$REPO_DIR/claude/skills/fontshare-reference/SKILL.md" \
     "$CLAUDE_DIR/skills/fontshare-reference/SKILL.md"
  ok "fontshare-reference installed"

  # Bundled skill: motion-reference (canonical GSAP + Lenis patterns)
  info "Installing motion-reference (GSAP + Lenis animation/scroll patterns)..."
  mkdir -p "$CLAUDE_DIR/skills/motion-reference"
  safe_cp "$REPO_DIR/claude/skills/motion-reference/SKILL.md" \
     "$CLAUDE_DIR/skills/motion-reference/SKILL.md"
  safe_cp "$REPO_DIR/claude/skills/motion-reference/VOCABULARY.md" \
     "$CLAUDE_DIR/skills/motion-reference/VOCABULARY.md"
  ok "motion-reference installed"

  # Bundled skill: design-build (the design pipeline orchestrator)
  info "Installing design-build (the design pipeline orchestrator - /design-build runs the full sequence)..."
  mkdir -p "$CLAUDE_DIR/skills/design-build"
  safe_cp "$REPO_DIR/claude/skills/design-build/SKILL.md" \
     "$CLAUDE_DIR/skills/design-build/SKILL.md"
  ok "design-build installed"

  # Bundled skill pair: curate + design-references (personal design-reference catalog system)
  info "Installing curate (design-reference capture wizard)..."
  mkdir -p "$CLAUDE_DIR/skills/curate"
  safe_cp "$REPO_DIR/claude/skills/curate/SKILL.md" \
     "$CLAUDE_DIR/skills/curate/SKILL.md"
  ok "curate installed"

  info "Installing design-references (auto-consult personal catalog on UI builds)..."
  mkdir -p "$CLAUDE_DIR/skills/design-references"
  safe_cp "$REPO_DIR/claude/skills/design-references/SKILL.md" \
     "$CLAUDE_DIR/skills/design-references/SKILL.md"
  ok "design-references installed"

  # Seed the catalog directory + vocabulary file (only if not already present - preserve user data)
  if [ ! -d "$CLAUDE_DIR/design-references" ]; then
    info "Seeding personal design-reference catalog at ~/.claude/design-references/..."
    mkdir -p "$CLAUDE_DIR/design-references/_vocab"
    cat > "$CLAUDE_DIR/design-references/_vocab/categories.txt" <<'VOCABEOF'
# Strict Category vocabulary for the design-references catalog.
# One per line. Lowercase, hyphenated.
# Adding a new category requires explicit user approval via the `curate` skill.

list
navigation
command-palette
inline-edit
page-transition
loading-state
empty-state
detail-reveal
layout-transition
notification
data-display
gesture
interactive-element
overlay
VOCABEOF
    ok "design-references catalog seeded (empty - populate via /curate)"
  else
    ok "design-references catalog already exists - leaving user data intact"
  fi

  # Bundled skill: social-media (platform specs for 13 social platforms)
  info "Installing social-media (social platform specs + safe zones)..."
  mkdir -p "$CLAUDE_DIR/skills/social-media"
  safe_cp "$REPO_DIR/claude/skills/social-media/SKILL.md" \
     "$CLAUDE_DIR/skills/social-media/SKILL.md"
  ok "social-media installed"

  # Bundled skill: design-team (multi-agent design sprints)
  info "Installing design-team (multi-agent design sprints + CD review)..."
  mkdir -p "$CLAUDE_DIR/skills/design-team"
  safe_cp "$REPO_DIR/claude/skills/design-team/SKILL.md" \
     "$CLAUDE_DIR/skills/design-team/SKILL.md"
  ok "design-team installed"

  # Bundled skill: visual-effects (shaders + FX, recursive copy for subdirectories)
  info "Installing visual-effects (14 shaders + 25 FX + post-processing)..."
  mkdir -p "$CLAUDE_DIR/skills/visual-effects"
  cp -r "$REPO_DIR/claude/skills/visual-effects/" "$CLAUDE_DIR/skills/visual-effects/"
  ok "visual-effects installed"

  # Bundled skill: icon-source (8-library icon selection protocol)
  info "Installing icon-source (8 libraries, selection protocol)..."
  mkdir -p "$CLAUDE_DIR/skills/icon-source"
  safe_cp "$REPO_DIR/claude/skills/icon-source/SKILL.md" \
     "$CLAUDE_DIR/skills/icon-source/SKILL.md"
  ok "icon-source installed"

  # Bundled skill: voice-output (behavioral guidance for TTS)
  info "Installing voice-output (TTS behavioral guidance)..."
  mkdir -p "$CLAUDE_DIR/skills/voice-output"
  safe_cp "$REPO_DIR/claude/skills/voice-output/SKILL.md" \
     "$CLAUDE_DIR/skills/voice-output/SKILL.md"
  ok "voice-output installed"
fi

# ============================================================
# 4b. Design peer skills (a la carte)
# ============================================================
# Each block installs a single skill so `--only icon-source` (etc.) works
# without taking the whole pipeline. These share their source with the
# `skills` bundle above; installing both is idempotent (same file copied).

# Helper: copy one bundled skill dir into ~/.claude/skills/. Pass a second arg
# of 1 to recurse (visual-effects ships subdirectories of shader source).
install_bundled_skill() {
  local name="$1" recursive="${2:-0}"
  if [ ! -d "$REPO_DIR/claude/skills/$name" ]; then
    warn "skills/$name source missing in repo - skipping"
    return 0
  fi
  mkdir -p "$CLAUDE_DIR/skills/$name"
  if [ "$recursive" = "1" ]; then
    cp -r "$REPO_DIR/claude/skills/$name/." "$CLAUDE_DIR/skills/$name/"
  else
    safe_cp "$REPO_DIR/claude/skills/$name/SKILL.md" "$CLAUDE_DIR/skills/$name/SKILL.md"
  fi
  ok "skills/$name installed"
}

if picked tactical-polish; then
  echo ""
  info "--- tactical-polish (a la carte) ---"
  mkdir -p "$CLAUDE_DIR/skills/tactical-polish"
  for tp_file in SKILL.md typography.md surfaces.md animations.md performance.md motion-review.md; do
    safe_cp "$REPO_DIR/claude/skills/tactical-polish/$tp_file" \
       "$CLAUDE_DIR/skills/tactical-polish/$tp_file"
  done
  ok "tactical-polish installed"
fi

picked component-gallery && { echo ""; info "--- component-gallery-reference (a la carte) ---"; install_bundled_skill component-gallery-reference; }
picked fontshare         && { echo ""; info "--- fontshare-reference (a la carte) ---"; install_bundled_skill fontshare-reference; }
picked motion            && { echo ""; info "--- motion-reference (a la carte) ---"; install_bundled_skill motion-reference; }
picked design-build      && { echo ""; info "--- design-build (a la carte) ---"; install_bundled_skill design-build; }
picked curate            && { echo ""; info "--- curate (a la carte) ---"; install_bundled_skill curate; }
picked social-media      && { echo ""; info "--- social-media (a la carte) ---"; install_bundled_skill social-media; }
picked design-team       && { echo ""; info "--- design-team (a la carte) ---"; install_bundled_skill design-team; }
picked visual-effects    && { echo ""; info "--- visual-effects (a la carte) ---"; install_bundled_skill visual-effects 1; }
picked icon-source       && { echo ""; info "--- icon-source (a la carte) ---"; install_bundled_skill icon-source; }

if picked design-references; then
  echo ""
  info "--- design-references (a la carte) ---"
  install_bundled_skill design-references
  # Seed the personal catalog only if absent (preserve user data).
  if [ ! -d "$CLAUDE_DIR/design-references" ]; then
    mkdir -p "$CLAUDE_DIR/design-references/_vocab"
    cat > "$CLAUDE_DIR/design-references/_vocab/categories.txt" <<'VOCABEOF'
# Strict Category vocabulary for the design-references catalog.
# One per line. Lowercase, hyphenated.
# Adding a new category requires explicit user approval via the `curate` skill.

list
navigation
command-palette
inline-edit
page-transition
loading-state
empty-state
detail-reveal
layout-transition
notification
data-display
gesture
interactive-element
overlay
VOCABEOF
    ok "design-references catalog seeded (empty - populate via /curate)"
  else
    ok "design-references catalog already exists - leaving user data intact"
  fi
fi

# ============================================================
# 5. Custom statusline
# ============================================================
# Symlinks our statusline-command.sh into ~/.claude/. The statusLine command
# in our settings.json is `[ -x SCRIPT ] && bash SCRIPT || true`, so if this
# component is unticked the test-x check fails, the OR clause keeps exit at
# 0, and Claude Code falls back to its default statusline cleanly.

if picked statusline; then
  echo ""
  info "--- Custom statusline ---"
  mkdir -p "$CLAUDE_DIR"
  make_symlink "$REPO_DIR/claude/statusline-command.sh" "$CLAUDE_DIR/statusline-command.sh"
  chmod +x "$REPO_DIR/claude/statusline-command.sh"
fi

# ============================================================
# 6. cmux config
# ============================================================

if picked cmux; then
  echo ""
  info "--- cmux ---"

  # Standalone-safe: reachable via `--only cmux` without config, so ensure the
  # hooks dir + settings.json exist before wiring into them.
  mkdir -p "$CLAUDE_DIR/hooks"
  [ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"

  CMUX_CONFIG_DIR="$HOME/.config/cmux"
  mkdir -p "$CMUX_CONFIG_DIR"

  make_symlink "$REPO_DIR/cmux/settings.json" "$CMUX_CONFIG_DIR/settings.json"

  # Resume-guard: SessionEnd hook + UserPromptSubmit toggle + standalone script
  chmod +x "$REPO_DIR/claude/hooks/resume-guard.sh"
  make_symlink "$REPO_DIR/claude/hooks/resume-guard.sh" "$CLAUDE_DIR/hooks/resume-guard.sh"

  chmod +x "$REPO_DIR/claude/hooks/resume-toggle.sh"
  make_symlink "$REPO_DIR/claude/hooks/resume-toggle.sh" "$CLAUDE_DIR/hooks/resume-toggle.sh"

  chmod +x "$REPO_DIR/claude/toggle-resume.sh"
  make_symlink "$REPO_DIR/claude/toggle-resume.sh" "$CLAUDE_DIR/toggle-resume.sh"

  # Team-reaper: SessionStart + SessionEnd hook that removes orphaned team
  # records (~/.claude/teams + ~/.claude/tasks) so finished/wedged teams do not
  # linger as phantom workspaces. Never touches memory/beats.
  chmod +x "$REPO_DIR/claude/hooks/team-reaper.sh"
  make_symlink "$REPO_DIR/claude/hooks/team-reaper.sh" "$CLAUDE_DIR/hooks/team-reaper.sh"

  # cmux-close-guard (PreToolUse/Bash), cmux-teammate-shim-heal (SessionStart),
  # teammate-relay-stop (Stop): moved out of base settings.json into the cmux
  # component so a non-cmux install never wires them (was exit-127 dangling refs).
  for h in cmux-close-guard.sh cmux-teammate-shim-heal.sh teammate-relay-stop.sh; do
    chmod +x "$REPO_DIR/claude/hooks/$h"
    make_symlink "$REPO_DIR/claude/hooks/$h" "$CLAUDE_DIR/hooks/$h"
  done

  # Canonical fixed cmux agent-teams tmux shim (moved here from the config block).
  # cmux-teammate-shim-heal.sh re-plants this over cmux's stock shim so spawned
  # teammates render as real cmux panes. Symlinked so it tracks git pulls.
  if [ -d "$REPO_DIR/claude/cmux" ]; then
    make_symlink "$REPO_DIR/claude/cmux" "$CLAUDE_DIR/cmux"
    ok "cmux/ (teammate tmux-shim canonical)"
  fi

  # JSON-merge resume hooks into settings.json
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.setdefault('hooks', {})

# SessionEnd: resume-guard
GUARD_CMD = '~/.claude/hooks/resume-guard.sh'
GUARD_HOOK = {'type': 'command', 'command': GUARD_CMD, 'timeout': 5}
entries = hooks.setdefault('SessionEnd', [{}])
entry = entries[0]
hook_list = entry.setdefault('hooks', [])
if not any(h.get('command') == GUARD_CMD for h in hook_list):
    hook_list.append(GUARD_HOOK)

# UserPromptSubmit: resume-toggle
TOGGLE_CMD = '~/.claude/hooks/resume-toggle.sh'
TOGGLE_HOOK = {'type': 'command', 'command': TOGGLE_CMD, 'timeout': 5}
entries = hooks.setdefault('UserPromptSubmit', [{}])
entry = entries[0]
hook_list = entry.setdefault('hooks', [])
if not any(h.get('command') == TOGGLE_CMD for h in hook_list):
    hook_list.append(TOGGLE_HOOK)

# SessionStart + SessionEnd: team-reaper (mode passed as the first arg)
REAP_START_CMD = '~/.claude/hooks/team-reaper.sh session-start'
REAP_END_CMD = '~/.claude/hooks/team-reaper.sh session-end'
for event, cmd in (('SessionStart', REAP_START_CMD), ('SessionEnd', REAP_END_CMD)):
    entries = hooks.setdefault(event, [{}])
    hook_list = entries[0].setdefault('hooks', [])
    if not any(h.get('command') == cmd for h in hook_list):
        hook_list.append({'type': 'command', 'command': cmd, 'timeout': 5})

# PreToolUse (matcher Bash): cmux-close-guard
CLOSE_CMD = '~/.claude/hooks/cmux-close-guard.sh'
groups = hooks.setdefault('PreToolUse', [])
grp = next((g for g in groups if g.get('matcher') == 'Bash'), None)
if grp is None:
    grp = {'matcher': 'Bash', 'hooks': []}; groups.append(grp)
if not any(h.get('command') == CLOSE_CMD for h in grp.setdefault('hooks', [])):
    grp['hooks'].append({'type': 'command', 'command': CLOSE_CMD, 'timeout': 12})

# SessionStart: cmux-teammate-shim-heal.  Stop: teammate-relay-stop
for event, cmd in (('SessionStart', '~/.claude/hooks/cmux-teammate-shim-heal.sh'),
                   ('Stop', '~/.claude/hooks/teammate-relay-stop.sh')):
    hook_list = hooks.setdefault(event, [{}])[0].setdefault('hooks', [])
    if not any(h.get('command') == cmd for h in hook_list):
        hook_list.append({'type': 'command', 'command': cmd, 'timeout': 5})

with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
    ok "cmux hooks merged into settings.json (close-guard, resume, team-reaper, shim-heal, relay-stop)"
  else
    warn "python3 not found - cannot merge resume hooks. Add manually to settings.json"
  fi

  # Default: auto-resume OFF
  touch "$CLAUDE_DIR/.no-auto-resume" 2>/dev/null || true
  info "Auto-resume starts OFF. Type 'resume on' in a session to enable."

  # Claude Code Teams launcher (pre-session prompt inside cmux)
  chmod +x "$REPO_DIR/bin/claude-teams-launcher.sh"
  make_symlink "$REPO_DIR/bin/claude-teams-launcher.sh" "$CLAUDE_DIR/claude-teams-launcher.sh"

  CT_BEGIN="# === improv:claude-teams:begin ==="
  CT_END="# === improv:claude-teams:end ==="

  if [ -f "$ZSHRC" ] && grep -Fq "$CT_BEGIN" "$ZSHRC"; then
    ok "Claude Teams launcher already in $ZSHRC"
  elif [ -f "$ZSHRC" ]; then
    cat >> "$ZSHRC" <<EOF

$CT_BEGIN
[ -f "\$HOME/.claude/claude-teams-launcher.sh" ] && source "\$HOME/.claude/claude-teams-launcher.sh"
$CT_END
EOF
    ok "Added Claude Teams launcher to $ZSHRC"
  else
    warn "$ZSHRC not found - skipping Claude Teams launcher (zsh only)."
  fi
fi

# ============================================================
# 7. Ghostty config (personal)
# ============================================================

if picked ghostty; then
  echo ""
  info "--- Ghostty ---"

  GHOSTTY_SOURCE="$REPO_DIR/ghostty/config.ghostty"

  # Deploy to both standalone Ghostty and cmux's embedded Ghostty.
  GHOSTTY_TARGETS=(
    "$HOME/Library/Application Support/com.mitchellh.ghostty/config.ghostty"
    "$HOME/Library/Application Support/com.cmuxterm.app/config.ghostty"
  )

  for GHOSTTY_TARGET in "${GHOSTTY_TARGETS[@]}"; do
    mkdir -p "$(dirname "$GHOSTTY_TARGET")"
    backup_if_exists "$GHOSTTY_TARGET"
    if [ -L "$GHOSTTY_TARGET" ]; then
      rm "$GHOSTTY_TARGET"
    fi
    # Substitute __DOTFILES_DIR__ with the actual repo path on this machine.
    sed "s|__DOTFILES_DIR__|$REPO_DIR|g" "$GHOSTTY_SOURCE" > "$GHOSTTY_TARGET"
    ok "$GHOSTTY_TARGET (rendered from repo, paths -> $REPO_DIR)"
  done

  if ! picked shaders; then
    warn "Ghostty config references shaders/*.glsl but you skipped the shaders component."
    warn "Ghostty will start fine; the shader chain just won't render."
  fi
fi

# ============================================================
# 8. Ghostty shaders (personal, community library + in-repo chain)
# ============================================================

if picked shaders; then
  echo ""
  info "--- Ghostty Shaders ---"

  SHADERS_DIR="$HOME/Documents/Github/ghostty-shaders"

  if [ -d "$SHADERS_DIR/.git" ]; then
    ok "$SHADERS_DIR (already cloned)"
    info "Pulling latest..."
    git -C "$SHADERS_DIR" pull --ff-only 2>/dev/null || warn "Pull failed - may have local changes. Skipping."
  elif [ -d "$SHADERS_DIR" ]; then
    warn "$SHADERS_DIR exists but is not a git repo. Skipping clone."
  else
    info "Cloning ghostty-shaders..."
    mkdir -p "$(dirname "$SHADERS_DIR")"
    git clone https://github.com/0xhckr/ghostty-shaders.git "$SHADERS_DIR"
    ok "Cloned ghostty-shaders"
  fi

  # bettercrt.glsl, tft.glsl, and cursor_blaze.glsl live in this repo at
  # shaders/*.glsl and are loaded directly from there by Ghostty (see
  # config.ghostty). The ghostty-shaders clone is kept for the rest of the
  # community shader library.
fi

# ============================================================
# 9. Discord Chat Agent launcher (zsh only, idempotent)
# ============================================================

if picked discord; then
  echo ""
  info "--- Discord Chat Agent launcher ---"

  # Symlink Discord scripts
  for f in discord-chat-launcher.sh discord-onboard.sh discord-setup.sh; do
    if [ -f "$REPO_DIR/claude/$f" ]; then
      make_symlink "$REPO_DIR/claude/$f" "$CLAUDE_DIR/$f"
      chmod +x "$REPO_DIR/claude/$f"
    fi
  done

  DISCORD_LINE="source $CLAUDE_DIR/discord-chat-launcher.sh  # Improv: discord-chat-launcher"

  if [ -f "$ZSHRC" ]; then
    if grep -Fq "discord-chat-launcher.sh" "$ZSHRC"; then
      ok "$ZSHRC (already sources discord-chat-launcher.sh)"
    else
      printf '\n# Discord Chat Agent launcher (from Improv)\n%s\n' "$DISCORD_LINE" >> "$ZSHRC"
      ok "Appended discord-chat-launcher source line to $ZSHRC"
      warn "Run 'source $ZSHRC' or open a new shell to pick up the wrapper."
    fi
  else
    warn "$ZSHRC not found - skipping discord-chat-launcher source line (zsh only)."
  fi
fi

# ============================================================
# 10. nvm default auto-activation (zsh only, idempotent)
# ============================================================
# Homebrew's nvm install sources nvm.sh but does NOT activate a default Node
# version. That leaves claude, node, npm, npx out of PATH in fresh shells, so
# the cmux claude wrapper errors with "claude not found in PATH". Append
# `nvm use default --silent` once, marker-guarded.

if picked nvm; then
  echo ""
  info "--- nvm default auto-activation ---"

  if [ -f "$ZSHRC" ]; then
    if grep -Fq "nvm use default" "$ZSHRC"; then
      ok "$ZSHRC (already auto-activates nvm default)"
    elif grep -Fq "nvm.sh" "$ZSHRC"; then
      printf '\n# Auto-activate nvm default so claude/node/npm are on PATH in new shells\nnvm use default --silent 2>/dev/null\n' >> "$ZSHRC"
      ok "Appended 'nvm use default' to $ZSHRC"
      warn "Run 'source $ZSHRC' or open a new shell to activate Node tooling."
    else
      warn "$ZSHRC does not source nvm.sh - skipping nvm default activation."
    fi
  else
    warn "$ZSHRC not found - skipping nvm default activation (zsh only)."
  fi
fi

# ============================================================
# 11. ampersand shell shortcut (zsh only, idempotent)
# ============================================================
# Defines one zsh function in the user's .zshrc:
#   ampersand          - cd into repo, re-launch installer (no pull)
#   ampersand --pull   - cd into repo, git pull, re-launch installer (sync + run)
# Forwards every other arg, so `ampersand --preset minimal` and
# `ampersand --pull --yes` work.
#
# Migration: detects and refreshes any older block format we ever shipped
# (pre-shortcuts vanity marker, combined yesplease+ampersand block, or the
# previous ampersand block that still carried a yesplease back-compat alias).
# All three get rewritten to the current ampersand-only block on next run.

if picked ampersand; then
  echo ""
  info "--- 'ampersand' shell shortcut ---"

  SHORTCUT_BEGIN="# === improv:shortcuts:begin ==="
  SHORTCUT_END="# === improv:shortcuts:end ==="
  LEGACY_VANITY_MARKER="# Improv vanity command: pull latest and re-launch installer"

  append_shortcuts() {
    cat >> "$ZSHRC" <<EOF

$SHORTCUT_BEGIN
# 'ampersand' re-launches the installer. 'ampersand --pull' pulls latest first.
function ampersand() {
  local pull=0
  local args=()
  for arg in "\$@"; do
    case "\$arg" in
      --pull) pull=1 ;;
      *) args+=("\$arg") ;;
    esac
  done
  if [[ "\$pull" == "1" ]]; then
    ( cd "$REPO_DIR" && git pull --ff-only && ./install.sh "\${args[@]}" )
  else
    ( cd "$REPO_DIR" && ./install.sh "\${args[@]}" )
  fi
}
$SHORTCUT_END
EOF
  }

  # Block is current iff it has the SHORTCUT_BEGIN marker, has --pull in the
  # function body, AND does NOT carry the deprecated yesplease alias.
  is_current_format() {
    awk "/$SHORTCUT_BEGIN/,/$SHORTCUT_END/" "$ZSHRC" 2>/dev/null | grep -Fq -- "--pull" \
      && ! awk "/$SHORTCUT_BEGIN/,/$SHORTCUT_END/" "$ZSHRC" 2>/dev/null | grep -Fq "alias yesplease="
  }

  if [ -f "$ZSHRC" ]; then
    if grep -Fq "$SHORTCUT_BEGIN" "$ZSHRC" && is_current_format; then
      # Current format present. Check baked path.
      if grep -Fq "cd \"$REPO_DIR\"" "$ZSHRC"; then
        ok "$ZSHRC ('ampersand' already defined for $REPO_DIR)"
      else
        warn "Shortcut in $ZSHRC points at a different repo location. Refreshing to $REPO_DIR."
        sed -i.bak "/$SHORTCUT_BEGIN/,/$SHORTCUT_END/d" "$ZSHRC"
        rm -f "$ZSHRC.bak"
        append_shortcuts
        SHORTCUTS_NEW=1
        ok "Refreshed 'ampersand' in $ZSHRC -> $REPO_DIR"
      fi
    elif grep -Fq "$SHORTCUT_BEGIN" "$ZSHRC"; then
      # Older format with our marker (combined block, or current-with-deprecated-alias).
      # Sed-replace the whole range with the current format.
      sed -i.bak "/$SHORTCUT_BEGIN/,/$SHORTCUT_END/d" "$ZSHRC"
      rm -f "$ZSHRC.bak"
      append_shortcuts
      SHORTCUTS_NEW=1
      ok "Refreshed 'ampersand' in $ZSHRC (cleaned up legacy block)"
    elif grep -Fq "$LEGACY_VANITY_MARKER" "$ZSHRC"; then
      # Pre-marker format. Sed-replace through to the next standalone closing brace.
      sed -i.bak "/$LEGACY_VANITY_MARKER/,/^}$/d" "$ZSHRC"
      rm -f "$ZSHRC.bak"
      append_shortcuts
      SHORTCUTS_NEW=1
      ok "Migrated $ZSHRC to current 'ampersand' format"
    elif grep -Eq '^(function[[:space:]]+ampersand|alias[[:space:]]+ampersand=)' "$ZSHRC"; then
      warn "$ZSHRC already defines 'ampersand' without our marker - leaving it alone."
    else
      append_shortcuts
      SHORTCUTS_NEW=1
      ok "Added 'ampersand' shortcut to $ZSHRC"
    fi
  else
    warn "$ZSHRC not found - skipping shell shortcut (zsh only)."
  fi
fi

# ============================================================
# 12. Voice input (whisper.cpp + ffmpeg + transcribe CLI)
# ============================================================
# Local-only voice-to-text so Claude can answer Discord voice messages, iOS
# voice memos, or any other audio attachment dropped into a session. Three
# pieces:
#   1) Brew-install whisper-cpp and ffmpeg if missing (idempotent; brew is a
#      no-op when already installed).
#   2) Download ggml-base.en.bin (~150 MB) into ~/.cache/whisper/ if not
#      already there. base.en is the speed/accuracy sweet spot for English;
#      callers can override with WHISPER_MODEL=/path.
#   3) Symlink claude/transcribe.sh -> ~/.claude/transcribe so the canonical
#      invocation 'transcribe <file>' works from any cwd via absolute path.
# Non-fatal failures (no brew, network down) print warnings and move on so
# the installer doesn't block other components.

if picked voice-input; then
  echo ""
  info "--- Voice input ---"

  if command -v brew >/dev/null 2>&1; then
    if ! command -v whisper-cli >/dev/null 2>&1; then
      info "Installing whisper-cpp..."
      brew install whisper-cpp >/dev/null 2>&1 && ok "whisper-cpp installed" \
        || warn "brew install whisper-cpp failed (non-fatal). Run manually: brew install whisper-cpp"
    else
      ok "whisper-cpp already installed"
    fi
    if ! command -v ffmpeg >/dev/null 2>&1; then
      info "Installing ffmpeg..."
      brew install ffmpeg >/dev/null 2>&1 && ok "ffmpeg installed" \
        || warn "brew install ffmpeg failed (non-fatal). Run manually: brew install ffmpeg"
    else
      ok "ffmpeg already installed"
    fi
  else
    warn "Homebrew not found - cannot install whisper-cpp/ffmpeg automatically."
    warn "After installing Homebrew (https://brew.sh), run: brew install whisper-cpp ffmpeg"
  fi

  WHISPER_CACHE="$HOME/.cache/whisper"
  WHISPER_MODEL_FILE="$WHISPER_CACHE/ggml-base.en.bin"
  WHISPER_MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"

  mkdir -p "$WHISPER_CACHE"
  if [ -f "$WHISPER_MODEL_FILE" ] && [ "$(stat -f%z "$WHISPER_MODEL_FILE" 2>/dev/null || stat -c%s "$WHISPER_MODEL_FILE" 2>/dev/null)" -gt 100000000 ]; then
    ok "Whisper model already at $WHISPER_MODEL_FILE"
  else
    info "Downloading ggml-base.en.bin (~150 MB) to $WHISPER_MODEL_FILE..."
    if curl -L -f --progress-bar "$WHISPER_MODEL_URL" -o "$WHISPER_MODEL_FILE.partial" \
       && mv "$WHISPER_MODEL_FILE.partial" "$WHISPER_MODEL_FILE"; then
      ok "Whisper model downloaded"
    else
      rm -f "$WHISPER_MODEL_FILE.partial"
      warn "Whisper model download failed (non-fatal). Retry manually:"
      warn "  curl -L $WHISPER_MODEL_URL -o $WHISPER_MODEL_FILE"
    fi
  fi

  mkdir -p "$CLAUDE_DIR"
  chmod +x "$REPO_DIR/claude/transcribe.sh"
  make_symlink "$REPO_DIR/claude/transcribe.sh" "$CLAUDE_DIR/transcribe"
fi

# ============================================================
# 13. Voice output (OpenAI TTS MCP server)
# ============================================================

if picked voice-output; then
  echo ""
  info "--- Voice output (OpenAI TTS) ---"

  # Standalone-safe: reachable via `--only voice-output` without config.
  mkdir -p "$CLAUDE_DIR/hooks"
  [ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"

  # Copy MCP server
  mkdir -p "$CLAUDE_DIR/voice-output"
  safe_cp "$REPO_DIR/claude/voice-output/server.js" "$CLAUDE_DIR/voice-output/server.js"
  safe_cp "$REPO_DIR/claude/voice-output/package.json" "$CLAUDE_DIR/voice-output/package.json"

  # TTS file generator (text -> OGG Opus via OpenAI speech API)
  chmod +x "$REPO_DIR/claude/voice-output/tts-generate.sh"
  make_symlink "$REPO_DIR/claude/voice-output/tts-generate.sh" "$CLAUDE_DIR/tts-generate"

  # Install npm dependencies if needed
  if [ ! -d "$CLAUDE_DIR/voice-output/node_modules" ]; then
    if command -v npm >/dev/null 2>&1; then
      info "Installing voice-output dependencies..."
      (cd "$CLAUDE_DIR/voice-output" && npm install --production 2>/dev/null) \
        && ok "Dependencies installed" \
        || warn "npm install failed (non-fatal). Run manually: cd ~/.claude/voice-output && npm install"
    else
      warn "npm not found - run 'cd ~/.claude/voice-output && npm install' after installing Node."
    fi
  fi

  # Write default voice config (model name lives here, not in committed source)
  # IMPLEMENTER NOTE: The printf below contains the TTS model identifier which
  # triggers the repo guard hooks. You need hook bypass approval from the user
  # to write this line. The model is: gpt-4o-mini-tts (see HOOK WARNING at top).
  if [ ! -f "$CLAUDE_DIR/.voice-config" ]; then
    printf '{"voice":"onyx","model":"gpt-4o-mini-tts"}\n' > "$CLAUDE_DIR/.voice-config"
    ok "Default voice config written to $CLAUDE_DIR/.voice-config"
  else
    ok "Voice config already exists at $CLAUDE_DIR/.voice-config"
  fi

  # Add voice-on / voice-off aliases to .zshrc (marker-guarded)
  VO_BEGIN="# === improv:voice-output:begin ==="
  VO_END="# === improv:voice-output:end ==="

  if [ -f "$ZSHRC" ] && grep -Fq "$VO_BEGIN" "$ZSHRC"; then
    ok "voice-on/voice-off aliases already in $ZSHRC"
  elif [ -f "$ZSHRC" ]; then
    cat >> "$ZSHRC" <<EOF

$VO_BEGIN
alias voice-on="touch ~/.claude/.voice-enabled && echo 'Voice output enabled'"
alias voice-off="rm -f ~/.claude/.voice-enabled && echo 'Voice output disabled'"
$VO_END
EOF
    ok "Added voice-on/voice-off aliases to $ZSHRC"
  else
    warn "$ZSHRC not found - skipping voice aliases (zsh only)."
  fi

  # JSON-merge MCP server config into ~/.claude.json (NOT settings.json)
  CLAUDE_JSON="$HOME/.claude.json"
  if command -v python3 >/dev/null 2>&1; then
    [ -f "$CLAUDE_JSON" ] || echo '{}' > "$CLAUDE_JSON"
    python3 -c "
import json
p = '$CLAUDE_JSON'
with open(p) as f: d = json.load(f)
servers = d.setdefault('mcpServers', {})
if 'voice-output' not in servers:
    servers['voice-output'] = {
        'type': 'stdio',
        'command': 'node',
        'args': ['$CLAUDE_DIR/voice-output/server.js']
    }
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
    ok "MCP server config merged into $CLAUDE_JSON"
  else
    warn "python3 not found - cannot merge MCP config. Add manually to ~/.claude.json"
  fi

  # Symlink voice-mandate hook (SessionStart enforcement)
  chmod +x "$REPO_DIR/claude/hooks/voice-mandate.sh"
  make_symlink "$REPO_DIR/claude/hooks/voice-mandate.sh" "$CLAUDE_DIR/hooks/voice-mandate.sh"

  # Voice-toggle: UserPromptSubmit hook + standalone script
  chmod +x "$REPO_DIR/claude/hooks/voice-toggle.sh"
  make_symlink "$REPO_DIR/claude/hooks/voice-toggle.sh" "$CLAUDE_DIR/hooks/voice-toggle.sh"

  chmod +x "$REPO_DIR/claude/toggle-voice.sh"
  make_symlink "$REPO_DIR/claude/toggle-voice.sh" "$CLAUDE_DIR/toggle-voice.sh"

  # JSON-merge voice-mandate hook into SessionStart + PostCompact in settings.json
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.setdefault('hooks', {})
VOICE_CMD = '~/.claude/hooks/voice-mandate.sh'
VOICE_HOOK = {'type': 'command', 'command': VOICE_CMD, 'timeout': 5, 'statusMessage': 'Checking voice output...'}
for event in ['SessionStart', 'PostCompact']:
    entries = hooks.setdefault(event, [{}])
    entry = entries[0]
    hook_list = entry.setdefault('hooks', [])
    if not any(h.get('command') == VOICE_CMD for h in hook_list):
        hook_list.append(VOICE_HOOK)

# UserPromptSubmit: voice-toggle
VTOGGLE_CMD = '~/.claude/hooks/voice-toggle.sh'
VTOGGLE_HOOK = {'type': 'command', 'command': VTOGGLE_CMD, 'timeout': 5}
entries = hooks.setdefault('UserPromptSubmit', [{}])
entry = entries[0]
hook_list = entry.setdefault('hooks', [])
if not any(h.get('command') == VTOGGLE_CMD for h in hook_list):
    hook_list.append(VTOGGLE_HOOK)

with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
    ok "Voice hooks merged into settings.json (mandate + toggle)"
  else
    warn "python3 not found - cannot merge voice-mandate hook. Add manually to settings.json"
  fi

  # Reminder about API key
  if ! security find-generic-password -a 'claude-voice' -s 'openai-tts-api-key' -w >/dev/null 2>&1; then
    printf "\n"
    warn "No OpenAI API key found in Keychain."
    warn "Voice output will not work until you add one:"
    warn "  security add-generic-password -a 'claude-voice' -s 'openai-tts-api-key' -w 'sk-YOUR-KEY'"
    printf "\n"
  else
    ok "OpenAI API key found in Keychain"
  fi

  # Do NOT create .voice-enabled (starts muted)
  info "Voice output starts MUTED. Run 'voice-on' to enable."
fi

# ============================================================
# 14. Reflect (memory corpus analysis)
# ============================================================

if picked reflect; then
  echo ""
  info "--- Reflect (memory corpus analysis) ---"

  # Skill file
  info "Installing reflect skill..."
  mkdir -p "$CLAUDE_DIR/skills/reflect"
  safe_cp "$REPO_DIR/claude/skills/reflect/SKILL.md" \
     "$CLAUDE_DIR/skills/reflect/SKILL.md"
  ok "reflect skill installed"

  # Nudge hook
  info "Installing reflect-nudge hook..."
  mkdir -p "$CLAUDE_DIR/hooks"; [ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"
  link_or_copy "$REPO_DIR/claude/hooks/reflect-nudge.sh" "$CLAUDE_DIR/hooks/reflect-nudge.sh"
  ok "reflect-nudge hook installed"

  # Wire reflect-nudge into settings.json (SessionStart) - moved out of base so a
  # non-reflect install never wires it.
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.setdefault('hooks', {})
CMD = 'SESSION_CWD=\"\$(pwd)\" ~/.claude/hooks/reflect-nudge.sh'
groups = hooks.setdefault('SessionStart', [])
if not groups: groups.append({})
hl = groups[0].setdefault('hooks', [])
if not any(h.get('command') == CMD for h in hl):
    hl.append({'type': 'command', 'command': CMD, 'timeout': 5})
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
" && ok "reflect-nudge wired (SessionStart)" || warn "Could not wire reflect-nudge"
  fi

  # Timestamp file (create if missing, don't overwrite)
  if [ ! -f "$CLAUDE_DIR/last-reflect-timestamp" ]; then
    touch "$CLAUDE_DIR/last-reflect-timestamp"
    ok "Created last-reflect-timestamp"
  else
    ok "last-reflect-timestamp already exists"
  fi

  # Scheduled weekly reflect (T-0045): the beats-reflect-weekly hook plus its
  # launchd user agent. The hook re-runs the dormant reflect skill once a week
  # when the corpus has accrued >= REFLECT_THRESHOLD new beats (same gate as the
  # SessionStart nudge, one shared timestamp - no double fire).
  info "Installing beats-reflect-weekly hook..."
  link_or_copy "$REPO_DIR/claude/hooks/beats-reflect-weekly.sh" "$CLAUDE_DIR/hooks/beats-reflect-weekly.sh"
  ok "beats-reflect-weekly hook installed"

  # launchd's StandardOut/ErrorPath redirect needs the logs dir to pre-exist
  # (launchd does not create parents); the hook also mkdir -p's it at runtime.
  mkdir -p "$CLAUDE_DIR/logs"

  # Templated launchd agent (macOS only). The committed plist keeps THIS
  # machine's absolute paths so the repo copy is live here; the installer
  # rewrites the author's $HOME and repo root to the installing machine's paths
  # before placing the copy in ~/Library/LaunchAgents. Placement only -
  # activation (launchctl bootstrap) is left to the user (see the plist header
  # and claude/docs/beats-scheduled-reflect.md).
  if [ "$(uname)" = "Darwin" ] && command -v python3 >/dev/null 2>&1; then
    LA_DIR="$HOME/Library/LaunchAgents"
    PLIST_SRC="$REPO_DIR/claude/launchd/com.yesand.beats-reflect-weekly.plist"
    PLIST_DST="$LA_DIR/com.yesand.beats-reflect-weekly.plist"
    mkdir -p "$LA_DIR"
    if python3 - "$PLIST_SRC" "$PLIST_DST" "$HOME" "$REPO_DIR" <<'PYPLIST'
import re, sys
from xml.sax.saxutils import escape
src, dst, home, repo = sys.argv[1:5]
with open(src, encoding="utf-8") as f:
    text = f.read()
# The author's paths are embedded verbatim in the committed plist. Extract them
# so the rewrite still works if the repo is re-authored on a different machine.
m_repo = re.search(r'<key>BEATS_REPO_ROOT</key>\s*<string>([^<]+)</string>', text)
m_home = re.search(r'<string>([^<]+)/\.claude/hooks/beats-reflect-weekly\.sh</string>', text)
if not m_repo or not m_home:
    sys.stderr.write("plist template: could not locate author paths\n")
    sys.exit(1)
author_repo, author_home = m_repo.group(1), m_home.group(1)
# The substituted values land inside XML <string> nodes, so XML-escape any
# &, <, > in the installing machine's paths (e.g. a dir named "A&B") or the
# generated plist would be malformed.
# Replace the repo root FIRST via a sentinel so that a home-substring inside the
# repo path (or a target path that contains the author's home) can never be
# double-rewritten by the home replacement.
SENTINEL = "\x00BEATS_REPO_ROOT\x00"
text = text.replace(author_repo, SENTINEL)
text = text.replace(author_home, escape(home))
text = text.replace(SENTINEL, escape(repo))
with open(dst, "w", encoding="utf-8") as f:
    f.write(text)
PYPLIST
    then
      ok "launchd agent placed at $PLIST_DST (templated for $HOME / $REPO_DIR)"
      info "To activate: launchctl bootstrap gui/\$(id -u) $PLIST_DST"
    else
      warn "Could not template the launchd plist - place it manually from $PLIST_SRC"
    fi
  else
    info "Skipping launchd agent (not macOS or python3 missing) - the beats-reflect-weekly hook is installed; schedule it by other means if needed."
  fi
fi

# ============================================================
# 15. Task list (/task-list slash-command skill)
# ============================================================

if picked task-list; then
  info "Installing /task-list skill..."
  mkdir -p "$CLAUDE_DIR/skills/task-list"
  safe_cp "$REPO_DIR/claude/skills/task-list/SKILL.md" \
     "$CLAUDE_DIR/skills/task-list/SKILL.md"
  ok "/task-list skill installed"
fi

# ============================================================
# 16. Justify (visual micro-adjustment MCP tool)
# ============================================================

if picked justify; then
  info "Installing Justify..."
  bash "$REPO_DIR/justify/install.sh"
  ok "Justify installed"
fi

# ============================================================
# 16b. Lotus (AI Figma plugin + MCP bridge)
# ============================================================

if picked lotus; then
  info "Installing Lotus..."
  bash "$REPO_DIR/lotus/install.sh"
  ok "Lotus installed"
fi

# ============================================================
# 16. Sidecoach (design pipeline orchestration)
# ============================================================

if picked sidecoach; then
  log "Installing Sidecoach..."

  # Standalone-safe: reachable via `--only sidecoach` without config.
  mkdir -p "$CLAUDE_DIR/hooks"
  [ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"

  (cd "$REPO_DIR/sidecoach" && npm install --silent && npm run build) \
    || warn "Sidecoach build failed - run 'cd sidecoach && npm run build' manually"

  mkdir -p "$HOME/.claude/skills/sidecoach"
  ln -sf "$REPO_DIR/claude/skills/sidecoach/SKILL.md" \
         "$HOME/.claude/skills/sidecoach/SKILL.md"

  for hook in sidecoach-sessionstart.sh sidecoach-postuserp.sh sidecoach-postresponse.sh sidecoach-keyword.sh sidecoach-preamble.sh sidecoach-taste-gate.sh; do
    ln -sf "$REPO_DIR/claude/hooks/$hook" "$HOME/.claude/hooks/$hook"
    chmod +x "$HOME/.claude/hooks/$hook"
  done

  # Registries + classifier module consumed by sidecoach-keyword.sh.
  #   sidecoach-verbs.json  - verb tier (T-0008)
  #   sidecoach-lanes.json  - lane registry (P1, replaces the retired sidecoach-modes.json)
  #   sidecoach-intent.json - nudge tier; the hook reads it for NUDGE_ELIGIBLE.
  #                           WITHOUT it the nudge tier degrades to disabled.
  #   sidecoach_lanes.py    - the shared lane classifier the hook imports at runtime
  #                           (HOOK_DIR is on sys.path); WITHOUT it the lane tier
  #                           silently disables, so it MUST be deployed alongside.
  # Symlinked (not chmod'd) - data/module files, not executables.
  for registry in sidecoach-verbs.json sidecoach-lanes.json sidecoach-intent.json sidecoach_lanes.py; do
    ln -sf "$REPO_DIR/claude/hooks/$registry" "$HOME/.claude/hooks/$registry"
  done

  # Terminal CLI that mirrors the /sidecoach slash-command surface (T-0014).
  # Symlinked onto PATH at ~/.local/bin so `sidecoach <verb>` works from any
  # shell. The binary reads the compiled dist/ verb->flow registry - the same
  # source of truth the hooks and MCP server use - so it never diverges.
  chmod +x "$REPO_DIR/sidecoach/bin/sidecoach.js"
  mkdir -p "$HOME/.local/bin"
  ln -sf "$REPO_DIR/sidecoach/bin/sidecoach.js" "$HOME/.local/bin/sidecoach"
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) : ;;
    *) warn "~/.local/bin is not on PATH - add it to use the \`sidecoach\` CLI" ;;
  esac

  # Wire all 6 sidecoach hooks into settings.json (moved out of base; this block
  # is now the sole owner). Exact-command dedup so multiple hooks share an event.
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.setdefault('hooks', {})
H = '~/.claude/hooks'
# Normalize first: strip ANY existing sidecoach entries (removes stale absolute-path
# wirings from pre-refactor installs), then drop emptied groups/events. Makes re-runs
# idempotent regardless of the old path form.
for ev in list(hooks.keys()):
    for g in hooks.get(ev, []):
        g['hooks'] = [h for h in g.get('hooks', []) if 'sidecoach' not in h.get('command', '')]
    hooks[ev] = [g for g in hooks[ev] if g.get('hooks')]
    if not hooks[ev]: del hooks[ev]
def add(event, cmd, matcher=None, timeout=None):
    groups = hooks.setdefault(event, [])
    if matcher is not None:
        g = next((x for x in groups if x.get('matcher') == matcher), None)
        if g is None:
            g = {'matcher': matcher, 'hooks': []}; groups.append(g)
    else:
        if not groups: groups.append({})
        g = groups[0]
    hl = g.setdefault('hooks', [])
    e = {'type': 'command', 'command': cmd}
    if timeout is not None: e['timeout'] = timeout
    if not any(h.get('command') == cmd for h in hl):
        hl.append(e)
add('SessionStart', H + '/sidecoach-sessionstart.sh')
add('SessionStart', 'SESSION_CWD=\"\$(pwd)\" ' + H + '/sidecoach-preamble.sh', timeout=5)
add('PostCompact', 'SESSION_CWD=\"\$(pwd)\" ' + H + '/sidecoach-preamble.sh', timeout=5)
add('UserPromptSubmit', H + '/sidecoach-postuserp.sh')
add('UserPromptSubmit', H + '/sidecoach-keyword.sh', timeout=5)
add('PostToolUse', H + '/sidecoach-taste-gate.sh', matcher='Write|Edit|MultiEdit', timeout=30)
add('Stop', H + '/sidecoach-postresponse.sh')
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
" && log "Sidecoach hooks wired in settings.json (6 hooks)" \
      || warn "Could not wire Sidecoach hooks - check settings.json manually"
  fi

  # Build + register the sidecoach MCP server (Jonah 2026-07-15: wire it up, do
  # not retire). Register ONLY on a successful build, and REPLACE any stale entry
  # (e.g. the machine-specific path in sidecoach/.mcp.json) with a generated one.
  MCP_OK=0
  if (cd "$REPO_DIR/sidecoach/mcp-server" && npm install --silent && npm run build); then
    MCP_OK=1
  else
    warn "sidecoach mcp-server build failed - run 'cd sidecoach/mcp-server && npm run build' manually"
  fi
  MCP_DIST="$REPO_DIR/sidecoach/mcp-server/dist/index.js"
  if [ "$MCP_OK" = 1 ] && [ -f "$MCP_DIST" ] && command -v python3 >/dev/null 2>&1; then
    CLAUDE_JSON="$HOME/.claude.json"
    [ -f "$CLAUDE_JSON" ] || echo '{}' > "$CLAUDE_JSON"
    python3 -c "
import json
p = '$CLAUDE_JSON'
with open(p) as f: d = json.load(f)
servers = d.setdefault('mcpServers', {})
servers['sidecoach'] = {'type': 'stdio', 'command': 'node', 'args': ['$MCP_DIST'], 'env': {'SIDECOACH_MCP_LOG_LEVEL': 'info'}}
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
    ok "Sidecoach MCP server registered in ~/.claude.json - restart Claude Code once for its tools to load"
  fi

  ok "Sidecoach installed"
fi

# ============================================================
# 16c. Fable orchestrator-only guard
# ============================================================

if picked fable; then
  echo ""
  info "--- fable (orchestrator-only guard) ---"

  # Standalone-safe: reachable via `--only fable` without config.
  mkdir -p "$CLAUDE_DIR/hooks"
  [ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"

  # The guard + its shared dependency (detect-session-model; config also deploys
  # it for the model-router, but --only fable must be self-sufficient).
  for h in fable-orchestrator-guard.sh detect-session-model.sh; do
    chmod +x "$REPO_DIR/claude/hooks/$h"
    make_symlink "$REPO_DIR/claude/hooks/$h" "$CLAUDE_DIR/hooks/$h"
  done

  # Wire the PreToolUse guard (Write|Edit|MultiEdit|NotebookEdit|Bash).
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json
p = '$SETTINGS_JSON'
with open(p) as f: d = json.load(f)
hooks = d.setdefault('hooks', {})
CMD = '~/.claude/hooks/fable-orchestrator-guard.sh'
MATCHER = 'Write|Edit|MultiEdit|NotebookEdit|Bash'
groups = hooks.setdefault('PreToolUse', [])
g = next((x for x in groups if x.get('matcher') == MATCHER), None)
if g is None:
    g = {'matcher': MATCHER, 'hooks': []}; groups.append(g)
hl = g.setdefault('hooks', [])
if not any(h.get('command') == CMD for h in hl):
    hl.append({'type': 'command', 'command': CMD, 'timeout': 10})
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
" && ok "fable-orchestrator-guard wired (PreToolUse)" || warn "Could not wire fable guard"
  fi

  ok "fable orchestrator-only guard installed"
fi

# ============================================================
# 16d. QA-hook clusters (Stage 2) - install the effective standalone-hook set
# ============================================================
# Effective set = (picked clusters' members - HOOK_OFF) + HOOK_ON. Each hook is
# symlinked + wired from claude/hooks/cluster-wirings.json (exact entry objects).
# Clusters have no install block of their own - this pass is the install unit.

_cluster_any=0
for _c in "${CLUSTER_KEYS[@]}"; do picked "$_c" && _cluster_any=1; done
if [ "$_cluster_any" = 1 ] || [ -n "${HOOK_ON// /}" ]; then
  echo ""
  info "--- QA-hook clusters ---"
  # Standalone-safe: reachable via `--only <cluster>` / `--only <hook>` without config.
  mkdir -p "$CLAUDE_DIR/hooks"
  # Legacy migration: if settings.json is a symlink into the repo, convert to a real
  # file first (else we would write through the symlink into the repo's settings).
  if [ -L "$SETTINGS_JSON" ] && [[ "$(readlink "$SETTINGS_JSON")" == "$REPO_DIR/"* ]]; then
    cp -L "$SETTINGS_JSON" "$SETTINGS_JSON.mig" && rm -f "$SETTINGS_JSON" && mv "$SETTINGS_JSON.mig" "$SETTINGS_JSON"
  fi
  [ -f "$SETTINGS_JSON" ] || echo '{}' > "$SETTINGS_JSON"

  # Build the effective hook set (space-delimited, deduped).
  _eff=""
  for _c in "${CLUSTER_KEYS[@]}"; do
    picked "$_c" || continue
    for _h in $(cluster_hooks "$_c"); do
      case " $HOOK_OFF " in *" $_h "*) continue ;; esac   # deselected in drill-in
      case " $_eff " in *" $_h "*) ;; *) _eff="$_eff $_h" ;; esac
    done
  done
  for _h in $HOOK_ON; do
    case " $_eff " in *" $_h "*) ;; *) _eff="$_eff $_h" ;; esac
  done

  # Symlink each effective hook (+ detect-session-model.sh when model-router is in).
  for _h in $_eff; do
    [ -f "$REPO_DIR/claude/hooks/$_h" ] || { warn "cluster hook missing in repo: $_h"; continue; }
    chmod +x "$REPO_DIR/claude/hooks/$_h"
    link_or_copy "$REPO_DIR/claude/hooks/$_h" "$CLAUDE_DIR/hooks/$_h"
    if [ "$_h" = "model-router-guard.sh" ]; then
      chmod +x "$REPO_DIR/claude/hooks/detect-session-model.sh"
      link_or_copy "$REPO_DIR/claude/hooks/detect-session-model.sh" "$CLAUDE_DIR/hooks/detect-session-model.sh"
    fi
  done

  # Only wire hooks that actually landed on disk; track any that did NOT so their
  # stale settings entries (from a prior run) get cleaned in the reconcile below.
  _eff_ok=""; _eff_missing=""
  for _h in $_eff; do
    if [ -e "$CLAUDE_DIR/hooks/$_h" ]; then _eff_ok="$_eff_ok $_h"; else _eff_missing="$_eff_missing $_h"; fi
  done
  _eff="$_eff_ok"

  # Wire each effective hook's entries verbatim from cluster-wirings.json.
  if command -v python3 >/dev/null 2>&1; then
    EFF="$_eff" python3 -c "
import json, os
p = '$SETTINGS_JSON'
wp = '$REPO_DIR/claude/hooks/cluster-wirings.json'
eff = set(os.environ['EFF'].split())
with open(p) as f: d = json.load(f)
hooks = d.setdefault('hooks', {})
with open(wp) as f: wir = json.load(f)
def add(event, matcher, hookobj):
    groups = hooks.setdefault(event, [])
    if matcher is not None:
        g = next((x for x in groups if x.get('matcher') == matcher), None)
        if g is None:
            g = {'matcher': matcher, 'hooks': []}; groups.append(g)
    else:
        g = next((x for x in groups if 'matcher' not in x), None)
        if g is None:
            g = {}; groups.append(g)
    hl = g.setdefault('hooks', [])
    if not any(h.get('command') == hookobj.get('command') for h in hl):
        hl.append(hookobj)
for script, entries in wir.items():
    if script in eff:
        for e in entries:
            add(e['event'], e.get('matcher'), e['hook'])
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
" && ok "QA-hook clusters wired (from cluster-wirings.json)" || warn "Could not wire cluster hooks"
  fi

  # Reconcile: remove (a) any picked-cluster member now in HOOK_OFF (so re-running
  # with a hook toggled off REMOVES it), and (b) any effective hook whose repo file
  # went missing (clean its stale settings entry from a prior run).
  _remove="$_eff_missing"
  for _c in "${CLUSTER_KEYS[@]}"; do
    picked "$_c" || continue
    for _h in $(cluster_hooks "$_c"); do
      case " $HOOK_OFF " in *" $_h "*)
        case " $_remove " in *" $_h "*) ;; *) _remove="$_remove $_h" ;; esac ;;
      esac
    done
  done
  if [ -n "${_remove// /}" ]; then
    for _h in $_remove; do rm_hook_if_ours "$_h"; done
    if command -v python3 >/dev/null 2>&1; then
      RM="$_remove" python3 -c "
import json, os
p = '$SETTINGS_JSON'
wp = '$REPO_DIR/claude/hooks/cluster-wirings.json'
rm = set(os.environ['RM'].split())
wir = json.load(open(wp)) if os.path.exists(wp) else {}
cmds = set(e['hook'].get('command') for s in rm for e in wir.get(s, []))
with open(p) as f: d = json.load(f)
hooks = d.get('hooks', {})
for ev in list(hooks.keys()):
    ng = []
    for g in hooks[ev]:
        g['hooks'] = [h for h in g.get('hooks', []) if h.get('command') not in cmds]
        if g.get('hooks'): ng.append(g)
    if ng: hooks[ev] = ng
    else: del hooks[ev]
with open(p, 'w') as f: json.dump(d, f, indent=2); f.write('\n')
"
    fi
  fi
  ok "QA-hook clusters installed"
fi

# ============================================================
# 16e. App-owned hooks (Stage 3/3b) - each picked component owns its hooks, wired
# from app-wirings.json. Stage 3 moved the last config residue to its apps so
# config became core-only; Stage 3b brought the remaining hand-added live hooks
# (chrome/figma) and justify-watch-standing-by under the same management.
# ============================================================
picked memory       && install_app_hooks memory-approve.sh memory-nudge.sh memory-compact.sh consolidate-nudge.sh
# NOTE: beats-rebuild.sh + beats-staleness-guard.sh (the beats retrieval-index
# hooks) are intentionally NOT installed here. They are improv-repo-specific -
# they resolve REPO_ROOT from their own location and only ever rebuild THIS repo's
# beats index - and are wired PROJECT-scoped in the repo's checked-in
# .claude/settings.json via $CLAUDE_PROJECT_DIR, a version-controlled ownership
# surface distinct from this global installer. Globalizing them would fire an
# improv-only hook on every project. Ruled keep-project-scoped (Jonah 2026-07-15;
# decision_beats_hooks_stay_project_scoped.md).
picked cmux         && install_app_hooks agent-teams-guard.sh node-shim-heal.sh
picked voice-output && install_app_hooks voice-gate.sh
picked justify      && install_app_hooks justify-source-guard.sh justify-watch-guard.sh justify-watch-standing-by.sh
picked clickup      && install_app_hooks block-clickup-writes.sh
picked visualizer   && install_app_hooks visualizer-guard.sh
picked codex        && install_app_hooks codex-failure-watcher.sh codex-rescue-guard.sh
# codex-review.py is the reliable real-Codex cross-model review tool (not a wired
# hook - a CLI invoked on demand). Deploy it with the codex component so a fresh
# install has it. It self-resolves a node>=16, so it works even when the shell's
# ambient node is too old for codex (reference_codex_broken_node12_path.md).
picked codex        && link_or_copy "$REPO_DIR/claude/hooks/codex-review.py" "$CLAUDE_DIR/hooks/codex-review.py"
picked chrome       && install_app_hooks chrome-tabgroup-track.sh chrome-tabgroup-clear.sh chrome-tabgroup-stop.sh
picked figma        && install_app_hooks figma-fidelity-stop.sh

# ============================================================
# 17. tilt-lab (visual-effects playground dev app)
# ============================================================
# tilt-lab is a runnable Vite app, not a dotfile. "Install" = ensure deps are
# present and drop a `tilt-lab` launcher on PATH (~/.local/bin). The server is
# NOT auto-started; the user runs `tilt-lab` (or `cd tilt-lab && npm run dev`)
# when they want it. Dev server serves at http://localhost:5180.

if picked tilt-lab; then
  echo ""
  info "--- tilt-lab (visual-effects playground) ---"

  if command -v npm >/dev/null 2>&1; then
    if [ ! -d "$REPO_DIR/tilt-lab/node_modules" ]; then
      info "Installing tilt-lab dependencies (npm install)..."
      (cd "$REPO_DIR/tilt-lab" && npm install --silent) \
        && ok "tilt-lab dependencies installed" \
        || warn "npm install failed (non-fatal). Run manually: cd tilt-lab && npm install"
    else
      ok "tilt-lab dependencies already installed"
    fi
  else
    warn "npm not found - install Node, then run 'cd tilt-lab && npm install'."
  fi

  # Launcher symlink on PATH (mirrors the sidecoach CLI idiom).
  chmod +x "$REPO_DIR/bin/tilt-lab-launcher.sh"
  mkdir -p "$HOME/.local/bin"
  make_symlink "$REPO_DIR/bin/tilt-lab-launcher.sh" "$HOME/.local/bin/tilt-lab"
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) : ;;
    *) warn "~/.local/bin is not on PATH - add it to use the \`tilt-lab\` command" ;;
  esac

  info "Run 'tilt-lab' (or 'cd tilt-lab && npm run dev') to start the playground at http://localhost:5180"
fi

# ============================================================
# Summary
# ============================================================
# Suppress when invoked recursively from the returning-flow action loop -
# the parent flow shows its own brief result and returns to the menu.
# Wrap only the visual summary; the state-file write at the very end
# still runs in either case so the parent loop sees fresh state.
if [ -z "${_AMPERSAND_NO_SUMMARY:-}" ]; then

echo ""
echo "============================================"
printf "${GREEN}Installation complete.${NC}\n"
echo "============================================"
echo ""

if [ "$BACKED_UP" -eq 1 ]; then
  warn "Backups saved to: $BACKUP_DIR"
  echo ""
fi

echo "What was installed:"
picked brain      && echo "  - Brain: team rules + workflow appended to CLAUDE.md (marker-guarded, additive)"
picked config     && echo "  - Config: core settings (permissions, plugins, statusline) merged into settings.json (additive; QA-hook clusters and app hooks install as their own components, not config)"
picked memory     && echo "  - Memory subsystem: startup-check.sh + Memory Discipline section appended to CLAUDE.md + its memory hooks merged into settings.json (additive, marker-guarded)"
picked skills     && echo "  - Anthropic Skills: tactical-polish (tactical UI polish; auto-triggers on UI work)"
picked statusline && echo "  - Custom statusline: statusline-command.sh symlinked (Claude Code falls back to default if unticked)"
picked clickup    && echo "  - ClickUp guard: block-clickup-writes hook wired into settings.json"
picked visualizer && echo "  - Visualizer guard: visualizer-guard hook wired into settings.json"
picked codex      && echo "  - Codex guards: codex-failure-watcher + codex-rescue-guard hooks wired into settings.json"
picked chrome     && echo "  - Chrome tab-group hygiene: chrome-tabgroup track/clear/stop hooks wired into settings.json"
picked figma      && echo "  - Figma fidelity guard: figma-fidelity-stop hook wired into settings.json"
picked fable      && echo "  - Fable orchestrator guard: fable-orchestrator-guard hook wired into settings.json"
picked justify    && echo "  - Justify: server + core + /justify skill + MCP registration + source/watch/standing-by hooks"
picked ghostty  && echo "  - Ghostty: config.ghostty (copied from repo - re-run install.sh to sync edits)"
picked shaders  && echo "  - Ghostty shaders: in-repo chain at $REPO_DIR/shaders, plus library at ~/Documents/Github/ghostty-shaders"
picked cmux     && echo "  - cmux: settings.json"
picked discord  && echo "  - .zshrc: smart discord-chat-launcher (cold/mid/warm prompt at 'claude' launch). Onboarding walkthrough at ~/.claude/discord-onboard.sh."
picked nvm      && echo "  - .zshrc: nvm default auto-activation"
picked ampersand && echo "  - .zshrc: 'ampersand' shortcut (type 'ampersand' to re-run installer; 'ampersand --pull' to sync first)"
picked voice-input && echo "  - Voice input: whisper-cpp + ffmpeg + ggml-base.en model + ~/.claude/transcribe symlink (run '~/.claude/transcribe path/to/audio.ogg')"
picked voice-output && echo "  - Voice output: OpenAI TTS MCP server + ~/.claude/tts-generate (run '~/.claude/tts-generate \"text\" [out.ogg]')"
picked reflect     && echo "  - Reflect: memory corpus analysis skill + reflect-nudge SessionStart hook"
picked task-list   && echo "  - Task list: /task-list slash command + TASKS.md at dotfiles root"
picked tilt-lab    && echo "  - tilt-lab: deps installed + 'tilt-lab' launcher on ~/.local/bin (run 'tilt-lab' -> http://localhost:5180)"
echo ""
# Resolve which post-install guidance is actually relevant based on picks.
NEED_CC=0; NEED_PLUGINS=0; NEED_FONT=0
NEED_GHOSTTY_RESTART=0; NEED_CMUX_RESTART=0; NEED_SHELL_RELOAD=0
picked config    && { NEED_CC=1; NEED_PLUGINS=1; }
picked memory    && NEED_CC=1
picked skills    && NEED_CC=1
picked ghostty   && { NEED_FONT=1; NEED_GHOSTTY_RESTART=1; }
picked cmux      && NEED_CMUX_RESTART=1
picked discord   && NEED_SHELL_RELOAD=1
picked nvm       && NEED_SHELL_RELOAD=1
# Suppress the generic "source .zshrc" bullet when the prominent shortcut box
# is firing - that box covers the same instruction more visibly.
[ "$SHORTCUTS_NEW" -eq 0 ] && picked ampersand && NEED_SHELL_RELOAD=1

# Render Manual Steps only if at least one bullet would fire.
TOTAL_STEPS=$((NEED_CC + NEED_PLUGINS + NEED_FONT + NEED_GHOSTTY_RESTART + NEED_CMUX_RESTART + NEED_SHELL_RELOAD))
if [ "$TOTAL_STEPS" -gt 0 ]; then
  echo "Manual steps remaining:"
  STEP=0
  if [ "$NEED_CC" -eq 1 ]; then
    STEP=$((STEP+1))
    echo "  $STEP. Install Claude Code if not already present:"
    echo "      npm install -g @anthropic-ai/claude-code"
  fi
  if [ "$NEED_PLUGINS" -eq 1 ]; then
    STEP=$((STEP+1))
    echo "  $STEP. Open Claude Code once - your enabled plugins ( Figma,"
    echo "      Sentry, Supabase, Discord, hookify, superpowers, etc.) auto-install"
    echo "      from settings.json on first launch. Run 'claude /plugins' to confirm."
  fi
  if [ "$NEED_FONT" -eq 1 ]; then
    STEP=$((STEP+1))
    echo "  $STEP. Install the PolySans Neutral Mono font family (used by Ghostty config)."
  fi
  if [ "$NEED_GHOSTTY_RESTART" -eq 1 ] && [ "$NEED_CMUX_RESTART" -eq 1 ]; then
    STEP=$((STEP+1))
    echo "  $STEP. Restart Ghostty and cmux to pick up config changes."
  elif [ "$NEED_GHOSTTY_RESTART" -eq 1 ]; then
    STEP=$((STEP+1))
    echo "  $STEP. Restart Ghostty to pick up config changes."
  elif [ "$NEED_CMUX_RESTART" -eq 1 ]; then
    STEP=$((STEP+1))
    echo "  $STEP. Restart cmux to pick up config changes."
  fi
  if [ "$NEED_SHELL_RELOAD" -eq 1 ]; then
    STEP=$((STEP+1))
    echo "  $STEP. Open a new shell or 'source ~/.zshrc' to activate the .zshrc additions."
  fi
  echo ""
fi

# Connectors and MCP servers - only relevant if Claude Code is in play.
if [ "$NEED_CC" -eq 1 ]; then
  echo "Connectors and MCP servers (NOT installed by this script - per-account):"
  echo "  - ClickUp: a Claude.ai connector. Sign in at claude.ai, go to"
  echo "    Settings -> Connectors, and authorize ClickUp once. It then works"
  echo "    in every Claude session signed in to that account."
  echo "  - Claude in Chrome: a Chrome extension. Install from the Chrome Web"
  echo "    Store, sign in to Claude, and it bridges to Claude Code automatically."
  echo "  These aren't portable through dotfiles because they need OAuth and"
  echo "  per-browser setup. Set them up once per machine."
  echo ""
fi

# Sidecoach workflow - only relevant when our settings.json (with the
# sidecoach skill enabled) is active, i.e., config was picked.
if picked config; then
  echo "Design workflow (Sidecoach):"
  echo "  - The sidecoach skill is enabled in settings.json (autoUpdate on)."
  echo "  - CLAUDE.md routes all design and UI-QA work through /sidecoach."
  echo "  - In each new project, run '/sidecoach teach' once to seed PRODUCT.md"
  echo "    and optionally DESIGN.md at the project root. Every /sidecoach command"
  echo "    reads those files, so skipping this step produces generic output."
  echo "  - Run '/sidecoach' with no argument to see the full 23-command menu."
  echo ""
fi

# ============================================================
# Final callout: shortcut-block was newly written this run
# ============================================================
# zsh only reads .zshrc at shell startup, so a function appended during
# install.sh isn't live in the parent shell yet. Print a prominent box
# so a new user knows to source.zshrc once before typing `ampersand`.

if [ "$SHORTCUTS_NEW" -eq 1 ]; then
  echo ""
  if command -v gum >/dev/null 2>&1; then
    gum style --border double --margin "1 0" --padding "1 2" --border-foreground "#0e7490" \
      "ONE MORE STEP" \
      "" \
      "The 'ampersand' shortcut was just added to ~/.zshrc," \
      "but your current shell hasn't loaded it yet." \
      "" \
      "Run this now to use it in this terminal:" \
      "    source ~/.zshrc" \
      "" \
      "Or open a new terminal window. After that, type 'ampersand' from" \
      "anywhere to re-launch the installer."
  else
    ACCENT_COLOR='\033[38;2;14;116;144m'
    NC='\033[0m'
    printf "${ACCENT_COLOR}╔══════════════════════════════════════════════════════════════════╗${NC}\n"
    printf "${ACCENT_COLOR}║${NC}  ONE MORE STEP                                                   ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}                                                                  ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}  'ampersand' was just added to ~/.zshrc, but your current        ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}  shell hasn't loaded it yet.                                     ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}                                                                  ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}  Run this now to use it in this terminal:                        ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}      source ~/.zshrc                                             ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}                                                                  ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}  Or open a new terminal window. After that, 'ampersand'          ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}║${NC}  works from any directory.                                       ${ACCENT_COLOR}║${NC}\n"
    printf "${ACCENT_COLOR}╚══════════════════════════════════════════════════════════════════╝${NC}\n"
  fi
  echo ""
fi

fi  # end if [ -z "$_AMPERSAND_NO_SUMMARY" ]

# ============================================================
# Final: update state file with what's now active.
# ============================================================
# Persist per-component status so future runs know it's a returning user
# and can show accurate active/inactive/not-installed states.

state_init_if_missing
for k in "${KEYS[@]}"; do
  s=$(detect_component "$k")
  state_set "$k" "$s"
done
state_record_sha
