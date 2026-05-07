#!/usr/bin/env zsh
# Claude Code Teams launcher wrapper for cmux.
#
# Sourced from ~/.zshrc by the dotfiles installer. Wraps the `claude` command
# (after the Discord launcher, if present) to optionally launch via
# `cmux claude-teams` instead of plain `claude` when running inside cmux.
#
# Two states:
#   INSIDE CMUX  - Prompt to enable Teams mode, or skip.
#   OUTSIDE CMUX - Fall through silently, no prompt.
#
# Opt-out: create ~/.claude/.skip-teams-launcher to never be asked.
# Opt-in default: create ~/.claude/.teams-default-on to auto-enable without prompting.
#
# Source this in .zshrc:  source ~/.claude/claude-teams-launcher.sh

TEAMS_SKIP_FILE="$HOME/.claude/.skip-teams-launcher"
TEAMS_DEFAULT_ON="$HOME/.claude/.teams-default-on"

function _claude_inside_cmux() {
  [ -n "$CMUX_WORKSPACE_ID" ] || [ -n "$CMUX_PANE_ID" ]
}

function _claude_has_cmux_binary() {
  command -v cmux >/dev/null 2>&1
}

function _claude_teams_wrap() {
  if typeset -f claude >/dev/null 2>&1; then
    functions[_claude_teams_prev]=$functions[claude]
  fi

  function _claude_teams_passthrough() {
    if typeset -f _claude_teams_prev >/dev/null 2>&1; then
      _claude_teams_prev "$@"
    else
      command claude "$@"
    fi
  }

  function claude() {
    if [ -f "$TEAMS_SKIP_FILE" ]; then
      _claude_teams_passthrough "$@"
      return $?
    fi

    if ! _claude_inside_cmux || ! _claude_has_cmux_binary; then
      _claude_teams_passthrough "$@"
      return $?
    fi

    if [ -f "$TEAMS_DEFAULT_ON" ]; then
      cmux claude-teams "$@"
      return $?
    fi

    local choice
    printf "Enable Claude Code Teams? (teammate agents appear as cmux splits)\n"
    printf "  [y] Yes, launch with Teams\n"
    printf "  [n] No, standard session\n"
    printf "  [a] Always enable (don't ask again)\n"
    printf "  [x] Never ask on this machine\n"
    printf "Choice [y/n/a/x] (default n): "
    read choice
    choice="${choice:-n}"
    case "$choice" in
      [Yy]*)
        cmux claude-teams "$@"
        ;;
      [Aa]*)
        : > "$TEAMS_DEFAULT_ON"
        printf "Teams mode will auto-enable. Delete %s to reset.\n" "$TEAMS_DEFAULT_ON"
        cmux claude-teams "$@"
        ;;
      [Xx]*)
        mkdir -p "$(dirname "$TEAMS_SKIP_FILE")"
        : > "$TEAMS_SKIP_FILE"
        printf "Got it. Created %s - this prompt won't appear again.\n" "$TEAMS_SKIP_FILE"
        printf "(Delete that file to re-enable.)\n"
        _claude_teams_passthrough "$@"
        ;;
      *)
        _claude_teams_passthrough "$@"
        ;;
    esac
  }
}

if _claude_has_cmux_binary; then
  _claude_teams_wrap
fi
