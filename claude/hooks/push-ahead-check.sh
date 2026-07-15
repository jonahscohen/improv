#!/bin/bash
# SessionStart hook: surface committed-but-unpushed work (push-ahead drift).
#
# WHY: committed-but-unpushed commits are invisible - a unit can be "done" and
# committed on a branch that never leaves the machine, and the next session (or
# another machine) has no idea. This reads the ahead-count of the session repo's
# current branch vs its tracked upstream and, when > 0, injects a one-line
# SessionStart notice naming the branch and count. It NEVER pushes and NEVER
# mutates anything - it only reports.
#
# Silent ({}) when: not a git work tree, the branch has no upstream, the branch
# is in sync (0 ahead), or PUSH_AHEAD_DISABLE=1. Registered with the SESSION_CWD
# wrapper (like reflect-nudge.sh) so it reads the session's project dir.

[ "${PUSH_AHEAD_DISABLE:-}" = "1" ] && { echo '{}'; exit 0; }

CWD="${SESSION_CWD:-$(pwd)}"

# Must be a git work tree.
git -C "$CWD" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo '{}'; exit 0; }

# Current branch (silent on detached HEAD).
BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null)
[ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ] || { echo '{}'; exit 0; }

# Tracked upstream (silent when none is configured - nothing to be ahead of).
UPSTREAM=$(git -C "$CWD" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)
[ -n "$UPSTREAM" ] || { echo '{}'; exit 0; }

# Commits on HEAD not on the upstream = committed but not pushed.
AHEAD=$(git -C "$CWD" rev-list --count '@{upstream}..HEAD' 2>/dev/null)
case "$AHEAD" in
  ''|*[!0-9]*) echo '{}'; exit 0 ;;   # unparseable -> stay silent
esac
[ "$AHEAD" -gt 0 ] || { echo '{}'; exit 0; }

plural="s"; [ "$AHEAD" -eq 1 ] && plural=""
MSG="Push-ahead drift: branch '${BRANCH}' is ${AHEAD} commit${plural} ahead of its upstream (${UPSTREAM}) - committed locally but not pushed. Push when the current unit is accepted, or continue if leaving it local is intentional."

EVT="SessionStart" CTX="$MSG" python3 -c "import json, os; print(json.dumps({'hookSpecificOutput': {'hookEventName': os.environ['EVT'], 'additionalContext': os.environ['CTX']}}))"
