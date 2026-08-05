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
#   --audit-data  list every unmanaged hook COMPANION DATA file and exit 1 if any.
#   --audit-skills list every skill dir install.sh never deploys; exit 1 if any.
#
# WHY --audit-data EXISTS (added 2026-07-27)
# --audit covers claude/hooks/*.sh and nothing else, so an entire class was unguarded:
# the JSON lexicons and config a hook reads at RUNTIME. Shipping the .sh without its
# companion produces a hook that installs, looks present in the browser, and silently
# does nothing - every one of these fails open by design rather than erroring. It has
# now happened twice: route-intent.json (caught by Codex review 2026-07-26) and
# grounding-intent.json, which install.sh never deployed at all. Measured: grounding-gate
# emits 573 bytes of nudge with its lexicon and 0 without.
#
# A companion is MANAGED when browser-tree.json's "hook_data" maps it to an owning hook
# AND install.sh names it. Anything else on disk must be listed in "hook_data_excluded"
# with a stated reason - an exemption without a reason is a place to hide a dead hook.
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
    # NOT EXEMPTING zz-* HERE, and the reason is worth recording because it is the
    # obvious fix and it is wrong (tried and reverted 2026-07-28).
    #
    # The suites create throwaway zz-* hooks - zz-registry-fixture, zz-orphan,
    # zz-broken, zz-never-packaged-xyz, zz-syntax-broken, zz-syntax-fine,
    # zz-apostrophe - and this sweep reads the live directory, so a concurrent suite
    # run makes it catch another process's in-flight fixture and report it as a real
    # unpackaged hook. Exempting the prefix looks like the clean answer.
    #
    # It is not available: test-hook-registry.sh writes those fixtures into the REAL
    # claude/hooks/ and asserts the guard FLAGS them. Exempting zz-* turned 9 of its
    # rows red (67/9), because the prefix that identifies a transient is the same
    # prefix that identifies the suite's detection fixture. No name rule can separate
    # them - they are the same files.
    #
    # What IS closed: the re-stat before reporting in --audit, which covers the case
    # actually observed live (the gate named a path that no longer existed). What is
    # NOT closed: a fixture present for the whole scan is indistinguishable from a real
    # unpackaged hook, and the durable fix for that is in the SUITE - it should build
    # its fixtures in a sandbox repo copy rather than mutating the live tree.
  esac
  # NOT EVENT HOOKS. Each lives in claude/hooks/ and ends in .sh, but none is wired to a
  # Claude Code event, so none has a toggle to own. Each entry states WHY, because an
  # exemption with no reason is just a place to hide an unmanaged hook.
  case "$1" in
    # Shared DEPENDENCY: deployed by install.sh, exec'd BY model-router-guard.sh and
    # frontier-orchestrator-guard.sh. Never wired standalone; off-listing the guard must not
    # strip the guard's own dependency.
    detect-session-model) return 0 ;;
    # Shared DEPENDENCY: the frontier confirm-token consume helper, sourced BY
    # model-router-guard.sh and frontier-orchestrator-guard.sh. Never wired
    # standalone. (frontier-confirm-ARM.sh, by contrast, IS a wired UserPromptSubmit
    # hook and is registered in browser-tree.json - it is not exempt here.)
    frontier-confirm) return 0 ;;
    # LAUNCHD-SCHEDULED, not event-driven: reflect-owned, run from
    # ~/Library/LaunchAgents/com.yesand.beats-reflect-weekly.plist. Appears in no
    # settings.json event, so there is nothing to wire or toggle. Verified 2026-07-16.
    beats-reflect-weekly) return 0 ;;
    # RETIRED, SUPERSEDED: a Stop-shaped hook (reads stdin, exits 1 to block) that was
    # never wired to any settings event, so every machine that installed the
    # question-discipline cluster got it and it did nothing, silently, forever. The live
    # path is multiple-choice-detect-stop.sh + multiple-choice-inject-prompt.sh, created
    # the same day (2026-05-24), wired twice each, and named in CLAUDE.md. install.sh no
    # longer deploys it and the tree no longer registers it. It stays on disk ONLY
    # because test-multiple-choice-enforce.sh still exercises it - delete that coverage
    # and this file should go too, along with this exemption.
    question-enforcement) return 0 ;;
    # RETIRED, SUPERSEDED - the same shape as the entry above, found the same day. The
    # DETECTION TWIN of multiple-choice-detect-stop.sh, whose allowlist exemption claimed
    # it was "invoked by multiple-choice-detect-stop.sh". Measured 2026-07-28: FALSE.
    # detect-stop carries a byte-identical INLINE copy of the detection block and execs
    # nothing, so this file was deployed, wired to nothing, and called by nobody. install.sh
    # no longer deploys it. It stays on disk ONLY because test-multiple-choice-enforce.sh
    # exercises it - delete that coverage and this file should go too, along with this
    # exemption.
    multiple-choice-enforce) return 0 ;;
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

