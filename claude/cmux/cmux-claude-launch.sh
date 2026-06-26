#!/usr/bin/env zsh
# cmux Claude launch wrapper.
#
# WHY: cmux app-spawned agent sessions exec the claude binary DIRECTLY (no
# login/interactive shell), so ~/.zshrc never sources and the claude() wrapper
# that hosts the Teams / Remote-Control / Discord startup prompts never runs.
# Pointing cmux's automation.claudeBinaryPath at THIS script restores those
# prompts for app-launched sessions: it sources the SAME two launcher files
# ~/.zshrc uses (single source of truth - no duplicated prompt logic) and
# invokes their claude() function, which then runs the real claude.
#
# See .claude/memory/session_2026-06-24_cmux-app-launch-bypasses-zsh-claude-wrapper.md
#
# INSTALL: in ~/.config/cmux/cmux.json (the primary config; `settings.json` is legacy):
#   "automation" : { "claudeBinaryPath" : "/Users/<you>/.claude/cmux/cmux-claude-launch.sh" }
# then `cmux reload-config`. Validate with `cmux config doctor`.

# a cmux-owned dir whose `claude` would re-enter this wrapper (must never be the target)
_ccl_is_cmux_dir() { [[ "$1" == *cmux-cli-shims* || "$1" == *cmux.app* || "$1" == *.cmuxterm* ]]; }

# --- resolve the REAL claude (absolute, non-cmux) ---
_ccl_real_claude=""
for _d in ${(s.:.)PATH}; do
  _ccl_is_cmux_dir "$_d" && continue
  [[ -x "$_d/claude" ]] || continue
  _ccl_real_claude="$_d/claude"; break
done
if [[ -z "$_ccl_real_claude" ]]; then
  for _c in "${CMUX_AGENT_LAUNCH_EXECUTABLE:-}" $HOME/.nvm/versions/node/*/bin/claude(N) /opt/homebrew/bin/claude /usr/local/bin/claude; do
    [[ -n "$_c" && "$_c" == /* && -x "$_c" ]] || continue
    _ccl_is_cmux_dir "${_c:h}" && continue
    _ccl_real_claude="$_c"; break
  done
fi
# Fail hard rather than fall back to a bare name: a bare `claude` would resolve
# via PATH and could re-enter the cmux shim, risking an exec loop.
if [[ "$_ccl_real_claude" != /* ]]; then
  print -u2 "cmux-claude-launch: FATAL - no real (non-cmux) claude binary on PATH; refusing to run."
  exit 127
fi

_ccl_passthrough() { exec "$_ccl_real_claude" "$@"; }

# --- exec straight through (no prompts) when prompting is wrong ---
#   * re-entered (e.g. via `cmux claude-teams`, which re-launches through here)
#   * already in a teams session (env flag set by `cmux claude-teams`)
#   * a teams/teammate launch (space OR =value flag forms)
#   * a headless / probe invocation (-p/--print/--version/--help)
#   * not an interactive TTY
[[ -n "${_CMUX_CLAUDE_WRAP_ACTIVE:-}" ]] && _ccl_passthrough "$@"
[[ -n "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" ]] && _ccl_passthrough "$@"
for _a in "$@"; do
  case "$_a" in
    --teammate-mode|--teammate-mode=*|--agent-id|--agent-id=*|--agent-name|--agent-name=*|\
    --team-name|--team-name=*|--parent-session-id|--parent-session-id=*|--agent-type|--agent-type=*) \
      _ccl_passthrough "$@" ;;
    -p|--print|--version|--help|-h) _ccl_passthrough "$@" ;;
  esac
done
# TTY gate (override with _CCL_ASSUME_TTY=1 for hermetic tests only).
if [[ -z "${_CCL_ASSUME_TTY:-}" ]]; then
  { [[ -t 0 ]] && [[ -t 1 ]]; } || _ccl_passthrough "$@"
fi

export _CMUX_CLAUDE_WRAP_ACTIVE=1

# --- sanitize PATH so the launchers' `command claude` hits the REAL claude,
#     not the cmux PATH shim (which would re-enter this wrapper). Strip ONLY the
#     cmux-cli-shims dir; keep cmux.app/bin so `cmux claude-teams` still resolves. ---
_ccl_path=""
for _d in ${(s.:.)PATH}; do
  [[ "$_d" == *cmux-cli-shims* ]] && continue
  _ccl_path="${_ccl_path:+$_ccl_path:}$_d"
done
export PATH="${_ccl_real_claude:h}:$_ccl_path"

# --- reuse the EXACT tested prompt logic from the zsh launchers ---
# NOTE: the launchers run claude as a CHILD (not exec), so this wrapper remains a
# thin parent for the session. Accepted tradeoff for not duplicating prompt logic;
# the foreground claude owns the pty, so SIGWINCH/SIGINT still reach it directly.
[[ -f "$HOME/.claude/discord-chat-launcher.sh" ]] && source "$HOME/.claude/discord-chat-launcher.sh"
[[ -f "$HOME/.claude/claude-teams-launcher.sh" ]] && source "$HOME/.claude/claude-teams-launcher.sh"

if typeset -f claude >/dev/null 2>&1; then
  claude "$@"
  exit $?
fi
_ccl_passthrough "$@"
