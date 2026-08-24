#!/usr/bin/env bash
# test-component-browser.sh - unit tests for the bucket browser pure functions.
set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TREE="$REPO_DIR/claude/hooks/browser-tree.json"
# install.sh is READ (never run) by the installer<->tree completeness check below: the
# `picked X && install_app_hooks ...` lines are the installer's declaration of which hooks
# each component owns, and that is the only source the tree can be checked against.
INSTALL="$REPO_DIR/install.sh"
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1"; fail=$((fail+1)); }

# 1. tree is valid JSON
python3 -c "import json;json.load(open('$TREE'))" 2>/dev/null && ok "tree valid json" || bad "tree valid json"

# 2. every install.sh KEY appears in one bucket member set (completeness)
python3 - "$REPO_DIR" "$TREE" <<'PY' && ok "every component bucketed" || bad "every component bucketed"
import json,re,sys,os
repo,tree=sys.argv[1],sys.argv[2]
t=json.load(open(tree))
members=set()
def walk(m):
    members.add(m["key"])
    for c in m.get("members",[]): walk(c)
for b in t["buckets"]: walk(b)
src=open(os.path.join(repo,"install.sh")).read()
keys=set()
for line in re.findall(r'KEYS\+?=\(([^)]*)\)',src):
    keys.update(w for w in line.split() if w and not w.startswith('"'))
missing=[k for k in keys if k not in members and k!="skills"]
print("missing:",missing,file=sys.stderr)
sys.exit(0 if not missing else 1)
PY

# 3. every hook named in the tree has a description
python3 - "$TREE" <<'PY' && ok "every hook described" || bad "every hook described"
import json,sys
t=json.load(open(sys.argv[1])); hd=t.get("hook_desc",{}); missing=set()
def walk(m):
    for h in m.get("hooks",[]):
        if not hd.get(h): missing.add(h)
    for c in m.get("members",[]): walk(c)
for b in t["buckets"]: walk(b)
print("missing hook desc:",sorted(missing),file=sys.stderr)
sys.exit(0 if not missing else 1)
PY

# 3b. NO TEST IN THIS FILE MAY NAME A PATH THAT DOES NOT EXIST IN THE TREE.
#
# This guards the suite against ITSELF, and it is not hypothetical - it caught four live
# cases the moment it was written (2026-07-17). When sidecoach/justify/voice-output/cmux
# gained component leaves, their hooks moved from `justify/<hook>` down to
# `justify/Hooks/<hook>`. Four tests kept staging the OLD path and KEPT PASSING, because
# every consumer of a bogus path degrades quietly rather than erroring:
#   - stage_toggle/stage_all happily stage a path nothing will ever look up;
#   - pending_under counts via leaf_paths, which never yields the bogus path, so the
#     "stage_all clears opposite pending" assertion read 0 and passed while proving nothing;
#   - _owner_of on `justify/justify-source-guard` returns the HOOK NAME as the owner
#     (its parent is a group, not a hooks node), so apply_plan emits nothing at all.
# A green suite asserting against paths that do not exist is worse than a red one. This is
# the same failure family as the tree that LIED about sidecoach's hook count: a check that
# only ever compares the suite to its own assumptions can never see the data move.
#
# Deliberately literal-only: paths built from variables ("$_p/$_k") are skipped, since the
# accessor assertions around them already prove those resolve.
python3 - "$TREE" "${BASH_SOURCE[0]}" <<'PY' && ok "every path literal in this suite exists in the tree" || bad "every path literal in this suite exists in the tree"
import json,re,sys
tree,testfile=sys.argv[1],sys.argv[2]
t=json.load(open(tree))

valid=set()
def walk(n,path):
    valid.add(path)
    if n.get("members") is not None:
        for c in n["members"]: walk(c,path+"/"+c["key"])
    for h in n.get("hooks",[]) or []:
        valid.add(path+"/"+h)
for b in t["buckets"]: walk(b,b["key"])

# Comment lines are stripped FIRST. Without this the scanner reads the prose above -
# including this block's own `INSTALLED="|a|b|"` example - and reports 'a' and 'b' as
# missing tree paths. Both shell and python comments start with #, and the whole file
# (heredocs included) is one flat read here, so one filter covers both. Inline trailing
# comments are NOT stripped, which is deliberate: a quoted path inside one would have to
# be a real path anyway, and a blunter strip would eat `'#'` inside legitimate strings.
src="\n".join(l for l in open(testfile).read().splitlines() if not l.lstrip().startswith("#"))

# TWO CLASSES, CHECKED SEPARATELY - a single merged set with a "bare keys are fine"
# escape hatch is NOT sound (caught in cross-model review 2026-07-17). PATH_FNS take a
# full node/leaf path; KEY_FNS take an install-owner KEY. Merging them forced a blanket
# exemption for any literal without a "/", which silently accepted
# `stage_toggle 'justify-source-guard'` - a bogus PATH whose final segment happens to be
# a real leaf key. That is exactly the stale-path bug this guard exists to catch, so the
# exemption had a hole shaped like the bug.
PATH_FNS=("stage_toggle","stage_all","item_state","pending_under","counts","leaf_paths",
          "node_kind","node_children","node_label","node_tag","node_desc")
KEY_FNS=("_owner_leaf_path","hook_owner","hooks_owned_by","hook_pinned")

bad=[]
cited_paths=set()
for fn in PATH_FNS:
    for m in re.finditer(r"\b%s\s+'([^'$]+)'" % fn, src):
        cited_paths.add(m.group(1))
# Every entry of a literal INSTALLED="|a|b|" fixture is a leaf PATH.
for m in re.finditer(r'INSTALLED="\|([^"$]*)\|"', src):
    for p in m.group(1).split("|"):
        if p: cited_paths.add(p)
for p in sorted(cited_paths):
    if p not in valid:
        bad.append("cites a path absent from the tree: %r" % p)

# Owner keys: every leaf key plus every hooks-node owner (clusters and pure-hook apps have
# no leaf, so their key never appears in `valid` as a leaf path).
validkeys={p.rsplit("/",1)[-1] for p in valid} | set(t.get("hook_owner",{}).values())
for fn in KEY_FNS:
    for m in re.finditer(r"\b%s\s+'([^'$]+)'" % fn, src):
        k=m.group(1)
        if k not in validkeys:
            bad.append("cites an owner key absent from the tree: %r (via %s)" % (k,fn))

for b in bad: print("  "+b, file=sys.stderr)
sys.exit(0 if not bad else 1)
PY

# ---- accessor tests (Task 2) ----
source "$REPO_DIR/claude/hooks/browser-lib.sh"
browser_load "$TREE"
[ "$(browser_buckets)" = "Foundation Beats sidecoach justify tilt-lab lotus Design Tools Guardrails Voice & chat Dev surface Personal" ] \
  && ok "bucket order (keys)" || bad "bucket order (keys)"
[ "$(node_kind 'Beats')" = "group" ] && ok "Beats is group" || bad "Beats is group"
[ "$(node_kind 'sidecoach')" = "group" ] && ok "sidecoach is group" || bad "sidecoach is group"
[ "$(node_kind 'tilt-lab')" = "leaf" ] && ok "tilt-lab is leaf" || bad "tilt-lab is leaf"
[ "$(node_kind 'Beats/Hooks')" = "hooks" ] && ok "Beats/Hooks is hooks" || bad "Beats/Hooks is hooks"
[ "$(node_children 'Beats')" = "memory reflect Hooks" ] && ok "Beats children" || bad "Beats children"
# THE FOUR PAYLOAD COMPONENTS ARE GROUPS, NOT BARE HOOK FOLDERS (2026-07-17).
# sidecoach/justify/voice-output/cmux each own a real non-hook payload (detect_component
# checks a skill file / installed dir / settings symlink), so each renders as a group:
# its component LEAF is the master switch, its hooks live in a Hooks folder underneath.
# Before this, the bucket WAS the hook folder: it offered only "Enable/Disable all X
# hooks..." and no install/uninstall affordance for the component at all, while
# "Disable all X hooks" silently emitted a full UNINSTALL_COMPONENT via apply_plan
# rule 3. The leaf is what makes rule 3's `[ -z "$lp" ]` false and the labels true.
# The doubled path segment (sidecoach/sidecoach) is REQUIRED, not cosmetic: _real_probe
# calls detect_component "${path##*/}" and _owner_leaf_path is keyed by leaf key, so the
# leaf key must equal the installer's --only key.
[ "$(node_children 'sidecoach')" = "sidecoach Hooks" ] \
  && ok "sidecoach children (leaf + Hooks)" || bad "sidecoach children (got '$(node_children 'sidecoach')')"
[ "$(node_kind 'sidecoach/sidecoach')" = "leaf" ] && ok "sidecoach component leaf" || bad "sidecoach component leaf"
# All NINE sidecoach hooks, in the order install_app_hooks deploys them.
# sidecoach-craft-floor is a PreToolUse floor (2026-07-29) that loads the standing
# craft minimum before a UI write, on its own 15-minute per-project cooldown. The tree used to
# list only 2 of the 6 the installer actually deploys and wires, so the browser rendered
# "2/2 active" for a component with 6 managed hooks and gave no toggle for the other 4.
# sidecoach-heal is the SessionStart self-heal (2026-08-22): it reasserts sidecoach's own
# symlinks + registrations every session so a stripped registration or a missing symlink
# repairs itself. Default-ON, so it sits before sidecoach-detect in the deploy order.
# sidecoach-detect is the opt-in per-edit scanner (Stage 3b): fully packaged but shipped OPT-IN
# via the default off-list seed in install.sh, so the browser shows and can toggle it while a
# plain install leaves the per-edit scan unwired.
[ "$(node_children 'sidecoach/Hooks')" = "sidecoach-sessionstart sidecoach-preamble sidecoach-postuserp sidecoach-keyword sidecoach-taste-gate sidecoach-orchestrate-edit sidecoach-qa-gate-stop qa-gate-manual sidecoach-craft-floor sidecoach-postresponse sidecoach-heal sidecoach-detect sidecoach-taste-promote-arm" ] \
  && ok "sidecoach hook children" || bad "sidecoach hook children (got '$(node_children 'sidecoach/Hooks')')"
