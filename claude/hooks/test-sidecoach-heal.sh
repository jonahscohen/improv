#!/usr/bin/env bash
# test-sidecoach-heal.sh - sidecoach-heal.sh, the SessionStart self-heal that reasserts
# Sidecoach's own hook symlinks + settings registrations.
#
# Every case drives the REAL hook against a throwaway sandbox HOME, reading the real
# repo's app-wirings.json / browser-tree.json as its source of truth (the hook resolves
# its repo from its own symlink location, so a sandbox ~/.claude/hooks symlink into this
# repo makes REPO_DIR resolve here). Nothing is written outside the sandbox.
#
# The invariant under test is the (symlink, registration) PAIR contract:
#   registration present, symlink missing  -> create the symlink
#   symlink present, registration missing  -> add the registration
#   BOTH absent                            -> leave alone (a deliberate per-hook disable)
#   both present                           -> no-op (no churn)
# plus: no-op entirely unless the sidecoach skill is deployed (deactivation-safe).
set -u

command -v python3 >/dev/null 2>&1 || { echo "FATAL: python3 required" >&2; exit 2; }

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK_SRC="$REPO_DIR/claude/hooks/sidecoach-heal.sh"
[ -f "$HOOK_SRC" ] || { echo "FATAL: $HOOK_SRC missing" >&2; exit 2; }

pass=0; fail=0
ok()  { echo "PASS $1"; pass=$((pass+1)); }
bad() { echo "FAIL $1"; fail=$((fail+1)); }

SBROOT="$(mktemp -d)" || { echo "FATAL: mktemp -d failed" >&2; exit 2; }
trap 'rm -rf "$SBROOT"' EXIT

# The default-on sidecoach hooks, derived exactly as the hook derives them: every
# sidecoach-*.sh key in app-wirings.json minus browser-tree default_off_hooks.
HOOKS="$(python3 - "$REPO_DIR" <<'PY'
import json, os, sys
repo = sys.argv[1]
h = os.path.join(repo, "claude", "hooks")
wir = json.load(open(os.path.join(h, "app-wirings.json")))
tree = json.load(open(os.path.join(h, "browser-tree.json")))
off = set()
for n in tree.get("default_off_hooks", []) or []:
    off.add(n if n.endswith(".sh") else n + ".sh")
names = [k for k in wir if k.startswith("sidecoach-") and k.endswith(".sh") and k not in off]
print(" ".join(names))
PY
)"
[ -n "$HOOKS" ] || { echo "FATAL: could not derive default-on hook set" >&2; exit 2; }
echo "default-on hooks under test: $HOOKS"

# --- sandbox builder ---------------------------------------------------------------
# Fresh HOME with the sidecoach skill deployed, every default-on hook + data file
# symlinked into the repo, and settings.json seeded to {} (no registrations yet).
mk_sandbox() {
  SBHOME="$SBROOT/home.$RANDOM"
  H="$SBHOME/.claude/hooks"
  S="$SBHOME/.claude/settings.json"
  mkdir -p "$H" "$SBHOME/.claude/skills/sidecoach"
  local n
  for n in $HOOKS sidecoach-verbs.json sidecoach-lanes.json sidecoach-intent.json sidecoach_lanes.py; do
    ln -s "$REPO_DIR/claude/hooks/$n" "$H/$n"
  done
  echo '{}' > "$S"
}

run_heal() { printf '{"hook_event_name":"SessionStart"}' | HOME="$SBHOME" bash "$H/sidecoach-heal.sh" 2>/dev/null; }

reg_count() { python3 -c "import json,sys; d=json.load(open('$S')); print(sum(1 for ev in d.get('hooks',{}).values() for g in ev for h in g.get('hooks',[]) if 'sidecoach' in h.get('command','')))"; }
reg_has()   { python3 -c "import json,sys; d=json.load(open('$S')); print('Y' if any('$1' in h.get('command','') for ev in d.get('hooks',{}).values() for g in ev for h in g.get('hooks',[])) else 'N')"; }
strip_reg() { python3 - "$S" "$1" <<'PY'
import json,sys
p,frag=sys.argv[1],sys.argv[2]; d=json.load(open(p)); h=d.get('hooks',{})
for ev in list(h.keys()):
    for g in h[ev]: g['hooks']=[x for x in g.get('hooks',[]) if frag not in x.get('command','')]
    h[ev]=[g for g in h[ev] if g.get('hooks')]
    if not h[ev]: del h[ev]
json.dump(d,open(p,'w'),indent=2)
PY
}

