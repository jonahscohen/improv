#!/bin/bash

# --- per-project sidecoach opt-out (Jonah 2026-08-27) -------------------------
# A repo carrying a `.sidecoach-off` file at its root disables sidecoach hooks for
# that project only. cwd is the project working dir when Claude runs a hook; fall
# back to $PWD outside a git tree. Other projects (no marker) are unaffected.
_sc_off_root="$(git rev-parse --show-toplevel 2>/dev/null || printf %s "$PWD")"
if [ -n "$_sc_off_root" ] && [ -f "$_sc_off_root/.sidecoach-off" ]; then exit 0; fi
# -----------------------------------------------------------------------------
# SessionStart hook: self-heal Sidecoach's own hook wiring so the taste layer
# fires reliably on every machine, every session - the un-strippable counterpart
# to install.sh's one-shot wiring pass.
#
# WHY THIS EXISTS. Sidecoach wires its hooks through install.sh + app-wirings.json,
# not a plugin manifest, so its registrations live in the mutable ~/.claude/settings.json
# and its hook files live as ~/.claude/hooks/*.sh SYMLINKS into the repo. Two failure
# modes were observed and neither errored loudly:
#
#   1. STRIPPED REGISTRATION (2026-08-01): install.sh's sidecoach block runs a
#      NORMALIZE-ONLY strip that deletes every settings entry whose command contains
#      "sidecoach", and re-adds the canonical set LATER, in the consolidated app-hook
#      pass ~250 lines further down. Under `set -euo pipefail`, an abort in any OTHER
#      component's block between the strip and the re-add leaves sidecoach STRIPPED-BUT-
#      NOT-RESTORED - zero sidecoach hooks live. install.sh now also re-adds co-located
#      with the strip (closing that window), but a dedupe pass or a hand-edit that
#      removes a "sidecoach" entry has the same effect and this hook is the durable net.
#   2. REGISTERED-BUT-UNSYMLINKED (2026-08-20): a registration whose ~/.claude/hooks
#      symlink was never created resolves to nothing, so the event fires
#      "No such file or directory" every time. "Registered" is not "resolvable".
#
# This hook reasserts BOTH halves every session, exactly like node-shim-heal.sh and
# cmux-team-config-heal.sh reassert their own layers:
#   - SYMLINK repair  - immediate effect: a hook whose symlink is missing resolves and
#                       fires THIS session once the link exists.
#   - REGISTRATION repair - next-session effect: Claude Code caches the hook registry at
#                       session start, so a re-added entry fires from the NEXT session.
#                       Over one or two sessions the wiring is whole again with no
#                       installer re-run and no hand-editing.
#
# It is ADDITIVE and NON-DESTRUCTIVE: it only ever creates a missing symlink or adds a
# missing registration (deduped by exact command). It never removes anything, so it can
# never fight the installer or a deliberate off-list.
#
# ONLY HEALS A PARTIALLY-WIRED HOOK, so a deliberate per-hook disable is respected. The
# two documented drift modes each leave exactly ONE of the two signals behind:
#   - stripped registration  -> the symlink is still deployed (registration lost)
#   - missing symlink        -> the registration is still present (symlink lost)
# A hook is "active" here if EITHER signal is present, and the heal restores the missing
# one. If BOTH signals are absent, the hook was deliberately removed (a browser per-hook
# toggle-off runs deactivate_app_hooks, which strips the registration AND the symlink),
# so the heal LEAVES IT ALONE - it never re-enables a hook a user turned off. This is why
# it keys on the (symlink, registration) pair rather than blindly reasserting the set.
#
# SCOPE / SOURCE OF TRUTH. The candidate sidecoach hook set is derived, not hard-coded:
# every "sidecoach-*.sh" key in app-wirings.json MINUS browser-tree.json's
# default_off_hooks (sidecoach-detect, the opt-in per-edit scanner). So this hook can
# never drift from the installer's own wiring table, and it never force-enables the
# opt-in scanner.
#
# DEACTIVATION-SAFE. It no-ops entirely unless the Sidecoach SKILL is deployed
# (~/.claude/skills/sidecoach present). A machine that deliberately removed sidecoach
# (which also removes this hook) is never resurrected by a stray registration.
#
# RESIDUAL GAP (honest, mirrors the cmux heal's own note): this hook can only run if IT
# is registered. If a strip removes this hook's OWN registration outside an installer run
# and nothing re-adds it, it cannot self-restore. The co-located re-add in install.sh is
# what guarantees its registration lands atomically on install; from there it is
# self-sustaining. Fully eliminating even that requires a plugin-manifest always-loaded
# path (a larger change to Sidecoach's distribution model).
#
# python3 is the whole engine (JSON parse + atomic settings write). Without it this hook
# is a silent, non-blocking no-op - a heal that does not run is exactly the prior status
# quo, so failing open changes nothing for the worse. Exits 0 always (non-blocking).