# Every payload component has the same shape, and each leaf resolves as its owner's
# master switch. A regression here is what re-hides the install affordance.
for _c in "sidecoach:sidecoach" "justify:justify" "Voice & chat/voice-output:voice-output" "Dev surface/cmux:cmux"; do
  _p="${_c%:*}"; _k="${_c##*:}"
  [ "$(node_kind "$_p")" = "group" ] && ok "$_k bucket is a group" || bad "$_k bucket is a group"
  [ "$(node_children "$_p")" = "$_k Hooks" ] && ok "$_k children (leaf + Hooks)" || bad "$_k children (got '$(node_children "$_p")')"
  [ "$(_owner_leaf_path "$_k")" = "$_p/$_k" ] && ok "$_k owner leaf path" || bad "$_k owner leaf path (got '$(_owner_leaf_path "$_k")')"
done
[ "$(node_label 'sidecoach')" = "Sidecoach" ] && ok "sidecoach label" || bad "sidecoach label"
[ "$(node_label 'Beats')" = "Beats" ] && ok "Beats label falls back to key" || bad "Beats label falls back to key"
[ -n "$(node_tag 'Beats')" ] && ok "node tag present" || bad "node tag present"
[ -n "$(hook_desc 'beats-rebuild')" ] && ok "hook desc" || bad "hook desc"
[ "$(bucket_section 'Foundation')" = "core" ] && ok "Foundation section core" || bad "Foundation section core"
[ "$(bucket_section 'Guardrails')" = "more" ] && ok "Guardrails section more" || bad "Guardrails section more"

# ---- status + rollup tests (Task 3) ----
# inject a deterministic probe: a leaf is "installed" iff its path is in INSTALLED
BR_STATE_PROBE='fake_probe'
fake_probe(){ case "$INSTALLED" in *"|$1|"*) return 0;; *) return 1;; esac; }
INSTALLED="|Beats/memory|Beats/Hooks/memory-approve|Beats/Hooks/memory-nudge|"
[ "$(item_state 'Beats/Hooks/memory-approve')" = "active" ] && ok "leaf active" || bad "leaf active"
[ "$(item_state 'Beats/Hooks/reflect-nudge')" = "none" ] && ok "leaf none" || bad "leaf none"
[ "$(item_state 'Beats/Hooks')" = "partial" ] && ok "hooks folder partial" || bad "hooks folder partial"
# pinned hooks count as always-on (beats-rebuild + beats-staleness-guard), so on = 2 probe + 2 pinned.
[ "$(counts 'Beats/Hooks')" = "4/7" ] && ok "hooks folder counts" || bad "hooks folder counts"
[ "$(item_state 'Beats')" = "partial" ] && ok "group partial" || bad "group partial"
# on = memory leaf + memory-approve + memory-nudge (probe) + 2 pinned = 5 of 9.
[ "$(counts 'Beats')" = "5/9" ] && ok "group counts" || bad "group counts"
INSTALLED_ALL=""
while IFS= read -r p; do INSTALLED_ALL="$INSTALLED_ALL|$p|"; done < <(leaf_paths 'Beats/Hooks')
INSTALLED="$INSTALLED_ALL"
[ "$(item_state 'Beats/Hooks')" = "active" ] && ok "hooks folder all active" || bad "hooks folder all active"
# with nothing installed, the 2 pinned hooks force Beats/Hooks to read partial, never none.
INSTALLED="||"
[ "$(item_state 'Beats/Hooks')" = "partial" ] && ok "hooks folder pinned-partial" || bad "hooks folder pinned-partial"
# a genuinely none rollup needs a pinned-free folder: sidecoach (2 hooks, no pinned).
[ "$(item_state 'sidecoach')" = "none" ] && ok "pinned-free folder none" || bad "pinned-free folder none"
unset BR_STATE_PROBE

# ---- owner + pinned tests (Task 3.5) ----
[ "$(hook_owner 'bash-guard')" = "safety" ] && ok "cluster hook owner" || bad "cluster hook owner"
[ "$(hook_owner 'justify-source-guard')" = "justify" ] && ok "app hook owner" || bad "app hook owner"
[ "$(hook_owner 'memory-approve')" = "memory" ] && ok "beats memory-hook owner" || bad "beats memory-hook owner"
[ "$(hook_owner 'reflect-nudge')" = "reflect" ] && ok "beats reflect-hook owner" || bad "beats reflect-hook owner"
hook_pinned 'beats-rebuild' && ok "beats-rebuild pinned" || bad "beats-rebuild pinned"
hook_pinned 'beats-staleness-guard' && ok "beats-staleness pinned" || bad "beats-staleness pinned"
hook_pinned 'memory-approve' && bad "memory-approve NOT pinned" || ok "memory-approve NOT pinned"
# default_off is a SEPARATE property from pinned (see hook_default_off in browser-lib.sh):
# sidecoach-detect is default_off but NOT pinned (still owned/toggleable), and no pinned hook
# is default_off. The predicate must read the encoded BR_DEFAULTOFF_<hex> flag emitted from
# the tree's default_off_hooks list.
hook_default_off 'sidecoach-detect' && ok "sidecoach-detect default_off" || bad "sidecoach-detect default_off"
hook_default_off 'sidecoach-preamble' && bad "sidecoach-preamble NOT default_off" || ok "sidecoach-preamble NOT default_off"
hook_default_off 'memory-approve' && bad "memory-approve NOT default_off" || ok "memory-approve NOT default_off"
hook_pinned 'sidecoach-detect' && bad "sidecoach-detect NOT pinned (default_off != pinned)" || ok "sidecoach-detect NOT pinned (default_off != pinned)"
# a pinned hook reads as always active regardless of the probe
BR_STATE_PROBE='fake_probe'; INSTALLED="||"   # nothing installed
[ "$(item_state 'Beats/Hooks/beats-rebuild')" = "active" ] && ok "pinned hook always active" || bad "pinned hook always active"
[ "$(item_state 'Beats/Hooks/memory-approve')" = "none" ] && ok "unpinned hook follows probe" || bad "unpinned hook follows probe"
unset BR_STATE_PROBE
# every non-pinned hook in the tree has an owner that is a real install/cluster key
python3 - "$TREE" <<'PY' && ok "every hook has owner" || bad "every hook has owner"
import json,sys
t=json.load(open(sys.argv[1])); ho=t.get("hook_owner",{}); pinned=set(t.get("pinned_hooks",[]))
hooks=set()
def walk(m):
    for h in m.get("hooks",[]): hooks.add(h)
    for c in m.get("members",[]): walk(c)
for b in t["buckets"]: walk(b)
missing=[h for h in hooks if h not in ho]
print("missing owner:",missing,file=sys.stderr)
sys.exit(0 if not missing else 1)
PY

# INSTALLER <-> TREE COMPLETENESS, BOTH DIRECTIONS.
#
# THIS IS THE TEST THAT SHOULD HAVE CAUGHT THE SIDECOACH GAP AND DID NOT. Everything above
# only checks the tree against ITSELF (every hook has a desc, every hook has an owner). A
# tree that simply OMITS hooks the installer deploys passes all of it - which is exactly
# what happened: the tree claimed sidecoach owned 2 hooks while the installer deployed and
# wired 6, and cmux's tree omitted resume-toggle + teammate-relay-stop. The browser then
# renders "2/2 active" for a component that really has 6 managed hooks - a status row
# stating something untrue, and 4 hooks with no toggle at all.
#
# The invariant is now STRUCTURAL, derived from install.sh itself rather than restated by
# hand: every app hook deploys through a `picked <owner> && install_app_hooks <hooks...>`
# line, so that line IS the installer's truth and this test reads it directly. Both
# directions are checked, because each catches a different lie:
#   installer -> tree : a hook that installs but has no toggle (the sidecoach gap)
#   tree -> installer : a toggle for a hook that never installs (a row that lies)
#
# EXEMPT, deliberately: pinned hooks (beats-rebuild, beats-staleness-guard) appear in the
# tree as always-on but are NOT globally installed - they are improv-repo-specific and
# wired project-scoped in the repo's own .claude/settings.json
# (decision_beats_hooks_stay_project_scoped.md). Cluster hooks are exempt from the
# install_app_hooks half: they deploy through the cluster pass + cluster-wirings.json.
python3 - "$TREE" "$INSTALL" <<'PY' && ok "installer and tree agree on every app hook (both directions)" || bad "installer and tree agree on every app hook (both directions)"
import json,re,sys
t=json.load(open(sys.argv[1])); src=open(sys.argv[2]).read()
pinned=set(t.get("pinned_hooks",[])); ho=t.get("hook_owner",{})

truth={}
for m in re.finditer(r'^picked (\S+)\s+&& install_app_hooks (.+)$', src, re.M):
    truth.setdefault(m.group(1), set()).update(h[:-3] for h in m.group(2).split() if h.endswith(".sh"))
if not truth:
    print("no `picked X && install_app_hooks` lines found - the invariant cannot be derived, "
          "so this test proves NOTHING. install.sh changed shape; fix this test.", file=sys.stderr)
    sys.exit(1)

