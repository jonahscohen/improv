#!/usr/bin/env zsh
# Claude Code Teams launcher wrapper for cmux.
#
# Sourced from ~/.zshrc by the dotfiles installer. Wraps the `claude` command
# (after the Discord launcher, if present) to optionally launch via
# `cmux claude-teams` instead of plain `claude` when running inside cmux.
#
# When Teams is selected and Discord is configured, also asks about Discord
# and appends the channel flag to the cmux claude-teams command.
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

function _claude_teams_maybe_discord() {
  # If Discord launcher functions exist and bot is configured, ask about Discord.
  # Returns the channel flags to append, or empty string.
  local DISCORD_SKIP="$HOME/.claude/channels/discord/.skip-launcher"
  if [ -f "$DISCORD_SKIP" ]; then
    return
  fi
  if ! typeset -f _claude_has_discord_token >/dev/null 2>&1; then
    return
  fi
  if _claude_has_discord_token; then
    if _claude_has_discord_pair; then
      local connect
      printf "Connect to Discord Chat Agent? (y/n) "
      read connect
      connect="${connect:-Y}"
      if [[ ! "$connect" =~ ^[Nn]$ ]]; then
        typeset -f _claude_kill_stale_discord >/dev/null 2>&1 && _claude_kill_stale_discord
        _CLAUDE_TEAMS_DISCORD=1
        return
      fi
    fi
  fi
  _CLAUDE_TEAMS_DISCORD=0
}

function _claude_teams_launch() {
  _CLAUDE_TEAMS_DISCORD=0
  _claude_teams_maybe_discord
  if [ "$_CLAUDE_TEAMS_DISCORD" = "1" ]; then
    cmux claude-teams --channels plugin:discord@claude-plugins-official "$@"
  else
    cmux claude-teams "$@"
  fi
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
    # Subcommands (agents, attach, logs, stop, etc.) need the real binary
    # without --dangerously-skip-permissions (which disables the TUI).
    local _arg
    for _arg in "$@"; do
      case "$_arg" in
        -*) continue ;;
        agents|attach|logs|stop|kill|respawn|rm)
          local _real_claude="" _d _clean_args=()
          for _d in ${(s.:.)PATH}; do
            [[ -x "$_d/claude" ]] || continue
            [[ "$_d" == *cmux.app* ]] && continue
            _real_claude="$_d/claude"; break
          done
          for _arg in "$@"; do
            [[ "$_arg" == "--dangerously-skip-permissions" ]] && continue
            _clean_args+=("$_arg")
          done
          "${_real_claude:-claude}" "${_clean_args[@]}"
          return $? ;;
        *) break ;;
      esac
    done

    if [ -f "$TEAMS_SKIP_FILE" ]; then
      _claude_teams_passthrough "$@"
      return $?
    fi

    if ! _claude_inside_cmux || ! _claude_has_cmux_binary; then
      _claude_teams_passthrough "$@"
      return $?
    fi

    if [ -f "$TEAMS_DEFAULT_ON" ]; then
      _claude_teams_launch "$@"
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
        _claude_teams_launch "$@"
        ;;
      [Aa]*)
        : > "$TEAMS_DEFAULT_ON"
        printf "Teams mode will auto-enable. Delete %s to reset.\n" "$TEAMS_DEFAULT_ON"
        _claude_teams_launch "$@"
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
