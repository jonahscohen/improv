#!/bin/bash
# SessionStart + Stop hook: self-heal the cmux NODE_OPTIONS restore shim.
#
# cmux sets NODE_OPTIONS=--require=<macOS temp>/cmux-claude-node-options/
# restore-node-options.cjs for the whole session. macOS periodically purges
# that temp area (2026-05-31 and 2026-06-11 incidents), after which EVERY node
# process - npx, npm, node-based hooks like the nyx hook-bridge - dies at
# startup with MODULE_NOT_FOUND on the preload. This hook re-plants the shim
# from the durable canonical copy in the dotfiles repo whenever it is missing,
# so the breakage heals at session start and after every turn instead of
# waiting for a human to notice.
#
# Canonical copy: <repo>/claude/node-shims/restore-node-options.cjs
# (also reachable via ~/.claude/node-shims if the dotfiles symlink covers it).

CANONICAL="$HOME/.claude/node-shims/restore-node-options.cjs"
if [ ! -f "$CANONICAL" ]; then
  # Fall back to the repo copy, resolved from THIS script's real location (follow the
  # ~/.claude/hooks symlink back into the dotfiles repo). Previously this was a hardcoded
  # /Users/<name>/... path, which silently made the fallback dead on any other machine.
  SELF="$0"
  while [ -L "$SELF" ]; do
    LINK=$(readlink "$SELF")
    case "$LINK" in
      /*) SELF="$LINK" ;;
      *)  SELF="$(dirname -- "$SELF")/$LINK" ;;
    esac
  done
  CANONICAL="$(cd -- "$(dirname -- "$SELF")" 2>/dev/null && pwd -P)/../node-shims/restore-node-options.cjs"
fi

[ -f "$CANONICAL" ] || exit 0  # nothing to heal from; stay silent and non-blocking

# Pull every restore-node-options.cjs path referenced by NODE_OPTIONS
# (handles --require=<path>, --require <path>, and -r <path> forms).
PATHS=$(printf '%s\n' "${NODE_OPTIONS:-}" | tr ' ' '\n' | grep 'restore-node-options\.cjs' | sed 's/^--require=//; s/^-r=//')

HEALED=""
for P in $PATHS; do
  case "$P" in
    /*) ;;
    *) continue ;;  # skip non-path tokens (e.g. a bare --require flag)
  esac
  if [ ! -f "$P" ]; then
    # Re-plant ATOMICALLY: copy to a unique temp in the same directory, then rename over
    # the target. A plain `cp` is observable half-written, and hooks run CONCURRENTLY with
    # each other and with the ~/.claude/cmux/node PATH shim - a racing node must never be
    # able to preload a truncated file.
    D="$(dirname "$P")"
    T="$D/.restore-node-options.$$.tmp"
    if mkdir -p "$D" 2>/dev/null &&
       cp "$CANONICAL" "$T" 2>/dev/null &&
       mv -f "$T" "$P" 2>/dev/null; then
      HEALED="$HEALED $P"
    else
      rm -f "$T" 2>/dev/null
    fi
  fi
done

if [ -n "$HEALED" ]; then
  echo "node-shim-heal: NODE_OPTIONS preload shim was missing (macOS temp purge) and has been re-planted at:$HEALED. node/npx and node-based hooks work again; no action needed."
fi
exit 0