# A hook is only genuinely "registered" for owner O when the user can SEE and CONTROL it on
# O's own screen, which takes all THREE tree surfaces - and they are independent, so any one
# can rot alone:
#   hook_owner   -> apply_plan routing (which owner a toggle belongs to)
#   `hooks` list -> the toggle rendered on O'S OWN screen (PLACEMENT matters, see below)
#   hook_desc    -> the label printed beside that toggle
# The old check compared install.sh to hook_owner ALONE and called a miss "no toggle" - a
# proxy, not the truth. figma-fidelity-arm was missing from all three AND install.sh installs
# it (2026-07-17, GUI-installer final review) - the exact drift this now names per-surface.
#
# The toggle check is PLACEMENT-AWARE, not a global "is it in SOME list anywhere": a hook
# listed under the wrong owner's node still routes via hook_owner yet renders in the wrong
# bucket and skews that bucket's rollups and "disable all" scope (folded from the cross-model
# review of this change, 2026-07-17). `placed[h]` is the set of owner-contexts of the nodes h
# is listed under: a named-key hooks node (figma, safety, codex, ...) owns ITSELF; a shared
# "Hooks" child owns the installable leaves beside it - which is why Beats' single "Hooks"
# node legitimately serves BOTH memory and reflect and must not be flagged.
# `placed[h]` collects the owner-contexts of the node(s) h is listed under, for the OMISSION
# check below (an installed hook that renders on no owner's screen). `misplaced` is the
# complementary PER-OCCURRENCE guard: because placed[h] is a union, `owner in placed[h]` alone
# would still pass if h were listed correctly under its owner AND duplicated under a wrong one,
# leaving a stray toggle on the wrong screen. So every listed occurrence is validated where it
# sits - hook_owner[h] must belong to that exact node's valid-owner set (both folded from the
# cross-model review of this change, 2026-07-17).
hd=t.get("hook_desc",{})
placed={}; misplaced=[]
def _place(n, parent):
    hooks=n.get("hooks")
    if hooks:
        valid={n["key"]} if n["key"]!="Hooks" else {c["key"] for c in (parent or {}).get("members",[]) or [] if c.get("kind")=="leaf"}
        loc=n["key"] if n["key"]!="Hooks" else f"{(parent or {}).get('key')}/Hooks"
        for h in hooks:
            placed.setdefault(h,set()).update(valid)
            o=ho.get(h)
            if o is not None and o not in valid:
                misplaced.append(f"{h}: listed under {loc} (owned by {sorted(valid)}) but hook_owner routes it to {o} - a toggle on the wrong screen")
    for c in n.get("members",[]) or []: _place(c, n)
for b in t["buckets"]: _place(b, None)

routed={}
for h,o in ho.items():
    if h not in pinned: routed.setdefault(o,set()).add(h)

bad=list(misplaced)
for owner,inst in truth.items():
    have=routed.get(owner,set())
    for h in sorted(inst):
        miss=[]
        if h not in have:                    miss.append(f"no hook_owner->{owner} entry")
        if owner not in placed.get(h,set()): miss.append(f"no toggle on {owner}'s screen (not in a `hooks` node owned by {owner})")
        if h not in hd:                      miss.append("no hook_desc label")
        if miss:
            bad.append(f"{owner}: install_app_hooks deploys {h} but the tree gives it " + "; ".join(miss))
    for h in sorted(have-inst):
        bad.append(f"{owner}: tree routes {h} to {owner} but install_app_hooks never deploys it")
for b in bad: print("  "+b, file=sys.stderr)
sys.exit(0 if not bad else 1)
PY

# INSTALL AND DEACTIVATE MUST NAME THE SAME HOOKS. install.sh both installs (`picked X &&
# install_app_hooks ...`) and removes (`deactivate_X() { deactivate_app_hooks ...; }`) a
# component's hooks; if the two lists drift, a hook either leaks (installed, never removed)
# or is dead copy (removed, never installed). This is the SIBLING of the tree drift above and
# the reason the figma miss was easy to make: the two install.sh sites were kept in sync with
# each other (both list stop + arm) while the tree - a third site - was not. Scope: the
# single-line `deactivate_X()` functions, which are exactly the pure-hook components
# (clickup/visualizer/codex/chrome/figma). The multi-line deactivate arms (memory/voice/
# justify/cmux) are deliberately out of scope - they interleave non-hook teardown and voice
# removes only a subset on purpose - so this check reads them line-by-line and matches only
# the complete one-liners, never a fragment of a multi-line body.
python3 - "$INSTALL" <<'PY' && ok "install and deactivate name the same hooks (one-liner app components)" || bad "install and deactivate name the same hooks (one-liner app components)"
import re,sys
src=open(sys.argv[1]).read()
inst={}
for m in re.finditer(r'^picked (\S+)\s+&& install_app_hooks (.+)$', src, re.M):
    inst.setdefault(m.group(1), set()).update(h[:-3] for h in m.group(2).split() if h.endswith(".sh"))
# Per-LINE match (not a multiline regex, whose `[^;]+` would swallow a whole multi-line body
# up to some far-off semicolon). Capture the hook args with `[^;]+` so it stops at the FIRST
# semicolon - deactivate_app_hooks's own terminator - and never past it: deactivate_codex has
# a second statement (`; rm_hook_if_ours codex-review.py`), and any capture that ran past that
# `;` would glue it onto the last hook token (`codex-rescue-guard.sh;`), silently dropping it
# from the .sh-filtered set. The trailing `\}\s*$` still requires a genuine one-liner, so a
# fragment of a multi-line function (no closing brace on the line) never matches.
deact={}
for line in src.splitlines():
    m=re.match(r'\s*deactivate_(\w+)\(\)\s*\{\s*deactivate_app_hooks\s+([^;]+);.*\}\s*$', line)
    if m:
        deact[m.group(1)]=set(h[:-3] for h in m.group(2).split() if h.endswith(".sh"))
if not deact:
    print("no one-liner `deactivate_X() { deactivate_app_hooks ...; }` found - install.sh "
          "changed shape; this test now proves NOTHING. fix it.", file=sys.stderr)
    sys.exit(1)
bad=[]
for owner,drop in deact.items():
    add=inst.get(owner,set())
    for h in sorted(add-drop): bad.append(f"{owner}: install_app_hooks deploys {h} but deactivate_{owner} never removes it (leak)")
    for h in sorted(drop-add): bad.append(f"{owner}: deactivate_{owner} removes {h} but install_app_hooks never deploys it (dead)")
for b in bad: print("  "+b, file=sys.stderr)
sys.exit(0 if not bad else 1)
PY

# DETECT AND INSTALL MUST NAME THE SAME HOOKS. `detect_component` decides active/not-installed;
# for a pure-hook app component it does so by probing its hooks with is_our_hook. If that probe
# lists fewer hooks than install_app_hooks deploys, a component with only its OTHER hooks still
# on reads not-installed and the status/update logic skips it. This is the THIRD site of the
# same figma drift (the tree and this detect case both trailed install_app_hooks when arm was
# added): detect figma checked only figma-fidelity-stop, so toggling stop off while arm stayed
# on read not-installed. codex/chrome already OR over their full set; this holds every such
# case to it. Scope: only case arms that actually call is_our_hook (dir-probe and cluster arms
# have no hook list to compare and are correctly skipped).
python3 - "$INSTALL" <<'PY' && ok "detect_component and install name the same hooks (is_our_hook app components)" || bad "detect_component and install name the same hooks (is_our_hook app components)"
import re,sys
src=open(sys.argv[1]).read()
inst={}
for m in re.finditer(r'^picked (\S+)\s+&& install_app_hooks (.+)$', src, re.M):
    inst.setdefault(m.group(1), set()).update(h[:-3] for h in m.group(2).split() if h.endswith(".sh"))
# Case arms that probe hooks: `<key>) ...is_our_hook A.sh... is_our_hook B.sh... ;;`. is_our_hook
# appears only inside detect_component's switch, so a line-level match is unambiguous.
det={}
for line in src.splitlines():
    m=re.match(r'\s*([a-z0-9-]+)\)\s.*\bis_our_hook\b', line)
    if m:
        hs=re.findall(r'is_our_hook\s+(\S+\.sh)', line)
        if hs: det[m.group(1)]=set(h[:-3] for h in hs)
if not det:
    print("no `<key>) ... is_our_hook ...` detect arms found - install.sh changed shape; fix this test.", file=sys.stderr)
    sys.exit(1)
bad=[]
for key,probe in det.items():
    want=inst.get(key,set())
    if not want: continue  # a detect arm for something install_app_hooks does not deploy - other checks own that
    for h in sorted(want-probe): bad.append(f"{key}: install_app_hooks deploys {h} but detect_component never probes it (partial state reads not-installed)")
    for h in sorted(probe-want): bad.append(f"{key}: detect_component probes {h} but install_app_hooks never deploys it")
for b in bad: print("  "+b, file=sys.stderr)
sys.exit(0 if not bad else 1)
PY

# A COUNT WRITTEN INTO PROSE MUST MATCH THE NODE. Twice in one build a hardcoded number
# went stale the moment the data moved: cmux's desc still read "The 6 hooks cmux installs"
# after the node grew to 8. The rendered count beside it was right, so the screen disagreed
# with itself. This greps the descriptions for the generated "The N hooks <X> installs"
# shape and checks N against reality - the only counts in prose that are DERIVED and so can
# rot silently. Deliberately narrow: free prose like sidecoach's "26 flows" is a real fact
# about the product, not a hook count, and must not be caught here.
python3 - "$TREE" <<'PY' && ok "every 'The N hooks X installs' desc matches the real hook count" || bad "every 'The N hooks X installs' desc matches the real hook count"
import json,re,sys
t=json.load(open(sys.argv[1])); bad=[]
def walk(n):
    if n.get("members") is not None:
        for c in n["members"]: walk(c)
        return
    h=n.get("hooks")
    if h is None: return
    m=re.search(r'The (\d+) hooks (\S+) installs', n.get("desc","") or "")
    if m and int(m.group(1)) != len(h):
        bad.append("%s: desc claims %s hooks, node has %d" % (n["key"], m.group(1), len(h)))
for b in t["buckets"]: walk(b)
for b in bad: print("  "+b, file=sys.stderr)
sys.exit(0 if not bad else 1)
PY

# ---- staging + apply_plan (Task 4) ----
# Same fake_probe/INSTALLED harness; stage_reset before each scenario.
BR_STATE_PROBE='fake_probe'

# 0. set -u safety: the pending accessors self-initialize, so calling one before any
# stage_reset (install.sh runs `set -euo pipefail`) must not abort on an unbound global.
unset PENDING_INSTALL PENDING_UNINSTALL
INSTALLED="||"
[ -z "$(apply_plan 2>&1)" ] && ok "apply_plan safe before stage_reset" || bad "apply_plan safe before stage_reset"

