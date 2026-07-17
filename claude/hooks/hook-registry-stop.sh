#!/usr/bin/env bash
# hook-registry-stop.sh - the gate half of hook-registry-guard.sh.
#
# The guard detects an unmanaged hook at write time and arms ~/.claude/.unmanaged-hook.
# This blocks the Stop until that hook is actually packaged. A warning with no gate is a
# warning that gets scrolled past - this session shipped a browser whose tree lied about
# which hooks existed, past 110 green assertions, precisely because nothing forced the
# issue at the moment of truth.
#
# RE-CHECKS RATHER THAN TRUSTING THE FLAG. The flag records what WAS unmanaged; by the
# time Stop fires the model may have wired it. Re-deriving from the tree + install.sh
# means the gate opens the instant the work is genuinely done, and cannot be satisfied by
# deleting the flag. It also self-heals if a hook file was removed entirely.
#
# Blocks ONCE per armed hook: if the model chooses not to wire it, the second Stop
# passes, so this cannot trap a session in a loop. Deliberate - the same shape as the
# chrome-tabgroup Stop reminder.

set -uo pipefail

FLAG="$HOME/.claude/.unmanaged-hook"
ACKED="$HOME/.claude/.unmanaged-hook-acked"
REPO_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
GUARD="$REPO_DIR/claude/hooks/hook-registry-guard.sh"

[ -f "$FLAG" ] || exit 0
[ -x "$GUARD" ] || exit 0

still=""
while IFS= read -r name; do
  [ -n "$name" ] || continue
  # Gone from disk entirely: nothing to package, drop it.
  [ -f "$REPO_DIR/claude/hooks/$name.sh" ] || continue
  if ! "$GUARD" --check "$name" >/dev/null 2>&1; then
    still="$still$name"$'\n'
  fi
done < "$FLAG"

still="$(printf '%s' "$still" | sed '/^$/d')"

if [ -z "$still" ]; then
  rm -f "$FLAG" "$ACKED"
  exit 0
fi

printf '%s\n' "$still" > "$FLAG"

# Already blocked once for exactly this set - let the session end.
if [ -f "$ACKED" ] && [ "$(cat "$ACKED" 2>/dev/null)" = "$still" ]; then
  exit 0
fi
printf '%s' "$still" > "$ACKED"

{
  echo "BLOCKED: hook(s) written but never packaged, so they will not install anywhere else"
  echo "and the component browser cannot show or toggle them:"
  printf '%s\n' "$still" | sed 's/^/  - /'
  echo ""
  echo "Wire each into claude/hooks/browser-tree.json (hooks list + hook_desc + hook_owner)"
  echo "and install.sh (picked <owner> && install_app_hooks ... <name>.sh), plus"
  echo "claude/hooks/app-wirings.json for its event wiring. If it is repo-only tooling,"
  echo "wire it in .claude/settings.json and add it to pinned_hooks instead."
  echo "Verify: /bin/bash claude/hooks/test-component-browser.sh"
  echo ""
  echo "Deliberately leaving it unpackaged? Say so plainly and stop again - this blocks once."
} >&2
exit 2