# ================================================================================
# 1. BOOTSTRAP: symlinks present, no registrations -> heal registers every default-on hook.
mk_sandbox
run_heal >/dev/null
n0="$(reg_count)"
[ "$n0" -ge 8 ] && ok "bootstrap: heal registered all default-on hooks (got $n0 >= 8)" \
  || bad "bootstrap: heal registered all default-on hooks (got $n0)"

# 2. CLEAN RE-RUN: nothing to do -> silent, no change.
out="$(run_heal)"; n1="$(reg_count)"
[ -z "$out" ] && [ "$n1" = "$n0" ] && ok "clean re-run is silent and idempotent" \
  || bad "clean re-run is silent and idempotent (out='$out' n=$n1 vs $n0)"

# 3. SYMLINK LOST, registration kept -> heal recreates the symlink, registration untouched.
rm -f "$H/sidecoach-taste-gate.sh"
run_heal >/dev/null
[ -L "$H/sidecoach-taste-gate.sh" ] && [ "$(reg_has sidecoach-taste-gate.sh)" = "Y" ] \
  && ok "symlink-lost/reg-kept -> symlink recreated" \
  || bad "symlink-lost/reg-kept -> symlink recreated (link=$([ -L "$H/sidecoach-taste-gate.sh" ] && echo Y || echo N) reg=$(reg_has sidecoach-taste-gate.sh))"

# 4. REGISTRATION LOST, symlink kept -> heal re-adds it, symlink untouched.
strip_reg sidecoach-craft-floor.sh
[ "$(reg_has sidecoach-craft-floor.sh)" = "N" ] || bad "precondition: craft-floor reg stripped"
run_heal >/dev/null
[ "$(reg_has sidecoach-craft-floor.sh)" = "Y" ] && [ -L "$H/sidecoach-craft-floor.sh" ] \
  && ok "reg-lost/symlink-kept -> registration re-added" \
  || bad "reg-lost/symlink-kept -> registration re-added (reg=$(reg_has sidecoach-craft-floor.sh))"

# 5. BOTH LOST (deliberate per-hook disable) -> heal MUST NOT resurrect either half.
rm -f "$H/sidecoach-postresponse.sh"; strip_reg sidecoach-postresponse.sh
run_heal >/dev/null
[ ! -e "$H/sidecoach-postresponse.sh" ] && [ "$(reg_has sidecoach-postresponse.sh)" = "N" ] \
  && ok "both-lost -> respected, not resurrected" \
  || bad "both-lost -> respected (link=$([ -e "$H/sidecoach-postresponse.sh" ] && echo Y || echo N) reg=$(reg_has sidecoach-postresponse.sh))"

# 6. DEACTIVATION GATE: no skill dir -> no-op even with drift present.
mk_sandbox
run_heal >/dev/null   # baseline registered
strip_reg sidecoach-keyword.sh
rm -rf "$SBHOME/.claude/skills/sidecoach"
out="$(run_heal)"
[ "$(reg_has sidecoach-keyword.sh)" = "N" ] && [ -z "$out" ] \
  && ok "no skill -> heal no-ops (deactivation-safe)" \
  || bad "no skill -> heal no-ops (reg=$(reg_has sidecoach-keyword.sh) out='$out')"

# 7. NO DUPLICATES: registrations after repair equal the clean-install count.
mk_sandbox
run_heal >/dev/null; a="$(reg_count)"
run_heal >/dev/null; run_heal >/dev/null; b="$(reg_count)"
[ "$a" = "$b" ] && ok "repeated heals never duplicate registrations ($a==$b)" \
  || bad "repeated heals never duplicate registrations ($a vs $b)"

echo ""
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