# 1. toggle clears: staging a leaf then toggling it again nets to no pending.
INSTALLED="||"; stage_reset
stage_toggle 'tilt-lab'
[ "$(pending_under 'tilt-lab')" = "1" ] && ok "toggle stages one" || bad "toggle stages one"
stage_toggle 'tilt-lab'
[ "$(pending_under 'tilt-lab')" = "0" ] && ok "toggle twice clears" || bad "toggle twice clears"

# 2. justify partial install: one hook staged on, the other three land in the off-list.
# The off-list names EVERY other justify hook, so this pattern must too - a prefix match
# would keep passing if a hook were dropped from the tree (cross-model review, 2026-07-23).
INSTALLED="||"; stage_reset
stage_toggle 'justify/Hooks/justify-source-guard'
out="$(apply_plan)"
case "$out" in
  *"INSTALL justify justify-watch-guard justify-watch-standing-by justify-queue-drain-stop"*) ok "justify partial install plan";;
  *) bad "justify partial install plan";;
esac

# 3. pure-leaf install: a component leaf with no hooks emits a bare INSTALL line.
INSTALLED="||"; stage_reset
stage_toggle 'tilt-lab'
out="$(apply_plan)"
case "$out" in
  *"INSTALL tilt-lab"*) ok "pure-leaf install plan";;
  *) bad "pure-leaf install plan";;
esac

# 4. full uninstall via stage_all from the BUCKET screen ("Remove all of Justify..."):
# stage_all reaches the component leaf as well as the hooks, the leaf is staged off, and
# rule 1 fires. This is now the ONLY path to a full uninstall for a payload component -
# which is the point: it is reachable from a row that says "Remove all of Justify".
INSTALLED="|justify/justify|justify/Hooks/justify-source-guard|justify/Hooks/justify-watch-guard|justify/Hooks/justify-watch-standing-by|justify/Hooks/justify-queue-drain-stop|"; stage_reset
stage_all 'justify' uninstall
out="$(apply_plan)"
case "$out" in
  *"UNINSTALL_COMPONENT justify"*) ok "full uninstall plan";;
  *) bad "full uninstall plan (got '$out')";;
esac

# 4a. THE AFFORDANCE REGRESSION (2026-07-17, Jonah). Disabling every HOOK of a payload
# component must NOT uninstall the component - it unwires the hooks and leaves the skill,
# server and CLI in place. Before the leaf existed, this exact action emitted
# `UNINSTALL_COMPONENT justify` from a row labelled "Disable all Justify hooks...", i.e.
# the label understated the blast radius by the entire package. Both halves are
# load-bearing: the plan must install, and must not uninstall.
INSTALLED="|justify/justify|justify/Hooks/justify-source-guard|justify/Hooks/justify-watch-guard|justify/Hooks/justify-watch-standing-by|justify/Hooks/justify-queue-drain-stop|"; stage_reset
stage_all 'justify/Hooks' uninstall
out="$(apply_plan)"
case "$out" in
  *"INSTALL justify justify-source-guard justify-watch-guard justify-watch-standing-by justify-queue-drain-stop"*)
    ok "disable-all-hooks keeps the component (all 4 off-listed)";;
  *) bad "disable-all-hooks keeps the component (got '$out')";;
esac
case "$out" in
  *"UNINSTALL_COMPONENT"*) bad "disable-all-hooks must NOT uninstall the component (got '$out')";;
  *) ok "disable-all-hooks emits NO component uninstall";;
esac

# 4a-ii. The component leaf is the master switch: toggling it off uninstalls the whole
# component even with every hook left untouched-on. This is the affordance that did not
# exist at all before - there was no row to select.
stage_reset; stage_toggle 'justify/justify'
out="$(apply_plan)"
case "$out" in
  *"UNINSTALL_COMPONENT justify"*) ok "component leaf is the master switch";;
  *) bad "component leaf is the master switch (got '$out')";;
esac

# 4b. THE PARTIAL-OWNER DISABLE-ALL REGRESSION (the bug apply_plan rule 3 used to have).
# A PARTIALLY-installed hooks-only owner + "Disable all" must ALSO collapse to a component
# uninstall. The old rule asked "is every owned hook staged-uninstall?" - unsatisfiable
# here, because stage_all only stages the hooks that are currently ON, so the already-off
# ones were never staged. It fell through to the install branch and emitted
# `INSTALL <owner> <all off-listed>`: a disable-all that INSTALLS. The rule now asks the only
# question that matters - is anything left ON - so both assertions below are load-bearing.
#
# TARGETED AT `safety`, NOT cmux (retargeted 2026-07-17): cmux gained a component leaf and
# is no longer a hooks-only owner, so it can no longer exercise rule 3 at all. `safety` is a
# genuine hooks-only owner (a cluster - 5 unpinned hooks, no non-hook payload, so nothing to
# put a leaf on). Rule 3 still governs the 6 pure-hook components and the 8 clusters, and
# would otherwise have lost its multi-hook coverage silently.
INSTALLED="|Guardrails/safety/bash-guard|"; stage_reset
stage_all 'Guardrails/safety' uninstall
out="$(apply_plan)"
case "$out" in
  *"UNINSTALL_COMPONENT safety"*) ok "partial owner + disable-all -> component uninstall";;
  *) bad "partial owner + disable-all -> component uninstall (got '$out')";;
esac
# The NEGATIVE half, asserted separately: it must not merely CONTAIN the uninstall, it must
# not emit an INSTALL at all. A plan doing both would satisfy the check above and still
# install the very hooks the user asked to remove.
case "$out" in
  *"INSTALL safety"*) bad "partial owner + disable-all must NOT emit an INSTALL (got '$out')";;
  *) ok "partial owner + disable-all emits NO install";;
esac

# 4c. Same owner, FULLY installed + disable-all: unchanged behaviour, so the fix cannot be
# passing 4b by having broken the ordinary path.
INSTALLED="|Guardrails/safety/bash-guard|Guardrails/safety/content-guard|Guardrails/safety/content-guard-stop|Guardrails/safety/destructive-ops-guard|Guardrails/safety/destructive-confirm-detect|"
stage_reset; stage_all 'Guardrails/safety' uninstall
out="$(apply_plan)"
case "$out" in
  *"UNINSTALL_COMPONENT safety"*) ok "fully-installed owner + disable-all -> component uninstall";;
  *) bad "fully-installed owner + disable-all -> component uninstall (got '$out')";;
esac

# 4d. Rule 3 for a pure-hook APP owner, not a cluster (added 2026-07-17 from cross-model
# review). 4b/4c use `safety`, which is a CLUSTER - deactivate_component routes clusters to
# deactivate_cluster (install.sh:1763) but routes pure-hook apps to their own arms
# (deactivate_codex, deactivate_chrome, ...). Those apps are the class the four payload
# components just LEFT, so without this the browser has no all-off assertion for any
# pure-hook app at all. codex: 2 hooks, no leaf, no non-hook payload.
[ -z "$(_owner_leaf_path 'codex')" ] && ok "codex is genuinely leafless (rule 3 applies)" || bad "codex is genuinely leafless (rule 3 applies)"
INSTALLED="|Guardrails/codex/codex-failure-watcher|Guardrails/codex/codex-rescue-guard|"
stage_reset; stage_all 'Guardrails/codex' uninstall
out="$(apply_plan)"
case "$out" in
  *"UNINSTALL_COMPONENT codex"*) ok "pure-hook app + disable-all -> component uninstall";;
  *) bad "pure-hook app + disable-all -> component uninstall (got '$out')";;
esac
case "$out" in
  *"INSTALL codex"*) bad "pure-hook app + disable-all must NOT emit an INSTALL (got '$out')";;
  *) ok "pure-hook app + disable-all emits NO install";;
esac

# 5. partial preserve: an already-on hook stays on; only the untouched-off hook is off-listed.
INSTALLED="|justify/Hooks/justify-watch-guard|"; stage_reset
stage_toggle 'justify/Hooks/justify-source-guard'
out="$(apply_plan)"
case "$out" in
  *"INSTALL justify justify-watch-standing-by justify-queue-drain-stop"*) ok "partial preserve plan";;
  *) bad "partial preserve plan";;
esac

# 6. pinned hook is not stageable: toggling a pinned hook is a no-op.
INSTALLED="||"; stage_reset
stage_toggle 'Beats/Hooks/beats-rebuild'
[ "$(pending_under 'Beats/Hooks')" = "0" ] && ok "pinned not stageable" || bad "pinned not stageable"

# 7. memory partial install (monolithic): off-list is memory's other non-pinned hooks in tree order.
INSTALLED="||"; stage_reset
stage_toggle 'Beats/Hooks/memory-approve'
out="$(apply_plan)"
case "$out" in
  *"INSTALL memory memory-nudge memory-compact consolidate-nudge"*) ok "memory partial install plan";;
  *) bad "memory partial install plan";;
esac

# 8. stage_all install is TOTAL: it clears an opposite-direction staged-uninstall.
INSTALLED="|justify/justify|justify/Hooks/justify-source-guard|justify/Hooks/justify-watch-guard|justify/Hooks/justify-watch-standing-by|justify/Hooks/justify-queue-drain-stop|justify/Hooks/justify-watcher-guard|"; stage_reset
stage_toggle 'justify/Hooks/justify-source-guard'   # currently on -> stages UNINSTALL
stage_all 'justify' install                          # "install all" must clear that
[ "$(pending_under 'justify')" = "0" ] && ok "stage_all install clears opposite pending" || bad "stage_all install clears opposite pending"

# 9. stage_all uninstall is TOTAL: it clears an opposite-direction staged-install.
INSTALLED="||"; stage_reset
stage_toggle 'justify/Hooks/justify-source-guard'   # currently off -> stages INSTALL
stage_all 'justify' uninstall                        # "uninstall all" must clear that
[ "$(pending_under 'justify')" = "0" ] && ok "stage_all uninstall clears opposite pending" || bad "stage_all uninstall clears opposite pending"

