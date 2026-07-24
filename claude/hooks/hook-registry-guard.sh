#!/usr/bin/env bash
# hook-registry-guard.sh - catch a hook the moment it is written and refuse to let it
# stay UNMANAGED (invisible to install.sh and to the component browser).
#
# WHY THIS EXISTS
# Every hook in this repo is supposed to be owned by a component: listed in
# claude/hooks/browser-tree.json (so the browser can show and toggle it, with a
# description a human wrote) and deployed by install.sh (so a fresh machine gets it).
# Hooks that skip that are invisible: they never install anywhere else, and the browser
# silently under-reports. Measured 2026-07-16: 100 hook files on disk, 61 in the tree.
# Five were genuinely unmanaged, including node-path-default.sh, written that same day
# and never packaged. The tree ALSO lied the other way (it claimed sidecoach owned 2
# hooks while the installer wired 6), because the only test checked the tree against
# ITSELF. This guard closes the write-time end of that hole.
#
# WHAT IT DOES NOT DO
# It does not edit install.sh or the tree. A shell hook cannot pick the right owning
# component or write a description worth reading - it would guess from the filename and
# ship a wrong owner plus a placeholder into a browser humans read. So it DETECTS,
# INSTRUCTS precisely, and arms a flag that hook-registry-stop.sh gates on. The model
# does the categorising; the hook makes forgetting impossible.
#
# MODES
#   (stdin JSON)  PostToolUse Write|Edit|MultiEdit - the live guard.
#   --audit       list every unmanaged hook on disk and exit 1 if any. For tests/CI.
#   --check NAME  check one hook name; exit 0 managed, 1 unmanaged.
#
# Project-scoped by design (wired in this repo's .claude/settings.json, like
# beats-rebuild), because it reads THIS repo's browser-tree.json and install.sh. It is
# meaningless on a machine that merely installed the dotfiles. Same reasoning as
# decision_beats_hooks_stay_project_scoped.md.

set -uo pipefail

FLAG="$HOME/.claude/.unmanaged-hook"