# EVERY answer this guard gives comes out of a python3 pass. Without an interpreter the
# heredocs below exit 127, which the audit contract does not define - and the caller
# (hook-registry-stop.sh) previously read any non-1 code from --audit-data/--audit-skills
# as "contributed nothing", i.e. clean. Missing python3 is squarely "I cannot tell", so
# say that in the contract's own vocabulary (exit 3) rather than leaking a shell code.
# The live PostToolUse path below fails open at 0 instead: it is an advisory write-time
# nudge, and the stop gate is where the loud version of this belongs.
if ! command -v python3 >/dev/null 2>&1; then
  case "${1:-}" in
    --audit|--audit-data|--audit-skills)
      echo "CANNOT-TELL: python3 is not on PATH, so this audit cannot run" >&2
      exit 3
      ;;
    --check) exit 0 ;;
    *) exit 0 ;;
  esac
fi

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
    # RE-STAT BEFORE REPORTING (2026-07-28). The shell glob that built NAMES and this
    # report are not atomic, and several agents run suites concurrently in this repo.
    # test-hook-registry.sh creates and deletes its own fixture hooks inside a run, so
    # this sweep caught another process's in-flight temporary file and reported
    # `zz-registry-fixture` as a real unpackaged hook - blocking a Stop gate over a
    # path that no longer existed. A file that is already gone cannot be an unpackaged
    # hook, so a vanished candidate is dropped rather than named.
    #
    # Deliberately a RE-STAT and not a name-pattern exclusion: guessing which names are
    # "fixtures" would hide a real hook that someone named badly. Existence at report
    # time is the honest question.
    #
    # The churn is reported on STDERR so it is visible to a human without polluting
    # stdout, which callers parse as the findings channel and which must stay empty on
    # a clean run.
    hooks_dir = os.path.join(os.path.dirname(os.environ["TREE"]))
    vanished = [n for n in bad
                if not os.path.exists(os.path.join(hooks_dir, n + ".sh"))]
    if vanished:
        sys.stderr.write(
            "note: %d candidate(s) vanished during the scan and were not reported "
            "(concurrent run?): %s\n" % (len(vanished), ", ".join(sorted(vanished))))
    bad = [n for n in bad if n not in set(vanished)]
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
  --audit-data)
    # Same exit contract as --audit: 0 clean, 1 completed-with-findings, 3 cannot tell.
    # The stop gate reasons about these codes, so a crash must never look like "clean".
    [ -f "$TREE" ] || exit 0          # no tree: not our repo, stay quiet
    [ -f "$INSTALL_SH" ] || exit 0
    HOOKS_DIR="$REPO_DIR/claude/hooks" TREE="$TREE" INSTALL_SH="$INSTALL_SH" python3 - <<'PY'