# 10. dual-nature reflect: toggling reflect-nudge OFF keeps the reflect skill (leaf = master switch).
INSTALLED="|Beats/reflect|Beats/Hooks/reflect-nudge|"; stage_reset
stage_toggle 'Beats/Hooks/reflect-nudge'
out="$(apply_plan)"
case "$out" in *"INSTALL reflect reflect-nudge"*) ok "reflect nudge off-listed";; *) bad "reflect nudge off-listed";; esac
case "$out" in *"UNINSTALL_COMPONENT reflect"*) bad "reflect skill preserved (no full uninstall)";; *) ok "reflect skill preserved (no full uninstall)";; esac

# 11. dual-nature memory: all 4 engine hooks OFF keeps the memory engine (leaf = master switch).
INSTALLED="|Beats/memory|Beats/Hooks/memory-approve|Beats/Hooks/memory-nudge|Beats/Hooks/memory-compact|Beats/Hooks/consolidate-nudge|"; stage_reset
stage_toggle 'Beats/Hooks/memory-approve'
stage_toggle 'Beats/Hooks/memory-nudge'
stage_toggle 'Beats/Hooks/memory-compact'
stage_toggle 'Beats/Hooks/consolidate-nudge'
out="$(apply_plan)"
case "$out" in *"INSTALL memory memory-approve memory-nudge memory-compact consolidate-nudge"*) ok "memory engine kept, hooks off-listed";; *) bad "memory engine kept, hooks off-listed";; esac
case "$out" in *"UNINSTALL_COMPONENT memory"*) bad "memory engine preserved (no full uninstall)";; *) ok "memory engine preserved (no full uninstall)";; esac

# 12. memory engine master switch: toggling the engine LEAF off uninstalls the whole component.
INSTALLED="|Beats/memory|Beats/Hooks/memory-approve|Beats/Hooks/memory-nudge|Beats/Hooks/memory-compact|Beats/Hooks/consolidate-nudge|"; stage_reset
stage_toggle 'Beats/memory'
out="$(apply_plan)"
case "$out" in *"UNINSTALL_COMPONENT memory"*) ok "memory engine master-switch uninstall";; *) bad "memory engine master-switch uninstall";; esac

# 13. memory engine install brings its hooks: a bare INSTALL line, no off-list.
INSTALLED="||"; stage_reset
stage_toggle 'Beats/memory'
out="$(apply_plan)"
[ "$out" = "INSTALL memory" ] && ok "memory engine install brings hooks (no off-list)" || bad "memory engine install brings hooks (no off-list)"

# 14. set -e smoke: the staging layer must not trip under set -e (install.sh runs set -euo pipefail).
( set -e; stage_reset; stage_toggle 'justify/Hooks/justify-source-guard'; apply_plan >/dev/null )
[ "$?" = "0" ] && ok "staging layer clean under set -e" || bad "staging layer clean under set -e"

# 15. DEFAULT-OFF HOOK under a browser MASTER-LEAF install (the Stage 3b gap this closes).
# Staging the Sidecoach component LEAF is a whole-component install: apply_plan sets
# leaf_install=1 and force-enables every OWNED hook - EXCEPT a default_off one. With nothing yet
# installed, sidecoach-detect (the sole default_off hook) must land in the off-list while the
# other 6 sidecoach hooks force-enable. Before the guard this emitted a BARE `INSTALL sidecoach`
# that wired the per-edit scan on a fresh GUI install. The EXACT match is load-bearing TWICE:
# detect IS off-listed (install-but-off), AND the off-list is ONLY detect - i.e. the other 6 are
# NOT off-listed, they force-enable exactly as before (no recall loss).
INSTALLED="||"; stage_reset
stage_toggle 'sidecoach/sidecoach'
out="$(apply_plan)"
[ "$out" = "INSTALL sidecoach sidecoach-detect" ] \
  && ok "master-leaf install leaves default-off sidecoach-detect off (install-but-off)" \
  || bad "master-leaf install leaves default-off sidecoach-detect off (got '$out')"
# no-recall-loss, asserted INDEPENDENTLY of the exact string above: a non-default-off sibling
# must NOT be off-listed under leaf-install - it still force-enables as it did before the guard.
case "$out" in
  *sidecoach-preamble*) bad "no-recall-loss: non-default-off hook must NOT be off-listed under leaf-install (got '$out')";;
  *) ok "no-recall-loss: non-default-off sidecoach hooks still force-enable under leaf-install";;
esac

# 16. The guard withholds ONLY the blanket force-enable, it does NOT force a default_off hook
# OFF: under leaf_install it falls through to the probe (current state). A constructed probe
# state with detect already present (an existing opt-in) must therefore keep detect ON, so with
# every sibling force-enabled the off-list is EMPTY -> a bare INSTALL. This distinguishes the
# correct `&& ! hook_default_off` fall-through from a wrong force-OFF that would rip out an
# existing opt-in on a component re-install.
INSTALLED="|sidecoach/Hooks/sidecoach-detect|"; stage_reset
stage_toggle 'sidecoach/sidecoach'
out="$(apply_plan)"
[ "$out" = "INSTALL sidecoach" ] \
  && ok "leaf-install honours an existing default-off opt-in via the probe (no off-list)" \
  || bad "leaf-install honours an existing default-off opt-in via the probe (got '$out')"

# 17. Per-hook toggle ON still opts a default_off hook IN (the browser opt-in path, and the
# forward half of "toggle both directions still works"). Staging the detect HOOK with nothing
# installed: staged-install (rung 2) wins ahead of the leaf/probe rungs, so detect installs and
# the OTHER 6 (untouched-off, no leaf install) are off-listed. Proves default_off never blocks
# an explicit opt-in.
INSTALLED="||"; stage_reset
stage_toggle 'sidecoach/Hooks/sidecoach-detect'
out="$(apply_plan)"
case "$out" in
  *"INSTALL sidecoach sidecoach-sessionstart sidecoach-preamble sidecoach-postuserp sidecoach-keyword sidecoach-taste-gate sidecoach-orchestrate-edit sidecoach-qa-gate-stop qa-gate-manual sidecoach-craft-floor sidecoach-postresponse"*)
    ok "per-hook toggle opts default-off sidecoach-detect in (other default-on hooks off-listed)";;
  *) bad "per-hook toggle opts default-off sidecoach-detect in (got '$out')";;
esac
case "$out" in
  *sidecoach-detect*) bad "per-hook opt-in: detect must NOT be in the off-list (got '$out')";;
  *) ok "per-hook opt-in: detect installed, not off-listed";;
esac

# 18. Per-hook toggle OFF of a default_off hook that is currently on (the reverse half of
# "toggle both directions"): staged-uninstall (rung 1) still wins, detect off-listed, component
# preserved. Identical off-list string to case 15 but reached via a different rung - the point
# is that neither the browser toggle nor the leaf force-enable was disturbed by the guard.
INSTALLED="|sidecoach/sidecoach|sidecoach/Hooks/sidecoach-sessionstart|sidecoach/Hooks/sidecoach-preamble|sidecoach/Hooks/sidecoach-postuserp|sidecoach/Hooks/sidecoach-keyword|sidecoach/Hooks/sidecoach-taste-gate|sidecoach/Hooks/sidecoach-orchestrate-edit|sidecoach/Hooks/sidecoach-qa-gate-stop|sidecoach/Hooks/qa-gate-manual|sidecoach/Hooks/sidecoach-craft-floor|sidecoach/Hooks/sidecoach-postresponse|sidecoach/Hooks/sidecoach-heal|sidecoach/Hooks/sidecoach-detect|"; stage_reset
stage_toggle 'sidecoach/Hooks/sidecoach-detect'
out="$(apply_plan)"
case "$out" in
  *"INSTALL sidecoach sidecoach-detect"*) ok "per-hook toggle OFF off-lists default-off detect, keeps component";;
  *) bad "per-hook toggle OFF off-lists default-off detect (got '$out')";;
esac
case "$out" in
  *UNINSTALL_COMPONENT*) bad "per-hook toggle OFF of default-off detect must NOT uninstall the component (got '$out')";;
  *) ok "per-hook toggle OFF of default-off detect emits no component uninstall";;
esac

# 19. DELIBERATE BOUNDARY (Codex caveat, 2026-07-24): default_off is exempt ONLY from the
# leaf_install blanket force-enable, NOT from an explicit bulk "Install all of Sidecoach..." /
# "Enable all hooks..." row, which routes through `stage_all install` and stages EVERY
# non-pinned leaf - detect included. That is intended: the row literally says "all", staged
# install (rung 2) opts detect in exactly like a per-hook opt-in, and making "install all"
# silently skip detect would be a label lie of the class the drift tests above exist to catch.
# So under stage_all install, detect IS staged and is NOT in the off-list -> a bare INSTALL
# line. This locks the boundary: the guard must not leak into the explicit-all affordance.
INSTALLED="||"; stage_reset
stage_all 'sidecoach' install
out="$(apply_plan)"
[ "$out" = "INSTALL sidecoach" ] \
  && ok "stage_all install still includes default-off detect (explicit 'all' is not the leaf force-enable)" \
  || bad "stage_all install still includes default-off detect (got '$out')"

# ---- apply_pending_plan translation (Task 6) --------------------------------
# apply_pending_plan is the PURE half of the apply layer: it collapses apply_plan's
# per-owner lines into the ONE install pass + the deactivate list that apply_pending runs.
# Contract asserted here (exact strings, both lines always emitted):
#   line 1  INSTALL <owners-csv>|<off-list>   off-list hooks carry .sh; empty is "INSTALL |"
#   line 2  DEACTIVATE <owners>               empty is "DEACTIVATE " (trailing space)
# Command substitution strips trailing NEWLINES only, so the line-2 trailing space
# survives $(apl_line 2) and is asserted verbatim.

# apl_line <n> - print line <n> of apply_pending_plan verbatim.
apl_line() {
  local want="$1" n=0 l
  while IFS= read -r l; do
    n=$((n+1))
    if [ "$n" = "$want" ]; then printf '%s' "$l"; return 0; fi
  done < <(apply_pending_plan)
  return 0
}