# REPO_DIR: this script's OWN checkout wins over CLAUDE_PROJECT_DIR.
#
# CLAUDE_PROJECT_DIR used to take precedence, which silently pointed the guard at the
# WRONG repo whenever a session in project A touched project B. Proven 2026-07-23: with a
# foreign CLAUDE_PROJECT_DIR, --audit globbed an empty directory and pronounced a repo with
# three unmanaged hooks CLEAN (exit 0), and the Stop gate saw every armed name as "gone
# from disk" and cleared a live arm. The guard reads THIS repo's browser-tree.json and
# ships inside it, so the checkout containing the script is always the right answer;
# CLAUDE_PROJECT_DIR is only a fallback for a checkout that has no tree to read.
#
# The symlink walk is load-bearing, not decoration: ~/.claude/hooks is a symlink farm
# pointing back into this repo, and BASH_SOURCE plus a plain `cd` does NOT resolve
# symlinks. Invoked as ~/.claude/hooks/hook-registry-guard.sh, an unresolved path puts
# _SELF_REPO at $HOME, where there is no tree - which drops straight back to
# CLAUDE_PROJECT_DIR and reopens the exact blind spot this fix exists to close.
_self="${BASH_SOURCE[0]}"
_hops=0
while [ -L "$_self" ] && [ "$_hops" -lt 40 ]; do
  _link="$(readlink "$_self")"
  case "$_link" in
    /*) _self="$_link" ;;
    *)  _self="$(dirname "$_self")/$_link" ;;
  esac
  _hops=$((_hops + 1))
done
_SELF_REPO="$(cd -P "$(dirname "$_self")/../.." 2>/dev/null && pwd -P)"
if [ -n "$_SELF_REPO" ] && [ -f "$_SELF_REPO/claude/hooks/browser-tree.json" ]; then
  REPO_DIR="$_SELF_REPO"
else
  REPO_DIR="${CLAUDE_PROJECT_DIR:-${_SELF_REPO:-$PWD}}"
fi

TREE="$REPO_DIR/claude/hooks/browser-tree.json"
INSTALL_SH="$REPO_DIR/install.sh"

# Not hooks. Test suites and sourced libraries are never wired into settings.json, so
# demanding an owner for them would be noise that trains you to ignore the guard.
_is_excluded() {
  case "$1" in
    test-*|*-lib) return 0 ;;
  esac
  # NOT EVENT HOOKS. Each lives in claude/hooks/ and ends in .sh, but none is wired to a
  # Claude Code event, so none has a toggle to own. Each entry states WHY, because an
  # exemption with no reason is just a place to hide an unmanaged hook.
  case "$1" in
    # Shared DEPENDENCY: deployed by install.sh, exec'd BY model-router-guard.sh and
    # fable-orchestrator-guard.sh. Never wired standalone; off-listing the guard must not
    # strip the guard's own dependency.
    detect-session-model) return 0 ;;
    # LAUNCHD-SCHEDULED, not event-driven: reflect-owned, run from
    # ~/Library/LaunchAgents/com.yesand.beats-reflect-weekly.plist. Appears in no
    # settings.json event, so there is nothing to wire or toggle. Verified 2026-07-16.
    beats-reflect-weekly) return 0 ;;
    # CORE, BASE-WIRED: config-owned and shipped in the base claude/settings.json
    # (install.sh's deactivate_config calls it "config-owned (core, base-wired)"). It is
    # what makes the Bash tool honor the nvm default, so it is not individually
    # toggleable - switching it off breaks every global node CLI, codex included.
    node-path-default) return 0 ;;
  esac
  return 1
}

# managed = pinned (project-scoped, always on, deliberately not installer-managed)
#           OR (present in the tree AND deployed by install.sh)
# Both halves matter. Tree-only means the browser offers a toggle for something no
# machine ever installs. Installer-only means the browser under-reports - the exact
# sidecoach 2-vs-6 lie.
_is_managed() {
  local name="$1"
  [ -f "$TREE" ] || return 0        # no tree: not our repo, stay quiet
  [ -f "$INSTALL_SH" ] || return 0
  NAME="$name" TREE="$TREE" INSTALL_SH="$INSTALL_SH" python3 - <<'PY'
import json, os, re, sys
name = os.environ["NAME"]
try:
    t = json.load(open(os.environ["TREE"]))
except Exception:
    sys.exit(0)   # unreadable tree is not this hook's problem to report
if name in set(t.get("pinned_hooks", [])):
    sys.exit(0)
in_tree = name in set(t.get("hook_owner", {}))
src = open(os.environ["INSTALL_SH"]).read()
# Deployed if install.sh names the FILE in a hook-deploying position: an
# install_app_hooks argument list, a cluster_hooks member list, or a direct
# link_or_copy. Plain word-match on the filename is enough - install.sh never
# mentions a hook file it does not deploy.
in_installer = re.search(r'(?<![\w-])' + re.escape(name) + r'\.sh(?![\w-])', src) is not None
sys.exit(0 if (in_tree and in_installer) else 1)
PY
}

_instructions() {
  local name="$1"
  cat <<EOF
UNMANAGED HOOK: ${name}.sh is not packaged. It will not install on any other machine,
and the component browser cannot show or toggle it. Wire it before you finish:

1. PICK ITS OWNING COMPONENT. If it only makes sense inside this repo (it reads this
   repo's files), it is PROJECT-SCOPED instead: wire it in .claude/settings.json and add
   it to "pinned_hooks" in claude/hooks/browser-tree.json. See
   decision_beats_hooks_stay_project_scoped.md.
2. claude/hooks/browser-tree.json:
   - add "${name}" to the owning component's "hooks" list
   - add "hook_desc": {"${name}": "<one plain sentence a user can act on>"}
   - add "hook_owner": {"${name}": "<install key>"}
3. install.sh: add it to that component's deploy line, e.g.
   picked <owner> && install_app_hooks ... ${name}.sh
4. claude/hooks/app-wirings.json: add its event/matcher/command/timeout entry, so the
   per-hook off-list can wire and unwire it (only install_app_hooks honors the off-list).
5. Run: /bin/bash claude/hooks/test-component-browser.sh  (the structural test checks the
   tree against install.sh's own picked/install_app_hooks lines, in BOTH directions)

Write the description yourself. Do not ship a placeholder into a browser humans read.
EOF
}

case "${1:-}" in
  --audit)
    # ONE python3 pass over every candidate, not one per hook file. hook-registry-stop.sh
    # now runs this sweep on EVERY stop, so its cost sits on the session's critical path:
    # the old per-name loop spawned 116 interpreters and took ~1.8s, the batch takes ~0.05s.
    # Same answer either way - parity against the per-name loop is asserted in the tests.
    [ -f "$TREE" ] || exit 0          # no tree: not our repo, stay quiet
    [ -f "$INSTALL_SH" ] || exit 0
    names=""
    for f in "$REPO_DIR"/claude/hooks/*.sh; do
      [ -e "$f" ] || continue
      n="$(basename "$f" .sh)"
      _is_excluded "$n" && continue
      names="$names$n"$'\n'
    done
    [ -n "$names" ] || exit 0
    NAMES="$names" TREE="$TREE" INSTALL_SH="$INSTALL_SH" python3 - <<'PY'
import json, os, re, sys
try:
    names = [n for n in os.environ["NAMES"].split("\n") if n]
    t = json.load(open(os.environ["TREE"]))
    if not isinstance(t, dict):
        raise ValueError("browser-tree.json is not an object")
    pinned = set(t.get("pinned_hooks") or [])
    in_tree = set(t.get("hook_owner") or {})
    src = open(os.environ["INSTALL_SH"]).read()
    bad = [n for n in names
           if n not in pinned
           and not (n in in_tree
                    and re.search(r'(?<![\w-])' + re.escape(n) + r'\.sh(?![\w-])', src))]
except Exception:
    # ANYTHING that stops the audit COMPLETING is "I cannot tell" - a torn read mid-write,
    # a tree that parses but is the wrong shape, install.sh vanishing between the shell's
    # -f test and open(). Exit 3, never 0 and never 1.
    #
    # This distinction is load-bearing. hook-registry-stop.sh disarms the gate on a clean
    # answer, so "clean" and "could not tell" must not look alike; and it treats 1 as
    # "found some", so a crash that happened to exit 1 with no names printed would have
    # read as an empty found-set and cleared a live arm. Exit 1 is now reserved for a
    # COMPLETED audit with names to report. Observed live 2026-07-23: a concurrent
    # teammate rewriting browser-tree.json turned one suite run red mid-flight.
    sys.exit(3)
for n in bad:
    print("UNMANAGED: " + n)
sys.exit(1 if bad else 0)
PY
    exit $?
    ;;
  --check)
    n="${2:-}"; [ -n "$n" ] || { echo "usage: --check <name>" >&2; exit 2; }
    n="${n%.sh}"
    # Exclusions FIRST, so --check agrees with the live path and --audit. Without this,
    # --check called an exempt hook unmanaged while the guard itself stayed silent on it -
    # three answers to the same question, and the Stop gate consults --check, so it would
    # have blocked forever on a hook the guard had already decided to exempt.
    _is_excluded "$n" && exit 0
    _is_managed "$n"; exit $?
    ;;
esac

# --- live PostToolUse path -------------------------------------------------------
input="$(cat 2>/dev/null || true)"
[ -n "$input" ] || exit 0

path="$(printf '%s' "$input" | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print(''); raise SystemExit
ti=d.get('tool_input') or {}
print(ti.get('file_path') or ti.get('notebook_path') or '')
" 2>/dev/null)"

case "$path" in
  */claude/hooks/*.sh) ;;
  *) exit 0 ;;
esac

name="$(basename "$path" .sh)"
_is_excluded "$name" && exit 0
_is_managed "$name" && {
  # Managed now. If it was the reason the flag was armed, clear it.
  if [ -f "$FLAG" ] && grep -Fxq "$name" "$FLAG" 2>/dev/null; then
    remaining="$(grep -Fxv "$name" "$FLAG" 2>/dev/null || true)"
    if [ -n "$remaining" ]; then printf '%s\n' "$remaining" > "$FLAG"; else rm -f "$FLAG"; fi
  fi
  exit 0
}

mkdir -p "$(dirname "$FLAG")"
grep -Fxq "$name" "$FLAG" 2>/dev/null || echo "$name" >> "$FLAG"
_instructions "$name"
exit 0
