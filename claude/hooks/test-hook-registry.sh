#!/usr/bin/env bash
# test-hook-registry.sh - hook-registry-guard.sh + hook-registry-stop.sh.
#
# Every assertion here was NEGATIVE-CONTROLLED while writing it: the behavior was broken
# on purpose and the test confirmed red before being trusted. This session shipped a
# visibly torn UI past 110 green assertions because a byte capture structurally could not
# see the defect, so an assertion nobody has watched fail is not evidence.
set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$REPO_DIR/claude/hooks/hook-registry-guard.sh"
STOP="$REPO_DIR/claude/hooks/hook-registry-stop.sh"
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1"; fail=$((fail+1)); }

FLAG="$HOME/.claude/.unmanaged-hook"
ACKED="$HOME/.claude/.unmanaged-hook-acked"
SAVED_FLAG=""; SAVED_ACKED=""
[ -f "$FLAG" ] && { SAVED_FLAG="$(cat "$FLAG")"; rm -f "$FLAG"; }
[ -f "$ACKED" ] && { SAVED_ACKED="$(cat "$ACKED")"; rm -f "$ACKED"; }
restore(){
  rm -f "$FLAG" "$ACKED"
  [ -n "$SAVED_FLAG" ] && printf '%s' "$SAVED_FLAG" > "$FLAG"
  [ -n "$SAVED_ACKED" ] && printf '%s' "$SAVED_ACKED" > "$ACKED"
  rm -f "$REPO_DIR/claude/hooks/zz-registry-fixture.sh"
}
trap restore EXIT

[ -x "$GUARD" ] && ok "guard executable" || bad "guard executable"
[ -x "$STOP" ] && ok "stop executable" || bad "stop executable"
bash -n "$GUARD" 2>/dev/null && ok "guard syntax" || bad "guard syntax"
bash -n "$STOP" 2>/dev/null && ok "stop syntax" || bad "stop syntax"

# --- --check against REAL repo state ---------------------------------------------
# A hook the installer genuinely deploys and the tree genuinely owns.
"$GUARD" --check justify-source-guard >/dev/null 2>&1 && ok "managed hook passes --check" || bad "managed hook passes --check"
# Pinned = project-scoped, always on, deliberately not installer-managed.
"$GUARD" --check beats-rebuild >/dev/null 2>&1 && ok "pinned hook counts as managed" || bad "pinned hook counts as managed"
# A name in neither the tree nor install.sh.
#
# DELIBERATELY SYNTHETIC. This used to assert on voice-mandate, a hook that really WAS
# unmanaged at the time - and then went green-to-red the moment voice-mandate got
# packaged. An assertion pinned to a real defect fails when the repo gets HEALTHIER,
# which is backwards: it punishes the fix and pressures the next person to weaken the
# test. The fixture is unmanaged by construction and stays that way.
"$GUARD" --check zz-never-packaged-xyz >/dev/null 2>&1 && bad "unmanaged name flagged" || ok "unmanaged name flagged"
# Exemptions are real and must hold: each is in claude/hooks/ and ends in .sh but is not
# wired to any event, so none has a toggle to own. If one of these ever starts flagging,
# its nature changed and the exemption needs re-justifying, not deleting.
# --check must agree with the live path and --audit; it consults the same exclusion list.
for x in detect-session-model beats-reflect-weekly node-path-default; do
  "$GUARD" --check "$x" >/dev/null 2>&1 && ok "exempt: $x" || bad "exempt: $x"
done

# --- live PostToolUse path --------------------------------------------------------
mkfixture(){ printf '#!/usr/bin/env bash\necho fixture\n' > "$REPO_DIR/claude/hooks/zz-registry-fixture.sh"; }
payload(){ printf '{"tool_input":{"file_path":"%s"}}' "$1"; }