# 15. CANONICAL scenario: justify + codex installed; stage "uninstall ONE codex hook"
# (codex-rescue-guard) + "install chrome". Turning off a single codex hook is an OFF-LIST
# install, NOT a component uninstall - so codex rides the install pass and DEACTIVATE is
# empty. Owner order is apply_plan first-seen: PENDING_INSTALL is scanned before
# PENDING_UNINSTALL, so chrome (staged install) precedes codex (staged uninstall).
INSTALLED="|Guardrails/codex/codex-failure-watcher|Guardrails/codex/codex-rescue-guard|justify/Hooks/justify-source-guard|justify/Hooks/justify-watch-guard|justify/Hooks/justify-watch-standing-by|justify/Hooks/justify-queue-drain-stop|"
stage_reset
stage_toggle 'Guardrails/codex/codex-rescue-guard'   # currently ON -> stages uninstall
stage_all 'Guardrails/chrome' install                # currently OFF -> stages all 3 on
[ "$(apl_line 1)" = "INSTALL chrome,codex|codex-rescue-guard.sh" ] \
  && ok "apply_pending_plan canonical INSTALL line" || bad "apply_pending_plan canonical INSTALL line"
[ "$(apl_line 2)" = "DEACTIVATE " ] \
  && ok "apply_pending_plan canonical DEACTIVATE empty" || bad "apply_pending_plan canonical DEACTIVATE empty"

# 16. whole-component uninstall: "Remove all of Justify" (leaf included) -> DEACTIVATE
# justify, and justify must NOT also appear on the install line (the two lists are
# disjoint by construction). The leaf is in INSTALLED because that is what stage_all has
# to reach to trigger rule 1; hooks alone no longer collapse to a deactivate.
INSTALLED="|justify/justify|justify/Hooks/justify-source-guard|justify/Hooks/justify-watch-guard|justify/Hooks/justify-watch-standing-by|justify/Hooks/justify-queue-drain-stop|"
stage_reset; stage_all 'justify' uninstall
[ "$(apl_line 2)" = "DEACTIVATE justify" ] && ok "apply_pending_plan DEACTIVATE owner" || bad "apply_pending_plan DEACTIVATE owner"
[ "$(apl_line 1)" = "INSTALL |" ] && ok "apply_pending_plan deactivated owner absent from INSTALL" || bad "apply_pending_plan deactivated owner absent from INSTALL"

# 17. pure install, no off-list: a leaf component yields an empty off-list field.
INSTALLED="||"; stage_reset; stage_toggle 'tilt-lab'
[ "$(apl_line 1)" = "INSTALL tilt-lab|" ] && ok "apply_pending_plan pure install empty off-list" || bad "apply_pending_plan pure install empty off-list"

# 18. .sh suffix on a MULTI-hook off-list: apply_plan emits bare tree names, the off-list
# must carry .sh on EVERY entry (install.sh's HOOK_OFF contract is filenames).
# The off-list is justify's OTHER hooks in tree order, so this string is hook-count
# sensitive by design - it is what caught the tree and the installer disagreeing when
# justify-queue-drain-stop was packaged (2026-07-23). If justify gains a hook, this
# expectation must grow with it; that coupling is the point, not friction to route around.
INSTALLED="||"; stage_reset; stage_toggle 'justify/Hooks/justify-source-guard'
[ "$(apl_line 1)" = "INSTALL justify|justify-watch-guard.sh justify-watch-standing-by.sh justify-queue-drain-stop.sh justify-watcher-guard.sh" ] \
  && ok "apply_pending_plan multi-hook off-list .sh suffix" || bad "apply_pending_plan multi-hook off-list .sh suffix"

# 19. nothing staged -> both lines still emitted, both empty (fixed 2-line shape).
stage_reset
[ "$(apl_line 1)" = "INSTALL |" ] && ok "apply_pending_plan empty INSTALL line" || bad "apply_pending_plan empty INSTALL line"
[ "$(apl_line 2)" = "DEACTIVATE " ] && ok "apply_pending_plan empty DEACTIVATE line" || bad "apply_pending_plan empty DEACTIVATE line"

# 20. combined: an off-list install AND a full uninstall in the same staged set land on
# their own lines - proves the two passes are independent, not either/or.
INSTALLED="|Guardrails/codex/codex-failure-watcher|Guardrails/codex/codex-rescue-guard|tilt-lab|"
stage_reset
stage_toggle 'Guardrails/codex/codex-rescue-guard'   # ON -> off-list install of codex
stage_toggle 'tilt-lab'                              # ON -> full uninstall (pure leaf)
[ "$(apl_line 1)" = "INSTALL codex|codex-rescue-guard.sh" ] && ok "apply_pending_plan mixed INSTALL line" || bad "apply_pending_plan mixed INSTALL line"
[ "$(apl_line 2)" = "DEACTIVATE tilt-lab" ] && ok "apply_pending_plan mixed DEACTIVATE line" || bad "apply_pending_plan mixed DEACTIVATE line"

# 21. set -e smoke for the pure translator (install.sh runs set -euo pipefail).
( set -e; stage_reset; stage_toggle 'justify/Hooks/justify-source-guard'; apply_pending_plan >/dev/null )
[ "$?" = "0" ] && ok "apply_pending_plan clean under set -e" || bad "apply_pending_plan clean under set -e"

unset BR_STATE_PROBE

# 22. INVARIANT GUARD for the merged off-list: apply_pending merges EVERY owner's off-list
# into ONE _AMPERSAND_HOOK_OFF and runs ONE install pass. install.sh matches HOOK_OFF
# entries by hook FILENAME against the hooks each install_app_hooks call passes in, so that
# merge is only safe while a hook filename belongs to exactly ONE owner. If two owners ever
# shipped the same filename, off-listing it for owner A would silently drop it from owner B
# in the same pass. Parses install.sh's REAL call sites (app components + the cluster table)
# rather than the tree, because those calls are the ground truth the off-list is matched on.
python3 - "$REPO_DIR" <<'PY' && ok "hook filenames are owner-unique (merged off-list safe)" || bad "hook filenames are owner-unique (merged off-list safe)"
import os, re, sys
src = open(os.path.join(sys.argv[1], "install.sh")).read()
owner_hooks = {}
# (a) app components: `picked <comp> && install_app_hooks a.sh b.sh ...`
for m in re.finditer(r'picked\s+(\S+)\s+&&\s+install_app_hooks\s+([^\n]*)', src):
    hooks = [w for w in m.group(2).split() if w.endswith('.sh')]
    owner_hooks.setdefault(m.group(1), set()).update(hooks)
# (b) QA clusters: the cluster_hooks() case arms
body = re.search(r'cluster_hooks\(\)\s*\{(.*?)\n\}', src, re.S)
if body:
    for line in body.group(1).splitlines():
        arm = re.match(r'\s*([a-z-]+)\)\s*echo\s+"([^"]*)"', line)
        if arm:
            owner_hooks.setdefault(arm.group(1), set()).update(arm.group(2).split())
# Anti-drift floor: if the regexes ever stop matching install.sh, this test would happily
# "pass" while checking a subset (or nothing). Demand a known set of owners up front so
# drift fails LOUDLY instead of quietly narrowing the invariant's coverage.
REQUIRED = {"codex", "chrome", "justify", "memory", "safety", "verification"}
missing = REQUIRED - set(owner_hooks)
if missing:
    print("regex drift - expected owners not parsed from install.sh:", sorted(missing), file=sys.stderr)
    sys.exit(1)
seen, dupes = {}, []
for owner, hooks in sorted(owner_hooks.items()):
    for h in sorted(hooks):
        if h in seen and seen[h] != owner:
            dupes.append("%s owned by BOTH %s and %s" % (h, seen[h], owner))
        seen[h] = owner
print("owners: %d, hook filenames: %d" % (len(owner_hooks), len(seen)), file=sys.stderr)
if dupes:
    print("SHARED HOOK FILENAMES:", dupes, file=sys.stderr)
sys.exit(0 if not dupes else 1)
PY

# ---- apply_pending failure paths (Task 6) ----------------------------------
# apply_pending is normally driven through install.sh's test seam, but its DEACTIVATE-only
# and refusal paths run no install pass ($0 is never invoked), so they are unit-testable
# here with a stubbed deactivate_component.
#
# These paths are load-bearing: callers test apply_pending's status (`if apply_pending`),
# which DISABLES errexit for its whole body. Every failure inside it must therefore be
# checked explicitly or it silently returns 0. That is exactly what these tests pin.
#
# state_set is an install.sh function that apply_pending calls after a successful
# deactivate. It does not exist in this process, so it is STUBBED here (like
# deactivate_component) rather than left undefined - an undefined call would return 127 and,
# with errexit off, silently continue, which is the very failure mode these tests exist to
# catch. _apl_state records what apply_pending asked to be recorded.
BR_STATE_PROBE='fake_probe'
_apl_state=""
state_set() { _apl_state="$1=$2"; return 0; }

# 23. a failing deactivate must PROPAGATE its code and PRESERVE pending (never a silent 0),
# and must NOT record an inactive state for a component that is still installed.
INSTALLED="|tilt-lab|"; stage_reset
stage_toggle 'tilt-lab'                       # ON -> plan is "INSTALL |" + "DEACTIVATE tilt-lab"
deactivate_component() { return 7; }          # stub a failing deactivator
_apl_state=""
rc=0; if apply_pending >/dev/null 2>&1; then rc=0; else rc=$?; fi
[ "$rc" = "7" ] && ok "apply_pending propagates deactivate failure" || bad "apply_pending propagates deactivate failure (got $rc)"
[ -n "$PENDING_UNINSTALL" ] && ok "apply_pending preserves pending on deactivate failure" || bad "apply_pending preserves pending on deactivate failure"
[ -z "$_apl_state" ] && ok "apply_pending records no state on deactivate failure" || bad "apply_pending records no state on deactivate failure (got $_apl_state)"

