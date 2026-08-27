#!/bin/bash

# --- per-project sidecoach opt-out (Jonah 2026-08-27) -------------------------
# A repo carrying a `.sidecoach-off` file at its root disables sidecoach hooks for
# that project only. cwd is the project working dir when Claude runs a hook; fall
# back to $PWD outside a git tree. Other projects (no marker) are unaffected.
_sc_off_root="$(git rev-parse --show-toplevel 2>/dev/null || printf %s "$PWD")"
if [ -n "$_sc_off_root" ] && [ -f "$_sc_off_root/.sidecoach-off" ]; then exit 0; fi
# -----------------------------------------------------------------------------
# sidecoach-craft-floor.sh
#
# PreToolUse hook on Write|Edit|MultiEdit that injects the CRAFT FLOOR into context BEFORE a UI file
# is written - regardless of which sidecoach verb was invoked, including none at all.
#
# WHY A HOOK AND NOT A SKILL OR A VERB PAYLOAD.
#
# The per-verb craft brief (sidecoach/src/craft-corpus.ts) is selected by the rules that actually
# failed on a project, which is the right shape for a verb payload. It has one structural weakness:
# it only reaches the model if a verb was invoked, and invoked correctly. Measured 2026-07-29, the
# comparison implementation beat ours on exactly this axis - not on depth, but because its craft floor
# loads unconditionally ahead of every UI edit and so cannot be missed by a routing decision.
#
# A skill cannot close that gap: a skill loads when the model chooses to load it, which is the same
# dependency on correct routing. A UserPromptSubmit hook cannot close it either, because a UI edit
# inside a long build turn happens many turns after the prompt that started it. The only layer that
# fires on the edit itself is PreToolUse on the write, which is this file.
#
# WHAT IT DOES NOT DO.
#
#   - It never blocks. permissionDecision is left alone; this hook only adds context. A floor that
#     blocked an edit would make itself something to route around, which defeats the purpose.
#   - It never walks the project, runs a validator, or touches the network. The floor is static text.
#     This runs before every UI write, so cost is a correctness property, not a nicety.
#   - It says nothing on a non-UI file. The UI-detection rule lives in src/craft-floor.ts (isUiPath)
#     and is applied by bin/sidecoach-floor.js, so shell and TypeScript cannot disagree about it.
#
# COOLDOWN. A build turn writes the same file repeatedly. Re-injecting the floor on every write would
# burn tokens and train the reader to skip it. The floor is injected at most once per
# SIDECOACH_FLOOR_COOLDOWN seconds (default 900) per project PER SESSION.
#
# The session id is part of the state key, not just the project. Cross-model review 2026-07-29
# (Medium): keyed on the project alone, a fresh session starting within the cooldown of a previous
# session's UI write would skip the floor on its very first UI edit - the single most important
# injection there is, and precisely the case the floor exists for. A new session has none of the
# previous session's context, so its first UI write must always get the floor. When the payload
# carries no session_id the key falls back to the project alone, which is the old (safe-but-blunt)
# behaviour rather than a crash.
#
# Tests: claude/hooks/test-sidecoach-craft-floor.sh

set -uo pipefail

COOLDOWN="${SIDECOACH_FLOOR_COOLDOWN:-900}"
STATE_DIR="${SIDECOACH_FLOOR_STATE_DIR:-$HOME/.claude/.sidecoach-floor}"

INPUT="$(cat 2>/dev/null || true)"
[[ -z "$INPUT" ]] && exit 0

# Pull the target path out of the tool payload. Write/Edit/MultiEdit all carry tool_input.file_path.
# One python pass yields both the target path and the session id, tab-separated, so the hook does not
# pay two interpreter startups on every UI write.
PARSED="$(printf '%s' "$INPUT" | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ti = d.get("tool_input") or {}
p = ti.get("file_path") or ti.get("path") or ""
s = d.get("session_id") or ""
if not isinstance(p, str): p = ""
if not isinstance(s, str): s = ""
sys.stdout.write(p.replace("\t", " ") + "\t" + s.replace("\t", " "))
' 2>/dev/null || true)"
FILE_PATH="${PARSED%%$'\t'*}"
SESSION_ID="${PARSED#*$'\t'}"
[[ "$SESSION_ID" == "$PARSED" ]] && SESSION_ID=""

[[ -z "$FILE_PATH" ]] && exit 0

