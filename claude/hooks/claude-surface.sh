#!/usr/bin/env bash
# claude-surface.sh - Claude Code SURFACE detection + presentation directives.
#
# Detects which surface the session runs in (CLAUDE_CODE_ENTRYPOINT + CMUX_* vars; full value
# map in .claude/memory/reference_claude_code_surface_detection.md) and tells the assistant how
# to PRESENT data: rich visual/interactive artifacts where the surface renders them (desktop /
# web / Cowork / vscode), clean text/ASCII where it cannot (terminal / cmux / mobile / sdk).
#
# Modes (arg $1):
#   session  (SessionStart)      - the full directive, once per session.
#   turn     (UserPromptSubmit)  - a short reminder EVERY prompt, on RICH surfaces only, so the
#                                  directive never fades over a long conversation. Silent on text.
#
#   entrypoint -> surface          rich?
#   claude-desktop -> desktop      yes
#   remote_mobile  -> mobile       NO (custom visuals unsupported on iOS/Android - Anthropic doc)
#   remote* / claude-in-teams -> web (Cowork)  yes
#   claude-vscode  -> vscode       yes
#   sdk-* / mcp    -> programmatic  no
#   cli + CMUX_*   -> cmux         no
#   cli (no cmux)  -> terminal     no

mode="${1:-session}"
ep="${CLAUDE_CODE_ENTRYPOINT:-cli}"
rich=0
case "$ep" in
  claude-desktop)          surface="desktop"; rich=1 ;;
  remote_mobile)           surface="mobile" ;;
  remote*|claude-in-teams) surface="web"; rich=1 ;;
  claude-vscode)           surface="vscode"; rich=1 ;;
  sdk-*|mcp)               surface="$ep" ;;
  *)
    if [ -n "${CMUX_BUNDLE_ID:-}" ]; then surface="cmux"; else surface="terminal"; fi
    ;;
esac

emit() { # $1 = hookEventName, $2 = additionalContext
  EVT="$1" CTX="$2" python3 -c "import json, os; print(json.dumps({'hookSpecificOutput': {'hookEventName': os.environ['EVT'], 'additionalContext': os.environ['CTX']}}))"
}

if [ "$mode" = "turn" ]; then
  # Per-prompt salience - rich surfaces only; stay silent everywhere else so text sessions are quiet.
  if [ "$rich" = "1" ]; then
    emit "UserPromptSubmit" "Surface=${surface} (RICH). If this turn presents REPORTING, DATA, CHARTS, TABLES, or GRAPHS, render it as a VISUAL artifact (an HTML/SVG/React chart, table widget, or dashboard) - not a wall of text. Plain text/markdown is the fallback only when a visual genuinely does not fit."
  fi
  exit 0
fi

# session mode (default): the full directive, once.
if [ "$rich" = "1" ]; then
  ctx="Claude Code SURFACE: ${surface} (RICH - this surface renders visual / interactive content). When you present REPORTING, DATA, CHARTS, TABLES, or GRAPHS, prefer Claude's visualizer or a self-contained visual/interactive artifact (an HTML/SVG chart, table, dashboard - be creative where it earns its keep) over a wall of text. Plain text/ASCII is the FALLBACK here, not the default. (If a given visual does not render, fall back to clean markdown/text.)"
else
  ctx="Claude Code SURFACE: ${surface} (TEXT-ONLY - no rich rendering). Present reporting/data as clean text, markdown, or ASCII (for example the sidecoach panel). Do NOT build visual/interactive artifacts to display them - they will not render here."
fi
emit "SessionStart" "$ctx"
exit 0
