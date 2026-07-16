#!/usr/bin/env bash
# test-component-browser.sh - unit tests for the bucket browser pure functions.
set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TREE="$REPO_DIR/claude/hooks/browser-tree.json"
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

# ---- accessor tests (Task 2) ----
source "$REPO_DIR/claude/hooks/browser-lib.sh"
browser_load "$TREE"
[ "$(browser_buckets)" = "Foundation Beats sidecoach justify tilt-lab lotus Design Tools Guardrails Voice & chat Dev surface Personal" ] \
  && ok "bucket order (keys)" || bad "bucket order (keys)"
[ "$(node_kind 'Beats')" = "group" ] && ok "Beats is group" || bad "Beats is group"
[ "$(node_kind 'sidecoach')" = "hooks" ] && ok "sidecoach is hooks" || bad "sidecoach is hooks"
[ "$(node_kind 'tilt-lab')" = "leaf" ] && ok "tilt-lab is leaf" || bad "tilt-lab is leaf"
[ "$(node_kind 'Beats/Hooks')" = "hooks" ] && ok "Beats/Hooks is hooks" || bad "Beats/Hooks is hooks"
[ "$(node_children 'Beats')" = "memory reflect Hooks" ] && ok "Beats children" || bad "Beats children"
[ "$(node_children 'sidecoach')" = "sidecoach-keyword sidecoach-sessionstart" ] && ok "sidecoach hook children" || bad "sidecoach hook children"
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

# 2. justify partial install: one hook staged on, the other two land in the off-list.
INSTALLED="||"; stage_reset
stage_toggle 'justify/justify-source-guard'
out="$(apply_plan)"
case "$out" in
  *"INSTALL justify justify-watch-guard justify-watch-standing-by"*) ok "justify partial install plan";;
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

# 4. full uninstall via stage_all: every justify hook staged off collapses to a component uninstall.
INSTALLED="|justify/justify-source-guard|justify/justify-watch-guard|justify/justify-watch-standing-by|"; stage_reset
stage_all 'justify' uninstall
out="$(apply_plan)"
case "$out" in
  *"UNINSTALL_COMPONENT justify"*) ok "full uninstall plan";;
  *) bad "full uninstall plan";;
esac

# 5. partial preserve: an already-on hook stays on; only the untouched-off hook is off-listed.
INSTALLED="|justify/justify-watch-guard|"; stage_reset
stage_toggle 'justify/justify-source-guard'
out="$(apply_plan)"
case "$out" in
  *"INSTALL justify justify-watch-standing-by"*) ok "partial preserve plan";;
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
INSTALLED="|justify/justify-source-guard|justify/justify-watch-guard|justify/justify-watch-standing-by|"; stage_reset
stage_toggle 'justify/justify-source-guard'   # currently on -> stages UNINSTALL
stage_all 'justify' install                    # "install all" must clear that
[ "$(pending_under 'justify')" = "0" ] && ok "stage_all install clears opposite pending" || bad "stage_all install clears opposite pending"

# 9. stage_all uninstall is TOTAL: it clears an opposite-direction staged-install.
INSTALLED="||"; stage_reset
stage_toggle 'justify/justify-source-guard'   # currently off -> stages INSTALL
stage_all 'justify' uninstall                  # "uninstall all" must clear that
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
( set -e; stage_reset; stage_toggle 'justify/justify-source-guard'; apply_plan >/dev/null )
[ "$?" = "0" ] && ok "staging layer clean under set -e" || bad "staging layer clean under set -e"

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
INSTALLED="|Guardrails/codex/codex-failure-watcher|Guardrails/codex/codex-rescue-guard|justify/justify-source-guard|justify/justify-watch-guard|justify/justify-watch-standing-by|"
stage_reset
stage_toggle 'Guardrails/codex/codex-rescue-guard'   # currently ON -> stages uninstall
stage_all 'Guardrails/chrome' install                # currently OFF -> stages all 3 on
[ "$(apl_line 1)" = "INSTALL chrome,codex|codex-rescue-guard.sh" ] \
  && ok "apply_pending_plan canonical INSTALL line" || bad "apply_pending_plan canonical INSTALL line"
[ "$(apl_line 2)" = "DEACTIVATE " ] \
  && ok "apply_pending_plan canonical DEACTIVATE empty" || bad "apply_pending_plan canonical DEACTIVATE empty"

# 16. whole-component uninstall: every justify hook off -> DEACTIVATE justify, and justify
# must NOT also appear on the install line (the two lists are disjoint by construction).
INSTALLED="|justify/justify-source-guard|justify/justify-watch-guard|justify/justify-watch-standing-by|"
stage_reset; stage_all 'justify' uninstall
[ "$(apl_line 2)" = "DEACTIVATE justify" ] && ok "apply_pending_plan DEACTIVATE owner" || bad "apply_pending_plan DEACTIVATE owner"
[ "$(apl_line 1)" = "INSTALL |" ] && ok "apply_pending_plan deactivated owner absent from INSTALL" || bad "apply_pending_plan deactivated owner absent from INSTALL"

# 17. pure install, no off-list: a leaf component yields an empty off-list field.
INSTALLED="||"; stage_reset; stage_toggle 'tilt-lab'
[ "$(apl_line 1)" = "INSTALL tilt-lab|" ] && ok "apply_pending_plan pure install empty off-list" || bad "apply_pending_plan pure install empty off-list"

# 18. .sh suffix on a MULTI-hook off-list: apply_plan emits bare tree names, the off-list
# must carry .sh on EVERY entry (install.sh's HOOK_OFF contract is filenames).
INSTALLED="||"; stage_reset; stage_toggle 'justify/justify-source-guard'
[ "$(apl_line 1)" = "INSTALL justify|justify-watch-guard.sh justify-watch-standing-by.sh" ] \
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
( set -e; stage_reset; stage_toggle 'justify/justify-source-guard'; apply_pending_plan >/dev/null )
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

# 26. commits available -> "available" + every subject line, verbatim.
check_updates() { printf 'fix the widget\nbump the dep\n'; return 0; }
_us_out="$(update_status)"
[ "$(printf '%s\n' "$_us_out" | sed -n 1p)" = "available" ] \
  && ok "update_status line 1 is available" || bad "update_status line 1 is available (got $(printf '%s\n' "$_us_out" | sed -n 1p))"
printf '%s\n' "$_us_out" | grep -Fqx "fix the widget" \
  && ok "update_status carries first commit subject" || bad "update_status carries first commit subject"
printf '%s\n' "$_us_out" | grep -Fqx "bump the dep" \
  && ok "update_status carries second commit subject" || bad "update_status carries second commit subject"
# The EXACT whole output, not just "line 1 + the subjects appear somewhere": the contract is
# "line 1 exactly, lines 2+ verbatim IN ORDER". Greps alone would pass an implementation
# that duplicated, reordered, or padded the subject lines.
[ "$_us_out" = "$(printf 'available\nfix the widget\nbump the dep')" ] \
  && ok "update_status emits exactly available + subjects in order" \
  || bad "update_status emits exactly available + subjects in order (got '$_us_out')"

# 27. no commits, exit 0 -> "up-to-date". This is the case the missing `return 0` in
# check_updates used to render indistinguishable from "unknown".
check_updates() { return 0; }
[ "$(update_status)" = "up-to-date" ] && ok "update_status up-to-date" || bad "update_status up-to-date (got $(update_status))"

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

echo "== $pass passed, $fail failed =="
[ "$fail" = 0 ]