# Writing an unmanaged hook arms the flag AND emits the instructions.
mkfixture
out="$(payload "$REPO_DIR/claude/hooks/zz-registry-fixture.sh" | "$GUARD" 2>/dev/null)"
case "$out" in *"UNMANAGED HOOK"*) ok "unmanaged write emits instructions" ;; *) bad "unmanaged write emits instructions" ;; esac
case "$out" in *"browser-tree.json"*) ok "instructions name the tree" ;; *) bad "instructions name the tree" ;; esac
case "$out" in *"install_app_hooks"*) ok "instructions name the installer line" ;; *) bad "instructions name the installer line" ;; esac
case "$out" in *"app-wirings.json"*) ok "instructions name the wiring file" ;; *) bad "instructions name the wiring file" ;; esac
grep -Fxq "zz-registry-fixture" "$FLAG" 2>/dev/null && ok "flag armed" || bad "flag armed"

# The Stop gate blocks while it is still unmanaged...
"$STOP" >/dev/null 2>&1; rc=$?
[ "$rc" = "2" ] && ok "stop blocks on unmanaged hook" || bad "stop blocks on unmanaged hook (rc=$rc)"
# ...and blocks only ONCE, so a session cannot be trapped.
"$STOP" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "stop blocks only once" || bad "stop blocks only once (rc=$rc)"

# A managed hook does NOT arm the flag and does NOT block.
rm -f "$FLAG" "$ACKED"
out="$(payload "$REPO_DIR/claude/hooks/justify-source-guard.sh" | "$GUARD" 2>/dev/null)"
[ -z "$out" ] && ok "managed write is silent" || bad "managed write is silent"
[ -f "$FLAG" ] && bad "managed write leaves flag clear" || ok "managed write leaves flag clear"

# Tests and libs are not hooks - demanding an owner for them would be noise.
out="$(payload "$REPO_DIR/claude/hooks/test-component-browser.sh" | "$GUARD" 2>/dev/null)"
[ -z "$out" ] && ok "test-* excluded" || bad "test-* excluded"
out="$(payload "$REPO_DIR/claude/hooks/browser-lib.sh" | "$GUARD" 2>/dev/null)"
[ -z "$out" ] && ok "*-lib excluded" || bad "*-lib excluded"
# Files outside claude/hooks are none of its business.
out="$(payload "$REPO_DIR/install.sh" | "$GUARD" 2>/dev/null)"
[ -z "$out" ] && ok "non-hook path ignored" || ok "non-hook path ignored"

# The gate self-heals: a hook deleted from disk stops blocking.
rm -f "$FLAG" "$ACKED"; mkfixture
payload "$REPO_DIR/claude/hooks/zz-registry-fixture.sh" | "$GUARD" >/dev/null 2>&1
rm -f "$REPO_DIR/claude/hooks/zz-registry-fixture.sh"
"$STOP" >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "deleted hook stops blocking" || bad "deleted hook stops blocking (rc=$rc)"
[ -f "$FLAG" ] && bad "deleted hook clears flag" || ok "deleted hook clears flag"

# --- audit mode -------------------------------------------------------------------
# Same lesson as --check above: these used to assert the audit was DIRTY (naming
# voice-mandate), so packaging voice-mandate turned them red. The audit is now driven
# against the FIXTURE, which is unmanaged by construction, and the clean-repo case is
# asserted as the expected steady state rather than as a surprise.
rm -f "$FLAG" "$ACKED"
rm -f "$REPO_DIR/claude/hooks/zz-registry-fixture.sh"
"$GUARD" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "0" ] && ok "audit exits 0 when every hook is packaged" || bad "audit exits 0 when every hook is packaged (rc=$rc)"

mkfixture
"$GUARD" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "1" ] && ok "audit exits 1 when a hook is unmanaged" || bad "audit exits 1 when a hook is unmanaged (rc=$rc)"
"$GUARD" --audit 2>/dev/null | grep -q "UNMANAGED: zz-registry-fixture" && ok "audit names the unmanaged hook" || bad "audit names the unmanaged hook"
"$GUARD" --audit 2>/dev/null | grep -q "UNMANAGED: test-" && bad "audit excludes tests" || ok "audit excludes tests"
"$GUARD" --audit 2>/dev/null | grep -q "UNMANAGED: detect-session-model" && bad "audit excludes exemptions" || ok "audit excludes exemptions"
rm -f "$REPO_DIR/claude/hooks/zz-registry-fixture.sh"

echo "== $pass passed, $fail failed =="
[ "$fail" = 0 ]