set -u

# --- resolve REPO_DIR from this script's own location -----------------------------
# ~/.claude/hooks/sidecoach-heal.sh is a symlink into the dotfiles repo; follow it back
# so the canonical sources (app-wirings.json, browser-tree.json, the hook files) are
# found regardless of which machine or checkout this is. A hardcoded path would be dead
# on any other machine (the bug node-shim-heal.sh's comment records).
SELF="$0"
while [ -L "$SELF" ]; do
  LINK=$(readlink "$SELF")
  case "$LINK" in
    /*) SELF="$LINK" ;;
    *)  SELF="$(dirname -- "$SELF")/$LINK" ;;
  esac
done
HOOK_DIR="$(cd -- "$(dirname -- "$SELF")" 2>/dev/null && pwd -P)" || exit 0
REPO_DIR="$(cd -- "$HOOK_DIR/../.." 2>/dev/null && pwd -P)" || exit 0

# Nothing to heal from if the canonical wiring tables are not beside us (not our repo).
[ -f "$REPO_DIR/claude/hooks/app-wirings.json" ] || exit 0

# python3 is required; without it, silent non-blocking no-op.
command -v python3 >/dev/null 2>&1 || exit 0

# Deactivation-safe gate: only heal when the Sidecoach skill is actually deployed.
if [ ! -e "$HOME/.claude/skills/sidecoach" ]; then
  exit 0
fi

REPO_DIR="$REPO_DIR" HOME="$HOME" python3 <<'PY'
import json, os, sys, tempfile

repo = os.environ["REPO_DIR"]
home = os.environ["HOME"]
claude = os.path.join(home, ".claude")
hooks_dir = os.path.join(claude, "hooks")
settings_path = os.path.join(claude, "settings.json")
repo_hooks = os.path.join(repo, "claude", "hooks")
wirings_path = os.path.join(repo_hooks, "app-wirings.json")
tree_path = os.path.join(repo_hooks, "browser-tree.json")


def _load(p):
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None


wir = _load(wirings_path)
if not isinstance(wir, dict):
    sys.exit(0)  # cannot derive the set - stay silent

# default-on sidecoach hooks = every sidecoach-*.sh key in app-wirings.json
# MINUS browser-tree.json's default_off_hooks (the opt-in detect scanner).
tree = _load(tree_path) or {}
default_off = set()
for name in tree.get("default_off_hooks", []) or []:
    default_off.add(name if name.endswith(".sh") else name + ".sh")

hook_files = [
    k for k in wir.keys()
    if k.startswith("sidecoach-") and k.endswith(".sh") and k not in default_off
]

# Companion DATA files the sidecoach hooks import/read at runtime. Symlinks only, no
# registration. Kept in sync with install.sh's sidecoach registry loop; a missing one
# silently degrades the keyword hook's lane/verb tiers, so the heal repairs them too.
data_files = [
    "sidecoach-verbs.json",
    "sidecoach-lanes.json",
    "sidecoach-intent.json",
    "sidecoach_lanes.py",
]

healed_links = []
added = []

try:
    os.makedirs(hooks_dir, exist_ok=True)
except OSError:
    pass


def _norm(m):
    # Claude Code treats an ABSENT matcher, "" and "*" as the same bucket.
    return "*" if m in (None, "", "*") else m


# --- load settings (read-only here; the write guard below refuses a repo symlink) ---
if not os.path.exists(settings_path):
    settings = {}
    settings_readable = True
else:
    d = _load(settings_path)
    if isinstance(d, dict):
        settings = d
        settings_readable = True
    else:
        # Unparseable settings.json: never write over it, and registration state is
        # unknown. Symlink repair can still proceed off the on-disk signal alone.
        settings = None
        settings_readable = False

hooks = settings.get("hooks", {}) if settings_readable else {}


def is_registered(name):
    # True if ANY of this hook's app-wirings entries is present in settings.
    for e in wir.get(name, []):
        if not (isinstance(e, dict) and "event" in e and "hook" in e):
            continue
        want = _norm(e.get("matcher"))
        cmd = e.get("hook", {}).get("command")
        for g in hooks.get(e["event"], []):
            if _norm(g.get("matcher")) == want:
                for h in g.get("hooks", []):
                    if h.get("command") == cmd:
                        return True
    return False


def ensure_link(name):
    # Create/repair the ~/.claude/hooks/<name> symlink into the repo. Returns True iff it
    # created or replaced a link. A correct symlink or a correct real file is left alone.
    src = os.path.join(repo_hooks, name)
    dst = os.path.join(hooks_dir, name)
    if not os.path.exists(src):
        return False  # repo does not ship it; nothing to link
    try:
        if os.path.islink(dst) and os.path.realpath(dst) == os.path.realpath(src):
            return False  # already correct
    except OSError:
        pass
    if os.path.exists(dst) and not os.path.islink(dst):
        return False  # a correct real file (copy-mode install) is resolvable
    tmp = dst + ".heal.%d.tmp" % os.getpid()
    try:
        if os.path.islink(tmp) or os.path.exists(tmp):
            os.remove(tmp)
    except OSError:
        pass
    try:
        os.symlink(src, tmp)
        os.replace(tmp, dst)
        return True
    except OSError:
        try:
            os.remove(tmp)
        except OSError:
            pass
        return False


def add_registrations(name):
    # Add any of this hook's app-wirings entries that are missing. Records each add so the
    # single settings write below is skipped when there is nothing to do.
    for e in wir.get(name, []):
        if not (isinstance(e, dict) and "event" in e and "hook" in e):
            continue
        event = e["event"]
        matcher = e.get("matcher")
        hookobj = e["hook"]
        cmd = hookobj.get("command")
        want = _norm(matcher)
        # already present across any semantically-equivalent group?
        present = False
        for g in hooks.get(event, []):
            if _norm(g.get("matcher")) == want:
                for h in g.get("hooks", []):
                    if h.get("command") == cmd:
                        present = True
                        break
            if present:
                break
        if present:
            continue
        groups = hooks.setdefault(event, [])
        if matcher is not None:
            g = next((x for x in groups if _norm(x.get("matcher")) == want), None)
            if g is None:
                g = {"matcher": matcher, "hooks": []}
                groups.append(g)
        else:
            g = next((x for x in groups if _norm(x.get("matcher")) == "*"), None)
            if g is None:
                g = {}
                groups.append(g)
        g.setdefault("hooks", []).append(hookobj)
        added.append((event, cmd))


# --- heal ONLY partially-wired hooks --------------------------------------------------
# active = at least one signal present (deployed symlink OR a registration). If BOTH are
# absent the hook was deliberately removed (a browser per-hook toggle-off strips both), so
# it is left off. keyword_active drives whether the companion DATA symlinks are repaired.
keyword_active = False
if settings_readable:
    hooks = settings.setdefault("hooks", {})

for name in hook_files:
    link = os.path.join(hooks_dir, name)
    deployed = os.path.exists(link)          # symlink resolves to a real file
    dangling = os.path.islink(link) and not deployed
    registered = is_registered(name) if settings_readable else None

    if registered:
        active = True
    elif registered is None:
        # settings unreadable: fall back to the on-disk signal (a present-or-dangling
        # symlink means it was installed). No registration changes are possible.
        active = deployed or dangling
    else:
        active = deployed  # registration definitively absent -> active only if deployed

    if not active:
        continue  # deliberately removed / opt-in-off: never resurrect

    if ensure_link(name):
        healed_links.append(name)
    if settings_readable and os.path.exists(link):
        # Only register a path that resolves, so we never re-arm a "No such file" fire.
        add_registrations(name)
    if name == "sidecoach-keyword.sh":
        keyword_active = True

# Companion DATA files: repaired only when the keyword hook that consumes them is active.
if keyword_active:
    for name in data_files:
        if ensure_link(name):
            healed_links.append(name)

# --- write settings once, atomically, iff we added a registration ---------------------
if added:
    write_ok = settings_readable
    try:
        if write_ok and os.path.islink(settings_path):
            rp = os.path.realpath(settings_path)
            repo_rp = os.path.realpath(repo)
            if rp == repo_rp or rp.startswith(repo_rp + os.sep):
                write_ok = False  # a repo-pointing symlink: writing edits the repo's file
    except OSError:
        write_ok = False
    if write_ok:
        try:
            fd, tmp = tempfile.mkstemp(dir=claude, prefix=".settings-heal-", suffix=".tmp")
            with os.fdopen(fd, "w") as f:
                json.dump(settings, f, indent=2)
                f.write("\n")
            os.replace(tmp, settings_path)
        except Exception:
            try:
                os.unlink(tmp)
            except Exception:
                pass
            added = []  # write failed; do not claim we healed the registration
    else:
        added = []  # refused to write (repo symlink / unreadable); do not claim success

# --- 3. report (SessionStart stdout is injected as context) -----------------------
msgs = []
if healed_links:
    msgs.append(
        "re-created missing hook symlink(s): " + ", ".join(healed_links)
        + " (resolvable and firing again this session)"
    )
if added:
    msgs.append(
        "re-added %d missing registration(s) to settings.json "
        "(they take effect from the NEXT session, since the hook registry is cached at start)"
        % len(added)
    )
if msgs:
    print("sidecoach-heal: Sidecoach hook wiring was incomplete and has been repaired - "
          + "; ".join(msgs) + ". No action needed.")
PY
exit 0
