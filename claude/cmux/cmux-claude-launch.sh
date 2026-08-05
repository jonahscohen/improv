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

# --- NODE_OPTIONS durability (2026-07-13) -------------------------------------------
# cmux points NODE_OPTIONS' --require preload at $TMPDIR/cmux-claude-node-options/, and
# $TMPDIR on macOS is a PURGEABLE dir. Once the OS reaps it, EVERY node process in the
# session (node-based hooks, npx, npm) dies at startup with MODULE_NOT_FOUND - and a
# running session's env cannot be edited, so it stays broken. Repoint the preload at the
# durable canonical copy BEFORE claude is exec'd, so new sessions never carry a purgeable
# path at all. The canonical file is byte-identical and strips itself from NODE_OPTIONS by
# BASENAME, so cmux's own semantics are preserved exactly; all other flags are kept.
#
# This must stay ABOVE every _ccl_passthrough branch below - passthrough exec's claude
# directly, and would otherwise skip the repair. It is deliberately fail-safe: if
# NODE_OPTIONS is absent, already durable, or the canonical copy is missing, it no-ops.
# The ~/.claude/cmux/node PATH shim is the backstop that covers sessions already running
# and any cmux release that stops routing launches through this wrapper.

# --- Preferred subagent model (2026-08-05, Jonah) --------------------------------
# Without this, a spawned teammate/subagent defaults to the NEWEST Opus
# (claude-opus-5, a frontier model). That breaks the frontier-orchestrator scheme:
# a frontier session cannot delegate production to a preferred producer because the
# producer also lands on opus-5, so frontier-orchestrator-guard blocks it and the
# session death-loops. CLAUDE_CODE_SUBAGENT_MODEL routes ALL subagents to a chosen
# model unless a per-agent def/alias overrides. Pin it to the preferred Opus so a
# bare Agent() spawn is claude-opus-4-8. Read at session START, so a running session
# must be RESTARTED for this to take effect (exported ABOVE every exec path below).
: "${CLAUDE_CODE_SUBAGENT_MODEL:=claude-opus-4-8}"
export CLAUDE_CODE_SUBAGENT_MODEL

if [[ -n "${NODE_OPTIONS:-}" && "$NODE_OPTIONS" == *restore-node-options.cjs* ]]; then
  _ccl_canon="$HOME/.claude/node-shims/restore-node-options.cjs"
  # NODE_OPTIONS is whitespace-separated, so a canonical path containing a space (a $HOME
  # like /Users/Ada Lovelace) cannot be expressed in it - node would parse the halves as
  # separate flags and refuse to start. In that case leave NODE_OPTIONS exactly as cmux
  # set it: the ~/.claude/cmux/node PATH shim still repairs it at runtime.
  if [[ -r "$_ccl_canon" && "$_ccl_canon" != *[[:space:]]* ]]; then
    _ccl_no=()
    for _t in ${(s: :)NODE_OPTIONS}; do
      case "$_t" in
        --require=*restore-node-options.cjs) _t="--require=$_ccl_canon" ;;
        -r=*restore-node-options.cjs)        _t="-r=$_ccl_canon" ;;
        *restore-node-options.cjs)           _t="$_ccl_canon" ;;  # `--require <path>` form
      esac
      _ccl_no+=("$_t")
    done
    export NODE_OPTIONS="${_ccl_no[*]}"
    unset _ccl_no _t
  fi
  unset _ccl_canon
fi

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