# 24. the success path clears pending, returns 0, and records the owner inactive
# (returning_flow parity, install.sh:2033).
INSTALLED="|tilt-lab|"; stage_reset
stage_toggle 'tilt-lab'
deactivate_component() { return 0; }
_apl_state=""
rc=0; if apply_pending >/dev/null 2>&1; then rc=0; else rc=$?; fi
[ "$rc" = "0" ] && ok "apply_pending returns 0 on a clean deactivate" || bad "apply_pending returns 0 on a clean deactivate (got $rc)"
[ -z "$PENDING_UNINSTALL" ] && ok "apply_pending clears pending on success" || bad "apply_pending clears pending on success"
[ "$_apl_state" = "tilt-lab=inactive" ] && ok "apply_pending records deactivated owner inactive" || bad "apply_pending records deactivated owner inactive (got $_apl_state)"

# 25. a self-contradicting plan is REFUSED with exit 3 before ANY work runs. Unreachable via
# the real apply_plan (one line per owner), so the plan is stubbed to force the path.
# BOTH side-effecting legs are trapped, not just the deactivate: the stubbed owner is on the
# INSTALL line too, so if the guard were ever moved after the install pass, the `bash` stub
# fires. A shell function shadows the external command, so the env-prefixed
# `_AMPERSAND_HOOK_OFF=... bash "$0" --only ...` inside apply_pending hits the stub and never
# runs the real installer (prefix assignments do not suppress function lookup).
# Both stubs mark a FILE, not stderr: apply_pending redirects the install pass with
# `>"$logfile" 2>&1`, so a stderr marker would be swallowed by that redirect and the trap
# would silently never fire. Exit code alone cannot catch this (a guard moved after the
# install pass still returns 3), so the sentinel files are the only real evidence.
_apl_i="$(mktemp)"; _apl_d="$(mktemp)"
apply_pending_plan() { printf 'INSTALL codex|\nDEACTIVATE codex\n'; }
deactivate_component() { echo RAN > "$_apl_d"; return 0; }
bash() { echo RAN > "$_apl_i"; return 0; }
stage_reset; PENDING_UNINSTALL="|sentinel|"
apply_pending >/dev/null 2>&1; rc=$?
unset -f bash
[ "$rc" = "3" ] && ok "apply_pending refuses contradicting plan with exit 3" || bad "apply_pending refuses contradicting plan with exit 3 (got $rc)"
[ -s "$_apl_d" ] && bad "apply_pending ran no deactivate on refusal" || ok "apply_pending ran no deactivate on refusal"
[ -s "$_apl_i" ] && bad "apply_pending ran no install pass on refusal" || ok "apply_pending ran no install pass on refusal"
[ "$PENDING_UNINSTALL" = "|sentinel|" ] && ok "apply_pending preserves pending on refusal" || bad "apply_pending preserves pending on refusal"
rm -f "$_apl_i" "$_apl_d"
unset -f apply_pending_plan deactivate_component state_set
stage_reset
unset BR_STATE_PROBE

# ---- update flow (Task 7): update_status / update_apply ----
# The install.sh primitives (check_updates/apply_update/detect_component/KEYS) are stubbed;
# these tests cover the browser's logic on top of them, not git itself.
#
# Every re-run assertion uses a MARKER FILE, never stderr: update_apply redirects the
# re-install with `>"$logfile" 2>&1`, so a stderr marker would be swallowed by that
# redirect and a trap meant to catch an unwanted re-run would silently never fire.
# (Task 6 hit exactly this trap.)

# NOTE ON THE STUB SHAPE (Task 9): check_updates now prints a COUNT on line 1 and the
# subjects on 2+. Availability comes from that count, never from whether subject text was
# printed - `git commit --allow-empty-message` is legal, so a real backlog can have nothing
# to quote. These stubs speak the new contract; test-check-updates.sh proves the real
# function honours it against actual git repos.

# 26. commits available -> "available" + every subject line, verbatim.
check_updates() { printf '2\nfix the widget\nbump the dep\n'; return 0; }
_us_out="$(update_status)"
[ "$(printf '%s\n' "$_us_out" | sed -n 1p)" = "available" ] \
  && ok "update_status line 1 is available" || bad "update_status line 1 is available (got $(printf '%s\n' "$_us_out" | sed -n 1p))"
printf '%s\n' "$_us_out" | grep -Fqx "fix the widget" \
  && ok "update_status carries first commit subject" || bad "update_status carries first commit subject"
printf '%s\n' "$_us_out" | grep -Fqx "bump the dep" \
  && ok "update_status carries second commit subject" || bad "update_status carries second commit subject"
# The EXACT whole output, not just "line 1 + the subjects appear somewhere": the contract is
# "line 1 exactly, lines 2+ verbatim IN ORDER". Greps alone would pass an implementation
# that duplicated, reordered, or padded the subject lines. The COUNT must be consumed, not
# forwarded: it is an input to the classification, not part of the row's detail.
[ "$_us_out" = "$(printf 'available\nfix the widget\nbump the dep')" ] \
  && ok "update_status emits exactly available + subjects in order (count consumed, not echoed)" \
  || bad "update_status emits exactly available + subjects in order (got '$_us_out')"

# 26b. THE EMPTY-SUBJECT CASE - count > 0 with NO subject lines. The row must still say
# updates exist, and the count becomes the detail line because there is nothing to quote.
# Reporting up-to-date here was a REAL shipped bug (see test-check-updates.sh scenario 4).
check_updates() { printf '3\n'; return 0; }
[ "$(update_status)" = "$(printf 'available\n3 new commits')" ] \
  && ok "update_status: count>0 with no subjects -> available + the count as detail" \
  || bad "update_status: count>0 with no subjects -> available + '3 new commits' (got '$(update_status)')"

# 26c. Singular. A row reading "1 new commits" is the kind of thing nobody fixes later.
check_updates() { printf '1\n'; return 0; }
[ "$(update_status)" = "$(printf 'available\n1 new commit')" ] \
  && ok "update_status: a single commit reads '1 new commit', not '1 new commits'" \
  || bad "update_status: singular detail line (got '$(update_status)')"

# 26d. MIXED empty and non-empty subjects (Codex review, reproduced before fixing).
# git prints an EMPTY LINE for a commit with no message, and an empty line is not a
# subject. Passing them through made the footer - which joins detail lines with "; " -
# render "Incoming: ; fix config". Empty lines are filtered out; the real subjects
# survive, in order.
check_updates() { printf '3\n\nfix config\n'; return 0; }
[ "$(update_status)" = "$(printf 'available\nfix config')" ] \
  && ok "update_status: empty subject lines are filtered, real ones survive (no 'Incoming: ; fix config')" \
  || bad "update_status: mixed empty/non-empty subjects (got '$(update_status)')"

# 26e. THE BOUNDARY, pinned deliberately (Codex round-2 caught the earlier version of this
# test claiming to cover something it could not reach).
#
# update_status reads check_updates through `out="$(check_updates)"`, and command
# substitution STRIPS TRAILING NEWLINES. So a check_updates that emits a count followed by
# nothing but blank lines is INDISTINGUISHABLE from one that emits the count alone - the
# blanks never reach the filter, and this is exactly why the real all-empty-message git
# case (test-check-updates.sh scenario 4) renders as the count.
#
# The consequence is worth stating, because it is not obvious: when out != count, the block
# after the count always ends in a NON-blank line, so `detail` can never filter down to
# empty. The count fallback is reachable ONLY via the count-only shape. The `-n "$detail"`
# guard in update_status is therefore defensive, not load-bearing - kept because a filter
# whose empty case silently printed nothing would be a worse failure than a redundant test.
check_updates() { printf '2\n\n\n'; return 0; }
[ "$(update_status)" = "$(printf 'available\n2 new commits')" ] \
  && ok "update_status: trailing blank lines are stripped by \$() before the filter sees them, so count-plus-blanks IS the count-only shape and the count speaks" \
  || bad "update_status: count-plus-trailing-blanks should fall back to the count (got '$(update_status)')"

# 27. count 0 -> "up-to-date". This is the case the missing `return 0` in check_updates used
# to render indistinguishable from "unknown".
check_updates() { printf '0\n'; return 0; }
[ "$(update_status)" = "up-to-date" ] && ok "update_status up-to-date" || bad "update_status up-to-date (got $(update_status))"

# 27b. CONTRACT VIOLATION: exit 0 but no count (or a non-integer one). A primitive that
# exits clean while printing garbage is BROKEN, and a broken check is not an up-to-date
# repo - the one thing this row must never do is claim you are current when it cannot tell.
# Under the old contract "exit 0 + no output" MEANT up-to-date, so this case could not be
# detected at all; the count makes it detectable, and it must fail closed.
check_updates() { return 0; }
[ "$(update_status)" = "unknown" ] \
  && ok "update_status: exit 0 with no count is a BROKEN primitive -> unknown, not up-to-date" \
  || bad "update_status: exit 0 with no count -> unknown (got '$(update_status)')"
check_updates() { printf 'lots\n'; return 0; }
[ "$(update_status)" = "unknown" ] \
  && ok "update_status: exit 0 with a non-integer count -> unknown" \
  || bad "update_status: exit 0 with a non-integer count -> unknown (got '$(update_status)')"

# 28. cd/fetch failed -> "unknown".
check_updates() { return 1; }
[ "$(update_status)" = "unknown" ] && ok "update_status unknown on fetch failure" || bad "update_status unknown on fetch failure (got $(update_status))"

# 29. errexit smoke: check_updates returning 1 is an EXPECTED case and must not abort a
# caller running under `set -e`. Run in a subshell so a failure cannot kill this suite.
check_updates() { return 1; }
( set -e; update_status >/dev/null ) >/dev/null 2>&1
[ "$?" = "0" ] && ok "update_status survives set -e on unknown path" || bad "update_status survives set -e on unknown path"