# Cheap extension pre-filter so a non-UI write costs no node startup at all. The AUTHORITATIVE check
# is isUiPath() inside bin/sidecoach-floor.js; this only avoids spawning node for an obvious miss.
#
# Lowercased with `tr`, NOT with ${VAR,,}. macOS ships bash 3.2 as /bin/bash and ${VAR,,} is a bash-4
# parameter expansion, so the original form was a "bad substitution" parse error on every invocation.
# Because the script runs without `set -e`, that error did not abort - it printed to stderr, the case
# statement never matched, and EVERY write fell through to node. The floor still worked (isUiPath in
# the CLI rejected non-UI files correctly), which is exactly why it would have gone unnoticed: the
# behaviour was right and the optimisation was silently dead while emitting a hook error every time.
# Caught 2026-07-29 by running the hook rather than reasoning about it.
FILE_PATH_LOWER="$(printf '%s' "$FILE_PATH" | tr '[:upper:]' '[:lower:]')"
case "$FILE_PATH_LOWER" in
  *.html|*.htm|*.css|*.scss|*.sass|*.less|*.jsx|*.tsx|*.vue|*.svelte|*.astro) ;;
  *) exit 0 ;;
esac

# Locate the floor CLI. Prefer a sidecoach checked out beside the edited file (so a project with its
# own copy uses that one), then the dotfiles clone, then an installed copy under ~/.claude.
FLOOR_BIN=""
for candidate in \
  "$(cd "$(dirname "$0")/../../sidecoach" 2>/dev/null && pwd)/bin/sidecoach-floor.js" \
  "$HOME/Documents/Github/improv/sidecoach/bin/sidecoach-floor.js" \
  "$HOME/.claude/sidecoach/bin/sidecoach-floor.js"
do
  if [[ -n "$candidate" && -f "$candidate" ]]; then FLOOR_BIN="$candidate"; break; fi
done
[[ -z "$FLOOR_BIN" ]] && exit 0

# Per-project cooldown key. The project is the nearest ancestor of the edited file containing a
# PRODUCT.md, DESIGN.md or package.json; failing that, the file's own directory. Keyed by hash so the
# state filename cannot collide or leak a path.
PROJECT_KEY="$(printf '%s' "$FILE_PATH" | python3 -c '
import hashlib,os,sys
p = sys.stdin.read().strip()
d = os.path.dirname(os.path.abspath(p))
root = d
while True:
    if any(os.path.exists(os.path.join(root, m)) for m in ("PRODUCT.md", "DESIGN.md", "package.json", ".git")):
        break
    parent = os.path.dirname(root)
    if parent == root:
        root = d
        break
    root = parent
sys.stdout.write(hashlib.sha256(root.encode()).hexdigest()[:16])
' 2>/dev/null || true)"
[[ -z "$PROJECT_KEY" ]] && PROJECT_KEY="default"

# Session-scoped: a new session's first UI write always gets the floor. Only the first 16 hex chars of
# the session id are used, and it is sanitised to [A-Za-z0-9_-] so it can never escape the state dir.
if [[ -n "$SESSION_ID" ]]; then
  SESSION_SAFE="$(printf '%s' "$SESSION_ID" | tr -c 'A-Za-z0-9_-' '_' | cut -c1-16)"
  PROJECT_KEY="${PROJECT_KEY}.${SESSION_SAFE}"
fi

{ mkdir -p "$STATE_DIR"; } 2>/dev/null || true
STATE_FILE="$STATE_DIR/$PROJECT_KEY"
NOW="$(date +%s)"

if [[ -f "$STATE_FILE" ]]; then
  LAST="$(cat "$STATE_FILE" 2>/dev/null || echo 0)"
  [[ "$LAST" =~ ^[0-9]+$ ]] || LAST=0
  if (( NOW - LAST < COOLDOWN )); then
    # Inside the cooldown: the floor is already in this session's context. Stay silent.
    exit 0
  fi
fi

FLOOR_TEXT="$(node "$FLOOR_BIN" --file "$FILE_PATH" 2>/dev/null || true)"
# No output means the CLI decided this is not UI work, or dist/ is unbuilt. Either way, say nothing
# and do NOT stamp the cooldown - so the floor still fires once the build exists.
[[ -z "$FLOOR_TEXT" ]] && exit 0

# Cross-model review 2026-07-29 (Low): `printf > "$FILE" 2>/dev/null` sets up the stdout redirection
# BEFORE the stderr one, so an unwritable STATE_DIR leaked the redirection error to stderr anyway - a
# hook that works while printing an error on every UI write. Redirect the whole group instead.
{ printf '%s' "$NOW" > "$STATE_FILE"; } 2>/dev/null || true

FLOOR_TEXT="$FLOOR_TEXT" python3 <<'PYEOF'
import json, os, sys
text = os.environ.get("FLOOR_TEXT", "")
if not text.strip():
    sys.exit(0)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": text,
    }
}))
PYEOF

exit 0
