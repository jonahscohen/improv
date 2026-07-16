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

echo "== $pass passed, $fail failed =="
[ "$fail" = 0 ]
