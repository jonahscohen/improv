#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Improv bootstrap
# Tiny entrypoint for `curl -fsSL <url>/bootstrap.sh | bash`.
#
# DEFAULT BEHAVIOR (no args): clones the repo, installs ONLY the 'ampersand'
# shell shortcut, prints "Unpacking installer...complete. Type 'ampersand'
# to begin." then exec's a fresh login zsh (via `exec $SHELL -l </dev/tty`)
# so the new function is immediately available. The user keeps typing in
# what looks like the same terminal and 'ampersand' just works.
#
# WITH ARGS: passes them through to install.sh after the shortcut install
# (no shell reload - the installer's own TUI handles the session).
#   curl -fsSL .../bootstrap.sh | bash -s -- --yes
#   curl -fsSL .../bootstrap.sh | bash -s -- --preset minimal
#
# Choose where the repo lives on this machine (3 options, any one works):
#   1. Set env var:  IMPROV_DIR=~/code/dots curl ... | bash
#   2. Pass --dir:   curl ... | bash -s -- --dir ~/code/dots
#   3. Default:      ~/Documents/Github/improv
#
# Skip the auto-reload with --no-reload (useful in tmux/screen or for
# anyone who'd rather source .zshrc themselves):
#   curl -fsSL .../bootstrap.sh | bash -s -- --no-reload
# ============================================================

REPO_URL="${IMPROV_REPO:-https://github.com/jonahscohen/improv.git}"
REPO_DIR="${IMPROV_DIR:-$HOME/Documents/Github/improv}"

print_help() {
  cat <<'HELP'
Improv bootstrap

Default flow (no args):
  Clones the repo, installs the 'ampersand' shell shortcut, and reloads
  your zsh so 'ampersand' is immediately live. Then exits.

Args (passed through to install.sh after the shortcut is installed):
  --yes                  full non-interactive install of every component
  --preset NAME          all | minimal | none
  --only KEYS            comma-separated component keys
  --dry-run              preview without writing

Bootstrap-specific flags:
  --dir PATH             clone repo to PATH instead of the default
  --no-reload            skip the post-install zsh reload (useful in tmux/screen)
  --help, -h             show this help and exit (no side effects)

Environment overrides:
  IMPROV_REPO   git URL to clone (default: jonahscohen/improv)
  IMPROV_DIR    target path (default: ~/Documents/Github/improv)

Examples:
  curl -fsSL .../bootstrap.sh | bash
  curl -fsSL .../bootstrap.sh | bash -s -- --yes
  curl -fsSL .../bootstrap.sh | bash -s -- --preset minimal
  curl -fsSL .../bootstrap.sh | bash -s -- --dir ~/code/dots
HELP
}

# Peel off bootstrap-specific flags (--dir, --no-reload, --help);
# leave everything else for install.sh.
NO_RELOAD=0
HAS_INSTALLER_ARGS=0
INSTALLER_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      print_help
      exit 0
      ;;
    --dir)
      REPO_DIR="$2"
      shift 2
      ;;
    --dir=*)
      REPO_DIR="${1#--dir=}"
      shift
      ;;
    --no-reload)
      NO_RELOAD=1
      shift
      ;;
    *)
      INSTALLER_ARGS+=("$1")
      HAS_INSTALLER_ARGS=1
      shift
      ;;
  esac
done
# Expand leading ~ if user passed --dir ~/code/dots literally
case "$REPO_DIR" in
  "~"|"~/"*) REPO_DIR="${HOME}${REPO_DIR#\~}" ;;
esac

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
PURPLE='\033[38;2;124;58;237m'
NC='\033[0m'

info() { printf "${CYAN}[bootstrap]${NC} %s\n" "$1"; }
ok()   { printf "${GREEN}[bootstrap]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[bootstrap]${NC} %s\n" "$1"; }
err()  { printf "${RED}[bootstrap]${NC} %s\n" "$1"; }

if [[ "$(uname)" != "Darwin" ]]; then
  err "Improv is macOS-only."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  err "git is required but not installed. Install Xcode Command Line Tools first:"
  err "  xcode-select --install"
  exit 1
fi

# ============================================================
# Step 1: Clone or pull the repo
# ============================================================

if [ -d "$REPO_DIR/.git" ]; then
  ok "$REPO_DIR exists - pulling latest"
  git -C "$REPO_DIR" pull --ff-only 2>/dev/null \
    || warn "Pull failed (local changes?). Continuing with current checkout."
elif [ -d "$REPO_DIR" ]; then
  err "$REPO_DIR exists but is not a git repo. Move or remove it and re-run."
  exit 1
else
  info "Cloning $REPO_URL into $REPO_DIR"
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
chmod +x install.sh 2>/dev/null || true

# ============================================================
# Step 2: Always install the 'ampersand' shortcut (silent + fast)
# ============================================================

printf "Unpacking installer..."
if bash install.sh --only ampersand --yes >/dev/null 2>&1; then
  printf "complete.\n"
else
  printf "failed.\n"
  err "Could not install the ampersand shortcut. Run this for diagnostics:"
  err "  cd $REPO_DIR && bash install.sh --only ampersand --yes"
  exit 1
fi

# ============================================================
# Step 3: Either run the full installer (if args were passed)
# or print the welcome and exit (if no args)
# ============================================================

if [ "$HAS_INSTALLER_ARGS" -eq 1 ]; then
  # User passed installer flags through curl|bash. Re-exec with the args
  # and a TTY restored so the TUI works through the pipe if needed.
  if [ -t 0 ] && [ -t 1 ]; then
    exec bash install.sh "${INSTALLER_ARGS[@]+"${INSTALLER_ARGS[@]}"}"
  elif [ -r /dev/tty ]; then
    exec bash install.sh "${INSTALLER_ARGS[@]+"${INSTALLER_ARGS[@]}"}" </dev/tty
  else
    exec bash install.sh --yes "${INSTALLER_ARGS[@]+"${INSTALLER_ARGS[@]}"}"
  fi
else
  # No args - just installed the shortcut. Try to reload the shell so
  # 'ampersand' is immediately available; fall back to telling the user to
  # do it themselves if any precondition isn't met.
  #
  # Reload conditions (all must hold):
  #   1. User didn't pass --no-reload
  #   2. Not in CI ($CI unset/empty)
  #   3. $SHELL is set and ends in /zsh (we only write to .zshrc)
  #   4. /dev/tty is readable (we have a controlling terminal)
  shell_is_zsh=0
  case "${SHELL:-}" in
    */zsh) shell_is_zsh=1 ;;
  esac

  printf "\n"
  printf "${PURPLE}Type 'ampersand' to begin.${NC}\n"

  if [ "$NO_RELOAD" -eq 0 ] && [ -z "${CI:-}" ] && [ "$shell_is_zsh" -eq 1 ] && [ -r /dev/tty ]; then
    printf "  Reloading your shell so 'ampersand' is live...\n\n"
    exec "$SHELL" -l </dev/tty
  else
    printf "  (Open a new terminal first, or run 'source ~/.zshrc' in this one.)\n\n"
  fi
fi
