#!/bin/bash
# SessionStart hook: catch "wired but not deployed" hooks (deploy-lag drift).
#
# WHY (the failure it prevents): a hook can be committed to the repo and wired in
# cluster-wirings.json / app-wirings.json, its file symlinked into ~/.claude/hooks,
# yet its entry never written into the live ~/.claude/settings.json - so the hook is
# present on disk but INERT, silently, with no signal. This is exactly how ELIAS
# (stakeholder mode) shipped dark: its hooks were symlinked 2026-08-05 but their
# settings.json wiring did not land until 2026-08-07, and every session launched in
# that window ran with the mode silently off (see
# session_2026-08-08_elias-silent-activation-failure.md).
#
# WHAT IT CHECKS: for every hook the repo config declares as wired (a key in
# cluster-wirings.json or app-wirings.json), IF that hook's file is deployed on disk
# at ~/.claude/hooks/<name> (i.e. the component is installed on this machine), THEN
# every command string the wiring declares for it must appear in the live
# ~/.claude/settings.json. Any declared command that is missing is a wired-but-not-
# deployed hook. When any are found, inject a one-line SessionStart warning naming
# them and the remedy. Silent ({}) when everything is current.
#
# HOW "installed" is determined: file presence at ~/.claude/hooks/<name>. A hook whose
# component was never installed (or was deselected) has no file on disk, so it is never
# checked - which is why this never warns about a hook that is not installed here. The
# install pass deploys a wired hook's FILE and writes its settings entry together, so on
# any normally-installed machine a present file with a missing entry is a real deploy lag.
#
# HONEST SCOPE - what this does NOT catch: the OTHER half of the ELIAS failure is
# harness behavior a hook cannot fix from inside. A running Claude session uses its
# LAUNCH-TIME settings.json snapshot and does not pick up newly-deployed hooks until a
# fresh SessionStart (compaction / new context window). So a hook can be correctly in
# settings.json (this check passes) while an already-running session stays dark on it.
# That frozen-snapshot gap is out of scope by design; the remedy is to restart or let
# long-running sessions compact. This check owns only the deploy-lag half: config-wired
# but absent from settings.json on disk.
#
# Silent ({}) when: HOOK_DEPLOY_CURRENCY_DISABLE=1, python3 is unavailable, the repo
# (and thus the wiring tables) cannot be located, the live settings.json cannot be read,
# or every deployed wired hook is current. It NEVER blocks and NEVER mutates anything.

[ "${HOOK_DEPLOY_CURRENCY_DISABLE:-}" = "1" ] && { echo '{}'; exit 0; }

command -v python3 >/dev/null 2>&1 || { echo '{}'; exit 0; }

# Resolve THIS script's own checkout, following the ~/.claude/hooks symlink farm back
# into the repo. Same walk as hook-registry-guard.sh: BASH_SOURCE + a plain cd does NOT
# resolve symlinks, and the wiring tables live beside this script in claude/hooks/.
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
if [ -n "$_SELF_REPO" ] && [ -f "$_SELF_REPO/claude/hooks/cluster-wirings.json" ]; then
  REPO_DIR="$_SELF_REPO"
else
  REPO_DIR="${CLAUDE_PROJECT_DIR:-${_SELF_REPO:-$PWD}}"
fi

WIRINGS_DIR="$REPO_DIR/claude/hooks"
[ -f "$WIRINGS_DIR/cluster-wirings.json" ] || { echo '{}'; exit 0; }

REPO_DIR="$REPO_DIR" HOOKS_DIR="$HOME/.claude/hooks" SETTINGS="$HOME/.claude/settings.json" python3 - <<'PY'
import json, os, sys

repo = os.environ["REPO_DIR"]
hooksdir = os.environ["HOOKS_DIR"]
settings_path = os.environ["SETTINGS"]

def load(p):
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None

# EVERYTHING below is wrapped so that ANY unexpected shape or error yields a silent {}
# rather than a traceback (exit 1) that would turn into SessionStart noise. The contract
# is fail-quiet: if we cannot reliably judge currency, we say nothing. The per-item
# isinstance guards keep a partially-malformed-but-mostly-valid settings judgeable; this
# try/except is the final net for anything they miss (e.g. hooks keyed to a non-dict).
try:
    # Live settings.json is the deployment truth. If it cannot be read, we cannot judge
    # currency - stay silent rather than cry wolf.
    settings = load(settings_path)
    if not isinstance(settings, dict):
        print('{}'); sys.exit(0)

    live = set()
    hooks_obj = settings.get("hooks")
    if hooks_obj is None:
        hooks_obj = {}            # no hooks wired at all -> judge normally (empty live set)
    elif not isinstance(hooks_obj, dict):
        # "hooks" present but malformed (a list, string, etc.): the file is corrupt and
        # we cannot trust ANY conclusion about what is live. Stay silent rather than
        # declare every deployed hook missing (that would be crying wolf on a bad file).
        print('{}'); sys.exit(0)
    for _ev, groups in hooks_obj.items():
        if not isinstance(groups, list):
            continue
        for g in groups:
            if not isinstance(g, dict):
                continue
            gh = g.get("hooks")
            if not isinstance(gh, list):
                continue
            for h in gh:
                if not isinstance(h, dict):
                    continue
                cmd = h.get("command")
                if isinstance(cmd, str) and cmd:
                    live.add(cmd)

    # Declared wiring: every hook the repo says must be wired, with its exact command
    # strings. cluster-wirings.json + app-wirings.json together are the source of truth
    # the installer writes verbatim into settings.json.
    declared = {}
    for wf in ("cluster-wirings.json", "app-wirings.json"):
        w = load(os.path.join(repo, "claude", "hooks", wf))
        if not isinstance(w, dict):
            continue
        for name, entries in w.items():
            if not isinstance(entries, list):
                continue
            for e in entries:
                if not isinstance(e, dict):
                    continue
                hookobj = e.get("hook")
                if not isinstance(hookobj, dict):
                    continue
                cmd = hookobj.get("command")
                if isinstance(cmd, str) and cmd:
                    declared.setdefault(name, []).append(cmd)

    # For each DEPLOYED wired hook (file present on disk = component installed here),
    # every declared command must be live in settings.json. Missing = the deploy-lag gap.
    missing = []
    for name in sorted(declared):
        if not os.path.exists(os.path.join(hooksdir, name)):
            continue  # not deployed here -> component not installed -> never our concern
        if any(cmd not in live for cmd in declared[name]):
            missing.append(name)
except Exception:
    print('{}'); sys.exit(0)

if not missing:
    print('{}'); sys.exit(0)

names = ", ".join(missing)
plural = "" if len(missing) == 1 else "s"
msg = ("Hook deploy-currency: %d wired hook%s on disk but NOT live in settings.json (%s) "
       "- wired but not deployed; run install.sh to deploy (already-running sessions stay "
       "on their launch snapshot until they restart or compact)." % (len(missing), plural, names))

print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": msg}}))
PY
