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
# A hook that exists on disk but is in neither the tree nor install.sh.
"$GUARD" --check voice-mandate >/dev/null 2>&1 && bad "unmanaged hook flagged" || ok "unmanaged hook flagged"
# Shared dependency: deployed, exec'd by other hooks, never wired standalone.
"$GUARD" --check nonexistent-hook-xyz >/dev/null 2>&1 && bad "unknown name flagged" || ok "unknown name flagged"

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
rm -f "$FLAG" "$ACKED"
"$GUARD" --audit >/dev/null 2>&1; rc=$?
[ "$rc" = "1" ] && ok "audit exits 1 while unmanaged hooks exist" || bad "audit exits 1 while unmanaged hooks exist (rc=$rc)"
"$GUARD" --audit 2>/dev/null | grep -q "UNMANAGED: voice-mandate" && ok "audit names a real unmanaged hook" || bad "audit names a real unmanaged hook"
"$GUARD" --audit 2>/dev/null | grep -q "UNMANAGED: test-" && bad "audit excludes tests" || ok "audit excludes tests"

echo "== $pass passed, $fail failed =="
[ "$fail" = 0 ]