import json, os, re, sys
try:
    hooks_dir = os.environ["HOOKS_DIR"]
    t = json.load(open(os.environ["TREE"]))
    if not isinstance(t, dict):
        raise ValueError("browser-tree.json is not an object")
    # A tree with NO "hook_data" key has not adopted this registry at all - an older
    # checkout, or a synthetic fixture built to exercise the .sh sweep. Auditing it
    # would report every wiring table in claude/hooks/ as unmanaged, which is noise,
    # and noise is what trains people to ignore a guard. Stay quiet.
    #
    # This is NOT a way to silently disarm the guard in THIS repo: deleting the key
    # here turns test-hook-data-parity.sh red on its "real tree declares hook_data" row.
    if "hook_data" not in t:
        sys.exit(0)
    hook_data = t.get("hook_data") or {}
    excluded = set(t.get("hook_data_excluded") or {})
    src = open(os.environ["INSTALL_SH"]).read()

    # Every companion the registry claims, flattened to a set.
    registered = {}
    for owner, files in hook_data.items():
        for f in files or []:
            registered[f] = owner

    on_disk = sorted(f for f in os.listdir(hooks_dir) if f.endswith(".json"))
    bad = []
    # Direction 1: a data file on disk that is neither registered nor excluded.
    for f in on_disk:
        if f in excluded or f in registered:
            continue
        bad.append("UNMANAGED DATA: %s (no owning hook in browser-tree.json "
                   '"hook_data", and not listed in "hook_data_excluded")' % f)
    # Direction 2: registered, but install.sh never DEPLOYS it - so it never ships.
    #
    # "Named anywhere in install.sh" is far too weak to mean deployed. These filenames
    # ALSO appear in comments and in the DESCS[]/FILES[] strings the component browser
    # shows the user - route-intent.json is in that UI text right now - so a companion
    # could be registered, described to the user, and never copied, with this row green
    # the whole time. Stripping comments was not enough either: the UI strings are code.
    #
    # Look at DEPLOY SITES only: the hook_data_files() table, and any line that actually
    # copies or links a file. Everything else is prose about deployment, not deployment.
    m_tbl = re.search(r'^hook_data_files\(\)\s*\{(.*?)^\}', src, re.S | re.M)
    deploy_src = m_tbl.group(1) if m_tbl else ""
    deploy_src += "\n" + "\n".join(
        ln for ln in src.split("\n")
        if re.search(r'\b(link_or_copy_data|link_or_copy|make_symlink|safe_cp|cp)\b', ln)
        and not re.match(r'\s*#', ln))
    # A component may ship its companions through its OWN loop instead of the table -
    # sidecoach does, naming its registries on a `for registry in ...` line. That is
    # real deployment, so those owners are checked against all non-comment code rather
    # than against deploy-verb lines. It is declared in the tree, not inferred, and the
    # same declaration drives test-hook-data-parity.sh - one exemption, honoured twice.
    bespoke = set(t.get("hook_data_bespoke") or {})
    code_src = "\n".join(re.sub(r'(^|\s)#.*$', r'\1', ln) for ln in src.split("\n"))
    for f, owner in sorted(registered.items()):
        haystack = code_src if owner in bespoke else deploy_src
        if not re.search(r'(?<![\w-])' + re.escape(f) + r'(?![\w-])', haystack):
            bad.append("UNDEPLOYED DATA: %s (owned by %s, but no deploy site in "
                       "install.sh names it - the hook ships without its companion. "
                       "UI text and comments do not count as deployment)" % (f, owner))
    # Direction 3: registered but missing from disk - the installer would warn or
    # silently skip, and the owning hook fails open.
    for f, owner in sorted(registered.items()):
        if not os.path.exists(os.path.join(hooks_dir, f)):
            bad.append("MISSING DATA: %s (owned by %s, registered but not on disk)"
                       % (f, owner))
    # Direction 4: the owning hook itself must exist, or the entry is stale.
    for owner in sorted(hook_data):
        if not os.path.exists(os.path.join(hooks_dir, owner)):
            bad.append("STALE DATA OWNER: %s is in hook_data but the hook file is gone"
                       % owner)
except Exception:
    sys.exit(3)
for line in bad:
    print(line)
sys.exit(1 if bad else 0)
PY
    exit $?
    ;;
  --audit-skills)
    # SKILLS are the other class install.sh enumerates by hand. There is no glob: every
    # skill dir is named explicitly, so a new skill directory ships to NO other machine
    # until someone edits install.sh.
    # Measured 2026-07-27: 18 skill dirs on disk, 16 deployed - `consolidate` and
    # `tilt-lab` had zero mentions in install.sh.
    #
    # Contrast with claude/agents/*.md, which IS deployed by a glob and therefore cannot
    # drift; that is why agents get no audit mode here.
    #
    # THIS CHECK SILENTLY ROTTED THROUGH A RENAME (fixed 2026-07-28). It matched
    # `copy_bundled_skill <name>`, and that function has not existed for some time - it
    # is `install_bundled_skill` now, with ZERO occurrences of the old name in
    # install.sh. Nothing was watching the coupling between this regex and the
    # installer's actual API, so the branch was dead and no test noticed.
    #
    # The consequence was worse than a dead branch, because the modern bundle path is a
    # LOOP PASSING A VARIABLE:
    #     for _skill in tactical-polish ... voice-output; do install_bundled_skill "$_skill"; done
    # which this check missed on BOTH counts - wrong function name, and a variable
    # rather than a literal. Any skill deployed only through that loop was reported as
    # never deployed. It did exactly that for `sidecoach` and `voice-output`, both of
    # which ARE deployed, and an agent nearly added a redundant deploy line to satisfy
    # a blind check.
    #
    # So this now resolves the shapes it CAN prove, and says CANNOT TELL for the rest
    # rather than manufacturing a confident finding. A false negative dressed as a
    # finding is worse than an admitted gap - the same distinction --audit already
    # draws with its exit 3.
    [ -f "$INSTALL_SH" ] || exit 0
    [ -d "$REPO_DIR/claude/skills" ] || exit 0
    SKILLS_DIR="$REPO_DIR/claude/skills" INSTALL_SH="$INSTALL_SH" python3 - <<'PY'
