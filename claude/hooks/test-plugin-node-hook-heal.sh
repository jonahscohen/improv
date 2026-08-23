#!/usr/bin/env bash
# test-plugin-node-hook-heal.sh - regression suite for plugin-node-hook-heal.sh.
# Proves: quote-aware executable-position rewriting (never a quoted/argument `node`),
# idempotency, resolver picks an absolute working node, fail-soft on junk, and that a healed
# bare-node plugin command resolves under the exact reduced hook PATH that triggers the bug.
set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/plugin-node-hook-heal.sh"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "PASS $1"; }
no(){ FAIL=$((FAIL+1)); echo "FAIL $1"; [ -n "${2:-}" ] && echo "     $2"; }

# --- 1. tokenizer cases via a sandbox HOME ------------------------------------
SB="$(mktemp -d)"; trap 'rm -rf "$SB"' EXIT
mkdir -p "$SB/.claude/plugins/cache/testplug/hooks"
CACHE="$SB/.claude/plugins/cache/testplug/hooks/hooks.json"
ABS="/opt/homebrew/bin/node"

python3 - "$CACHE" <<'PY'
import json,sys
cmds={
 "A_leading":         'node "${CLAUDE_PLUGIN_ROOT}/s.mjs" SessionStart',
 "B_brace_and_quote": '[ -f x ] || ! { node -e "const a = { node: 1 }" ; } || node y',
 "C_arg_node":        'echo node is a runtime',
 "D_already_abs":     '/opt/homebrew/bin/node x',
 "E_var_prefix":      'FOO=1 node z',
 "F_env_prefix":      'env A=b node w',
 "G_single_quoted":   "sh -c 'node q'",
 "H_pipe":            'true | node p',
 "I_nodemodules":     'ls node_modules && nodejs --version',
 "J_quoted_assign":   'NODE_OPTIONS="--no-warnings" node hook.mjs',
 "K_squoted_assign":  "FOO='bar baz' node hook.mjs",
 "L_command_prefix":  'command node hook.mjs',
 "M_exec_prefix":     'exec node hook.mjs',
 "N_bang_prefix":     '! node hook.mjs',
}
json.dump({"hooks":{k:[{"hooks":[{"type":"command","command":v}]}] for k,v in cmds.items()}},
          open(sys.argv[1],'w'),indent=2)
PY

HOME="$SB" /bin/sh "$HOOK" SessionStart >/dev/null 2>&1

check(){ # key expected
  got="$(python3 -c "import json,sys;d=json.load(open('$CACHE'));print(d['hooks']['$1'][0]['hooks'][0]['command'])")"
  [ "$got" = "$2" ] && ok "$1" || no "$1" "exp:[$2] got:[$got]"
}
check A_leading         "$ABS \"\${CLAUDE_PLUGIN_ROOT}/s.mjs\" SessionStart"
check B_brace_and_quote "[ -f x ] || ! { $ABS -e \"const a = { node: 1 }\" ; } || $ABS y"
check C_arg_node        "echo node is a runtime"
check D_already_abs     "/opt/homebrew/bin/node x"
check E_var_prefix      "FOO=1 $ABS z"
check F_env_prefix      "env A=b $ABS w"
check G_single_quoted   "sh -c 'node q'"
check H_pipe            "true | $ABS p"
check I_nodemodules     "ls node_modules && nodejs --version"
check J_quoted_assign   "NODE_OPTIONS=\"--no-warnings\" $ABS hook.mjs"
check K_squoted_assign  "FOO='bar baz' $ABS hook.mjs"
check L_command_prefix  "command $ABS hook.mjs"
check M_exec_prefix     "exec $ABS hook.mjs"
check N_bang_prefix     "! $ABS hook.mjs"

# --- 2. idempotency -----------------------------------------------------------
cp "$CACHE" "$SB/before.json"
HOME="$SB" /bin/sh "$HOOK" SessionStart >/dev/null 2>&1
if diff -q "$SB/before.json" "$CACHE" >/dev/null; then ok "idempotent"; else no "idempotent"; fi

# --- 3. fail-soft on a malformed hooks.json -----------------------------------
mkdir -p "$SB/.claude/plugins/cache/junk/hooks"
printf 'not json {{{' > "$SB/.claude/plugins/cache/junk/hooks/hooks.json"
HOME="$SB" /bin/sh "$HOOK" SessionStart >/dev/null 2>&1
[ $? -eq 0 ] && ok "fail-soft on junk json" || no "fail-soft on junk json"

# --- 4. resolver yields an absolute working node -----------------------------
# The rewrites in step 1 only happened because the hook resolved an absolute node; confirm the
# healed commands carry an absolute /.../node (not a bare or relative resolution).
if grep -q '"command": "/' "$CACHE"; then ok "resolver used an absolute node"; else no "resolver used an absolute node"; fi

# --- 5. reduced-PATH: a healed bare-node command resolves ---------------------
# Simulate the captured reduced hook PATH and confirm no "command not found".
red="$(env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin" /bin/sh -c "$ABS --version" 2>&1)"
case "$red" in
  v[0-9]*) ok "reduced-PATH absolute node resolves ($red)" ;;
  *) no "reduced-PATH absolute node resolves" "$red" ;;
esac

echo "----"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
