#!/bin/bash
# surface-visual-gate.sh - Stop-event gate (the teeth behind "present data visually").
#
# On a RICH Claude Code surface (desktop / web / Cowork / vscode, which render HTML/SVG/React),
# if the assistant's last message presented a SUBSTANTIAL data TABLE as a wall of markdown text,
# block ONCE and ask it to re-present the data as a VISUAL artifact instead. Text-only surfaces
# (terminal / cmux / mobile / sdk) are EXEMPT - a markdown table is the right form there.
#
# Companion to claude-surface.sh (SessionStart full directive + per-turn reminder). This is the
# post-hoc safety net for the most obvious miss: a big table dumped as text where a chart would
# serve better. stop_hook_active is honored so it forces exactly ONE reconsideration, never a loop.
#
# Threshold: a markdown table with >= THRESHOLD pipe-rows (header + separator + data). A
# substantial data wall, not a small 2-3 row table. Tunable below.

THRESHOLD=8
LOG_FILE="$HOME/.claude/.surface-visual-gate.log"

STDIN_JSON=$(cat)

# Loop guard: if we already blocked this stop-cycle, let it through.
ACTIVE=$(printf '%s' "$STDIN_JSON" | python3 -c "import json,sys
try: print('1' if json.load(sys.stdin).get('stop_hook_active') else '0')
except Exception: print('0')" 2>/dev/null)
[[ "$ACTIVE" == "1" ]] && exit 0

# RICH surfaces only. Everything else (terminal, cmux, mobile, sdk) is exempt - tables are fine.
ep="${CLAUDE_CODE_ENTRYPOINT:-cli}"
case "$ep" in
  remote_mobile) exit 0 ;;                                    # mobile cannot render custom visuals
  claude-desktop|remote*|claude-in-teams|claude-vscode) : ;; # rich -> continue
  *) exit 0 ;;                                                # cli/cmux/sdk/mcp -> exempt
esac

TRANSCRIPT=$(printf '%s' "$STDIN_JSON" | python3 -c "import json,sys
try: print(json.load(sys.stdin).get('transcript_path',''))
except Exception: pass" 2>/dev/null)
[[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]] && exit 0

# Count markdown table rows in the last assistant message (excluding fenced code blocks).
ROWS=$(TRANSCRIPT_PATH="$TRANSCRIPT" python3 <<'PYEOF' 2>/dev/null
import json, os, re
last = ""
try:
    with open(os.environ["TRANSCRIPT_PATH"]) as f:
        for line in f:
            try: e = json.loads(line)
            except Exception: continue
            if e.get("type") != "assistant": continue
            content = e.get("message", {}).get("content", [])
            if not isinstance(content, list): continue
            text = "\n".join(b.get("text","") for b in content if isinstance(b, dict) and b.get("type") == "text")
            if text.strip(): last = text
except Exception:
    pass

# Strip fenced code blocks - BOTH backtick and tilde fences (Codex P2); a fence closes only
# on a matching marker. The backtick is built from its codepoint so no literal backtick
# appears in this script (a literal one inside the shell $() breaks bash's parser).
_bt = chr(96)
fence_re = re.compile("^(" + _bt + "{3,}|~{3,})")
clean, fence = [], None
for line in last.split("\n"):
    st = line.strip()
    m = fence_re.match(st)
    if m:
        mk = m.group(1)[0]            # backtick or tilde
        if fence is None:
            fence = mk
        elif st[:1] == fence:
            fence = None
        continue
    if fence is not None:
        continue
    clean.append(line)

# A real markdown table = a CONTIGUOUS run of pipe-bearing lines that contains a SEPARATOR
# row (|---|). Count the LARGEST such block (Codex P2) - not the sum of every pipe line, so
# two small tables or stray prose pipes do not add up to a false block. Leading pipes optional.
def is_sep(b):
    t = b.replace(" ", "")
    return bool(t) and set(t) <= set("|:-") and "-" in t

rows = 0
i, N = 0, len(clean)
while i < N:
    if "|" in clean[i]:
        j = i
        while j < N and "|" in clean[j]:
            j += 1
        block = clean[i:j]
        if any(is_sep(b) for b in block):
            rows = max(rows, len(block))
        i = j
    else:
        i += 1
print(rows)
PYEOF
)
ROWS=${ROWS:-0}

if [ "$ROWS" -ge "$THRESHOLD" ]; then
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "$(date '+%Y-%m-%d %H:%M:%S')  VISUAL-GATE  surface=$ep rows=$ROWS" >> "$LOG_FILE"
  ROWS="$ROWS" python3 -c "import json, os; r=os.environ['ROWS']; print(json.dumps({
    'decision': 'block',
    'reason': 'BLOCKED: you presented a ' + r + '-row data table as a wall of markdown text, but this is a RICH surface that renders visuals. Re-present that data as a VISUAL artifact - an HTML/SVG/React chart, a table widget, or a small dashboard (be creative where it helps the reader). If a plain table is genuinely the best form for THIS specific data, keep it but say so in one short line. Do not add commentary about this block beyond that.'
  }))"
fi
exit 0