import os, re, sys
try:
    d = os.environ["SKILLS_DIR"]
    src = open(os.environ["INSTALL_SH"]).read()
    names = sorted(n for n in os.listdir(d) if os.path.isdir(os.path.join(d, n)))

    # Join backslash line continuations first: the bundle loop's word list spans three
    # physical lines, and an unjoined scan sees only its first third.
    joined = re.sub(r'\\\n[ \t]*', ' ', src)
    # Comments do not deploy anything. Mirrors the deploy_src/code_only treatment the
    # data audit above already uses, so a commented-out call cannot read as shipping.
    code = "\n".join(re.sub(r'(^|\s)#.*$', r'\1', ln) for ln in joined.split("\n"))

    deployed = set()
    unresolved = []

    # Every `for VAR in <words>` header WITH ITS POSITION. A variable argument then
    # resolves against the NEAREST PRECEDING header for its own name, not against the
    # first one anywhere in the file (Codex review 2026-07-28): reusing a loop variable
    # in two loops otherwise resolved a call against the wrong word list and invented
    # deployed entries.
    def _body_end(start):
        # Where this loop's body ends, by balancing do/done from the header. Needed
        # because "nearest preceding header" alone does not prove the call is INSIDE
        # the loop (Codex review 2026-07-28): a call after `done` would otherwise
        # resolve to that loop's whole word list, while the shell would use only
        # whatever the variable held at that point.
        depth = 0
        for tm in re.finditer(r'(?<![\w-])(do|done)(?![\w-])', code[start:]):
            if tm.group(1) == "do":
                depth += 1
            else:
                depth -= 1
                if depth == 0:
                    return start + tm.end()
        return len(code)

    headers = [(m.start(), m.group(1), m.group(2), _body_end(m.start()))
               for m in re.finditer(
                   r'(?<![\w-])for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([^\n;]*?)\s*(?:;|\n)\s*do',
                   code)]

    # The argument must be EXACTLY a bare variable reference to be resolvable. Anything
    # composed ("${_skill}-extra", "$(cmd)", "pre$x") is not statically knowable and
    # must fall through to CANNOT TELL. The capture below deliberately does not exclude
    # `}`, because stopping at it truncated "${_skill}-extra" to "${_skill" and then
    # resolved it as the bare variable - silently dropping the suffix and marking the
    # loop's words deployed when nothing of the sort had been proven.
    # Balanced forms only: `$name` or `${name}`. `$name}` and `${name` are composed
    # text, not a bare reference, and must not resolve (Codex review 2026-07-28).
    SIMPLE_VAR = re.compile(r'^(?:\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([A-Za-z_][A-Za-z0-9_]*)\})$')

    for call in re.finditer(r'(?<![\w-])install_bundled_skill\s+([^\s;)&|]+)', code):
        raw = call.group(1)
        # SINGLE QUOTES SUPPRESS EXPANSION. `install_bundled_skill '$_skill'` passes the
        # literal characters "$_skill", so treating it as a variable would mark a whole
        # loop word list deployed on the strength of an argument that names none of it -
        # a false "deployed", which HIDES an unpackaged skill rather than inventing one.
        if raw.startswith("'"):
            deployed.add(raw.strip("'"))
            continue
        arg = raw.strip('"')
        if "$" not in arg:
            deployed.add(arg)
            continue
        sv = SIMPLE_VAR.match(arg)
        if not sv:
            unresolved.append(arg)
            continue
        var = sv.group(1) or sv.group(2)
        prior = [h for h in headers
                 if h[1] == var and h[0] < call.start() < h[3]]
        if not prior:
            unresolved.append(arg)
            continue
        words = prior[-1][2].split()
        # A word list that is itself computed (an array expansion, a substitution) is
        # not statically knowable. Say so instead of guessing.
        if any(("$" in w) or ("`" in w) for w in words):
            unresolved.append(arg)
        else:
            deployed.update(words)

    # KNOWN RESIDUAL, stated rather than hidden (Codex review 2026-07-28, Medium).
    # This path fallback matches `claude/skills/<name>` anywhere in non-comment code,
    # which includes installer UI strings (the FILES+=(...) manifests). A skill
    # mentioned ONLY in such a string would read as deployed.
    #
    # It is kept because the path form is a REAL deploy shape here, not a legacy one:
    # `lotus` ships through `_vd_src="$REPO_DIR/claude/skills/lotus/SKILL.md"` and is
    # covered by nothing else, so requiring a deploy verb would report a live skill as
    # unpackaged - the exact false accusation this whole repair exists to end.
    #
    # The severity is asymmetric and that is why this residual is acceptable while the
    # earlier one was not: this direction can only MISS a finding (a false negative),
    # whereas the copy_bundled_skill drift MANUFACTURED findings against skills that
    # ship fine, which is what nearly drove a wrong fix into install.sh.
    bad = [n for n in names
           if n not in deployed
           and not re.search(r'claude/skills/' + re.escape(n) + r'(?![\w-])', code)]

    # RE-STAT BEFORE REPORTING. The listdir above and this report are not atomic, and
    # several agents run suites concurrently in this repo. A directory that has already
    # vanished cannot be an unpackaged skill.
    bad = [n for n in bad if os.path.isdir(os.path.join(d, n))]
