#!/bin/bash
# PreToolUse hook for mcp__visualize__show_widget
# Blocks widget_code that will render broken or inaccessible.
#
# WHY THIS EXISTS (2026-06-30, Jonah): a widget shipped with guessed token
# names (--text-100, --bg-200, --accent-main-100) carrying hardcoded hex
# fallbacks (var(--text-200, #333)). Those tokens don't exist in the
# visualizer, so the fallback hex won - a light-mode dark-gray on a dark-mode
# dark surface = invisible text. An a11y failure that rendered fine in light
# mode and disappeared in dark. The CDATA wrapper also leaked a literal ]]>
# into the output. This hook makes those failure modes un-shippable.
#
# Canonical token contract (the only color/text/surface tokens that exist):
#   text:    --text-primary --text-secondary --text-muted
#            --text-accent --text-danger --text-success --text-warning
#   surface: --surface-0 --surface-1 --surface-2
#   tint bg: --bg-accent --bg-danger --bg-success --bg-warning
#   border:  --border --border-strong --border-stronger
#            --border-accent --border-danger --border-success --border-warning
#   type:    --font-sans --font-voice --font-mono
#   layout:  --radius --pad-{sm,md,lg,xl} --gap-{xs,sm,md,lg,xl}
#   SVG:     --p --s --t --bg2 --b
# All --* auto-adapt to light/dark. A hardcoded color fallback defeats that.
# Tinted panels MUST pair bg + text from the same role: e.g.
#   background: var(--bg-danger); color: var(--text-danger);
# Full reference: .claude/memory/reference_visualizer_token_contract.md

INPUT=$(cat)
CODE=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    inp = data.get("tool_input", {})
    print(inp.get("widget_code", "") or "")
except Exception:
    print("")
' 2>/dev/null)

[ -z "$CODE" ] && echo '{}' && exit 0

# Flatten newlines/tabs/CR to spaces. grep -E matches line by line, so a
# var(--x, #hex) (or any pattern) split across lines inside a <style> block
# would otherwise slip past. All patterns below use \s*, so collapsing
# whitespace is safe and closes that multi-line false-negative gap.
CODE=$(printf '%s' "$CODE" | tr '\n\r\t' '   ')

REASON=""
REMEDY=""

# 1. CDATA wrapper - leaks a literal ]]> into the rendered output. The tool
#    auto-detects SVG vs HTML from the leading character; CDATA is never needed.
if [ -z "$REASON" ] && printf '%s' "$CODE" | grep -qE '<!\[CDATA\[|\]\]>'; then
  REASON="widget_code contains a CDATA wrapper (<![CDATA[ ... ]]>). The visualizer does not strip it, so the literal ]]> leaks into the render."
  REMEDY="Pass the raw SVG/HTML directly with no CDATA wrapper."
fi

# 2. Hardcoded color fallback inside var() - THE a11y bug. var(--token, #hex)
#    or var(--token, rgb/hsl(...)). When the token doesn't resolve the
#    hardcoded fallback wins, and a light-mode color on a dark surface is
#    invisible. A var()-as-fallback (var(--a, var(--b))) is fine and not caught.
if [ -z "$REASON" ] && printf '%s' "$CODE" | grep -qiE 'var\(\s*--[a-zA-Z0-9_-]+\s*,\s*(#[0-9a-f]|rgba?\(|hsla?\()'; then
  REASON="widget_code uses a hardcoded color fallback inside var() (e.g. var(--text-200, #333)). The canonical tokens auto-adapt to dark mode; a hardcoded fallback defeats that and produces invisible text when the token name is wrong or missing. This is the exact a11y failure this hook exists to stop."
  REMEDY="Use a real token with NO fallback: color: var(--text-primary); background: var(--surface-2);. For a tinted panel, pair the role: background: var(--bg-danger); color: var(--text-danger);."
fi

# 3. Hallucinated numbered tokens - the visualizer uses word-suffixed tokens
#    (--text-primary, --bg-danger), NOT a numbered scale. --surface-0/1/2 are
#    the ONLY valid numbered tokens. Anything else numbered silently fails to
#    resolve. Catch --{text,bg,border,accent,danger,warning,success,fg}-<N>,
#    --surface-<N> where N>2 or multi-digit, and the --accent-main-* family.
if [ -z "$REASON" ] && printf '%s' "$CODE" | grep -qE '\-\-(text|bg|border|accent|danger|warning|success|fg)-[0-9]'; then
  REASON="widget_code references a numbered token that does not exist (e.g. --text-100, --bg-200, --danger-300). The visualizer has no numbered color scale - tokens are word-suffixed (--text-primary, --text-secondary, --bg-danger, --border-strong). Numbered tokens silently fail to resolve, which is how the invisible-text a11y bug happened."
  REMEDY="Replace with canonical tokens: --text-primary/secondary/muted, --surface-0/1/2, --bg-{accent,danger,success,warning}, --text-{accent,danger,success,warning}, --border / --border-strong."
fi
if [ -z "$REASON" ] && printf '%s' "$CODE" | grep -qE '\-\-surface-([3-9]|[0-9][0-9])'; then
  REASON="widget_code references an invalid --surface-N token. Only --surface-0, --surface-1, and --surface-2 exist."
  REMEDY="Use --surface-0 (page), --surface-1 (subtle panel), or --surface-2 (raised card)."
fi
if [ -z "$REASON" ] && printf '%s' "$CODE" | grep -qE '\-\-accent-main'; then
  REASON="widget_code references --accent-main* which does not exist in the visualizer token set."
  REMEDY="Use --text-accent / --bg-accent / --border-accent, or the SVG alias --p."
fi

# 4. font-weight 600+ or bold - the canonical spec allows only 400 and 500.
#    Headings are pre-styled to 500; body is 400. Heavier weights are a spec
#    violation and read inconsistently across the visualizer chrome.
if [ -z "$REASON" ] && printf '%s' "$CODE" | grep -qiE 'font-weight\s*:\s*(600|700|800|900|bold)|font-weight\s*=\s*["'"'"']?(600|700|800|900|bold)'; then
  REASON="widget_code uses font-weight 600/700/800/900/bold. The visualizer spec allows only 400 and 500 (headings are pre-styled to 500, body is 400)."
  REMEDY="Use font-weight: 500 for emphasis and 400 for body. Do not override heading weights at all."
fi

if [ -n "$REASON" ]; then
  MSG="BLOCKED (visualizer-guard): $REASON $REMEDY Token contract: .claude/memory/reference_visualizer_token_contract.md"
  python3 -c "import json,sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PreToolUse','permissionDecision':'deny','permissionDecisionReason':sys.argv[1]}}))" "$MSG"
else
  echo '{}'
fi