# 30. pull fails (non-ff) -> exit 2 and NOT ONE re-run attempted. The exit code alone
# cannot prove the second half, so the `bash` stub marks a file: a shell function shadows
# the external command, so the env-prefixed `_AMPERSAND_NO_SUMMARY=1 bash "$self" ...`
# inside update_apply hits the stub and never runs the real installer.
_ua_run="$(mktemp)"; : > "$_ua_run"
apply_update() { return 1; }
detect_component() { echo active; }
KEYS=(brain codex)
bash() { echo RAN > "$_ua_run"; return 0; }
update_apply >/dev/null 2>&1; rc=$?
unset -f bash
[ "$rc" = "2" ] && ok "update_apply returns 2 when pull is not fast-forwardable" || bad "update_apply returns 2 when pull is not fast-forwardable (got $rc)"
[ -s "$_ua_run" ] && bad "update_apply attempts no re-run after a failed pull" || ok "update_apply attempts no re-run after a failed pull"

# 31. pull OK + some components active -> exit 0, re-run invoked with the exact argument
# string. The stub drops $1 (the installer path, which varies by checkout) and records the
# remaining args, so the assertion is on the EXACT argument string.
_ua_args="$(mktemp)"; : > "$_ua_args"
_ua_self="$(mktemp)"; : > "$_ua_self"
apply_update() { return 0; }
detect_component() { case "$1" in codex|chrome) echo active ;; *) echo not-installed ;; esac; }
KEYS=(brain codex memory chrome)
# One arg per LINE, delimited: "$*" would collapse argv into a single string, so
# `bash "$self" "--only codex,chrome" --yes` (one arg) would pass identically to the
# intended `bash "$self" --only codex,chrome --yes` (three args). The <> delimiters
# also make an empty or space-padded arg visible.
bash() { printf '%s\n' "$1" > "$_ua_self"; shift; printf '<%s>\n' "$@" > "$_ua_args"; return 0; }
update_apply >/dev/null 2>&1; rc=$?
unset -f bash
[ "$rc" = "0" ] && ok "update_apply returns 0 on pull + re-run success" || bad "update_apply returns 0 on pull + re-run success (got $rc)"
[ "$(cat "$_ua_args")" = "$(printf '<--only>\n<codex,chrome>\n<--yes>')" ] \
  && ok "update_apply re-runs with exactly --only codex,chrome --yes" \
  || bad "update_apply re-runs with exactly --only codex,chrome --yes (got '$(cat "$_ua_args")')"
# The installer path is never asserted by the argv check above (it varies per checkout, so
# the stub drops it) - but it MUST be absolute, because apply_update cd's the caller to
# $REPO_DIR and a relative "$0" would then resolve against the wrong directory.
case "$(cat "$_ua_self")" in
  /*) ok "update_apply re-runs an absolute installer path" ;;
  *)  bad "update_apply re-runs an absolute installer path (got '$(cat "$_ua_self")')" ;;
esac

# 32. pull OK but NOTHING active -> exit 0 and no re-run (an --only with an empty list
# would be a meaningless installer invocation).
_ua_none="$(mktemp)"; : > "$_ua_none"
apply_update() { return 0; }
detect_component() { echo not-installed; }
KEYS=(brain codex memory)
bash() { echo RAN > "$_ua_none"; return 0; }
update_apply >/dev/null 2>&1; rc=$?
unset -f bash
[ "$rc" = "0" ] && ok "update_apply returns 0 when nothing is active" || bad "update_apply returns 0 when nothing is active (got $rc)"
[ -s "$_ua_none" ] && bad "update_apply skips the re-run when nothing is active" || ok "update_apply skips the re-run when nothing is active"

# 33. pull OK but the re-install fails -> exit 3, NOT 2. The repo is already updated, so
# telling the user to go resolve it (the 2 message) would send them after a clean repo.
apply_update() { return 0; }
detect_component() { case "$1" in codex) echo active ;; *) echo not-installed ;; esac; }
KEYS=(brain codex)
bash() { return 7; }
update_apply >/dev/null 2>&1; rc=$?
unset -f bash
[ "$rc" = "3" ] && ok "update_apply returns 3 when the re-install fails after a good pull" || bad "update_apply returns 3 when the re-install fails after a good pull (got $rc)"

# 34. STRICT-MODE CALLER SHAPE. The tests above run under `set -u` only and use the
# `update_apply; rc=$?` shape, which install.sh (set -euo pipefail) could never use: a
# plain failing command exits immediately there, so those tests would pass even if the
# function only worked outside errexit. These re-drive both failure codes through the
# shape a real caller must use - `if update_apply; then ... else rc=$?; fi` inside
# `set -euo pipefail` - which is ALSO the shape that silently disables errexit for the
# whole function body, the exact condition under which an unchecked internal failure
# would slip through as success.
_strict_rc() { # $1 = stub script driving update_apply; echoes the observed exit code
  ( set -euo pipefail
    eval "$1"
    if update_apply >/dev/null 2>&1; then rc=0; else rc=$?; fi
    exit "$rc"
  ) >/dev/null 2>&1
  echo $?
}
_sr="$(_strict_rc 'apply_update() { return 1; }; detect_component() { echo active; }; KEYS=(brain codex)')"
[ "$_sr" = "2" ] && ok "update_apply returns 2 under set -euo pipefail (real caller shape)" \
  || bad "update_apply returns 2 under set -euo pipefail (real caller shape) (got $_sr)"
_sr="$(_strict_rc 'apply_update() { return 0; }; detect_component() { case "$1" in codex) echo active ;; *) echo not-installed ;; esac; }; KEYS=(brain codex); bash() { return 7; }')"
[ "$_sr" = "3" ] && ok "update_apply returns 3 under set -euo pipefail (real caller shape)" \
  || bad "update_apply returns 3 under set -euo pipefail (real caller shape) (got $_sr)"
# 35. A detect_component probe that exits non-zero is a HANDLED case (treated as
# not-active), not grounds for aborting the caller.
#
# NOTE THE SHAPE, it is the whole point: this runs update_apply as a PLAIN COMMAND under
# errexit, NOT via `if update_apply`. The `if` shape DISABLES errexit inside the function
# body, so an unguarded internal failure would sail through it and the test would pass
# against a broken implementation - verified: written the `if` way first, this assertion
# stayed green with the guard deleted. As a plain command, errexit is live INSIDE the
# body, so an unguarded `st="$(detect_component ...)"` aborts before the marker prints.
_sr_out="$( ( set -euo pipefail
    apply_update() { return 0; }
    detect_component() { return 1; }
    KEYS=(brain codex)
    update_apply >/dev/null 2>&1
    echo REACHED
  ) 2>/dev/null )"
[ "$_sr_out" = "REACHED" ] && ok "update_apply survives a failing detect_component probe under live errexit" \
  || bad "update_apply survives a failing detect_component probe under live errexit (got '$_sr_out')"

rm -f "$_ua_run" "$_ua_args" "$_ua_none" "$_ua_self"
unset -f check_updates apply_update detect_component _strict_rc
unset KEYS


# ---------------------------------------------------------------------------
# stale_deploys: a DEPLOYED build artifact behind what the repo built.
#
# Everything else the installer places is a symlink and cannot go stale. A compiled
# bundle is copied, and on 2026-07-31 ~/.claude/justify/dist was three days behind a
# fix that was already built and committed. Nothing in the browser showed it.
# Content comparison, never mtime - see the note on stale_deploys.
# ---------------------------------------------------------------------------
_sd() { REPO_DIR="$1" CLAUDE_DIR="$2" bash -c 'source '"$REPO_DIR"'/claude/hooks/browser-lib.sh 2>/dev/null; stale_deploys'; }
_sds() { REPO_DIR="$1" CLAUDE_DIR="$2" bash -c 'source '"$REPO_DIR"'/claude/hooks/browser-lib.sh 2>/dev/null; stale_deploy_summary'; }

SDT="$(mktemp -d)"; mkdir -p "$SDT/repo/justify/dist" "$SDT/home/justify/dist"

[ -z "$(_sd "$SDT/repo" "$SDT/home")" ] \
  && ok "nothing deployed -> silent (component simply not installed)" \
  || bad "nothing deployed -> silent"

printf 'BUILT-A\n' > "$SDT/repo/justify/dist/justify-core.js"
printf 'BUILT-A\n' > "$SDT/home/justify/dist/justify-core.js"
[ "$(_sd "$SDT/repo" "$SDT/home")" = "justify|current" ] \
  && ok "deployed matches the repo build -> current" || bad "deployed matches the repo build -> current"
[ -z "$(_sds "$SDT/repo" "$SDT/home")" ] \
  && ok "current -> summary empty, so no row is drawn" || bad "current -> summary empty"

printf 'BUILT-B-with-the-fix\n' > "$SDT/repo/justify/dist/justify-core.js"
[ "$(_sd "$SDT/repo" "$SDT/home")" = "justify|stale" ] \
  && ok "repo rebuilt but not deployed -> stale (the 2026-07-31 failure)" \
  || bad "repo rebuilt but not deployed -> stale"
[ "$(_sds "$SDT/repo" "$SDT/home")" = "justify" ] \
  && ok "stale -> summary names the component for the row" || bad "stale -> summary names the component"

rm -f "$SDT/repo/justify/dist/justify-core.js"
[ "$(_sd "$SDT/repo" "$SDT/home")" = "justify|unknown" ] \
  && ok "source side unreadable -> unknown, never 'current'" || bad "source side unreadable -> unknown"
[ -z "$(_sds "$SDT/repo" "$SDT/home")" ] \
  && ok "unknown does not raise the row (no false alarm)" || bad "unknown does not raise the row"

# mtime must NOT be the signal: identical content, newer timestamp, still current.
printf 'SAME\n' > "$SDT/repo/justify/dist/justify-core.js"
printf 'SAME\n' > "$SDT/home/justify/dist/justify-core.js"
touch "$SDT/repo/justify/dist/justify-core.js"
[ "$(_sd "$SDT/repo" "$SDT/home")" = "justify|current" ] \
  && ok "a touched source with identical content stays current (no mtime false fire)" \
  || bad "a touched source with identical content stays current"

rm -rf "$SDT"

echo "== $pass passed, $fail failed =="
[ "$fail" = 0 ]