except Exception:
    sys.exit(3)

# An unresolvable call means the deploy set is INCOMPLETE, so "not in deployed" stops
# being evidence of anything. Report the gap, name nothing, exit 3.
if unresolved and bad:
    print("CANNOT TELL (skills): install.sh calls install_bundled_skill with an "
          "argument this check cannot resolve statically (%s), so the deployed set is "
          "incomplete and these skills cannot be judged: %s"
          % (", ".join(sorted(set(unresolved))), ", ".join(bad)))
    sys.exit(3)
for n in bad:
    print("UNMANAGED SKILL: %s (claude/skills/%s exists but install.sh never "
          "deploys it - it ships to no other machine)" % (n, n))
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

# SYNTAX GATE - runs FIRST, and on every hook file including tests and libs.
#
# A hook in claude/hooks/ is SYMLINKED live into ~/.claude/hooks/, so it has no
# staging area: a half-written edit is in production the instant it is saved. On
# 2026-07-28 a stray apostrophe inside a `python3 -c '...'` block closed the quote 184
# lines early, and because the broken file was a PostToolUse Bash hook, EVERY Bash call
# in EVERY session on this machine started failing. Three sibling agents hit it
# independently. Worse for the measurement: a broken hook emits an identical shell
# error for every input, so a probe reading "any output" as a fire sees 100% fire rate
# in BOTH directions - the failure actively manufactures wrong efficacy numbers.
#
# Nothing gated it. The registry guard checked whether a hook was PACKAGED but never
# whether it PARSED. Now it does, before anything else, and blocks loudly.
case "$path" in
  */claude/hooks/*.sh|*/claude/hooks/*.py)
    if [ -f "$path" ]; then
      _syn=""
      case "$path" in
        *.sh) _syn="$(bash -n "$path" 2>&1)" || _bad=1 ;;
        *.py) _syn="$(python3 -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$path" 2>&1)" || _bad=1 ;;
      esac
      if [ "${_bad:-0}" = "1" ]; then
        {
          echo "BLOCKED: $(basename "$path") does not parse. It is symlinked live into"
          echo "~/.claude/hooks/, so this broken file is ALREADY the hook the harness runs -"
          echo "if it is wired to Bash or UserPromptSubmit, every call in every session on"
          echo "this machine is failing right now. Fix it or restore it immediately."
          echo ""
          printf '%s\n' "$_syn" | head -5
          echo ""
          echo "Mid-rewrite on a symlinked hook: edit a scratch copy and mv it into place"
          echo "once it parses, so a partial edit is never live. For an embedded python"
          echo "block prefer a QUOTED heredoc (python3 <<'PY' ... PY) over python3 -c '...':"
          echo "the heredoc body is opaque to the shell, so an apostrophe in the python"
          echo "source cannot terminate it."
        } >&2
        exit 2
      fi
    fi
    ;;
esac

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
